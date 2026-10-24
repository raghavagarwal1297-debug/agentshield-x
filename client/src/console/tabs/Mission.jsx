// MISSION tab (design/spec.md §4.1, with CONSOLE merged in): a guided demo of
// the 7 scenarios and a free chat mode, the 2D pipeline / conversation in the
// centre, and the terminal + alerts / live feed on the right. Also runs Autopilot.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Eye } from 'lucide-react';
import scenarioData from '../../../mock/chat.json';
import { getDocument, resetSandbox, sendChatMessage } from '../../api.js';
import { useConsole } from '../store.jsx';
import { Panel, KV } from '../ui.jsx';
import { userById, outcomeClass } from '../format.js';
import { MISSIONS, secretValues } from '../missions.js';
import Pipeline2D from '../Pipeline2D.jsx';
import Pipeline3D from '../Pipeline3D.jsx';
import Terminal from '../Terminal.jsx';
import Conversation from '../Conversation.jsx';
import DocViewer from '../DocViewer.jsx';
import LiveFeed from '../LiveFeed.jsx';
import './mission.css';

const SCENARIOS = scenarioData.scenarios;
const AUTOPILOT_PAUSE_MS = 8000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EMPTY_RUN = { key: 0, status: 'idle', decisions: [], steps: [] };

