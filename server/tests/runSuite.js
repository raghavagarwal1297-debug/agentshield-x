// CLI for the evaluation suite (runs in-process; stop the server first so the
// two do not reset each other's sandbox).
// Usage: node tests/runSuite.js [off|enforce|both] [--only=S2,L01] [--pause=10]
import 'dotenv/config';
import { runSuite } from './suite.js';

const args = process.argv.slice(2);
const mode = args.find((a) => ['off', 'enforce', 'both'].includes(a)) || 'both';
const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const pause = Number((args.find((a) => a.startsWith('--pause=')) || '--pause=0').slice(8)) * 1000;

const result = await runSuite({
  modes: mode === 'both' ? ['off', 'enforce'] : [mode],
  only: only.length ? only : null,
  pauseMs: pause,
  onProgress: (p) => console.log(`[${p.done}/${p.total}] ${p.mode.padEnd(7)} ${p.id.padEnd(4)} ` +
    (p.result.error ? `ERROR ${p.result.error.slice(0, 70)}`
      : `${p.set === 'legit' ? (p.result.achieved ? 'completed' : 'NOT completed') : (p.result.achieved ? 'ATTACK SUCCEEDED' : 'stopped')}` +
        `${p.result.flagged ? ' [flagged]' : ''} ${p.result.ms} ms`)),
});

const row = (label, off, on) => console.log(`${label.padEnd(28)}${String(off ?? '-').padEnd(16)}${on ?? '-'}`);
const f = (m) => m || {};
console.log(`\nmodel: ${result.llm.agent_model} (${result.llm.provider}, ${result.llm.demo_mode})`);
row('', 'guard OFF', 'guard ENFORCE');
row('Attack success rate %', f(result.off).asr, f(result.on).asr);
row('  succeeded / valid', result.off && `${result.off.attacks.succeeded}/${result.off.attacks.valid}`, result.on && `${result.on.attacks.succeeded}/${result.on.attacks.valid}`);
row('Task completion %', f(result.off).task_completion, f(result.on).task_completion);
row('  completed / valid', result.off && `${result.off.legit.completed}/${result.off.legit.valid}`, result.on && `${result.on.legit.completed}/${result.on.legit.valid}`);
row('False positive rate %', f(result.off).false_positive_rate, f(result.on).false_positive_rate);
row('Permission enforcement %', f(result.off).permission_enforcement, f(result.on).permission_enforcement);
row('  stopped / attempted', result.off && `${result.off.unauthorised_calls.stopped}/${result.off.unauthorised_calls.attempted}`, result.on && `${result.on.unauthorised_calls.stopped}/${result.on.unauthorised_calls.attempted}`);
row('Avg ms per request', f(result.off).avg_ms_per_request, f(result.on).avg_ms_per_request);
row('Avg guard ms per request', f(result.off).avg_guard_ms_per_request, f(result.on).avg_guard_ms_per_request);
if (result.on?.false_positives?.length) console.log(`false positives (ON): ${result.on.false_positives.join(', ')}`);
for (const m of ['off', 'on']) if (result[m]?.errors?.length) console.log(`errored (${m}, excluded): ${result[m].errors.join(', ')}`);
console.log('\nsaved: tests/results/latest.json');
