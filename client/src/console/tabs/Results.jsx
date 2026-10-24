// RESULTS tab (design/spec.md §4.5): scorecard of the last evaluation run,
// per-attack outcomes, latency, this browser session's activity, and what got
// through. Values that were never measured show "—"; nothing is invented.
import React, { useEffect, useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, LabelList } from 'recharts';
import { useConsole } from '../store.jsx';
import { Panel, KV } from '../ui.jsx';
import { timeIST } from '../format.js';
import './results.css';

const fmt = (v, unit = '%') => (v == null ? '—' : `${v}${unit}`);
const AXIS = { stroke: '#1a3550', tick: { fill: '#7e93a8', fontSize: 12, fontFamily: 'JetBrains Mono' } };

function ChartTip({ active, payload, label, unit = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tip">
      <div className="tip-h">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="tip-row"><span className="sw" style={{ background: p.color || p.fill }} />{p.name}<b>{p.value}{unit}</b></div>
      ))}
    </div>
  );
}

function Score({ label, off, on, unit = '%', good = 'low', hint }) {
  const better = off != null && on != null && (good === 'low' ? on < off : on > off);
  return (
    <div className="score" title={hint}>
      <div className="score-l">{label}</div>
      <div className="score-v mono">
        <span className={off == null ? 'dim' : ''}>{fmt(off, unit)}</span>
        <span className="dim">→</span>
        <span className={on == null ? 'dim' : better ? 'cyan' : ''}>{fmt(on, unit)}</span>
      </div>
    </div>
  );
}

