// In-memory per-user sessions. A session carries guard state such as taint,
// suspicion flags and per-session counters (rate limits).
const sessions = new Map();
let counter = 0;

export function getSession(userId, sessionId) {
  const key = sessionId || `default:${userId}`;
  if (!sessions.has(key)) {
    sessions.set(key, {
      id: sessionId || `s-${++counter}`,
      user_id: userId,
      tainted: false,
      taint_labels: [],
      suspicious: false,
      counters: {},
      created: new Date().toISOString(),
    });
  }
  return sessions.get(key);
}

export function resetSessions() {
  sessions.clear();
}
