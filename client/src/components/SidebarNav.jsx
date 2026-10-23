import React from 'react';
import {
  ShieldAlert,
  Activity,
  Terminal,
  FileCode,
  Clock,
  BarChart2,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Radio,
  LayoutDashboard
} from 'lucide-react';

export default function SidebarNav({
  activeTab,
  onSelectTab,
  pendingApprovalsCount = 0,
  incidentsCount = 0,
  isCollapsed,
  onToggleCollapse
}) {
  const navItems = [
    {
      id: 'overview',
      label: 'SOC Overview',
      short: 'Overview',
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: 'chat',
      label: 'Security Console',
      short: 'Console',
      icon: Terminal,
      badge: null
    },
    {
      id: 'telemetry',
      label: 'Live Telemetry',
      short: 'Telemetry',
      icon: Activity,
      badge: null
    },
    {
      id: 'approvals',
      label: 'Approval Queue',
      short: 'Approvals',
      icon: Clock,
      badge: pendingApprovalsCount > 0 ? { count: pendingApprovalsCount, color: 'bg-[#F5B942] text-[#080B10] font-bold' } : null
    },
    {
      id: 'incidents',
      label: 'Threat Forensics',
      short: 'Forensics',
      icon: ShieldAlert,
      badge: incidentsCount > 0 ? { count: incidentsCount, color: 'bg-[#FF496B]/20 text-[#FF496B] border border-[#FF496B]/40' } : null
    },
    {
      id: 'policy',
      label: 'Policy Engine',
      short: 'Policy',
      icon: FileCode,
      badge: null
    },
    {
      id: 'metrics',
      label: 'Evaluation Center',
      short: 'Eval',
      icon: BarChart2,
      badge: null
    }
  ];

  return (
    <aside
      className={`h-screen sticky top-0 flex flex-col justify-between shrink-0 transition-all duration-200 z-50 select-none ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
      style={{
        background: '#080B10',
        borderRight: '1px solid #1C2736'
      }}
    >
      {/* ── Brand Header ── */}
      <div>
        <div
          className="h-14 px-4 flex items-center justify-between border-b"
          style={{ borderColor: '#1C2736' }}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: 'rgba(199, 255, 77, 0.1)',
                border: '1px solid rgba(199, 255, 77, 0.35)',
                boxShadow: '0 0 10px rgba(199, 255, 77, 0.15)'
              }}
            >
              <ShieldCheck className="w-4 h-4 text-[#C7FF4D]" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col truncate">
                <div className="flex items-baseline gap-1.5 font-outfit font-bold text-sm tracking-tight text-white">
                  <span>AgentShield</span>
                  <span className="text-[#46E6D5] font-mono text-xs">X</span>
                </div>
                <span className="text-[11px] font-mono tracking-wider uppercase text-[#94A3B8]">
                  SENTINEL GATEWAY
                </span>
              </div>
            )}
          </div>

          {/* Collapse Toggle */}
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-md text-[#94A3B8] hover:text-white hover:bg-[#111925] transition cursor-pointer"
            title={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* ── Sentinel Status Indicator ── */}
        {!isCollapsed && (
          <div
            className="mx-3.5 mt-3.5 px-3 py-2 rounded-lg flex items-center justify-between font-mono text-xs"
            style={{
              background: '#0D121A',
              border: '1px solid #1C2736'
            }}
          >
            <span className="flex items-center gap-2 text-[#94A3B8]">
              <span className="w-2 h-2 rounded-full bg-[#C7FF4D] beacon-pulse" />
              SENTINEL WORKSTATION
            </span>
            <span className="text-[#C7FF4D] font-bold">ONLINE</span>
          </div>
        )}

        {/* ── Nav Links (All 7 Features) ── */}
        <nav className="p-3 space-y-1.5 mt-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                title={item.label}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-sans transition cursor-pointer relative ${
                  isActive
                    ? 'text-white font-semibold'
                    : 'text-[#94A3B8] font-medium hover:text-white hover:bg-[#0D121A]'
                }`}
                style={
                  isActive
                    ? {
                        background: 'linear-gradient(90deg, rgba(70, 230, 213, 0.12) 0%, rgba(70, 230, 213, 0.03) 100%)',
                        border: '1px solid rgba(70, 230, 213, 0.35)',
                        boxShadow: '0 2px 10px rgba(70, 230, 213, 0.1)'
                      }
                    : {
                        border: '1px solid transparent'
                      }
                }
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-[#46E6D5]' : 'text-[#94A3B8]'
                  }`}
                />
                {!isCollapsed && (
                  <span className="truncate flex-1 text-left tracking-normal">
                    {item.label}
                  </span>
                )}
                {!isCollapsed && item.badge && (
                  <span
                    className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold ${item.badge.color}`}
                  >
                    {item.badge.count}
                  </span>
                )}
                {isCollapsed && item.badge && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#F5B942]" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Footer Telemetry Info ── */}
      <div
        className="p-3.5 border-t text-xs font-mono text-[#94A3B8]"
        style={{ borderColor: '#1C2736' }}
      >
        {!isCollapsed ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-[#94A3B8]">
              <span>CLUSTER</span>
              <span className="text-[#EDF3F8] font-medium">NIMBUS-RETAIL-03</span>
            </div>
            <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-[#94A3B8]">
              <span>AGENT TARGET</span>
              <span className="text-[#46E6D5] font-semibold">NIMBUSASSIST</span>
            </div>
            <div className="text-[11px] text-[#94A3B8] pt-1.5 border-t border-[#1C2736] flex items-center justify-between">
              <span>DEFENSE SPEC</span>
              <span className="text-[#C7FF4D] font-semibold">v3.2.0-SENTINEL</span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center text-[#C7FF4D]" title="Sentinel Active">
            <Radio className="w-4 h-4 text-[#46E6D5] beacon-pulse" />
          </div>
        )}
      </div>
    </aside>
  );
}
