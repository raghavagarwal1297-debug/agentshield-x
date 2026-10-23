import React, { useState, useEffect } from 'react';
import {
  Activity
} from 'lucide-react';

import SidebarNav from './components/SidebarNav.jsx';
import TopBar from './components/TopBar.jsx';
import OverviewTab from './components/OverviewTab.jsx';
import ChatPanel from './components/ChatPanel.jsx';
import LiveFeed from './components/LiveFeed.jsx';
import ApprovalsTab from './components/ApprovalsTab.jsx';
import IncidentsTab from './components/IncidentsTab.jsx';
import MetricsTab from './components/MetricsTab.jsx';
import PolicyTab from './components/PolicyTab.jsx';
import IncidentModal from './components/IncidentModal.jsx';
import PageTransition from './components/motion/PageTransition.jsx';

import {
  getDataSource,
  setDataSource,
  checkHealth,
  getGuardConfig,
  setGuardConfig,
  resetSandbox,
  getDocuments,
  getApprovals,
  resolveApproval,
  getIncidents,
  getPolicy,
  getMetrics,
  sendChatMessage,
  subscribeToStream
} from './api.js';

import mockChatData from '../mock/chat.json';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'chat' | 'telemetry' | 'approvals' | 'incidents' | 'policy' | 'metrics'
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [dataSource, setDataSourceState] = useState(getDataSource());
  const [serverStatus, setServerStatus] = useState(null);

  const [guardConfig, setGuardConfigState] = useState({
    mode: 'enforce',
    layers: { scanner: true, firewall: true, approval: true, egress: true }
  });

  const [currentRole, setCurrentRole] = useState({
    id: 'hr_karan',
    name: 'Karan · HR',
    role: 'hr'
  });

  const initialClockTime = new Date().toISOString();

  const [messages, setMessages] = useState(() =>
    (mockChatData.sample_history || []).map((m) => ({ ...m, timestamp: initialClockTime }))
  );
  const [scenarios, setScenarios] = useState(mockChatData.scenarios || []);
  const [documents, setDocuments] = useState([]);
  const [selectedDocs, setSelectedDocs] = useState([]);

  const [events, setEvents] = useState([
    {
      id: 'ev_init_01',
      stage: 'document',
      layer: 'scanner',
      outcome: 'ALLOW',
      rule_ids: ['DOC-VERIFIED'],
      risk: 0,
      explanation: 'q3_report.txt verified clean of injection spans.',
      ts: initialClockTime
    },
    {
      id: 'ev_init_02',
      stage: 'tool',
      layer: 'firewall',
      outcome: 'ALLOW',
      rule_ids: ['FW-INTENT-MATCH', 'FW-ROLE-PERMIT'],
      risk: 4,
      explanation: "Tool 'read_document' authorized for HR role under intent 'summarize'.",
      ts: initialClockTime
    }
  ]);

  const [incidents, setIncidents] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [metricsData, setMetricsData] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [selectedIncidentForModal, setSelectedIncidentForModal] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [simStage, setSimStage] = useState(null); // null | 'scanner' | 'firewall' | 'approval' | 'egress'
  const [isResetting, setIsResetting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Initialize data on mount
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [health, guard, docs, incs, apprs, pol, met] = await Promise.all([
          checkHealth(),
          getGuardConfig(),
          getDocuments(),
          getIncidents(),
          getApprovals(),
          getPolicy(),
          getMetrics()
        ]);

        setServerStatus(health);
        if (guard) setGuardConfigState(guard);
        if (docs) setDocuments(docs);
        if (incs) setIncidents(incs);
        if (apprs) setApprovals(apprs);
        if (pol) setPolicy(pol);
        if (met) setMetricsData(met);
      } catch (err) {
        console.error('Initialization error:', err);
      }
    }

    loadInitialData();
  }, [dataSource]);

  // Real-time stream subscription
  useEffect(() => {
    const unsubscribe = subscribeToStream((event) => {
      const streamTime = new Date().toISOString();
      if (event.type === 'decision' && event.data) {
        setEvents((prev) => [
          { ...event.data, id: `ev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, ts: streamTime },
          ...prev
        ]);
      } else if (event.type === 'incident' && event.data) {
        setIncidents((prev) => [{ ...event.data, ts: streamTime }, ...prev]);
        setToastMessage(`Security Incident Logged: ${event.data.summary || event.data.id}`);
        setTimeout(() => setToastMessage(null), 3500);
      } else if (event.type === 'approval_created' && event.data) {
        setApprovals((prev) => [event.data, ...prev.filter((a) => a.id !== event.data.id)]);
        setToastMessage(`L3 Authorization Required: ${event.data.tool}`);
        setTimeout(() => setToastMessage(null), 3500);
      } else if (event.type === 'approval_resolved' && event.data) {
        setApprovals((prev) => prev.filter((a) => a.id !== event.data.id));
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [dataSource]);

  const handleUpdateGuard = async (newConfig) => {
    setGuardConfigState(newConfig);
    try {
      await setGuardConfig(newConfig);
    } catch (err) {
      console.error('Failed to update guard config:', err);
    }
  };

  const handleDataSourceChange = (source) => {
    setDataSource(source);
    setDataSourceState(source);
  };

  const handleResetDemo = async () => {
    setIsResetting(true);
    try {
      await resetSandbox();
      const [incs, apprs] = await Promise.all([getIncidents(), getApprovals()]);
      setIncidents(incs || []);
      setApprovals(apprs || []);
      setMessages((mockChatData.sample_history || []).map((m) => ({ ...m, timestamp: new Date().toISOString() })));
      setEvents([]);
      setToastMessage('Security sandbox reset to pristine initial state.');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error('Failed to reset sandbox:', err);
    } finally {
      setIsResetting(false);
    }
  };

  const handleToggleDoc = (docId) => {
    setSelectedDocs((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const handleSendMessage = async (userText, roleOverride, docIdsOverride) => {
    const roleToUse = roleOverride || currentRole;
    const docsToUse = docIdsOverride !== undefined ? docIdsOverride : selectedDocs;

    const userMsg = {
      id: `msg_u_${Date.now()}`,
      role: 'user',
      content: userText,
      message: userText,
      userName: roleToUse.name,
      doc_ids: docsToUse,
      timestamp: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setSimStage('scanner');

    try {
      const t1 = setTimeout(() => setSimStage('firewall'), 260);
      const t2 = setTimeout(() => setSimStage('approval'), 540);
      const t3 = setTimeout(() => setSimStage('egress'), 820);

      const response = await sendChatMessage({
        message: userText,
        role: roleToUse.role,
        role_id: roleToUse.id,
        documents: docsToUse
      });

      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);

      if (response && response.message) {
        const assistantMsg = {
          id: response.id || `msg_a_${Date.now()}`,
          role: 'assistant',
          content: response.message.content || response.message,
          reply: response.reply,
          steps: response.steps || [],
          decisions: response.decisions || [],
          tool_calls: response.tool_calls || [],
          blocked: response.blocked || false,
          approval_required: response.approval_required || false,
          layer_stopped_at: response.layer_stopped_at || null,
          verdict: response.verdict || null,
          timestamp: response.timestamp || new Date().toISOString()
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }

      if (response && response.events) {
        setEvents((prev) => [...response.events, ...prev]);
      }

      if (response && response.new_incidents) {
        setIncidents((prev) => [...response.new_incidents, ...prev]);
      }

      if (response && response.new_approvals) {
        setApprovals((prev) => [...response.new_approvals, ...prev]);
      }
    } catch (err) {
      console.error('Chat error:', err);
      const errorMsg = {
        id: `msg_err_${Date.now()}`,
        role: 'assistant',
        content: `Error evaluating request: ${err.message || 'Unknown network error'}.`,
        blocked: true,
        timestamp: new Date().toISOString()
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      setSimStage(null);
    }
  };

  const handleRunScenario = (scenarioId) => {
    // If not in chat view, switch to chat tab so analyst can see live trace
    if (activeTab !== 'chat') {
      setActiveTab('chat');
    }

    const sc = typeof scenarioId === 'object' && scenarioId ? scenarioId : scenarios.find((s) => s.id === scenarioId);
    if (!sc) return;

    const SCENARIO_USERS = {
      hr_karan: { id: 'hr_karan', name: 'Karan · HR', role: 'hr' },
      admin_riya: { id: 'admin_riya', name: 'Riya · Admin', role: 'admin' },
      intern_aman: { id: 'intern_aman', name: 'Aman · Intern', role: 'intern' }
    };
    let targetRole = currentRole;
    if (SCENARIO_USERS[sc.user_id]) {
      targetRole = SCENARIO_USERS[sc.user_id];
      setCurrentRole(targetRole);
    } else if (sc.role) {
      if (sc.role === 'intern' || sc.role === 'intern_rohit') {
        targetRole = { id: 'intern_rohit', name: 'Rohit · Intern', role: 'intern' };
        setCurrentRole(targetRole);
      } else if (sc.role === 'hr' || sc.role === 'hr_karan') {
        targetRole = { id: 'hr_karan', name: 'Karan · HR', role: 'hr' };
        setCurrentRole(targetRole);
      } else if (sc.role === 'finance' || sc.role === 'finance_priya') {
        targetRole = { id: 'finance_priya', name: 'Priya · Finance', role: 'finance' };
        setCurrentRole(targetRole);
      }
    }

    if (sc.guard_overrides) {
      const restored = {
        ...guardConfig,
        layers: {
          ...guardConfig.layers,
          ...sc.guard_overrides.layers
        }
      };
      setGuardConfigState(restored);
      setGuardConfig(restored);
    }

    setSelectedDocs(sc.doc_ids || []);
    handleSendMessage(sc.message, targetRole, sc.doc_ids || []);
  };

  const handleResolveApproval = async (id, decision) => {
    const res = await resolveApproval(id, decision, currentRole.id);
    if (res?.result?.reply) {
      setMessages((prev) => [...prev, {
        id: `msg_a_${Date.now()}`,
        role: 'assistant',
        content: res.result.reply,
        reply: res.result.reply,
        steps: res.result.steps || [],
        decisions: res.result.decisions || [],
        blocked: res.result.blocked || false,
        timestamp: new Date().toISOString()
      }]);
    }
    const updated = await getApprovals();
    setApprovals(updated);
    setToastMessage(`Action ${decision === 'approve' ? 'Approved' : 'Rejected'} for Docket #${id}`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const pendingApprovalsCount = approvals.filter((a) => a.status === 'pending').length;

  return (
    <div className="min-h-screen bg-[#080B10] text-[#EDF3F8] flex font-sans antialiased overflow-hidden select-none">
      {/* ── Section 1: Persistent Left Navigation Rail (All 7 Features Restored!) ── */}
      <SidebarNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        pendingApprovalsCount={pendingApprovalsCount}
        incidentsCount={incidents.length}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      {/* ── Main SOC Content Column ── */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* ── Global Security Header ── */}
        <TopBar
          guardConfig={guardConfig}
          onUpdateGuard={handleUpdateGuard}
          currentRole={currentRole}
          onRoleChange={setCurrentRole}
          dataSource={dataSource}
          onDataSourceChange={handleDataSourceChange}
          onReset={handleResetDemo}
          isResetting={isResetting}
          serverStatus={serverStatus}
          isLoading={isLoading}
          simStage={simStage}
        />

        {/* ── Floating SOC Notification Toast ── */}
        {toastMessage && (
          <div
            className="fixed bottom-6 right-6 z-50 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-mono font-medium animate-in slide-in-from-bottom-3 duration-200"
            style={{
              background: '#0D121A',
              border: '1px solid #46E6D5',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)'
            }}
          >
            <Activity className="w-4 h-4 text-[#46E6D5] beacon-pulse" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* ── Full Workspace Views (All 7 Views Accessible) ── */}
        <main className="flex-1 overflow-hidden flex flex-col relative">
          <PageTransition activeKey={activeTab} className="h-full flex flex-col flex-1 overflow-hidden">
            {/* 1. SOC Overview (Command Center with Metric Tiles, Graphs & Scenarios) */}
            {activeTab === 'overview' && (
              <div className="flex-1 overflow-y-auto">
                <OverviewTab
                  incidents={incidents}
                  approvals={approvals}
                  events={events}
                  metricsData={metricsData}
                  guardConfig={guardConfig}
                  scenarios={scenarios}
                  onRunScenario={handleRunScenario}
                  onNavigateTab={setActiveTab}
                />
              </div>
            )}

            {/* 2. Security Console (Interactive Chat & Attack Workspace) */}
            {activeTab === 'chat' && (
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden h-[calc(100vh-56px)]">
                {/* Left Column: Attack Simulation & Investigation Console */}
                <div className="lg:col-span-7 h-full overflow-hidden">
                  <ChatPanel
                    messages={messages}
                    onSendMessage={handleSendMessage}
                    onRunScenario={handleRunScenario}
                    scenarios={scenarios}
                    documents={documents}
                    selectedDocs={selectedDocs}
                    onToggleDoc={handleToggleDoc}
                    currentRole={currentRole}
                    guardConfig={guardConfig}
                    isLoading={isLoading}
                    simStage={simStage}
                  />
                </div>

                {/* Right Column: Live Telemetry Stream */}
                <div
                  className="lg:col-span-5 h-full overflow-hidden border-t lg:border-t-0"
                  style={{ borderColor: '#1C2736' }}
                >
                  <LiveFeed
                    events={events}
                    guardConfig={guardConfig}
                    onSelectIncident={(ev) => {
                      const matching =
                        incidents.find((i) => i.id === ev.id || i.stage === ev.stage) || incidents[0];
                      setSelectedIncidentForModal(matching);
                    }}
                  />
                </div>
              </div>
            )}

            {/* 3. Dedicated Live Telemetry Stream */}
            {activeTab === 'telemetry' && (
              <div className="flex-1 overflow-hidden h-[calc(100vh-56px)]">
                <LiveFeed
                  events={events}
                  guardConfig={guardConfig}
                  onSelectIncident={(ev) => {
                    const matching =
                      incidents.find((i) => i.id === ev.id || i.stage === ev.stage) || incidents[0];
                    setSelectedIncidentForModal(matching);
                  }}
                />
              </div>
            )}

            {/* 4. Human Approval Queue */}
            {activeTab === 'approvals' && (
              <div className="flex-1 overflow-y-auto">
                <ApprovalsTab
                  approvals={approvals}
                  onResolveApproval={handleResolveApproval}
                  currentRole={currentRole}
                />
              </div>
            )}

            {/* 5. Threat Forensics */}
            {activeTab === 'incidents' && (
              <div className="flex-1 overflow-y-auto">
                <IncidentsTab incidents={incidents} />
              </div>
            )}

            {/* 6. Zero-Trust Policy Engine */}
            {activeTab === 'policy' && (
              <div className="flex-1 overflow-y-auto">
                <PolicyTab
                  policy={policy}
                  onPolicyUpdated={(newPol) => setPolicy(newPol)}
                />
              </div>
            )}

            {/* 7. Evaluation Center & Benchmarks */}
            {activeTab === 'metrics' && (
              <div className="flex-1 overflow-y-auto">
                <MetricsTab metricsData={metricsData} />
              </div>
            )}
          </PageTransition>
        </main>

        {/* Forensic Disassembly Modal */}
        {selectedIncidentForModal && (
          <IncidentModal
            incident={selectedIncidentForModal}
            onClose={() => setSelectedIncidentForModal(null)}
          />
        )}
      </div>
    </div>
  );
}
