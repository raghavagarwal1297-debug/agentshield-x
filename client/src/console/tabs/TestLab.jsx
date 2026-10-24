// TEST LAB tab (design/spec.md §4.6): build and start an evaluation run, watch
// each case land as a tile (SSE test_progress), and look up any case.
import React, { useEffect, useMemo, useState } from 'react';
import { getHeldoutStatus, getTestCases, runTestSuite } from '../../api.js';
import { useConsole } from '../store.jsx';
import { Panel, KV } from '../ui.jsx';
import './testlab.css';

const MODE_LIST = { off: ['off'], enforce: ['enforce'], both: ['off', 'enforce'] };
const pct = (v) => (v == null ? '—' : `${v}%`);

function tileState(set, r) {
  if (!r) return ['wait', '…'];
  if (r.error) return ['err', 'ERROR'];
  if (set === 'attack') return r.achieved ? ['worked', 'ATTACK WORKED'] : ['stopped', 'STOPPED'];
  return r.achieved ? ['done', 'DONE'] : ['notdone', 'NOT DONE'];
}

export default function TestLab() {
  const c = useConsole();
  const [cases, setCases] = useState([]);
  const [mode, setMode] = useState('both');
  const [pause, setPause] = useState(8);
  const [replay, setReplay] = useState(false);
  const [picked, setPicked] = useState(null); // null = all
  const [heldoutReason, setHeldoutReason] = useState('');
  const [starting, setStarting] = useState(false);
  const [runError, setRunError] = useState('');
  const [mine, setMine] = useState(false); // this tab started the current run
  const [lookup, setLookup] = useState('');

  useEffect(() => {
    getTestCases().then((list) => { setCases(list); });
    getHeldoutStatus().then((h) => setHeldoutReason(h?.available ? '' : h?.reason || 'Held-out set not available.'));
  }, []);

  const selected = picked || cases.map((x) => x.id);
  const toggle = (id) => setPicked((p) => {
    const cur = p || cases.map((x) => x.id);
    return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  });
  const setGroup = (set, on) => setPicked((p) => {
    const cur = new Set(p || cases.map((x) => x.id));
    for (const x of cases.filter((k) => k.set === set)) { if (on) cur.add(x.id); else cur.delete(x.id); }
    return [...cur];
  });

  const progress = c.testProgress;
  const running = starting || (progress.length > 0 && !c.testFinished);
  const runs = selected.length * MODE_LIST[mode].length;
  const estSec = Math.round(runs * ((replay ? 0.2 : 6) + pause));

  const start = async () => {
    setRunError('');
    setStarting(true);
    setMine(true);
    c.setTestProgress([]);
    c.setTestFinished(null);
    try {
      await runTestSuite(mode, { only: picked ? selected : null, pause_ms: pause * 1000, replay });
    } catch (e) {
      setRunError(/already in progress/i.test(e.message) ? 'A run is already in progress (started from another tab or the CLI).' : e.message);
    } finally {
      setStarting(false);
      c.refreshResults();
    }
  };

  // tiles: live progress while/after a run in this session, else the last saved run
  const tiles = useMemo(() => {
    if (progress.length || running) {
      const total = progress[0]?.total || runs;
      const got = new Map(progress.map((p) => [`${p.mode}:${p.id}`, p]));
      const order = progress.length ? null : MODE_LIST[mode].flatMap((m) => selected.map((id) => `${m}:${id}`));
      const keys = order || [...got.keys()];
      return { live: true, total, items: keys.map((k) => { const p = got.get(k); const [m, id] = k.split(':'); return { key: k, mode: m, id, set: p?.set || cases.find((x) => x.id === id)?.set, r: p?.result }; }) };
    }
    const run = c.latestRun;
    if (!run) return { live: false, total: 0, items: [] };
    const items = (run.modes || []).flatMap((m) => run.cases.map((x) => ({ key: `${m}:${x.id}`, mode: m, id: x.id, set: x.set, r: x[m] })));
    return { live: false, total: items.length, items };
  }, [progress, running, c.latestRun, cases, mode, runs, selected]);

  const finished = c.testFinished || (!running && c.latestRun ? { off: c.latestRun.off, on: c.latestRun.on, finished: c.latestRun.finished } : null);
  const caseRow = c.latestRun?.cases?.find((x) => x.id.toLowerCase() === lookup.trim().toLowerCase());
  const liveRow = progress.filter((p) => p.id.toLowerCase() === lookup.trim().toLowerCase());

  return (
    <div className="cx-body">
      <div className="cx-col">
        <Panel className="fill" title="Run builder" titleClass="cyan"
          footer={(
            <div className="tl-foot">
              {runError && <p className="magenta tl-err">{runError}</p>}
              <button type="button" className="cta" disabled={running || !selected.length} onClick={start}>
                {running ? (mine ? 'Running…' : 'Run in progress') : 'Run suite'}
              </button>
            </div>
          )}>
          <div className="tl-field">
            <span className="tl-l">Guard mode</span>
            <div className="seg">
              {['off', 'enforce', 'both'].map((m) => <button key={m} type="button" data-v="plain" aria-pressed={mode === m} onClick={() => setMode(m)} disabled={running}>{m.toUpperCase()}</button>)}
            </div>
          </div>
          <label className="tl-field tl-slider">
            <span className="tl-l">Pause between cases <b className="mono">{pause} s</b></span>
            <input type="range" min="0" max="30" step="1" value={pause} onChange={(e) => setPause(Number(e.target.value))} disabled={running} />
          </label>
          <label className="tl-check">
            <input type="checkbox" checked={replay} onChange={(e) => setReplay(e.target.checked)} disabled={running} />
            <span>Demo cache only (no LLM calls). Cases not in the cache are listed as errors.</span>
          </label>
          {['attack', 'legit'].map((set) => {
            const group = cases.filter((x) => x.set === set);
            return (
              <div key={set} className="tl-group">
                <div className="tl-group-h">
                  <span>{set === 'attack' ? 'Attacks' : 'Legit tasks'} · {group.filter((x) => selected.includes(x.id)).length}/{group.length}</span>
                  <span><button type="button" className="linkish" onClick={() => setGroup(set, true)} disabled={running}>all</button> · <button type="button" className="linkish" onClick={() => setGroup(set, false)} disabled={running}>none</button></span>
                </div>
                <div className="tl-chips">
                  {group.map((x) => (
                    <button key={x.id} type="button" className="chip tl-chip" aria-pressed={selected.includes(x.id)} title={x.title} onClick={() => toggle(x.id)} disabled={running}>{x.id}</button>
                  ))}
                </div>
              </div>
            );
          })}
          <button type="button" className="chip tl-chip" disabled title={heldoutReason}>HELD-OUT (pending)</button>
          {heldoutReason && <p className="dim tl-note">{heldoutReason}</p>}
          <p className="tl-est">
            {runs} runs · about {estSec >= 90 ? `${Math.round(estSec / 60)} min` : `${estSec} s`} ·{' '}
            {replay ? <span className="green">no LLM calls</span> : <span className="amber">about {runs * 3} LLM calls</span>}
          </p>
          <p className="dim tl-note">Every case resets the sandbox and switches the guard, so do not run this during a live demo.</p>
        </Panel>
      </div>

      <div className="cx-col">
        <section className="panel fill tl-grid-panel">
          <div className="panel-head">
            <h2 className="panel-title">{running ? 'Running' : tiles.items.length ? (tiles.live ? 'Run complete' : 'Last saved run') : 'Awaiting test'}</h2>
            <span className="panel-meta">{tiles.items.length ? `${tiles.items.filter((t) => t.r).length} / ${tiles.total || tiles.items.length}` : ''}</span>
          </div>
          <div className="panel-body">
            {!tiles.items.length ? <p className="empty">Pick cases on the left and press Run suite. Each case lands here as a tile.</p> : (
              ['off', 'enforce'].filter((m) => tiles.items.some((t) => t.mode === m)).map((m) => (
                <div key={m} className="tl-mode">
                  <div className="tl-mode-h">Guard {m === 'off' ? 'OFF' : 'ENFORCE'}</div>
                  <div className="tl-tiles">
                    {tiles.items.filter((t) => t.mode === m).map((t) => {
                      const [cls, label] = tileState(t.set, t.r);
                      return (
                        <button key={t.key} type="button" className={`tl-tile ${cls}`} onClick={() => setLookup(t.id)} title={t.r?.error || t.r?.effect || t.r?.reply || ''}>
                          <span className="mono tl-id">{t.id}</span>
                          <span className="tl-st">{label}</span>
                          <span className="mono tl-ms">{t.r ? `${t.r.ms ?? '—'} ms${t.r.layer ? ` · ${t.r.layer}` : ''}` : 'queued'}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="tl-footer mono">
            <span>CASES {tiles.items.filter((t) => t.r).length} / {tiles.total || tiles.items.length || 0}</span>
            <span>{replay && (running || tiles.live) ? 'CACHED REPLAY' : c.health?.llm?.demo_mode === 'cached' ? 'LIVE LLM · CACHE ON' : 'LIVE LLM'}</span>
          </div>
        </section>
      </div>

      <div className="cx-col right">
        <Panel title="Result" meta={finished?.finished ? new Date(finished.finished).toLocaleTimeString('en-GB') : null}>
          {!finished ? <p className="empty">Run the suite to see results here.</p> : (
            <>
              <KV rows={[
                ['Attack success', `${pct(finished.off?.asr)} → ${pct(finished.on?.asr)}`],
                ['Task completion', `${pct(finished.off?.task_completion)} → ${pct(finished.on?.task_completion)}`],
                ['False positives', `${pct(finished.off?.false_positive_rate)} → ${pct(finished.on?.false_positive_rate)}`],
                ['Errored (excluded)', [...new Set([...(finished.off?.errors || []), ...(finished.on?.errors || [])])].join(', ') || 'none'],
              ]} />
              <button type="button" className="btn sm tl-open" onClick={() => c.setTab('results')}>Open Results</button>
            </>
          )}
        </Panel>
        <Panel title="Case lookup">
          <input className="input mono" placeholder="S2 or L06" value={lookup} onChange={(e) => setLookup(e.target.value)} aria-label="Case id" />
          {!lookup.trim() && <p className="empty">Type a case id (S2, L06) or click a tile.</p>}
          {lookup.trim() && !caseRow && !liveRow.length && <p className="empty">No case {lookup} in the last run.</p>}
          {(caseRow ? ['off', 'enforce'].map((m) => [m, caseRow[m]]) : liveRow.map((p) => [p.mode, p.result])).filter(([, r]) => r).map(([m, r]) => (
            <div key={m} className="tl-case">
              <div className="tl-mode-h">{caseRow?.title || lookup} · guard {m.toUpperCase()}</div>
              <KV rows={[
                ['Result', r.error ? `error: ${r.error.slice(0, 80)}` : (caseRow?.set || liveRow[0]?.set) === 'attack' ? (r.achieved ? 'attack worked' : 'stopped') : (r.achieved ? 'completed' : 'not completed')],
                ['Effect', r.effect], ['Tools', (r.tools || []).join(' ')], ['Rules', (r.rules || []).join(', ')], ['Time', r.ms != null ? `${r.ms} ms` : null],
              ]} />
              {r.reply && <p className="tl-reply">{r.reply}</p>}
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}
