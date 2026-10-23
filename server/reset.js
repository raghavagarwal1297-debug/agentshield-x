// Restores the sandbox to its original state: data files, sessions and approvals.
import { resetData } from './store.js';
import { resetSessions } from './sessions.js';
import { resetApprovals } from './guard/approvals.js';

export function resetAll() {
  resetData();
  resetSessions();
  resetApprovals();
}
