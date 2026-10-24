// Shared constants and small formatters for the console UI.

export const USERS = [
  { id: 'hr_karan', name: 'Karan', role: 'hr' },
  { id: 'admin_riya', name: 'Riya', role: 'admin' },
  { id: 'intern_aman', name: 'Aman', role: 'intern' },
];
export const userById = (id) => USERS.find((u) => u.id === id) || USERS[0];

// Must match server/agent/tools.js
export const TOOLS = ['search_records', 'read_document', 'send_email', 'fetch_url', 'issue_refund', 'delete_record', 'export_data'];

export const LAYERS = [
  { key: 'scanner', short: 'L1', label: 'SCAN' },
  { key: 'firewall', short: 'L2', label: 'FIREWALL' },
  { key: 'approval', short: 'L3', label: 'APPROVAL' },
  { key: 'egress', short: 'L4', label: 'EGRESS', pending: true }, // detector loader only; checks not built yet
];

export const TABS = [
  { id: 'mission', label: 'MISSION' },
  { id: 'investigate', label: 'INVESTIGATE' },
  { id: 'approvals', label: 'APPROVALS' },
  { id: 'results', label: 'RESULTS' },
  { id: 'testlab', label: 'TEST LAB' },
  { id: 'policy', label: 'POLICY' },
];

// Outcome -> css suffix used by .chip.c-*, .term .out.*, .toast.*, .ev.*
export function outcomeClass(d) {
  if (!d) return 'off';
  if (d.unguarded) return 'off';
  if (d.would_block) return 'would';
  return { ALLOW: 'allow', REDACT: 'redact', NEEDS_APPROVAL: 'approval', BLOCK: 'block', REJECTED: 'block' }[d.outcome] || 'off';
}

export function outcomeLabel(d) {
  if (!d) return '';
  if (d.unguarded) return 'UNGUARDED';
  if (d.would_block) return 'WOULD BLOCK';
  return { NEEDS_APPROVAL: 'PAUSED', REDACT: 'REDACTED' }[d.outcome] || d.outcome;
}

export const OUTCOME_COLOR = {
  allow: 'var(--green)', redact: 'var(--cyan)', approval: 'var(--amber)',
  block: 'var(--magenta)', would: 'var(--violet)', off: 'var(--grey)',
};

export const riskClass = (r) => (r >= 70 ? 'magenta' : r >= 30 ? 'amber' : 'cyan');

export const MODE_STYLE = {
  off: { label: 'Guard OFF', color: 'var(--grey)' },
  monitor: { label: 'Guard MONITOR', color: 'var(--violet)' },
  enforce: { label: 'Guard ENFORCE', color: 'var(--amber)', dot: 'var(--magenta)' },
};

export const timeIST = (d = new Date()) =>
  new Date(d).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });

export const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

// Short "tool args" text with money highlighted by the caller.
export function argsSummary(args = {}) {
  return Object.entries(args).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' ').slice(0, 90);
}

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
