// Building blocks: panel with corner brackets, chips, confirm popover, key/value table.
import React, { useEffect, useRef, useState } from 'react';
import { outcomeClass, outcomeLabel } from './format.js';

export function Panel({ title, titleClass = '', meta, actions, className = '', bodyClass = '', footer, children, ...rest }) {
  return (
    <section className={`panel ${className}`} {...rest}>
      {(title || meta || actions) && (
        <div className="panel-head">
          <h2 className={`panel-title ${titleClass}`}>{title}</h2>
          {actions || (meta != null && <span className="panel-meta">{meta}</span>)}
        </div>
      )}
      <div className={`panel-body ${bodyClass}`}>{children}</div>
      {footer && <div className="panel-foot">{footer}</div>}
    </section>
  );
}

export function OutcomeChip({ d, children }) {
  return <span className={`chip c-${outcomeClass(d)}`}>{children || outcomeLabel(d)}</span>;
}

export function KV({ rows }) {
  return (
    <table className="kv">
      <tbody>
        {rows.filter(Boolean).map(([k, v]) => (
          <tr key={k}><td>{k}</td><td>{v ?? '—'}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

// Button that asks "are you sure?" in a small popover before running onConfirm.
export function ConfirmButton({ className = 'btn sm', label, question, confirmLabel = 'Confirm', danger, onConfirm, disabled, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button type="button" className={className} disabled={disabled} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {children || label}
      </button>
      {open && (
        <div className="confirm" role="dialog">
          <p>{question}</p>
          <div className="acts">
            <button type="button" className="btn sm" onClick={() => setOpen(false)}>Cancel</button>
            <button type="button" className={`btn sm ${danger ? 'danger' : ''}`} onClick={() => { setOpen(false); onConfirm(); }}>{confirmLabel}</button>
          </div>
        </div>
      )}
    </span>
  );
}

export function Drawer({ title, meta, onClose, children }) {
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="drawer-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <Panel className="drawer" title={title} titleClass="cyan"
        actions={<span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>{meta}<button type="button" className="btn sm" onClick={onClose}>Close</button></span>}>
        {children}
      </Panel>
    </div>
  );
}
