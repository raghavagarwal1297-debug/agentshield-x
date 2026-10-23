import React, { useState } from 'react';
import {
  Shield,
  FileCode,
  Lock,
  Users,
  Globe,
  Sliders,
  Check,
  AlertTriangle,
  Save
} from 'lucide-react';
import ScrollReveal from './motion/ScrollReveal.jsx';
import { updatePolicy } from '../api.js';

export default function PolicyTab({ policy, onPolicyUpdated }) {
  const [isEditing, setIsEditing] = useState(false);
  const [rawJSON, setRawJSON] = useState(JSON.stringify(policy, null, 2));
  const [saveStatus, setSaveStatus] = useState(null);

  const handleSave = async () => {
    try {
      const parsed = JSON.parse(rawJSON);
      await updatePolicy(parsed);
      setSaveStatus('success');
      if (onPolicyUpdated) onPolicyUpdated(parsed);
      setTimeout(() => setSaveStatus(null), 2500);
      setIsEditing(false);
    } catch (e) {
      setSaveStatus('error');
    }
  };

  const approvalRules = policy?.approval_required || [];
  const egress = policy?.egress || {};

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 select-none font-sans">
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
            <span className="p-2 rounded-lg bg-[#46E6D5]/15 border border-[#46E6D5]/30 text-[#46E6D5]">
              <Shield className="w-5 h-5" />
            </span>
            <h2 className="text-xl lg:text-2xl font-outfit font-bold text-white tracking-tight">
              Zero-Trust Policy Engine (policy.json v3)
            </h2>
          </div>
          <p className="text-sm text-[#94A3B8] max-w-2xl leading-relaxed mt-1">
            Deterministic security policy schema enforced across L1 (Input Normalization), L2 (Role Intent Firewall), L3 (Approval Gate), and L4 (Egress DLP).
          </p>
        </div>

        <div className="flex items-center gap-2 font-sans">
          {isEditing ? (
            <>
              <button
                onClick={() => {
                  setRawJSON(JSON.stringify(policy, null, 2));
                  setIsEditing(false);
                }}
                className="px-4 py-2 rounded-lg text-xs font-sans font-medium text-[#94A3B8] hover:text-white bg-[#0E141E] border border-[#1C2736] transition cursor-pointer"
              >
                CANCEL
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 rounded-lg text-xs font-sans font-bold text-[#080B10] bg-[#C7FF4D] hover:bg-[#b8f53a] transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Save className="w-4 h-4" />
                SAVE POLICY
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setRawJSON(JSON.stringify(policy, null, 2));
                setIsEditing(true);
              }}
              className="px-4 py-2 rounded-lg text-xs font-sans font-bold text-[#080B10] bg-[#46E6D5] hover:bg-[#3cd1c1] transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <FileCode className="w-4 h-4" />
              EDIT POLICY (JSON)
            </button>
          )}
        </div>
      </div>

      {saveStatus === 'success' && (
        <div className="px-4 py-3 rounded-lg text-xs flex items-center gap-2 font-sans bg-[#C7FF4D]/10 border border-[#C7FF4D]/30 text-[#C7FF4D]">
          <Check className="w-4 h-4 text-[#C7FF4D]" />
          Policy updated successfully. All guardrail layers re-synchronized.
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="px-4 py-3 rounded-lg text-xs flex items-center gap-2 font-sans bg-[#FF496B]/10 border border-[#FF496B]/30 text-[#FF496B]">
          <AlertTriangle className="w-4 h-4 text-[#FF496B]" />
          Syntax Error in Policy JSON. Please verify formatting.
        </div>
      )}

      {isEditing ? (
        <div className="rounded-xl p-4 border bg-[#0D121A] border-[#1C2736]">
          <textarea
            value={rawJSON}
            onChange={(e) => setRawJSON(e.target.value)}
            className="w-full h-96 bg-[#080B10] text-[#46E6D5] font-mono text-xs p-4 rounded-lg border border-[#1C2736] focus:outline-none focus:border-[#46E6D5] leading-relaxed"
          />
        </div>
      ) : (
        <div className="space-y-5">
          {/* 1. Roles & RBAC Matrix */}
          <ScrollReveal direction="up" delay={40}>
            <div className="p-5 rounded-xl border bg-[#0D121A] border-[#1C2736]">
              <div className="flex items-center gap-2.5 mb-4">
                <Users className="w-4 h-4 text-[#46E6D5]" />
                <h3 className="text-base font-outfit font-bold text-white">
                  1. Role-Based Access Control (RBAC) Matrix
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Admin */}
                <div className="p-4 rounded-xl border bg-[#0E141E] border-[#1C2736] space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#1C2736]">
                    <span className="font-outfit font-bold text-white text-sm">Admin (Riya)</span>
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-[#C7FF4D]/15 text-[#C7FF4D] border border-[#C7FF4D]/30 font-mono">
                      SUPERUSER
                    </span>
                  </div>
                  <div className="space-y-2.5 text-xs font-sans">
                    <div>
                      <span className="text-xs text-[#94A3B8] font-medium uppercase block mb-1">Permitted Tools:</span>
                      <span className="text-[#C7FF4D] text-xs font-mono font-semibold">["*"] (Full Access)</span>
                    </div>
                    <div>
                      <span className="text-xs text-[#94A3B8] font-medium uppercase block mb-1">Data Scope:</span>
                      <span className="text-slate-100">All fields (employees &amp; customers)</span>
                    </div>
                    <div>
                      <span className="text-xs text-[#94A3B8] font-medium uppercase block mb-1">Document Clearance:</span>
                      <span className="text-[#C7FF4D] font-bold">Critical Level (Top Secret)</span>
                    </div>
                  </div>
                </div>

                {/* HR */}
                <div className="p-4 rounded-xl border bg-[#0E141E] border-[#1C2736] space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#1C2736]">
                    <span className="font-outfit font-bold text-white text-sm">HR (Karan)</span>
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-[#F5B942]/15 text-[#F5B942] border border-[#F5B942]/30 font-mono">
                      HR OPS
                    </span>
                  </div>
                  <div className="space-y-2.5 text-xs font-sans">
                    <div>
                      <span className="text-xs text-[#94A3B8] font-medium uppercase block mb-1">Permitted Tools:</span>
                      <span className="text-[#46E6D5] text-xs font-mono font-semibold">search_records, read_doc, send_email</span>
                    </div>
                    <div>
                      <span className="text-xs text-[#94A3B8] font-medium uppercase block mb-1">Data Scope:</span>
                      <span className="text-slate-100">Employees [*], Customers [id, name, city]</span>
                    </div>
                    <div>
                      <span className="text-xs text-[#94A3B8] font-medium uppercase block mb-1">Rate Limits:</span>
                      <span className="text-[#F5B942] font-semibold">10 records / session</span>
                    </div>
                  </div>
                </div>

                {/* Intern */}
                <div className="p-4 rounded-xl border bg-[#0E141E] border-[#1C2736] space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#1C2736]">
                    <span className="font-outfit font-bold text-white text-sm">Intern (Aman)</span>
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-[#FF496B]/15 text-[#FF496B] border border-[#FF496B]/30 font-mono">
                      RESTRICTED
                    </span>
                  </div>
                  <div className="space-y-2.5 text-xs font-sans">
                    <div>
                      <span className="text-xs text-[#94A3B8] font-medium uppercase block mb-1">Permitted Tools:</span>
                      <span className="text-[#46E6D5] text-xs font-mono font-semibold">search_records, read_doc</span>
                    </div>
                    <div>
                      <span className="text-xs text-[#94A3B8] font-medium uppercase block mb-1">Data Scope:</span>
                      <span className="text-slate-100">Employees [id, name, dept]</span>
                    </div>
                    <div>
                      <span className="text-xs text-[#94A3B8] font-medium uppercase block mb-1">Egress Constraint:</span>
                      <span className="text-[#FF496B] font-semibold">Internal only, max 3 emails / session</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>

          {/* 2. L3 & L4 Rules */}
          <ScrollReveal direction="up" delay={80}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* L3 Approvals */}
              <div className="p-5 rounded-xl border bg-[#0D121A] border-[#1C2736]">
                <div className="flex items-center gap-2.5 mb-3.5">
                  <Lock className="w-4 h-4 text-[#F5B942]" />
                  <h3 className="text-base font-outfit font-bold text-white">
                    2. L3 Human Approval Interception Rules
                  </h3>
                </div>
                <div className="space-y-2 text-xs font-mono">
                  {approvalRules.map((r, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg border flex items-center justify-between bg-[#0E141E] border-[#1C2736]"
                    >
                      <span className="font-bold text-[#46E6D5]">{r.tool}</span>
                      <span className="text-[#CBD5E1] text-xs font-sans">
                        {r.when ? `Condition: ${r.when}` : 'Always requires human sign-off'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* L4 Egress DLP */}
              <div className="p-5 rounded-xl border bg-[#0D121A] border-[#1C2736]">
                <div className="flex items-center gap-2.5 mb-3.5">
                  <Globe className="w-4 h-4 text-[#C7FF4D]" />
                  <h3 className="text-base font-outfit font-bold text-white">
                    3. L4 Data Egress &amp; DLP Boundary
                  </h3>
                </div>
                <div className="space-y-3 text-xs font-sans">
                  <div className="p-3 rounded-lg border bg-[#0E141E] border-[#1C2736]">
                    <span className="text-xs text-[#94A3B8] font-medium uppercase block mb-1.5">
                      Strict Email Domains Allowed:
                    </span>
                    <div className="flex flex-wrap gap-2 font-mono text-xs">
                      {(egress.email_domains_allowed || []).map((d) => (
                        <span
                          key={d}
                          className="px-2.5 py-0.5 rounded font-semibold bg-[#C7FF4D]/10 text-[#C7FF4D] border border-[#C7FF4D]/30"
                        >
                          @{d}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border bg-[#0E141E] border-[#1C2736]">
                    <span className="text-xs text-[#94A3B8] font-medium uppercase block mb-1.5">
                      Role Redaction Rules:
                    </span>
                    <div className="space-y-1 text-xs">
                      <div className="text-[#CBD5E1]">Admin: <span className="text-[#C7FF4D] font-medium">None (Full data visible)</span></div>
                      <div className="text-[#CBD5E1]">HR: <span className="text-[#46E6D5] font-medium">secrets [REDACTED]</span></div>
                      <div className="text-[#CBD5E1]">Intern: <span className="text-[#F5B942] font-medium">salary, phone, pan_like, secrets [REDACTED]</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>

          {/* 3. Thresholds & Clearance */}
          <ScrollReveal direction="up" delay={120}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-xl border bg-[#0D121A] border-[#1C2736]">
                <div className="flex items-center gap-2.5 mb-3.5">
                  <Sliders className="w-4 h-4 text-[#46E6D5]" />
                  <h3 className="text-base font-outfit font-bold text-white">
                    4. Thresholds &amp; Judge Model Band
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-2.5 text-xs font-mono">
                  <div className="p-3 rounded-lg border bg-[#0E141E] border-[#1C2736]">
                    <span className="text-xs text-[#94A3B8] font-sans block uppercase font-medium mb-0.5">ALLOW Threshold</span>
                    <span className="text-[#C7FF4D] text-sm font-bold">&lt; 30 Risk</span>
                  </div>
                  <div className="p-3 rounded-lg border bg-[#0E141E] border-[#1C2736]">
                    <span className="text-xs text-[#94A3B8] font-sans block uppercase font-medium mb-0.5">BLOCK Threshold</span>
                    <span className="text-[#FF496B] text-sm font-bold">&ge; 70 Risk</span>
                  </div>
                  <div className="p-3 rounded-lg border bg-[#0E141E] border-[#1C2736]">
                    <span className="text-xs text-[#94A3B8] font-sans block uppercase font-medium mb-0.5">Judge LLM Band</span>
                    <span className="text-[#F5B942] text-sm font-bold">20 - 70 Risk</span>
                  </div>
                  <div className="p-3 rounded-lg border bg-[#0E141E] border-[#1C2736]">
                    <span className="text-xs text-[#94A3B8] font-sans block uppercase font-medium mb-0.5">Timeout (Fail-Closed)</span>
                    <span className="text-[#46E6D5] text-sm font-bold">3,000 ms</span>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-xl border bg-[#0D121A] border-[#1C2736]">
                <div className="flex items-center gap-2.5 mb-3.5">
                  <FileCode className="w-4 h-4 text-[#46E6D5]" />
                  <h3 className="text-base font-outfit font-bold text-white">
                    5. Document Clearance Hierarchy
                  </h3>
                </div>
                <div className="space-y-2 text-xs font-mono">
                  {Object.entries(policy?.document_classification || {}).map(([file, cls]) => {
                    let badge = 'bg-[#080B10] text-[#94A3B8] border-[#1C2736]';
                    if (cls === 'critical') badge = 'bg-[#FF496B]/15 text-[#FF496B] border-[#FF496B]/30';
                    else if (cls === 'internal') badge = 'bg-[#46E6D5]/15 text-[#46E6D5] border-[#46E6D5]/30';
                    else if (cls === 'public') badge = 'bg-[#C7FF4D]/15 text-[#C7FF4D] border-[#C7FF4D]/30';
                    else if (cls === 'external') badge = 'bg-[#F5B942]/15 text-[#F5B942] border-[#F5B942]/30';

                    return (
                      <div
                        key={file}
                        className="px-3 py-2 rounded-lg border flex items-center justify-between bg-[#0E141E] border-[#1C2736]"
                      >
                        <span className="text-slate-200">{file}</span>
                        <span className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase border ${badge}`}>
                          {cls}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      )}
    </div>
  );
}
