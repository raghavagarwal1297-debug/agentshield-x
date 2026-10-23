// AgentShield X - Express server: routes, (later) SSE and guard pipeline.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { resetData, readJSON } from './store.js';
import { getSession, resetSessions } from './sessions.js';
import { runAgent } from './agent/agent.js';
import { guard, getGuardState, setGuardMode } from './guard/index.js';
import { loadRules } from './guard/rules.js';
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
  try {
    const result = await runAgent({ user, message, doc_ids, guard, session });
    res.json(result);
  } catch (e) {
    console.error('[chat]', e.message);
    const status = e instanceof LLMError ? 503 : 500;
    res.status(status).json({
      error: e.message,
      reply: 'NimbusAssist is unavailable right now (the language model could not be reached). Please try again.',
      decisions: [], steps: [],
    });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`AgentShield X server on http://localhost:${PORT}`));
