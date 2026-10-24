// Full decision feed with filter pills and search; consecutive checks of the
// same request are joined by a thin connector.
import React, { useMemo, useState } from 'react';
import { useConsole } from './store.jsx';
import { OutcomeChip } from './ui.jsx';
import { timeIST } from './format.js';

const FILTERS = [
  ['all', 'ALL', () => true],
  ['blocked', 'BLOCKED', (d) => d.outcome === 'BLOCK' || d.would_block],
  ['allowed', 'ALLOWED', (d) => d.outcome === 'ALLOW' && !d.would_block],
  ['approvals', 'APPROVALS', (d) => d.outcome === 'NEEDS_APPROVAL' || d.layer === 'approval'],
];

export default function LiveFeed() {
  const { events, openIncident } = useConsole();
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const test = FILTERS.find((f) => f[0] === filter)[2];
    const needle = q.trim().toLowerCase();
    return events.filter(test).filter((d) => !needle || [d.explanation, d.request_id, d.user, d.attempted?.tool, ...(d.rule_ids || [])]
      .some((s) => String(s || '').toLowerCase().includes(needle)));
  }, [events, filter, q]);
  return (
    <div className="feed">
      <div className="feed-tools">
        <div className="seg">
          {FILTERS.map(([id, label]) => <button key={id} type="button" data-v="plain" aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}
        </div>
        <input className="input mono" placeholder="Search rule, tool, user, request" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search decisions" />
      </div>
      {!list.length && <p className="empty">{events.length ? 'Nothing matches this filter.' : 'No guard decisions yet.'}</p>}
      <div className="feed-list">
        {list.map((d, i) => (
          <button key={d._k} type="button" className={`feed-row ${list[i - 1]?.request_id && list[i - 1].request_id === d.request_id ? 'joined' : ''}`}
            onClick={d.incident_id ? () => openIncident(d.incident_id) : undefined} disabled={!d.incident_id} title={d.incident_id ? `Open ${d.incident_id}` : undefined}>
            <span className="mono dim">{timeIST(d.ts)}</span>
            <OutcomeChip d={d} />
            <span className="mono cyan">{d.attempted?.tool || d.stage}</span>
            <span className="feed-exp">{d.explanation}</span>
            <span className="mono dim">{d.request_id}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
