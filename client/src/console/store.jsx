// Console state: one place that loads data, listens to the SSE stream and
// exposes actions to every tab. Tabs read it with useConsole().
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  checkHealth, getGuardConfig, setGuardConfig, resetSandbox, getDocuments, getApprovals,
  getIncidents, getPolicy, getMetrics, getLatestRun, subscribeToStream, resolveApproval,
} from '../api.js';
import { USERS } from './format.js';
import { beep } from './sound.js';

const Ctx = createContext(null);
export const useConsole = () => useContext(Ctx);

const MAX_EVENTS = 300;
const ALL_ON = { scanner: true, firewall: true, approval: true, egress: true };

export function ConsoleProvider({ children }) {
  const [tab, setTab] = useState('mission');
  const [user, setUser] = useState(USERS[0]);
  const [health, setHealth] = useState(null);
  const [guard, setGuardState] = useState({ mode: 'enforce', layers: ALL_ON });
  const [documents, setDocuments] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [approvals, setApprovals] = useState([]); // pending
  const [resolved, setResolved] = useState([]); // approved / rejected, newest first
  const [events, setEvents] = useState([]); // guard decisions, newest first
  const [policy, setPolicy] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [latestRun, setLatestRun] = useState(null);
  const [testProgress, setTestProgress] = useState([]); // test_progress events of the current run
  const [testFinished, setTestFinished] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [muted, setMuted] = useState(() => { try { return localStorage.getItem('ax_muted') !== '0'; } catch { return true; } });
  const [focusIncident, setFocusIncident] = useState(null); // id to open in INVESTIGATE
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const toast = useCallback((kind, title, text) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((t) => [...t.slice(-3), { id, kind, title, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const refreshHealth = useCallback(async () => setHealth(await checkHealth()), []);
  const refreshApprovals = useCallback(async () => {
    const [p, a, r] = await Promise.all([getApprovals('pending'), getApprovals('approved'), getApprovals('rejected')]);
    if (p) setApprovals(p);
    if (a && r) setResolved([...a, ...r].sort((x, y) => String(y.resolved_at || y.decided_at).localeCompare(String(x.resolved_at || x.decided_at))));
  }, []);
  const refreshIncidents = useCallback(async () => { const i = await getIncidents(200); if (i) setIncidents(i); }, []);
  const refreshResults = useCallback(async () => {
    const [m, r] = await Promise.all([getMetrics(), getLatestRun()]);
    setMetrics(m);
    setLatestRun(r);
  }, []);
  const refreshPolicy = useCallback(async () => { const p = await getPolicy(); if (p) setPolicy(p); }, []);

  // initial load + health polling
  useEffect(() => {
    (async () => {
      const [g, docs] = await Promise.all([getGuardConfig(), getDocuments()]);
      if (g) setGuardState(g);
      if (docs) setDocuments(docs);
    })();
    refreshHealth();
    refreshApprovals();
    refreshIncidents();
    refreshResults();
    refreshPolicy();
    const t = setInterval(refreshHealth, 15000);
    return () => clearInterval(t);
  }, [refreshHealth, refreshApprovals, refreshIncidents, refreshResults, refreshPolicy]);

  // live stream
  useEffect(() => subscribeToStream(({ type, data }) => {
    if (!data) return;
    if (type === 'hello' || type === 'guard_changed') setGuardState(data);
    else if (type === 'decision') setEvents((e) => [{ ...data, _k: `${Date.now()}-${Math.random()}` }, ...e].slice(0, MAX_EVENTS));
    else if (type === 'incident') {
      setIncidents((list) => [data, ...list.filter((i) => i.id !== data.id)]);
      const kind = data.would_block ? 'would' : data.outcome === 'NEEDS_APPROVAL' ? 'approval' : 'block';
      if (kind !== 'approval') {
        toast(kind, `${data.would_block ? 'Would block' : 'Blocked'} · ${data.id}`, data.summary?.split(' - ')[1] || data.summary);
        if (!mutedRef.current) beep(kind === 'block' ? 'block' : 'soft');
      }
    } else if (type === 'approval_created') {
      setApprovals((list) => [data, ...list.filter((a) => a.id !== data.id)]);
      toast('approval', `Sign-off needed · ${data.id}`, `${data.requester} wants ${data.tool}`);
      if (!mutedRef.current) beep('approval');
    } else if (type === 'approval_resolved') {
      setApprovals((list) => list.filter((a) => a.id !== data.id));
      setResolved((list) => [data, ...list.filter((a) => a.id !== data.id)]);
    } else if (type === 'test_progress') setTestProgress((p) => [...p, data]);
    else if (type === 'test_finished') { setTestFinished(data); refreshResults(); }
  }, () => {}), [toast, refreshResults]);

  // Always send the full config so another tab's change is never overwritten with stale values.
  const updateGuard = useCallback(async (patch) => {
    const next = { mode: patch.mode ?? guard.mode, layers: { ...guard.layers, ...(patch.layers || {}) } };
    setGuardState(next);
    try {
      const saved = await setGuardConfig(next);
      if (saved) setGuardState(saved);
      return saved || next;
    } catch (e) {
      toast('block', 'Guard change failed', e.message);
      const current = await getGuardConfig();
      if (current) setGuardState(current);
      return current;
    }
  }, [guard, toast]);

  const reset = useCallback(async () => {
    try {
      await resetSandbox();
      setEvents([]);
      setTestProgress([]);
      setTestFinished(null);
      await Promise.all([refreshIncidents(), refreshApprovals(), refreshPolicy()]);
      setResolved([]);
      toast('info', 'Sandbox reset', 'Data, incidents and approvals are back to the start.');
    } catch (e) {
      toast('block', 'Reset failed', e.message);
    }
  }, [refreshIncidents, refreshApprovals, refreshPolicy, toast]);

  const toggleMuted = useCallback(() => setMuted((m) => {
    try { localStorage.setItem('ax_muted', m ? '0' : '1'); } catch { /* storage blocked */ }
    return !m;
  }), []);

  const openIncident = useCallback((id) => { setFocusIncident(id); setTab('investigate'); }, []);

  // Approve / reject from any tab. The resumed run's final answer is kept per
  // approval id so the Mission tab can show it wherever the decision was made.
  const [approvalResults, setApprovalResults] = useState({});
  const decideApproval = useCallback(async (id, decision) => {
    try {
      const res = await resolveApproval(id, decision, user.id);
      setApprovalResults((m) => ({ ...m, [id]: { decision, approval: res.approval, result: res.result } }));
      refreshApprovals();
      refreshIncidents();
      return res;
    } catch (e) {
      toast('block', `Could not ${decision} ${id}`, e.message);
      refreshApprovals();
      return null;
    }
  }, [user.id, refreshApprovals, refreshIncidents, toast]);

  // Autopilot: the Mission tab registers a runner { start, stop }; the header
  // button is enabled only while one is registered.
  const runner = useRef(null);
  const [autopilot, setAutopilot] = useState({ ready: false, running: false });
  const registerAutopilot = useCallback((r) => {
    runner.current = r;
    setAutopilot((a) => ({ ...a, ready: true }));
    return () => { runner.current = null; setAutopilot({ ready: false, running: false }); };
  }, []);
  const startAutopilot = useCallback(() => { setTab('mission'); runner.current?.start(); }, []);
  const stopAutopilot = useCallback(() => runner.current?.stop(), []);
  const setAutopilotRunning = useCallback((running) => setAutopilot((a) => ({ ...a, running })), []);

  const value = {
    tab, setTab, user, setUser, health, guard, updateGuard, documents, incidents, approvals, resolved,
    events, policy, setPolicy, metrics, latestRun, testProgress, setTestProgress, testFinished, setTestFinished,
    toasts, toast, muted, toggleMuted, reset, focusIncident, setFocusIncident, openIncident,
    refreshApprovals, refreshIncidents, refreshResults, refreshPolicy, ALL_ON,
    autopilot, registerAutopilot, startAutopilot, stopAutopilot, setAutopilotRunning,
    approvalResults, decideApproval,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
