import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  FileText,
  Bot,
  User,
  Terminal,
  Zap,
  ShieldAlert,
  ShieldCheck,
  Clock,
  Lock,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Play,
  Cpu,
  CheckCircle2,
  Activity,
  FileSpreadsheet,
  AlertOctagon,
  UserX,
  FileWarning,
  DollarSign,
  Globe,
  Layers
} from 'lucide-react';
import StackedScenarioDeck from './motion/StackedScenarioDeck.jsx';

function OutcomePill({ outcome, wouldBlock }) {
  if (wouldBlock) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#F5B942]/15 text-[#F5B942] border border-[#F5B942]/30">
        <AlertTriangle className="w-3 h-3 text-[#F5B942]" />
        WOULD BLOCK (AUDIT)
      </span>
    );
  }
  switch (outcome?.toUpperCase()) {
    case 'ALLOW':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#C7FF4D]/15 text-[#C7FF4D] border border-[#C7FF4D]/30">
          <CheckCircle2 className="w-3 h-3 text-[#C7FF4D]" />
          ALLOWED
        </span>
      );
    case 'BLOCK':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#FF496B]/15 text-[#FF496B] border border-[#FF496B]/30">
          <ShieldAlert className="w-3 h-3 text-[#FF496B]" />
          BLOCKED
        </span>
      );
    case 'NEEDS_APPROVAL':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#F5B942]/15 text-[#F5B942] border border-[#F5B942]/30">
          <Clock className="w-3 h-3 text-[#F5B942]" />
          NEEDS APPROVAL
        </span>
      );
    case 'REDACT':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#9587FF]/15 text-[#9587FF] border border-[#9587FF]/30">
          <Lock className="w-3 h-3 text-[#9587FF]" />
          REDACTED
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-[#111925] text-[#91A0B3] border border-[#243142]">
          {outcome || 'EVENT'}
        </span>
      );
  }
}

