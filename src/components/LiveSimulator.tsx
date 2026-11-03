import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RobotProject, RobotPart, ServoMotor, MovementSequence } from '../types';
import { arduinoSerial } from '../services/arduinoSerial';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Sliders,
  Cpu,
  Usb,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Settings,
  Zap,
  Film,
  Radio,
  Sparkles,
  Box,
  Plus,
  Trash2,
  Save,
  FolderOpen,
} from 'lucide-react';

interface LiveSimulatorProps {
  project: RobotProject;
  onUpdateServo: (servo: ServoMotor) => void;
  onUpdateProject: (project: RobotProject) => void;
  allProjects: RobotProject[];
  onSelectProject: (id: string) => void;
}

export const LiveSimulator: React.FC<LiveSimulatorProps> = ({
  project,
  onUpdateServo,
  onUpdateProject,
  allProjects,
  onSelectProject,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animFrameRef = useRef<number>(0);

  // Simulation mode & state
  const [simMode, setSimMode] = useState<'virtual' | 'hardware'>('virtual');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [simSpeed, setSimSpeed] = useState<number>(1.0);
  const [activeSubTab, setActiveSubTab] = useState<'viewport' | 'servos' | 'pins' | 'animation' | 'calibration'>('viewport');
  
  // Animation state
  const [animationTime, setAnimationTime] = useState<number>(0);
  const [loopAnimation, setLoopAnimation] = useState<boolean>(true);
  const [keyframes, Keyframes] = useState<{ id: string; name: string; timestampMs: number; angles: Record<string, number> }[]>([
    { id: 'kf_1', name: 'Home Pose', timestampMs: 0, angles: {} },
    { id: 'kf_2', name: 'Wave Pose', timestampMs: 1000, angles: {} },
  ]);

  // Connection & hardware status
  const [connectionStatus, setConnectionStatus] = useState(arduinoSerial.status);
  const [boardType, setBoardType] = useState(arduinoSerial.boardType);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Servo angles and calibration offsets
  const [servoOffsets, setServoOffsets] = useState<Record<string, number>>({});
  const [servoInverted, setServoInverted] = useState<Record<string, boolean>>({});

  // Refs for animation loop
  const servosRef = useRef<ServoMotor[]>(project.servos);
  servosRef.current = project.servos;
  const currentAnglesRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const unsub = arduinoSerial.addStatusListener((status) => {
      setConnectionStatus(status);
      setBoardType(arduinoSerial.boardType);
    });
    return unsub;
  }, []);

  // Initialize 3D simulation scene
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0f17);
    scene.fog = new THREE.FogExp2(0x0c0f17, 0.02);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(5, 5, 7);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 2, 0);

    // Lighting
    const ambientLight = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 1.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLight.position.set(6, 10, 6);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const grid = new THREE.GridHelper(20, 20, 0x00d2ff, 0x27324c);
    grid.position.y = 0;
    scene.add(grid);

    // Build Robot 3D Mesh from project
    const robotRoot = new THREE.Group();
    robotRoot.name = 'SIM_ROBOT_ROOT';
    scene.add(robotRoot);

    // Render Parts
    project.parts.forEach((part) => {
      let geo: THREE.BufferGeometry;
      if (part.type === 'cylinder' || part.type === 'arm' || part.type === 'leg') {
        geo = new THREE.CylinderGeometry(part.dimensions[0], part.dimensions[2], part.dimensions[1], 16);
      } else if (part.type === 'sphere') {
        geo = new THREE.SphereGeometry(part.dimensions[0], 16, 16);
      } else {
        geo = new THREE.BoxGeometry(part.dimensions[0], part.dimensions[1], part.dimensions[2]);
      }

      const mat = new THREE.MeshStandardMaterial({
        color: part.color || '#38bdf8',
        metalness: part.metalness ?? 0.5,
        roughness: part.roughness ?? 0.3,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...part.position);
      mesh.rotation.set(
        THREE.MathUtils.degToRad(part.rotation[0]),
        THREE.MathUtils.degToRad(part.rotation[1]),
        THREE.MathUtils.degToRad(part.rotation[2])
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      robotRoot.add(mesh);
    });

    // Render Servos
    project.servos.forEach((servo) => {
      const servoGroup = new THREE.Group();
      servoGroup.position.set(...servo.position);
      servoGroup.rotation.set(
        THREE.MathUtils.degToRad(servo.rotation[0]),
        THREE.MathUtils.degToRad(servo.rotation[1]),
        THREE.MathUtils.degToRad(servo.rotation[2])
      );

      const bodyGeo = new THREE.BoxGeometry(0.6, 0.8, 0.4);
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.3, roughness: 0.4 });
      const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
      servoGroup.add(bodyMesh);

      const hornPivot = new THREE.Group();
      hornPivot.position.set(0, 0.4, 0);
      const hornGeo = new THREE.BoxGeometry(0.8, 0.1, 0.2);
      const hornMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, metalness: 0.5, roughness: 0.2 });
      const hornMesh = new THREE.Mesh(hornGeo, hornMat);
      hornMesh.position.set(0, 0.05, 0);
      hornPivot.add(hornMesh);
      servoGroup.add(hornPivot);

      robotRoot.add(servoGroup);
    });

    // Resize handler
    const handleResize = () => {
      if (!mountRef.current || !renderer || !camera) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Animation render loop
    let lastTime = performance.now();
    const animate = (time: number) => {
      animFrameRef.current = requestAnimationFrame(animate);
      const delta = Math.min((time - lastTime) / 1000, 0.1) * simSpeed;
      lastTime = time;

      controls.update();
      renderer.render(scene, camera);
    };
    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [project]);

  // Handle servo angle change from slider
  const handleServoSliderChange = (servo: ServoMotor, rawAngle: number) => {
    const inverted = servoInverted[servo.id] ?? false;
    const offset = servoOffsets[servo.id] ?? 0;
    let finalAngle = inverted ? 180 - rawAngle : rawAngle;
    finalAngle = Math.max(servo.minAngle ?? 0, Math.min(servo.maxAngle ?? 180, finalAngle + offset));

    onUpdateServo({
      ...servo,
      currentAngle: finalAngle,
      targetAngle: finalAngle,
    });

    // Send to hardware if in hardware mode and connected
    if (simMode === 'hardware' && connectionStatus === 'connected') {
      arduinoSerial.setServoAngle(servo.pin, finalAngle);
      setStatusMessage(`Sent Servo [${servo.name}] Pin ${servo.pin} -> ${finalAngle}°`);
      setTimeout(() => setStatusMessage(null), 2000);
    }
  };

  const [isSlowMoving, setIsSlowMoving] = useState<boolean>(false);
  const [slowMoveProgress, setSlowMoveProgress] = useState<number>(0);
  const slowMoveAbortRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      slowMoveAbortRef.current = true;
    };
  }, []);

  const handleSlowMoveAllTo90 = async () => {
    if (isSlowMoving) {
      slowMoveAbortRef.current = true;
      setIsSlowMoving(false);
      return;
    }

    if (project.servos.length === 0) return;

    slowMoveAbortRef.current = false;
    setIsSlowMoving(true);
    setSlowMoveProgress(0);

    const startAngles: Record<string, number> = {};
    let maxDistance = 0;
    project.servos.forEach((s) => {
      const current = s.currentAngle ?? s.targetAngle ?? 90;
      startAngles[s.id] = current;
      const dist = Math.abs(current - 90);
      if (dist > maxDistance) maxDistance = dist;
    });

    if (maxDistance === 0) {
      for (const s of project.servos) {
        handleServoSliderChange(s, 90);
      }
      setIsSlowMoving(false);
      return;
    }

    const totalSteps = Math.max(30, Math.round(maxDistance * 1.5));
    const stepDelay = 45;

    for (let step = 1; step <= totalSteps; step++) {
      if (slowMoveAbortRef.current) break;

      const progress = step / totalSteps;
      setSlowMoveProgress(Math.round(progress * 100));

      for (const s of project.servos) {
        const start = startAngles[s.id] ?? 90;
        const currentInterp = Math.round(start + (90 - start) * progress);
        handleServoSliderChange(s, currentInterp);
      }

      await new Promise((resolve) => setTimeout(resolve, stepDelay));
    }

    setIsSlowMoving(false);
    setSlowMoveProgress(0);
  };

  const handleEmergencyStop = async () => {
    setIsPlaying(false);
    if (connectionStatus === 'connected') {
      await arduinoSerial.emergencyStop();
    }
    setStatusMessage('🚨 EMERGENCY STOP ENGAGED: All servos halted.');
    setTimeout(() => setStatusMessage(null), 4000);
  };

  return (
    <div className="flex-1 overflow-y-auto flex flex-col bg-[#0c0f17] text-slate-100 font-sans">
      {/* Top Simulation Bar */}
      <div className="h-14 bg-[#111625] border-b border-[#27324c] px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center">
            <Radio className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white flex items-center gap-2">
              <span>LIVE 3D ARDUINO ROBOT SIMULATOR</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-semibold">
                {simMode === 'hardware' ? 'MODE B: LIVE HARDWARE' : 'MODE A: VIRTUAL SIM'}
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">Active Project: <span className="text-cyan-300 font-semibold">{project.name}</span> ({project.servos.length} Servos, {project.parts.length} Parts)</p>
          </div>
        </div>

        {/* Mode Selector & Transport Controls */}
        <div className="flex items-center gap-3">
          <div className="flex bg-[#0c0f17] p-1 rounded-lg border border-[#27324c]">
            <button
              onClick={() => setSimMode('virtual')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                simMode === 'virtual' ? 'bg-cyan-600 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Mode A: Virtual
            </button>
            <button
              onClick={() => {
                if (connectionStatus !== 'connected') {
                  alert('Please connect Arduino hardware first in the Arduino Connection module.');
                }
                setSimMode('hardware');
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                simMode === 'hardware' ? 'bg-emerald-600 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Mode B: Live Hardware
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-[#0c0f17] px-3 py-1.5 rounded-lg border border-[#27324c]">
            <span className="text-xs text-slate-400 font-mono">Speed:</span>
            <select
              value={simSpeed}
              onChange={(e) => setSimSpeed(parseFloat(e.target.value))}
              className="bg-[#111625] text-cyan-400 font-mono text-xs px-2 py-1 rounded border border-[#27324c] outline-none"
            >
              <option value="0.5">0.5x</option>
              <option value="1.0">1.0x (Normal)</option>
              <option value="1.5">1.5x</option>
              <option value="2.0">2.0x</option>
            </select>
          </div>

          <button
            onClick={handleEmergencyStop}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider rounded-lg flex items-center gap-1.5 shadow-lg shadow-rose-950"
          >
            <AlertTriangle className="w-4 h-4" /> STOP
          </button>
        </div>
      </div>

      {/* Status Notice Toast */}
      {statusMessage && (
        <div className="bg-cyan-950/80 border-b border-cyan-800 px-6 py-2 text-cyan-300 text-xs font-mono flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sub-Navigation Sidebar */}
        <div className="w-60 bg-[#111625] border-r border-[#27324c] p-3 flex flex-col gap-1.5 shrink-0">
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider px-2 mb-1">Simulator Modules</div>
          {[
            { id: 'viewport', label: '1. 3D Viewport & Play', icon: Box },
            { id: 'servos', label: '2. Live Servo Control', icon: Sliders },
            { id: 'pins', label: '3. Arduino Pin Config', icon: Cpu },
            { id: 'animation', label: '4. Live Keyframe Studio', icon: Film },
            { id: 'calibration', label: '5. Servo Calibration', icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all text-left ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-[#181f33]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}

          <div className="mt-auto p-3 rounded-xl bg-[#0c0f17] border border-[#27324c]">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-slate-400">USB BUS</span>
              <span className={`font-mono font-bold ${connectionStatus === 'connected' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {connectionStatus.toUpperCase()}
              </span>
            </div>
            <div className="text-[10px] font-mono text-slate-500 truncate">{arduinoSerial.comPortName}</div>
          </div>
        </div>

        {/* Center Workspace Panel */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0c0f17]">
          {activeSubTab === 'viewport' && (
            <div className="flex-1 flex flex-col relative">
              <div ref={mountRef} className="flex-1 w-full h-full" />
              {/* Overlay simulation toolbar */}
              <div className="absolute bottom-6 left-6 right-6 bg-[#111625]/90 backdrop-blur-md border border-[#27324c] rounded-xl p-4 flex items-center justify-between shadow-2xl">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className={`px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all ${
                      isPlaying
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-950'
                        : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-950'
                    }`}
                  >
                    {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                    {isPlaying ? 'Pause Simulation' : 'Start Simulation'}
                  </button>

                  <button
                    onClick={() => setIsPlaying(false)}
                    className="px-4 py-2.5 bg-[#181f33] hover:bg-[#202945] text-slate-300 border border-[#27324c] rounded-lg text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Square className="w-3.5 h-3.5 text-rose-400" /> Stop
                  </button>
                </div>

                <div className="flex items-center gap-6 text-xs font-mono text-slate-400">
                  <div>Servos Active: <span className="text-cyan-400 font-bold">{project.servos.length}</span></div>
                  <div>Mesh Parts: <span className="text-cyan-400 font-bold">{project.parts.length}</span></div>
                  <div>Mode: <span className="text-emerald-400 font-bold uppercase">{simMode}</span></div>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'servos' && (
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#27324c]">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-cyan-400" />
                    Live Servo Motor Control Sliders (0° - 180°)
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Move sliders to control the 3D robot and synchronize with physical Arduino hardware in real time.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      project.servos.forEach((s) => handleServoSliderChange(s, 90));
                    }}
                    className="px-3 py-1.5 bg-[#181f33] hover:bg-[#202945] text-slate-300 border border-[#27324c] rounded-lg text-xs font-semibold"
                  >
                    All to 90°
                  </button>
                  <button
                    onClick={handleSlowMoveAllTo90}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
                      isSlowMoving
                        ? 'bg-amber-600 text-white animate-pulse'
                        : 'bg-emerald-950/70 hover:bg-emerald-900/90 text-emerald-300 border border-emerald-500/50'
                    }`}
                    title="Smoothly and slowly move all servos to 90° center"
                  >
                    <span className="text-sm">🐢</span>
                    <span>{isSlowMoving ? `Slow (${slowMoveProgress}%) - Stop` : 'Slow Move All to 90°'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {project.servos.map((servo) => {
                  const current = servo.currentAngle ?? 90;
                  return (
                    <div key={servo.id} className="bg-[#111625] border border-[#27324c] rounded-xl p-4 flex flex-col gap-3 shadow-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-sm text-white">{servo.name}</div>
                          <div className="text-[11px] font-mono text-cyan-400">Arduino Pin {servo.pin} • Model {servo.model || 'SG90'}</div>
                        </div>
                        <div className="px-2.5 py-1 bg-[#181f33] border border-[#27324c] rounded-lg text-xs font-mono text-cyan-300 font-bold">
                          {current}°
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono text-slate-500">0°</span>
                        <input
                          type="range"
                          min={servo.minAngle ?? 0}
                          max={servo.maxAngle ?? 180}
                          value={current}
                          onChange={(e) => handleServoSliderChange(servo, parseInt(e.target.value))}
                          className="flex-1 accent-cyan-500 cursor-pointer"
                        />
                        <span className="text-[10px] font-mono text-slate-500">180°</span>
                        <button
                          onClick={async () => {
                            const start = servo.currentAngle ?? servo.targetAngle ?? 90;
                            const distance = Math.abs(start - 90);
                            if (distance === 0) return;
                            const steps = Math.max(20, Math.round(distance * 1.5));
                            for (let i = 1; i <= steps; i++) {
                              const interp = Math.round(start + (90 - start) * (i / steps));
                              handleServoSliderChange(servo, interp);
                              await new Promise((r) => setTimeout(r, 45));
                            }
                          }}
                          className="px-2 py-1 text-[10px] font-bold bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 rounded border border-emerald-500/50 flex items-center gap-1 transition-colors"
                          title="Slowly ease this servo to 90°"
                        >
                          <span>🐢</span>
                          <span>Slow 90°</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeSubTab === 'pins' && (
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-cyan-400" />
                  Arduino Pin Assignment & Conflict Validation
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Configure PWM and digital pins assigned to each servo motor. Conflicts are automatically validated.
                </p>
              </div>

              <div className="bg-[#111625] border border-[#27324c] rounded-xl overflow-hidden shadow-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#27324c] text-[10px] font-mono text-slate-400 uppercase bg-[#0c0f17]">
                      <th className="py-3 px-4">Servo Name</th>
                      <th className="py-3 px-4">Model</th>
                      <th className="py-3 px-4">Arduino Pin</th>
                      <th className="py-3 px-4">Min Angle</th>
                      <th className="py-3 px-4">Max Angle</th>
                      <th className="py-3 px-4">Validation Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#27324c]/60 text-xs">
                    {project.servos.map((servo) => {
                      const duplicatePins = project.servos.filter((s) => s.pin === servo.pin).length > 1;
                      return (
                        <tr key={servo.id} className="hover:bg-[#181f33]/40">
                          <td className="py-3.5 px-4 font-semibold text-white">{servo.name}</td>
                          <td className="py-3.5 px-4 font-mono text-slate-300">{servo.model || 'SG90'}</td>
                          <td className="py-3.5 px-4">
                            <select
                              value={servo.pin}
                              onChange={(e) => {
                                const newPin = parseInt(e.target.value, 10);
                                onUpdateServo({ ...servo, pin: newPin });
                              }}
                              className="bg-[#0c0f17] text-cyan-400 font-mono text-xs px-2.5 py-1 rounded border border-[#27324c] outline-none"
                            >
                              {[3, 5, 6, 9, 10, 11].map((p) => (
                                <option key={p} value={p}>Pin {p} (PWM)</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-3.5 px-4 font-mono">{servo.minAngle ?? 0}°</td>
                          <td className="py-3.5 px-4 font-mono">{servo.maxAngle ?? 180}°</td>
                          <td className="py-3.5 px-4">
                            {duplicatePins ? (
                              <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-400 font-mono text-[10px] border border-rose-800 flex items-center gap-1 w-fit">
                                <AlertTriangle className="w-3 h-3" /> Pin Conflict
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-mono text-[10px] border border-emerald-800 flex items-center gap-1 w-fit">
                                <CheckCircle2 className="w-3 h-3" /> Valid Pin
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeSubTab === 'animation' && (
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Film className="w-5 h-5 text-cyan-400" />
                  Live Keyframe Animation Studio
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Record robot poses into keyframes and play back choreography. Physical Arduino hardware follows the timeline automatically.
                </p>
              </div>

              <div className="bg-[#111625] border border-[#27324c] rounded-xl p-5 flex flex-col gap-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-mono text-slate-400">Timeline Keyframes ({keyframes.length})</div>
                  <button
                    onClick={() => {
                      const newKf = {
                        id: `kf_${Math.random().toString(36).substring(2, 6)}`,
                        name: `Pose ${keyframes.length + 1}`,
                        timestampMs: keyframes.length * 1000,
                        angles: project.servos.reduce((acc, s) => ({ ...acc, [s.id]: s.currentAngle ?? 90 }), {}),
                      };
                      Keyframes([...keyframes, newKf]);
                    }}
                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Capture Current Pose
                  </button>
                </div>

                <div className="space-y-2">
                  {keyframes.map((kf, index) => (
                    <div key={kf.id} className="p-3.5 rounded-xl bg-[#0c0f17] border border-[#27324c] flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-white">{kf.name}</div>
                        <div className="text-[10px] font-mono text-slate-500">Timestamp: {kf.timestampMs}ms</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            project.servos.forEach((servo) => {
                              const angle = kf.angles[servo.id];
                              if (angle !== undefined) {
                                onUpdateServo({ ...servo, currentAngle: angle, targetAngle: angle });
                                if (simMode === 'hardware' && connectionStatus === 'connected') {
                                  arduinoSerial.setServoAngle(servo.pin, angle);
                                }
                              }
                            });
                            setStatusMessage(`Applied keyframe: ${kf.name}`);
                            setTimeout(() => setStatusMessage(null), 2000);
                          }}
                          className="px-3 py-1 bg-[#181f33] hover:bg-[#202945] text-cyan-300 rounded text-xs font-semibold"
                        >
                          Play Pose
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'calibration' && (
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-cyan-400" />
                  Physical Servo Calibration & Trim Offsets
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Calibrate mounting offsets and invert joint rotation directions to perfectly match the virtual model with the physical robot.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {project.servos.map((servo) => {
                  const offset = servoOffsets[servo.id] ?? 0;
                  const inverted = servoInverted[servo.id] ?? false;
                  return (
                    <div key={servo.id} className="bg-[#111625] border border-[#27324c] rounded-xl p-4 flex flex-col gap-3 shadow-lg">
                      <div className="font-bold text-sm text-white">{servo.name} (Pin {servo.pin})</div>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Trim Offset (°):</span>
                        <input
                          type="number"
                          value={offset}
                          onChange={(e) => setServoOffsets({ ...servoOffsets, [servo.id]: parseInt(e.target.value) || 0 })}
                          className="w-20 bg-[#0c0f17] text-cyan-400 font-mono text-xs px-2 py-1 rounded border border-[#27324c] text-center outline-none"
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Invert Rotation Direction:</span>
                        <input
                          type="checkbox"
                          checked={inverted}
                          onChange={(e) => setServoInverted({ ...servoInverted, [servo.id]: e.target.checked })}
                          className="accent-cyan-500 w-4 h-4 cursor-pointer"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
