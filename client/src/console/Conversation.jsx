// Chat transcript: user messages on the right, NimbusAssist on the left with a
// verdict strip, the reply, a collapsible tool trace and the guard decisions.
import React, { useEffect, useRef, useState } from 'react';
import { OutcomeChip } from './ui.jsx';
import { LAYERS, argsSummary, timeIST } from './format.js';

const STEP_CLASS = { completed: 'c-allow', blocked: 'c-block', rejected: 'c-block', pending_approval: 'c-approval' };

// Verdict strip text + outcome class for one assistant answer.
export function verdictOf(m) {
  if (m.error) return { cls: 'block', text: m.cacheMiss ? 'NOT IN DEMO CACHE' : 'ERROR' };
  const layer = LAYERS.find((l) => l.key === m.layer_stopped_at);
  if (m.verdict === 'blocked') return { cls: 'block', text: `INTERCEPTED${layer ? ` AT ${layer.short} ${layer.label}` : ''}` };
  if (m.verdict === 'needs_approval') return { cls: 'approval', text: 'WAITING FOR SIGN-OFF' };
  const approved = (m.decisions || []).find((d) => d.layer === 'approval' && d.decided_by && d.outcome === 'ALLOW');
  if (approved) return { cls: 'allow', text: `APPROVED BY ${String(approved.decided_by).toUpperCase()}` };
  if ((m.decisions || []).some((d) => d.would_block)) return { cls: 'would', text: 'WOULD BLOCK (MONITOR)' };
  if (m.verdict === 'redacted') return { cls: 'redact', text: 'REDACTED' };
  if (m.verdict === 'unguarded') return { cls: 'off', text: 'UNGUARDED' };
  return { cls: 'allow', text: 'CLEAN' };
}

function Assistant({ m }) {
  const [open, setOpen] = useState(false);
  const v = verdictOf(m);
  const shownDecisions = (m.decisions || []).filter((d) => d.outcome !== 'ALLOW' || d.would_block);
  return (
    <div className={`msg bot v-${v.cls}`}>
      <div className="msg-meta"><span className="cyan">NimbusAssist</span> · {timeIST(m.ts)}{m.requestId && <> · <span className="mono">{m.requestId}</span></>}</div>
      <div className="msg-box">
        <div className={`verdict c-${v.cls}`}>{v.text}</div>
        <div className="msg-text">{m.text || (m.error ? m.error : '')}</div>
        {m.steps?.length > 0 && (
          <div className="trace">
            <button type="button" className="trace-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
              {open ? '▾' : '▸'} TOOL TRACE · {m.steps.length} {m.steps.length === 1 ? 'STEP' : 'STEPS'}
            </button>
            {open && m.steps.map((s, i) => (
              <div key={i} className="trace-row mono">
                <span className="cyan">{s.action}</span>
                <span className="dim trace-args">{argsSummary(s.args)}</span>
                <span className={`chip ${STEP_CLASS[s.status] || ''}`}>{String(s.status).replace('_', ' ').toUpperCase()}</span>
              </div>
            ))}
          </div>
        )}
        {shownDecisions.length > 0 && (
          <div className="msg-chips">
            {shownDecisions.map((d, i) => (
              <OutcomeChip key={i} d={d}>{`${d.would_block ? 'WOULD BLOCK' : d.outcome} · ${String(d.layer || '').toUpperCase()} · ${(d.rule_ids || []).join(',') || '—'} · ${d.risk ?? 0}`}</OutcomeChip>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Conversation({ messages, busy }) {
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [messages.length, busy]);
  if (!messages.length) return <p className="empty">No messages yet. Pick a scenario or type a request on the left.</p>;
  return (
    <div className="convo">
      {messages.map((m) => (m.role === 'user' ? (
        <div key={m.id} className="msg me">
          <div className="msg-meta">{m.user?.name} · {m.user?.role} · {timeIST(m.ts)}</div>
          <div className="msg-box">
            <div className="msg-text">{m.text}</div>
            {m.docIds?.length > 0 && <div className="msg-chips">{m.docIds.map((d) => <span key={d} className="chip">{d}</span>)}</div>}
          </div>
        </div>
      ) : <Assistant key={m.id} m={m} />))}
      {busy && <div className="msg bot"><div className="msg-box"><span className="term"><span className="wait">NimbusAssist is working…</span></span></div></div>}
      <div ref={end} />
    </div>
  );
}
