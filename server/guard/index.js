// Guard pipeline. The agent calls these hooks; each returns a decision
// { stage, outcome, rule_ids, risk, explanation, layer, would_block, ... }
// plus, for some hooks, the (possibly sanitised) payload: content / output / text.
//
// Modes (v2 4.4):
//   off      - no checks; a grey "unguarded" decision event is still emitted
//   monitor  - all checks run and are logged with would_block, nothing is stopped
//   enforce  - full guard
// Layers scanner | firewall | approval | egress can each be switched off.
// Every decision is published on the event bus; every non-ALLOW (or
// would-block) decision becomes an incident.
import { noopGuard } from './noopGuard.js';
import { scan, level, lineHits, sanitize } from './inputScanner.js';
import * as firewall from './toolFirewall.js';
import { createIncident } from './incidents.js';
import { bus } from './events.js';

const MODES = ['off', 'monitor', 'enforce'];
const LAYERS = ['scanner', 'firewall', 'approval', 'egress'];
const STOPPING = ['BLOCK', 'REDACT', 'NEEDS_APPROVAL'];

const state = {
  mode: MODES.includes(process.env.GUARD_MODE) ? process.env.GUARD_MODE : 'enforce',
  layers: { scanner: true, firewall: true, approval: true, egress: true },
};
const on = (layer) => state.layers[layer] !== false;

const decision = (stage, layer, outcome, extra = {}) => ({
  stage, layer, outcome, rule_ids: [], risk: 0, explanation: '', would_block: false, ...extra,
});
const layerOff = (stage, layer, extra = {}) =>
  decision(stage, layer, 'ALLOW', { layer_off: true, explanation: `The ${layer} layer is switched off.`, ...extra });

// ---------- scanner helpers ----------

