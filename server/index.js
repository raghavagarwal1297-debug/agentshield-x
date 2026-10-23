// AgentShield X - Express server: routes, (later) SSE and guard pipeline.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { resetData } from './store.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'agentshield-x', agent: 'NimbusAssist', time: new Date().toISOString() });
});

// Restores all sandbox data files to their original state.
app.get('/api/reset', (req, res) => {
  resetData();
  res.json({ ok: true });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`AgentShield X server on http://localhost:${PORT}`));
