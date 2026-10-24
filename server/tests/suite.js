// Evaluation runner: guard OFF vs ENFORCE on two case sets
//   attacks - the demo scenarios in tests/scenarios.js that are not legit
//   legit   - tests/legit.json
// Every case starts from a clean sandbox and is judged by sandbox state.
// Approvals are auto-decided: reject for attacks, approve for legit tasks.
//
// Metrics
//   asr              attacks that reached their goal / valid attacks
//   task_completion  legit tasks completed / valid legit tasks
//   false_positive   legit tasks that were blocked (any BLOCK decision) or not completed
//                    / valid legit tasks. Policy redactions alone do not count.
//   permission       tool calls the role may not use: stopped / attempted
//   latency          average ms per request, and ms spent inside guard hooks
// Cases that error (LLM down, rate limit) are listed but left out of every rate.
import fs from 'fs';
import { resetAll } from '../reset.js';
import { runAgent } from '../agent/agent.js';
import { guard, getGuardState, setGuardState } from '../guard/index.js';
import { decide } from '../guard/approvals.js';
import { roleConfig } from '../guard/toolFirewall.js';
import { getSession } from '../sessions.js';
import { readJSON, writeJSON } from '../store.js';
import { llmInfo } from '../llm.js';
import { SCENARIOS } from './scenarios.js';
import { evaluate } from './conditions.js';

const ALL_LAYERS = { scanner: true, firewall: true, approval: true, egress: true };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function loadCases() {
  const users = readJSON('users.json');
  const userFor = (role) => users.find((u) => u.role === role);
  const roleOf = (id) => users.find((u) => u.id === id)?.role;

  const attacks = SCENARIOS.filter((s) => !s.legit).map((s) => ({
    id: `S${s.n}`, set: 'attack', title: s.title, user: users.find((u) => u.id === s.user),
    messages: [s.message], doc_ids: s.doc_ids || [], layers: s.layers || {}, approval: 'reject',
    judge: (run) => s.judge({ reply: run.replies.join('\n') }),
  }));

  const legitFile = JSON.parse(fs.readFileSync(new URL('./legit.json', import.meta.url), 'utf8'));
  const legit = legitFile.cases.map((c) => ({
    id: c.id, set: 'legit', title: c.title, user: userFor(c.role) || users.find((u) => u.id === c.user_id),
    messages: c.messages, doc_ids: c.doc_ids || [], layers: {}, approval: c.approval || 'approve',
    judge: (run) => { const r = evaluate(c.completed_if, run); return r.met ? r.details.join('; ') : null; },
  }));
  return { attacks, legit, roleOf };
}

// Guard proxy that measures time spent inside guard hooks.
function timedGuard(timer) {
  const wrap = (name) => async (args) => {
    const t = performance.now();
    try { return await guard[name](args); } finally { timer.ms += performance.now() - t; }
  };
  return {
    get mode() { return guard.mode; },
    checkInput: wrap('checkInput'), checkDocument: wrap('checkDocument'), checkToolCall: wrap('checkToolCall'),
    checkToolOutput: wrap('checkToolOutput'), checkEgress: wrap('checkEgress'),
  };
}

async function runCase(c, mode) {
  resetAll();
  setGuardState({ mode, layers: { ...ALL_LAYERS, ...c.layers } });
  const session = getSession(c.user.id, `suite-${mode}-${c.id}-${Date.now()}`);
  const timer = { ms: 0 };
  const run = { replies: [], steps: [], decisions: [], requests: 0, ms: 0 };
  const started = performance.now();
  try {
    for (const [i, text] of c.messages.entries()) {
      const trace = {};
      const res = await runAgent({
        user: c.user, message: typeof text === 'string' ? text : text.text,
        doc_ids: i === 0 ? c.doc_ids : [], guard: timedGuard(timer), session, trace,
        onApproval: (id) => decide(id, { decision: c.approval, by: 'test_suite' }),
      });
      run.replies.push(res.reply || '');
      run.steps.push(...res.steps);
      run.decisions.push(...res.decisions);
      run.requests++;
    }
  } catch (e) {
    return { error: e.message, ms: Math.round(performance.now() - started) };
  }
  run.ms = performance.now() - started;
  const effect = c.judge(run);

  const allowed = roleConfig(c.user.role).tools || [];
  const unauthorised = run.steps.filter((s) => !allowed.includes('*') && !allowed.includes(s.tool));
  return {
    achieved: !!effect, effect,
    blocked: run.decisions.some((d) => d.outcome === 'BLOCK'),
    redacted: run.decisions.some((d) => d.outcome === 'REDACT'),
    // layer that stopped or paused the run first (null if nothing did)
    layer: run.decisions.find((d) => ['BLOCK', 'NEEDS_APPROVAL'].includes(d.outcome))?.layer || null,
    rules: [...new Set(run.decisions.filter((d) => d.outcome !== 'ALLOW').flatMap((d) => d.rule_ids || []))],
    unauthorised_attempted: unauthorised.length,
    unauthorised_stopped: unauthorised.filter((s) => s.outcome === 'BLOCK').length,
    tools: run.steps.map((s) => `${s.tool}(${s.outcome})`),
    requests: run.requests,
    ms: Math.round(run.ms),
    guard_ms: Math.round(timer.ms * 10) / 10,
    reply: run.replies.join(' | ').replace(/\s+/g, ' ').slice(0, 200),
  };
}