export default function Mission() {
  const c = useConsole();
  const [mode, setMode] = useState('guided'); // guided | free
  const [view, setView] = useState('pipeline'); // pipeline | conversation
  const [dim, setDim] = useState(() => { try { return localStorage.getItem('ax_pipeline_dim') || '2d'; } catch { return '2d'; } });
  const chooseDim = (d) => { setDim(d); try { localStorage.setItem('ax_pipeline_dim', d); } catch { /* storage blocked */ } };
  const [idx, setIdx] = useState(0);
  const [run, setRun] = useState(EMPTY_RUN);
  const [messages, setMessages] = useState([]);
  const [results, setResults] = useState({}); // { [scenarioId]: { off, monitor, enforce } }
  const [secrets, setSecrets] = useState([]);
  const [rightTab, setRightTab] = useState('alerts');
  const [draft, setDraft] = useState('');
  const [freeDocs, setFreeDocs] = useState([]);
  const [viewDoc, setViewDoc] = useState(null);
  const runRef = useRef(run);
  runRef.current = run;
  const sc = SCENARIOS[idx];
  const story = MISSIONS[sc.id] || {};

  useEffect(() => {
    getDocument('it_config.txt').then((d) => d && setSecrets(secretValues(d.content)));
  }, []);

  // Guided mode acts as the scenario's user so the header shows who is asking.
  useEffect(() => { if (mode === 'guided') c.setUser(userById(sc.user_id)); }, [mode, sc.user_id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setView(mode === 'guided' ? 'pipeline' : 'conversation'); }, [mode]);

  const pushMessage = (m) => setMessages((list) => [...list, { id: `${Date.now()}-${Math.random()}`, ts: new Date().toISOString(), ...m }]);

  const recordResult = useCallback((scenarioId, guardMode, r) => {
    const m = MISSIONS[scenarioId];
    if (!m) return;
    const value = m.measure(r, { secrets });
    setResults((all) => ({ ...all, [scenarioId]: { ...(all[scenarioId] || {}), [guardMode]: value } }));
  }, [secrets]);

  // Sends one request and tracks it as the current run.
  const send = useCallback(async ({ message, user, docIds = [], scenario = null, replay = false }) => {
    const key = runRef.current.key + 1;
    setRun({ ...EMPTY_RUN, key, status: 'running', message, user, docIds, scenarioId: scenario?.id, replay });
    pushMessage({ role: 'user', text: message, user, docIds });
    let guardMode = c.guard.mode;
    try {
      if (scenario) {
        // each scenario starts from clean data (so cached replays match) with its own layer set
        await resetSandbox({ keepIncidents: true });
        const g = await c.updateGuard({ layers: { ...c.ALL_ON, ...(scenario.guard_overrides?.layers || {}) } });
        guardMode = g?.mode || guardMode;
      }
      const r = await sendChatMessage({ user_id: user.id, message, doc_ids: docIds, replay });
      const next = {
        key, status: r.pending_approval_id ? 'paused' : 'done', message, user, docIds, scenarioId: scenario?.id, replay, guardMode,
        decisions: r.decisions || [], steps: r.steps || [], reply: r.reply, verdict: r.verdict, blocked: r.blocked,
        layer_stopped_at: r.layer_stopped_at, requestId: r.request_id, pendingApprovalId: r.pending_approval_id || null,
      };
      setRun(next);
      pushMessage({ role: 'assistant', text: r.reply, ...pick(r) });
      if (scenario && !next.pendingApprovalId) recordResult(scenario.id, guardMode, next);
      return next;
    } catch (e) {
      const cacheMiss = /demo cache/i.test(e.message);
      const failed = { key, status: 'error', message, user, docIds, scenarioId: scenario?.id, decisions: [], steps: [], error: e.message, cacheMiss };
      setRun(failed);
      pushMessage({ role: 'assistant', error: e.message, cacheMiss, decisions: [], steps: [] });
      return failed;
    }
  }, [c, recordResult]);

  // When the paused approval is decided (here or in the Approvals tab), merge the resumed run.
  useEffect(() => {
    const id = run.pendingApprovalId;
    const res = id && c.approvalResults[id];
    if (!res) return;
    const r = res.result || {};
    const next = {
      ...run, status: r.pending_approval_id ? 'paused' : 'done',
      decisions: r.decisions?.length ? r.decisions : run.decisions, steps: r.steps?.length ? r.steps : run.steps,
      reply: r.reply || run.reply, verdict: r.verdict, blocked: r.blocked, layer_stopped_at: r.layer_stopped_at,
      pendingApprovalId: r.pending_approval_id || null, decided: res.decision,
    };
    setRun(next);
    pushMessage({ role: 'assistant', text: r.reply || `Approval ${id} ${res.decision}d.`, ...pick(r) });
    if (next.scenarioId && !next.pendingApprovalId) recordResult(next.scenarioId, next.guardMode, next);
  }, [c.approvalResults]); // eslint-disable-line react-hooks/exhaustive-deps

  // The stream reports the decision before the approve call returns the resumed
  // run, so wait for that result ("resuming"). Only a system decision (timeout,
  // reset) ends the run without one.
  useEffect(() => {
    const id = run.pendingApprovalId;
    if (!id || c.approvalResults[id] || run.status !== 'paused') return;
    const done = c.resolved.find((a) => a.id === id);
    if (!done) return;
    if (done.resolved_by === 'system' || done.decided_by === 'system') {
      setRun((r) => ({ ...r, status: 'done', pendingApprovalId: null, decided: done.status }));
    } else {
      setRun((r) => ({ ...r, status: 'resuming', decided: done.status }));
    }
  }, [c.resolved]); // eslint-disable-line react-hooks/exhaustive-deps

  const runScenario = useCallback((i, { replay = false } = {}) => {
    const s = SCENARIOS[i];
    return send({ message: s.message, user: userById(s.user_id), docIds: s.doc_ids || [], scenario: s, replay });
  }, [send]);

  // ---------- Autopilot (replay only: no live LLM calls) ----------
  const stopFlag = useRef(false);
  const latest = useRef(null);
  latest.current = { runScenario, c };
  useEffect(() => latest.current.c.registerAutopilot({
    start: async () => {
      const { c: ctx } = latest.current;
      stopFlag.current = false;
      ctx.setAutopilotRunning(true);
      setMode('guided');
      try {
        for (let i = 0; i < SCENARIOS.length && !stopFlag.current; i++) {
          setIdx(i);
          await sleep(900);
          const r = await latest.current.runScenario(i, { replay: true });
          if (r.status === 'error') {
            ctx.toast('block', 'Autopilot stopped', r.cacheMiss
              ? `Scenario ${i + 1} is not in the demo cache for guard ${latest.current.c.guard.mode.toUpperCase()}.` : r.error);
            break;
          }
          // wait for a human decision on any pending approval, then for the resumed run
          while (runRef.current.status === 'paused' && !stopFlag.current) await sleep(300);
          for (let w = 0; w < 100 && runRef.current.status === 'resuming' && !stopFlag.current; w++) await sleep(300);
          if (i < SCENARIOS.length - 1) {
            for (let w = 0; w < AUTOPILOT_PAUSE_MS / 250 && !stopFlag.current; w++) await sleep(250);
          }
        }
      } finally {
        ctx.setAutopilotRunning(false);
      }
    },
    stop: () => { stopFlag.current = true; },
  }), []);
  useEffect(() => () => { stopFlag.current = true; }, []); // leaving the tab stops Autopilot

  // ← → keys move between scenarios in guided mode
  useEffect(() => {
    if (mode !== 'guided') return undefined;
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || c.autopilot.running) return;
      if (e.key === 'ArrowRight') setIdx((i) => Math.min(SCENARIOS.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, c.autopilot.running]);

  const busy = run.status === 'running' || run.status === 'resuming';
  const alerts = useMemo(() => (run.requestId ? c.incidents.filter((i) => i.request_id === run.requestId) : []), [c.incidents, run.requestId]);
  const docsById = useMemo(() => Object.fromEntries(c.documents.map((d) => [d.id, d])), [c.documents]);

  return (
    <div className="cx-body two-right">
      {/* ---------- left ---------- */}
      <div className="cx-col">
        <Panel className="fill mission-left" title={mode === 'guided' ? 'Mission' : 'Compose'} titleClass="cyan"
          actions={(
            <div className="seg" role="group" aria-label="Mission mode">
              <button type="button" data-v="plain" aria-pressed={mode === 'guided'} onClick={() => setMode('guided')} disabled={c.autopilot.running}>GUIDED DEMO</button>
              <button type="button" data-v="plain" aria-pressed={mode === 'free'} onClick={() => setMode('free')} disabled={c.autopilot.running}>FREE CHAT</button>
            </div>
          )}
          footer={mode === 'guided' ? (
            <GuidedFooter idx={idx} setIdx={setIdx} run={run} sc={sc} busy={busy} autopilot={c.autopilot.running}
              onRun={() => runScenario(idx)} onDecide={(d) => c.decideApproval(run.pendingApprovalId, d)} />
          ) : (
            <form className="compose" onSubmit={(e) => { e.preventDefault(); if (draft.trim() && !busy) { send({ message: draft.trim(), user: c.user, docIds: freeDocs }); setDraft(''); } }}>
              <textarea className="input" rows={3} placeholder={`Message NimbusAssist as ${c.user.name} (${c.user.role})`} value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form.requestSubmit(); } }} />
              <button type="submit" className="cta" disabled={busy || !draft.trim()}>{busy ? 'Working…' : 'Send'}</button>
            </form>
          )}>
          {mode === 'guided' ? (
            <GuidedStory idx={idx} sc={sc} story={story} run={run} results={results[sc.id]} docsById={docsById} onViewDoc={setViewDoc} guardMode={c.guard.mode} />
          ) : (
            <FreeCompose docs={c.documents} selected={freeDocs} setSelected={setFreeDocs} onViewDoc={setViewDoc}
              onPick={(s) => { setDraft(s.message); setFreeDocs(s.doc_ids || []); c.setUser(userById(s.user_id)); }} user={c.user} />
          )}
        </Panel>
      </div>

      {/* ---------- centre ---------- */}
      <div className="cx-col">
        <section className="panel fill centre">
          <div className="centre-head">
            <div className="seg" role="group" aria-label="Centre view">
              <button type="button" data-v="plain" aria-pressed={view === 'pipeline'} onClick={() => setView('pipeline')}>PIPELINE</button>
              <button type="button" data-v="plain" aria-pressed={view === 'conversation'} onClick={() => setView('conversation')}>CONVERSATION{messages.length ? ` · ${messages.filter((m) => m.role === 'user').length}` : ''}</button>
            </div>
            {view === 'pipeline' && (
              <div className="seg" role="group" aria-label="Pipeline view">
                <button type="button" data-v="plain" aria-pressed={dim === '2d'} onClick={() => chooseDim('2d')}>2D</button>
                <button type="button" data-v="plain" aria-pressed={dim === '3d'} onClick={() => chooseDim('3d')}>3D</button>
              </div>
            )}
            {run.replay && <span className="chip c-approval">REPLAY · NO LLM CALLS</span>}
          </div>
          {view === 'pipeline' ? (
            React.createElement(dim === '3d' ? Pipeline3D : Pipeline2D, {
              decisions: run.decisions, steps: run.steps, guard: c.guard, user: run.user || c.user,
              docIds: run.docIds || [], running: busy, runKey: run.key, requestId: run.requestId,
            })
          ) : (
            <div className="panel-body"><Conversation messages={messages} busy={busy} /></div>
          )}
        </section>
      </div>

      {/* ---------- right ---------- */}
      <div className="cx-col right">
        <Panel title="Terminal" meta="nimbus@guard" bodyClass="term-body">
          <Terminal runKey={run.key} decisions={run.decisions} message={run.message} reply={run.reply}
            pendingApprovalId={run.pendingApprovalId} error={run.error} running={busy} />
        </Panel>
        <Panel actions={(
          <div className="seg" role="tablist" aria-label="Right panel">
            <button type="button" data-v="plain" aria-pressed={rightTab === 'alerts'} onClick={() => setRightTab('alerts')}>ALERTS {alerts.length}</button>
            <button type="button" data-v="plain" aria-pressed={rightTab === 'feed'} onClick={() => setRightTab('feed')}>LIVE FEED</button>
          </div>
        )} title={rightTab === 'alerts' ? 'Alerts' : 'Live feed'}>
          {rightTab === 'alerts' ? <Alerts alerts={alerts} run={run} onOpen={c.openIncident} /> : <LiveFeed />}
        </Panel>
      </div>

      {viewDoc && <DocViewer id={viewDoc} onClose={() => setViewDoc(null)} />}
    </div>
  );
}

