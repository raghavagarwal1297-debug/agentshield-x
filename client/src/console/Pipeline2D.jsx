// 2D animated pipeline (design/spec.md §4.1 centre). The user and documents sit
// on the left, NimbusAssist in the middle inside four gate rings (L1-L4), the
// tools on the right. Each guard decision of the current request plays as a
// packet in order: ALLOW passes, REDACT turns cyan, NEEDS_APPROVAL waits at the
// L3 ring, BLOCK bursts at the ring of the layer that stopped it.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LAYERS, OUTCOME_COLOR, TOOLS, outcomeClass, prefersReducedMotion } from './format.js';

const W = 1000;
const H = 600;
const CORE = { x: 470, y: 290 };
const RING = { scanner: 74, firewall: 112, approval: 150, egress: 188 };
const USER = { x: 105, y: 230 };
const DOCS = { x: 105, y: 400 };
const TOOL_POS = Object.fromEntries(TOOLS.map((t, i) => [t, { x: 870, y: 80 + i * 72 }]));
const STEP_MS = 700;

// deterministic starfield
const STARS = Array.from({ length: 90 }, (_, i) => {
  const r = (n) => ((Math.sin(i * 9301 + n * 49297) + 1) / 2);
  return { x: r(1) * W, y: r(2) * H * 0.8, o: 0.15 + r(3) * 0.5, s: r(4) > 0.9 ? 1.6 : 0.9 };
});

const unit = (a, b) => { const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; return { x: dx / l, y: dy / l }; };
const onRing = (toward, r) => { const u = unit(CORE, toward); return { x: CORE.x + u.x * r, y: CORE.y + u.y * r }; };
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

// Where a decision's packet starts and ends, and the ring it stops at if stopped.
function geometry(d) {
  const tool = d.attempted?.tool;
  const toolPos = TOOL_POS[tool] || TOOL_POS.send_email;
  const r = RING[d.layer] || RING.scanner;
  const stops = ['BLOCK', 'NEEDS_APPROVAL'].includes(d.outcome) && !d.would_block;
  if (d.stage === 'input') return { from: USER, to: CORE, stop: stops ? onRing(USER, r) : null };
  if (d.stage === 'document') return { from: DOCS, to: CORE, stop: stops ? onRing(DOCS, r) : null };
  if (d.stage === 'output') return { from: CORE, to: USER, stop: stops ? onRing(USER, r) : null };
  if (d.stage === 'tool' && d.layer === 'scanner') {
    // tool output coming back in through the scanner
    const pos = TOOL_POS[d.tool || tool] || toolPos;
    return { from: pos, to: CORE, stop: stops ? onRing(pos, r) : null };
  }
  return { from: CORE, to: toolPos, stop: stops ? onRing(toolPos, r) : null, tool };
}

