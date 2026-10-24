// AgentShield X console shell (design/spec.md): header, active tab, ticker, toasts.
import React from 'react';
import './console/console.css';
import { ConsoleProvider, useConsole } from './console/store.jsx';
import Header from './console/Header.jsx';
import Ticker from './console/Ticker.jsx';
import Toasts from './console/Toasts.jsx';
import { Panel } from './console/ui.jsx';
import { resolveApproval } from './api.js';

// Previous dashboard screens, hosted until each tab is rebuilt.
import IncidentsTab from './components/IncidentsTab.jsx';
import ApprovalsTab from './components/ApprovalsTab.jsx';
import MetricsTab from './components/MetricsTab.jsx';
import PolicyTab from './components/PolicyTab.jsx';

function Legacy({ children }) {
  return <div className="legacy">{children}</div>;
}

function ActiveTab() {
  const c = useConsole();
  switch (c.tab) {
    case 'investigate':
      return <Legacy><IncidentsTab incidents={c.incidents} /></Legacy>;
    case 'approvals':
      return (
        <Legacy>
          <ApprovalsTab approvals={c.approvals} currentRole={c.user}
            onResolveApproval={async (id, decision) => { await resolveApproval(id, decision, c.user.id); c.refreshApprovals(); }} />
        </Legacy>
      );
    case 'results':
    case 'testlab':
      return <Legacy><MetricsTab metricsData={c.metrics} /></Legacy>;
    case 'policy':
      return <Legacy><PolicyTab policy={c.policy} onPolicyUpdated={c.setPolicy} /></Legacy>;
    default:
      return (
        <div className="cx-body">
          <div className="cx-col"><Panel title="Mission" titleClass="cyan" className="fill"><p className="empty">The guided demo is being rebuilt.</p></Panel></div>
          <div className="cx-col"><Panel className="fill" /></div>
          <div className="cx-col right"><Panel title="Terminal" meta="nimbus@guard" className="fill" /><Panel title="Alerts" meta={c.incidents.length} className="fill" /></div>
        </div>
      );
  }
}

export default function App() {
  return (
    <ConsoleProvider>
      <div className="cx">
        <Header />
        <ActiveTab />
        <Ticker />
        <Toasts />
      </div>
    </ConsoleProvider>
  );
}
