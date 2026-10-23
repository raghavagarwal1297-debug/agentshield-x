// One event bus for the live dashboard feed (GET /api/stream).
// Events: decision, incident, approval_created, approval_resolved, guard_changed.
import { EventEmitter } from 'events';
import { approvalEvents } from './approvals.js';

export const bus = new EventEmitter();
bus.setMaxListeners(100);

for (const name of ['approval_created', 'approval_resolved']) {
  approvalEvents.on(name, (a) => bus.emit(name, a));
}