export default function Results() {
  const c = useConsole();
  useEffect(() => { c.refreshResults(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const run = c.latestRun;
  const off = run?.off || {};
  const on = run?.on || {};
  const attacks = (run?.cases || []).filter((x) => x.set === 'attack');
  const legit = (run?.cases || []).filter((x) => x.set === 'legit');

  const latency = [
    { name: 'Request, guard OFF', ms: off.avg_ms_per_request },
    { name: 'Request, guard ON', ms: on.avg_ms_per_request },
    { name: 'Inside guard hooks', ms: on.avg_guard_ms_per_request },
  ].filter((d) => d.ms != null);

  // this browser session: checks per minute by outcome, incidents by risk band
  const session = useMemo(() => {
    const byMin = new Map();
    for (const e of c.events) {
      const k = timeIST(e.ts).slice(0, 5);
      const row = byMin.get(k) || { minute: k, allowed: 0, stopped: 0, paused: 0 };
      if (e.outcome === 'BLOCK' && !e.would_block) row.stopped++;
      else if (e.outcome === 'NEEDS_APPROVAL' && !e.would_block) row.paused++;
      else row.allowed++;
      byMin.set(k, row);
    }
    const bands = [
      { band: 'High (70+)', n: c.incidents.filter((i) => i.risk >= 70).length, fill: '#ff3d7a' },
      { band: 'Medium (30-69)', n: c.incidents.filter((i) => i.risk >= 30 && i.risk < 70).length, fill: '#f6b520' },
      { band: 'Low (<30)', n: c.incidents.filter((i) => i.risk < 30).length, fill: '#3be2f2' },
    ];
    return {
      trend: [...byMin.values()].reverse().slice(-15),
      bands,
      requests: new Set(c.events.map((e) => e.request_id).filter(Boolean)).size,
      stopped: c.events.filter((e) => ['BLOCK', 'NEEDS_APPROVAL'].includes(e.outcome) && !e.would_block).length,
    };
  }, [c.events, c.incidents]);

  const gotThrough = attacks.filter((x) => x.enforce?.achieved);
  const fps = legit.filter((x) => (on.false_positives || []).includes(x.id));
  const redacted = legit.filter((x) => (on.redacted_but_completed || []).includes(x.id));

  return (
    <div className="cx-body">
      <div className="cx-col">
        <Panel className="fill" title="Scorecard" meta={run ? 'last run' : 'no run yet'}>
          {!run && <p className="empty">No evaluation has been run yet. Start one on the Test Lab tab.</p>}
          <div className="scores">
            <div className="score-head mono dim"><span /><span>OFF → ON</span></div>
            <Score label="Attack success" off={off.asr} on={on.asr} hint="attacks that reached their goal / valid attacks" />
            <Score label="Task completion" off={off.task_completion} on={on.task_completion} good="high" hint="legit tasks completed / valid legit tasks" />
            <Score label="False positives" off={off.false_positive_rate} on={on.false_positive_rate} hint="legit tasks blocked or not completed; allowed redactions do not count" />
            <Score label="Permission enforcement" off={off.permission_enforcement} on={on.permission_enforcement} good="high" hint="tool calls the role may not use: stopped / attempted" />
            <Score label="Guard time / request" off={off.avg_guard_ms_per_request} on={on.avg_guard_ms_per_request} unit=" ms" hint="time spent inside guard hooks" />
            <Score label="Held-out attack success" off={null} on={null} hint="not measured: tests/heldout.json is pending" />
          </div>
          {run && (
            <>
              <div className="res-h">Run</div>
              <KV rows={[
                ['Model', run.llm?.agent_model],
                ['LLM', run.llm?.demo_mode === 'cached' ? <span key="c" className="chip c-approval">CACHED REPLAY</span> : run.llm?.demo_mode],
                ['Finished', run.finished ? `${new Date(run.finished).toLocaleDateString('en-GB')} ${timeIST(run.finished)}` : null],
                ['Attacks valid', `OFF ${off.attacks?.valid ?? '—'} · ON ${on.attacks?.valid ?? '—'}`],
                ['Legit valid', `OFF ${off.legit?.valid ?? '—'} · ON ${on.legit?.valid ?? '—'}`],
                ['Errored (excluded)', [...new Set([...(off.errors || []), ...(on.errors || [])])].join(', ') || 'none'],
              ]} />
            </>
          )}
        </Panel>
      </div>

      <div className="cx-col">
        <Panel className="fill" title="Evaluation" titleClass="cyan" meta={run ? `${attacks.length} attacks · ${legit.length} legit tasks` : null} bodyClass="res-centre">
          <section>
            <h3 className="res-h">Attack outcomes</h3>
            {!attacks.length ? <p className="empty">{run ? 'The last run had no attack cases. Include S2-S7 in a Test Lab run.' : 'No run yet. Press Run suite on the Test Lab tab.'}</p> : (
              <table className="matrix">
                <thead><tr><th>Attack</th><th>Guard OFF</th><th>Guard ON</th><th>Stopped by</th></tr></thead>
                <tbody>
                  {attacks.map((x) => (
                    <tr key={x.id}>
                      <td><span className="mono cyan">{x.id}</span> {x.title}</td>
                      <td><Cell r={x.off} /></td>
                      <td><Cell r={x.enforce} /></td>
                      <td className="mono dim">{x.enforce && !x.enforce.error && !x.enforce.achieved ? (x.layer || (x.enforce.rules || []).join(',') || 'model refused') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section>
            <h3 className="res-h">Average time per request (ms)</h3>
            {!latency.length ? <p className="empty">No latency measured yet. Run the suite on the Test Lab tab.</p> : (
              <div className="chart" style={{ height: 150 }}>
                <ResponsiveContainer>
                  <BarChart data={latency} layout="vertical" margin={{ top: 4, right: 60, bottom: 4, left: 10 }} barCategoryGap={8}>
                    <CartesianGrid horizontal={false} stroke="#1a3550" strokeOpacity={0.5} />
                    <XAxis type="number" {...AXIS} />
                    <YAxis type="category" dataKey="name" width={150} {...AXIS} />
                    <Tooltip content={<ChartTip unit=" ms" />} cursor={{ fill: 'rgba(59,226,242,0.06)' }} />
                    <Bar dataKey="ms" name="Average" fill="#3be2f2" radius={[0, 4, 4, 0]} maxBarSize={18}>
                      <LabelList dataKey="ms" position="right" fill="#dce8f3" fontSize={12} fontFamily="JetBrains Mono" formatter={(v) => `${v} ms`} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {on.avg_ms_per_request != null && <p className="dim res-note">End-to-end time includes the LLM and any rate-limit retries; guard time is the cost of the checks themselves.</p>}
          </section>

          <section>
            <h3 className="res-h">This session</h3>
            <div className="tiles">
              <Tile n={session.requests} label="requests inspected" />
              <Tile n={session.stopped} label="checks stopped or paused" tone="magenta" />
              <Tile n={c.approvals.length} label="pending approvals" tone="amber" />
              <Tile n={c.incidents.length} label="incidents logged" />
            </div>
            <div className="session-charts">
              <div>
                <div className="res-sub">Guard checks per minute</div>
                {!session.trend.length ? <p className="empty">No activity in this browser session yet. Run a scenario on the Mission tab.</p> : (
                  <>
                    <div className="legend">
                      <span><i style={{ background: '#4ce38c' }} />Allowed</span>
                      <span><i style={{ background: '#ff3d7a' }} />Stopped</span>
                      <span><i style={{ background: '#f6b520' }} />Paused</span>
                    </div>
                    <div className="chart" style={{ height: 170 }}>
                      <ResponsiveContainer>
                        <BarChart data={session.trend} margin={{ top: 6, right: 8, bottom: 0, left: -18 }} barCategoryGap="30%">
                          <CartesianGrid vertical={false} stroke="#1a3550" strokeOpacity={0.5} />
                          <XAxis dataKey="minute" {...AXIS} />
                          <YAxis allowDecimals={false} {...AXIS} />
                          <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(59,226,242,0.06)' }} />
                          <Bar dataKey="allowed" name="Allowed" stackId="a" fill="#4ce38c" stroke="#0a1b2d" strokeWidth={2} />
                          <Bar dataKey="stopped" name="Stopped" stackId="a" fill="#ff3d7a" stroke="#0a1b2d" strokeWidth={2} />
                          <Bar dataKey="paused" name="Paused" stackId="a" fill="#f6b520" stroke="#0a1b2d" strokeWidth={2} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
              </div>
              <div>
                <div className="res-sub">Incidents by risk</div>
                <div className="bands">
                  {session.bands.map((b) => {
                    const max = Math.max(1, ...session.bands.map((x) => x.n));
                    return (
                      <div key={b.band} className="band" title={`${b.band}: ${b.n}`}>
                        <span className="band-l">{b.band}</span>
                        <span className="band-bar"><span style={{ width: `${(b.n / max) * 100}%`, background: b.fill }} /></span>
                        <span className="mono band-n">{b.n}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </Panel>
      </div>

      <div className="cx-col right">
        <Panel title="What got through" meta={run ? `${gotThrough.length} with guard ON` : null}>
          {!run ? <p className="empty">No run yet. Press Run suite on the Test Lab tab.</p> : !gotThrough.length ? <p className="empty">No attack succeeded with the guard ON in the last run.</p> : gotThrough.map((x) => (
            <div key={x.id} className="ev"><div className="id">{x.id} · {x.enforce.tools.join(' ') || 'reply'}</div><div className="tx">{x.title}: {x.enforce.effect}</div></div>
          ))}
        </Panel>
        <Panel title="False positives" meta={run ? `${fps.length} of ${on.legit?.valid ?? 0}` : null}>
          {!run ? <p className="empty">No run yet. Press Run suite on the Test Lab tab.</p> : (
            <>
              {!fps.length && <p className="empty">No legit task was blocked or left unfinished.</p>}
              {fps.map((x) => (
                <div key={x.id} className="ev amber"><div className="id">{x.id} · {x.enforce?.blocked ? 'blocked' : 'not completed'}</div><div className="tx">{x.title}</div><div className="dim">{(x.enforce?.rules || []).join(', ')}</div></div>
              ))}
              {redacted.length > 0 && <p className="dim res-note">Redacted by policy but completed (not false positives): {redacted.map((x) => x.id).join(', ')}</p>}
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Cell({ r }) {
  if (!r) return <span className="dim">—</span>;
  if (r.error) return <span className="cell err" title={r.error}>ERROR</span>;
  return r.achieved ? <span className="cell worked" title={r.effect}>✕ WORKED</span> : <span className="cell stopped">✓ STOPPED</span>;
}

function Tile({ n, label, tone = 'cyan' }) {
  return <div className="tile"><span className={`tile-n ${tone}`}>{n}</span><span className="tile-l">{label}</span></div>;
}
