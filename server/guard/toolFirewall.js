// Tool Firewall: decides whether a proposed tool call may run, using only
// server-side facts (user role from users.json, policy.json, session counters).
//
// checkToolCall order:
//   1. role permission          FW-PERM
//   2. data / document scope    FW-SCOPE, FW-DOC
//   3. intern internal email    FW-EMAIL-INTERNAL
//   4. per-session rate limits  FW-RATE
//   5. rule-based intent check  FW-INTENT   (v2: keyword map, no LLM call)
//   6. approval rules           NEEDS_APPROVAL (APR-*)
// The escalation detector (FW-ESC) flags role claims in the message text;
// they never change the role.
import { readJSON } from '../store.js';
import { isAllowedEmail, emailDomain } from './addresses.js';
import { createApproval } from './approvals.js';

const policy = () => readJSON('policy.json');
const HIGH_RISK_TOOLS = ['send_email', 'issue_refund', 'delete_record', 'export_data'];

const decision = (outcome, extra = {}) => ({
  stage: 'tool', layer: 'firewall', outcome, rule_ids: [], risk: 0, explanation: '', would_block: false, ...extra,
});

// ---------- helpers ----------

export function roleConfig(role) {
  return policy().roles?.[role] || { tools: [], data: {} };
}

// Fields of a record type the role may see: ['*'] = all, [] = none.
export function allowedFields(role, type) {
  const cfg = roleConfig(role);
  if (cfg.data?.[type]) return cfg.data[type];
  return cfg.tools?.includes('*') ? ['*'] : [];
}

const rank = (cls) => {
  const order = policy().classification_order || ['public', 'external', 'internal', 'confidential', 'critical'];
  const i = order.indexOf(cls);
  return i === -1 ? order.length : i; // unknown classification = most restrictive
};

// Can this role read the document? Returns null if yes, else a reason string.
export function documentDenied(role, docId) {
  const max = roleConfig(role).docs_max_classification;
  if (!max) return null;
  const cls = policy().document_classification?.[docId] || 'unclassified';
  return rank(cls) > rank(max)
    ? `${docId} is classified "${cls}" but the ${role} role may only read up to "${max}"`
    : null;
}

// v2 section 4.3: what the user's own words ask for -> tools that fit that intent.
const INTENTS = [
  { name: 'email', re: /\b(e-?mail|mail|send|bhej\w*|forward)\b/i, tools: ['send_email'] },
  { name: 'refund', re: /\b(refund\w*|wapas|money\s+back)\b/i, tools: ['issue_refund'] },
  { name: 'delete', re: /\b(delete|remove|hata\s*do|hatao)\b/i, tools: ['delete_record'] },
  { name: 'export', re: /\b(export|download|csv)\b/i, tools: ['export_data'] },
];

export function intendedTools(message = '') {
  return [...new Set(INTENTS.filter((i) => i.re.test(message)).flatMap((i) => i.tools))];
}