const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : null);
// A legit task is a false positive only if it was blocked or did not complete.
const isFalsePositive = (r) => r.blocked || !r.achieved;

function summarise(rows, mode) {
  const ok = (set) => rows.filter((r) => r.set === set && !r[mode].error).map((r) => r[mode]);
  const att = ok('attack');
  const leg = ok('legit');
  const all = [...att, ...leg];
  const reqs = all.reduce((s, r) => s + r.requests, 0);
  const attempted = all.reduce((s, r) => s + r.unauthorised_attempted, 0);
  return {
    asr: pct(att.filter((r) => r.achieved).length, att.length),
    attacks: { succeeded: att.filter((r) => r.achieved).length, valid: att.length },
    task_completion: pct(leg.filter((r) => r.achieved).length, leg.length),
    legit: { completed: leg.filter((r) => r.achieved).length, valid: leg.length },
    false_positive_rate: pct(leg.filter(isFalsePositive).length, leg.length),
    false_positives: rows.filter((r) => r.set === 'legit' && r[mode] && !r[mode].error && isFalsePositive(r[mode])).map((r) => r.id),
    redacted_but_completed: rows.filter((r) => r.set === 'legit' && r[mode]?.redacted && r[mode].achieved).map((r) => r.id),
    permission_enforcement: attempted ? pct(all.reduce((s, r) => s + r.unauthorised_stopped, 0), attempted) : null,
    unauthorised_calls: { stopped: all.reduce((s, r) => s + r.unauthorised_stopped, 0), attempted },
    avg_ms_per_request: reqs ? Math.round(all.reduce((s, r) => s + r.ms, 0) / reqs) : null,
    avg_guard_ms_per_request: reqs ? Math.round((all.reduce((s, r) => s + r.guard_ms, 0) / reqs) * 10) / 10 : null,
    errors: rows.filter((r) => r[mode]?.error).map((r) => r.id),
  };
}

let running = false;
export const isRunning = () => running;

// modes: ['off', 'enforce'] (default both). onProgress(event) is called after every case.
export async function runSuite({ modes = ['off', 'enforce'], only = null, pauseMs = 0, onProgress } = {}) {
  if (running) throw new Error('A test run is already in progress');
  running = true;
  const before = getGuardState();
  // the demo's incident log survives the run (cases reset the sandbox)
  const incidentsBefore = readJSON('incidents.json');
  const startedAt = new Date().toISOString();
  try {
    const { attacks, legit } = loadCases();
    const cases = [...attacks, ...legit].filter((c) => !only || only.includes(c.id));
    const rows = cases.map((c) => ({ id: c.id, set: c.set, title: c.title, role: c.user.role }));
    const total = cases.length * modes.length;
    let done = 0;
    for (const mode of modes) {
      for (const [i, c] of cases.entries()) {
        if (done > 0 && pauseMs) await sleep(pauseMs);
        rows[i][mode] = await runCase(c, mode);
        if (mode === 'enforce') rows[i].layer = rows[i][mode].layer || null;
        done++;
        onProgress?.({ mode, id: c.id, set: c.set, done, total, result: rows[i][mode] });
      }
    }
    const result = { started: startedAt, finished: new Date().toISOString(), llm: llmInfo(), modes, cases: rows };
    for (const mode of modes) result[mode === 'enforce' ? 'on' : mode] = summarise(rows, mode);
    if (result.off && result.on) {
      result.on.added_latency_ms = result.on.avg_ms_per_request != null && result.off.avg_ms_per_request != null
        ? result.on.avg_ms_per_request - result.off.avg_ms_per_request : null;
    }
    saveResult(result);
    return result;
  } finally {
    resetAll();
    writeJSON('incidents.json', incidentsBefore);
    setGuardState(before);
    running = false;
  }
}

function saveResult(result) {
  const dir = new URL('./results/', import.meta.url);
  fs.mkdirSync(dir, { recursive: true });
  const name = `suite-${result.finished.replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(new URL(name, dir), JSON.stringify(result, null, 2));
  fs.writeFileSync(new URL('latest.json', dir), JSON.stringify(result, null, 2));
}
