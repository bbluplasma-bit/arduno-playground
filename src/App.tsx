/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { RobotProject, RobotPart, ServoMotor, PartGeometryType, MovementSequence, AppMode } from './types';
import { DEFAULT_BIPED_PROJECT, DEFAULT_ARM_PROJECT } from './data/defaultProjects';
import { arduinoSerial } from './services/arduinoSerial';
import { soundEffects } from './services/soundEffects';

// Components
import { Dashboard } from './components/Dashboard';
import { ArduinoConnection } from './components/ArduinoConnection';
import { PinController } from './components/PinController';
import { ServoController } from './components/ServoController';
import { ThreeRobotStudio } from './components/ThreeRobotStudio';
import { MovementStudio } from './components/MovementStudio';
import { ElectronicsPlayground } from './components/ElectronicsPlayground';
import { CodeStudio } from './components/CodeStudio';
import { AIAssistant } from './components/AIAssistant';
import { ProjectsPanel } from './components/ProjectsPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { SpotifySync } from './components/SpotifySync';
import { LiveSimulator } from './components/LiveSimulator';
import { RockPaperScissors } from './components/RockPaperScissors';
import { BlockCodingStudio } from './components/BlockCodingStudio';
import { BuzzerPlayground } from './components/BuzzerPlayground';
import { RoboBuddy } from './components/RoboBuddy';
import { ExpertHud } from './components/ExpertHud';
import { ParticleBackground } from './components/ParticleBackground';

