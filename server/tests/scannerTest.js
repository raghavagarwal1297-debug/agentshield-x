// Scanner unit test: runs every sample in tests/scanner_samples.json through
// scan() and prints per-sample results plus precision / recall.
// Usage: node tests/scannerTest.js [--llm]
//   --llm   also use the judge-model classifier for unsure scores (needs a key)
// Env: RULES_FILE / SAMPLES_FILE override the default file locations.
import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import { scan, thresholds } from '../guard/inputScanner.js';
import { loadRules } from '../guard/rules.js';

const samplesFile = process.env.SAMPLES_FILE || new URL('./scanner_samples.json', import.meta.url);
const useClassifier = process.argv.includes('--llm');
if (!existsSync(samplesFile)) {
  console.error(`No samples file at ${samplesFile}. Format: docs/rules-format.md`);
  process.exit(1);
}
const samples = JSON.parse(readFileSync(samplesFile, 'utf8'));
const { rules, problems, file } = loadRules();
const t = thresholds();

console.log(`rules: ${rules.length} loaded from ${file}${problems.length ? ` (${problems.length} problems, see warnings above)` : ''}`);
console.log(`thresholds: warn ${t.warn}, block ${t.block} | classifier: ${useClassifier ? 'on' : 'off (heuristics only)'}\n`);

const rows = [];
for (const [label, list] of [['malicious', samples.malicious || []], ['benign', samples.benign || []]]) {
  for (const s of list) {
    const r = await scan(s.text, { source: s.source || 'user message', useClassifier });
    rows.push({ label, text: s.text, risk: r.risk, matches: r.matches, note: s.note || '' });
  }
}

const short = (s) => s.replace(/\s+/g, ' ').slice(0, 60);
for (const r of rows) {
  const flag = r.risk >= t.block ? 'BLOCK' : r.risk >= t.warn ? 'WARN ' : 'allow';
  const ok = (r.label === 'malicious') === (r.risk >= t.block) ? ' ' : 'x';
  console.log(`${ok} [${r.label.padEnd(9)}] ${flag} ${String(r.risk).padStart(3)}  ${short(r.text).padEnd(60)}  ${r.matches.join(',')}`);
}

function metrics(cut) {
  const tp = rows.filter((r) => r.label === 'malicious' && r.risk >= cut).length;
  const fp = rows.filter((r) => r.label === 'benign' && r.risk >= cut).length;
  const fn = rows.filter((r) => r.label === 'malicious' && r.risk < cut).length;
  const pct = (x) => (Number.isFinite(x) ? `${(x * 100).toFixed(0)}%` : 'n/a');
  return `precision ${pct(tp / (tp + fp))}, recall ${pct(tp / (tp + fn))} (TP ${tp}, FP ${fp}, FN ${fn})`;
}
console.log(`\nflagged at block (>= ${t.block}): ${metrics(t.block)}`);
console.log(`flagged at warn  (>= ${t.warn}): ${metrics(t.warn)}`);
