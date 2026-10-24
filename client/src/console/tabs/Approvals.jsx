// APPROVALS tab (design/spec.md §4.4): pending sign-offs with a countdown to
// auto-reject, the proposed action in full, and approve / reject with confirm.
import React, { useEffect, useMemo, useState } from 'react';
import { useConsole } from '../store.jsx';
import { Panel, KV, ConfirmButton } from '../ui.jsx';
import { argsSummary, riskClass, rupees, timeIST } from '../format.js';
import Conversation from '../Conversation.jsx';
import './approvals.css';

const TOOL_LABEL = { issue_refund: 'Refund', delete_record: 'Delete record', export_data: 'Export data' };
const toolLabel = (t) => TOOL_LABEL[t] || t;

function actionText(a) {
  const x = a.args || {};
  if (a.tool === 'issue_refund') return `refund of ${rupees(x.amount)} for order ${x.order_id}`;
  if (a.tool === 'delete_record') return `deleting ${x.type || 'record'} ${x.id || ''}`.trim();
  if (a.tool === 'export_data') return `exporting ${x.type || 'data'}${x.format ? ` as ${x.format}` : ''}`;
  return `${a.tool} ${argsSummary(x)}`;
}

function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  return now;
}

// Raw agent result stored on a resolved approval -> the shape the chat view reads.
const STEP_STATUS = { ALLOW: 'completed', REDACT: 'completed', BLOCK: 'blocked', NEEDS_APPROVAL: 'pending_approval', REJECTED: 'rejected' };
function normalise(r) {
  if (!r) return null;
  const steps = (r.steps || []).map((s) => ({ ...s, action: s.action || s.tool, status: s.status || STEP_STATUS[s.outcome] || 'completed' }));
  const blocked = (r.decisions || []).some((d) => d.outcome === 'BLOCK');
  return { ...r, steps, verdict: r.verdict || (blocked ? 'blocked' : 'allowed'), layer_stopped_at: r.layer_stopped_at || (r.decisions || []).find((d) => d.outcome === 'BLOCK')?.layer };
}

const left = (a, now) => Math.max(0, Math.round((Date.parse(a.expires_at) - now) / 1000));
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const decidedText = (a) => (a.resolved_by === 'system' || a.decided_by === 'system'
  ? `${a.status} by system${a.decision_reason ? ` (${a.decision_reason})` : ''}` : `${a.status} by ${a.resolved_by || a.decided_by}`);

