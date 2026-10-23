import React from 'react';
import {
  RotateCcw,
  Zap,
  Cpu,
  UserCheck,
  Lock,
  ChevronRight,
  ShieldCheck,
  Activity
} from 'lucide-react';

const PIPELINE_LAYERS = [
  { key: 'scanner',  label: 'L1 Scanner',  desc: 'Prompt Injection Sanitizer', Icon: Zap, color: '#46E6D5' },
  { key: 'firewall', label: 'L2 Firewall', desc: 'Role Intent & Tool RBAC', Icon: Cpu, color: '#C7FF4D' },
  { key: 'approval', label: 'L3 Sign-Off', desc: 'Human Approval for High-Risk Tools', Icon: UserCheck, color: '#F5B942' },
  { key: 'egress',   label: 'L4 Egress',   desc: 'Data Leakage & DLP Redaction', Icon: Lock, color: '#9587FF' },
];

const ROLES = [
  { id: 'hr_karan',    name: 'Karan · HR',    role: 'hr' },
  { id: 'admin_riya',  name: 'Riya · Admin',  role: 'admin' },
  { id: 'intern_aman', name: 'Aman · Intern', role: 'intern' },
];

const MODES = [
  { id: 'off',     label: 'Off',     active: 'bg-[#FF496B]/15 text-[#FF496B] border-[#FF496B]/40 font-bold' },
  { id: 'monitor', label: 'Audit',   active: 'bg-[#F5B942]/15 text-[#F5B942] border-[#F5B942]/40 font-bold' },
  { id: 'enforce', label: 'Enforce', active: 'bg-[#C7FF4D]/15 text-[#C7FF4D] border-[#C7FF4D]/40 font-bold' },
];

export default function TopBar({
  guardConfig,
  onUpdateGuard,
  currentRole,
  onRoleChange,
  dataSource,
  onDataSourceChange,
  onReset,
  isResetting,
  serverStatus,
  isLoading,
  simStage,
}) {
  const toggleLayer = (key) => {
    onUpdateGuard({
      ...guardConfig,
      layers: { ...guardConfig.layers, [key]: !guardConfig.layers[key] },
    });
  };

  const setMode = (modeId) => {
    onUpdateGuard({ ...guardConfig, mode: modeId });
  };

  return (
    <header
      className="h-14 px-4 flex items-center justify-between gap-3 sticky top-0 z-40 select-none border-b"
      style={{
        background: '#0D121A',
        borderColor: '#1C2736'
      }}
    >
      {/* ── Connected 4-Gate Pipeline ── */}
      <div className="flex items-center gap-2 flex-1 max-w-2xl">
        <span className="text-xs font-semibold text-[#94A3B8] tracking-wider mr-1 hidden md:inline shrink-0">
          DEFENSE PIPELINE:
        </span>
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#080B10] border border-[#1C2736] w-full justify-between">
          {PIPELINE_LAYERS.map((layer, idx) => {
            const isLayerActive = guardConfig.layers?.[layer.key] !== false;
            const isCurrentSim = simStage === layer.key;
            const isScanning = (isLoading && isLayerActive && guardConfig.mode === 'enforce') || isCurrentSim;
            const { Icon } = layer;

            return (
              <React.Fragment key={layer.key}>
                <button
                  onClick={() => toggleLayer(layer.key)}
                  title={`${layer.label}: ${layer.desc}. Click to toggle.`}
                  className={`relative flex items-center gap-1.5 px-3 py-1 rounded text-xs transition cursor-pointer font-sans ${
                    isCurrentSim
                      ? 'bg-[#46E6D5]/20 text-white border border-[#46E6D5] shadow-[0_0_12px_rgba(70,230,213,0.4)] animate-pulse font-semibold'
                      : isLayerActive
                      ? isScanning
                        ? 'bg-[#111925] text-[#46E6D5] border border-[#46E6D5]/60 font-semibold'
                        : 'bg-[#111925] text-[#E2E8F0] hover:text-white border border-[#243142] font-medium'
                      : 'text-[#64748B] line-through opacity-40 bg-transparent border border-transparent'
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      isScanning ? 'text-[#46E6D5] animate-spin' : ''
                    }`}
                    style={{ color: isLayerActive && !isScanning ? layer.color : undefined }}
                  />
                  <span className="text-xs font-medium">{layer.label}</span>
                  {isLayerActive && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isCurrentSim
                          ? 'bg-[#46E6D5] beacon-pulse'
                          : isScanning
                          ? 'bg-[#46E6D5] beacon-pulse'
                          : 'bg-[#C7FF4D]'
                      }`}
                    />
                  )}
                </button>

                {idx < PIPELINE_LAYERS.length - 1 && (
                  <ChevronRight className="w-3.5 h-3.5 text-[#243142] shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ── Mode, Environment & Identity ── */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Enforcement Mode */}
        <div className="flex items-center p-0.5 rounded-lg bg-[#080B10] border border-[#1C2736] text-xs font-sans">
          {MODES.map((m) => {
            const isSelected = guardConfig.mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`px-3 py-1 rounded text-xs transition cursor-pointer border ${
                  isSelected
                    ? `${m.active}`
                    : 'text-[#94A3B8] border-transparent hover:text-white font-medium'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Data Source Mode */}
        <button
          onClick={() => onDataSourceChange(dataSource === 'mock' ? 'live' : 'mock')}
          className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold border flex items-center gap-2 transition cursor-pointer ${
            dataSource === 'live'
              ? serverStatus?.ok
                ? 'bg-[#C7FF4D]/10 text-[#C7FF4D] border-[#C7FF4D]/30'
                : 'bg-[#FF496B]/10 text-[#FF496B] border-[#FF496B]/30'
              : 'bg-[#46E6D5]/10 text-[#46E6D5] border-[#46E6D5]/30'
          }`}
          title={`Active data source: ${dataSource === 'mock' ? 'Mock Data' : 'Live Gateway :4000'}. Click to toggle.`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              dataSource === 'live'
                ? serverStatus?.ok ? 'bg-[#C7FF4D] beacon-pulse' : 'bg-[#FF496B]'
                : 'bg-[#46E6D5]'
            }`}
          />
          <span>{dataSource === 'mock' ? 'MOCK MODE' : 'LIVE :4000'}</span>
        </button>

        {/* User Role */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-[#080B10] border border-[#1C2736] text-xs font-sans">
          <div className="w-5 h-5 rounded-full bg-[#46E6D5]/20 text-[#46E6D5] flex items-center justify-center font-bold text-xs font-mono">
            {currentRole.name[0]}
          </div>
          <select
            value={currentRole.id}
            onChange={(e) => {
              const r = ROLES.find((ro) => ro.id === e.target.value);
              if (r) onRoleChange(r);
            }}
            className="bg-transparent text-xs font-medium text-white focus:outline-none cursor-pointer pr-1"
          >
            {ROLES.map((r) => (
              <option key={r.id} value={r.id} className="bg-[#080B10] text-white">
                {r.name}
              </option>
            ))}
          </select>
        </div>

        {/* Reset */}
        <button
          onClick={onReset}
          disabled={isResetting}
          className="p-1.5 rounded-lg text-[#91A0B3] hover:text-white bg-[#080B10] hover:bg-[#111925] border border-[#1C2736] transition cursor-pointer disabled:opacity-40"
          title="Reset Sandbox Database"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin text-[#46E6D5]' : ''}`} />
        </button>
      </div>
    </header>
  );
}
