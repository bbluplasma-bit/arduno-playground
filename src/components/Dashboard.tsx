import React, { useState, useEffect, useRef } from 'react';
import { RobotProject, PinState } from '../types';
import { arduinoSerial } from '../services/arduinoSerial';
import {
  Cpu,
  Zap,
  Activity,
  Sliders,
  Play,
  RotateCcw,
  AlertTriangle,
  FolderOpen,
  ArrowRight,
  ShieldAlert,
  Radio,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Trophy,
  Target,
  ChevronDown,
  ChevronUp,
  Usb,
  Layers,
  Film,
  Code,
} from 'lucide-react';

interface DashboardProps {
  project: RobotProject;
  onNavigate: (tab: string) => void;
  onSelectProject: (projId: string) => void;
  allProjects: RobotProject[];
  isKidMode: boolean;
  isExpertMode?: boolean;
  colorScheme: 'dark' | 'light';
}

export const Dashboard: React.FC<DashboardProps> = ({
  project,
  onNavigate,
  onSelectProject,
  allProjects,
  isKidMode,
  isExpertMode = false,
  colorScheme,
}) => {
  const [connectionStatus, setConnectionStatus] = useState(arduinoSerial.status);
  const [comPort, setComPort] = useState(arduinoSerial.comPortName);
  const [boardType, setBoardType] = useState(arduinoSerial.boardType);
  const [analogA0, setAnalogA0] = useState<number>(512);
  const [analogHistory, setAnalogHistory] = useState<number[]>([500, 510, 520, 515, 530, 525, 540]);
  const [pinStates, setPinStates] = useState<Record<number, boolean>>({
    13: false,
    9: true,
    10: true,
  });

  useEffect(() => {
    const unsubStatus = arduinoSerial.addStatusListener((status) => {
      setConnectionStatus(status);
      setComPort(arduinoSerial.comPortName);
      setBoardType(arduinoSerial.boardType);
    });

    const unsubTlm = arduinoSerial.addTelemetryListener((ch, val) => {
      if (ch === 'A0') {
        setAnalogA0(val);
        setAnalogHistory((prev) => [...prev.slice(-24), val]);
      }
    });

    return () => {
      unsubStatus();
      unsubTlm();
    };
  }, []);

  const handleTogglePin13 = async () => {
    const next = !pinStates[13];
    setPinStates((prev) => ({ ...prev, 13: next }));
    await arduinoSerial.setDigitalPin(13, next ? 1 : 0);
  };

  const handleQuickAngle = async (servoId: string, pin: number, angle: number) => {
    await arduinoSerial.setServoAngle(pin, angle);
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
        if (arduinoSerial.status === 'connected') {
          await arduinoSerial.setServoAngle(s.pin, 90);
        }
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
        const clamped = Math.max(s.minAngle ?? 0, Math.min(s.maxAngle ?? 180, currentInterp));
        s.currentAngle = clamped;
        s.targetAngle = clamped;
        if (arduinoSerial.status === 'connected') {
          await arduinoSerial.setServoAngle(s.pin, clamped);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, stepDelay));
    }

    setIsSlowMoving(false);
    setSlowMoveProgress(0);
  };

  const handleTriggerPinCalibration = () => {
    sessionStorage.setItem('acs_auto_start_pin_calib', 'true');
    onNavigate('pins');
  };

  const [isProgressExpanded, setIsProgressExpanded] = useState<boolean>(true);

  // Step-by-step building roadmap milestones
  const buildingMilestones = [
    {
      id: 'm1',
      stepNum: '01',
      title: 'Connect Board',
      desc: 'Link USB Serial port to Arduino',
      tab: 'connection',
      isCompleted: connectionStatus === 'connected',
      badge: connectionStatus === 'connected' ? 'Connected' : 'Action Required',
      icon: Usb,
    },
    {
      id: 'm2',
      stepNum: '02',
      title: 'Configure Pins',
      desc: 'Test digital outputs & analog sensors',
      tab: 'pins',
      isCompleted: Boolean(pinStates[13] || sessionStorage.getItem('acs_auto_start_pin_calib') === 'true'),
      badge: 'Pin Matrix',
      icon: Sliders,
    },
    {
      id: 'm3',
      stepNum: '03',
      title: 'Setup Servos',
      desc: 'Calibrate steering motors & limits',
      tab: 'servos',
      isCompleted: project.servos.length > 0,
      badge: `${project.servos.length} Servos`,
      icon: Zap,
    },
    {
      id: 'm4',
      stepNum: '04',
      title: 'Design 3D Frame',
      desc: 'Assemble 3D parts & kinematics',
      tab: 'builder',
      isCompleted: project.parts.length > 1,
      badge: `${project.parts.length} Parts`,
      icon: Layers,
    },
    {
      id: 'm5',
      stepNum: '05',
      title: 'Motion Sequence',
      desc: 'Choreograph keyframe pose routines',
      tab: 'movement',
      isCompleted: project.sequences.length > 0,
      badge: `${project.sequences.length} Routines`,
      icon: Film,
    },
    {
      id: 'm6',
      stepNum: '06',
      title: 'Deploy Firmware',
      desc: 'Flash C++ sketch to board',
      tab: 'code',
      isCompleted: Boolean(project.customCode && project.customCode.trim().length > 30),
      badge: 'C++ Sketch',
      icon: Code,
    },
  ];

  const completedMilestones = buildingMilestones.filter((m) => m.isCompleted).length;
  const milestonePercent = Math.round((completedMilestones / buildingMilestones.length) * 100);

  let rankBadge = {
    title: '🥉 Novice Tinkerer',
    badgeClass: 'bg-amber-950/80 text-amber-300 border-amber-800/80',
    barGradient: 'from-amber-500 via-orange-500 to-yellow-400',
  };
  if (milestonePercent === 100) {
    rankBadge = {
      title: '🏆 TITAN ROBOT VERIFIED & READY!',
      badgeClass: 'bg-gradient-to-r from-amber-400 via-pink-400 to-emerald-400 text-slate-950 font-black border-amber-300 animate-pulse',
      barGradient: 'from-cyan-400 via-purple-500 via-pink-500 to-emerald-400',
    };
  } else if (milestonePercent >= 66) {
    rankBadge = {
      title: '🥇 Master Roboticist',
      badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80',
      barGradient: 'from-cyan-500 via-teal-400 to-emerald-400',
    };
  } else if (milestonePercent >= 33) {
    rankBadge = {
      title: '🥈 Advanced Engineer',
      badgeClass: 'bg-cyan-950/80 text-cyan-300 border-cyan-800/80',
      barGradient: 'from-blue-500 via-cyan-400 to-teal-400',
    };
  }

  return (
    <div className={`flex-1 overflow-y-auto p-6 transition-colors duration-300 ${
      colorScheme === 'light' 
        ? 'bg-slate-50 text-slate-900' 
        : 'bg-[#0c0f17] text-slate-200'
    }`}>
      {/* Top Banner / System Status */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 pb-6 border-b border-[#27324c]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">ARDUINO CONTROL STUDIO</h1>
            {isExpertMode ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-extrabold bg-emerald-950 text-emerald-400 border border-emerald-500/70 flex items-center gap-1 shadow-sm">
                <Cpu className="w-3 h-3 text-emerald-400" />
                EXPERT EMBEDDED WORKBENCH (16MHz)
              </span>
            ) : isKidMode ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-extrabold bg-gradient-to-r from-amber-400 to-pink-500 text-slate-950 shadow-sm">
                🎈 KID LAUNCHPAD ⭐
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-400 border border-cyan-800">
                ULTIMATE EDITION v2.4
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time embedded robotics workstation & 3D kinematic synchronizer
          </p>
        </div>

        {/* Emergency Stop & Status Pill */}
        <div className="flex items-center gap-3">
          <div
            className={`px-4 py-3 rounded-2xl border text-sm flex items-center gap-3 ${
              connectionStatus === 'connected'
                ? 'bg-emerald-950/40 border-emerald-800 text-emerald-400'
                : connectionStatus === 'connecting'
                ? 'bg-amber-950/40 border-amber-800 text-amber-400'
                : 'bg-rose-950/30 border-rose-900/60 text-rose-400'
            }`}
          >
            <span
              className={`w-3 h-3 rounded-full ${
                connectionStatus === 'connected'
                  ? 'bg-emerald-400'
                  : connectionStatus === 'connecting'
                  ? 'bg-amber-400'
                  : 'bg-rose-500'
              }`}
            />
            <span className="font-mono font-bold uppercase">{connectionStatus}</span>
            <span className="text-slate-400 font-mono">{comPort}</span>
          </div>

          <button
            onClick={() => onNavigate('settings')}
            className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg"
          >
            <Sliders className="w-4 h-4" />
            Customize UI
          </button>

          <button
            onClick={() => arduinoSerial.emergencyStop()}
            className={`${isKidMode ? 'px-8 py-5 text-lg' : 'px-4 py-2'} rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold uppercase tracking-wider flex items-center gap-3 shadow-2xl shadow-rose-950/50`}
          >
            <AlertTriangle className={`${isKidMode ? 'w-8 h-8' : 'w-4 h-4'}`} />
            {isKidMode ? 'STOP ROBOT!' : 'Emergency STOP'}
          </button>
        </div>
      </div>

      {/* Step-by-Step Progress Indicator & Building Roadmap */}
      <div className="mb-8 bg-[#111625] border border-[#27324c] rounded-2xl p-5 shadow-xl shadow-black/30 transition-all">
        {/* Progress Header & Progress Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#27324c]/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 rounded-xl text-cyan-400">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Robot Setup & Building Roadmap
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border shadow-sm ${rankBadge.badgeClass}`}>
                  {rankBadge.title}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Complete these {buildingMilestones.length} core building milestones to deploy your autonomous robot.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 min-w-[280px]">
            <div className="flex-1 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Completion Score:</span>
                <span className="text-cyan-400 font-bold">{completedMilestones} / {buildingMilestones.length} Tasks ({milestonePercent}%)</span>
              </div>
              <div className="w-full h-3 bg-[#181f33] border border-[#27324c] rounded-full overflow-hidden p-0.5 shadow-inner">
                <div
                  style={{ width: `${milestonePercent}%` }}
                  className={`h-full rounded-full bg-gradient-to-r ${rankBadge.barGradient} transition-all duration-700 shadow-md`}
                />
              </div>
            </div>

            <button
              onClick={() => setIsProgressExpanded(!isProgressExpanded)}
              className="p-2 bg-[#181f33] hover:bg-[#202945] text-slate-300 border border-[#27324c] rounded-lg transition-colors shrink-0"
              title={isProgressExpanded ? 'Collapse Roadmap' : 'Expand Roadmap'}
            >
              {isProgressExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Milestone Steps Cards */}
        {isProgressExpanded && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-4">
            {buildingMilestones.map((m) => {
              const StepIcon = m.icon;
              return (
                <div
                  key={m.id}
                  onClick={() => onNavigate(m.tab)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all duration-200 group flex items-start gap-3 ${
                    m.isCompleted
                      ? 'bg-emerald-950/20 border-emerald-500/40 hover:border-emerald-400'
                      : 'bg-[#181f33]/80 border-[#27324c] hover:border-cyan-500/50 hover:bg-[#1d2740]'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold transition-transform group-hover:scale-110 ${
                      m.isCompleted
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-[#111625] text-slate-400 border border-[#27324c]'
                    }`}
                  >
                    {m.isCompleted ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <span className="font-mono">{m.stepNum}</span>}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1.5 mb-1">
                      <span className={`text-xs font-bold truncate ${m.isCompleted ? 'text-emerald-300' : 'text-white group-hover:text-cyan-300'}`}>
                        {m.title}
                      </span>
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-semibold shrink-0 ${
                          m.isCompleted
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-[#111625] text-slate-400 border border-[#27324c]'
                        }`}
                      >
                        {m.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-1">{m.desc}</p>

                    <div className="flex items-center gap-1 text-[10px] font-bold mt-2 pt-1.5 border-t border-[#27324c]/40">
                      {m.isCompleted ? (
                        <span className="text-emerald-400 flex items-center gap-1 font-mono">
                          <span>✓ Milestone Unlocked</span>
                        </span>
                      ) : (
                        <span className="text-cyan-400 group-hover:underline flex items-center gap-1 font-mono">
                          <span>Start Step</span>
                          <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {milestonePercent === 100 && (
          <div className="mt-4 p-3 bg-gradient-to-r from-amber-500/20 via-purple-500/20 to-emerald-500/20 border border-amber-400/40 rounded-xl flex items-center justify-between text-xs text-amber-200">
            <div className="flex items-center gap-2 font-bold">
              <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
              <span>Congratulations! All core building milestones verified. Your robot is fully configured!</span>
            </div>
            <button
              onClick={() => onNavigate('simulator')}
              className="px-3 py-1 bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 font-black rounded-lg text-xs uppercase shadow-md hover:brightness-110"
            >
              Launch Live Sim 🎮
            </button>
          </div>
        )}
      </div>


      {/* Main Grid: 4 Metric Cards */}
      <div className={`grid ${isKidMode ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'} gap-6 mb-8`}>
        {/* Card 1: Hardware Board */}
        <div className={`${isKidMode ? 'p-8' : 'p-4'} bg-[#111625] border border-[#27324c] rounded-3xl flex flex-col justify-between`}>
          <div className="flex items-center justify-between text-slate-400 text-xs mb-4">
            <span className="text-base font-bold text-white">BRAIN BOARD</span>
            <Cpu className={`${isKidMode ? 'w-8 h-8' : 'w-4 h-4'} text-cyan-400`} />
          </div>
          <div>
            <div className={`${isKidMode ? 'text-3xl' : 'text-lg'} font-bold text-white uppercase font-mono`}>
              Arduino {boardType}
            </div>
            <div className={`${isKidMode ? 'text-lg' : 'text-xs'} text-slate-400 mt-2`}>
              Ready for your commands!
            </div>
          </div>
          <button
            onClick={() => onNavigate('connection')}
            className="mt-6 text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-2 pt-4 border-t border-[#27324c]/60"
          >
            <span className="font-bold">Connect Board</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Card 2: Connected Servos */}
        <div className="bg-[#111625] border border-[#27324c] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>ACTIVE 3D SERVOS</span>
            <Zap className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white font-mono">{project.servos.length} Units</div>
            <div className="text-xs text-slate-400 mt-0.5">
              Pins: {project.servos.map((s) => s.pin).join(', ') || 'None assigned'}
            </div>
            {project.servos.length > 0 && (
              <div className="mt-2.5">
                <button
                  onClick={handleSlowMoveAllTo90}
                  className={`px-3 py-1 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-sm ${
                    isSlowMoving
                      ? 'bg-amber-600 text-white animate-pulse'
                      : 'bg-emerald-950/70 hover:bg-emerald-900/90 text-emerald-300 border border-emerald-500/50'
                  }`}
                  title="Smoothly and slowly move all servos to 90° center"
                >
                  <span className="text-sm">🐢</span>
                  <span>{isSlowMoving ? `Slow Moving (${slowMoveProgress}%) - Stop` : 'Slow All to 90°'}</span>
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => onNavigate('servos')}
            className="mt-3 text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 pt-2 border-t border-[#27324c]/60"
          >
            <span>Servo Multi-Controller</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Card 3: Live Telemetry A0 */}
        <div className="bg-[#111625] border border-[#27324c] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>ANALOG INPUT (A0)</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-400 font-mono">{analogA0}</span>
              <span className="text-xs text-slate-400">/ 1023 ({(analogA0 * (5.0 / 1023.0)).toFixed(2)}V)</span>
            </div>
            {/* Sparkline */}
            <div className="h-6 flex items-end gap-0.5 mt-1">
              {analogHistory.map((val, idx) => (
                <div
                  key={idx}
                  style={{ height: `${Math.max(10, (val / 1023) * 100)}%` }}
                  className="flex-1 bg-emerald-500/30 rounded-t-sm"
                />
              ))}
            </div>
          </div>
          <button
            onClick={() => onNavigate('pins')}
            className="mt-3 text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 pt-2 border-t border-[#27324c]/60"
          >
            <span>Live Pin Matrix</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Card 4: Active 3D Model */}
        <div className="bg-[#111625] border border-[#27324c] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>ACTIVE 3D PROJECT</span>
            <Radio className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-base font-bold text-white truncate">{project.name}</div>
            <div className="text-xs text-slate-400 mt-0.5">
              {project.parts.length} 3D components • {project.sequences.length} keyframe animations
            </div>
          </div>
          <button
            onClick={() => onNavigate('builder')}
            className="mt-3 text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 pt-2 border-t border-[#27324c]/60"
          >
            <span>Launch 3D Studio</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Row 2: Quick Controls & Connected Servos Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Quick Controls Panel */}
        <div className="bg-[#111625] border border-[#27324c] rounded-xl p-5 flex flex-col">
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            Quick Controls & Fast Pin Toggles
          </h2>

          <div className="flex flex-col gap-3">
            {/* Built-in LED Pin 13 Toggle */}
            <div className="flex items-center justify-between p-3 bg-[#181f33] rounded-lg border border-[#27324c]">
              <div>
                <div className="text-xs font-semibold text-white">Built-in LED (Pin 13)</div>
                <div className="text-[11px] text-slate-400">Onboard diagnostic indicator</div>
              </div>
              <button
                onClick={handleTogglePin13}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  pinStates[13]
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-[#111625] text-slate-400 border border-[#27324c]'
                }`}
              >
                {pinStates[13] ? 'HIGH (ON)' : 'LOW (OFF)'}
              </button>
            </div>

            {/* Quick Ping / Handshake */}
            <div className="flex items-center justify-between p-3 bg-[#181f33] rounded-lg border border-[#27324c]">
              <div>
                <div className="text-xs font-semibold text-white">Serial Ping Handshake</div>
                <div className="text-[11px] text-slate-400">Verify USB serial connection</div>
              </div>
              <button
                onClick={() => arduinoSerial.sendRaw('PING')}
                className="px-3 py-1.5 rounded-md text-xs bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/40 font-medium"
              >
                Send PING
              </button>
            </div>

            {/* Calibrate & Test All Pins */}
            <div className="flex items-center justify-between p-3 bg-[#181f33] rounded-lg border border-[#27324c]">
              <div>
                <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Pin Health & Calibration</span>
                </div>
                <div className="text-[11px] text-slate-400">Automated diagnostic sweep on all D0-D13 & A0-A5</div>
              </div>
              <button
                onClick={handleTriggerPinCalibration}
                className="px-3 py-1.5 rounded-md text-xs bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold transition-all shadow-sm flex items-center gap-1"
                title="Open Pin Controller and auto-start pin test & calibration sweep"
              >
                <span>🧪 Test All Pins</span>
              </button>
            </div>

            {/* Quick Re-Home All Servos to 90 Deg */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-[#181f33] rounded-lg border border-[#27324c] gap-2">
              <div>
                <div className="text-xs font-semibold text-white">Home All Servos (90°)</div>
                <div className="text-[11px] text-slate-400">Reset all attached joints to neutral (instant or slow)</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    project.servos.forEach((s) => arduinoSerial.setServoAngle(s.pin, 90));
                  }}
                  className="px-3 py-1.5 rounded-md text-xs bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/40 font-medium"
                  title="Instantly snap all servos to 90°"
                >
                  Reset 90°
                </button>
                <button
                  onClick={handleSlowMoveAllTo90}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
                    isSlowMoving
                      ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse ring-2 ring-amber-400'
                      : 'bg-emerald-950/70 hover:bg-emerald-900/90 text-emerald-300 border border-emerald-500/50'
                  }`}
                  title="Smoothly and slowly move all servos to 90° center"
                >
                  <span className="text-sm">🐢</span>
                  <span>{isSlowMoving ? `Slow (${slowMoveProgress}%) - Stop` : 'Slow to 90°'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Connected Servos Live Telemetry & Fast Sliders */}
        <div className="lg:col-span-2 bg-[#111625] border border-[#27324c] rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-400" />
              Connected Kinematic Servos
            </h2>
            <button
              onClick={() => onNavigate('servos')}
              className="text-xs text-purple-400 hover:text-purple-300"
            >
              Open Full Studio →
            </button>
          </div>

          {project.servos.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-[#27324c] rounded-lg">
              No servos configured. Open the 3D Robot Builder to attach servos to joints.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {project.servos.map((servo) => (
                <div
                  key={servo.id}
                  className="bg-[#181f33] border border-[#27324c] rounded-lg p-3 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">{servo.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                      PIN {servo.pin}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={servo.minAngle}
                      max={servo.maxAngle}
                      value={servo.targetAngle}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        handleQuickAngle(servo.id, servo.pin, val);
                      }}
                      className="flex-1 accent-purple-500 cursor-pointer"
                    />
                    <span className="font-mono text-xs text-purple-400 font-semibold w-10 text-right">
                      {servo.targetAngle}°
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {[0, 45, 90, 135, 180].map((deg) => (
                      <button
                        key={deg}
                        onClick={() => handleQuickAngle(servo.id, servo.pin, deg)}
                        className="flex-1 py-0.5 text-[10px] bg-[#111625] hover:bg-purple-900/40 text-slate-300 rounded border border-[#27324c]"
                      >
                        {deg}°
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Recent Projects Switcher */}
      <div className="bg-[#111625] border border-[#27324c] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-cyan-400" />
          Recent Robot Projects & Templates
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {allProjects.map((p) => (
            <div
              key={p.id}
              onClick={() => onSelectProject(p.id)}
              className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                p.id === project.id
                  ? 'bg-cyan-950/30 border-cyan-600'
                  : 'bg-[#181f33] border-[#27324c] hover:border-slate-500'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-xs text-white truncate">{p.name}</span>
                {p.id === project.id && (
                  <span className="text-[10px] text-cyan-400 font-mono font-medium">ACTIVE</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-2 mb-2">{p.description}</p>
              <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono">
                <span>{p.parts.length} parts</span>
                <span>{p.servos.length} servos</span>
                <span>{p.boardType.toUpperCase()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
