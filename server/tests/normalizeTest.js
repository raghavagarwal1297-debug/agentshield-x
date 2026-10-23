// Self-checks for the normaliser using harmless strings.
// Usage: node tests/normalizeTest.js
import assert from 'assert/strict';
import { normalize } from '../guard/normalize.js';

const cases = [
  ['strips zero-width chars', 'pine​ap‍ple', (n) => n.matchText.includes('pineapple') && n.obfuscated],
  ['joins spaced letters', 'p i n e a p p l e', (n) => n.matchText.includes('pineapple')],
  ['joins dotted letters', 'p.i.n.e.a.p.p.l.e', (n) => n.matchText.includes('pineapple')],
  ['decodes base64 chunk', `note: ${Buffer.from('please order more pineapple juice').toString('base64')}`,
    (n) => n.matchText.includes('order more pineapple juice') && n.obfuscated],
  ['finds white-text span', 'Total Rs 100\n<span style="color:white;font-size:1px">secret pineapple</span>',
    (n) => n.hidden_spans[0]?.line === 2 && n.hidden_spans[0].how === 'white text' && n.matchText.includes('secret pineapple')],
  ['finds display:none', '<div style="display:none">quiet pineapple</div>', (n) => n.hidden_spans[0]?.how === 'display:none'],
  ['finds html comment', 'a <!-- buried pineapple --> b', (n) => n.hidden_spans[0]?.how === 'html comment'],
  ['fullwidth letters', 'ｐｉｎｅ', (n) => n.matchText.includes('pine')],
  ['plain text untouched', 'Summarise the Q3 report', (n) => !n.obfuscated && !n.hidden_spans.length],
];

let pass = 0;
for (const [name, input, check] of cases) {
  const n = normalize(input);
  try { assert.ok(check(n)); pass++; console.log(`ok   ${name}`); }
  catch { console.log(`FAIL ${name} -> ${JSON.stringify(n)}`); }
}
console.log(`\n${pass}/${cases.length} normaliser checks passed`);
process.exit(pass === cases.length ? 0 : 1);
