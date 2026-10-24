// AgentShield X console shell (design/spec.md): header, active tab, ticker, toasts.
import React from 'react';
import './console/console.css';
import { ConsoleProvider, useConsole } from './console/store.jsx';
import Header from './console/Header.jsx';
import Ticker from './console/Ticker.jsx';
import Toasts from './console/Toasts.jsx';
import Mission from './console/tabs/Mission.jsx';
import Investigate from './console/tabs/Investigate.jsx';
import Approvals from './console/tabs/Approvals.jsx';
import Results from './console/tabs/Results.jsx';
import TestLab from './console/tabs/TestLab.jsx';

// Previous dashboard screens, hosted until each tab is rebuilt.
import PolicyTab from './components/PolicyTab.jsx';

function Legacy({ children }) {
  return <div className="legacy">{children}</div>;
}

function ActiveTab() {
  const c = useConsole();
  switch (c.tab) {
    case 'investigate':
      return <Investigate />;
    case 'approvals':
      return <Approvals />;
    case 'results':
      return <Results />;
    case 'testlab':
      return <TestLab />;
    case 'policy':
      return <Legacy><PolicyTab policy={c.policy} onPolicyUpdated={c.setPolicy} /></Legacy>;
    default:
      return null; // MISSION stays mounted below
  }
}

// Mission keeps its conversation and a running Autopilot while other tabs are open.
function MissionHost() {
  const { tab } = useConsole();
  return <div className="tab-host" hidden={tab !== 'mission'}><Mission /></div>;
}

export default function App() {
  return (
    <ConsoleProvider>
      <div className="cx">
        <Header />
        <MissionHost />
        <ActiveTab />
        <Ticker />
        <Toasts />
      </div>
    </ConsoleProvider>
  );
}