export default function Pipeline2D({ decisions = [], steps = [], guard, user, docIds = [], running, runKey, requestId }) {
  const reduced = prefersReducedMotion();
  const [shown, setShown] = useState(0); // decisions fully played
  const [t, setT] = useState(0); // progress of decision #shown
  const raf = useRef(null);

  useEffect(() => { setShown(0); setT(0); }, [runKey]);
  useEffect(() => { if (reduced) setShown(decisions.length); }, [reduced, decisions.length]);

  // play the next decision
  useEffect(() => {
    if (reduced || shown >= decisions.length) return undefined;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / STEP_MS);
      setT(p);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else { setShown((s) => s + 1); setT(0); }
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [shown, decisions.length, reduced]);

  const off = guard?.mode === 'off';
  const layersOn = LAYERS.filter((l) => guard?.layers?.[l.key] !== false).length;
  const played = decisions.slice(0, shown);
  const current = shown < decisions.length ? decisions[shown] : null;
  const stopIdx = played.findLastIndex((d) => ['BLOCK', 'NEEDS_APPROVAL'].includes(d.outcome) && !d.would_block);
  // a pause followed by more checks was decided and the run went on
  const lastStop = stopIdx >= 0 && !(played[stopIdx].outcome === 'NEEDS_APPROVAL' && stopIdx < played.length - 1) ? played[stopIdx] : null;
  const waiting = lastStop?.outcome === 'NEEDS_APPROVAL' && !current;

  const toolState = useMemo(() => {
    const m = {};
    for (const s of steps) m[s.action || s.tool] = s.status;
    return m;
  }, [steps]);

  const flashRing = current && t > 0.5 ? current.layer : null;

  return (
    <div className="pipe">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img"
        aria-label={`Guard pipeline: ${decisions.length} checks${requestId ? ` for ${requestId}` : ''}`}>
        <defs>
          <radialGradient id="sweep" cx="0" cy="0" r="1">
            <stop offset="0" stopColor="#3be2f2" stopOpacity="0.18" />
            <stop offset="1" stopColor="#3be2f2" stopOpacity="0" />
          </radialGradient>
          <filter id="glow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>

        {STARS.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#9fd8ff" opacity={s.o} />)}
        {/* polar floor */}
        <g opacity="0.18" stroke="#2ccfe3" fill="none">
          {[120, 230, 340, 450].map((rx) => <ellipse key={rx} cx={CORE.x} cy={560} rx={rx} ry={rx * 0.16} />)}
          {[-60, -30, 0, 30, 60].map((a) => <line key={a} x1={CORE.x} y1={560} x2={CORE.x + Math.sin((a * Math.PI) / 180) * 470} y2={560 + Math.cos((a * Math.PI) / 180) * 30} />)}
        </g>

        {/* sweep wedge */}
        <g className={`sweep ${running ? 'fast' : ''}`} style={{ transformOrigin: `${CORE.x}px ${CORE.y}px` }}>
          <path d={`M${CORE.x},${CORE.y} L${CORE.x + 230},${CORE.y - 40} A234,234 0 0,1 ${CORE.x + 230},${CORE.y + 40} Z`} fill="url(#sweep)" />
        </g>

        {/* gate rings */}
        {LAYERS.map((l) => {
          const on = !off && guard?.layers?.[l.key] !== false;
          const flash = flashRing === l.key ? OUTCOME_COLOR[outcomeClass(current)] : null;
          const stoppedHere = lastStop && lastStop.layer === l.key;
          const color = flash || (stoppedHere ? OUTCOME_COLOR[outcomeClass(lastStop)] : on ? '#2ccfe3' : '#5b6b7d');
          return (
            <g key={l.key}>
              <circle cx={CORE.x} cy={CORE.y} r={RING[l.key]} fill="none" stroke={color}
                strokeOpacity={on || stoppedHere ? 0.75 : 0.35} strokeWidth={flash || stoppedHere ? 2.2 : 1.2}
                strokeDasharray={on ? (l.pending ? '2 6' : undefined) : '5 7'}
                className={waiting && l.key === 'approval' ? 'pulse' : undefined} />
              <text x={CORE.x} y={CORE.y - RING[l.key] - 6} textAnchor="middle" className="ring-label"
                fill={on ? '#7fdbe8' : '#5b6b7d'}>{l.short} {l.label}{!on ? ' · OFF' : l.pending ? ' · NOT BUILT' : ''}</text>
            </g>
          );
        })}

        {/* trails of played decisions */}
        {played.map((d, i) => {
          const g = geometry(d);
          const end = g.stop || g.to;
          return <line key={i} x1={g.from.x} y1={g.from.y} x2={end.x} y2={end.y} stroke={OUTCOME_COLOR[outcomeClass(d)]} strokeOpacity="0.35" strokeWidth="1.5" />;
        })}

        {/* nodes */}
        <Node p={USER} label={user?.id || 'user'} sub={user?.role} color="#3be2f2" />
        {docIds.length > 0 && <Node p={DOCS} label={docIds.length === 1 ? docIds[0] : `${docIds.length} documents`} sub="attached" color="#b26cff" />}
        <g filter="url(#glow)">
          <circle cx={CORE.x} cy={CORE.y} r="26" fill="#0e2338" stroke="#3be2f2" strokeWidth="2" />
          <circle cx={CORE.x} cy={CORE.y} r="9" fill="#3be2f2" className={running ? 'pulse' : undefined} />
        </g>
        <text x={CORE.x} y={CORE.y + 48} textAnchor="middle" className="node-label">NimbusAssist</text>
        {TOOLS.map((tool) => {
          const st = toolState[tool];
          const color = st === 'completed' ? '#4ce38c' : st === 'blocked' || st === 'rejected' ? '#ff3d7a' : st === 'pending_approval' ? '#f6b520' : '#3a5a78';
          return <Node key={tool} p={TOOL_POS[tool]} label={tool} sub={st ? st.replace('_', ' ') : null} color={color} small dim={!st} />;
        })}

        {/* moving packet */}
        {current && <Packet d={current} t={t} />}
        {/* bursts / waits at stopping rings */}
        {played.filter((d) => ['BLOCK', 'NEEDS_APPROVAL'].includes(d.outcome) && !d.would_block).map((d, i) => {
          const p = geometry(d).stop;
          const color = OUTCOME_COLOR[outcomeClass(d)];
          return (
            <g key={`s${i}`}>
              <circle cx={p.x} cy={p.y} r="7" fill={color} filter="url(#glow)" />
              <circle cx={p.x} cy={p.y} r="16" fill="none" stroke={color} strokeWidth="1.5" className={d.outcome === 'BLOCK' ? 'burst' : 'pulse'} />
            </g>
          );
        })}
      </svg>
      <div className="pipe-hint">{off ? 'Guard OFF: every step goes straight through' : 'Each packet is one guard check, in order'}</div>
      <div className="pipe-stats mono">
        {requestId || 'NO REQUEST'} · CHECKS {decisions.length} · STEPS {steps.length} · GATES {off ? 0 : layersOn}/4
      </div>
      <div className="pipe-mode mono">{running ? 'SCANNING' : waiting ? 'WAITING FOR SIGN-OFF' : 'IDLE'} · GUARD {String(guard?.mode || '').toUpperCase()} · 2D VIEW</div>
    </div>
  );
}

function Node({ p, label, sub, color, small, dim }) {
  return (
    <g opacity={dim ? 0.55 : 1}>
      <circle cx={p.x} cy={p.y} r={small ? 9 : 13} fill="#0a1b2d" stroke={color} strokeWidth="2" />
      <circle cx={p.x} cy={p.y} r={small ? 3.5 : 5} fill={color} />
      <text x={p.x + (small ? -16 : 0)} y={p.y + (small ? 4 : 32)} textAnchor={small ? 'end' : 'middle'} className="node-label">{label}</text>
      {sub && <text x={p.x + (small ? -16 : 0)} y={p.y + (small ? 19 : 48)} textAnchor={small ? 'end' : 'middle'} className="node-sub" fill={color}>{sub}</text>}
    </g>
  );
}

function Packet({ d, t }) {
  const g = geometry(d);
  const color = OUTCOME_COLOR[outcomeClass(d)];
  const end = g.stop || g.to;
  const p = lerp(g.from, end, t);
  return (
    <g filter="url(#glow)">
      <line x1={g.from.x} y1={g.from.y} x2={p.x} y2={p.y} stroke={color} strokeWidth="2" strokeOpacity="0.8" />
      <circle cx={p.x} cy={p.y} r="6" fill={color} />
    </g>
  );
}