const pick = (r) => ({
  decisions: r.decisions || [], steps: r.steps || [], verdict: r.verdict, layer_stopped_at: r.layer_stopped_at,
  requestId: r.request_id, blocked: r.blocked,
});

function GuidedStory({ idx, sc, story, run, results = {}, docsById, onViewDoc, guardMode }) {
  const mine = run.scenarioId === sc.id;
  const done = mine && run.status === 'done';
  const value = done ? results[run.guardMode] : null;
  const heroColor = value == null ? 'var(--text-dim)' : story.attack ? (value > 0 ? 'var(--magenta)' : 'var(--cyan)') : 'var(--cyan)';
  const layersOff = Object.entries(sc.guard_overrides?.layers || {}).filter(([, on]) => !on).map(([k]) => k);
  return (
    <div className="story">
      <div className="stepper" aria-label={`Scenario ${idx + 1} of ${SCENARIOS.length}`}>
        {SCENARIOS.map((s, i) => <span key={s.id} className={i < idx ? 'done' : i === idx ? 'cur' : ''} />)}
      </div>
      <div className="kicker">{idx + 1} · {story.kicker}</div>
      <h1 className="story-h">{story.headline}</h1>
      <p className="story-p">{story.text}</p>
      <div className="story-chips">
        <span className="chip">{userById(sc.user_id).name} · {userById(sc.user_id).role}</span>
        {(sc.doc_ids || []).map((d) => (
          <button key={d} type="button" className="chip doc-chip" onClick={() => onViewDoc(d)} title="View document">
            <Eye size={11} /> {d}{docsById[d]?.hidden_spans?.length ? <span className="tag-hidden">hidden text</span> : null}
          </button>
        ))}
        {layersOff.map((l) => <span key={l} className="chip c-off">{l} off for this run</span>)}
      </div>
      <div className="hero-row">
        <span className="hero" style={{ color: heroColor }}>{value ?? (mine && run.status === 'paused' ? '…' : '—')}</span>
        <span className="hero-unit">{story.unit}<br /><span className="dim">{value == null ? `run it with guard ${guardMode.toUpperCase()}` : `guard ${String(run.guardMode).toUpperCase()}`}</span></span>
      </div>
      <div className="before-after">
        {['off', 'monitor', 'enforce'].map((m) => (
          <span key={m} className={`chip ${results[m] == null ? '' : story.attack && results[m] > 0 ? 'c-block' : 'c-allow'}`}>
            {m.toUpperCase()} {results[m] ?? '—'}
          </span>
        ))}
      </div>
      <p className="story-quote mono">“{sc.message}”</p>
      {sc.id === 4 || sc.id === 6 ? <p className="story-note">{sc.id === 4 ? 'Known gap: egress / DLP is not built yet.' : 'No before/after on this model yet.'}</p> : null}
    </div>
  );
}

