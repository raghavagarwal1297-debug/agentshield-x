// Bottom ticker: recent guard decisions scrolling right to left. Items that
// produced an incident open it in INVESTIGATE.
import React from 'react';
import { useConsole } from './store.jsx';
import { OUTCOME_COLOR, outcomeClass, outcomeLabel, rupees, timeIST } from './format.js';

function Item({ d, onOpen }) {
  const tool = d.attempted?.tool;
  const amount = d.attempted?.args?.amount;
  const target = tool || d.stage;
  return (
    <button type="button" onClick={d.incident_id ? () => onOpen(d.incident_id) : undefined}
      style={{ cursor: d.incident_id ? 'pointer' : 'default' }} title={d.explanation}>
      {timeIST(d.ts)}&nbsp;&nbsp;{d.request_id || '—'}&nbsp;&nbsp;{d.user || 'system'} →{' '}
      <span className={tool ? 'cyan' : ''}>{target}</span>
      {amount != null && <>&nbsp;<span className="amber">{rupees(amount)}</span></>}
      &nbsp;&nbsp;<span style={{ color: OUTCOME_COLOR[outcomeClass(d)] }}>{outcomeLabel(d)}</span>
      {d.rule_ids?.length > 0 && <>&nbsp;&nbsp;{d.rule_ids.join(',')}</>}
    </button>
  );
}

export default function Ticker() {
  const { events, openIncident } = useConsole();
  const items = events.slice(0, 30);
  if (!items.length) return <div className="ticker"><span className="idle">No guard decisions yet. Run a scenario or send a message.</span></div>;
  return (
    <div className="ticker" aria-label="Recent guard decisions">
      <div className="ticker-track" style={{ '--tick-dur': `${Math.max(30, items.length * 7)}s` }}>
        {items.map((d) => <Item key={d._k} d={d} onOpen={openIncident} />)}
      </div>
    </div>
  );
}
