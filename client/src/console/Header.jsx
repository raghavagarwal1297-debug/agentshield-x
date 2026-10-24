// Two-row header: brand, guard status, clock, tabs, sound, Autopilot; then the
// sandbox notice with the guard controls (mode, layers, acting user, server, reset).
import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX, MoreHorizontal } from 'lucide-react';
import { useConsole } from './store.jsx';
import { ConfirmButton } from './ui.jsx';
import { LAYERS, MODE_STYLE, TABS, USERS, timeIST } from './format.js';
import { getDataSource, setDataSource } from '../api.js';

function Clock() {
  const [now, setNow] = useState(() => timeIST());
  useEffect(() => { const t = setInterval(() => setNow(timeIST()), 1000); return () => clearInterval(t); }, []);
  return <span className="cx-clock">{now} IST</span>;
}

function ServerStatus({ health }) {
  const llm = health?.llm || {};
  const state = !health?.ok ? ['OFFLINE', 'var(--magenta)']
    : llm.demo_mode === 'cached' ? ['CACHED', 'var(--amber)']
      : llm.demo_mode === 'record' ? ['RECORDING', 'var(--amber)']
        : ['LIVE', 'var(--green)'];
  const rules = health?.scanner_rules?.loaded;
  return (
    <span className="srv" tabIndex={0} style={{ color: state[1] }} aria-label={`Server ${state[0]}`}>
      <span className="d" />{state[0]}
      <span className="card">
        {!health?.ok ? <p>The backend on :4000 is not reachable. Start it with <span className="mono">node server/index.js</span>.</p> : (
          <table className="kv"><tbody>
            <tr><td>Provider</td><td>{llm.provider}</td></tr>
            <tr><td>Agent model</td><td>{llm.agent_model}</td></tr>
            <tr><td>Judge model</td><td>{llm.judge_model}</td></tr>
            <tr><td>Demo mode</td><td>{llm.demo_mode}</td></tr>
            <tr><td>Cached responses</td><td>{llm.cached_responses}</td></tr>
            <tr><td>Scanner rules</td><td style={{ color: rules ? undefined : 'var(--amber)' }}>{rules ?? '—'}{rules === 0 ? ' (none loaded)' : ''}</td></tr>
            <tr><td>DLP detectors</td><td>{health?.dlp_detectors?.loaded ?? '—'}</td></tr>
          </tbody></table>
        )}
      </span>
    </span>
  );
}

function DevMenu() {
  const [open, setOpen] = useState(false);
  const src = getDataSource();
  return (
    <span style={{ position: 'relative' }}>
      <button type="button" className="btn icon" aria-label="More" onClick={() => setOpen((o) => !o)}><MoreHorizontal size={15} /></button>
      {open && (
        <div className="confirm">
          <p>Data source: <b className="mono">{src.toUpperCase()}</b>. Mock mode uses the frontend's sample data and never calls the server.</p>
          <div className="acts">
            <button type="button" className="btn sm" onClick={() => { setDataSource(src === 'live' ? 'mock' : 'live'); window.location.reload(); }}>
              Switch to {src === 'live' ? 'mock' : 'live'}
            </button>
          </div>
        </div>
      )}
    </span>
  );
}

export default function Header() {
  const c = useConsole();
  const mode = MODE_STYLE[c.guard.mode] || MODE_STYLE.enforce;
  const badges = { investigate: [c.incidents.length, 'dim'], approvals: [c.approvals.length, 'amber'] };
  const mock = getDataSource() === 'mock';
  return (
    <header className="cx-header">
      <div className="cx-row1">
        <span className="cx-brand">AGENTSHIELD X</span>
        <span className="cx-sub">AI agent security console</span>
        <span className="cx-session" style={{ color: mode.color }}>
          <span className="dot" style={{ color: mode.dot || mode.color }} />{mode.label}
        </span>
        <Clock />
        {mock && <span className="chip c-approval">MOCK DATA</span>}
        <nav className="cx-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" className="cx-tab" aria-selected={c.tab === t.id} onClick={() => c.setTab(t.id)}>
              {t.label}
              {badges[t.id]?.[0] > 0 && <span className={`badge ${badges[t.id][1]}`}>{badges[t.id][0]}</span>}
            </button>
          ))}
        </nav>
        <button type="button" className="btn icon" onClick={c.toggleMuted} aria-label={c.muted ? 'Unmute alerts' : 'Mute alerts'} title={c.muted ? 'Sound off' : 'Sound on'}>
          {c.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <button type="button" className="btn" disabled={!c.autopilot.ready}
          title={c.autopilot.ready ? 'Play scenarios 1-7 from the demo cache (no live LLM calls)' : 'Available on the Mission tab'}
          aria-pressed={c.autopilot.running}
          style={c.autopilot.running ? { borderColor: 'var(--amber)', color: 'var(--amber)' } : undefined}
          onClick={() => (c.autopilot.running ? c.stopAutopilot() : c.startAutopilot())}>
          {c.autopilot.running ? 'Stop autopilot' : 'Autopilot'}
        </button>
      </div>

      <div className="cx-row2">
        <p className="cx-notice"><b>Fictional sandbox.</b> Nimbus Retail is invented; tools are mocks and no real email, payment or deletion happens.</p>
        <div className="cx-controls">
          <div className="seg" role="group" aria-label="Guard mode">
            {['off', 'monitor', 'enforce'].map((m) => (
              <button key={m} type="button" data-v={m} aria-pressed={c.guard.mode === m} onClick={() => c.updateGuard({ mode: m })}>{m.toUpperCase()}</button>
            ))}
          </div>
          <span style={{ display: 'inline-flex', gap: 6 }} role="group" aria-label="Guard layers">
            {LAYERS.map((l) => (
              <button key={l.key} type="button" className="layer" aria-pressed={c.guard.layers?.[l.key] !== false}
                title={l.pending ? 'Egress / DLP checks are not built yet; this switch has no effect today.' : `Turn ${l.label} ${c.guard.layers?.[l.key] !== false ? 'off' : 'on'}`}
                onClick={() => c.updateGuard({ layers: { [l.key]: c.guard.layers?.[l.key] === false } })}>
                <span className="d" /><span className="t">{l.short} {l.label}</span>{l.pending && <span className="tag">NOT BUILT</span>}
              </button>
            ))}
          </span>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span className="dim" style={{ fontSize: 13 }}>Acting as</span>
            <select className="cx-select" value={c.user.id} onChange={(e) => c.setUser(USERS.find((u) => u.id === e.target.value))}>
              {USERS.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.role}</option>)}
            </select>
          </label>
          <ServerStatus health={c.health} />
          <ConfirmButton label="Reset" question="Reset sandbox data, incidents and approvals?" confirmLabel="Reset" danger onConfirm={c.reset} />
          <DevMenu />
        </div>
      </div>
    </header>
  );
}