function GuidedFooter({ idx, setIdx, run, sc, busy, autopilot, onRun, onDecide }) {
  const paused = run.status === 'paused' && run.scenarioId === sc.id;
  return (
    <div className="guided-foot">
      {paused ? (
        <div className="decide">
          <p><span className="amber">{run.pendingApprovalId}</span> is waiting for sign-off.</p>
          <div className="decide-btns">
            <button type="button" className="cta sm" onClick={() => onDecide('approve')}>Approve</button>
            <button type="button" className="btn danger" onClick={() => onDecide('reject')}>Reject</button>
          </div>
        </div>
      ) : (
        <button type="button" className="cta" onClick={onRun} disabled={busy || autopilot}>
          {busy ? 'Running…' : run.scenarioId === sc.id && run.status === 'done' ? 'Run again' : 'Run scenario'}
        </button>
      )}
      <div className="nav-row">
        <button type="button" className="btn" disabled={idx === 0 || autopilot} onClick={() => setIdx(idx - 1)}>Back</button>
        <button type="button" className="btn" disabled={idx === SCENARIOS.length - 1 || autopilot} onClick={() => setIdx(idx + 1)}>Next</button>
        <span className="dim keys"><kbd>←</kbd> <kbd>→</kbd> to move</span>
      </div>
    </div>
  );
}

