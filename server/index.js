// AgentShield X - Express server: routes, (later) SSE and guard pipeline.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { resetData, readJSON } from './store.js';
import { getSession, resetSessions } from './sessions.js';
import { runAgent } from './agent/agent.js';
import { guard, getGuardState, setGuardMode } from './guard/index.js';
import { loadRules } from './guard/rules.js';
import { listApprovals, decide, attachResult, waitForResult, resetApprovals } from './guard/approvals.js';
import { LLMError, llmInfo } from './llm.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  const rules = loadRules();
  res.json({
    ok: true, service: 'agentshield-x', agent: 'NimbusAssist', llm: llmInfo(), guard: getGuardState(),
    scanner_rules: { loaded: rules.rules.length, problems: rules.problems },
    time: new Date().toISOString(),
  });
});

// Guard switch. Prompt 6 extends this with monitor mode and per-layer toggles.
app.get('/api/guard', (req, res) => res.json(getGuardState()));
app.post('/api/guard', (req, res) => {
  try {
    res.json(setGuardMode(req.body?.mode));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Restores all sandbox data files to their original state and clears sessions.
app.get('/api/reset', (req, res) => {
  resetData();
  resetSessions();
  resetApprovals();
  res.json({ ok: true });
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
  const snapshot = (extra) => ({ decisions: [...trace.decisions], steps: [...trace.steps], session: session.id, ...extra });

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

  const run = runAgent({ user, message, doc_ids, guard, session, trace, onApproval });
  run.then(
    (result) => currentApproval && attachResult(currentApproval, result),
    (e) => currentApproval && attachResult(currentApproval, failure(e).body),
  );

  const first = await Promise.race([
    run.then((result) => ({ result }), (error) => ({ error })),
    paused.then((approvalId) => ({ approvalId })),
  ]);
  if (first.approvalId) {
    return res.json(snapshot({
      reply: `This action needs human approval (${first.approvalId}). NimbusAssist is paused until a reviewer approves or rejects it.`,
      pending_approval_id: first.approvalId,
    }));
  }
  if (first.error) {
    const f = failure(first.error);
    return res.status(f.status).json(f.body);
  }
  res.json(first.result);
});

function failure(e) {
  console.error('[chat]', e.message);
  return {
    status: e instanceof LLMError ? 503 : 500,
    body: {
      error: e.message,
      reply: 'NimbusAssist is unavailable right now (the language model could not be reached). Please try again.',
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
  res.json({ ok: true, approval, result });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`AgentShield X server on http://localhost:${PORT}`));
