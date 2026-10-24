// 3D version of the pipeline (same story as Pipeline2D): the gate rings are
// tori around the NimbusAssist core, each guard check plays as a packet in
// order, and the view can be dragged to rotate (double-click resets).
// Falls back to the 2D view when WebGL is unavailable.
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import Pipeline2D from './Pipeline2D.jsx';
import { LAYERS, OUTCOME_COLOR, TOOLS, outcomeClass, prefersReducedMotion } from './format.js';

const STEP_MS = 700;
const RING = { scanner: 1.15, firewall: 1.6, approval: 2.05, egress: 2.5 };
const USER = new THREE.Vector3(-5.2, 1.0, 0);
const DOCS = new THREE.Vector3(-5.2, -1.6, 0);
const CORE = new THREE.Vector3(0, 0, 0);
const TOOL_POS = Object.fromEntries(TOOLS.map((t, i) => [t, new THREE.Vector3(5.4, 3.0 - i, Math.sin(i) * 0.4)]));
const HEX = { allow: 0x4ce38c, redact: 0x3be2f2, approval: 0xf6b520, block: 0xff3d7a, would: 0xb26cff, off: 0x5b6b7d };
const stops = (d) => ['BLOCK', 'NEEDS_APPROVAL'].includes(d.outcome) && !d.would_block;

function geometry(d) {
  const tool = TOOL_POS[d.attempted?.tool] || TOOL_POS.send_email;
  const r = RING[d.layer] || RING.scanner;
  const onRing = (toward) => toward.clone().sub(CORE).normalize().multiplyScalar(r);
  if (d.stage === 'input') return { from: USER, to: CORE, stop: stops(d) ? onRing(USER) : null };
  if (d.stage === 'document') return { from: DOCS, to: CORE, stop: stops(d) ? onRing(DOCS) : null };
  if (d.stage === 'output') return { from: CORE, to: USER, stop: stops(d) ? onRing(USER) : null };
  if (d.stage === 'tool' && d.layer === 'scanner') return { from: tool, to: CORE, stop: stops(d) ? onRing(tool) : null };
  return { from: CORE, to: tool, stop: stops(d) ? onRing(tool) : null };
}

function webglOk() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

