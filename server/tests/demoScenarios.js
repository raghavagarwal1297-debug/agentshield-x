// Runs the stage demo scenarios through the real API and judges each one by
// SANDBOX STATE (outbox, records, refunds, leaked key values), not reply text.
// Usage (server running): node tests/demoScenarios.js [off|monitor|enforce ...] [--only=1,2] [--pause=20]
import { SCENARIOS } from './scenarios.js';

const BASE = process.env.BASE_URL || 'http://localhost:4000';
const args = process.argv.slice(2);
const modes = args.filter((a) => ['off', 'monitor', 'enforce'].includes(a));
const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean).map(Number);
const PAUSE_MS = Number((args.find((a) => a.startsWith('--pause=')) || '--pause=20').slice(8)) * 1000;

const post = (path, body, headers = {}) => fetch(`${BASE}${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
}).then((r) => r.json());

const initial = await fetch(`${BASE}/api/guard`).then((r) => r.json());
let first = true;
for (const mode of modes.length ? modes : ['off', 'enforce']) {
  console.log(`\n================ guard ${mode.toUpperCase()} ================`);
  for (const s of SCENARIOS.filter((x) => !only.length || only.includes(x.n))) {
    if (!first && PAUSE_MS) await new Promise((r) => setTimeout(r, PAUSE_MS));
    first = false;
    await fetch(`${BASE}/api/reset`);
    await post('/api/guard', { mode, layers: { scanner: true, firewall: true, approval: true, egress: true, ...(s.layers || {}) } });
    const t = Date.now();
    let r = await post('/api/chat', { user_id: s.user, message: s.message, doc_ids: s.doc_ids || [] });
    if (r.pending_approval_id && s.approve) {
      const ap = await post(`/api/approvals/${r.pending_approval_id}`, { decision: 'approve', by: 'demo_script' });
      r = { ...(ap.result || {}), approved: r.pending_approval_id };
    }
    const effect = r.error ? null : s.judge(r);
    const verdict = r.error ? `ERROR ${r.error.slice(0, 80)}`
      : s.legit ? (effect ? 'LEGIT OK' : 'LEGIT FAILED')
      : r.approved ? `PAUSED, human approved, then ran (${effect || 'no effect'})`
      : effect ? `ATTACK SUCCEEDED (${effect})` : 'attack stopped';
    console.log(`\n#${s.n} ${s.title}  [${Date.now() - t} ms]\n   => ${verdict}${r.approved ? ` (approved ${r.approved})` : ''}`);
    console.log(`   steps: ${(r.steps || []).map((x) => `${x.tool}(${x.outcome})`).join(' > ') || '-'}`);
    for (const d of r.decisions || []) {
      if (d.outcome === 'ALLOW' && !d.rule_ids?.length && !d.would_block) continue;
      console.log(`   ${d.would_block ? 'WOULD ' + d.original_outcome : d.outcome} [${d.stage}/${d.layer}] ${(d.rule_ids || []).join(',')} risk ${d.risk}${d.incident_id ? ' ' + d.incident_id : ''}`);
    }
    console.log(`   reply: ${(r.reply || '').replace(/\s+/g, ' ').slice(0, 160)}`);
  }
}
await fetch(`${BASE}/api/reset`);
await post('/api/guard', initial);
