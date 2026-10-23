// Loads scanner rules from guard/rules.json (written by the red team; format in
// docs/rules-format.md). The file is re-read whenever it changes, so rules can
// be tuned without restarting the server. Invalid rules are skipped and listed
// in `problems` instead of crashing the scanner.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rulesFile = () => process.env.RULES_FILE || path.join(__dirname, 'rules.json');

export const CATEGORIES = ['override', 'role_hijack', 'prompt_probe', 'exfil', 'authority', 'secrets', 'hinglish', 'other'];
const DEFAULT_BONUSES = { hidden_text: 0, obfuscation: 0 };

let cache = { file: null, mtime: 0, value: null };

export function loadRules() {
  const file = rulesFile();
  let stat;
  try { stat = fs.statSync(file); } catch {
    return { rules: [], bonuses: DEFAULT_BONUSES, problems: [`rules file not found: ${file}`], file };
  }
  if (cache.file === file && cache.mtime === stat.mtimeMs) return cache.value;

  const value = { rules: [], bonuses: { ...DEFAULT_BONUSES }, problems: [], file };
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    value.problems.push(`rules file is not valid JSON: ${e.message}`);
    raw = {};
  }
  // A wrong top-level shape must be reported, not silently load nothing.
  if (!value.problems.length && (Array.isArray(raw) || !raw || typeof raw !== 'object' || !Array.isArray(raw.rules))) {
    value.problems.push(`wrong structure: expected { "version": 1, "bonuses": {...}, "rules": [ ... ] }, got ${Array.isArray(raw) ? 'a bare array' : 'an object without a "rules" array'}`);
    raw = {};
  }
  if (raw.bonuses !== undefined && (typeof raw.bonuses !== 'object' || raw.bonuses === null || Array.isArray(raw.bonuses))) {
    value.problems.push('"bonuses" must be an object like { "hidden_text": 25, "obfuscation": 15 }');
    raw = { ...raw, bonuses: {} };
  }

  for (const [k, v] of Object.entries(raw.bonuses || {})) {
    if (k in DEFAULT_BONUSES && Number.isFinite(v) && v >= 0 && v <= 100) value.bonuses[k] = v;
    else value.problems.push(`bonus "${k}" ignored (allowed: ${Object.keys(DEFAULT_BONUSES).join(', ')}; 0-100)`);
  }

  const seen = new Set();
  for (const [i, r] of (raw.rules || []).entries()) {
    const where = `rule #${i + 1}${r?.id ? ` (${r.id})` : ''}`;
    if (!r || typeof r.id !== 'string' || !/^[A-Z0-9-]+$/.test(r.id)) { value.problems.push(`${where}: id must be UPPERCASE letters/digits/dashes`); continue; }
    if (seen.has(r.id)) { value.problems.push(`${where}: duplicate id`); continue; }
    if (!CATEGORIES.includes(r.category)) { value.problems.push(`${where}: category must be one of ${CATEGORIES.join(', ')}`); continue; }
    if (!Number.isFinite(r.weight) || r.weight < 1 || r.weight > 100) { value.problems.push(`${where}: weight must be 1-100`); continue; }
    // In JSON "\b" is a backspace character, not a regex word boundary; it must be written "\\b".
    if (typeof r.pattern !== 'string' || /[\x00-\x1F]/.test(r.pattern)) {
      value.problems.push(`${where}: pattern contains a control character - in JSON write regex escapes with a double backslash, e.g. "\\\\b" not "\\b"`);
      continue;
    }
    let re;
    try { re = new RegExp(r.pattern, 'i'); } catch (e) { value.problems.push(`${where}: bad regex: ${e.message}`); continue; }
    seen.add(r.id);
    value.rules.push({ id: r.id, category: r.category, weight: r.weight, desc: r.desc || '', re });
  }

  if (value.problems.length) console.warn(`[rules] ${value.problems.length} problem(s) in ${file}:\n  ` + value.problems.join('\n  '));
  cache = { file, mtime: stat.mtimeMs, value };
  return value;
}
