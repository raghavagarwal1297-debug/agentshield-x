import React, { useState } from 'react';
import {
  Play,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
  Clock,
  Layers,
  FileSpreadsheet,
  AlertOctagon,
  UserX,
  FileWarning,
  DollarSign,
  Globe,
  Zap,
  ArrowRight,
  Lock
} from 'lucide-react';

export default function StackedScenarioDeck({
  scenarios = [],
  activeScenarioId,
  onRunScenario,
  isLoading
}) {
  const [activeIndex, setActiveIndex] = useState(() => {
    const idx = scenarios.findIndex((s) => s.id === activeScenarioId);
    return idx >= 0 ? idx : 0;
  });

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

  const getVerdictBadge = (sc) => {
    if (sc.expected_outcome?.includes('BLOCK')) {
      return {
        label: 'WILL BLOCK',
        color: 'text-[#FF496B] bg-[#FF496B]/15 border-[#FF496B]/30',
        icon: ShieldAlert
      };
    }
    if (sc.expected_outcome?.includes('APPROVAL')) {
      return {
        label: 'L3 SIGN-OFF',
        color: 'text-[#F5B942] bg-[#F5B942]/15 border-[#F5B942]/30',
        icon: Clock
      };
    }
    return {
      label: 'CLEAN PASS',
      color: 'text-[#C7FF4D] bg-[#C7FF4D]/15 border-[#C7FF4D]/30',
      icon: ShieldCheck
    };
  };

  const currentSc = scenarios[activeIndex] || scenarios[0];

  const handlePrev = () => {
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : scenarios.length - 1));
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev < scenarios.length - 1 ? prev + 1 : 0));
  };

  return (
    <div className="flex flex-col space-y-3 select-none">
      {/* ── Deck Header & Navigation Controls ── */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5">
          <Layers className="w-4 h-4 text-[#46E6D5]" />
          <h3 className="text-sm font-outfit font-bold text-white tracking-wide">
            3D Attack Scenario Stack
          </h3>
          <span className="text-xs font-mono text-[#94A3B8]">
            [{activeIndex + 1}/{scenarios.length}]
          </span>
        </div>

        {/* Previous / Next Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            className="p-1.5 rounded-md bg-[#111925] border border-[#1C2736] text-[#94A3B8] hover:text-white hover:border-[#46E6D5]/50 transition cursor-pointer"
            title="Previous Scenario Card"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleNext}
            className="p-1.5 rounded-md bg-[#111925] border border-[#1C2736] text-[#94A3B8] hover:text-white hover:border-[#46E6D5]/50 transition cursor-pointer"
            title="Next Scenario Card"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Quick Scenario Selector Strip ── */}
      <div className="grid grid-cols-7 gap-1.5 font-mono">
        {scenarios.map((sc, i) => {
          const isSelected = i === activeIndex;
          const isBlock = sc.expected_outcome?.includes('BLOCK');
          const isAppr = sc.expected_outcome?.includes('APPROVAL');
          const accentColor = isBlock ? '#FF496B' : isAppr ? '#F5B942' : '#C7FF4D';

          return (
            <button
              key={sc.id}
              onClick={() => setActiveIndex(i)}
              className={`py-1.5 rounded text-center text-xs font-bold transition border cursor-pointer ${
                isSelected
                  ? 'bg-[#111925] text-white shadow-md'
                  : 'bg-[#080B10] text-[#94A3B8] hover:text-white border-[#1C2736]'
              }`}
              style={{
                borderColor: isSelected ? accentColor : undefined,
                boxShadow: isSelected ? `0 0 10px ${accentColor}30` : undefined
              }}
            >
              #{sc.id}
            </button>
          );
        })}
      </div>

      {/* ── 3D Layered Card Stack ── */}
      <div className="relative min-h-[185px] perspective-1000">
        {/* Receding Background Card (Previous Depth Layer) */}
        {activeIndex > 0 && (
          <div
            onClick={() => setActiveIndex(activeIndex - 1)}
            className="absolute inset-x-2 -top-2 h-full rounded-xl border bg-[#0A0E17] border-[#1C2736] opacity-40 cursor-pointer pointer-events-auto transition-all duration-300"
            style={{
              transform: 'scale(0.96) translate3d(0, -6px, -30px)',
              zIndex: 5
            }}
          />
        )}

        {/* Active Foreground Card (High-Impact Hero Card) */}
        {currentSc && (() => {
          const Icon = getScenarioIcon(currentSc.id);
          const badge = getVerdictBadge(currentSc);
          const BadgeIcon = badge.icon;

          return (
            <div
              className="relative rounded-xl border p-4.5 transition-all duration-300 shadow-2xl"
              style={{
                background: 'linear-gradient(145deg, #111925 0%, #0D121A 100%)',
                borderColor: '#243142',
                zIndex: 20
              }}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3 mb-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#46E6D5]/10 border border-[#46E6D5]/30 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-[#46E6D5]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#46E6D5]">
                        SCENARIO #{currentSc.id}
                      </span>
                      <span className="text-xs uppercase font-mono px-2 py-0.5 rounded bg-[#080B10] text-[#94A3B8] border border-[#1C2736]">
                        ROLE: {currentSc.role}
                      </span>
                    </div>
                    <h4 className="text-sm font-outfit font-bold text-white mt-0.5 line-clamp-1">
                      {currentSc.name}
                    </h4>
                  </div>
                </div>

                {/* Expected Verdict Badge */}
                <div className={`px-2.5 py-1 rounded text-xs font-mono font-bold border flex items-center gap-1.5 shrink-0 ${badge.color}`}>
                  <BadgeIcon className="w-3.5 h-3.5" />
                  <span>{badge.label}</span>
                </div>
              </div>

              {/* Description & Objective */}
              <p className="text-xs text-[#CBD5E1] leading-relaxed mb-3 font-sans line-clamp-2">
                {currentSc.description || 'Simulate zero-trust guardrail interception against adversarial prompt payload.'}
              </p>

              {/* Payload & Context Summary */}
              <div className="p-2.5 rounded-lg bg-[#080B10] border border-[#1C2736] mb-3 text-xs font-mono text-slate-200 flex items-center justify-between">
                <span className="text-[#94A3B8] truncate max-w-[280px]">
                  Directive: <span className="text-[#F1F5F9]">"{currentSc.message?.substring(0, 38)}..."</span>
                </span>
                <span className="text-[#46E6D5] shrink-0 font-semibold">
                  Docs: {currentSc.doc_ids?.length ? currentSc.doc_ids.join(', ') : 'None'}
                </span>
              </div>

              {/* Card Action Footer */}
              <div className="flex items-center justify-between pt-2.5 border-t border-[#1C2736] text-xs font-sans">
                <span className="text-[#94A3B8] flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#C7FF4D]" />
                  Verified against L1-L4 Pipeline
                </span>

                <button
                  onClick={() => onRunScenario(currentSc)}
                  disabled={isLoading}
                  className="px-4 py-1.5 rounded-lg text-xs font-sans font-bold bg-[#C7FF4D] text-[#080B10] hover:bg-[#b8f53a] transition flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-40"
                >
                  <Play className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>{isLoading ? 'SIMULATING...' : 'EXECUTE SCENARIO'}</span>
                </button>
              </div>
            </div>
          );
        })()}

        {/* Queued Next Card (Bottom Depth Layer) */}
        {activeIndex < scenarios.length - 1 && (
          <div
            onClick={() => setActiveIndex(activeIndex + 1)}
            className="absolute inset-x-2 -bottom-2 h-full rounded-xl border bg-[#080B10] border-[#1C2736] opacity-30 cursor-pointer pointer-events-auto transition-all duration-300"
            style={{
              transform: 'scale(0.97) translate3d(0, 6px, -20px)',
              zIndex: 1
            }}
          />
        )}
      </div>
    </div>
  );
}