function FreeCompose({ docs, selected, setSelected, onViewDoc, onPick, user }) {
  return (
    <div className="free">
      <p className="dim" style={{ fontSize: 14 }}>Asking as <b className="cyan">{user.name}</b> ({user.role}). Change the user in the bar above.</p>
      <div className="free-h">Attach documents</div>
      <div className="doc-list">
        {docs.map((d) => (
          <label key={d.id} className="doc-row">
            <input type="checkbox" checked={selected.includes(d.id)}
              onChange={() => setSelected((s) => (s.includes(d.id) ? s.filter((x) => x !== d.id) : [...s, d.id]))} />
            <span className="mono">{d.id}</span>
            <span className={`chip cls-${d.classification}`}>{d.classification}</span>
            {d.hidden_spans?.length > 0 && <span className="tag-hidden">hidden text</span>}
            <button type="button" className="btn icon sm" onClick={(e) => { e.preventDefault(); onViewDoc(d.id); }} aria-label={`View ${d.id}`}><Eye size={13} /></button>
          </label>
        ))}
      </div>
      <div className="free-h">Scenario prompts</div>
      <div className="quick">
        {SCENARIOS.map((s) => (
          <button key={s.id} type="button" className="chip quick-chip" onClick={() => onPick(s)} title={s.message}>
            {s.id} · {MISSIONS[s.id]?.kicker}
          </button>
        ))}
      </div>
    </div>
  );
}

function Alerts({ alerts, run, onOpen }) {
  if (!run.requestId) return <p className="empty">Incidents created by the current request appear here.</p>;
  if (!alerts.length) return <p className="empty">No incidents for {run.requestId}.</p>;
  return (
    <div>
      {alerts.map((i) => (
        <button key={i.id} type="button" className={`ev alert-ev ${outcomeClass(i) === 'approval' ? 'amber' : outcomeClass(i) === 'would' ? 'violet' : ''}`} onClick={() => onOpen(i.id)}>
          <div className="id">{i.id} · {(i.rule_ids || []).join(', ')}</div>
          <div className="tx">{i.summary?.split(' - ').slice(1).join(' - ') || i.summary}</div>
          <div className="dim" style={{ fontSize: 13 }}>{i.explanation?.kyun_roka}</div>
        </button>
      ))}
      <KV rows={[['Request', run.requestId], ['Incidents', alerts.length]]} />
    </div>
  );
}
