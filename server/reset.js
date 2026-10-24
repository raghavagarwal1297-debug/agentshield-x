// Restores the sandbox to its original state: data files, sessions and approvals.
// keepIncidents: restore everything else but keep the incident log and the
// list of decided approvals (guided runs and Autopilot reset data between
// scenarios so cached replays match, without wiping the trail the audience
// has just watched).
import { readJSON, resetData, writeJSON } from './store.js';
import { resetSessions } from './sessions.js';
import { resetApprovals } from './guard/approvals.js';

export function resetAll({ keepIncidents = false } = {}) {
  const incidents = keepIncidents ? readJSON('incidents.json') : null;
  resetData();
  resetSessions();
  resetApprovals({ keepHistory: keepIncidents });
  if (incidents) writeJSON('incidents.json', incidents);
}
