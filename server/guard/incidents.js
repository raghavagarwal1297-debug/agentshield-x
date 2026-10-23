// Incident Log + Explainer. Every non-ALLOW decision (and every "would have
// blocked" decision in monitor mode) becomes an incident with a plain-language
// explanation built from templates, so it is instant and never depends on the LLM.
// Persisted to data/incidents.json (cleared by /api/reset).
import { readJSON, writeJSON } from '../store.js';
import { chat, judgeModel } from '../llm.js';

const FILE = 'incidents.json';

// Explanation templates, matched by rule id (first match wins).
const TEMPLATES = [
  { test: (id) => id === 'SCN-FAILCLOSED', title: 'Unverified suspicious content',
    protected: 'The content was not used, so nothing it asked for could happen.',
    fix: 'Check the LLM provider status; the guard blocks instead of guessing while the classifier is down.' },
  { test: (id) => id.startsWith('CANARY'), title: 'Canary token leak',
    protected: 'The output was stopped before leaving the system.',
    fix: 'Treat this as a confirmed leak attempt: find which input made the assistant expose the planted record.' },
  { test: (id) => id.startsWith('TAINT'), title: 'Sensitive session sending data out',
    protected: 'Nothing was sent outside the company.',
    fix: 'Review why a session that read confidential data tried to contact an outside address.' },
  { test: (id) => id.startsWith('DLP'), title: 'Data leak attempt',
    protected: 'The sensitive data did not leave the system.',
    fix: 'Check the recipient or link and the request that produced it.' },
  { test: (id) => id === 'FW-PERM', title: 'Unauthorised tool call',
    protected: 'The action did not run; no data was changed.',
    fix: 'If this user genuinely needs this action, update policy.json; otherwise review why it was requested.' },
  { test: (id) => id === 'FW-DOC', title: 'Restricted document access',
    protected: 'The document was not shown to the assistant.',
    fix: 'Share the document through an authorised colleague if the request is legitimate.' },
  { test: (id) => id === 'FW-SCOPE', title: 'Data outside the role scope',
    protected: 'Fields the role may not see were removed before the assistant received them.',
    fix: 'No action needed unless the role should have wider access (policy.json data scopes).' },
  { test: (id) => id === 'FW-EMAIL-INTERNAL', title: 'External email from an internal-only role',
    protected: 'No email was sent.',
    fix: 'Interns may only email @nimbusretail.in; route external mail through a manager.' },
  { test: (id) => id === 'FW-RATE', title: 'Unusual volume',
    protected: 'Access beyond the per-session limit was withheld.',
    fix: 'Confirm whether this bulk access was expected; repeated hits can indicate slow data extraction.' },
  { test: (id) => id === 'FW-INTENT', title: 'Action the user never asked for',
    protected: 'The action did not run.',
    fix: 'Check the documents and pages read in this request; one of them probably contains hidden instructions. Quarantine it and notify the sender.' },
  { test: (id) => id === 'FW-ESC', title: 'Privilege escalation attempt',
    protected: 'The real role from the server was used; the claim in the message changed nothing.',
    fix: 'Review the user\'s recent activity. Role claims in chat are never trusted.' },
  { test: (id) => id.startsWith('APR'), title: 'Sensitive action waiting for approval',
    protected: 'The action is on hold until a human approves or rejects it (auto-reject after 5 minutes).',
    fix: 'Approve only if the request is expected and the details are correct.' },
  // anything else is a scanner rule from rules.json
  { test: () => true, title: 'Prompt injection',
    protected: 'The suspicious text was not passed to the assistant as instructions.',
    fix: 'Quarantine the source document or page and notify whoever sent it.' },
];

function owaspTags(ruleIds, stage) {
  const tags = new Set();
  for (const id of ruleIds) {
    if (/^(DLP|CANARY|TAINT)/.test(id)) tags.add('LLM02');
    else if (/^(FW-PERM|FW-SCOPE|FW-DOC|FW-EMAIL|FW-RATE|FW-INTENT|APR)/.test(id)) tags.add('LLM06');
    else if (id === 'FW-ESC') { tags.add('LLM01'); tags.add('LLM06'); }
    else tags.add('LLM01'); // scanner rules + fail-closed
  }
  if (stage === 'document' || stage === 'input') tags.add('LLM01');
  return [...tags].sort();
}

const OWASP_NAMES = { LLM01: 'Prompt Injection', LLM02: 'Sensitive Information Disclosure', LLM06: 'Excessive Agency' };

function whereFrom(dec) {
  const s = dec.source || {};
  if (s.type === 'document' || s.type === 'web') {
    const hidden = (dec.hidden_spans || []).find((h) => !s.line || h.line === s.line);
    return `${s.type === 'web' ? 'Web page' : 'Document'} '${s.id}'${s.line ? `, line ${s.line}` : ''}` +
      (hidden ? ` (hidden ${hidden.how})` : '') + '.';
  }
  if (s.type === 'user_message') return 'The user\'s own message.';
  if (dec.attempted) return 'The assistant\'s own tool call, after reading the content in this request.';
  return 'The assistant\'s reply.';
}

