// POLICY tab (design/spec.md §4.7): what the guard enforces, read as tables,
// plus a JSON editor with live server-side validation and an admin-only save.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { updatePolicy, validatePolicy } from '../../api.js';
import { useConsole } from '../store.jsx';
import { Panel, ConfirmButton } from '../ui.jsx';
import { TOOLS } from '../format.js';
import './policy.css';

const SECTIONS = [
  ['roles', 'Roles & tools'], ['scopes', 'Data scopes'], ['limits', 'Limits & flags'], ['approvals', 'Approvals'],
  ['egress', 'Egress allowlist'], ['redaction', 'Redaction'], ['classification', 'Document classification'], ['thresholds', 'Thresholds'],
];

export default function Policy() {
  const c = useConsole();
  const policy = c.policy;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [check, setCheck] = useState(null); // { parseError } | { valid, problems }
  const [saveMsg, setSaveMsg] = useState(null); // { ok, text }
  const centre = useRef(null);

  useEffect(() => { c.refreshPolicy(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // live validation while editing (debounced)
  useEffect(() => {
    if (!editing) return undefined;
    const t = setTimeout(async () => {
      let parsed;
      try { parsed = JSON.parse(draft); } catch (e) { setCheck({ parseError: e.message }); return; }
      try { setCheck(await validatePolicy(parsed)); } catch (e) { setCheck({ parseError: e.message }); }
    }, 400);
    return () => clearTimeout(t);
  }, [draft, editing]);

  const startEdit = () => { setDraft(JSON.stringify(policy, null, 2)); setSaveMsg(null); setEditing(true); };
  const save = async () => {
    try {
      const saved = await updatePolicy(JSON.parse(draft), c.user.id);
      c.setPolicy(saved);
      setEditing(false);
      setSaveMsg({ ok: true, text: `Saved as ${c.user.id}. The guard uses the new policy from the next check.` });
    } catch (e) {
      setSaveMsg({ ok: false, text: e.message });
    }
  };
  const jump = (id) => centre.current?.querySelector(`#pol-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const changed = editing && policy && draft !== JSON.stringify(policy, null, 2);

  return (
    <div className="cx-body">
      <div className="cx-col">
        <Panel className="fill" title="Sections">
          <nav className="pol-nav">
            {SECTIONS.map(([id, label], i) => (
              <button key={id} type="button" className="row" onClick={() => { if (editing) setEditing(false); setTimeout(() => jump(id), 0); }}>
                <div className="l1"><span className="rid">{String(i + 1).padStart(2, '0')}</span><span className="rtype">{label}</span></div>
              </button>
            ))}
          </nav>
          <p className="dim pol-note">The guard reads <span className="mono">server/data/policy.json</span> on every check. Roles always come from the server's user list, never from chat.</p>
        </Panel>
      </div>

      <div className="cx-col">
        <Panel className="fill" title={editing ? 'policy.json' : 'Policy'} titleClass="cyan"
          actions={editing ? <span className="chip c-approval">EDITING</span> : <button type="button" className="btn sm" onClick={startEdit} disabled={!policy}>Edit JSON</button>}>
          <div ref={centre} className="pol-centre">
            {!policy ? <p className="empty">Loading policy…</p> : editing ? (
              <Editor value={draft} onChange={setDraft} problems={check?.problems} />
            ) : <ReadView p={policy} />}
          </div>
        </Panel>
      </div>

      <div className="cx-col right">
        <Panel className="fill" title={editing ? 'Changes' : 'Editing'}>
          {editing ? (
            <div className="pol-changes">
              {!check ? <p className="dim">Checking…</p> : check.parseError ? (
                <div className="ev"><div className="id">Not valid JSON</div><div className="tx">{check.parseError}</div></div>
              ) : check.valid ? (
                <div className="ev green"><div className="id">Valid</div><div className="tx">The server accepts this policy.</div></div>
              ) : (
                <div className="ev"><div className="id">{check.problems.length} problem{check.problems.length === 1 ? '' : 's'}</div>
                  <ul className="pol-problems">{check.problems.map((pr) => <li key={pr}>{pr}</li>)}</ul></div>
              )}
              <p className="dim">{changed ? 'You have unsaved changes.' : 'No changes yet.'}</p>
              <p className="dim">Saving as <b className="cyan">{c.user.id}</b> ({c.user.role}).{c.user.role !== 'admin' && <span className="amber"> Only an admin may save; the server will refuse.</span>}</p>
              <button type="button" className="cta" disabled={!changed || !check?.valid} onClick={save}>Save policy</button>
              <ConfirmButton className="btn" label="Discard" question="Discard your edits?" confirmLabel="Discard" danger
                onConfirm={() => { setEditing(false); setCheck(null); }} />
              {saveMsg && !saveMsg.ok && <div className="ev"><div className="id">Not saved</div><div className="tx">{saveMsg.text}</div></div>}
            </div>
          ) : (
            <div className="pol-changes">
              {saveMsg?.ok && <div className="ev green"><div className="id">Saved</div><div className="tx">{saveMsg.text}</div></div>}
              <p>Use <b>Edit JSON</b> to change the policy. Every edit is checked by the server before it can be saved.</p>
              <p className="dim">Only an admin can save (the acting user in the top bar). Editing can be switched off entirely with <span className="mono">ALLOW_POLICY_EDIT=false</span>.</p>
              <p className="dim">Changes apply to the next guard check. <b>Reset</b> in the top bar restores the original policy.</p>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Editor({ value, onChange, problems = [] }) {
  const lines = value.split('\n').length;
  const gutter = useRef(null);
  return (
    <div className="pol-editor">
      <pre ref={gutter} className="pol-gutter" aria-hidden="true">{Array.from({ length: lines }, (_, i) => i + 1).join('\n')}</pre>
      <textarea className="pol-text" value={value} spellCheck={false} aria-label="Policy JSON" aria-invalid={problems?.length > 0}
        onChange={(e) => onChange(e.target.value)} onScroll={(e) => { if (gutter.current) gutter.current.scrollTop = e.target.scrollTop; }} />
    </div>
  );
}

function H({ id, children }) {
  return <h3 id={`pol-${id}`} className="pol-h">{children}</h3>;
}

function ReadView({ p }) {
  const roles = Object.entries(p.roles || {});
  const types = useMemo(() => [...new Set(roles.flatMap(([, r]) => Object.keys(r.data || {})))], [roles]);
  return (
    <div className="pol-read">
      <H id="roles">Roles & tools</H>
      <div className="pol-scroll">
        <table className="pol-table matrix-tools">
          <thead><tr><th>Role</th>{TOOLS.map((t) => <th key={t} title={t}>{t.replace('_', ' ')}</th>)}</tr></thead>
          <tbody>
            {roles.map(([name, r]) => (
              <tr key={name}>
                <td className="mono">{name}</td>
                {TOOLS.map((t) => {
                  const ok = (r.tools || []).includes('*') || (r.tools || []).includes(t);
                  return <td key={t} className={ok ? 'yes' : 'no'} aria-label={ok ? 'allowed' : 'not allowed'}>{ok ? '✓' : '✕'}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H id="scopes">Data scopes</H>
      <table className="pol-table">
        <thead><tr><th>Role</th>{types.map((t) => <th key={t}>{t}</th>)}</tr></thead>
        <tbody>
          {roles.map(([name, r]) => (
            <tr key={name}><td className="mono">{name}</td>
              {types.map((t) => {
                const f = r.data?.[t];
                return <td key={t} className="fields">{!f ? <span className="dim">no access</span> : f.includes('*') ? <span className="green">all fields</span> : f.join(', ')}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <H id="limits">Limits & flags</H>
      <table className="pol-table">
        <tbody>
          {roles.map(([name, r]) => {
            const items = [
              ...Object.entries(r.limits || {}).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`),
              r.docs_max_classification && `documents up to ${r.docs_max_classification}`,
              r.email_internal_only && 'email @nimbusretail.in only',
            ].filter(Boolean);
            return <tr key={name}><td className="mono">{name}</td><td>{items.length ? items.join(' · ') : <span className="dim">no limits</span>}</td></tr>;
          })}
        </tbody>
      </table>

      <H id="approvals">Approvals</H>
      {(p.approval_required || []).map((r) => (
        <div key={r.tool} className="ev amber"><div className="id">{r.tool}</div><div className="tx">{r.when ? `needs sign-off when ${r.when}` : 'always needs sign-off'}</div></div>
      ))}

      <H id="egress">Egress allowlist</H>
      <div className="pol-kv"><span className="dim">Email domains</span><span className="pol-chips">{(p.egress?.email_domains_allowed || []).map((d) => <span key={d} className="chip c-redact">{d}</span>)}</span></div>
      <div className="pol-kv"><span className="dim">URL domains</span><span className="pol-chips">{(p.egress?.url_domains_allowed || []).map((d) => <span key={d} className="chip c-redact">{d}</span>)}</span></div>
      <p className="dim pol-note">Enforced by the egress layer, which is not built yet; interns' internal-only email is enforced by the firewall today.</p>

      <H id="redaction">Redaction</H>
      <table className="pol-table">
        <tbody>
          {Object.entries(p.redaction?.roles || {}).map(([role, list]) => (
            <tr key={role}><td className="mono">{role}</td><td>{list.length ? list.map((x) => <span key={x} className="chip pol-chip">{x}</span>) : <span className="dim">nothing redacted</span>}</td></tr>
          ))}
        </tbody>
      </table>
      {p.redaction?.mask && <p className="dim pol-note">Replaced with <span className="mono">{p.redaction.mask}</span>.</p>}

      <H id="classification">Document classification</H>
      <table className="pol-table">
        <tbody>
          {Object.entries(p.document_classification || {}).map(([doc, cls]) => (
            <tr key={doc}><td className="mono">{doc}</td><td><span className={`chip cls-${cls}`}>{cls}</span></td></tr>
          ))}
        </tbody>
      </table>
      {p.classification_order && <p className="dim pol-note">Order: {p.classification_order.join(' < ')}</p>}

      <H id="thresholds">Thresholds</H>
      <table className="pol-table">
        <tbody>
          {Object.entries(p.thresholds || {}).map(([k, v]) => <tr key={k}><td className="mono">{k}</td><td className="mono">{Array.isArray(v) ? v.join(' – ') : String(v)}</td></tr>)}
        </tbody>
      </table>
      <p className="dim pol-note">Scanner risk: below warn is allowed, warn to block goes to the classifier, block and above is blocked.</p>
    </div>
  );
}
