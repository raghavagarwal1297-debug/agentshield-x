// Terminal view of one request: a command line and a result line per guard
// decision, typed out line by line (instant when reduced motion is on).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { argsSummary, outcomeClass, outcomeLabel, prefersReducedMotion } from './format.js';

function linesFor({ decisions = [], message, reply, pendingApprovalId, error, running }) {
  const out = [];
  if (message) out.push({ cls: 'cmd', text: `ask "${message.length > 64 ? `${message.slice(0, 64)}…` : message}"` });
  for (const d of decisions) {
    const tool = d.attempted?.tool;
    const cmd = d.stage === 'input' ? 'scan user message'
      : d.stage === 'document' ? `scan ${d.source?.id || 'document'}`
        : d.stage === 'output' ? 'check final reply'
          : d.stage === 'egress' ? `egress ${tool || ''} ${argsSummary(d.attempted?.args)}`
            : d.layer === 'scanner' ? `scan output of ${tool}`
              : d.layer === 'approval' ? `approval ${tool}`
                : `firewall ${tool} ${argsSummary(d.attempted?.args)}`;
    out.push({ cls: 'cmd', text: cmd.trim() });
    const rules = d.rule_ids?.length ? ` ${d.rule_ids.join(',')}` : '';
    out.push({ cls: `out ${outcomeClass(d)}`, text: `${outcomeLabel(d)}${rules} · risk ${d.risk ?? 0}` });
    if (d.outcome !== 'ALLOW' && d.explanation) out.push({ cls: `out ${outcomeClass(d)}`, text: d.explanation.slice(0, 140) });
  }
  if (error) out.push({ cls: 'out block', text: error });
  else if (pendingApprovalId) out.push({ cls: 'wait', text: `waiting for sign-off ${pendingApprovalId}...` });
  else if (reply) out.push({ cls: 'out', text: `reply: ${reply.replace(/\s+/g, ' ').slice(0, 120)}${reply.length > 120 ? '…' : ''}` });
  else if (running) out.push({ cls: 'wait', text: 'running...' });
  return out;
}

export default function Terminal({ runKey, ...run }) {
  const lines = useMemo(() => linesFor(run), [run.decisions, run.message, run.reply, run.pendingApprovalId, run.error, run.running]); // eslint-disable-line react-hooks/exhaustive-deps
  const reduced = prefersReducedMotion();
  const [typed, setTyped] = useState({ line: 0, ch: 0 });
  const box = useRef(null);

  useEffect(() => { setTyped({ line: 0, ch: 0 }); }, [runKey]);

  useEffect(() => {
    if (reduced) return undefined;
    if (typed.line >= lines.length) return undefined;
    const len = lines[typed.line].text.length;
    const id = setTimeout(() => {
      setTyped((p) => (p.ch + 3 >= len ? { line: p.line + 1, ch: 0 } : { line: p.line, ch: p.ch + 3 }));
    }, 12);
    return () => clearTimeout(id);
  }, [typed, lines, reduced]);

  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [typed.line]);

  const visible = reduced ? lines : lines.slice(0, typed.line);
  const partial = !reduced && typed.line < lines.length ? lines[typed.line] : null;
  return (
    <div className="term" ref={box} style={{ height: '100%', overflow: 'auto' }} aria-live="polite">
      {!lines.length && <div className="wait">waiting for a request...</div>}
      {visible.map((l, i) => <div key={i} className={l.cls}>{l.text}</div>)}
      {partial && <div className={partial.cls}>{partial.text.slice(0, typed.ch)}<span className="caret" /></div>}
      {!partial && lines.length > 0 && !reduced && <span className="caret" />}
    </div>
  );
}
