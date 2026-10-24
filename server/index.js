// AgentShield X - Express server: routes, SSE feed and guard pipeline.
import 'dotenv/config';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import { readJSON, writeJSON } from './store.js';
import { resetAll } from './reset.js';
import { getSession } from './sessions.js';
import { runAgent } from './agent/agent.js';
import { listDocuments, readDocumentText } from './agent/tools.js';
import { guard, getGuardState, setGuardState } from './guard/index.js';
import { loadRules } from './guard/rules.js';
import { loadDetectors } from './guard/detectors.js';
import { listApprovals, decide, attachResult, waitForResult } from './guard/approvals.js';
import { listIncidents, getIncident, writeReport } from './guard/incidents.js';
import { findHiddenSpans } from './guard/normalize.js';
import { validatePolicy } from './guard/policy.js';
import { bus } from './guard/events.js';
import { runSuite, isRunning, loadCases } from './tests/suite.js';
import { LLMError, llmInfo } from './llm.js';
import { replayOnly } from './llmCache.js';
import { chatView, metricsView } from './clientView.js';

const app = express();
// The dashboard normally goes through the Vite proxy; direct calls from the
// dev server origin are allowed too (CORS_ORIGIN, comma separated).
app.use(cors({ origin: (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173').split(',') }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  const rules = loadRules();
  res.json({
    ok: true, service: 'agentshield-x', agent: 'NimbusAssist', llm: llmInfo(), guard: getGuardState(),
    scanner_rules: { loaded: rules.rules.length, problems: rules.problems },
    dlp_detectors: (({ detectors, problems }) => ({ loaded: detectors.length, problems }))(loadDetectors()),
    time: new Date().toISOString(),
  });
});

// GET/POST /api/guard { mode: off|monitor|enforce, layers: { scanner, firewall, approval, egress } }
// POST accepts a partial update, e.g. { "layers": { "scanner": false } }.
app.get('/api/guard', (req, res) => res.json(getGuardState()));
app.post('/api/guard', (req, res) => {
  try {
    res.json(setGuardState(req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Live feed (Server-Sent Events): decision, incident, approval_created,
// approval_resolved, guard_changed. Sends the guard state on connect.
const STREAM_EVENTS = ['decision', 'incident', 'approval_created', 'approval_resolved', 'guard_changed', 'test_progress', 'test_finished'];
app.get('/api/stream', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  send('hello', getGuardState());
  const handlers = STREAM_EVENTS.map((name) => [name, (data) => send(name, data)]);
  handlers.forEach(([name, fn]) => bus.on(name, fn));
  const ping = setInterval(() => res.write(': ping\n\n'), 20000);
  req.on('close', () => {
    clearInterval(ping);
    handlers.forEach(([name, fn]) => bus.off(name, fn));
  });
});

// Incidents (newest first)
app.get('/api/incidents', (req, res) => {
  res.json(listIncidents({ limit: Math.min(Number(req.query.limit) || 100, 1000) }));
});
app.get('/api/incidents/:id', (req, res) => {
  const inc = getIncident(req.params.id);
  return inc ? res.json(inc) : res.status(404).json({ error: `Incident ${req.params.id} not found` });
});
// Manager-friendly report written by the judge model (template fallback).
// -> { report: { text, classification, executive_summary, regulatory_impact, generated_by }, generated_by }
app.post('/api/incidents/:id/report', async (req, res) => {
  const report = await writeReport(req.params.id);
  return report ? res.json({ report, generated_by: report.generated_by }) : res.status(404).json({ error: `Incident ${req.params.id} not found` });
});

// Policy. Editing is a demo feature: only an admin session (X-User-Id header)
// may change it, and it can be disabled with ALLOW_POLICY_EDIT=false (v2 fix #15).
app.get('/api/policy', (req, res) => res.json(readJSON('policy.json')));
app.put('/api/policy', (req, res) => {
  if (process.env.ALLOW_POLICY_EDIT === 'false') return res.status(403).json({ error: 'Policy editing is disabled (ALLOW_POLICY_EDIT=false)' });
  const editor = readJSON('users.json').find((u) => u.id === req.get('x-user-id'));
  if (editor?.role !== 'admin') return res.status(403).json({ error: 'Only an admin user may change the policy (send header X-User-Id: admin_riya)' });
  const errors = validatePolicy(req.body);
  if (errors.length) return res.status(400).json({ error: 'Invalid policy', problems: errors });
  writeJSON('policy.json', req.body);
  res.json(req.body);
});
// Dry-run validation for the policy editor; changes nothing.
app.post('/api/policy/validate', (req, res) => {
  const problems = validatePolicy(req.body);
  res.json({ valid: problems.length === 0, problems });
});

// Evaluation: POST /api/tests/run { mode: off|enforce|both, pause_ms?, only?: [case ids] }
// -> { off, on, cases, ... }. Resets the sandbox per case, so do not run it
// during a live demo. Progress is streamed as test_progress events.
app.post('/api/tests/run', async (req, res) => {
  const { mode = 'both', pause_ms = 0, only = null, include_heldout = false, replay = false } = req.body || {};
  if (include_heldout) return res.status(400).json({ error: 'The held-out set is not available yet (tests/heldout.json pending).' });
  const modes = { off: ['off'], enforce: ['enforce'], both: ['off', 'enforce'] }[mode];
  if (!modes) return res.status(400).json({ error: 'mode must be off, enforce or both' });
  if (isRunning()) return res.status(409).json({ error: 'A test run is already in progress' });
  try {
    // replay: true answers every case from the demo cache only (misses are listed as errors)
    const go = () => runSuite({
      modes, only, pauseMs: Math.min(Number(pause_ms) || 0, 60000),
      onProgress: (p) => bus.emit('test_progress', p),
    });
    const result = await (replay === true ? replayOnly(go) : go());
    bus.emit('test_finished', { off: result.off, on: result.on, finished: result.finished });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
function latestRun() {
  try {
    return JSON.parse(fs.readFileSync(new URL('./tests/results/latest.json', import.meta.url), 'utf8'));
  } catch {
    return null;
  }
}
app.get('/api/tests/latest', (req, res) => {
  const run = latestRun();
  return run ? res.json(run) : res.status(404).json({ error: 'No test run yet' });
});
// Metrics tab data from the last saved run; unmeasured values are null.
app.get('/api/metrics', (req, res) => res.json(metricsView(latestRun())));
// Case list for the Test Lab picker.
app.get('/api/tests/cases', (req, res) => {
  const { attacks, legit } = loadCases();
  res.json([...attacks, ...legit].map((c) => ({ id: c.id, set: c.set, title: c.title, role: c.user?.role })));
});
// Held-out set status for the Test Lab, so the page need not make a failing call to ask.
app.get('/api/tests/heldout', (req, res) => {
  res.json({ available: false, reason: 'The held-out set is not available yet (tests/heldout.json pending).' });
});
app.post('/api/tests/heldout', (req, res) => res.status(400).json({ error: 'The held-out set is not available yet (tests/heldout.json pending).' }));

// Documents the user can attach. hidden_spans lets the UI highlight hidden text.
app.get('/api/documents', (req, res) => {
  const classes = readJSON('policy.json').document_classification || {};
  res.json(listDocuments().map((id) => {
    const { content } = readDocumentText(id);
    return {
      id,
      title: content.split('\n').find((l) => l.trim())?.trim().slice(0, 80) || id,
      classification: classes[id] || 'unclassified',
      hidden_spans: findHiddenSpans(content),
    };
  }));
});
app.get('/api/documents/:id', (req, res) => {
  const doc = readDocumentText(req.params.id);
  if (!doc) return res.status(404).json({ error: `Document ${req.params.id} not found` });
  const classification = readJSON('policy.json').document_classification?.[doc.id] || 'unclassified';
  res.json({ id: doc.id, classification, content: doc.content, hidden_spans: findHiddenSpans(doc.content) });
});

// Restores all sandbox data files to their original state and clears sessions.
// ?keep=incidents keeps the incident log.
app.get('/api/reset', (req, res) => {
  const keepIncidents = req.query.keep === 'incidents';
  resetAll({ keepIncidents });
  res.json({ ok: true, kept_incidents: keepIncidents });
});

// POST /api/chat { user_id, message, doc_ids?, session_id? } -> { reply, decisions, steps, ... }
// The role always comes from users.json via user_id, never from the message text.
app.post('/api/chat', async (req, res) => {
  const { user_id, message, doc_ids = [], session_id } = req.body || {};
  const user = readJSON('users.json').find((u) => u.id === user_id);
  if (!user) return res.status(400).json({ error: `Unknown user_id "${user_id}"` });
  if (typeof message !== 'string' || !message.trim()) return res.status(400).json({ error: 'message is required' });
  if (!Array.isArray(doc_ids)) return res.status(400).json({ error: 'doc_ids must be an array' });

  const session = getSession(user.id, session_id);
  const trace = {};
  const snapshot = (extra) => ({ decisions: [...trace.decisions], steps: [...trace.steps], session: session.id, request_id: trace.request_id, ...extra });

  // If a tool call needs approval we answer right away with pending_approval_id;
  // the paused run keeps going in the background and its final result is
  // returned by POST /api/approvals/:id (and later pushed over SSE).
  let currentApproval = null;
  let resolvePaused;
  const paused = new Promise((r) => { resolvePaused = r; });
  const onApproval = (id) => {
    // a later approval in the same run: hand the previous one a "paused again" result
    if (currentApproval) attachResult(currentApproval, snapshot({ reply: `Paused again: waiting for approval ${id}.`, pending_approval_id: id }));
    else resolvePaused(id);
    currentApproval = id;
  };

  // replay: true = answer only from the demo cache, never call the LLM (Autopilot)
  const start = () => runAgent({ user, message, doc_ids, guard, session, trace, onApproval });
  const run = req.body.replay === true ? replayOnly(start) : start();
  run.then(
    (result) => currentApproval && attachResult(currentApproval, result),
    (e) => currentApproval && attachResult(currentApproval, failure(e).body),
  );

  const first = await Promise.race([
    run.then((result) => ({ result }), (error) => ({ error })),
    paused.then((approvalId) => ({ approvalId })),
  ]);
  if (first.approvalId) {
    return res.json(chatView(snapshot({
      reply: `This action needs human approval (${first.approvalId}). NimbusAssist is paused until a reviewer approves or rejects it.`,
      pending_approval_id: first.approvalId,
    })));
  }
  if (first.error) {
    const f = failure(first.error);
    return res.status(f.status).json(f.body);
  }
  res.json(chatView(first.result));
});

function failure(e) {
  console.error('[chat]', e.message);
  return {
    status: e instanceof LLMError ? 503 : 500,
    body: {
      error: e.message,
      reply: e.cacheMiss
        ? 'This request is not in the demo cache, so replay-only mode stopped instead of calling the language model.'
        : 'NimbusAssist is unavailable right now (the language model could not be reached). Please try again.',
      cache_miss: !!e.cacheMiss,
      decisions: [], steps: [],
    },
  };
}

// Approval queue
app.get('/api/approvals', (req, res) => {
  res.json(listApprovals({ status: req.query.status || 'pending' }));
});

// POST /api/approvals/:id { decision: approve|reject, by } -> { ok, approval, result }
// result = the paused agent run's final response once it resumes.
app.post('/api/approvals/:id', async (req, res) => {
  const { decision, by } = req.body || {};
  let approval;
  try {
    approval = decide(req.params.id, { decision, by: by || 'dashboard' });
  } catch (e) {
    return res.status(/not found/.test(e.message) ? 404 : 400).json({ ok: false, error: e.message });
  }
  const result = await waitForResult(approval.id);
  res.json({ ok: true, approval, result: chatView(result) });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`AgentShield X server on http://localhost:${PORT}`));