// Messages that claim a different role. Logged as escalation attempts (A8).
const ESCALATION = [
  /\bi\s*(?:am|'m)\s+(?:now\s+)?(?:an?\s+|the\s+)?(?:admin|administrator|superuser|root)\b/i,
  /\bmy\s+role\s+(?:is|was|has\s+been)\s+(?:now\s+)?(?:changed|updated|upgraded|set|admin)/i,
  /\b(?:grant|give)\s+me\s+(?:admin|full|root)\s+(?:access|rights|permissions?)\b/i,
  /\bmain\s+(?:ab\s+)?admin\s+(?:hoon|hu|hun)\b/i,
];
export const claimsEscalation = (message = '') => ESCALATION.some((re) => re.test(message));

function evalCondition(when, args) {
  if (!when) return true;
  const m = String(when).match(/^\s*(\w+)\s*(>=|<=|>|<|==)\s*([\d.]+)\s*$/);
  if (!m) return true; // unknown condition: be safe, require approval
  const v = Number(args?.[m[1]]);
  const n = Number(m[3]);
  return { '>': v > n, '>=': v >= n, '<': v < n, '<=': v <= n, '==': v === n }[m[2]];
}

// ---------- the check ----------

export function checkToolCall({ user, tool, args = {}, session, originalRequest = '' }) {
  const cfg = roleConfig(user.role);
  const esc = claimsEscalation(originalRequest);
  const escNote = esc ? ` The message claimed a different role; roles come only from the server (${user.role}), so the claim was ignored.` : '';
  const withEsc = (d) => (esc ? { ...d, rule_ids: [...d.rule_ids, 'FW-ESC'], escalation_attempt: true } : d);
  const block = (rule, risk, why) => withEsc(decision('BLOCK', { rule_ids: [rule], risk, explanation: why + escNote }));

  // 1. role permission
  const tools = cfg.tools || [];
  if (!tools.includes('*') && !tools.includes(tool)) {
    return block('FW-PERM', 90, `The ${user.role} role is not allowed to use ${tool}.`);
  }

  // 2. scope
  if (['search_records', 'delete_record', 'export_data'].includes(tool)) {
    const fields = allowedFields(user.role, args.type);
    if (!fields.length) return block('FW-SCOPE', 80, `The ${user.role} role has no access to ${args.type || 'that'} records.`);
  }
  if (tool === 'read_document') {
    const denied = documentDenied(user.role, args.doc_id);
    if (denied) return block('FW-DOC', 85, `Document access denied: ${denied}.`);
  }

  // 3. interns may only email inside the company (v2 fix #7)
  if (tool === 'send_email' && cfg.email_internal_only) {
    const allowed = policy().egress?.email_domains_allowed || [];
    if (!isAllowedEmail(args.to, allowed)) {
      return block('FW-EMAIL-INTERNAL', 85,
        `The ${user.role} role may only email ${allowed.map((d) => '@' + d).join(', ')} addresses; "${args.to}" is outside.`);
    }
  }

  // 4. rate limits
  const limits = cfg.limits || {};
  session.counters ||= {};
  if (tool === 'send_email' && limits.emails_per_session != null) {
    if ((session.counters.emails || 0) >= limits.emails_per_session) {
      return block('FW-RATE', 60, `Email limit reached: ${limits.emails_per_session} emails per session for the ${user.role} role.`);
    }
  }
  if (tool === 'search_records' && args.type === 'employees' && limits.employee_records_per_session != null) {
    if ((session.counters.employee_records || 0) >= limits.employee_records_per_session) {
      return block('FW-RATE', 60,
        `Employee record limit reached: ${limits.employee_records_per_session} per session for the ${user.role} role. Unusual bulk access is flagged as an anomaly.`);
    }
  }

  // 5. intent alignment (rule-based): high-risk tools need a matching request
  if (HIGH_RISK_TOOLS.includes(tool)) {
    const wanted = intendedTools(originalRequest);
    if (!wanted.includes(tool)) {
      return block('FW-INTENT', 80,
        `The user did not ask for this action. Their request ("${originalRequest.slice(0, 80)}") ` +
        `does not mention ${tool.replace('_', ' ')}, so the assistant may have been manipulated.`);
    }
    if (tool === 'send_email') {
      const allowed = policy().egress?.email_domains_allowed || [];
      const internal = isAllowedEmail(args.to, allowed);
      const to = String(args.to || '').toLowerCase().trim();
      const givenByUser = !!to && originalRequest.toLowerCase().includes(to);
      if (!internal && !givenByUser) {
        return block('FW-INTENT', 80,
          `The assistant chose the external recipient "${args.to}" (${emailDomain(args.to) || 'invalid address'}) that the user never gave.`);
      }
    }
  }

  // count the email now that it is allowed to proceed
  if (tool === 'send_email') session.counters.emails = (session.counters.emails || 0) + 1;

  // 6. approval rules
  const rule = (policy().approval_required || []).find((r) => r.tool === tool && evalCondition(r.when, args));
  if (rule) {
    const risk = tool === 'issue_refund' ? 60 : 75;
    const reason = rule.when
      ? `${tool} with ${rule.when.replace(/\s+/g, ' ')} needs human approval (requested: ${JSON.stringify(args)}).`
      : `${tool} always needs human approval (requested: ${JSON.stringify(args)}).`;
    const approval = createApproval({ tool, args, user, session, risk, reason, rule_ids: ['APR-' + tool.toUpperCase()] });
    return withEsc(decision('NEEDS_APPROVAL', {
      rule_ids: ['APR-' + tool.toUpperCase()], risk, explanation: reason + ' Paused until a human approves or rejects.' + escNote,
      pending_approval_id: approval.id, approval,
    }));
  }

  return withEsc(decision('ALLOW', {
    risk: esc ? 40 : 0,
    explanation: (esc ? 'Allowed under the real role.' : `${tool} is allowed for the ${user.role} role.`) + escNote,
  }));
}

// Data scope on tool OUTPUT: interns never even receive salary fields.
// Also counts employee records toward the per-session limit.
export function filterToolOutput({ user, tool, args = {}, output, session }) {
  if (tool !== 'search_records' || !Array.isArray(output?.records)) return null;
  const fields = allowedFields(user.role, args.type);
  let records = output.records;
  let removedFields = [];
  if (!fields.includes('*')) {
    const keep = new Set(fields);
    removedFields = [...new Set(records.flatMap((r) => Object.keys(r)).filter((k) => !keep.has(k)))];
    records = records.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => keep.has(k))));
  }

  let truncated = 0;
  const limit = roleConfig(user.role).limits?.employee_records_per_session;
  if (args.type === 'employees' && limit != null) {
    const used = session.counters.employee_records || 0;
    const room = Math.max(0, limit - used);
    if (records.length > room) { truncated = records.length - room; records = records.slice(0, room); }
    session.counters.employee_records = used + records.length;
  }

  const filtered = { ...output, count: records.length, records };
  if (!removedFields.length && !truncated) {
    return decision('ALLOW', { explanation: 'All returned fields are within the role scope.', output: filtered });
  }
  const parts = [];
  if (removedFields.length) parts.push(`hid fields not allowed for the ${user.role} role: ${removedFields.join(', ')}`);
  if (truncated) parts.push(`withheld ${truncated} record(s) over the per-session limit of ${limit}`);
  return decision('REDACT', {
    rule_ids: [...(removedFields.length ? ['FW-SCOPE'] : []), ...(truncated ? ['FW-RATE'] : [])],
    risk: truncated ? 50 : 20,
    explanation: `AgentShield ${parts.join(' and ')}.`,
    output: filtered,
  });
}
