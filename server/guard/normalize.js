// Text normaliser for the input scanner. Attackers hide instructions with
// invisible characters, encodings, spacing tricks and hidden HTML; this
// produces one lowercase "matchText" that rules can run against.
//
// normalize(text) -> {
//   matchText,        lowercase text: visible + hidden + decoded content
//   hidden_spans,     [{ line, text, how }]  hidden HTML/comment content
//   obfuscated,       true if invisible chars, base64 or spaced letters were found
//   notes,            human-readable list of what was undone
// }

// zero-width, bidi controls, word joiners, BOM, soft hyphen
const INVISIBLE = /[​-‏‪-‮⁠-⁤⁦-⁩﻿­]/g;

// Inline styles / attributes that make text invisible to a human reader.
const HIDDEN_STYLE = [
  [/color\s*:\s*(white|#fff\b|#ffffff\b|rgba?\(\s*255\s*,\s*255\s*,\s*255)/i, 'white text'],
  [/font-size\s*:\s*(0|0?\.\d+|1)(px|pt|em|rem)?\s*(;|$|")/i, 'tiny font'],
  [/display\s*:\s*none/i, 'display:none'],
  [/visibility\s*:\s*hidden/i, 'visibility:hidden'],
  [/opacity\s*:\s*0(\.0+)?\s*(;|$|")/i, 'opacity:0'],
];

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

// Finds hidden HTML elements and comments. Returns spans with 1-based line numbers.
export function findHiddenSpans(text) {
  const spans = [];
  const el = /<(\w+)([^>]*)>([\s\S]*?)<\/\1>/g;
  let m;
  while ((m = el.exec(text))) {
    const attrs = m[2];
    const hit = /(^|\s)hidden(\s|=|$)/i.test(attrs)
      ? 'hidden attribute'
      : HIDDEN_STYLE.find(([re]) => re.test(attrs))?.[1];
    if (hit) spans.push({ line: lineOf(text, m.index), text: stripTags(m[3]).trim(), how: hit });
  }
  const comment = /<!--([\s\S]*?)-->/g;
  while ((m = comment.exec(text))) {
    spans.push({ line: lineOf(text, m.index), text: m[1].trim(), how: 'html comment' });
  }
  return spans.filter((s) => s.text);
}

export const stripTags = (s) => s.replace(/<[^>]*>/g, ' ');

// Decodes base64-looking chunks (> 20 chars) that turn into readable text.
function decodeBase64Chunks(text) {
  const decoded = [];
  for (const chunk of text.match(/[A-Za-z0-9+/]{20,}={0,2}/g) || []) {
    try {
      const out = Buffer.from(chunk, 'base64').toString('utf8');
      const printable = out.replace(/[^\x20-\x7E\n]/g, '').length / Math.max(out.length, 1);
      if (printable > 0.9 && /[a-z]{3,}\s+[a-z]{2,}/i.test(out)) decoded.push(out);
    } catch { /* not base64 */ }
  }
  return decoded;
}

// "i g n o r e" / "i.g.n.o.r.e" -> "ignore" (4+ single letters with one separator each)
function collapseSpacedLetters(text) {
  return text.replace(/\b(?:[a-z][\s.\-_*]){3,}[a-z]\b/gi, (s) => s.replace(/[\s.\-_*]/g, ''));
}

export function normalize(input = '') {
  const notes = [];
  let text = String(input).normalize('NFKC'); // fullwidth / stylised letters -> plain

  if (INVISIBLE.test(text)) notes.push('removed invisible characters');
  text = text.replace(INVISIBLE, '');

  const hidden_spans = findHiddenSpans(text);
  if (hidden_spans.length) notes.push(`found ${hidden_spans.length} hidden HTML span(s)`);

  // tags removed so hidden element text is matched like normal text
  let visible = stripTags(text);

  const collapsed = collapseSpacedLetters(visible);
  if (collapsed !== visible) notes.push('joined spaced-out letters');
  visible = collapsed;

  const decoded = decodeBase64Chunks(text);
  if (decoded.length) notes.push(`decoded ${decoded.length} base64 chunk(s)`);

  const matchText = [visible, ...decoded].join('\n').replace(/[ \t]+/g, ' ').toLowerCase();
  const obfuscated = notes.some((n) => /invisible|spaced|base64/.test(n));
  return { matchText, hidden_spans, obfuscated, notes };
}
