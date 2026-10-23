// Human Approval Queue. Sensitive tool calls create a pending approval; the
// agent loop awaits its promise, which settles when a human decides via
// POST /api/approvals/:id, or auto-rejects after a timeout (5 min default).
import { EventEmitter } from 'events';

export const approvalEvents = new EventEmitter(); // 'approval_created', 'approval_resolved'

const TIMEOUT_MS = Number(process.env.APPROVAL_TIMEOUT_MS || 5 * 60 * 1000);
const approvals = new Map();
let counter = 0;

// Also exposes the field names the dashboard reads (created_at, expires_at,
// resolved_by, resolved_at) next to the original ones.
const publicView = ({ resolve, timer, finished, finish, ...a }) => ({
  ...a,
  created_at: a.created,
  expires_at: new Date(Date.parse(a.created) + TIMEOUT_MS).toISOString(),
  resolved_by: a.decided_by,
  resolved_at: a.decided_at,
});

// Returns { id, promise }. The promise resolves to { decision: 'approve'|'reject', by, reason }.
export function createApproval({ tool, args, user, session, risk, reason, rule_ids = [] }) {
  const id = `APR-${String(++counter).padStart(4, '0')}`;
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  const approval = {
    id, status: 'pending', created: new Date().toISOString(),
    tool, args, requester: user.id, role: user.role, session: session.id,
    risk, reason, rule_ids,
    decided_by: null, decided_at: null,
    resolve,
    timer: setTimeout(() => settle(id, { decision: 'reject', by: 'system', reason: 'timed out after 5 minutes' }), TIMEOUT_MS),
  };
  // Settles when the agent run that was paused by this approval finishes.
  approval.finished = new Promise((r) => { approval.finish = r; });
  approvals.set(id, approval);
  approvalEvents.emit('approval_created', publicView(approval));
  return { id, promise };
}

function settle(id, { decision, by, reason }) {
  const a = approvals.get(id);
  if (!a || a.status !== 'pending') return null;
  clearTimeout(a.timer);
  a.status = decision === 'approve' ? 'approved' : 'rejected';
  a.decided_by = by || 'unknown';
  a.decided_at = new Date().toISOString();
  a.decision_reason = reason || null;
  a.resolve({ decision, by: a.decided_by, reason });
  approvalEvents.emit('approval_resolved', publicView(a));
  return a;
}

// Called by POST /api/approvals/:id. Throws on unknown id / already decided.
export function decide(id, { decision, by }) {
  if (!['approve', 'reject'].includes(decision)) throw new Error('decision must be "approve" or "reject"');
  const a = approvals.get(id);
  if (!a) throw new Error(`Approval ${id} not found`);
  if (a.status !== 'pending') throw new Error(`Approval ${id} was already ${a.status}`);
  return publicView(settle(id, { decision, by, reason: decision === 'reject' ? 'rejected by reviewer' : undefined }));
}

// The chat route attaches the agent's final result once the paused run completes.
export function attachResult(id, result) {
  const a = approvals.get(id);
  if (!a) return;
  a.result = result;
  a.finish(result);
}

// Waits (bounded) for the agent run behind an approval to finish.
export async function waitForResult(id, ms = 120000) {
  const a = approvals.get(id);
  if (!a) return null;
  return Promise.race([a.finished, new Promise((r) => setTimeout(() => r(null), ms))]);
}

export function listApprovals({ status } = {}) {
  return [...approvals.values()].filter((a) => !status || a.status === status).map(publicView);
}

export function resetApprovals() {
  for (const a of approvals.values()) if (a.status === 'pending') settle(a.id, { decision: 'reject', by: 'system', reason: 'demo reset' });
  approvals.clear();
}