function whatHappened(dec, ctx) {
  const who = `${ctx.user.id} (${ctx.user.role})`;
  if (dec.attempted) return `While helping ${who}, the assistant tried to call ${dec.attempted.tool} with ${JSON.stringify(dec.attempted.args).slice(0, 160)}.`;
  if (dec.stage === 'input') return `A message from ${who} looked like an attempt to manipulate the assistant.`;
  if (dec.stage === 'document') return `A document attached by ${who} contained text that tries to give the assistant instructions.`;
  if (dec.stage === 'tool') return `Content returned to the assistant while helping ${who} contained something the guard had to act on.`;
  return `The assistant's answer to ${who} contained protected data.`;
}

export function explain(dec, ctx) {
  const ids = dec.rule_ids || [];
  const t = TEMPLATES.find((tpl) => ids.some((id) => tpl.test(id))) || TEMPLATES[TEMPLATES.length - 1];
  const verb = dec.would_block ? 'WOULD HAVE BEEN ' + (dec.original_outcome || 'BLOCKED') : dec.outcome;
  const owasp = owaspTags(ids, dec.stage);
  const sections = {
    headline: `${verb} - ${t.title} (rule ${ids.join(', ') || 'n/a'}, risk ${dec.risk ?? 0}/100)`,
    what_happened: whatHappened(dec, ctx),
    why: dec.explanation,
    where_it_came_from: whereFrom(dec),
    what_was_protected: dec.would_block
      ? 'Nothing - monitor mode only records what enforce mode would have done.'
      : dec.removed_lines?.length
        ? `Line(s) ${dec.removed_lines.map((l) => l.line).join(', ')} were removed; the rest of the document was still used so the task could continue.`
        : t.protected,
    suggested_fix: t.fix,
    category: owasp.map((o) => `OWASP ${o} ${OWASP_NAMES[o]}`).join(' -> '),
  };
  return { sections, owasp };
}

// Turns a decision into a stored incident. ctx = { user, session, request_id, mode }
export function createIncident(dec, ctx) {
  const all = readJSON(FILE);
  const next = all.reduce((m, i) => Math.max(m, Number(i.id.slice(4)) || 0), 0) + 1;
  const { sections, owasp } = explain(dec, ctx);
  const src = dec.source || {};
  const incident = {
    id: `INC-${String(next).padStart(4, '0')}`,
    ts: new Date().toISOString(),
    request_id: ctx.request_id || null,
    session: ctx.session?.id || null,
    user: ctx.user.id,
    role: ctx.user.role,
    mode: ctx.mode,
    stage: dec.stage,
    layer: dec.layer,
    outcome: dec.outcome,
    would_block: !!dec.would_block,
    rule_ids: dec.rule_ids || [],
    risk: dec.risk ?? 0,
    source: { type: src.type || null, id: src.id || null, line: src.line || null, excerpt: (src.excerpt || '').slice(0, 300) },
    removed_lines: dec.removed_lines || [],
    hidden_spans: dec.hidden_spans || [],
    attempted: dec.attempted || null,
    approval_id: dec.pending_approval_id || null,
    explanation: [
      sections.headline,
      `What happened : ${sections.what_happened}`,
      `Why           : ${sections.why}`,
      `Where it came : ${sections.where_it_came_from}`,
      `What was safe : ${sections.what_was_protected}`,
      `Suggested fix : ${sections.suggested_fix}`,
      `Category      : ${sections.category}`,
    ].join('\n'),
    explanation_sections: sections,
    owasp,
  };
  all.push(incident);
  writeJSON(FILE, all);
  return incident;
}

export function listIncidents({ limit = 100 } = {}) {
  return readJSON(FILE).slice(-limit).reverse(); // newest first
}

export function getIncident(id) {
  return readJSON(FILE).find((i) => i.id === id) || null;
}

// Manager-friendly report via the judge model; falls back to the template text.
export async function writeReport(id) {
  const all = readJSON(FILE);
  const inc = all.find((i) => i.id === id);
  if (!inc) return null;
  let report, generated_by = 'llm';
  try {
    const res = await chat({
      model: judgeModel(),
      messages: [
        { role: 'system', content: 'You write short security incident reports for non-technical managers at Nimbus Retail. Plain English, no jargon, under 150 words, with these headings: Summary, Impact, What we did, Recommended next step.' },
        { role: 'user', content: `Write the report for this incident record:\n${JSON.stringify({ ...inc, explanation_sections: undefined }, null, 2)}` },
      ],
    });
    report = res.content?.trim();
    if (!report) throw new Error('empty report');
  } catch (e) {
    generated_by = 'template';
    report = `${inc.explanation}\n\n(The LLM report could not be generated: ${e.message})`;
  }
  inc.report = { text: report, generated_by, ts: new Date().toISOString() };
  writeJSON(FILE, all);
  return inc.report;
}
