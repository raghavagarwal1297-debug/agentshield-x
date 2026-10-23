import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Shield, Zap, Lock, Eye, AlertTriangle, RefreshCw, Activity, Terminal } from 'lucide-react';

export default function DefenseCore3D({
  status = 'active', // 'active' | 'threat' | 'evaluating' | 'approved'
  activeGate = 'L2',
  onSelectGate,
  threatCount = 0,
  inspectedCount = 0
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [webGlSupported, setWebGlSupported] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [coords, setCoords] = useState({ x: 0.12, y: 0.48, z: -0.32 });
  const [isFastSpin, setIsFastSpin] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer, scene, camera, animId;
    let coreMesh, corePointsMesh, innerNucleusMesh, outerCageMesh;
    let ring1, ring2, ring3, ring4, backgroundGrid, particlesMesh, signalsGroup, shockwaveRing;
    let targetRotationX = 0;
    let targetRotationY = 0;

    try {
      scene = new THREE.Scene();

      const width = container.clientWidth || 640;
      const height = container.clientHeight || 350;

      // Camera positioned closer to make core prominent and eliminate dead space
      camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
      camera.position.set(0, 0.5, 6.0);
      camera.lookAt(0, 0, 0);

      renderer = new THREE.WebGLRenderer({
        canvas: canvasRef.current,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance'
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      const isThreat = status === 'threat';
      const primaryColor = isThreat ? 0xff496b : 0x46e6d5;
      const secondaryColor = isThreat ? 0xff496b : 0xc7ff4d;

      // ── LAYER 5: Background Spatial Depth (Concentric Polar Grid & Coordinate Crosshair) ──
      const polarGridGeo = new THREE.RingGeometry(0.5, 3.4, 48, 4);
      const polarGridMat = new THREE.MeshBasicMaterial({
        color: 0x1c2736,
        wireframe: true,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide
      });
      backgroundGrid = new THREE.Mesh(polarGridGeo, polarGridMat);
      backgroundGrid.position.z = -1.2;
      scene.add(backgroundGrid);

      // ── LAYER 1: Central Energy Nucleus (Nested Faceted Core with Internal Luminosity) ──
      const nucleusGeo = new THREE.IcosahedronGeometry(0.9, 1);
      const nucleusMat = new THREE.MeshBasicMaterial({
        color: secondaryColor,
        wireframe: false,
        transparent: true,
        opacity: 0.42
      });
      innerNucleusMesh = new THREE.Mesh(nucleusGeo, nucleusMat);
      scene.add(innerNucleusMesh);

      // Inner pulsating point core
      const innerCoreGeo = new THREE.SphereGeometry(0.4, 16, 16);
      const innerCoreMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.65
      });
      const centerGlow = new THREE.Mesh(innerCoreGeo, innerCoreMat);
      innerNucleusMesh.add(centerGlow);

      // ── LAYER 2: Precision Geodesic Wireframe Shell with Glowing Inspection Vertices ──
      const coreGeo = new THREE.IcosahedronGeometry(1.65, 2);
      const coreMat = new THREE.MeshBasicMaterial({
        color: primaryColor,
        wireframe: true,
        transparent: true,
        opacity: 0.68
      });
      coreMesh = new THREE.Mesh(coreGeo, coreMat);
      scene.add(coreMesh);

      // Bright vertex inspection nodes on the shell
      const pointsMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.08,
        transparent: true,
        opacity: 0.95
      });
      corePointsMesh = new THREE.Points(coreGeo, pointsMat);
      scene.add(corePointsMesh);

      // Outer hexagonal containment cage
      const cageGeo = new THREE.DodecahedronGeometry(2.1, 0);
      const cageMat = new THREE.MeshBasicMaterial({
        color: 0x9587ff,
        wireframe: true,
        transparent: true,
        opacity: 0.2
      });
      outerCageMesh = new THREE.Mesh(cageGeo, cageMat);
      scene.add(outerCageMesh);

      // ── LAYER 3: Architectural Orbital Inspection Rings ──
      // Ring 1: Primary Equator Ring (Cyan)
      const ring1Geo = new THREE.TorusGeometry(2.5, 0.016, 16, 120);
      const ring1Mat = new THREE.MeshBasicMaterial({
        color: 0x46e6d5,
        transparent: true,
        opacity: 0.75
      });
      ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
      ring1.rotation.x = Math.PI / 2.15;
      scene.add(ring1);

      // Ring 2: Polar Ring inclined 50 deg (Violet)
      const ring2Geo = new THREE.TorusGeometry(2.8, 0.015, 16, 120);
      const ring2Mat = new THREE.MeshBasicMaterial({
        color: 0x9587ff,
        transparent: true,
        opacity: 0.55
      });
      ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
      ring2.rotation.x = Math.PI / 3.4;
      ring2.rotation.y = Math.PI / 5.2;
      scene.add(ring2);

      // Ring 3: Counter-inclined Outer Ring (Lime)
      const ring3Geo = new THREE.TorusGeometry(3.1, 0.014, 16, 120);
      const ring3Mat = new THREE.MeshBasicMaterial({
        color: 0xc7ff4d,
        transparent: true,
        opacity: 0.45
      });
      ring3 = new THREE.Mesh(ring3Geo, ring3Mat);
      ring3.rotation.x = -Math.PI / 3.1;
      ring3.rotation.z = Math.PI / 4.2;
      scene.add(ring3);

      // Ring 4: Deep Elliptical Trace Ring
      const ring4Geo = new THREE.TorusGeometry(3.35, 0.01, 16, 100);
      const ring4Mat = new THREE.MeshBasicMaterial({
        color: 0xf5b942,
        transparent: true,
        opacity: 0.35
      });
      ring4 = new THREE.Mesh(ring4Geo, ring4Mat);
      ring4.rotation.x = Math.PI / 1.8;
      ring4.rotation.y = -Math.PI / 3.5;
      scene.add(ring4);

      // ── LAYER 4: Telemetry Node Particles along Orbital Tracks ──
      const particleCount = 130;
      const positions = new Float32Array(particleCount * 3);
      const colors = new Float32Array(particleCount * 3);

      const lime = new THREE.Color(0xc7ff4d);
      const cyan = new THREE.Color(0x46e6d5);
      const coral = new THREE.Color(0xff496b);

      for (let i = 0; i < particleCount; i++) {
        const radius = 2.3 + Math.random() * 1.1;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = radius * Math.cos(phi);

        const chosen = Math.random() > 0.8 ? coral : Math.random() > 0.45 ? cyan : lime;
        colors[i * 3] = chosen.r;
        colors[i * 3 + 1] = chosen.g;
        colors[i * 3 + 2] = chosen.b;
      }

      const particlesGeo = new THREE.BufferGeometry();
      particlesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      particlesGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const particlesMat = new THREE.PointsMaterial({
        size: 0.065,
        vertexColors: true,
        transparent: true,
        opacity: 0.85
      });
      particlesMesh = new THREE.Points(particlesGeo, particlesMat);
      scene.add(particlesMesh);

      // Data Flow Signals Traveling Around Rings
      signalsGroup = new THREE.Group();
      const signalGeo = new THREE.SphereGeometry(0.07, 8, 8);
      const signalNodes = [];

      for (let s = 0; s < 5; s++) {
        const signalMat = new THREE.MeshBasicMaterial({
          color: s === 0 && isThreat ? 0xff496b : 0xc7ff4d
        });
        const signalMesh = new THREE.Mesh(signalGeo, signalMat);
        signalsGroup.add(signalMesh);
        signalNodes.push({
          mesh: signalMesh,
          speed: 0.016 + s * 0.005,
          offset: (s * Math.PI * 2) / 5
        });
      }
      scene.add(signalsGroup);

      // Interception Shockwave Ring
      const shockGeo = new THREE.RingGeometry(1.6, 1.68, 64);
      const shockMat = new THREE.MeshBasicMaterial({
        color: 0xff496b,
        transparent: true,
        opacity: isThreat ? 0.85 : 0,
        side: THREE.DoubleSide
      });
      shockwaveRing = new THREE.Mesh(shockGeo, shockMat);
      shockwaveRing.rotation.x = Math.PI / 2.2;
      scene.add(shockwaveRing);

      // Interactive Mouse Tilt
      const handleMouseMove = (e) => {
        const rect = container.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        targetRotationY = x * 0.85;
        targetRotationX = y * 0.55;

        setCoords({
          x: parseFloat((x * 2.2).toFixed(2)),
          y: parseFloat((-y * 2.2).toFixed(2)),
          z: parseFloat((Math.sin(Date.now() * 0.002) * 1.4).toFixed(2))
        });
      };

      const handleMouseLeave = () => {
        targetRotationX = 0;
        targetRotationY = 0;
      };

      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mouseleave', handleMouseLeave);

      const handleResize = () => {
        if (!container || !renderer || !camera) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener('resize', handleResize);

      // 60 FPS Cinematic Loop
      let time = 0;
      let shockScale = 1;

      const animate = () => {
        time += 0.01;
        const speedMult = isFastSpin ? 2.2 : 1.0;

        // Smooth camera tilt follow
        camera.position.x += (targetRotationY * 2.8 - camera.position.x) * 0.05;
        camera.position.y += (0.5 - targetRotationX * 1.8 - camera.position.y) * 0.05;
        camera.lookAt(0, 0, 0);

        // Core rotations
        if (coreMesh) {
          coreMesh.rotation.y += 0.003 * speedMult;
          coreMesh.rotation.x += 0.0015 * speedMult;
          const pulse = 1 + Math.sin(time * 2.8) * 0.025;
          coreMesh.scale.set(pulse, pulse, pulse);
          if (corePointsMesh) {
            corePointsMesh.rotation.copy(coreMesh.rotation);
            corePointsMesh.scale.copy(coreMesh.scale);
          }
        }

        if (innerNucleusMesh) {
          innerNucleusMesh.rotation.y -= 0.006 * speedMult;
          innerNucleusMesh.rotation.z += 0.003 * speedMult;
        }

        if (outerCageMesh) {
          outerCageMesh.rotation.y -= 0.002 * speedMult;
          outerCageMesh.rotation.x -= 0.001 * speedMult;
        }

        // Orbital rings
        if (ring1) ring1.rotation.z += 0.006 * speedMult;
        if (ring2) ring2.rotation.z -= 0.0045 * speedMult;
        if (ring3) ring3.rotation.y += 0.0055 * speedMult;
        if (ring4) ring4.rotation.x -= 0.0035 * speedMult;

        // Particles drift
        if (particlesMesh) {
          particlesMesh.rotation.y += 0.0012 * speedMult;
        }

        // Interception shockwave
        if (shockwaveRing) {
          shockScale += 0.016;
          if (shockScale > 2.2) shockScale = 1.0;
          shockwaveRing.scale.set(shockScale, shockScale, shockScale);
          shockwaveRing.material.opacity = Math.max(0, 0.85 * (1 - (shockScale - 1) / 1.2));
        }

        // Moving signals
        signalNodes.forEach((sig) => {
          const angle = time * 1.6 * speedMult + sig.offset;
          const r = 2.5;
          sig.mesh.position.x = Math.cos(angle) * r;
          sig.mesh.position.y = Math.sin(angle) * (r * 0.45);
          sig.mesh.position.z = Math.sin(angle) * (r * 0.7);
        });

        renderer.render(scene, camera);
        animId = requestAnimationFrame(animate);
      };

      animate();

      return () => {
        cancelAnimationFrame(animId);
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mouseleave', handleMouseLeave);
        window.removeEventListener('resize', handleResize);
        if (renderer) renderer.dispose();
      };
    } catch (err) {
      console.warn('WebGL init failed:', err);
      setWebGlSupported(false);
    }
  }, [status, isFastSpin]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[350px] rounded-xl overflow-hidden flex items-center justify-center select-none"
      style={{
        background: 'radial-gradient(circle at 50% 50%, rgba(17, 28, 44, 0.85) 0%, #080B10 90%)',
        border: '1px solid #1C2736',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.55)'
      }}
    >
      {/* ── Top Technical Status Bar ── */}
      <div className="absolute top-3 inset-x-4 flex items-center justify-between z-10 font-mono text-[10px]">
        <div className="flex items-center gap-2 text-slate-300">
          <span className="w-2 h-2 rounded-full bg-[#C7FF4D] beacon-pulse" />
          <span className="font-bold tracking-wider">DEFENSE CORE // SENTINEL-01</span>
          <span className="text-[#46E6D5] px-1.5 py-0.2 rounded bg-[#46E6D5]/10 border border-[#46E6D5]/25 text-[9px] hidden sm:inline">
            ZERO-TRUST ARMED
          </span>
        </div>

        <div className="flex items-center gap-3 text-[#91A0B3]">
          <span className="hidden sm:inline">
            COORDS: <strong className="text-white font-mono">X:{coords.x} Y:{coords.y} Z:{coords.z}</strong>
          </span>
          <button
            onClick={() => setIsFastSpin((p) => !p)}
            className={`px-2 py-0.5 rounded text-[10px] font-mono border transition flex items-center gap-1 cursor-pointer ${
              isFastSpin
                ? 'bg-[#46E6D5] text-[#080B10] font-bold border-[#46E6D5]'
                : 'bg-[#111925] text-[#91A0B3] border-[#1C2736] hover:text-white'
            }`}
          >
            <RefreshCw className={`w-2.5 h-2.5 ${isFastSpin ? 'animate-spin' : ''}`} />
            <span>{isFastSpin ? '2.2X SCAN' : '1.0X SCAN'}</span>
          </button>
        </div>
      </div>

      {/* ── LAYER 6: Tactical HUD Security Annotations (Callouts with Leader Lines) ── */}
      <div className="absolute top-12 left-4 z-10 pointer-events-none hidden md:flex flex-col text-[10px] font-mono">
        <span className="text-[#46E6D5] font-semibold flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#46E6D5]" />
          CORE STATUS // ACTIVE
        </span>
        <span className="text-[#64748B] text-[9px] pl-2.5 border-l border-[#243142]">
          Inspection Path: L1 → L4
        </span>
      </div>

      <div className="absolute top-12 right-4 z-10 pointer-events-none hidden md:flex flex-col text-right text-[10px] font-mono">
        <span className="text-[#C7FF4D] font-semibold flex items-center justify-end gap-1">
          EGRESS BOUNDARY // SECURE
          <span className="w-1.5 h-1.5 rounded-full bg-[#C7FF4D]" />
        </span>
        <span className="text-[#64748B] text-[9px] pr-2.5 border-r border-[#243142]">
          Zero Payload Leakage
        </span>
      </div>

      {/* ── 3D Canvas / WebGL ── */}
      {webGlSupported ? (
        <canvas ref={canvasRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 text-center p-6">
          <div className="w-24 h-24 rounded-full border-2 border-dashed border-[#46E6D5] animate-spin flex items-center justify-center">
            <Shield className="w-10 h-10 text-[#C7FF4D]" />
          </div>
          <span className="text-xs font-mono text-slate-400">Agent Defense Core (Safe Render Mode)</span>
        </div>
      )}

      {/* ── Connected 4-Gate Overlay Nodes (Interactive Bottom Bar) ── */}
      <div className="absolute bottom-3 inset-x-4 flex items-center justify-between z-10 pointer-events-auto">
        {[
          { id: 'L1', name: 'L1 Input Scanner', icon: Eye, color: '#46E6D5', desc: 'Aho-Corasick & Prompt Injection Sanitizer' },
          { id: 'L2', name: 'L2 Tool Firewall', icon: Lock, color: '#C7FF4D', desc: 'RBAC Intent & Tool Scope Verifier' },
          { id: 'L3', name: 'L3 Human Sign-Off', icon: AlertTriangle, color: '#F5B942', desc: 'Step-Up Escalation for High-Risk Operations' },
          { id: 'L4', name: 'L4 Data Egress DLP', icon: Shield, color: '#9587FF', desc: 'Aadhaar, PAN & Secret Redaction Engine' }
        ].map((gate) => {
          const isSelected = activeGate === gate.id;
          const Icon = gate.icon;
          return (
            <button
              key={gate.id}
              onClick={() => {
                setSelectedNode(gate);
                if (onSelectGate) onSelectGate(gate.id);
              }}
              className={`px-3 py-1.5 rounded-lg text-left text-xs font-mono transition-all cursor-pointer flex items-center gap-2 ${
                isSelected
                  ? 'bg-[#111925] border shadow-lg'
                  : 'bg-[#080B10]/85 border border-[#1C2736] hover:border-slate-500 hover:bg-[#0D121A]'
              }`}
              style={{
                borderColor: isSelected ? gate.color : undefined,
                boxShadow: isSelected ? `0 0 16px ${gate.color}40` : undefined
              }}
              title={gate.desc}
            >
              <div
                className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                style={{ background: `${gate.color}20`, color: gate.color }}
              >
                <Icon className="w-3 h-3" />
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="font-bold text-[11px] text-white tracking-wide">{gate.id}</span>
                <span className="text-[9px] text-[#91A0B3] truncate max-w-[95px]">{gate.name.split(' ')[1]}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Interactive Gate Inspector Overlay ── */}
      {selectedNode && (
        <div
          className="absolute top-12 left-1/2 -translate-x-1/2 z-20 px-4 py-2.5 rounded-xl text-xs font-mono flex items-center gap-3 backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
          style={{
            background: 'rgba(13, 18, 26, 0.95)',
            border: `1px solid ${selectedNode.color}`,
            boxShadow: `0 8px 30px rgba(0,0,0,0.75)`
          }}
        >
          <selectedNode.icon className="w-4 h-4" style={{ color: selectedNode.color }} />
          <div>
            <strong className="text-white">{selectedNode.name}</strong>: <span className="text-slate-300">{selectedNode.desc}</span>
          </div>
          <button
            onClick={() => setSelectedNode(null)}
            className="text-[#91A0B3] hover:text-white ml-2 cursor-pointer font-bold"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
