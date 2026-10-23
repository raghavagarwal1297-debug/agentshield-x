import React, { useState } from 'react';
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Terminal,
  DollarSign,
  Trash2,
  FileDown,
  UserCheck,
  Code2,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import ScrollReveal from './motion/ScrollReveal.jsx';

export default function ApprovalsTab({
  approvals = [],
  onResolveApproval,
  currentRole
}) {
  const [resolvingId, setResolvingId] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [showRawJson, setShowRawJson] = useState({});

  const handleTriggerAction = (appr, decision) => {
    setConfirmModal({
      id: appr.id,
      decision,
      tool: appr.tool,
      requester: appr.requester,
      reason: appr.reason,
      args: appr.args
    });
  };

  const handleConfirmDecision = async () => {
    if (!confirmModal) return;
    const { id, decision } = confirmModal;
    setResolvingId(id);
    setConfirmModal(null);
    try {
      await onResolveApproval(id, decision);
    } finally {
      setResolvingId(null);
    }
  };

  const toggleRaw = (id) => {
    setShowRawJson((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getToolMeta = (tool) => {
    switch (tool) {
      case 'issue_refund':
        return { label: 'Issue Financial Refund', Icon: DollarSign, color: 'text-[#F5B942] bg-[#F5B942]/10 border-[#F5B942]/30' };
      case 'delete_record':
        return { label: 'Delete Database Record', Icon: Trash2, color: 'text-[#FF496B] bg-[#FF496B]/10 border-[#FF496B]/30' };
      case 'export_data':
        return { label: 'Bulk Data Exfiltration/Export', Icon: FileDown, color: 'text-[#46E6D5] bg-[#46E6D5]/10 border-[#46E6D5]/30' };
      default:
        return { label: tool, Icon: Terminal, color: 'text-[#46E6D5] bg-[#46E6D5]/10 border-[#46E6D5]/30' };
    }
  };

  const pendingList = approvals.filter((a) => a.status === 'pending');

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 select-none font-sans">
      {/* ── Header ── */}
      <div
        className="p-5 rounded-xl flex flex-wrap items-center justify-between gap-4 border"
        style={{
          background: '#0D121A',
          borderColor: '#1C2736'
        }}
      >
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <span className="p-2 rounded-lg bg-[#F5B942]/15 border border-[#F5B942]/30 text-[#F5B942]">
              <Clock className="w-5 h-5" />
            </span>
            <h2 className="text-xl lg:text-2xl font-outfit font-bold text-white tracking-tight">
              Human-in-the-Loop Review Desk (L3 Guardrail)
            </h2>
          </div>
          <p className="text-sm text-[#94A3B8] max-w-2xl leading-relaxed mt-1">
            High-risk and irreversible tool calls are intercepted before model execution. Review proposed payload parameters, evaluate risk score, and authorize or reject.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="px-4 py-2.5 rounded-lg bg-[#0E141E] border border-[#1C2736] text-center">
            <span className="text-xs text-[#94A3B8] block font-medium">PENDING REVIEW</span>
            <span className="text-xl font-outfit font-bold text-[#F5B942]">
              {pendingList.length}
            </span>
          </div>
          <div className="px-4 py-2.5 rounded-lg bg-[#0E141E] border border-[#1C2736] text-center">
            <span className="text-xs text-[#94A3B8] block font-medium">AUTO-TIMEOUT</span>
            <span className="text-xs font-semibold text-slate-100">5 MIN FAIL-CLOSED</span>
          </div>
        </div>
      </div>

      {/* ── Approval Dockets ── */}
      <div className="space-y-4">
        {approvals.length === 0 ? (
          <div className="p-12 rounded-xl text-center border bg-[#0D121A] border-[#1C2736]">
            <CheckCircle className="w-12 h-12 text-[#C7FF4D] mx-auto mb-3 opacity-80" />
            <h4 className="text-lg font-outfit font-semibold text-white mb-1">
              All Escalations Resolved
            </h4>
            <p className="text-sm text-[#94A3B8] max-w-md mx-auto font-sans leading-relaxed">
              No pending high-risk tool operations awaiting human review. Launch Scenario #5 (Refund ₹75,000) to populate an escalation card.
            </p>
          </div>
        ) : (
          approvals.map((appr) => {
            const isPending = appr.status === 'pending';
            const isProcessing = resolvingId === appr.id;
            const meta = getToolMeta(appr.tool);
            const isRaw = showRawJson[appr.id];

            return (
              <ScrollReveal key={appr.id} direction="up" delay={40}>
                <div
                  className="p-5 rounded-xl border transition-all space-y-4"
                  style={{
                    background: isPending ? '#0E141E' : '#080B10',
                    borderColor: isPending ? 'rgba(245, 185, 66, 0.45)' : '#1C2736',
                    boxShadow: isPending ? '0 8px 30px -4px rgba(245, 185, 66, 0.08)' : 'none'
                  }}
                >
                  {/* ── STAGE 1: Request Overview ── */}
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-3.5 border-b border-[#1C2736]">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-lg border ${meta.color}`}>
                        <meta.Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#111925] text-[#94A3B8] border border-[#1C2736]">
                            STAGE 1 // OVERVIEW
                          </span>
                          <span className="font-outfit font-bold text-white text-base">
                            {meta.label}
                          </span>
                          <span className="font-mono text-xs text-[#46E6D5] bg-[#46E6D5]/10 px-2 py-0.5 rounded border border-[#46E6D5]/25">
                            {appr.id}
                          </span>
                          <span
                            className={`text-xs font-mono font-bold px-2 py-0.5 rounded uppercase ${
                              isPending
                                ? 'bg-[#F5B942]/15 text-[#F5B942] border border-[#F5B942]/30'
                                : appr.status === 'approved'
                                ? 'bg-[#C7FF4D]/15 text-[#C7FF4D] border border-[#C7FF4D]/30'
                                : 'bg-[#FF496B]/15 text-[#FF496B] border border-[#FF496B]/30'
                            }`}
                          >
                            {appr.status}
                          </span>
                        </div>
                        <p className="text-xs text-[#94A3B8] mt-1 font-sans">
                          Initiated by <strong className="text-slate-100">{appr.requester}</strong> (role: {appr.role}) · Emitted at {new Date(appr.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#080B10] border border-[#1C2736] text-xs font-mono">
                      <span className="text-[#94A3B8] text-xs">RISK INDEX:</span>
                      <span className="font-bold text-[#F5B942] text-sm">{appr.risk}/100</span>
                    </div>
                  </div>

                  {/* ── STAGE 2: Guardrail Policy Violation ── */}
                  <div className="p-3.5 rounded-lg border text-sm text-slate-100 leading-relaxed bg-[#F5B942]/5 border-[#F5B942]/25 flex items-start gap-3">
                    <div className="p-1.5 rounded bg-[#F5B942]/15 border border-[#F5B942]/30 shrink-0 mt-0.5">
                      <AlertTriangle className="w-4 h-4 text-[#F5B942]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#080B10] text-[#F5B942] border border-[#F5B942]/40 font-bold uppercase">
                          STAGE 2 // INTERCEPTION REASON
                        </span>
                        <span className="font-outfit font-semibold text-[#F5B942] text-sm">
                          L3 Human Sign-Off Mandatory
                        </span>
                      </div>
                      <p className="text-slate-200 font-sans text-sm leading-relaxed">
                        {appr.reason}
                      </p>
                    </div>
                  </div>

                  {/* ── STAGE 3: Proposed Dispatch Parameters ── */}
                  <div className="p-4 rounded-lg border bg-[#080B10] border-[#1C2736] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#111925] text-[#94A3B8] border border-[#1C2736]">
                          STAGE 3 // PARAMETERS
                        </span>
                        <span className="text-sm font-outfit font-semibold text-slate-100">
                          Proposed Action Execution Arguments
                        </span>
                      </div>
                      <button
                        onClick={() => toggleRaw(appr.id)}
                        className="text-xs text-[#46E6D5] hover:underline font-mono flex items-center gap-1.5 cursor-pointer"
                      >
                        <Code2 className="w-3.5 h-3.5" />
                        {isRaw ? 'Show Formatted View' : 'View Raw JSON'}
                      </button>
                    </div>

                    {isRaw ? (
                      <pre className="text-slate-200 font-mono text-xs p-3.5 rounded-lg bg-[#05080D] border border-[#1C2736] whitespace-pre-wrap leading-relaxed">
                        {JSON.stringify(appr.args, null, 2)}
                      </pre>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                        {Object.entries(appr.args || {}).map(([key, val]) => (
                          <div
                            key={key}
                            className="p-3 rounded-lg bg-[#0E141E] border border-[#1C2736]"
                          >
                            <span className="text-xs text-[#94A3B8] font-sans uppercase font-medium block mb-1">
                              {key.replace(/_/g, ' ')}:
                            </span>
                            <span className="text-sm font-semibold text-white font-mono break-all">
                              {typeof val === 'number' ? `₹${val.toLocaleString()}` : String(val)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ── STAGE 4: Decision Controls ── */}
                  {isPending ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3.5 border-t border-[#1C2736]">
                      <div className="flex items-center gap-2 text-xs text-[#94A3B8] font-sans">
                        <span className="text-xs px-2 py-0.5 rounded bg-[#111925] text-[#94A3B8] border border-[#1C2736] font-mono">
                          STAGE 4 // DECISION
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-[#F5B942]">
                          <Clock className="w-3.5 h-3.5" />
                          Fail-closed lock active (5m timeout)
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleTriggerAction(appr, 'reject')}
                          disabled={isProcessing}
                          className="px-5 py-2.5 rounded-lg text-xs font-sans font-bold text-[#FF496B] hover:text-white bg-[#FF496B]/10 hover:bg-[#FF496B]/20 border border-[#FF496B]/30 transition flex items-center gap-2 disabled:opacity-40 cursor-pointer shadow-sm"
                        >
                          <XCircle className="w-4 h-4" />
                          REJECT &amp; ABORT
                        </button>
                        <button
                          onClick={() => handleTriggerAction(appr, 'approve')}
                          disabled={isProcessing}
                          className="px-6 py-2.5 rounded-lg text-xs font-sans font-bold text-[#080B10] bg-[#C7FF4D] hover:bg-[#b8f53a] transition flex items-center gap-2 disabled:opacity-40 cursor-pointer shadow-md"
                        >
                          <CheckCircle className="w-4 h-4" />
                          APPROVE &amp; EXECUTE
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2.5 text-right text-xs text-[#94A3B8] border-t border-[#1C2736] font-sans flex items-center justify-between">
                      <span className="text-xs px-2 py-0.5 rounded bg-[#111925] text-[#C7FF4D] border border-[#1C2736] font-mono">
                        STAGE 4 // FINAL VERDICT RECORDED
                      </span>
                      <span>
                        RESOLVED BY: <strong className="text-white">{appr.resolved_by || 'Admin'}</strong> · {new Date(appr.resolved_at || Date.now()).toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                </div>
              </ScrollReveal>
            );
          })
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="p-6 rounded-xl border max-w-md w-full space-y-4 bg-[#0D121A] border-[#243142] shadow-2xl">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-lg ${
                  confirmModal.decision === 'approve'
                    ? 'bg-[#C7FF4D]/15 text-[#C7FF4D]'
                    : 'bg-[#FF496B]/15 text-[#FF496B]'
                }`}
              >
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-outfit font-bold text-white">
                  Confirm Security Decision
                </h3>
                <p className="text-xs text-[#91A0B3] font-mono">
                  Target: {confirmModal.tool}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-lg border text-xs text-slate-300 bg-[#080B10] border-[#1C2736] space-y-1.5 font-mono">
              <div>
                <strong className="text-slate-200">ACTION:</strong>{' '}
                <span className="uppercase font-bold text-[#46E6D5]">
                  {confirmModal.decision}
                </span>
              </div>
              <div>
                <strong className="text-slate-200">REQUESTED BY:</strong> {confirmModal.requester}
              </div>
              <div className="text-[#91A0B3] pt-1 text-[11px]">
                {confirmModal.reason}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 font-mono">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-lg text-xs text-[#91A0B3] hover:text-white hover:bg-[#111925] cursor-pointer"
              >
                CANCEL
              </button>
              <button
                onClick={handleConfirmDecision}
                className={`px-5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  confirmModal.decision === 'approve'
                    ? 'bg-[#C7FF4D] text-[#080B10] hover:bg-[#b8f53a]'
                    : 'bg-[#FF496B] text-white hover:bg-[#e03a59]'
                }`}
              >
                CONFIRM {confirmModal.decision === 'approve' ? 'APPROVAL' : 'REJECTION'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
