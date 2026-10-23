import React, { useState } from 'react';
import {
  Activity,
  ShieldAlert,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Lock,
  Eye,
  Layers,
  Search
} from 'lucide-react';

function OutcomeTag({ outcome, wouldBlock }) {
  if (wouldBlock) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono font-bold bg-[#F5B942]/15 text-[#F5B942] border border-[#F5B942]/30">
        <AlertTriangle className="w-3.5 h-3.5 text-[#F5B942]" />
        WOULD BLOCK
      </span>
    );
  }
  switch (outcome?.toUpperCase()) {
    case 'ALLOW':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono font-bold bg-[#C7FF4D]/15 text-[#C7FF4D] border border-[#C7FF4D]/30">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#C7FF4D]" />
          ALLOWED
        </span>
      );
    case 'BLOCK':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono font-bold bg-[#FF496B]/15 text-[#FF496B] border border-[#FF496B]/30">
          <ShieldAlert className="w-3.5 h-3.5 text-[#FF496B]" />
          BLOCKED
        </span>
      );
    case 'NEEDS_APPROVAL':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono font-bold bg-[#F5B942]/15 text-[#F5B942] border border-[#F5B942]/30">
          <Clock className="w-3.5 h-3.5 text-[#F5B942]" />
          APPROVAL REQ
        </span>
      );
    case 'REDACT':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono font-bold bg-[#9587FF]/15 text-[#9587FF] border border-[#9587FF]/30">
          <Lock className="w-3.5 h-3.5 text-[#9587FF]" />
          REDACTED
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono bg-[#111925] text-[#94A3B8] border border-[#1C2736]">
          {outcome || 'EVENT'}
        </span>
      );
  }
}

function RiskMeter({ risk = 0 }) {
  const score = Math.min(100, Math.max(0, risk));
  const isHigh = score >= 70;
  const isMedium = score >= 30;
  const barColor = isHigh ? '#FF496B' : isMedium ? '#F5B942' : '#C7FF4D';

  return (
    <div className="flex items-center gap-2 font-mono text-xs">
      <div className="w-16 h-2 rounded-full overflow-hidden bg-[#080B10]">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${Math.max(5, score)}%`, background: barColor }}
        />
      </div>
      <span className="font-bold text-xs" style={{ color: barColor }}>
        {risk}
      </span>
    </div>
  );
}

export default function LiveFeed({
  events = [],
  onSelectIncident,
  guardConfig
}) {
  const [filterMode, setFilterMode] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEvents = events.filter((ev) => {
    const matchesFilter =
      filterMode === 'all' ||
      ev.outcome?.toLowerCase() === filterMode.toLowerCase() ||
      (filterMode === 'needs_approval' && ev.outcome?.toLowerCase() === 'needs_approval');

    const expText = String(ev.explanation?.reason || ev.explanation?.kya_hua || ev.explanation || '').toLowerCase();
    const matchesSearch =
      !searchQuery ||
      expText.includes(searchQuery.toLowerCase()) ||
      (ev.rule_ids || []).some((r) => r.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesFilter && matchesSearch;
  });

  return (
    <div className="flex flex-col h-full select-none" style={{ background: '#080B10' }}>
      {/* ── Feed Header ── */}
      <div
        className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2.5"
        style={{
          background: '#0D121A',
          borderColor: '#1C2736'
        }}
      >
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-[#46E6D5] beacon-pulse" />
          <h3 className="text-sm font-outfit font-bold text-white">
            Live Telemetry Stream
          </h3>
          <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-[#46E6D5]/10 text-[#46E6D5] border border-[#46E6D5]/20 font-semibold">
            {filteredEvents.length} events
          </span>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 text-xs font-sans">
          {[
            { id: 'all', label: 'All' },
            { id: 'block', label: 'Blocked' },
            { id: 'allow', label: 'Allowed' },
            { id: 'needs_approval', label: 'Approvals' },
          ].map((tab) => {
            const isSelected = filterMode === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilterMode(tab.id)}
                className={`px-2.5 py-1 rounded text-xs transition cursor-pointer font-medium ${
                  isSelected
                    ? 'bg-[#46E6D5] text-[#080B10] font-bold shadow-sm'
                    : 'text-[#94A3B8] hover:text-white bg-[#111925] border border-[#1C2736]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Search Bar ── */}
      <div className="px-3.5 py-2 border-b border-[#1C2736] bg-[#0A0F17] flex items-center gap-2.5">
        <Search className="w-4 h-4 text-[#94A3B8]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter telemetry by rule or explanation..."
          className="w-full bg-transparent text-xs text-[#F1F5F9] placeholder-[#94A3B8] focus:outline-none font-sans"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="text-xs font-mono font-medium text-[#94A3B8] hover:text-white cursor-pointer px-1.5"
          >
            CLEAR
          </button>
        )}
      </div>

      {/* ── Events List ── */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
        {filteredEvents.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#94A3B8]">
            <Layers className="w-9 h-9 text-[#243142] mb-2" />
            <p className="text-sm font-sans font-medium text-[#94A3B8]">No Telemetry Events Match Filter</p>
            <p className="text-xs text-[#64748B] mt-1 font-sans">
              Trigger a test attack in the console to observe real-time gate traces.
            </p>
          </div>
        ) : (
          filteredEvents.map((ev, idx) => {
            const isBlock = ev.outcome === 'BLOCK' || ev.would_block;
            const borderAccent =
              ev.outcome === 'BLOCK'
                ? '#FF496B'
                : ev.outcome === 'NEEDS_APPROVAL' || ev.would_block
                ? '#F5B942'
                : '#C7FF4D';

            return (
              <div
                key={ev.id || idx}
                className="p-3.5 rounded-lg border transition-all"
                style={{
                  background: isBlock ? '#13111C' : '#0E141E',
                  borderColor: '#1C2736',
                  borderLeftWidth: '3px',
                  borderLeftColor: borderAccent
                }}
              >
                {/* Top Row */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <OutcomeTag outcome={ev.outcome} wouldBlock={ev.would_block} />
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#080B10] text-[#94A3B8] border border-[#1C2736]">
                      {ev.stage || 'inspect'}
                    </span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#46E6D5]/10 text-[#46E6D5] border border-[#46E6D5]/20 font-semibold">
                      {ev.layer?.toUpperCase() || 'GATE'}
                    </span>
                  </div>
                  <RiskMeter risk={ev.risk} />
                </div>

                {/* Explanation */}
                <p className="text-sm text-[#F1F5F9] leading-relaxed mb-2.5 font-sans">
                  {ev.explanation?.kya_hua || ev.explanation?.reason || ev.explanation || 'Verification passed without warning.'}
                </p>

                {/* Rules & Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-[#1C2736] text-xs font-mono text-[#94A3B8]">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[#94A3B8] font-medium font-sans">Rules:</span>
                    {(ev.rule_ids || []).map((rid) => (
                      <span
                        key={rid}
                        className="px-2 py-0.5 rounded bg-[#080B10] text-slate-200 border border-[#1C2736] text-xs font-mono"
                      >
                        {rid}
                      </span>
                    ))}
                    {(!ev.rule_ids || ev.rule_ids.length === 0) && (
                      <span className="text-[#64748B]">None</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="text-[#94A3B8]">{new Date(ev.ts || Date.now()).toLocaleTimeString()}</span>
                    {onSelectIncident && ev.outcome === 'BLOCK' && (
                      <button
                        onClick={() => onSelectIncident(ev)}
                        className="text-[#46E6D5] hover:text-white font-semibold flex items-center gap-1 cursor-pointer font-sans text-xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Forensics
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