// Icons
import {
  LayoutDashboard,
  Usb,
  Sliders,
  Cpu,
  Layers,
  Film,
  Zap,
  Code,
  Sparkles,
  FolderOpen,
  Settings,
  AlertTriangle,
  Minus,
  Square,
  X,
  Radio,
  CheckCircle2,
  Search,
  Music,
  Gamepad2,
  Blocks,
  Volume2,
  Menu,
  // Vibrant, rounded playful Lucide icons for Kid Mode:
  Rocket,
  PlugZap,
  Lightbulb,
  Bot,
  Boxes,
  PartyPopper,
  Atom,
  Laptop,
  Wand2,
  Trophy,
  Headphones,
  Dices,
  Puzzle,
  Wrench,
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [moduleSearchQuery, setModuleSearchQuery] = useState<string>('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Auto-saved projects from localStorage
  const [projects, setProjects] = useState<RobotProject[]>(() => {
    const deduplicateProjects = (list: RobotProject[]): RobotProject[] => {
      const seen = new Set<string>();
      return list.map((p, idx) => {
        if (!p.id || seen.has(p.id)) {
          const newId = `proj_dedup_${idx}_${Math.random().toString(36).substring(2, 7)}`;
          return { ...p, id: newId };
        }
        seen.add(p.id);
        return p;
      });
    };

    try {
      const savedActive = localStorage.getItem('acs_active_project_state');
      const savedProjects = localStorage.getItem('acs_projects_state');
      if (savedActive) {
        const parsedActive = JSON.parse(savedActive);
        if (parsedActive && parsedActive.id) {
          if (savedProjects) {
            const parsedList: RobotProject[] = JSON.parse(savedProjects);
            if (Array.isArray(parsedList) && parsedList.length > 0) {
              const exists = parsedList.some((p) => p.id === parsedActive.id);
              const list = exists
                ? parsedList.map((p) => (p.id === parsedActive.id ? parsedActive : p))
                : [parsedActive, ...parsedList];
              return deduplicateProjects(list);
            }
          }
          return deduplicateProjects([parsedActive, DEFAULT_ARM_PROJECT]);
        }
      } else if (savedProjects) {
        const parsedList = JSON.parse(savedProjects);
        if (Array.isArray(parsedList) && parsedList.length > 0) {
          return deduplicateProjects(parsedList);
        }
      }
    } catch (err) {
      console.warn('Auto-save load failed:', err);
    }
    return deduplicateProjects([DEFAULT_BIPED_PROJECT, DEFAULT_ARM_PROJECT]);
  });

  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    try {
      const savedActive = localStorage.getItem('acs_active_project_state');
      if (savedActive) {
        const parsed = JSON.parse(savedActive);
        if (parsed?.id) return parsed.id;
      }
      const savedId = localStorage.getItem('acs_active_project_id');
      if (savedId) return savedId;
    } catch {
      // fallback
    }
    return DEFAULT_BIPED_PROJECT.id;
  });

  // Undo / Redo history stack
  const [history, setHistory] = useState<RobotProject[]>([]);
  const [future, setFuture] = useState<RobotProject[]>([]);

  // Selected elements in 3D builder
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [selectedServoId, setSelectedServoId] = useState<string | null>(null);

  // Connection status in top bar
  const [connectionStatus, setConnectionStatus] = useState(arduinoSerial.status);
  const [boardType, setBoardType] = useState(arduinoSerial.boardType);

  // Auto-save feedback state
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  useEffect(() => {
    const unsub = arduinoSerial.addStatusListener((status) => {
      setConnectionStatus(status);
      setBoardType(arduinoSerial.boardType);
    });
    return unsub;
  }, []);

  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0];

  // Periodic and change-based auto-save to localStorage
  useEffect(() => {
    if (!activeProject) return;

    const saveCurrentState = () => {
      try {
        const serialized = JSON.stringify(activeProject);
        localStorage.setItem('acs_active_project_state', serialized);
        localStorage.setItem('acs_active_project_id', activeProject.id);
        localStorage.setItem('acs_projects_state', JSON.stringify(projects));
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastSaved(timeStr);
      } catch (err) {
        console.warn('Auto-save to localStorage failed:', err);
      }
    };

    // Debounced auto-save on changes (800ms)
    const debounceTimer = setTimeout(saveCurrentState, 800);

    // Periodic interval auto-save (every 10s)
    const intervalTimer = setInterval(saveCurrentState, 10000);

    // Immediate auto-save before closing or refreshing browser
    const handleBeforeUnload = () => {
      saveCurrentState();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearTimeout(debounceTimer);
      clearInterval(intervalTimer);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [activeProject, projects]);

  const pushStateToHistory = (newProject: RobotProject) => {
    setHistory((prev) => [...prev.slice(-25), activeProject]);
    setFuture([]);
    setProjects((prev) => prev.map((p) => (p.id === newProject.id ? newProject : p)));
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setFuture((prev) => [activeProject, ...prev]);
    setProjects((prev) => prev.map((p) => (p.id === previous.id ? previous : p)));
  };

  const handleRedo = () => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((prev) => prev.slice(1));
    setHistory((prev) => [...prev, activeProject]);
    setProjects((prev) => prev.map((p) => (p.id === next.id ? next : p)));
  };

  // 3D Robot Builder Part actions
  const handleUpdatePart = (updatedPart: RobotPart) => {
    const updatedParts = activeProject.parts.map((p) => (p.id === updatedPart.id ? updatedPart : p));
    pushStateToHistory({ ...activeProject, parts: updatedParts });
  };

  const handleAddPart = (type: PartGeometryType) => {
    const newId = `part_${Math.random().toString(36).substring(2, 7)}`;
    
    let defaultDimensions: [number, number, number] = [1.0, 1.0, 1.0];
    let defaultColor = '#38bdf8';
    let defaultName = `New ${type.toUpperCase()}`;

    switch (type) {
      case 'cylinder':
      case 'arm':
      case 'leg':
        defaultDimensions = [0.4, 2.0, 0.4];
        break;
      case 'arduino_uno':
        defaultName = 'Arduino Uno R3 Board';
        defaultDimensions = [2.7, 0.4, 2.1];
        defaultColor = '#00878f';
        break;
      case 'microbit':
        defaultName = 'BBC micro:bit V2';
        defaultDimensions = [2.0, 0.3, 1.6];
        defaultColor = '#18181b';
        break;
      case 'breadboard':
        defaultName = 'Breadboard Small';
        defaultDimensions = [3.2, 0.4, 2.2];
        defaultColor = '#f8fafc';
        break;
      case 'sensor_ultrasonic':
        defaultName = 'HC-SR04 Ultrasonic Sensor';
        defaultDimensions = [1.8, 0.8, 0.8];
        defaultColor = '#0284c7';
        break;
      case 'sensor_pir':
        defaultName = 'PIR Motion Sensor';
        defaultDimensions = [1.2, 1.0, 1.2];
        defaultColor = '#22c55e';
        break;
      case 'sensor_ldr':
        defaultName = 'Photoresistor LDR';
        defaultDimensions = [0.4, 0.6, 0.4];
        defaultColor = '#f59e0b';
        break;
      case 'piezo_buzzer':
        defaultName = 'Piezo Buzzer Speaker';
        defaultDimensions = [0.8, 0.5, 0.8];
        defaultColor = '#0f172a';
        break;
      case 'led':
        defaultName = 'Red 5mm LED';
        defaultDimensions = [0.4, 0.8, 0.4];
        defaultColor = '#ef4444';
        break;
      case 'battery_9v':
        defaultName = '9V Power Battery';
        defaultDimensions = [1.0, 1.8, 0.7];
        defaultColor = '#0f172a';
        break;
      case 'battery_coin':
        defaultName = '3V CR2032 Coin Cell';
        defaultDimensions = [0.8, 0.3, 0.8];
        defaultColor = '#94a3b8';
        break;
      case 'multimeter':
        defaultName = 'Digital Multimeter';
        defaultDimensions = [1.8, 2.4, 0.8];
        defaultColor = '#eab308';
        break;
      case 'gearmotor':
        defaultName = 'TT Gearmotor';
        defaultDimensions = [1.2, 2.2, 0.9];
        defaultColor = '#eab308';
        break;
      case 'dc_motor':
        defaultName = 'Micro DC Motor';
        defaultDimensions = [0.8, 1.6, 0.8];
        defaultColor = '#94a3b8';
        break;
      case 'potentiometer':
        defaultName = '10K Potentiometer';
        defaultDimensions = [0.7, 0.9, 0.7];
        defaultColor = '#0284c7';
        break;
      case 'switch_slide':
        defaultName = 'Slide Switch';
        defaultDimensions = [0.7, 0.5, 0.4];
        defaultColor = '#475569';
        break;
      case 'pushbutton':
        defaultName = 'Tactile Pushbutton';
        defaultDimensions = [0.6, 0.5, 0.6];
        defaultColor = '#1e293b';
        break;
      case 'resistor':
        defaultName = '220 Ohm Resistor';
        defaultDimensions = [0.2, 0.8, 0.2];
        defaultColor = '#d97706';
        break;
      case 'capacitor':
        defaultName = '10uF Capacitor';
        defaultDimensions = [0.3, 0.7, 0.3];
        defaultColor = '#1e40af';
        break;
    }

    const newPart: RobotPart = {
      id: newId,
      name: defaultName,
      type,
      dimensions: defaultDimensions,
      position: [0, 2.0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: defaultColor,
      metalness: 0.5,
      roughness: 0.3,
      parentId: null,
    };
    pushStateToHistory({ ...activeProject, parts: [...activeProject.parts, newPart] });
    setSelectedPartId(newId);
  };

  const handleDeletePart = (id: string) => {
    // 1. Remove the part and reset parentId on any child parts that were attached to it
    const updatedParts = activeProject.parts
      .filter((p) => p.id !== id)
      .map((p) => (p.parentId === id ? { ...p, parentId: null } : p));

    // 2. Clear any servo constraints (attachedPartId or parentPartId)
    const updatedServos = activeProject.servos.map((s) => ({
      ...s,
      attachedPartId: s.attachedPartId === id ? null : s.attachedPartId,
      parentPartId: s.parentPartId === id ? null : s.parentPartId,
    }));

    pushStateToHistory({ ...activeProject, parts: updatedParts, servos: updatedServos });
    if (selectedPartId === id) setSelectedPartId(null);
  };

  const handleDuplicatePart = (id: string) => {
    const target = activeProject.parts.find((p) => p.id === id);
    if (!target) return;
    const newId = `part_${Math.random().toString(36).substring(2, 7)}`;
    const duplicated: RobotPart = {
      ...target,
      id: newId,
      name: `${target.name} (Copy)`,
      position: [target.position[0] + 0.6, target.position[1], target.position[2] + 0.6],
    };
    pushStateToHistory({ ...activeProject, parts: [...activeProject.parts, duplicated] });
    setSelectedPartId(newId);
  };

  // 3D Servo Motor Actions
  const handleUpdateServo = (updatedServo: ServoMotor) => {
    const updatedServos = activeProject.servos.map((s) => (s.id === updatedServo.id ? updatedServo : s));
    setProjects((prev) =>
      prev.map((p) => (p.id === activeProject.id ? { ...activeProject, servos: updatedServos } : p))
    );
  };

  const handleBatchUpdate = (update: { parts?: RobotPart[]; servos?: ServoMotor[] }) => {
    let nextParts = activeProject.parts;
    let nextServos = activeProject.servos;
    if (update.parts) {
      const pMap = new Map(update.parts.map((p) => [p.id, p]));
      nextParts = activeProject.parts.map((p) => pMap.get(p.id) || p);
    }
    if (update.servos) {
      const sMap = new Map(update.servos.map((s) => [s.id, s]));
      nextServos = activeProject.servos.map((s) => sMap.get(s.id) || s);
    }
    pushStateToHistory({ ...activeProject, parts: nextParts, servos: nextServos });
  };

  const handleAddServo = () => {
    // Pick first unused pin between 3, 5, 6, 9, 10, 11
    const usedPins = new Set(activeProject.servos.map((s) => s.pin));
    const candidatePins = [9, 10, 5, 6, 3, 11, 4, 7, 8];
    const pin = candidatePins.find((p) => !usedPins.has(p)) || 9;

    const newId = `servo_${Math.random().toString(36).substring(2, 7)}`;
    const newServo: ServoMotor = {
      id: newId,
      name: `Servo Motor (Pin ${pin})`,
      pin,
      currentAngle: 90,
      targetAngle: 90,
      minAngle: 0,
      maxAngle: 180,
      trim: 0,
      speed: 180,
      rotationAxis: 'y',
      model: 'SG90',
      position: [0, 2.5, 0],
      rotation: [0, 0, 0],
      attachedPartId: null,
      parentPartId: null,
    };
    pushStateToHistory({ ...activeProject, servos: [...activeProject.servos, newServo] });
    setSelectedServoId(newId);
  };

  const handleDeleteServo = (id: string) => {
    const updatedServos = activeProject.servos.filter((s) => s.id !== id);
    const updatedParts = activeProject.parts.map((p) =>
      p.servoId === id ? { ...p, servoId: undefined } : p
    );
    pushStateToHistory({ ...activeProject, servos: updatedServos, parts: updatedParts });
    if (selectedServoId === id) setSelectedServoId(null);
  };

  // Sequencer sequences
  const handleUpdateSequences = (seqs: MovementSequence[]) => {
    pushStateToHistory({ ...activeProject, sequences: seqs });
  };

  // AI load robot
  const handleLoadGeneratedRobot = (robotData: any) => {
    const newProject: RobotProject = {
      id: `ai_proj_${Math.random().toString(36).substring(2, 7)}`,
      name: robotData.name || 'AI Mechanical Robot',
      description: robotData.description || 'Generated by Arduino Control Studio AI',
      boardType: 'uno',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      parts: robotData.parts || [],
      servos: robotData.servos || [],
      sequences: robotData.initialSequence
        ? [
            {
              id: 'seq_ai_1',
              name: 'AI Routine',
              keyframes: robotData.initialSequence.map((step: any, i: number) => ({
                id: `kf_${i}`,
                name: step.name || `Step ${i + 1}`,
                timestampMs: i * (step.durationMs || 500),
                durationMs: step.durationMs || 500,
                angles: step.angles || {},
              })),
              loop: true,
              speedMultiplier: 1.0,
            },
          ]
        : [],
      customCode: robotData.arduinoCode || '// Generated code\n',
    };

    setProjects((prev) => [newProject, ...prev]);
    setActiveProjectId(newProject.id);
  };

  const [appMode, setAppMode] = useState<AppMode>(() => {
    try {
      const saved = localStorage.getItem('acs_app_mode');
      if (saved === 'kid' || saved === 'standard' || saved === 'expert') return saved;
      const oldKid = localStorage.getItem('acs_is_kid_mode');
      if (oldKid === 'false') return 'standard';
    } catch {}
    return 'standard';
  });

  const isKidMode = appMode === 'kid';
  const isExpertMode = appMode === 'expert';
  const [isExpertHudOpen, setIsExpertHudOpen] = useState<boolean>(false);

  const handleSetAppMode = (mode: AppMode) => {
    setAppMode(mode);
    try {
      localStorage.setItem('acs_app_mode', mode);
    } catch {}
  };

  const navItems = [
    {
      id: 'dashboard',
      label: '1. 🚀 Robot Base (Dashboard)',
      kidLabel: '1. 🚀 Robot Launchpad',
      icon: LayoutDashboard,
      kidIcon: Rocket,
      kidGradient: 'from-amber-400 via-orange-500 to-rose-500',
      kidShadow: 'shadow-orange-500/30 ring-amber-300/40',
      kidBadge: 'LAUNCH',
      kidBadgeClass: 'bg-orange-500/20 text-orange-300 border-orange-400/40',
      tags: 'overview telemetry status a0 analog sensors monitor launchpad home'
    },
    {
      id: 'connection',
      label: '2. 🔌 Arduino Connect',
      kidLabel: '2. 🔌 Plug In Robot',
      icon: Usb,
      kidIcon: PlugZap,
      kidGradient: 'from-emerald-400 via-teal-500 to-cyan-500',
      kidShadow: 'shadow-emerald-500/30 ring-emerald-300/40',
      kidBadge: 'PLUG IN',
      kidBadgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
      tags: 'serial usb com port baudrate web serial connect hardware plug'
    },
    {
      id: 'pins',
      label: '3. 💡 Pin Controls (LEDs)',
      kidLabel: '3. 💡 Blinking Lights & LEDs',
      icon: Sliders,
      kidIcon: Lightbulb,
      kidGradient: 'from-yellow-300 via-amber-400 to-orange-400 text-slate-950',
      kidShadow: 'shadow-yellow-400/40 ring-yellow-200/50',
      kidBadge: 'LIGHTS',
      kidBadgeClass: 'bg-yellow-500/20 text-yellow-300 border-yellow-400/40',
      tags: 'digital pwm analog gpio read write registers d2 d3 d4 d5 d6 d7 d8 d9 d10 d11 d12 d13 a0 a1 a2 a3 a4 a5 lights'
    },
    {
      id: 'servos',
      label: '4. ⚙️ Servo Steering',
      kidLabel: '4. 🦾 Robot Muscles & Servos',
      icon: Cpu,
      kidIcon: Bot,
      kidGradient: 'from-purple-400 via-indigo-500 to-blue-500',
      kidShadow: 'shadow-purple-500/30 ring-purple-300/40',
      kidBadge: 'MOTORS',
      kidBadgeClass: 'bg-purple-500/20 text-purple-300 border-purple-400/40',
      tags: 'servo motors sg90 mg996 angles poses sweep speed calibration steering muscles'
    },
    {
      id: 'builder',
      label: '5. 🎨 3D Robot Creator',
      kidLabel: '5. 🎨 3D Robot Builder',
      icon: Layers,
      kidIcon: Boxes,
      kidGradient: 'from-cyan-400 via-sky-500 to-blue-600',
      kidShadow: 'shadow-cyan-400/40 ring-cyan-200/50',
      kidBadge: '3D BUILD',
      kidBadgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40',
      highlight: true,
      tags: '3d viewport model parts kinematics transform drag rotate connect snap delete joint creator builder'
    },
    {
      id: 'simulator',
      label: '6. 🎮 Live 3D Simulator',
      kidLabel: '6. 🎮 Play in 3D Sim',
      icon: Radio,
      kidIcon: Gamepad2,
      kidGradient: 'from-lime-400 via-emerald-500 to-teal-600 text-slate-950',
      kidShadow: 'shadow-lime-500/30 ring-lime-300/40',
      kidBadge: 'PLAY SIM',
      kidBadgeClass: 'bg-lime-500/20 text-lime-300 border-lime-400/40',
      highlight: true,
      tags: 'simulator live hardware usb arduino 3d kinematics physics animation calibration play'
    },
    {
      id: 'movement',
      label: '7. 🕺 Dance & Motion Studio',
      kidLabel: '7. 🕺 Dance Moves & Tricks',
      icon: Film,
      kidIcon: PartyPopper,
      kidGradient: 'from-pink-400 via-rose-500 to-purple-600',
      kidShadow: 'shadow-pink-500/30 ring-pink-300/40',
      kidBadge: 'DANCE',
      kidBadgeClass: 'bg-pink-500/20 text-pink-300 border-pink-400/40',
      tags: 'sequencer animation choreography timeline keyframes playback pose dance party'
    },
    {
      id: 'electronics',
      label: '8. ⚡ Circuit Playground',
      kidLabel: '8. ⚡ Sparky Circuit Lab',
      icon: Zap,
      kidIcon: Atom,
      kidGradient: 'from-amber-400 via-orange-500 to-red-500',
      kidShadow: 'shadow-amber-500/30 ring-amber-300/40',
      kidBadge: 'SPARKS',
      kidBadgeClass: 'bg-orange-500/20 text-orange-300 border-orange-400/40',
      tags: 'breadboard schematics circuits wiring leds resistors components spark'
    },
    {
      id: 'code',
      label: '9. 📜 Arduino C++ Code',
      kidLabel: '9. 💻 Robot Brain Code',
      icon: Code,
      kidIcon: Laptop,
      kidGradient: 'from-sky-400 via-blue-500 to-indigo-600',
      kidShadow: 'shadow-sky-500/30 ring-sky-300/40',
      kidBadge: 'C++ CODE',
      kidBadgeClass: 'bg-sky-500/20 text-sky-300 border-sky-400/40',
      tags: 'arduino c c++ firmware compilation flash upload sketch ide terminal program'
    },
    {
      id: 'ai',
      label: '10. ✨ AI Robot Assistant',
      kidLabel: '10. ✨ Magic Robot Genie',
      icon: Sparkles,
      kidIcon: Wand2,
      kidGradient: 'from-fuchsia-400 via-purple-500 to-pink-500',
      kidShadow: 'shadow-fuchsia-500/30 ring-fuchsia-300/40',
      kidBadge: 'MAGIC AI',
      kidBadgeClass: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-400/40',
      accent: true,
      tags: 'gemini generative robot assembly troubleshooter ai assistant magic genie'
    },
    {
      id: 'projects',
      label: '11. 🏆 Projects & Trophies',
      kidLabel: '11. 🏆 Trophy Room & Saves',
      icon: FolderOpen,
      kidIcon: Trophy,
      kidGradient: 'from-yellow-400 via-amber-400 to-orange-400 text-slate-950',
      kidShadow: 'shadow-yellow-500/30 ring-yellow-200/50',
      kidBadge: 'TROPHIES',
      kidBadgeClass: 'bg-yellow-500/20 text-yellow-300 border-yellow-400/40',
      tags: 'save load export import biped robotic arm templates gist github trophies'
    },
    {
      id: 'spotify',
      label: '12. 🎧 Spotify Dance Party',
      kidLabel: '12. 🎧 DJ Robot Dance Party',
      icon: Music,
      kidIcon: Headphones,
      kidGradient: 'from-emerald-400 via-green-500 to-teal-500 text-slate-950',
      kidShadow: 'shadow-green-500/30 ring-green-300/40',
      kidBadge: 'PARTY',
      kidBadgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
      accent: true,
      tags: 'spotify music audio dance sync beat tempo rhythm dj disco party'
    },
    {
      id: 'rps',
      label: '13. ✊ Rock Paper Scissors Bot',
      kidLabel: '13. ✊ Rock Paper Scissors Game',
      icon: Gamepad2,
      kidIcon: Dices,
      kidGradient: 'from-rose-400 via-red-500 to-orange-500',
      kidShadow: 'shadow-rose-500/30 ring-rose-300/40',
      kidBadge: 'GAME',
      kidBadgeClass: 'bg-rose-500/20 text-rose-300 border-rose-400/40',
      accent: true,
      tags: 'rock paper scissors game bot showdown gesture play match'
    },
    {
      id: 'block_coding',
      label: '14. 🧩 Scratch Block Coding',
      kidLabel: '14. 🧩 Scratch Block Puzzles',
      icon: Blocks,
      kidIcon: Puzzle,
      kidGradient: 'from-blue-400 via-indigo-500 to-violet-600',
      kidShadow: 'shadow-blue-500/30 ring-blue-300/40',
      kidBadge: 'BLOCKS',
      kidBadgeClass: 'bg-blue-500/20 text-blue-300 border-blue-400/40',
      accent: true,
      tags: 'scratch block coding visual programming logic arduino puzzle'
    },
    {
      id: 'buzzer',
      label: '15. 🎵 100-Song Jukebox Studio',
      kidLabel: '15. 🎵 Fun 100-Song Jukebox',
      icon: Volume2,
      kidIcon: Radio,
      kidGradient: 'from-amber-400 via-orange-500 to-pink-500',
      kidShadow: 'shadow-orange-500/30 ring-orange-300/40',
      kidBadge: 'JUKEBOX',
      kidBadgeClass: 'bg-orange-500/20 text-orange-300 border-orange-400/40',
      accent: true,
      tags: 'buzzer piezo music tone pitches sound audio Mario melody frequency jukebox'
    },
    {
      id: 'settings',
      label: '16. 🛠️ Workshop Settings',
      kidLabel: '16. 🛠️ Robot Toolbox & Setup',
      icon: Settings,
      kidIcon: Wrench,
      kidGradient: 'from-teal-400 via-cyan-500 to-blue-600',
      kidShadow: 'shadow-teal-500/30 ring-teal-300/40',
      kidBadge: 'TOOLS',
      kidBadgeClass: 'bg-teal-500/20 text-teal-300 border-teal-400/40',
      tags: 'preferences theme serial config defaults baud settings tools'
    },
  ];

  const filteredNavItems = navItems.filter((item) => {
    if (!moduleSearchQuery.trim()) return true;
    const q = moduleSearchQuery.toLowerCase().trim();
    return (
      item.label.toLowerCase().includes(q) ||
      item.kidLabel.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q) ||
      item.tags.toLowerCase().includes(q)
    );
  });

  const [theme, setTheme] = useState<'modern' | 'vibrant' | 'minimal'>(() => {
    try {
      return (localStorage.getItem('acs_theme') as any) || 'modern';
    } catch { return 'modern'; }
  });
  const [uiDensity, setUiDensity] = useState<'compact' | 'comfortable' | 'spacious'>(() => {
    try {
      return (localStorage.getItem('acs_ui_density') as any) || 'comfortable';
    } catch { return 'comfortable'; }
  });

  const handleSetTheme = (newTheme: 'modern' | 'vibrant' | 'minimal') => {
    setTheme(newTheme);
    localStorage.setItem('acs_theme', newTheme);
  };
  const handleSetUiDensity = (newDensity: 'compact' | 'comfortable' | 'spacious') => {
    setUiDensity(newDensity);
    localStorage.setItem('acs_ui_density', newDensity);
  };
  const [accentColor, setAccentColor] = useState<string>(() => localStorage.getItem('acs_accent_color') || '#06b6d4');
  const [sidebarOpacity, setSidebarOpacity] = useState<number>(() => parseFloat(localStorage.getItem('acs_sidebar_opacity') || '1'));
  const [cornerRadius, setCornerRadius] = useState<string>(() => localStorage.getItem('acs_corner_radius') || '12px');
  const [particlesEnabled, setParticlesEnabled] = useState<boolean>(() => localStorage.getItem('acs_particles_enabled') === 'true');
  const [mobileViewportEnabled, setMobileViewportEnabled] = useState<boolean>(() => localStorage.getItem('acs_mobile_viewport') === 'true');
  const [colorScheme, setColorScheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('acs_color_scheme') as any) || 'dark');

  const handleSetAccentColor = (color: string) => { setAccentColor(color); localStorage.setItem('acs_accent_color', color); };
  const handleSetSidebarOpacity = (opacity: number) => { setSidebarOpacity(opacity); localStorage.setItem('acs_sidebar_opacity', opacity.toString()); };
  const handleSetCornerRadius = (radius: string) => { setCornerRadius(radius); localStorage.setItem('acs_corner_radius', radius); };
  const handleSetParticlesEnabled = (enabled: boolean) => { setParticlesEnabled(enabled); localStorage.setItem('acs_particles_enabled', enabled.toString()); };
  const handleSetMobileViewportEnabled = (enabled: boolean) => { setMobileViewportEnabled(enabled); localStorage.setItem('acs_mobile_viewport', enabled.toString()); };
  const handleSetColorScheme = (scheme: 'dark' | 'light') => { setColorScheme(scheme); localStorage.setItem('acs_color_scheme', scheme); };

  return (
    <div 
      onClick={(e) => {
        const target = e.target as HTMLElement;
        const button = target.closest('button');
        const input = target.closest('input');
        const select = target.closest('select');

        if (button) {
          if (button.classList.contains('bg-rose-600') || button.classList.contains('bg-rose-500')) {
            soundEffects.playClick(350, 0.08, 0.15); // Deeper click for destructive/stop
          } else if (button.classList.contains('bg-emerald-500') || button.classList.contains('bg-emerald-600')) {
            soundEffects.playSuccess(); // Melodic click for start/success
          } else {
            soundEffects.playClick(650, 0.035, 0.12); // Standard click
          }
        } else if (input || select) {
          soundEffects.playPop(400, 600, 0.04); // Pop for inputs
        } else if (target.closest('[role="button"]')) {
          soundEffects.playClick(500, 0.04, 0.1);
        }
      }}
      className={`w-screen h-screen flex flex-col overflow-hidden font-sans antialiased transition-colors duration-300 ${colorScheme} ${
        colorScheme === 'light' ? 'bg-slate-50 text-slate-900' : 'bg-[#0a0c14] text-slate-200'
      }`}
      style={{
        '--accent-color': accentColor,
        '--sidebar-opacity': sidebarOpacity,
        '--corner-radius': cornerRadius,
      } as React.CSSProperties}
    >
      <ParticleBackground enabled={particlesEnabled} />
      {/* Desktop Window Title Bar - refined */}
      <div className={`h-10 flex items-center justify-between px-3 md:px-4 select-none z-50 border-b transition-colors duration-300 ${
        colorScheme === 'light' 
          ? 'bg-white border-slate-200' 
          : 'bg-[#0e111d] border-slate-800/60'
      }`}>
        <div className="flex items-center gap-2">
          {/* Mobile Drawer Hamburger Toggle Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-1 bg-[#181f33] hover:bg-[#232c46] text-slate-200 rounded border border-[#27324c] flex items-center justify-center shrink-0"
            title="Toggle Mobile Drawer Menu"
          >
            {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          {/* Logo Icon */}
          <div className="w-4 h-4 rounded bg-cyan-500/20 border border-cyan-400 flex items-center justify-center shrink-0">
            <Radio className="w-2.5 h-2.5 text-cyan-400" />
          </div>
          <span className="font-bold text-xs text-white tracking-wide truncate">
            ARDUINO CONTROL STUDIO
          </span>
          <span className="hidden sm:inline-block text-[10px] text-cyan-400/80 font-mono px-1.5 py-0.2 rounded bg-cyan-950/80 border border-cyan-800/60">
            PRO v2.4
          </span>
        </div>

        {/* Center: Current Project & Board Badge */}
        <div className="hidden md:flex items-center gap-2 text-xs">
          <span className="text-slate-400">Project:</span>
          <span className="text-white font-medium">{activeProject.name}</span>
          {lastSaved && (
            <span
              className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.2 rounded"
              title={`Auto-saved to localStorage at ${lastSaved}`}
            >
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
              <span>Auto-saved</span>
            </span>
          )}
          <span className="text-slate-600">•</span>
          <div
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono ${
              connectionStatus === 'connected'
                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800'
                : 'bg-[#181f33] text-slate-400 border border-[#27324c]'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                connectionStatus === 'connected' ? 'bg-emerald-400' : 'bg-rose-500'
              }`}
            />
            <span>{arduinoSerial.comPortName}</span>
          </div>
        </div>

        {/* Right: Kid Mode Toggle, Emergency Stop & Desktop Controls */}
        <div className="flex items-center gap-2.5">
          {/* Kid Mode Quick Toggle Pill */}
          <button
            onClick={() => handleSetAppMode(isKidMode ? 'standard' : 'kid')}
            className={`px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-md ${
              isKidMode
                ? 'bg-gradient-to-r from-amber-400 via-pink-500 to-purple-500 text-white shadow-amber-500/30 ring-2 ring-amber-300/60 hover:brightness-110 active:scale-95'
                : 'bg-[#181f33] hover:bg-[#232c46] text-slate-300 border border-[#27324c] hover:border-cyan-500/50'
            }`}
            title={isKidMode ? 'Switch to Pro Engineering Mode' : 'Switch to Playful Kid Mode'}
          >
            <span className="text-sm">{isKidMode ? '🎈' : '⚙️'}</span>
            <span>{isKidMode ? 'KID MODE: ON' : 'PRO MODE'}</span>
          </button>

          <button
            onClick={() => arduinoSerial.emergencyStop()}
            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] uppercase tracking-wider rounded flex items-center gap-1 shadow-md shadow-rose-950"
            title="Immediately Stop & Detach Servos"
          >
            <AlertTriangle className="w-3 h-3" />
            STOP
          </button>

          {/* Window Control Glyphs */}
          <div className="flex items-center gap-1 text-slate-500">
            <button className="p-1 hover:text-white hover:bg-slate-800 rounded">
              <Minus className="w-3 h-3" />
            </button>
            <button className="p-1 hover:text-white hover:bg-slate-800 rounded">
              <Square className="w-3 h-3" />
            </button>
            <button className="p-1 hover:text-white hover:bg-rose-600 rounded">
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Studio Body: Sidebar + Viewport / Panel */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Slide-Over Drawer Overlay */}
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
            />
            {/* Slide Drawer Content */}
            <div className={`relative w-72 max-w-[85vw] h-full flex flex-col z-10 shadow-2xl transition-colors duration-300 ${
              colorScheme === 'light' ? 'bg-white text-slate-900 border-r border-slate-200' : 'bg-[#0e111d] text-slate-200 border-r border-slate-800'
            }`}>
              <div className="p-3.5 border-b border-slate-800/60 flex items-center justify-between bg-[#121625]">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    {isKidMode ? '🌟 Kid Modules' : 'Studio Modules'}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                    {navItems.length}
                  </span>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white bg-[#181f33] rounded-lg border border-[#27324c]"
                  title="Close Drawer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-1.5">
                {filteredNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                        isActive
                          ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40 shadow-sm'
                          : 'text-slate-300 hover:bg-[#181f33] hover:text-white'
                      }`}
                    >
                      <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                      <span className="truncate text-sm">{isKidMode ? item.kidLabel : item.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="p-3 border-t border-[#27324c]/60 bg-[#0d121f] text-xs">
                <button
                  onClick={() => {
                    handleSetAppMode(isKidMode ? 'standard' : 'kid');
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full py-2 bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  <span>{isKidMode ? '⚙️ Switch to Pro Mode' : '🎈 Switch to Kid Mode'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Sidebar (Desktop View) */}
        <div 
          className={`hidden md:flex w-64 flex-col shrink-0 transition-all duration-300 ${
            colorScheme === 'light'
              ? 'bg-white border-r border-slate-200'
              : 'bg-[#0e111d] border-r border-slate-800/60'
          }`}
          style={{
            opacity: 'var(--sidebar-opacity)',
            borderRadius: '0 var(--corner-radius) var(--corner-radius) 0'
          } as React.CSSProperties}
        >
          {/* Sidebar Header with Search Filter */}
          <div className={`p-3 border-b ${
            theme === 'minimal'
              ? 'border-slate-200'
              : 'border-slate-800/60 bg-[#121625]/40'
          }`}>
            <div className="flex items-center justify-between">
              {isKidMode ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-sm animate-bounce">🌟</span>
                  <span className="text-[11px] font-black bg-gradient-to-r from-amber-300 via-pink-400 to-cyan-300 bg-clip-text text-transparent uppercase tracking-wider">
                    Kid Modules
                  </span>
                </div>
              ) : (
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
                  Studio Modules
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                    isKidMode
                      ? 'text-amber-300 bg-amber-950/80 border border-amber-800/60'
                      : 'text-cyan-400/90 bg-cyan-950/70 border border-cyan-800/60'
                  }`}
                >
                  {filteredNavItems.length} / {navItems.length}
                </span>
                <button
                  onClick={() => handleSetAppMode(isKidMode ? 'standard' : 'kid')}
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-all ${
                    isKidMode
                      ? 'bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 hover:brightness-110 shadow-sm'
                      : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
                  }`}
                  title="Toggle Kid Mode / Pro Mode"
                >
                  {isKidMode ? '🎈 Kid' : '⚙️ Pro'}
                </button>
              </div>
            </div>

            {/* Quick Search Input */}
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={moduleSearchQuery}
                onChange={(e) => setModuleSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filteredNavItems.length > 0) {
                    setActiveTab(filteredNavItems[0].id);
                  } else if (e.key === 'Escape') {
                    setModuleSearchQuery('');
                  }
                }}
                placeholder={isKidMode ? 'Search fun robot activities... 🔍' : 'Search modules...'}
                className={`w-full border rounded-lg pl-9 pr-8 py-2 text-xs placeholder-slate-500 outline-none transition-all ${
                  colorScheme === 'light'
                    ? 'bg-slate-100 border-slate-200 text-slate-800 focus:border-slate-400'
                    : 'bg-[#0a0c14] border-slate-800 text-slate-200 focus:border-cyan-500/50'
                }`}
              />
              {moduleSearchQuery && (
                <button
                  onClick={() => setModuleSearchQuery('')}
                  className="absolute right-2 text-slate-400 hover:text-white p-0.5 rounded-full hover:bg-slate-700/50 transition-colors"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
            {filteredNavItems.length > 0 ? (
              filteredNavItems.map((item) => {
                const Icon = item.icon;
                const KidIcon = item.kidIcon;
                const isActive = activeTab === item.id;

                if (isKidMode) {
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-xs font-semibold transition-all text-left group ${
                        isActive
                          ? 'bg-gradient-to-r from-amber-500/25 via-purple-500/20 to-blue-500/15 text-white border-2 border-amber-400 shadow-lg shadow-amber-500/20 scale-[1.01]'
                          : colorScheme === 'light'
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-2 border-transparent hover:border-slate-300 hover:translate-x-0.5'
                            : 'bg-[#151b2c]/80 hover:bg-[#1f2842] text-slate-200 border-2 border-transparent hover:border-[#384872] hover:translate-x-0.5'
                      }`}
                    >
                      {/* Vibrant Rounded Squircle Icon Badge */}
                      <div
                        className={`w-9 h-9 rounded-2xl flex items-center justify-center bg-gradient-to-tr ${item.kidGradient} ${item.kidShadow} shadow-md transition-all duration-300 group-hover:scale-110 group-hover:rotate-6 shrink-0 ring-1 ring-white/20`}
                      >
                        <KidIcon className="w-5 h-5 drop-shadow-sm" />
                      </div>

                      <div className="flex flex-col min-w-0 flex-1">
                        <span className={`font-extrabold text-xs truncate tracking-wide group-hover:text-amber-500 transition-colors ${
                          colorScheme === 'light' ? 'text-slate-800' : 'text-white'
                        }`}>
                          {item.kidLabel}
                        </span>
                      </div>

                      {isActive ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 shadow-sm shrink-0 animate-pulse">
                          ⭐
                        </span>
                      ) : (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${item.kidBadgeClass} shrink-0`}
                        >
                          {item.kidBadge}
                        </span>
                      )}
                    </button>
                  );
                }

                // Standard Engineering Pro Mode
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left ${
                      isActive
                        ? item.highlight
                          ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40 shadow-sm'
                          : item.accent
                          ? 'bg-purple-600/25 text-purple-300 font-semibold border border-purple-500/40 shadow-sm'
                          : colorScheme === 'light'
                            ? 'bg-slate-200 text-slate-900 border border-slate-300 shadow-sm'
                            : 'bg-[#181f33] text-white border border-[#27324c] shadow-sm'
                        : colorScheme === 'light'
                          ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                          : 'text-slate-400 hover:text-white hover:bg-[#181f33]/60'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive
                          ? item.highlight
                            ? 'text-cyan-400'
                            : item.accent
                            ? 'text-purple-400'
                            : colorScheme === 'light' ? 'text-cyan-600' : 'text-cyan-400'
                          : 'text-slate-500'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                    {item.highlight && (
                      <span className="ml-auto text-[9px] font-mono px-1 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                        3D
                      </span>
                    )}
                    {item.accent && (
                      <span className="ml-auto text-[9px] font-mono px-1 py-0.2 rounded bg-purple-950 text-purple-400 border border-purple-800">
                        AI
                      </span>
                    )}
                  </button>
                );
              })
            ) : (
              <div className="p-4 text-center flex flex-col items-center gap-2 text-xs text-slate-500 my-auto">
                <Search className="w-5 h-5 text-slate-600" />
                <span>No modules matching &quot;{moduleSearchQuery}&quot;</span>
                <button
                  onClick={() => setModuleSearchQuery('')}
                  className="text-cyan-400 hover:underline text-[11px] font-medium"
                >
                  Clear filter
                </button>
              </div>
            )}
          </div>

          {/* Sidebar Footer: Hardware Status */}
          <div className={`p-3 border-t bg-[#0d121f] transition-colors duration-300 ${
            colorScheme === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-[#0d121f] border-[#27324c]/60'
          }`}>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-slate-400">HARDWARE BUS</span>
              <span
                className={`font-mono font-semibold uppercase ${
                  connectionStatus === 'connected' ? (colorScheme === 'light' ? 'text-emerald-600' : 'text-emerald-400') : 'text-slate-500'
                }`}
              >
                {connectionStatus}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 truncate font-mono">
              {arduinoSerial.comPortName}
            </div>
          </div>
        </div>

        {/* Main Workstation Viewport / Workspace */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0c0f17] pb-14 md:pb-0">
          {activeTab === 'dashboard' && (
            <Dashboard
              project={activeProject}
              onNavigate={(tab) => setActiveTab(tab)}
              onSelectProject={(id) => setActiveProjectId(id)}
              allProjects={projects}
              isKidMode={isKidMode}
              colorScheme={colorScheme}
            />
          )}

          {activeTab === 'connection' && <ArduinoConnection isKidMode={isKidMode} />}

          {activeTab === 'pins' && <PinController isKidMode={isKidMode} />}

          {activeTab === 'servos' && (
            <ServoController
              servos={activeProject.servos}
              onUpdateServo={handleUpdateServo}
              onAddServo={handleAddServo}
              onDeleteServo={handleDeleteServo}
              onNavigateToStudio={() => setActiveTab('builder')}
              isKidMode={isKidMode}
            />
          )}

          {activeTab === 'builder' && (
            <div className={`w-full h-full flex items-center justify-center transition-all ${
              mobileViewportEnabled ? 'p-8 bg-[#06080e]' : ''
            }`}>
              <div className={`flex flex-col overflow-hidden transition-all ${
                mobileViewportEnabled
                  ? 'w-[375px] h-[667px] rounded-3xl border-4 border-slate-700 shadow-2xl ring-8 ring-cyan-500/10 bg-[#0c0f17]'
                  : 'w-full h-full'
              }`}>
                {mobileViewportEnabled && (
                  <div className="h-6 bg-slate-900 border-b border-slate-800 px-3 flex items-center justify-between text-[10px] text-slate-400 font-mono select-none">
                    <span>9:16 Mobile Viewport</span>
                    <span className="w-12 h-2 rounded-full bg-slate-800"></span>
                    <span>100%</span>
                  </div>
                )}
                <div className="flex-1 flex flex-col overflow-hidden relative">
                  <ThreeRobotStudio
                    parts={activeProject.parts}
                    servos={activeProject.servos}
                    selectedPartId={selectedPartId}
                    selectedServoId={selectedServoId}
                    onSelectPart={setSelectedPartId}
                    onSelectServo={setSelectedServoId}
                    onUpdatePart={handleUpdatePart}
                    onUpdateServo={handleUpdateServo}
                    onBatchUpdate={handleBatchUpdate}
                    onAddPart={handleAddPart}
                    onDeletePart={handleDeletePart}
                    onDuplicatePart={handleDuplicatePart}
                    onAddServo={handleAddServo}
                    onDeleteServo={handleDeleteServo}
                    onUndo={handleUndo}
                    onRedo={handleRedo}
                    canUndo={history.length > 0}
                    canRedo={future.length > 0}
                    colorScheme={colorScheme}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'movement' && (
            <MovementStudio
              servos={activeProject.servos}
              sequences={activeProject.sequences}
              onUpdateSequences={handleUpdateSequences}
              onUpdateServo={handleUpdateServo}
            />
          )}

          {activeTab === 'electronics' && <ElectronicsPlayground />}

          {activeTab === 'code' && <CodeStudio />}

          {activeTab === 'ai' && (
            <AIAssistant
              onLoadGeneratedRobot={handleLoadGeneratedRobot}
              onNavigateToBuilder={() => setActiveTab('builder')}
            />
          )}

          {activeTab === 'projects' && (
            <ProjectsPanel
              projects={projects}
              activeProjectId={activeProjectId}
              onSelectProject={(id) => setActiveProjectId(id)}
              onNewProject={() => {
                const newP: RobotProject = {
                  id: `proj_${Math.random().toString(36).substring(2, 7)}`,
                  name: `New Robot ${projects.length + 1}`,
                  description: 'Custom mechanical robot project',
                  boardType: 'uno',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  parts: [],
                  servos: [],
                  sequences: [],
                  customCode: '// Custom Arduino code\n',
                };
                setProjects([...projects, newP]);
                setActiveProjectId(newP.id);
                setActiveTab('builder');
              }}
              onDeleteProject={(id) => {
                const remaining = projects.filter((p) => p.id !== id);
                if (remaining.length > 0) {
                  setProjects(remaining);
                  if (activeProjectId === id) setActiveProjectId(remaining[0].id);
                }
              }}
              onImportProject={(imported) => {
                let safeId = imported.id;
                if (!safeId || projects.some((p) => p.id === safeId)) {
                  safeId = `proj_imp_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
                }
                const newProject = { ...imported, id: safeId };
                setProjects((prev) => [newProject, ...prev]);
                setActiveProjectId(newProject.id);
                setActiveTab('builder');
              }}
            />
          )}

          {activeTab === 'simulator' && (
            <LiveSimulator
              project={activeProject}
              onUpdateServo={handleUpdateServo}
              onUpdateProject={(updated) => {
                pushStateToHistory(updated);
              }}
              allProjects={projects}
              onSelectProject={(id) => setActiveProjectId(id)}
            />
          )}

          {activeTab === 'spotify' && (
            <SpotifySync
              servos={activeProject.servos}
              onUpdateServo={handleUpdateServo}
              activeProjectName={activeProject.name}
            />
          )}

          {activeTab === 'rps' && (
            <RockPaperScissors
              servos={activeProject.servos}
              onUpdateServo={handleUpdateServo}
              activeProjectName={activeProject.name}
              isKidMode={isKidMode}
            />
          )}

          {activeTab === 'block_coding' && (
            <BlockCodingStudio
              project={activeProject}
              servos={activeProject.servos}
              onUpdateServo={handleUpdateServo}
            />
          )}

          {activeTab === 'buzzer' && (
            <BuzzerPlayground project={activeProject} isKidMode={isKidMode} />
          )}

          {activeTab === 'settings' && (
            <SettingsPanel
              appMode={appMode}
              onSetAppMode={handleSetAppMode}
              theme={theme}
              onSetTheme={handleSetTheme}
              uiDensity={uiDensity}
              onSetUiDensity={handleSetUiDensity}
              accentColor={accentColor}
              onSetAccentColor={handleSetAccentColor}
              sidebarOpacity={sidebarOpacity}
              onSetSidebarOpacity={handleSetSidebarOpacity}
              cornerRadius={cornerRadius}
              onSetCornerRadius={handleSetCornerRadius}
              particlesEnabled={particlesEnabled}
              onSetParticlesEnabled={handleSetParticlesEnabled}
              mobileViewportEnabled={mobileViewportEnabled}
              onSetMobileViewportEnabled={handleSetMobileViewportEnabled}
              colorScheme={colorScheme}
              onSetColorScheme={handleSetColorScheme}
            />
          )}
        </div>
      </div>

      {/* Kid-Friendly Robo-Buddy Companion Mascot */}
      <RoboBuddy
        currentTab={activeTab}
        isKidMode={isKidMode}
        onToggleKidMode={() => handleSetAppMode(isKidMode ? 'standard' : 'kid')}
      />

      {/* Mobile Bottom Quick Navigation Bar */}
      <div className={`md:hidden fixed bottom-0 left-0 right-0 z-40 backdrop-blur-md border-t px-1 py-1 flex items-center justify-around text-[10px] font-medium transition-colors duration-300 select-none shadow-2xl ${
        colorScheme === 'light' ? 'bg-white/95 border-slate-200 text-slate-500' : 'bg-[#0e111d]/95 border-slate-800/80 text-slate-400'
      }`}>
        <button
          onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition-colors ${
            activeTab === 'dashboard' ? 'text-cyan-400 font-bold bg-cyan-950/60 border border-cyan-800/60' : 'hover:text-white'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Dash</span>
        </button>

        <button
          onClick={() => { setActiveTab('builder'); setIsMobileMenuOpen(false); }}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition-colors ${
            activeTab === 'builder' ? 'text-cyan-400 font-bold bg-cyan-950/60 border border-cyan-800/60' : 'hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>3D Studio</span>
        </button>

        <button
          onClick={() => { setActiveTab('servos'); setIsMobileMenuOpen(false); }}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition-colors ${
            activeTab === 'servos' ? 'text-purple-400 font-bold bg-purple-950/60 border border-purple-800/60' : 'hover:text-white'
          }`}
        >
          <Zap className="w-4 h-4 text-purple-400" />
          <span>Servos</span>
        </button>

        <button
          onClick={() => { setActiveTab('pins'); setIsMobileMenuOpen(false); }}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition-colors ${
            activeTab === 'pins' ? 'text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800/60' : 'hover:text-white'
          }`}
        >
          <Sliders className="w-4 h-4 text-emerald-400" />
          <span>Pins</span>
        </button>

        <button
          onClick={() => { setActiveTab('code'); setIsMobileMenuOpen(false); }}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition-colors ${
            activeTab === 'code' ? 'text-blue-400 font-bold bg-blue-950/60 border border-blue-800/60' : 'hover:text-white'
          }`}
        >
          <Code className="w-4 h-4 text-blue-400" />
          <span>Code</span>
        </button>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition-colors ${
            isMobileMenuOpen ? 'text-amber-400 font-bold bg-amber-950/60 border border-amber-800/60' : 'hover:text-white'
          }`}
        >
          <Menu className="w-4 h-4 text-amber-400" />
          <span>More</span>
        </button>
      </div>
    </div>
  );
}
