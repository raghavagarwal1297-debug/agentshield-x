// INVESTIGATE tab (design/spec.md §4.3): incidents by risk, the flow of the
// selected incident with the gate that stopped it, and its evidence card.
import React, { useEffect, useMemo, useState } from 'react';
import { Copy } from 'lucide-react';
import { getDocument, getIncidentReport } from '../../api.js';
import { useConsole } from '../store.jsx';
import { Panel, KV, Drawer } from '../ui.jsx';
import { LAYERS, OUTCOME_COLOR, USERS, outcomeClass, riskClass, timeIST } from '../format.js';
import './investigate.css';

const OWASP_NAMES = { LLM01: 'Prompt Injection', LLM02: 'Sensitive Info Disclosure', LLM06: 'Excessive Agency' };
const titleOf = (i) => i.summary?.match(/ - (.*?) \(rule/)?.[1] || i.summary || i.id;
const outcomeWord = (i) => (i.would_block ? 'would block' : i.outcome === 'NEEDS_APPROVAL' ? 'paused' : i.outcome === 'BLOCK' ? 'blocked' : i.outcome.toLowerCase());

export default function Investigate() {
  const c = useConsole();
  const [selected, setSelected] = useState(null);
  const [q, setQ] = useState('');
  const [fOutcome, setFOutcome] = useState('all');
  const [fOwasp, setFOwasp] = useState('all');
  const [fUser, setFUser] = useState('all');
  const [report, setReport] = useState(null); // { loading } | { data } | { error }

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return c.incidents
      .filter((i) => fOutcome === 'all' || outcomeWord(i) === fOutcome)
      .filter((i) => fOwasp === 'all' || (i.owasp || []).includes(fOwasp))
      .filter((i) => fUser === 'all' || i.user === fUser)
      .filter((i) => !needle || [i.id, i.user, i.attempted?.tool, i.summary, i.request_id, ...(i.rule_ids || [])]
        .some((s) => String(s || '').toLowerCase().includes(needle)))
      .sort((a, b) => (b.risk - a.risk) || String(b.ts).localeCompare(String(a.ts)));
  }, [c.incidents, q, fOutcome, fOwasp, fUser]);

  // open the incident requested from another tab (ticker, alerts, feed)
  useEffect(() => {
    if (c.focusIncident) { setSelected(c.focusIncident); c.setFocusIncident(null); }
  }, [c.focusIncident]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if ((!selected || !c.incidents.some((i) => i.id === selected)) && list[0]) setSelected(list[0].id);
  }, [list, selected, c.incidents]);

  useEffect(() => { c.refreshIncidents(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const inc = c.incidents.find((i) => i.id === selected) || null;

  const openReport = async () => {
    setReport({ loading: true });
    try { setReport({ data: (await getIncidentReport(inc.id)).report }); } catch (e) { setReport({ error: e.message }); }
  };

  return (
    <div className="cx-body">
      <div className="cx-col">
        <Panel className="fill" title="Incidents by risk" meta={`${list.length} of ${c.incidents.length}`} bodyClass="inv-list">
          <div className="inv-filters">
            <input className="input" placeholder="Search id, rule, tool, user" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search incidents" />
            <div className="inv-selects">
              <select className="cx-select" value={fOutcome} onChange={(e) => setFOutcome(e.target.value)} aria-label="Outcome">
                <option value="all">All outcomes</option><option value="blocked">Blocked</option><option value="paused">Paused</option><option value="would block">Would block</option>
              </select>
              <select className="cx-select" value={fOwasp} onChange={(e) => setFOwasp(e.target.value)} aria-label="OWASP category">
                <option value="all">All OWASP</option>{Object.keys(OWASP_NAMES).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <select className="cx-select" value={fUser} onChange={(e) => setFUser(e.target.value)} aria-label="User">
                <option value="all">All users</option>{USERS.map((u) => <option key={u.id} value={u.id}>{u.id}</option>)}
              </select>
            </div>
          </div>
          {!c.incidents.length && <p className="empty">No incidents yet. Run a scenario on the Mission tab with the guard ON.</p>}
          {c.incidents.length > 0 && !list.length && <p className="empty">Nothing matches these filters.</p>}
          <div className="rows">
            {list.map((i) => (
              <button key={i.id} type="button" className="row" aria-current={i.id === selected} onClick={() => setSelected(i.id)}>
                <div className="l1">
                  <span className="rid">{i.id}</span>
                  <span className="rtype">{titleOf(i)}</span>
                  <span className={`rval ${riskClass(i.risk)}`}>{i.risk}</span>
                </div>
                <div className="l2">
                  {i.user} · {i.attempted?.tool || i.stage} · {(i.rule_ids || []).join(',')} ·{' '}
                  <span style={{ color: OUTCOME_COLOR[outcomeClass(i)] }}>{outcomeWord(i)}</span>
                </div>
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <div className="cx-col">
        {inc ? <Flow inc={inc} events={c.events} onReport={openReport} /> : <Panel className="fill"><p className="empty">{c.incidents.length ? 'Select an incident on the left.' : 'Incidents appear when the guard blocks or pauses something. On the Mission tab, set ENFORCE and run scenario 2 or 3.'}</p></Panel>}
      </div>

      <div className="cx-col right">
        <Panel className="fill" title="Evidence">
          {inc ? <Evidence inc={inc} /> : <p className="empty">{c.incidents.length ? 'Select an incident to see its evidence.' : 'Run a scenario on the Mission tab to see evidence here.'}</p>}
        </Panel>
      </div>

      {report && (
        <Drawer title={`Case packet · ${inc?.id}`} onClose={() => setReport(null)}
          meta={report.data && <span className="chip c-block">{report.data.classification}</span>}>
          <CasePacket report={report} inc={inc} />
        </Drawer>
      )}
    </div>
  );
}

// ---------- centre: flow of one incident ----------
function Flow({ inc, events, onReport }) {
  const [replay, setReplay] = useState(0);
  const layer = LAYERS.find((l) => l.key === inc.layer);
  const docsRead = useMemo(() => [...new Set(events.filter((e) => e.request_id && e.request_id === inc.request_id && e.stage === 'document')
    .map((e) => e.source?.id).filter(Boolean))], [events, inc.request_id]);
  const src = inc.source?.type === 'document' || inc.source?.type === 'web' ? inc.source.id
    : inc.stage === 'input' ? 'user message' : docsRead[0] || inc.user;
  const target = inc.attempted?.tool || (inc.stage === 'output' ? 'reply' : inc.stage === 'input' || inc.stage === 'document' ? null : 'tool');
  const stopOnFirst = inc.stage === 'input' || inc.stage === 'document' || (inc.stage === 'tool' && inc.layer === 'scanner');
  const color = OUTCOME_COLOR[outcomeClass(inc)];
  const stopped = !inc.would_block;

  return (
    <Panel className="fill flow-panel" bodyClass="flow-body"
      actions={(
        <div className="flow-head">
          <div>
            <h1 className="flow-title">{inc.id} · {titleOf(inc)}</h1>
            <p className="flow-sub">{inc.explanation?.kya_hua}</p>
          </div>
          <div className="flow-btns">
            <button type="button" className="btn" onClick={() => setReplay((r) => r + 1)}>Replay flow</button>
            <button type="button" className="cta sm inline" onClick={onReport}>Case packet</button>
          </div>
        </div>
      )}>
      <svg key={replay} className="flow-svg" viewBox="0 0 900 300" role="img" aria-label={`Flow of ${inc.id}`}>
        <defs>
          <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#f6b520" /></marker>
        </defs>
        {[70, 120, 170].map((r) => <circle key={r} cx="450" cy="160" r={r} fill="none" stroke="#1a3550" />)}
        <path id="e1" d="M120,150 L450,160" stroke="#f6b520" strokeWidth="3" fill="none" markerEnd={stopOnFirst && stopped ? undefined : 'url(#arr)'} strokeDasharray={stopOnFirst && stopped ? '6 6' : undefined} />
        {target && <path id="e2" d="M450,160 L780,150" stroke="#f6b520" strokeWidth="3" fill="none" markerEnd="url(#arr)" strokeOpacity={stopOnFirst ? 0.25 : 1} />}
        <FlowNode x={120} y={150} label={src} sub={inc.source?.line ? `line ${inc.source.line}` : inc.stage === 'input' ? inc.user : 'source'} />
        <FlowNode x={450} y={160} label="NimbusAssist" sub={`${inc.user} · ${inc.role}`} core />
        {target && <FlowNode x={780} y={150} label={target} sub={stopped && !stopOnFirst ? 'did not run' : inc.would_block ? 'ran (monitor)' : ''} hot={stopped && !stopOnFirst} />}
        {/* gate on the stopped edge */}
        <g transform={`translate(${stopOnFirst ? 300 : 615},${stopOnFirst ? 156 : 156})`}>
          <circle r="24" fill="#0a1b2d" stroke={color} strokeWidth="2.5" strokeDasharray={inc.would_block ? '4 4' : undefined} className="gate" />
          <text y="5" textAnchor="middle" className="gate-t" fill={color}>{layer?.short || '?'}</text>
          <text y="44" textAnchor="middle" className="gate-l" fill={color}>{layer?.label} · {(inc.rule_ids || []).join(',')}</text>
        </g>
        {/* packet */}
        <circle r="7" fill={color} className="flow-packet">
          <animateMotion dur={stopOnFirst ? '1.1s' : '2s'} fill="freeze" keyPoints={stopOnFirst ? '0;0.55' : '0;1'} keyTimes="0;1" calcMode="linear"
            path={stopOnFirst ? 'M120,150 L450,160' : 'M120,150 L450,160 L615,156'} />
        </circle>
      </svg>

      <Source inc={inc} docsRead={docsRead} />
    </Panel>
  );
}

function FlowNode({ x, y, label, sub, core, hot }) {
  return (
    <g>
      <circle cx={x} cy={y} r={core ? 16 : 11} fill="#0a1b2d" stroke="#ff3d7a" strokeOpacity={hot || core ? 1 : 0.7} strokeWidth="2" />
      <circle cx={x} cy={y} r={core ? 6 : 4.5} fill={core ? '#3be2f2' : '#ff3d7a'} />
      <text x={x} y={y + 34} textAnchor="middle" className="flow-n">{label}</text>
      {sub && <text x={x} y={y + 52} textAnchor="middle" className="flow-s">{sub}</text>}
    </g>
  );
}

// Source text: the document with the flagged line highlighted, the user's
// message, or the arguments of the blocked call.
function Source({ inc, docsRead }) {
  const docId = (inc.source?.type === 'document' && inc.source.id) || null;
  const [doc, setDoc] = useState(null);
  useEffect(() => {
    let live = true;
    setDoc(null);
    if (docId) getDocument(docId).then((d) => live && setDoc(d));
    return () => { live = false; };
  }, [docId]);

  if (docId && doc) {
    const removed = new Set((inc.removed_lines || []).map((l) => (typeof l === 'object' ? l.line : l)));
    const hidden = new Set((doc.hidden_spans || []).map((h) => h.line));
    const lines = doc.content.split('\n');
    const focus = inc.source.line || [...removed][0] || [...hidden][0] || 1;
    const from = Math.max(1, focus - 4);
    return (
      <div className="src">
        <div className="src-h">{docId} · lines {from}-{Math.min(lines.length, focus + 4)}</div>
        <pre className="doc">
          {lines.slice(from - 1, focus + 4).map((l, k) => {
            const n = from + k;
            const cls = removed.has(n) ? 'doc-line removed' : n === inc.source.line || hidden.has(n) ? 'doc-line hidden' : 'doc-line';
            return <div key={n} className={cls}><span className="ln">{n}</span><span>{l || ' '}</span>{removed.has(n) ? <span className="doc-tag">removed</span> : hidden.has(n) ? <span className="doc-tag">hidden</span> : <span />}</div>;
          })}
        </pre>
      </div>
    );
  }
  if (inc.source?.excerpt) {
    return <div className="src"><div className="src-h">{inc.source.type === 'user_message' ? 'User message' : 'Excerpt'}</div><p className="src-quote">{inc.source.excerpt}</p></div>;
  }
  if (inc.attempted) {
    return (
      <div className="src">
        <div className="src-h">Blocked call · {inc.attempted.tool}{docsRead.length ? ` · documents read in this request: ${docsRead.join(', ')}` : ''}</div>
        <table className="kv args">
          <tbody>{Object.entries(inc.attempted.args || {}).map(([k, v]) => (
            <tr key={k}><td>{k}</td><td><pre>{typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v)}</pre></td></tr>
          ))}</tbody>
        </table>
      </div>
    );
  }
  return null;
}

// ---------- right: evidence card ----------
function Evidence({ inc }) {
  const badge = inc.would_block ? ['WOULD BLOCK', 'c-would'] : inc.outcome === 'NEEDS_APPROVAL' ? ['PAUSED', 'c-approval'] : [inc.outcome === 'BLOCK' ? 'BLOCKED' : inc.outcome, 'c-block'];
  const e = inc.explanation || {};
  const tone = inc.would_block ? 'violet' : inc.outcome === 'NEEDS_APPROVAL' ? 'amber' : '';
  return (
    <div className="evi">
      <div className={`evi-card ${tone}`}>
        <div className="evi-top">
          <span className="evi-id mono">{inc.id}</span>
          <span className={`chip ${badge[1]}`}>{badge[0]}</span>
          <span className={`evi-risk ${riskClass(inc.risk)}`}>{(inc.risk / 100).toFixed(2)}</span>
        </div>
        {[['What happened', e.kya_hua], ['Why', e.kyun_roka], ['Where it came from', e.kahan_se_aaya], ['What was protected', e.kya_bacha], ['Suggested fix', e.kya_karein]]
          .filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className={`ev ${tone}`}><div className="id">{k.replace(/ /g, '_')}</div><div className="tx">{v}</div></div>
          ))}
      </div>
      <KV rows={[
        ['stage', inc.stage], ['layer', inc.layer], ['mode', inc.mode], ['user', inc.user], ['role', inc.role],
        ['request_id', inc.request_id], ['session', inc.session], ['rule_ids', (inc.rule_ids || []).join(', ')],
        ['approval', inc.approval_id], ['time', `${timeIST(inc.ts)} IST`],
      ]} />
      <div className="evi-owasp">
        {(inc.owasp || []).map((o) => <span key={o} className="chip c-redact">{o} {OWASP_NAMES[o] || ''}</span>)}
      </div>
    </div>
  );
}

function CasePacket({ report, inc }) {
  const [copied, setCopied] = useState(false);
  if (report.loading) return <p className="empty">Writing the report…</p>;
  if (report.error) return <p className="empty magenta">{report.error}</p>;
  const r = report.data;
  const copy = async () => {
    try { await navigator.clipboard.writeText(`${inc.id} · ${r.classification}\n\n${r.text}\n\n${r.regulatory_impact}`); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };
  return (
    <div className="packet">
      <div className="packet-text"><Markdownish text={r.text} /></div>
      <div className="ev amber"><div className="id">Data protection</div><div className="tx">{r.regulatory_impact}</div></div>
      <div className="packet-foot">
        <span className="dim">Generated by {r.generated_by === 'llm' ? 'the judge model' : 'the template (LLM unavailable)'}</span>
        <button type="button" className="btn sm" onClick={copy}><Copy size={13} /> {copied ? 'Copied' : 'Copy'}</button>
      </div>
    </div>
  );
}

// The judge model answers in light markdown: **bold** and "- " bullets only.
function Markdownish({ text = '' }) {
  const inline = (line) => line.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith('**') && part.endsWith('**') ? <b key={i}>{part.slice(2, -2)}</b> : part));
  return text.split('\n').map((line, i) => {
    const t = line.trim();
    if (!t) return <div key={i} className="md-gap" />;
    if (/^\*\*[^*]+\*\*:?$/.test(t) || /^#+\s/.test(t)) return <div key={i} className="md-h">{t.replace(/^#+\s*/, '').replace(/\*\*/g, '')}</div>;
    if (/^[-*]\s/.test(t)) return <div key={i} className="md-li">{inline(t.slice(2))}</div>;
    return <p key={i}>{inline(t)}</p>;
  });
}
