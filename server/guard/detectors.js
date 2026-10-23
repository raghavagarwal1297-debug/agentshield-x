// Loads extra DLP detector patterns from guard/detectors.json (written by the
// red team; format in docs/detectors-format.md). Re-read when the file changes.
// Invalid entries are skipped and listed in `problems`.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const detectorsFile = () => process.env.DETECTORS_FILE || path.join(__dirname, 'detectors.json');

export const KINDS = ['phone', 'email', 'pan', 'aadhaar', 'salary', 'secret', 'other'];
const SENSITIVITY = ['high', 'critical'];

let cache = { file: null, mtime: 0, value: null };

export function loadDetectors() {
  const file = detectorsFile();
  let stat;
  try { stat = fs.statSync(file); } catch {
    return { detectors: [], problems: [`detectors file not found: ${file}`], file };
  }
  if (cache.file === file && cache.mtime === stat.mtimeMs) return cache.value;

  const value = { detectors: [], problems: [], file };
  let raw = {};
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {
    value.problems.push(`detectors file is not valid JSON: ${e.message}`);
  }
  const seen = new Set();
  for (const [i, d] of (raw.detectors || []).entries()) {
    const where = `detector #${i + 1}${d?.id ? ` (${d.id})` : ''}`;
    if (!d || typeof d.id !== 'string' || !/^[A-Z0-9-]+$/.test(d.id)) { value.problems.push(`${where}: id must be UPPERCASE letters/digits/dashes`); continue; }
    if (seen.has(d.id)) { value.problems.push(`${where}: duplicate id`); continue; }
    if (!KINDS.includes(d.kind)) { value.problems.push(`${where}: kind must be one of ${KINDS.join(', ')}`); continue; }
    if (!SENSITIVITY.includes(d.sensitivity)) { value.problems.push(`${where}: sensitivity must be "high" or "critical"`); continue; }
    if (typeof d.pattern !== 'string' || /[\x00-\x1F]/.test(d.pattern)) {
      value.problems.push(`${where}: pattern contains a control character - in JSON write regex escapes with a double backslash, e.g. "\\\\b" not "\\b"`);
      continue;
    }
    let re;
    try { re = new RegExp(d.pattern, 'g' + (d.case_sensitive ? '' : 'i')); } catch (e) { value.problems.push(`${where}: bad regex: ${e.message}`); continue; }
    seen.add(d.id);
    value.detectors.push({ id: d.id, kind: d.kind, sensitivity: d.sensitivity, label: d.label || d.kind, re });
  }
  if (value.problems.length) console.warn(`[detectors] ${value.problems.length} problem(s) in ${file}:\n  ` + value.problems.join('\n  '));
  cache = { file, mtime: stat.mtimeMs, value };
  return value;
}

// All detector hits in a text: [{ id, kind, sensitivity, label, start, end, match }]
export function runDetectors(text = '') {
  const hits = [];
  for (const d of loadDetectors().detectors) {
    d.re.lastIndex = 0;
    let m;
    while ((m = d.re.exec(text))) {
      if (!m[0]) { d.re.lastIndex++; continue; }
      hits.push({ id: d.id, kind: d.kind, sensitivity: d.sensitivity, label: d.label, start: m.index, end: m.index + m[0].length, match: m[0] });
    }
  }
  return hits;
}