export default function ChatPanel({
  messages,
  onSendMessage,
  onRunScenario,
  scenarios = [],
  documents = [],
  selectedDocs,
  onToggleDoc,
  currentRole,
  guardConfig,
  isLoading,
  simStage
}) {
  const [inputText, setInputText] = useState('');
  const [activeScenarioId, setActiveScenarioId] = useState(null);
  const [expandedTools, setExpandedTools] = useState({});
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const handleScenarioClick = (sc) => {
    setActiveScenarioId(sc.id);
    onRunScenario(sc);
  };

  const toggleToolExpand = (idx) => {
    setExpandedTools((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const getScenarioIcon = (id) => {
    switch (id) {
      case 1: return FileSpreadsheet;
      case 2: return AlertOctagon;
      case 3: return UserX;
      case 4: return FileWarning;
      case 5: return DollarSign;
      case 6: return Globe;
      case 7: return Layers;
      default: return Zap;
    }
  };

  const getScenarioBadge = (sc) => {
    if (sc.expected_outcome?.includes('BLOCK')) {
      return { label: 'WILL BLOCK', color: 'bg-[#FF496B]/15 text-[#FF496B] border-[#FF496B]/30' };
    }
    if (sc.expected_outcome?.includes('APPROVAL')) {
      return { label: 'ESCALATES L3', color: 'bg-[#F5B942]/15 text-[#F5B942] border-[#F5B942]/30' };
    }
    return { label: 'CLEAN PASS', color: 'bg-[#C7FF4D]/15 text-[#C7FF4D] border-[#C7FF4D]/30' };
  };

  return (
    <div
      className="flex flex-col h-full select-none"
      style={{
        background: '#080B10',
        borderRight: '1px solid #1C2736'
      }}
    >
      {/* ── Top Dashboard Stats & Health Metrics ── */}
      <div
        className="p-3 border-b grid grid-cols-2 sm:grid-cols-4 gap-3"
        style={{
          background: '#0D121A',
          borderColor: '#1C2736'
        }}
      >
        <div className="p-2.5 rounded-lg bg-[#0E141E] border border-[#1C2736] flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-[#C7FF4D]/10 border border-[#C7FF4D]/30 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-[#C7FF4D]" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-xs text-[#94A3B8] font-sans font-medium">Defense State</span>
            <span className="text-xs font-bold text-[#C7FF4D]">ZERO INJECTION</span>
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-[#0E141E] border border-[#1C2736] flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-[#46E6D5]/10 border border-[#46E6D5]/30 flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4 text-[#46E6D5]" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-xs text-[#94A3B8] font-sans font-medium">Deterministic Gates</span>
            <span className="text-xs font-bold text-slate-100">4 ACTIVE</span>
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-[#0E141E] border border-[#1C2736] flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-[#9587FF]/10 border border-[#9587FF]/30 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 text-[#9587FF]" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-xs text-[#94A3B8] font-sans font-medium">Gate Overhead</span>
            <span className="text-xs font-bold text-slate-100 font-mono">&lt; 130 ms</span>
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-[#0E141E] border border-[#1C2736] flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-[#F5B942]/10 border border-[#F5B942]/30 flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4 text-[#F5B942]" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-xs text-[#94A3B8] font-sans font-medium">Human Sign-Off</span>
            <span className="text-xs font-bold text-[#F5B942]">L3 ENFORCED</span>
          </div>
        </div>
      </div>

      {/* ── Attack Simulation Suite (3D Stacked Scenario Deck) ── */}
      <div
        className="p-3 border-b"
        style={{
          background: '#0D121A',
          borderColor: '#1C2736'
        }}
      >
        <StackedScenarioDeck
          scenarios={scenarios}
          activeScenarioId={activeScenarioId}
          onRunScenario={handleScenarioClick}
          isLoading={isLoading}
        />
      </div>

      {/* ── Document Context Payloads ── */}
      <div
        className="px-3 py-1.5 flex items-center justify-between gap-2 border-b text-xs overflow-x-auto"
        style={{
          background: '#080B10',
          borderColor: '#1C2736'
        }}
      >
        <div className="flex items-center gap-1.5 text-[#91A0B3] shrink-0 text-xs font-mono">
          <Paperclip className="w-3.5 h-3.5 text-[#91A0B3]" />
          <span>ATTACHMENTS:</span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 font-mono">
          {documents.map((doc) => {
            const isSelected = selectedDocs.includes(doc.id);
            const hasPoison = (doc.hidden_spans || []).length > 0;
            return (
              <button
                key={doc.id}
                onClick={() => onToggleDoc(doc.id)}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs border transition cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? 'bg-[#46E6D5]/15 border-[#46E6D5]/50 text-[#46E6D5] font-medium'
                    : 'bg-[#0E141E] border-[#1C2736] text-[#91A0B3] hover:text-white'
                }`}
              >
                <FileText className="w-3 h-3" />
                <span>{doc.id}</span>
                {hasPoison && (
                  <span className="text-[9px] font-bold px-1 rounded bg-[#FF496B]/20 text-[#FF496B] border border-[#FF496B]/40">
                    UNTRUSTED
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Investigation Chat Workspace ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#91A0B3]">
            <div className="w-12 h-12 rounded-xl bg-[#46E6D5]/10 border border-[#46E6D5]/20 flex items-center justify-center mb-3">
              <Bot className="w-6 h-6 text-[#46E6D5]" />
            </div>
            <h4 className="text-sm font-outfit font-bold text-white mb-1">
              Sentinel Investigation Console Ready
            </h4>
            <p className="text-xs text-[#91A0B3] max-w-sm leading-relaxed">
              Launch one of the 7 test scenarios above or test custom directives below to evaluate guardrail behavior against prompt injections and permission checks.
            </p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={msg.id || i}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              {/* Message Header */}
              <div className="flex items-center gap-1.5 mb-1 px-1 text-xs text-[#91A0B3]">
                {msg.role === 'user' ? (
                  <>
                    <span className="font-medium text-slate-300">{msg.userName || 'Analyst'}</span>
                    <span>·</span>
                    <span className="font-mono text-[11px]">{new Date(msg.timestamp || Date.now()).toLocaleTimeString()}</span>
                    <User className="w-3.5 h-3.5 text-[#46E6D5]" />
                  </>
                ) : (
                  <>
                    <Bot className="w-3.5 h-3.5 text-[#C7FF4D]" />
                    <span className="font-semibold text-slate-200">NimbusAssist</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#C7FF4D]/10 text-[#C7FF4D] border border-[#C7FF4D]/30 font-medium">
                      AGENT
                    </span>
                    <span>·</span>
                    <span className="font-mono text-[11px]">{new Date(msg.timestamp || Date.now()).toLocaleTimeString()}</span>
                  </>
                )}
              </div>

              {/* Message Box */}
              <div
                className={`max-w-[88%] rounded-xl p-3.5 text-xs leading-relaxed border shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-[#111925] border-[#243142] text-[#EDF3F8]'
                    : 'bg-[#0E141E] border-[#1C2736] text-slate-200'
                }`}
              >
                {/* Security Verdict Banner */}
                {msg.role !== 'user' && (
                  <div className="mb-2.5 pb-2 border-b border-[#1C2736] flex items-center justify-between font-mono text-[10px]">
                    {msg.blocked || (msg.steps || []).some((s) => s.status === 'blocked') ? (
                      <span className="flex items-center gap-1.5 text-[#FF496B] font-bold">
                        <ShieldAlert className="w-3.5 h-3.5 text-[#FF496B]" />
                        GATEWAY VERDICT: THREAT INTERCEPTED &amp; EXCISED
                      </span>
                    ) : msg.approval_required || (msg.decisions || []).some((d) => d.outcome === 'NEEDS_APPROVAL') ? (
                      <span className="flex items-center gap-1.5 text-[#F5B942] font-bold">
                        <Clock className="w-3.5 h-3.5 text-[#F5B942]" />
                        GATEWAY VERDICT: L3 HUMAN SIGN-OFF REQUIRED
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-[#C7FF4D] font-bold">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#C7FF4D]" />
                        GATEWAY VERDICT: ZERO INJECTION (VERIFIED CLEAN)
                      </span>
                    )}
                    <span className="text-[#64748B]">ENFORCE v3.2</span>
                  </div>
                )}

                {/* Payloads Used */}
                {msg.doc_ids && msg.doc_ids.length > 0 && (
                  <div className="mb-2 pb-2 border-b border-[#1C2736] flex flex-wrap gap-1 font-mono">
                    <span className="text-[11px] text-[#46E6D5] font-medium self-center mr-1">
                      CONTEXT ATTACHMENTS:
                    </span>
                    {msg.doc_ids.map((docId) => (
                      <span
                        key={docId}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#080B10] border border-[#1C2736] text-slate-300"
                      >
                        <FileText className="w-2.5 h-2.5 text-[#46E6D5]" />
                        {docId}
                      </span>
                    ))}
                  </div>
                )}

                {/* Message Body */}
                <div className="whitespace-pre-wrap text-sm text-[#F1F5F9] leading-relaxed font-sans">
                  {msg.reply || msg.message}
                </div>

                {/* Technical Tool Execution Trace */}
                {msg.steps && msg.steps.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-[#1C2736] space-y-1.5 font-mono">
                    <div className="text-[11px] font-medium text-[#46E6D5] flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Terminal className="w-3 h-3 text-[#46E6D5]" />
                        TOOL EXECUTION TRACE ({msg.steps.length} ACTIONS)
                      </span>
                    </div>

                    {msg.steps.map((st, sIdx) => {
                      const isExpanded = expandedTools[sIdx];
                      return (
                        <div
                          key={sIdx}
                          className="text-xs rounded border border-[#1C2736] bg-[#080B10] overflow-hidden"
                        >
                          <div
                            onClick={() => toggleToolExpand(sIdx)}
                            className="p-2 flex items-center justify-between cursor-pointer hover:bg-[#111925] transition"
                          >
                            <span className="flex items-center gap-1.5">
                              <span className="text-[#C7FF4D] font-mono font-medium">{st.action}</span>
                              <span className="text-[#64748B] text-[10px] font-mono">
                                ({typeof st.args === 'object' ? Object.keys(st.args).join(', ') : 'args'})
                              </span>
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                                  st.status === 'blocked'
                                    ? 'bg-[#FF496B]/20 text-[#FF496B] border border-[#FF496B]/40'
                                    : 'bg-[#C7FF4D]/20 text-[#C7FF4D] border border-[#C7FF4D]/40'
                                }`}
                              >
                                {st.status?.toUpperCase()}
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="w-3 h-3 text-[#91A0B3]" />
                              ) : (
                                <ChevronDown className="w-3 h-3 text-[#91A0B3]" />
                              )}
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="p-2 border-t border-[#1C2736] bg-[#05080D] text-[11px] font-mono text-slate-300 overflow-x-auto">
                              <div className="text-[#46E6D5] text-[10px] mb-0.5">Parameters:</div>
                              <pre className="text-slate-200 whitespace-pre-wrap">
                                {JSON.stringify(st.args, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Guardrail Decisions Attached */}
                {msg.decisions && msg.decisions.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-[#1C2736] flex flex-wrap gap-1.5 items-center">
                    {msg.decisions.map((dec, dIdx) => (
                      <div key={dIdx} className="flex items-center gap-1.5">
                        <OutcomePill outcome={dec.outcome} wouldBlock={dec.would_block} />
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#080B10] text-[#91A0B3] border border-[#1C2736]">
                          GATE: {dec.layer?.toUpperCase()}
                        </span>
                        {dec.risk !== undefined && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#080B10] text-[#EDF3F8] border border-[#1C2736]">
                            RISK: {dec.risk}/100
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {/* Live Multi-Stage Defense Pipeline Progress Bar */}
        {isLoading && (
          <div className="p-3.5 rounded-xl border bg-[#0D121A] border-[#1C2736] space-y-2 font-mono animate-in fade-in duration-150">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-white font-bold">
                <Cpu className="w-4 h-4 text-[#46E6D5] animate-spin" />
                SENTINEL MULTI-STAGE DEFENSE PIPELINE ACTIVE
              </span>
              <span className="text-[10px] text-[#46E6D5] bg-[#46E6D5]/10 px-2 py-0.5 rounded border border-[#46E6D5]/20 font-bold">
                STAGE: {simStage?.toUpperCase() || 'SCANNING'}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5 pt-1 text-[10px]">
              {[
                { key: 'scanner', id: 'L1', name: 'Input Scanner', desc: 'Sanitizer' },
                { key: 'firewall', id: 'L2', name: 'Tool Firewall', desc: 'RBAC Scope' },
                { key: 'approval', id: 'L3', name: 'Sign-Off', desc: 'L3 Escalation' },
                { key: 'egress', id: 'L4', name: 'Data Egress', desc: 'DLP Scrub' }
              ].map((g) => {
                const isCur = simStage === g.key;
                return (
                  <div
                    key={g.id}
                    className={`p-2 rounded-lg border text-center transition-all ${
                      isCur
                        ? 'bg-[#46E6D5]/15 border-[#46E6D5] text-white shadow-[0_0_12px_rgba(70,230,213,0.35)] animate-pulse'
                        : 'bg-[#080B10] border-[#1C2736] text-[#64748B]'
                    }`}
                  >
                    <div className="font-bold">{g.id}</div>
                    <div className="text-[9px] truncate">{g.name}</div>
                  </div>
                );
              })}
            </div>

            <div className="text-[10px] text-[#46E6D5] pt-1 flex items-center justify-between">
              <span>
                {simStage === 'scanner' && '▶ L1: Normalizing Unicode & executing Aho-Corasick injection detector...'}
                {simStage === 'firewall' && '▶ L2: Verifying role permissions & tool execution scope under policy.json...'}
                {simStage === 'approval' && '▶ L3: Checking high-risk parameters against approval escalation threshold...'}
                {simStage === 'egress' && '▶ L4: Scanning outgoing response for Aadhaar, PAN & credentials leakage...'}
                {!simStage && '▶ Initializing Sentinel Defense Core...'}
              </span>
              <span className="text-[#64748B]">Latency &lt;130ms</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Directive Input Form ── */}
      <form
        onSubmit={handleSubmit}
        className="p-3.5 border-t"
        style={{
          background: '#0D121A',
          borderColor: '#1C2736'
        }}
      >
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-[#080B10] border border-[#1C2736] focus-within:border-[#46E6D5] transition">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Ask NimbusAssist or test a prompt as ${currentRole.name}...`}
            disabled={isLoading}
            className="flex-1 bg-transparent text-sm text-[#F1F5F9] placeholder-[#94A3B8] focus:outline-none font-sans"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="px-4 py-2 rounded-lg text-xs font-sans font-bold bg-[#C7FF4D] text-[#080B10] hover:bg-[#b8f53a] transition flex items-center gap-1.5 disabled:opacity-40 cursor-pointer shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            <span>SEND</span>
          </button>
        </div>
      </form>
    </div>
  );
}
