// Guard pipeline. The agent calls these hooks; each returns a decision
// { stage, outcome, rule_ids, risk, explanation, layer, would_block, ... }.
// Prompt 3: scanner hooks. Prompt 4: tool firewall + approvals.
// Egress, monitor mode and per-layer toggles arrive in Prompts 5-6.
import { noopGuard } from './noopGuard.js';
import { scan, level, lineHits, sanitize } from './inputScanner.js';
import * as firewall from './toolFirewall.js';

const decision = (stage, layer, outcome, extra = {}) => ({
  stage, layer, outcome, rule_ids: [], risk: 0, explanation: '', would_block: false, ...extra,
});

// Scans a document-like text and removes only the injected lines.
// Returns { decision, content } where content is null if the whole text must be dropped.
async function scanDocument({ text, stage, source, session }) {
  const s = await scan(text, { source: source.type });
  const lvl = level(s.risk);
  const base = { risk: s.risk, rule_ids: s.matches, hidden_spans: s.hidden_spans, scan: s.reason };

  if (lvl === 'allow') {
    return { decision: decision(stage, 'scanner', 'ALLOW', { ...base, source, explanation: 'No injection detected.' }), content: text };
  }
  if (lvl === 'warn') {
    session.suspicious = true;
    return {
      decision: decision(stage, 'scanner', 'ALLOW', { ...base, source, warning: true,
        explanation: `Possible injection in ${source.id} (risk ${s.risk}/100). Allowed, session marked suspicious. ${s.reason}` }),
      content: text,
    };
  }

  // BLOCK level
  if (s.failed_closed) {
    return {
      decision: decision(stage, 'scanner', 'BLOCK', { ...base, rule_ids: ['SCN-FAILCLOSED'], source,
        explanation: `${source.id} was withheld: ${s.reason}` }),
      content: null,
    };
  }
  const hits = lineHits(text, s.matches);
  if (!hits.length) {
    // could not localise the injection to specific lines -> drop the whole text
    return {
      decision: decision(stage, 'scanner', 'BLOCK', { ...base, source,
        explanation: `Prompt injection detected in ${source.id} (risk ${s.risk}/100); the content was withheld from the assistant. ${s.reason}` }),
      content: null,
    };
  }
  const first = hits[0];
  return {
    decision: decision(stage, 'scanner', 'BLOCK', {
      ...base,
      source: { ...source, line: first.line, excerpt: first.excerpt },
      removed_lines: hits,
      explanation: `Prompt injection detected in ${source.id} (risk ${s.risk}/100). Removed line(s) ` +
        `${hits.map((h) => h.line).join(', ')}; the rest of the document was passed on so the task can continue. ${s.reason}`,
    }),
    content: sanitize(text, hits),
  };
}

const enforceGuard = {
  mode: 'enforce',

  async checkInput({ message, session }) {
    const s = await scan(message, { source: 'user message' });
    const lvl = level(s.risk);
    const base = { risk: s.risk, rule_ids: s.matches, source: { type: 'user_message' }, scan: s.reason };
    if (lvl === 'block') {
      return decision('input', 'scanner', 'BLOCK', { ...base,
        rule_ids: s.failed_closed ? ['SCN-FAILCLOSED'] : s.matches,
        explanation: s.failed_closed ? s.reason
          : `The message looks like a prompt-injection attempt (risk ${s.risk}/100), so it was not sent to the assistant. ${s.reason}` });
    }
    if (lvl === 'warn') {
      session.suspicious = true;
      return decision('input', 'scanner', 'ALLOW', { ...base, warning: true,
        explanation: `Message allowed with a warning (risk ${s.risk}/100); session marked suspicious. ${s.reason}` });
    }
    return decision('input', 'scanner', 'ALLOW', { ...base, explanation: 'No injection detected.' });
  },

  async checkDocument({ user, doc_id, content, session }) {
    // Attached documents obey the same classification limits as read_document.
    const denied = firewall.documentDenied(user.role, doc_id);
    if (denied) {
      return decision('document', 'firewall', 'BLOCK', { rule_ids: ['FW-DOC'], risk: 85,
        source: { type: 'document', id: doc_id },
        explanation: `Document access denied: ${denied}. It was not given to the assistant.`, content: null });
    }
    const r = await scanDocument({ text: content, stage: 'document', source: { type: 'document', id: doc_id }, session });
    return { ...r.decision, content: r.content };
  },

  async checkToolCall(ctx) {
    return firewall.checkToolCall(ctx);
  },

  // search_records output is filtered to the role's field scope (firewall);
  // fetched pages and read documents can carry injections, so they are scanned.
  async checkToolOutput({ user, tool, args, output, session }) {
    const scoped = firewall.filterToolOutput({ user, tool, args, output, session });
    if (scoped) return scoped;
    if (!output || typeof output.content !== 'string') {
      return decision('tool', 'scanner', 'ALLOW', { explanation: 'Tool output has no free text to scan.', output });
    }
    const source = tool === 'fetch_url'
      ? { type: 'web', id: output.url }
      : { type: 'document', id: output.doc_id || tool };
    const r = await scanDocument({ text: output.content, stage: 'tool', source, session });
    const safe = r.content == null
      ? { ...output, content: undefined, error: 'Content withheld by AgentShield (prompt injection detected).' }
      : { ...output, content: r.content };
    return { ...r.decision, output: safe };
  },

  // Not implemented yet (Prompt 5): allow.
  checkEgress: noopGuard.checkEgress,
};

// Global guard switch. Prompt 6 adds monitor mode and per-layer toggles.
let mode = process.env.GUARD_MODE === 'off' ? 'off' : 'enforce';

export const guard = new Proxy({}, {
  get: (_, prop) => (mode === 'off' ? noopGuard : enforceGuard)[prop],
});

export function getGuardState() {
  return { mode, layers: { scanner: true, firewall: true, approval: true, egress: true } };
}

export function setGuardMode(next) {
  if (!['off', 'enforce'].includes(next)) throw new Error('mode must be "off" or "enforce" (monitor arrives in Prompt 6)');
  mode = next;
  return getGuardState();
}