// Scans a document-like text and removes only the injected lines (v2 fix #11).
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
  if (s.failed_closed) {
    return {
      decision: decision(stage, 'scanner', 'BLOCK', { ...base, rule_ids: ['SCN-FAILCLOSED'], source,
        explanation: `${source.id} was withheld: ${s.reason}` }),
      content: null,
    };
  }
  const hits = lineHits(text, s.matches);
  if (!hits.length) {
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

// ---------- the checks (enforce semantics; monitor is applied on top) ----------

const checks = {
  async checkInput({ message, session }) {
    if (!on('scanner')) return layerOff('input', 'scanner');
    const s = await scan(message, { source: 'user message' });
    const lvl = level(s.risk);
    const base = { risk: s.risk, rule_ids: s.matches, source: { type: 'user_message', excerpt: message.slice(0, 300) }, scan: s.reason };
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
    const source = { type: 'document', id: doc_id };
    // Attached documents obey the same classification limits as read_document.
    if (on('firewall')) {
      const denied = firewall.documentDenied(user.role, doc_id);
      if (denied) {
        return decision('document', 'firewall', 'BLOCK', { rule_ids: ['FW-DOC'], risk: 85, source,
          explanation: `Document access denied: ${denied}. It was not given to the assistant.`, content: null });
      }
    }
    if (!on('scanner')) return layerOff('document', 'scanner', { source, content });
    const r = await scanDocument({ text: content, stage: 'document', source, session });
    return { ...r.decision, content: r.content };
  },

  async checkToolCall(ctx) {
    if (!on('firewall') && !on('approval')) return layerOff('tool', 'firewall');
    return firewall.checkToolCall(ctx, { firewall: on('firewall'), approval: on('approval'), dryRun: state.mode === 'monitor' });
  },

  // search_records output is filtered to the role's field scope (firewall);
  // fetched pages and read documents can carry injections, so they are scanned.
  async checkToolOutput({ user, tool, args, output, session }) {
    if (on('firewall')) {
      const scoped = firewall.filterToolOutput({ user, tool, args, output, session });
      if (scoped) return scoped;
    }
    if (!output || typeof output.content !== 'string') {
      return decision('tool', 'scanner', 'ALLOW', { explanation: 'Tool output has no free text to scan.', output });
    }
    if (!on('scanner')) return layerOff('tool', 'scanner', { output });
    const source = tool === 'fetch_url'
      ? { type: 'web', id: output.url }
      : { type: 'document', id: output.doc_id || tool };
    const r = await scanDocument({ text: output.content, stage: 'tool', source, session });
    const safe = r.content == null
      ? { ...output, content: undefined, error: 'Content withheld by AgentShield (prompt injection detected).' }
      : { ...output, content: r.content };
    return { ...r.decision, output: safe };
  },

  // Egress / DLP (Prompt 5) is not implemented yet: allow, and say so.
  async checkEgress({ kind, text }) {
    if (!on('egress')) return layerOff(kind === 'reply' ? 'output' : 'egress', 'egress', { text });
    return decision(kind === 'reply' ? 'output' : 'egress', 'egress', 'ALLOW', {
      explanation: 'Egress/DLP checks are not implemented yet.', not_implemented: true, text,
    });
  },
};

// ---------- mode handling + publishing ----------

// Payload fields never go on the event bus.
const publicView = ({ content, output, text, approval, ...d }) => d;

function publish(d, args) {
  const ctx = { user: args.user, session: args.session, request_id: args.request_id, mode: state.mode };
  if (STOPPING.includes(d.outcome) || d.would_block) {
    const incident = createIncident(d, ctx);
    d.incident_id = incident.id;
    bus.emit('incident', incident);
  }
  bus.emit('decision', {
    ...publicView(d), request_id: args.request_id || null, user: args.user?.id, role: args.user?.role,
    mode: state.mode, ts: new Date().toISOString(),
  });
}

async function runHook(name, args) {
  let d;
  if (state.mode === 'off') {
    d = { ...(await noopGuard[name](args)), unguarded: true };
  } else {
    d = await checks[name](args);
    if (state.mode === 'monitor' && STOPPING.includes(d.outcome)) {
      // record what enforce mode would do, but let everything through unchanged
      d = {
        ...d, original_outcome: d.outcome, outcome: 'ALLOW', would_block: true,
        explanation: `Monitor mode - enforce would have returned ${d.outcome}: ${d.explanation}`,
        content: args.content, output: args.output, text: args.text,
        approval: undefined, pending_approval_id: undefined,
      };
    }
  }
  if (args.tool && !d.attempted) d.attempted = { tool: args.tool, args: args.args };
  publish(d, args);
  return d;
}

export const guard = {
  get mode() { return state.mode; },
  checkInput: (a) => runHook('checkInput', a),
  checkDocument: (a) => runHook('checkDocument', a),
  checkToolCall: (a) => runHook('checkToolCall', a),
  checkToolOutput: (a) => runHook('checkToolOutput', a),
  checkEgress: (a) => runHook('checkEgress', a),
};

export function getGuardState() {
  return { mode: state.mode, layers: { ...state.layers } };
}

// Accepts a partial update: { mode?, layers?: { scanner?, firewall?, approval?, egress? } }
export function setGuardState({ mode, layers } = {}) {
  if (mode !== undefined && !MODES.includes(mode)) throw new Error(`mode must be one of ${MODES.join(', ')}`);
  if (layers !== undefined) {
    if (typeof layers !== 'object' || layers === null) throw new Error('layers must be an object');
    for (const [k, v] of Object.entries(layers)) {
      if (!LAYERS.includes(k)) throw new Error(`unknown layer "${k}" (layers: ${LAYERS.join(', ')})`);
      if (typeof v !== 'boolean') throw new Error(`layer "${k}" must be true or false`);
    }
  }
  if (mode !== undefined) state.mode = mode;
  if (layers) Object.assign(state.layers, layers);
  const s = getGuardState();
  bus.emit('guard_changed', s);
  return s;
}