export default function Approvals() {
  const c = useConsole();
  const now = useNow();
  const [selected, setSelected] = useState(null);
  const all = useMemo(() => [...c.approvals, ...c.resolved], [c.approvals, c.resolved]);
  const a = all.find((x) => x.id === selected) || null;

  useEffect(() => { c.refreshApprovals(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!a) setSelected(c.approvals[0]?.id || c.resolved[0]?.id || null);
  }, [a, c.approvals, c.resolved]);

  const ruleFor = (x) => (c.policy?.approval_required || []).find((r) => r.tool === x.tool);
  const res = a && (c.approvalResults[a.id] || (a.result ? { result: normalise(a.result) } : null));

  return (
    <div className="cx-body">
      <div className="cx-col">
        <Panel className="fill" title="Pending sign-off" meta={`${c.approvals.length} pending`}>
          {!c.approvals.length && <p className="empty">Nothing is waiting. Run scenario 5 on the Mission tab to create one.</p>}
          <div className="rows">
            {c.approvals.map((x) => {
              const s = left(x, now);
              return (
                <button key={x.id} type="button" className="row" aria-current={x.id === selected} onClick={() => setSelected(x.id)}>
                  <div className="l1">
                    <span className="rid">{x.id}</span>
                    <span className="rtype">{toolLabel(x.tool)}</span>
                    {x.args?.amount != null && <span className="rval amber">{rupees(x.args.amount)}</span>}
                  </div>
                  <div className="l2">{x.requester} · risk {x.risk} · auto-reject in <span className={s < 60 ? 'magenta' : 'amber'}>{mmss(s)}</span></div>
                </button>
              );
            })}
          </div>
          {c.resolved.length > 0 && (
            <>
              <div className="appr-sub">Resolved</div>
              <div className="rows">
                {c.resolved.map((x) => (
                  <button key={x.id} type="button" className="row resolved" aria-current={x.id === selected} onClick={() => setSelected(x.id)}>
                    <div className="l1">
                      <span className="rid">{x.id}</span>
                      <span className="rtype">{toolLabel(x.tool)}</span>
                      <span className={`rval ${x.status === 'approved' ? 'green' : 'magenta'}`}>{x.status}</span>
                    </div>
                    <div className="l2">{decidedText(x)} · {timeIST(x.resolved_at || x.decided_at)}</div>
                  </button>
                ))}
              </div>
            </>
          )}
        </Panel>
      </div>

      <div className="cx-col">
        <Panel className="fill" title="Proposed action" titleClass="cyan" meta={a ? `${a.id} · ${a.status}` : null}>
          {!a ? <p className="empty">Select a request on the left.</p> : (
            <div className="appr-main">
              <div className="appr-hero">
                <span className="appr-tool mono">{a.tool}</span>
                <h1 className="appr-what">{actionText(a)}</h1>
                <p className="dim">Requested by <b className="cyan">{a.requester}</b> ({a.role}) at {timeIST(a.created_at || a.created)} IST</p>
              </div>
              <div className="appr-h">Exact arguments</div>
              <table className="kv args">
                <tbody>{Object.entries(a.args || {}).map(([k, v]) => (
                  <tr key={k}><td>{k}</td><td><pre>{typeof v === 'object' ? JSON.stringify(v, null, 2) : k === 'amount' ? `${v}  (${rupees(v)})` : String(v)}</pre></td></tr>
                ))}</tbody>
              </table>
              <div className="ev amber">
                <div className="id">{(a.rule_ids || []).join(', ') || 'approval rule'}{ruleFor(a) ? ` · ${ruleFor(a).tool}${ruleFor(a).when ? ` when ${ruleFor(a).when}` : ' always'}` : ''}</div>
                <div className="tx">{a.reason}</div>
              </div>
              {a.status !== 'pending' && (
                <>
                  <div className="appr-h">After the decision</div>
                  {res?.result ? (
                    <Conversation messages={[{ id: 'r', role: 'assistant', ts: a.resolved_at || a.decided_at, text: res.result.reply, decisions: res.result.decisions, steps: res.result.steps, verdict: res.result.verdict, layer_stopped_at: res.result.layer_stopped_at, requestId: res.result.request_id }]} />
                  ) : (
                    <p className="empty">{decidedText(a)}. The assistant's answer after this decision is shown where it was made (Mission tab or the deciding browser).</p>
                  )}
                  {res?.result?.decisions?.some((d) => (d.rule_ids || []).includes('APR-REJECTED')) && (
                    <div className="ev"><div className="id">APR-REJECTED</div><div className="tx">The assistant tried the same tool again after the rejection; it was blocked without asking again.</div></div>
                  )}
                </>
              )}
            </div>
          )}
        </Panel>
      </div>

      <div className="cx-col right">
        <Panel className="fill" title="Decision">
          {!a ? <p className="empty">No request selected.</p> : a.status === 'pending' ? (
            <div className="appr-decide">
              <p>Reviewing as <b className="cyan">{c.user.name}</b> ({c.user.role}).</p>
              <ConfirmButton className="cta" label="Approve" question={`Approve ${actionText(a)}?`} confirmLabel="Approve"
                onConfirm={() => c.decideApproval(a.id, 'approve')} />
              <ConfirmButton className="btn danger appr-reject" label="Reject" question={`Reject ${actionText(a)}?`} confirmLabel="Reject" danger
                onConfirm={() => c.decideApproval(a.id, 'reject')} />
              <p className="dim appr-hint">Pending actions are rejected automatically after 5 minutes. This one in <span className={left(a, now) < 60 ? 'magenta' : 'amber'}>{mmss(left(a, now))}</span>.</p>
              <KV rows={[['Risk', <span key="r" className={riskClass(a.risk)}>{a.risk}</span>], ['Session', a.session], ['Expires', `${timeIST(a.expires_at)} IST`]]} />
            </div>
          ) : (
            <div className="appr-decide">
              <div className={`appr-verdict ${a.status === 'approved' ? 'green' : 'magenta'}`}>{a.status.toUpperCase()}</div>
              <KV rows={[['Decided by', a.resolved_by || a.decided_by], ['At', `${timeIST(a.resolved_at || a.decided_at)} IST`], ['Reason', a.decision_reason]]} />
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
