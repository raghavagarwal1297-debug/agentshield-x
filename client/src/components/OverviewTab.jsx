import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Activity,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Lock,
  Zap,
  TrendingUp,
  FileSpreadsheet,
  AlertOctagon,
  UserX,
  FileWarning,
  DollarSign,
  Globe,
  Layers,
  Play,
  ArrowUpRight
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import DefenseCore3D from './DefenseCore3D.jsx';
import ScrollReveal from './motion/ScrollReveal.jsx';

/* ── Custom Cyber Tooltip for Live Ingestion Traffic ── */
const CustomTrafficTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const allowed = payload.find((p) => p.dataKey === 'allowed')?.value ?? 0;
    const blocked = payload.find((p) => p.dataKey === 'blocked')?.value ?? 0;
    const total = allowed + blocked;
    const blockRate = total > 0 ? Math.round((blocked / total) * 100) : 0;

    return (
      <div className="p-3.5 rounded-xl border bg-[#080B10]/95 backdrop-blur-md border-[#243142] shadow-2xl font-sans min-w-[210px]">
        <div className="text-xs font-mono font-bold text-white border-b border-[#1C2736] pb-1.5 mb-2.5 flex items-center justify-between">
          <span>TIME: {label} UTC</span>
          <span className="text-[10px] text-[#94A3B8]">Telemetry Window</span>
        </div>
        <div className="space-y-1.5 text-xs font-mono">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[#C7FF4D]">
              <span className="w-2 h-2 rounded-sm bg-[#C7FF4D]" />
              Allowed Requests:
            </span>
            <span className="font-bold text-white">{allowed} req/s</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[#FF496B]">
              <span className="w-2 h-2 rounded-sm bg-[#FF496B]" />
              Intercepted Threats:
            </span>
            <span className="font-bold text-white">{blocked} req/s</span>
          </div>
          <div className="pt-2 border-t border-[#1C2736] flex items-center justify-between text-xs font-sans">
            <span className="text-[#94A3B8]">Interception Ratio:</span>
            <span className="font-bold font-mono text-[#FF496B]">{blockRate}%</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

/* ── Custom Cyber Tooltip for Severity Distribution ── */
const CustomSeverityTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="p-3 rounded-xl border bg-[#080B10]/95 backdrop-blur-md border-[#243142] shadow-2xl font-sans min-w-[190px]">
        <div className="text-xs font-bold text-white border-b border-[#1C2736] pb-1.5 mb-2 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: data.payload.color }} />
          <span>{data.name}</span>
        </div>
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-[#94A3B8]">Count:</span>
          <span className="font-bold text-white text-sm">{data.value} traces</span>
        </div>
      </div>
    );
  }
  return null;
};

export default function OverviewTab({
  incidents = [],
  approvals = [],
  events = [],
  metricsData,
  guardConfig,
  scenarios = [],
  onRunScenario,
  onNavigateTab
}) {
  const [selectedGate, setSelectedGate] = useState('L2');
  const pendingApprovalsCount = approvals.filter((a) => a.status === 'pending').length;
  const blockedCount = events.filter((e) => e.outcome === 'BLOCK').length + incidents.length;
  const inspectedCount = Math.max(events.length, 14);
  const allowedCount = events.filter((e) => e.outcome === 'ALLOW').length;

  const timelineData = [
    { time: '10:00', inspected: 8, blocked: 1, allowed: 7 },
    { time: '10:15', inspected: 14, blocked: 2, allowed: 12 },
    { time: '10:30', inspected: 22, blocked: 5, allowed: 17 },
    { time: '10:45', inspected: 19, blocked: 4, allowed: 15 },
    { time: '11:00', inspected: 31, blocked: 8, allowed: 23 },
    { time: '11:15', inspected: 28, blocked: 7, allowed: 21 },
    { time: '11:30', inspected: Math.max(inspectedCount, 36), blocked: Math.max(blockedCount, 9), allowed: Math.max(allowedCount, 27) }
  ];

  const severityDistribution = [
    { name: 'Critical (Injection)', value: 4, color: '#FF496B' },
    { name: 'High (RBAC Breach)', value: 5, color: '#F5B942' },
    { name: 'Medium (Approval Required)', value: 2, color: '#9587FF' },
    { name: 'Benign (Verified Clean)', value: 14, color: '#C7FF4D' }
  ];

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

  return (
    <div className="p-5 max-w-7xl mx-auto space-y-5 select-none font-sans">
      {/* ── Top Header Bar ── */}
      <div
        className="p-5 rounded-xl flex flex-wrap items-center justify-between gap-4 border"
        style={{
          background: '#0D121A',
          borderColor: '#1C2736'
        }}
      >
        <div className="flex items-center gap-3.5">
          <div
            className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: 'rgba(199, 255, 77, 0.12)',
              border: '1px solid rgba(199, 255, 77, 0.35)'
            }}
          >
            <ShieldCheck className="w-5 h-5 text-[#C7FF4D]" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl lg:text-2xl font-outfit font-bold text-white tracking-tight">
                Project Sentinel // Command Center
              </h2>
              <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-[#C7FF4D]/10 text-[#C7FF4D] border border-[#C7FF4D]/30">
                ACTIVE DEFENSE
              </span>
            </div>
            <p className="text-sm text-[#94A3B8] mt-1 leading-relaxed max-w-2xl">
              Continuous multi-layer AI agent telemetry, prompt-injection defense, and zero-trust egress control.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="px-4 py-2 rounded-lg bg-[#111925] border border-[#243142] text-right font-mono">
            <span className="text-xs text-[#94A3B8] block font-medium">ENFORCEMENT MODE</span>
            <span className="text-sm font-bold text-[#C7FF4D] uppercase">{guardConfig.mode}</span>
          </div>
          <div className="px-4 py-2 rounded-lg bg-[#111925] border border-[#243142] text-right font-mono">
            <span className="text-xs text-[#94A3B8] block font-medium">TELEMETRY</span>
            <span className="text-sm font-bold text-[#46E6D5] flex items-center gap-1.5 justify-end">
              <span className="w-2 h-2 rounded-full bg-[#46E6D5] beacon-pulse" />
              ONLINE 60 FPS
            </span>
          </div>
        </div>
      </div>

      {/* ── Centerpiece 1: The 3D Agent Defense Core (60%) + 2x2 Metric Modules (40%) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left 7 Cols (~60%): Real-time 3D Defense Core */}
        <div className="lg:col-span-7 flex flex-col justify-between h-full">
          <DefenseCore3D
            status={blockedCount > 0 ? 'active' : 'evaluating'}
            activeGate={selectedGate}
            onSelectGate={(gateId) => setSelectedGate(gateId)}
            threatCount={blockedCount}
            inspectedCount={inspectedCount}
          />
        </div>

        {/* Right 5 Cols (~40%): Live Security Metrics 2x2 Grid */}
        <div className="lg:col-span-5 grid grid-cols-2 gap-3.5 h-full">
          {/* 1. Requests Inspected */}
          <div className="p-4 rounded-xl border bg-[#0E141E] border-[#1C2736] flex flex-col justify-between hover:border-[#46E6D5]/40 transition shadow-sm">
            <div className="flex items-center justify-between text-xs text-[#94A3B8]">
              <span className="font-sans font-semibold text-xs tracking-wider uppercase">Requests Inspected</span>
              <Activity className="w-4 h-4 text-[#46E6D5]" />
            </div>
            <div className="my-2.5 flex items-baseline gap-2">
              <span className="text-3xl font-outfit font-extrabold text-white">{inspectedCount}</span>
              <span className="text-xs text-[#C7FF4D] font-mono flex items-center font-bold">
                <TrendingUp className="w-3.5 h-3.5 mr-0.5" /> 100%
              </span>
            </div>
            <span className="text-xs text-[#94A3B8] font-sans">Continuous stream ingestion</span>
          </div>

          {/* 2. Threats Intercepted */}
          <div className="p-4 rounded-xl border bg-[#0E141E] border-[#1C2736] flex flex-col justify-between hover:border-[#FF496B]/40 transition shadow-sm">
            <div className="flex items-center justify-between text-xs text-[#94A3B8]">
              <span className="font-sans font-semibold text-xs tracking-wider uppercase">Threats Intercepted</span>
              <ShieldAlert className="w-4 h-4 text-[#FF496B]" />
            </div>
            <div className="my-2.5 flex items-baseline gap-2">
              <span className="text-3xl font-outfit font-extrabold text-[#FF496B]">{blockedCount}</span>
              <span className="text-xs text-[#FF496B] font-mono px-2 py-0.5 rounded bg-[#FF496B]/15 border border-[#FF496B]/30 font-bold">
                EXCISED
              </span>
            </div>
            <span className="text-xs text-[#94A3B8] font-sans">Zero payload leakage</span>
          </div>

          {/* 3. Pending Approvals */}
          <div
            onClick={() => onNavigateTab('approvals')}
            className="p-4 rounded-xl border bg-[#0E141E] border-[#1C2736] hover:border-[#F5B942]/70 transition flex flex-col justify-between cursor-pointer group shadow-sm"
          >
            <div className="flex items-center justify-between text-xs text-[#94A3B8]">
              <span className="font-sans font-semibold text-xs tracking-wider uppercase">Pending Approvals</span>
              <Clock className="w-4 h-4 text-[#F5B942]" />
            </div>
            <div className="my-2.5 flex items-baseline gap-2">
              <span className="text-3xl font-outfit font-extrabold text-[#F5B942]">{pendingApprovalsCount}</span>
              <span className="text-xs text-[#94A3B8] font-mono">L3 Sign-Off</span>
            </div>
            <span className="text-xs text-[#F5B942] flex items-center gap-1 font-sans font-semibold group-hover:underline">
              REVIEW QUEUE <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>

          {/* 4. Forensic Incidents */}
          <div
            onClick={() => onNavigateTab('incidents')}
            className="p-4 rounded-xl border bg-[#0E141E] border-[#1C2736] hover:border-[#9587FF]/70 transition flex flex-col justify-between cursor-pointer group shadow-sm"
          >
            <div className="flex items-center justify-between text-xs text-[#94A3B8]">
              <span className="font-sans font-semibold text-xs tracking-wider uppercase">Forensics Logged</span>
              <AlertTriangle className="w-4 h-4 text-[#9587FF]" />
            </div>
            <div className="my-2.5 flex items-baseline gap-2">
              <span className="text-3xl font-outfit font-extrabold text-white">{incidents.length}</span>
              <span className="text-xs text-[#9587FF] font-mono">OWASP Mapped</span>
            </div>
            <span className="text-xs text-[#9587FF] flex items-center gap-1 font-sans font-semibold group-hover:underline">
              INSPECT DOSSIER <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </div>

      {/* ── Visual Charts: Traffic Volume (~60%) & Severity Breakdown (~40%) ── */}
      <ScrollReveal direction="up" delay={80}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Chart 1: Traffic Volume & Threat Interception Trend (7 Cols / ~60%) */}
          <div
            className="lg:col-span-7 p-5 rounded-xl border flex flex-col justify-between shadow-sm"
            style={{ background: '#0D121A', borderColor: '#1C2736' }}
          >
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div>
                  <h3 className="text-base font-outfit font-bold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#46E6D5]" />
                    Live Ingestion Volume vs. Intercepted Attacks
                  </h3>
                  <p className="text-xs text-[#94A3B8] mt-0.5 leading-relaxed font-sans">
                    Real-time telemetry stream throughput passing through L1-L4 pipeline gates
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs font-sans font-medium">
                  <span className="flex items-center gap-1.5 text-[#C7FF4D]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#C7FF4D] shadow-[0_0_8px_rgba(199,255,77,0.4)]" />
                    Allowed Traffic
                  </span>
                  <span className="flex items-center gap-1.5 text-[#FF496B]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FF496B] shadow-[0_0_8px_rgba(255,73,107,0.4)]" />
                    Intercepted Threats
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-[#94A3B8] pb-2 border-b border-[#1C2736] font-sans">
                <span>Sampling: 15-min intervals</span>
                <span className="text-[#46E6D5] font-mono text-[11px] font-semibold">Unit: Requests / sec (req/s)</span>
              </div>
            </div>

            <div className="h-64 w-full mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAllowed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#C7FF4D" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#C7FF4D" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorBlocked" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF496B" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#FF496B" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1C2736" opacity={0.6} />
                  <XAxis dataKey="time" stroke="#94A3B8" fontSize={11} fontFamily="JetBrains Mono, monospace" />
                  <YAxis stroke="#94A3B8" fontSize={11} unit=" req/s" fontFamily="JetBrains Mono, monospace" />
                  <Tooltip content={<CustomTrafficTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="allowed"
                    name="Allowed Requests"
                    stroke="#C7FF4D"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorAllowed)"
                  />
                  <Area
                    type="monotone"
                    dataKey="blocked"
                    name="Intercepted Attacks"
                    stroke="#FF496B"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorBlocked)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Threat Severity Classification (5 Cols / ~40%) */}
          <div
            className="lg:col-span-5 p-5 rounded-xl border flex flex-col justify-between shadow-sm"
            style={{ background: '#0D121A', borderColor: '#1C2736' }}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-base font-outfit font-bold text-white flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-[#FF496B]" />
                    Threat Severity Classification
                  </h3>
                  <p className="text-xs text-[#94A3B8] mt-0.5 leading-relaxed font-sans">
                    Vector distribution of incoming adversarial traces
                  </p>
                </div>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#111925] text-[#94A3B8] border border-[#1C2736]">
                  OWASP Mapped
                </span>
              </div>
              <div className="text-xs text-[#94A3B8] pb-2 border-b border-[#1C2736] font-sans">
                Relative proportion of intercepted vs benign telemetry
              </div>
            </div>

            {/* Segmented Donut with Centered Summary Metric */}
            <div className="relative h-48 w-full flex items-center justify-center my-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={severityDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={72}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {severityDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="#0D121A" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomSeverityTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              {/* Centered Donut Hole Label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-outfit font-extrabold text-white leading-none">
                  {severityDistribution.reduce((acc, curr) => acc + curr.value, 0)}
                </span>
                <span className="text-[10px] font-mono tracking-widest text-[#94A3B8] uppercase mt-0.5">
                  TRACES
                </span>
              </div>
            </div>

            {/* Categorical Breakdown Legend with Counts and Percentages */}
            <div className="space-y-2 pt-3 border-t border-[#1C2736] text-xs">
              {severityDistribution.map((item) => {
                const total = severityDistribution.reduce((acc, curr) => acc + curr.value, 0);
                const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                return (
                  <div key={item.name} className="flex items-center justify-between text-[#CBD5E1]">
                    <span className="flex items-center gap-2 text-xs font-medium font-sans">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                      <span className="truncate max-w-[180px]">{item.name}</span>
                    </span>
                    <div className="flex items-center gap-2.5 font-mono">
                      <span className="text-xs text-[#94A3B8]">{pct}%</span>
                      <span className="font-bold text-white text-xs">{item.value}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </ScrollReveal>

      {/* ── Chronological Security Telemetry Stream (Revealed with Scroll) ── */}
      <ScrollReveal direction="up" delay={120}>
        <div
          className="p-5 rounded-xl border shadow-sm"
          style={{ background: '#0D121A', borderColor: '#1C2736' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-lg bg-[#46E6D5]/15 border border-[#46E6D5]/30 text-[#46E6D5]">
                <Activity className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-base font-outfit font-bold text-white flex items-center gap-2">
                  Chronological Security Telemetry Stream
                  <span className="w-2 h-2 rounded-full bg-[#46E6D5] beacon-pulse" />
                </h3>
                <p className="text-xs text-[#94A3B8] mt-0.5 leading-relaxed">
                  Sequential telemetry logs emitted across L1-L4 pipeline with instant forensic trace
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigateTab('telemetry')}
              className="text-xs font-sans font-bold text-[#46E6D5] hover:text-white px-3.5 py-2 rounded-lg bg-[#111925] border border-[#1C2736] hover:border-[#46E6D5]/50 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <span>VIEW FULL STREAM</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {(events.length > 0 ? events.slice(0, 4) : [
              {
                id: 'ev_init_01',
                stage: 'document',
                layer: 'scanner',
                outcome: 'ALLOW',
                rule_ids: ['DOC-VERIFIED'],
                risk: 0,
                explanation: 'q3_report.txt verified clean of injection spans.',
                ts: new Date().toISOString()
              },
              {
                id: 'ev_init_02',
                stage: 'tool',
                layer: 'firewall',
                outcome: 'ALLOW',
                rule_ids: ['FW-INTENT-MATCH', 'FW-ROLE-PERMIT'],
                risk: 4,
                explanation: "Tool 'read_document' authorized for HR role under intent 'summarize'.",
                ts: new Date().toISOString()
              }
            ]).map((ev) => {
              const isBlock = ev.outcome === 'BLOCK';
              const isAppr = ev.outcome === 'NEEDS_APPROVAL';
              const outcomeColor = isBlock
                ? 'bg-[#FF496B]/15 text-[#FF496B] border-[#FF496B]/30'
                : isAppr
                ? 'bg-[#F5B942]/15 text-[#F5B942] border-[#F5B942]/30'
                : 'bg-[#C7FF4D]/15 text-[#C7FF4D] border-[#C7FF4D]/30';

              return (
                <div
                  key={ev.id}
                  onClick={() => onNavigateTab(isBlock ? 'incidents' : isAppr ? 'approvals' : 'telemetry')}
                  className="p-3.5 rounded-lg border bg-[#0E141E] border-[#1C2736] hover:border-[#46E6D5]/50 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-[#94A3B8] shrink-0">
                      {new Date(ev.ts || Date.now()).toLocaleTimeString()}
                    </span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#111925] border border-[#1C2736] text-[#46E6D5] uppercase font-bold shrink-0">
                      {ev.stage || ev.layer || 'PIPELINE'}
                    </span>
                    <span className={`font-mono text-xs px-2 py-0.5 rounded border uppercase font-bold shrink-0 ${outcomeColor}`}>
                      {ev.outcome || 'EVENT'}
                    </span>
                    <span className="text-sm text-[#F1F5F9] font-sans line-clamp-1 group-hover:text-white">
                      {ev.explanation || 'Pipeline event evaluated successfully.'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 text-xs font-mono shrink-0">
                    <span className="text-[#94A3B8]">RISK: <strong className={isBlock ? 'text-[#FF496B]' : 'text-slate-200'}>{ev.risk || 0}</strong></span>
                    <span className="text-[#46E6D5] font-semibold group-hover:underline flex items-center font-sans">
                      TRACE <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </ScrollReveal>

      {/* ── Attack Simulation Matrix ── */}
      <ScrollReveal direction="up" delay={160}>
        <div
          className="p-5 rounded-xl border"
          style={{ background: '#0D121A', borderColor: '#1C2736' }}
        >
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2.5">
              <Zap className="w-4 h-4 text-[#46E6D5]" />
              <h3 className="text-base font-outfit font-bold text-white">
                Sentinel Adversarial Test Suite
              </h3>
            </div>
            <span className="text-xs text-[#94A3B8] font-sans">
              Execute any scenario to trace real-time multi-layer defense
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {scenarios.map((sc) => {
              const isBlock = sc.expected_outcome?.includes('BLOCK');
              const isApproval = sc.expected_outcome?.includes('APPROVAL');
              const Icon = getScenarioIcon(sc.id);

              return (
                <button
                  key={sc.id}
                  onClick={() => {
                    onRunScenario(sc.id);
                    onNavigateTab('chat');
                  }}
                  className="p-3 rounded-lg border text-left flex flex-col justify-between transition hover:border-[#46E6D5]/60 bg-[#0E141E] border-[#1C2736] cursor-pointer group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                        <Icon className="w-3.5 h-3.5 text-[#46E6D5]" />
                        #{sc.id}
                      </span>
                      <span className="text-xs uppercase px-1.5 py-0.2 rounded bg-[#080B10] text-[#94A3B8] border border-[#1C2736] font-mono">
                        {sc.role}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-white group-hover:text-cyan-300 line-clamp-2 leading-snug">
                      {sc.name.split(':')[1]?.trim() || sc.name}
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-[#1C2736] flex items-center justify-between text-xs font-mono">
                    <span
                      className={`font-semibold ${
                        isBlock ? 'text-[#FF496B]' : isApproval ? 'text-[#F5B942]' : 'text-[#C7FF4D]'
                      }`}
                    >
                      {isBlock ? 'WILL BLOCK' : isApproval ? 'NEEDS SIGN-OFF' : 'CLEAN'}
                    </span>
                    <Play className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#46E6D5] transition" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </ScrollReveal>
    </div>
  );
}