export default function Pipeline3D(props) {
  const { decisions = [], steps = [], guard, user, docIds = [], running, runKey, requestId } = props;
  const [ok] = useState(webglOk);
  const host = useRef(null);
  const labels = useRef(null);
  const live = useRef({});
  const [yaw, setYaw] = useState(-5);
  live.current = { decisions, steps, guard, user, docIds, running, runKey };

  useEffect(() => {
    if (!ok) return undefined;
    const el = host.current;
    const reduced = prefersReducedMotion();
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0.6, 12.5);
    camera.lookAt(0, 0, 0);

    const world = new THREE.Group();
    scene.add(world);

    // starfield + polar floor
    const starGeo = new THREE.BufferGeometry();
    const pts = [];
    for (let i = 0; i < 500; i++) pts.push((Math.random() - 0.5) * 40, (Math.random() - 0.3) * 24, -6 - Math.random() * 14);
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x9fd8ff, size: 0.05, transparent: true, opacity: 0.6 })));
    const floor = new THREE.PolarGridHelper(7, 12, 5, 64, 0x1a5570, 0x163a52);
    floor.position.y = -3.6;
    floor.material.transparent = true;
    floor.material.opacity = 0.45;
    world.add(floor);

    // core
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), new THREE.MeshBasicMaterial({ color: 0x3be2f2, wireframe: true, transparent: true, opacity: 0.7 }));
    const nucleus = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 24), new THREE.MeshBasicMaterial({ color: 0x3be2f2 }));
    world.add(core, nucleus);

    // gate rings
    const rings = {};
    for (const l of LAYERS) {
      const m = new THREE.Mesh(new THREE.TorusGeometry(RING[l.key], 0.018, 12, 160), new THREE.MeshBasicMaterial({ color: 0x2ccfe3, transparent: true, opacity: 0.7 }));
      world.add(m);
      rings[l.key] = m;
    }

    // nodes
    const node = (pos, color, r = 0.16) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.SphereGeometry(r, 20, 20), new THREE.MeshBasicMaterial({ color })));
      g.add(new THREE.Mesh(new THREE.RingGeometry(r * 1.6, r * 1.9, 32), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.6 })));
      g.position.copy(pos);
      world.add(g);
      return g;
    };
    const userNode = node(USER, 0x3be2f2, 0.2);
    const docNode = node(DOCS, 0xb26cff, 0.18);
    const toolNodes = Object.fromEntries(TOOLS.map((t) => [t, node(TOOL_POS[t], 0x3a5a78, 0.12)]));

    // per-run objects
    const runGroup = new THREE.Group();
    world.add(runGroup);
    const packet = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 16), new THREE.MeshBasicMaterial({ color: 0x4ce38c }));
    packet.visible = false;
    world.add(packet);

    // drag to rotate, double-click to reset
    const view = { yaw: -0.09, pitch: 0.12, ty: -0.09, tp: 0.12, drag: null };
    const down = (e) => { view.drag = { x: e.clientX, y: e.clientY, yaw: view.ty, pitch: view.tp }; el.setPointerCapture?.(e.pointerId); };
    const move = (e) => {
      if (!view.drag) return;
      view.ty = Math.max(-1.2, Math.min(1.2, view.drag.yaw + (e.clientX - view.drag.x) * 0.003));
      view.tp = Math.max(-0.6, Math.min(0.8, view.drag.pitch + (e.clientY - view.drag.y) * 0.004));
    };
    const up = () => { view.drag = null; };
    const reset = () => { view.ty = -0.09; view.tp = 0.12; };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointerleave', up);
    el.addEventListener('dblclick', reset);

    const size = () => {
      const w = el.clientWidth || 600, h = el.clientHeight || 400;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.fitScale = w / h < 1.6 ? 1.6 / (w / h) : 1;
      camera.position.z = 12.5 * camera.fitScale;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(size);
    ro.observe(el);
    size();

    // animation state (kept out of React so frames do not re-render)
    const anim = { runKey: null, shown: 0, start: 0, builtFor: '' };
    const tmp = new THREE.Vector3();
    let frame;
    let lastYawShown = null;

    const rebuildRun = (played, guardState) => {
      runGroup.clear();
      played.forEach((d) => {
        const g = geometry(d);
        const end = g.stop || g.to;
        const color = HEX[outcomeClass(d)];
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([g.from, end]), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.45 }));
        runGroup.add(line);
        if (g.stop) {
          const mark = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), new THREE.MeshBasicMaterial({ color }));
          mark.position.copy(g.stop);
          mark.userData.pulse = d.outcome;
          runGroup.add(mark);
        }
      });
      // ring colours
      const off = guardState?.mode === 'off';
      const stopIdx = played.findLastIndex((d) => stops(d));
      const lastStop = stopIdx >= 0 && !(played[stopIdx].outcome === 'NEEDS_APPROVAL' && stopIdx < played.length - 1) ? played[stopIdx] : null;
      for (const l of LAYERS) {
        const on = !off && guardState?.layers?.[l.key] !== false;
        const m = rings[l.key].material;
        m.color.setHex(lastStop?.layer === l.key ? HEX[outcomeClass(lastStop)] : on ? 0x2ccfe3 : 0x5b6b7d);
        m.opacity = on || lastStop?.layer === l.key ? 0.8 : 0.25;
      }
    };

    const loop = (now) => {
      const p = live.current;
      if (p.runKey !== anim.runKey) { anim.runKey = p.runKey; anim.shown = 0; anim.start = now; anim.builtFor = ''; }
      const list = p.decisions || [];
      if (reduced) anim.shown = list.length;
      let cur = null;
      if (anim.shown < list.length) {
        const t = (now - anim.start) / STEP_MS;
        if (t >= 1) { anim.shown++; anim.start = now; } else cur = { d: list[anim.shown], t };
      } else anim.start = now;
      const key = `${anim.runKey}:${anim.shown}:${p.guard?.mode}:${JSON.stringify(p.guard?.layers)}`;
      if (key !== anim.builtFor) { rebuildRun(list.slice(0, anim.shown), p.guard); anim.builtFor = key; }

      if (cur) {
        const g = geometry(cur.d);
        packet.visible = true;
        packet.position.lerpVectors(g.from, g.stop || g.to, cur.t);
        packet.material.color.setHex(HEX[outcomeClass(cur.d)]);
      } else packet.visible = false;

      // tool and doc node colours
      const status = {};
      for (const s of p.steps || []) status[s.action || s.tool] = s.status;
      for (const t of TOOLS) {
        const st = status[t];
        const color = st === 'completed' ? 0x4ce38c : st === 'blocked' || st === 'rejected' ? 0xff3d7a : st === 'pending_approval' ? 0xf6b520 : 0x3a5a78;
        toolNodes[t].children.forEach((m) => m.material.color.setHex(color));
      }
      docNode.visible = (p.docIds || []).length > 0;

      // motion
      if (!reduced) {
        core.rotation.y += p.running ? 0.03 : 0.006;
        core.rotation.x += 0.002;
        runGroup.children.forEach((m) => { if (m.userData.pulse) m.scale.setScalar(1 + 0.35 * Math.abs(Math.sin(now / 300))); });
      }
      view.yaw += (view.ty - view.yaw) * 0.12;
      view.pitch += (view.tp - view.pitch) * 0.12;
      world.rotation.y = view.yaw;
      world.rotation.x = view.pitch;
      const yawDeg = Math.round((view.yaw * 180) / Math.PI);
      if (yawDeg !== lastYawShown) { lastYawShown = yawDeg; setYaw(yawDeg); }

      renderer.render(scene, camera);

      // project HTML labels
      const box = labels.current;
      if (box) {
        world.updateMatrixWorld();
        const w = el.clientWidth, h = el.clientHeight;
        for (const elLabel of box.children) {
          const k = elLabel.dataset.k;
          const obj = k === 'user' ? userNode : k === 'docs' ? docNode : k === 'core' ? nucleus : toolNodes[k] || rings[k];
          if (!obj) continue;
          if (rings[k]) tmp.set(0, RING[k] + 0.25, 0).applyMatrix4(world.matrixWorld);
          else obj.getWorldPosition(tmp);
          tmp.project(camera);
          elLabel.style.transform = `translate(${((tmp.x + 1) / 2) * w}px, ${((1 - tmp.y) / 2) * h}px)`;
          elLabel.style.display = (k === 'docs' && !docNode.visible) || tmp.z > 1 ? 'none' : '';
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointerleave', up);
      el.removeEventListener('dblclick', reset);
      scene.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [ok]);

  if (!ok) return <Pipeline2D {...props} />;

  const off = guard?.mode === 'off';
  const layersOn = LAYERS.filter((l) => guard?.layers?.[l.key] !== false).length;
  const toolStatus = Object.fromEntries((steps || []).map((s) => [s.action || s.tool, s.status]));
  const last = decisions[decisions.length - 1];
  const waiting = last?.outcome === 'NEEDS_APPROVAL' && !last.would_block;
  return (
    <div className="pipe pipe3d">
      <div ref={host} className="pipe3d-canvas" aria-label={`3D guard pipeline: ${decisions.length} checks`} role="img" />
      <div ref={labels} className="pipe3d-labels" aria-hidden="true">
        <span data-k="user" className="p3l">{user?.id}<small>{user?.role}</small></span>
        <span data-k="docs" className="p3l violet">{docIds.length === 1 ? docIds[0] : `${docIds.length} documents`}<small>attached</small></span>
        <span data-k="core" className="p3l core">NimbusAssist</span>
        {LAYERS.map((l) => (
          <span key={l.key} data-k={l.key} className="p3l p3l-ring" style={{ color: !off && guard?.layers?.[l.key] !== false ? '#7fdbe8' : '#5b6b7d' }}>
            {l.short} {l.label}{off || guard?.layers?.[l.key] === false ? ' · OFF' : l.pending ? ' · NOT BUILT' : ''}
          </span>
        ))}
        {TOOLS.map((t) => (
          <span key={t} data-k={t} className="p3l tool" style={{ opacity: toolStatus[t] ? 1 : 0.55 }}>
            {t}{toolStatus[t] && <small style={{ color: OUTCOME_COLOR[{ completed: 'allow', blocked: 'block', rejected: 'block', pending_approval: 'approval' }[toolStatus[t]]] }}>{toolStatus[t].replace('_', ' ')}</small>}
          </span>
        ))}
      </div>
      <div className="pipe-hint">Drag to rotate · double-click to reset</div>
      <div className="pipe-stats mono">{requestId || 'NO REQUEST'} · CHECKS {decisions.length} · GATES {off ? 0 : layersOn}/4 · YAW {yaw}°</div>
      <div className="pipe-mode mono">{running ? 'SCANNING' : waiting ? 'WAITING FOR SIGN-OFF' : 'IDLE'} · GUARD {String(guard?.mode || '').toUpperCase()} · 3D VIEW</div>
    </div>
  );
}
