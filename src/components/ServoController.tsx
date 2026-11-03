import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ServoMotor, ServoModel } from '../types';
import { arduinoSerial } from '../services/arduinoSerial';
import { soundEffects } from '../services/soundEffects';
import {
  Cpu,
  Plus,
  Trash2,
  Sliders,
  RotateCcw,
  Zap,
  BookmarkPlus,
  Play,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  BarChart3,
  AlertTriangle,
  Activity,
  Filter,
  HelpCircle,
  Gauge,
  Radio,
} from 'lucide-react';
import { GuidedTour, TourStep } from './GuidedTour';

interface ServoControllerProps {
  servos: ServoMotor[];
  onUpdateServo: (servo: ServoMotor) => void;
  onAddServo: () => void;
  onDeleteServo: (id: string) => void;
  onNavigateToStudio?: () => void;
  isKidMode?: boolean;
}

export const ServoController: React.FC<ServoControllerProps> = ({
  servos,
  onUpdateServo,
  onAddServo,
  onDeleteServo,
  onNavigateToStudio,
  isKidMode = false,
}) => {
  const [showTour, setShowTour] = useState(false);

  const tourSteps: TourStep[] = [
    { targetSelector: '.wiring-tutorial', title: 'Servo Wiring Guide', content: 'Follow this 3D diagram to wire your servo motor to your Arduino!' },
    { targetSelector: '.pose-bank', title: 'Pose Bank', content: 'Save and load your favorite robot poses here.' },
    { targetSelector: '.servo-grid', title: 'Servo Controls', content: 'Adjust individual servo angles and limits here.' },
  ];

  const [savedPoses, setSavedPoses] = useState<{ id: string; name: string; angles: Record<string, number> }[]>([
    {
      id: 'pose_home',
      name: 'Neutral Rest (90°)',
      angles: servos.reduce((acc, s) => ({ ...acc, [s.id]: 90 }), {}),
    },
  ]);
  const [newPoseName, setNewPoseName] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'extreme' | 'warning'>('all');
  const [chartView, setChartView] = useState<'split' | 'bars' | 'distribution'>('split');
  const [telemetryTick, setTelemetryTick] = useState<number>(0);

  // 500ms simulation tick for real-time telemetry noise & PWM jitter
  useEffect(() => {
    const timer = setInterval(() => {
      setTelemetryTick((prev) => prev + 1);
    }, 500);
    return () => clearInterval(timer);
  }, []);

  // Compute Real-time Servo Health Telemetry for every motor
  const servoHealthInfos = useMemo(() => {
    return servos.map((servo) => {
      const angle = servo.currentAngle ?? servo.targetAngle ?? 90;
      const model = servo.model || 'SG90';
      const min = servo.minAngle ?? 0;
      const max = servo.maxAngle ?? 180;

      // PWM Pulse Width (500us - 2500us at 50Hz)
      const basePulseUs = 500 + Math.round((angle / 180) * 2000);
      const jitterUs = Math.round(Math.sin(telemetryTick * 1.5 + servo.pin) * 2);
      const pulseWidthUs = Math.max(500, Math.min(2500, basePulseUs + jitterUs));
      const dutyCyclePercent = ((pulseWidthUs / 20000) * 100).toFixed(1);

      // Model Current Ratings (mA)
      const maxRatedMa = model === 'DS3218' ? 1800 : model === 'MG995' ? 1200 : 450;
      const baseIdleMa = model === 'DS3218' ? 110 : model === 'MG995' ? 65 : 22;

      // Angular Displacement & Mechanical Stall Strain
      const displacement = Math.abs(angle - 90);
      const strainMa = displacement * (model === 'DS3218' ? 4.5 : model === 'MG995' ? 3.0 : 1.8);

      const isCriticalStall = angle <= min + 4 || angle >= max - 4 || angle <= 5 || angle >= 175;
      const isNearLimit = !isCriticalStall && (angle <= min + 12 || angle >= max - 12 || angle <= 15 || angle >= 165);

      const stallSpikeMa = isCriticalStall ? (model === 'DS3218' ? 520 : model === 'MG995' ? 380 : 210) : isNearLimit ? 80 : 0;
      const liveFluctuation = Math.round(Math.sin(telemetryTick * 1.7 + servo.pin) * 5 + Math.cos(telemetryTick * 2.3 + servo.pin) * 3);

      const currentDrawMa = Math.max(10, Math.round(baseIdleMa + strainMa + stallSpikeMa + liveFluctuation));
      const loadPercentage = Math.min(100, Math.round((currentDrawMa / maxRatedMa) * 100));

      // Signal Strength & Quality
      const signalStrength = Math.max(65, Math.min(100, Math.round(98 - (isCriticalStall ? 18 : isNearLimit ? 8 : 0) + Math.sin(telemetryTick + servo.pin) * 2)));

      // Estimated Temperature (°C)
      const estTempC = Math.round(26 + (currentDrawMa / maxRatedMa) * 28 + (isCriticalStall ? 12 : 0));

      // Health Status
      let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
      let healthLabel = 'Healthy • Normal';
      let healthDesc = 'Signal clean, operating within safe current & thermal envelope.';

      if (isCriticalStall || currentDrawMa > maxRatedMa * 0.65) {
        healthStatus = 'critical';
        healthLabel = 'CRITICAL • STALL RISK';
        healthDesc = 'Motor straining near physical limit! Excessive current draw & heat dissipation.';
      } else if (isNearLimit || currentDrawMa > maxRatedMa * 0.35 || signalStrength < 88) {
        healthStatus = 'warning';
        healthLabel = 'Warning • High Load';
        healthDesc = 'Operating near rotational boundaries or under elevated torque load.';
      }

      return {
        servo,
        angle,
        model,
        pulseWidthUs,
        dutyCyclePercent,
        currentDrawMa,
        maxRatedMa,
        loadPercentage,
        signalStrength,
        estTempC,
        healthStatus,
        healthLabel,
        healthDesc,
        isCriticalStall,
        isNearLimit,
      };
    });
  }, [servos, telemetryTick]);

  const totalSystemMa = servoHealthInfos.reduce((acc, i) => acc + i.currentDrawMa, 0);
  const totalSystemWatts = ((totalSystemMa * 5) / 1000).toFixed(2);
  const criticalHealthCount = servoHealthInfos.filter((i) => i.healthStatus === 'critical').length;
  const warningHealthCount = servoHealthInfos.filter((i) => i.healthStatus === 'warning').length;
  const healthyCount = servoHealthInfos.filter((i) => i.healthStatus === 'healthy').length;

  const prevCriticalRef = useRef<number>(0);
  useEffect(() => {
    if (criticalHealthCount > 0 && prevCriticalRef.current === 0) {
      // High-pitched alert sound for critical red state
      soundEffects.playClick(880, 0.08, 0.3);
      setTimeout(() => soundEffects.playClick(660, 0.08, 0.25), 100);
      setTimeout(() => soundEffects.playClick(440, 0.1, 0.2), 200);
    }
    prevCriticalRef.current = criticalHealthCount;
  }, [criticalHealthCount]);

  const handleAngleChange = async (servo: ServoMotor, angle: number) => {
    const clamped = Math.max(servo.minAngle, Math.min(servo.maxAngle, angle));
    const updated = { ...servo, currentAngle: clamped, targetAngle: clamped };
    onUpdateServo(updated);
    if (arduinoSerial.status === 'connected') {
      await arduinoSerial.setServoAngle(servo.pin, clamped);
    }
  };

  const handleSaveCurrentPose = () => {
    const name = newPoseName.trim() || `Pose ${savedPoses.length + 1}`;
    const angles: Record<string, number> = {};
    servos.forEach((s) => {
      angles[s.id] = s.targetAngle;
    });

    setSavedPoses([...savedPoses, { id: Math.random().toString(36).substring(2, 9), name, angles }]);
    setNewPoseName('');
  };

  const handleApplyPose = async (pose: { angles: Record<string, number> }) => {
    for (const servo of servos) {
      if (pose.angles[servo.id] !== undefined) {
        const angle = pose.angles[servo.id];
        const updated = { ...servo, targetAngle: angle, currentAngle: angle };
        onUpdateServo(updated);
        if (arduinoSerial.status === 'connected') {
          await arduinoSerial.setServoAngle(servo.pin, angle);
        }
      }
    }
  };

  const handleSetAllAngles = async (angle: number) => {
    for (const servo of servos) {
      handleAngleChange(servo, angle);
    }
  };

  // State & handler for moving servos to 90° slowly
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
      // Abort / stop slow movement if already in progress
      slowMoveAbortRef.current = true;
      setIsSlowMoving(false);
      return;
    }

    if (servos.length === 0) return;

    slowMoveAbortRef.current = false;
    setIsSlowMoving(true);
    setSlowMoveProgress(0);

    const startAngles: Record<string, number> = {};
    let maxDistance = 0;
    servos.forEach((s) => {
      const current = s.currentAngle ?? s.targetAngle ?? 90;
      startAngles[s.id] = current;
      const dist = Math.abs(current - 90);
      if (dist > maxDistance) maxDistance = dist;
    });

    if (maxDistance === 0) {
      for (const s of servos) {
        if (arduinoSerial.status === 'connected') {
          await arduinoSerial.setServoAngle(s.pin, 90);
        }
      }
      setIsSlowMoving(false);
      return;
    }

    // Really slow motion: ~1° every 45ms (taking ~4 seconds for 90°)
    const totalSteps = Math.max(30, Math.round(maxDistance * 1.5));
    const stepDelay = 45;

    for (let step = 1; step <= totalSteps; step++) {
      if (slowMoveAbortRef.current) break;

      const progress = step / totalSteps;
      setSlowMoveProgress(Math.round(progress * 100));

      for (const s of servos) {
        const start = startAngles[s.id] ?? 90;
        const currentInterp = Math.round(start + (90 - start) * progress);
        const clamped = Math.max(s.minAngle ?? 0, Math.min(s.maxAngle ?? 180, currentInterp));
        const updated = { ...s, currentAngle: clamped, targetAngle: clamped };
        onUpdateServo(updated);
        if (arduinoSerial.status === 'connected') {
          await arduinoSerial.setServoAngle(s.pin, clamped);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, stepDelay));
    }

    setIsSlowMoving(false);
    setSlowMoveProgress(0);
  };

  const handleSlowMoveSingleTo90 = async (servo: ServoMotor) => {
    const start = servo.currentAngle ?? servo.targetAngle ?? 90;
    const distance = Math.abs(start - 90);
    if (distance === 0) return;

    const totalSteps = Math.max(20, Math.round(distance * 1.5));
    const stepDelay = 45;

    for (let step = 1; step <= totalSteps; step++) {
      const progress = step / totalSteps;
      const currentInterp = Math.round(start + (90 - start) * progress);
      const clamped = Math.max(servo.minAngle ?? 0, Math.min(servo.maxAngle ?? 180, currentInterp));
      const updated = { ...servo, currentAngle: clamped, targetAngle: clamped };
      onUpdateServo(updated);
      if (arduinoSerial.status === 'connected') {
        await arduinoSerial.setServoAngle(servo.pin, clamped);
      }
      await new Promise((resolve) => setTimeout(resolve, stepDelay));
    }
  };

  // Compute Limit telemetry for every servo
  const limitInfos = useMemo(() => {
    return servos.map((servo) => {
      const angle = servo.currentAngle ?? servo.targetAngle ?? 90;
      const min = servo.minAngle ?? 0;
      const max = servo.maxAngle ?? 180;

      // Extreme threshold: within 5 degrees of physical/calibrated limits, or absolute <= 10° or >= 170°
      const isExtremeMin = angle <= min + 5 || angle <= 10;
      const isExtremeMax = angle >= max - 5 || angle >= 170;
      // Warning threshold: within 15 degrees of limits
      const isWarningMin = !isExtremeMin && (angle <= min + 15 || angle <= 25);
      const isWarningMax = !isExtremeMax && (angle >= max - 15 || angle >= 155);

      let status: 'extreme_min' | 'extreme_max' | 'warning_min' | 'warning_max' | 'centered' | 'nominal' = 'nominal';
      let statusLabel = 'Nominal Safe';

      if (isExtremeMin) {
        status = 'extreme_min';
        statusLabel = 'Critical Min Limit';
      } else if (isExtremeMax) {
        status = 'extreme_max';
        statusLabel = 'Critical Max Limit';
      } else if (isWarningMin) {
        status = 'warning_min';
        statusLabel = 'Near Min Limit';
      } else if (isWarningMax) {
        status = 'warning_max';
        statusLabel = 'Near Max Limit';
      } else if (angle >= 86 && angle <= 94) {
        status = 'centered';
        statusLabel = 'Centered (90°)';
      }

      return {
        servo,
        angle,
        status,
        statusLabel,
        isExtreme: isExtremeMin || isExtremeMax,
        isWarning: isWarningMin || isWarningMax,
        min,
        max,
      };
    });
  }, [servos]);

  const extremeCount = limitInfos.filter((i) => i.isExtreme).length;
  const warningCount = limitInfos.filter((i) => i.isWarning).length;
  const centeredCount = limitInfos.filter((i) => i.status === 'centered').length;
  const avgAngle = limitInfos.length
    ? Math.round((limitInfos.reduce((acc, i) => acc + i.angle, 0) / limitInfos.length) * 10) / 10
    : 90;

  // 5 Distribution Bins across 0° - 180° range
  const bins = useMemo(() => {
    return [
      {
        label: 'Min Limit (0°-35°)',
        range: '0° – 35°',
        count: limitInfos.filter((i) => i.angle <= 35).length,
        isAlert: true,
      },
      {
        label: 'Lower Mid (36°-75°)',
        range: '36° – 75°',
        count: limitInfos.filter((i) => i.angle > 35 && i.angle <= 75).length,
        isWarn: true,
      },
      {
        label: 'Neutral Rest (76°-104°)',
        range: '76° – 104°',
        count: limitInfos.filter((i) => i.angle > 75 && i.angle < 105).length,
        isCenter: true,
      },
      {
        label: 'Upper Mid (105°-144°)',
        range: '105° – 144°',
        count: limitInfos.filter((i) => i.angle >= 105 && i.angle <= 144).length,
        isWarn: true,
      },
      {
        label: 'Max Limit (145°-180°)',
        range: '145° – 180°',
        count: limitInfos.filter((i) => i.angle >= 145).length,
        isAlert: true,
      },
    ];
  }, [limitInfos]);

  const filteredLimitInfos = useMemo(() => {
    if (filterMode === 'extreme') return limitInfos.filter((i) => i.isExtreme);
    if (filterMode === 'warning') return limitInfos.filter((i) => i.isWarning || i.isExtreme);
    return limitInfos;
  }, [limitInfos, filterMode]);

  const handleRelieveExtremeMotors = async () => {
    const extremeServos = limitInfos.filter((i) => i.isExtreme);
    for (const info of extremeServos) {
      await handleAngleChange(info.servo, 90);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowTour(true)}
              className="p-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] text-cyan-400 border border-[var(--border-color)] rounded-lg"
              title="Take a Wiring Tour"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-400" />
                Multi-Servo Master Console
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Precision angular positioning, hardware pin mapping, limits calibration, and simultaneous pose bank
              </p>
            </div>
          </div>


          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSetAllAngles(90)}
              className="px-3 py-1.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)] rounded-lg text-xs font-semibold"
              title="Instantly snap all servos to 90°"
            >
              All to 90°
            </button>
            <button
              onClick={handleSlowMoveAllTo90}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
                isSlowMoving
                  ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse ring-2 ring-amber-400'
                  : 'bg-emerald-950/70 hover:bg-emerald-900/90 text-emerald-300 border border-emerald-500/50 hover:border-emerald-400'
              }`}
              title="Smoothly and slowly move all servos to 90° center to prevent strain"
            >
              <span className="text-sm">🐢</span>
              <span>
                {isSlowMoving ? `Slowly Moving (${slowMoveProgress}%) - Stop` : 'Slow Move All to 90°'}
              </span>
            </button>
            <button
              onClick={onAddServo}
              className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-purple-950/50"
            >
              <Plus className="w-4 h-4" /> Add New Servo
            </button>
          </div>
        </div>

        {/* Kid Mode Friendly Slow Move Bar */}
        {isKidMode && (
          <div className="bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-cyan-500/20 border-2 border-emerald-400/50 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <span className="text-3xl animate-bounce">🐢</span>
              <div>
                <h2 className="text-sm font-black text-emerald-300">Gentle Robot Motion: Slow Center (90°)</h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Protect your robot gears! Click below to move all the motors super slowly back to the middle!
                </p>
              </div>
            </div>
            <button
              onClick={handleSlowMoveAllTo90}
              className={`px-5 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 transition-all shadow-md shrink-0 ${
                isSlowMoving
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white ring-2 ring-amber-300 animate-pulse'
                  : 'bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 hover:scale-105 active:scale-95 shadow-emerald-950'
              }`}
            >
              <span className="text-base">🐢</span>
              <span>
                {isSlowMoving ? `Moving Slow (${slowMoveProgress}%) - Click to Stop!` : '🐢 Move All to 90° Really Slow!'}
              </span>
            </button>
          </div>
        )}

        {/* Global Multi-Servo Pose Bank */}
        <div className="pose-bank bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-white flex items-center gap-2">
              <BookmarkPlus className="w-4 h-4 text-cyan-400" />
              Saved Pose Presets & Multi-Joint Snapshots
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="New Pose Name..."
                value={newPoseName}
                onChange={(e) => setNewPoseName(e.target.value)}
                className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded px-2.5 py-1 text-xs text-[var(--text-primary)] placeholder:text-slate-500 w-36"
              />
              <button
                onClick={handleSaveCurrentPose}
                className="px-3 py-1 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/40 rounded text-xs font-semibold"
              >
                Snapshot Current Pose
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border-color)]/60">
            {savedPoses.map((pose) => (
              <button
                key={pose.id}
                onClick={() => handleApplyPose(pose)}
                className="px-3 py-1.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg text-xs flex items-center gap-1.5 transition-colors"
              >
                <Play className="w-3 h-3 text-emerald-400" />
                <span>{pose.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Real-Time Servo Health & Hardware Telemetry Monitor */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-5 flex flex-col gap-4 shadow-xl shadow-black/30">
          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[var(--border-color)]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-sm font-bold text-white tracking-wide">
                    Real-Time Servo Health & Diagnostics Monitor
                  </h2>
                  {criticalHealthCount > 0 ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-600 text-[10px] font-bold flex items-center gap-1.5 animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                      {criticalHealthCount} STALL / OVERLOAD WARNING
                    </span>
                  ) : warningHealthCount > 0 ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-600 text-[10px] font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      {warningHealthCount} ELEVATED HARDWARE LOAD
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600 text-[10px] font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                      100% HEALTHY • NOMINAL
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Live current draw (mA), signal quality, microsecond PWM pulse widths, and thermal load telemetry for failure prevention.
                </p>
              </div>
            </div>

            {/* Total System Power & Instant Relief */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg flex items-center gap-3">
                <div className="flex items-center gap-1 text-[var(--text-secondary)]">
                  <span>Current:</span>
                  <span className="font-mono font-bold text-cyan-400">{totalSystemMa} mA</span>
                </div>
                <span className="text-[var(--border-color)]">•</span>
                <div className="flex items-center gap-1 text-[var(--text-secondary)]">
                  <span>Power (5V):</span>
                  <span className="font-mono font-bold text-purple-400">{totalSystemWatts} W</span>
                </div>
              </div>

              {(criticalHealthCount > 0 || warningHealthCount > 0) && (
                <button
                  onClick={async () => {
                    for (const info of servoHealthInfos) {
                      if (info.healthStatus !== 'healthy') {
                        await handleAngleChange(info.servo, 90);
                      }
                    }
                  }}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-rose-950/50 flex items-center gap-1.5"
                  title="Instantly re-center all motors currently straining near physical hard stops"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Relieve Strained Servos</span>
                </button>
              )}
            </div>
          </div>

          {/* Servo Health Cards Grid */}
          {servos.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--text-secondary)] border border-dashed border-[var(--border-color)] rounded-lg">
              No servos connected. Add a servo to monitor hardware health telemetry.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {servoHealthInfos.map((info) => {
                const isCrit = info.healthStatus === 'critical';
                const isWarn = info.healthStatus === 'warning';

                return (
                  <div
                    key={info.servo.id}
                    className={`p-3.5 rounded-xl border flex flex-col gap-3 transition-all ${
                      isCrit
                        ? 'bg-rose-950/20 border-rose-600/70 shadow-lg shadow-rose-950/30'
                        : isWarn
                        ? 'bg-amber-950/20 border-amber-500/60 shadow-md shadow-amber-950/20'
                        : 'bg-[#181f33] border-[#27324c] hover:border-slate-500'
                    }`}
                  >
                    {/* Card Header: Name, Pin, Health Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {/* Status LED Dot */}
                        <div
                          className={`w-3 h-3 rounded-full shrink-0 transition-all ${
                            isCrit
                              ? 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,1)] animate-ping'
                              : isWarn
                              ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)] animate-pulse'
                              : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                          }`}
                        />
                        <span className="font-bold text-xs text-[var(--text-primary)] truncate">{info.servo.name}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                          {info.model} • P{info.servo.pin}
                        </span>
                      </div>
                    </div>

                    {/* Status Banner */}
                    <div
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center justify-between border ${
                        isCrit
                          ? 'bg-rose-950/80 text-rose-200 border-rose-700/80'
                          : isWarn
                          ? 'bg-amber-950/80 text-amber-200 border-amber-700/80'
                          : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                      }`}
                    >
                      <span className="truncate">{info.healthLabel}</span>
                      <span className="font-mono text-[10px]">{info.angle}°</span>
                    </div>

                    {/* Telemetry Meter 1: Live Current Draw */}
                    <div className="flex flex-col gap-1 text-[11px] font-mono">
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Current Draw:</span>
                        <span className={isCrit ? 'text-rose-400 font-bold' : isWarn ? 'text-amber-400 font-bold' : 'text-emerald-400'}>
                          {info.currentDrawMa} mA / {info.maxRatedMa} mA
                        </span>
                      </div>
                      <div className="w-full h-2 bg-[#111625] rounded-full overflow-hidden border border-[#27324c]">
                        <div
                          style={{ width: `${info.loadPercentage}%` }}
                          className={`h-full rounded-full transition-all duration-300 ${
                            isCrit ? 'bg-rose-500' : isWarn ? 'bg-amber-500' : 'bg-emerald-400'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Telemetry Meter 2: Signal Quality & PWM Pulse Width */}
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono bg-[var(--bg-primary)] p-2 rounded-lg border border-[var(--border-color)]">
                      <div>
                        <div className="text-slate-500">PWM Pulse:</div>
                        <div className="text-white font-bold">{info.pulseWidthUs} µs</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Signal Integrity:</div>
                        <div className={`font-bold ${info.signalStrength < 85 ? 'text-amber-400' : 'text-cyan-400'}`}>
                          {info.signalStrength}% ({info.dutyCyclePercent}% duty)
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">Est Temp:</div>
                        <div className={`font-bold ${info.estTempC > 48 ? 'text-rose-400' : 'text-slate-300'}`}>
                          {info.estTempC}°C
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">Status:</div>
                        <div className={`font-bold uppercase ${isCrit ? 'text-rose-400' : isWarn ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {info.healthStatus}
                        </div>
                      </div>
                    </div>

                    {/* Individual Relieve Action */}
                    {(isCrit || isWarn) && (
                      <button
                        onClick={() => handleAngleChange(info.servo, 90)}
                        className="w-full py-1 text-[10px] font-bold bg-[var(--bg-primary)] hover:bg-purple-900/40 text-purple-300 rounded border border-[var(--border-color)] flex items-center justify-center gap-1 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3 text-purple-400" />
                        <span>Relieve Motor (Center 90°)</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Servo Angle Distribution & Kinematic Limit Telemetry Visualization */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-5 flex flex-col gap-4 shadow-xl shadow-black/30">
          {/* Header & Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[var(--border-color)]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-400">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-[var(--text-primary)] tracking-wide">
                    Servo Angle Distribution & Limit Telemetry
                  </h2>
                  {extremeCount > 0 ? (
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-rose-400" />
                      {extremeCount} AT EXTREME LIMIT{extremeCount > 1 ? 'S' : ''}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      ALL IN SAFE RANGE
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Real-time angular distribution across the 0° – 180° range. Identifies motors stalling or straining near mechanical boundaries.
                </p>
              </div>
            </div>

            {/* Quick Actions & Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {extremeCount > 0 && (
                <button
                  onClick={handleRelieveExtremeMotors}
                  className="px-2.5 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-200 border border-rose-700/60 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm shadow-rose-950/50"
                  title="Re-centers all servos currently straining at physical min/max limits back to 90°"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                  Relieve Extreme Motors ({extremeCount})
                </button>
              )}

              {/* Filter Tabs */}
              <div className="flex items-center bg-[var(--bg-tertiary)] p-0.5 rounded-lg border border-[var(--border-color)] text-xs">
                <button
                  onClick={() => setFilterMode('all')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    filterMode === 'all'
                      ? 'bg-purple-600 text-white font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All ({servos.length})
                </button>
                <button
                  onClick={() => setFilterMode('extreme')}
                  className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
                    filterMode === 'extreme'
                      ? 'bg-rose-600 text-white font-semibold'
                      : 'text-rose-400 hover:text-rose-300'
                  }`}
                >
                  <span>Extreme</span>
                  {extremeCount > 0 && (
                    <span className="px-1.5 py-0.2 bg-black/40 rounded-full text-[10px] font-bold">
                      {extremeCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setFilterMode('warning')}
                  className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
                    filterMode === 'warning'
                      ? 'bg-amber-600 text-white font-semibold'
                      : 'text-amber-400 hover:text-amber-300'
                  }`}
                >
                  <span>Warning</span>
                  {warningCount > 0 && (
                    <span className="px-1.5 py-0.2 bg-black/40 rounded-full text-[10px] font-bold">
                      {warningCount}
                    </span>
                  )}
                </button>
              </div>

              {/* View Toggle */}
              <div className="flex items-center bg-[var(--bg-tertiary)] p-0.5 rounded-lg border border-[var(--border-color)] text-xs">
                <button
                  onClick={() => setChartView('bars')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    chartView === 'bars'
                      ? 'bg-[var(--border-color)] text-[var(--text-primary)] font-semibold'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  title="Per-motor comparative bar charts"
                >
                  Bars
                </button>
                <button
                  onClick={() => setChartView('distribution')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    chartView === 'distribution'
                      ? 'bg-[#27324c] text-white font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Angular sector distribution histogram"
                >
                  Histogram
                </button>
                <button
                  onClick={() => setChartView('split')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    chartView === 'split'
                      ? 'bg-[#27324c] text-white font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Combined Overview & Bars"
                >
                  Combined
                </button>
              </div>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg p-3 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider">Total Servos</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl font-mono font-extrabold text-[var(--text-primary)]">{servos.length}</span>
                <span className="text-[11px] text-purple-400 font-medium">PWM Hardware</span>
              </div>
            </div>

            <div className={`border rounded-lg p-3 flex flex-col justify-between transition-colors ${
              extremeCount > 0
                ? 'bg-rose-950/20 border-rose-800/60 text-rose-300'
                : 'bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-secondary)]'
            }`}>
              <span className="text-[10px] uppercase font-bold tracking-wider flex items-center justify-between">
                <span>Extreme Limits</span>
                {extremeCount > 0 && <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className={`text-xl font-mono font-extrabold ${extremeCount > 0 ? 'text-rose-400' : 'text-slate-200'}`}>
                  {extremeCount}
                </span>
                <span className="text-[11px]">
                  {extremeCount > 0 ? 'High Stall Risk' : 'None detected'}
                </span>
              </div>
            </div>

            <div className={`border rounded-lg p-3 flex flex-col justify-between transition-colors ${
              warningCount > 0
                ? 'bg-amber-950/20 border-amber-800/60 text-amber-300'
                : 'bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-secondary)]'
            }`}>
              <span className="text-[10px] uppercase font-bold tracking-wider">Near Limits (15°)</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className={`text-xl font-mono font-extrabold ${warningCount > 0 ? 'text-amber-400' : 'text-slate-200'}`}>
                  {warningCount}
                </span>
                <span className="text-[11px]">Nearing edge</span>
              </div>
            </div>

            <div className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg p-3 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider">Average Angle</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl font-mono font-extrabold text-cyan-300">{avgAngle}°</span>
                <span className="text-[11px] text-[var(--text-secondary)]">Ideal ~90°</span>
              </div>
            </div>
          </div>

          {/* Aggregate Distribution Histogram Strip */}
          {(chartView === 'distribution' || chartView === 'split') && (
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)]/80 rounded-lg p-3.5 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-primary)] font-semibold flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  Angle Distribution Bins (0° to 180°)
                </span>
                <span className="text-[11px] text-[var(--text-secondary)]">
                  Click a bin to filter motors
                </span>
              </div>

              {/* 5 Bins Visual Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                {bins.map((bin, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      if (bin.label.includes('Min')) setFilterMode('extreme');
                      else if (bin.label.includes('Max')) setFilterMode('extreme');
                      else if (bin.label.includes('Mid')) setFilterMode('warning');
                      else setFilterMode('all');
                    }}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      bin.count > 0 && bin.isAlert
                        ? 'bg-rose-950/40 border-rose-700/60 hover:bg-rose-900/40'
                        : bin.count > 0 && bin.isWarn
                        ? 'bg-amber-950/40 border-amber-700/60 hover:bg-amber-900/40'
                        : bin.count > 0 && bin.isCenter
                        ? 'bg-emerald-950/40 border-emerald-700/60 hover:bg-emerald-900/40'
                        : 'bg-[var(--bg-tertiary)] border-[var(--border-color)] hover:bg-[var(--bg-secondary)]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-mono">{bin.range}</span>
                      <span className={`font-mono font-bold text-xs ${
                        bin.count > 0 ? (bin.isAlert ? 'text-rose-400' : bin.isCenter ? 'text-emerald-400' : 'text-cyan-300') : 'text-slate-500'
                      }`}>
                        {bin.count} {bin.count === 1 ? 'servo' : 'servos'}
                      </span>
                    </div>
                    {/* Distribution Bar Percentage */}
                    <div className="w-full bg-[var(--bg-primary)] h-2 rounded-full overflow-hidden mt-1.5">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          bin.isAlert ? 'bg-rose-500' : bin.isWarn ? 'bg-amber-500' : bin.isCenter ? 'bg-emerald-500' : 'bg-cyan-500'
                        }`}
                        style={{ width: `${servos.length > 0 ? (bin.count / servos.length) * 100 : 0}%` }}
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px]">
                      <span className={bin.isAlert ? 'text-rose-400 font-bold' : bin.isCenter ? 'text-emerald-400' : 'text-slate-400'}>
                        {bin.label}
                      </span>
                      <span className="text-slate-500 font-mono">
                        {servos.length > 0 ? Math.round((bin.count / servos.length) * 100) : 0}%
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Per-Servo Angle Distribution Bar Chart */}
          {(chartView === 'bars' || chartView === 'split') && (
            <div className="flex flex-col gap-2.5">
              {/* Reference Ruler on top of the bars */}
              <div className="flex items-center justify-between px-3 text-[10px] font-mono text-slate-400 border-b border-[#27324c]/40 pb-1">
                <span className="w-48 text-left uppercase tracking-wider">Servo / Joint</span>
                <div className="flex-1 px-4 flex justify-between relative">
                  <span className="text-rose-400 font-bold">0° (MIN)</span>
                  <span className="text-slate-500">45°</span>
                  <span className="text-emerald-400 font-bold">90° (CENTER)</span>
                  <span className="text-slate-500">135°</span>
                  <span className="text-rose-400 font-bold">180° (MAX)</span>
                </div>
                <span className="w-28 text-right uppercase tracking-wider">Position</span>
              </div>

              {/* Bar Rows */}
              {filteredLimitInfos.length === 0 ? (
                <div className="p-8 text-center bg-[#181f33]/40 rounded-lg border border-dashed border-[#27324c] text-slate-400 text-xs">
                  {filterMode !== 'all' ? (
                    <div className="flex flex-col items-center gap-1.5">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                      <span className="font-semibold text-white">No motors in this category</span>
                      <span className="text-slate-400 text-[11px]">All servos are operating safely outside of extreme limits.</span>
                      <button
                        onClick={() => setFilterMode('all')}
                        className="mt-2 px-3 py-1 bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/40 rounded text-xs font-semibold"
                      >
                        Show All Servos
                      </button>
                    </div>
                  ) : (
                    <span>No connected servos to display. Add a servo above.</span>
                  )}
                </div>
              ) : (
                filteredLimitInfos.map((info) => {
                  const s = info.servo;
                  const pct = Math.max(0, Math.min(100, (info.angle / 180) * 100));

                  return (
                    <div
                      key={s.id}
                      className={`p-3 rounded-lg border transition-all flex flex-col sm:flex-row sm:items-center gap-3 ${
                        info.isExtreme
                          ? 'bg-rose-950/20 border-rose-800/80 shadow-md shadow-rose-950/20'
                          : info.isWarning
                          ? 'bg-amber-950/15 border-amber-800/60'
                          : 'bg-[#181f33]/80 border-[#27324c] hover:border-purple-500/40'
                      }`}
                    >
                      {/* Name & Hardware Pin info */}
                      <div className="w-full sm:w-48 flex items-center justify-between sm:justify-start gap-2">
                        <div className="flex items-center gap-2">
                          <Cpu className={`w-4 h-4 ${
                            info.isExtreme ? 'text-rose-400' : info.isWarning ? 'text-amber-400' : 'text-purple-400'
                          }`} />
                          <div>
                            <div className="text-xs font-bold text-white leading-tight truncate max-w-[120px]">
                              {s.name}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
                              <span className="text-purple-300 font-bold">D{s.pin}</span>
                              <span>•</span>
                              <span>{s.model}</span>
                            </div>
                          </div>
                        </div>

                        {/* Status badge */}
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-tight uppercase border sm:hidden ${
                          info.isExtreme
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : info.isWarning
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : info.status === 'centered'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}>
                          {info.statusLabel}
                        </span>
                      </div>

                      {/* Bar Gauge Visualization */}
                      <div className="flex-1 flex flex-col gap-1">
                        <div className="relative h-6 bg-[#0c0f17] rounded-md border border-[#27324c] overflow-hidden flex items-center">
                          {/* Extreme Min Danger Zone background (0% to ~8%) */}
                          <div
                            className="absolute left-0 top-0 bottom-0 bg-rose-950/40 border-r border-rose-800/40"
                            style={{ width: `${(15 / 180) * 100}%` }}
                            title="Extreme Min Limit Straining Zone (0° - 15°)"
                          />
                          {/* Extreme Max Danger Zone background (~92% to 100%) */}
                          <div
                            className="absolute right-0 top-0 bottom-0 bg-rose-950/40 border-l border-rose-800/40"
                            style={{ width: `${(15 / 180) * 100}%` }}
                            title="Extreme Max Limit Straining Zone (165° - 180°)"
                          />

                          {/* Center 90° reference line */}
                          <div
                            className="absolute top-0 bottom-0 w-[2px] bg-emerald-500/60 z-10"
                            style={{ left: '50%', transform: 'translateX(-50%)' }}
                            title="Neutral Rest Axis (90°)"
                          />

                          {/* Quarter guide tick lines */}
                          <div
                            className="absolute top-0 bottom-0 w-[1px] bg-slate-700/50"
                            style={{ left: '25%' }}
                          />
                          <div
                            className="absolute top-0 bottom-0 w-[1px] bg-slate-700/50"
                            style={{ left: '75%' }}
                          />

                          {/* Dynamic Progress Fill Bar */}
                          <div
                            className={`h-full transition-all duration-200 relative ${
                              info.isExtreme
                                ? 'bg-gradient-to-r from-rose-600 to-rose-400 shadow-lg shadow-rose-500/50'
                                : info.isWarning
                                ? 'bg-gradient-to-r from-amber-600 to-amber-400'
                                : info.status === 'centered'
                                ? 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                                : 'bg-gradient-to-r from-purple-600 to-cyan-400'
                            }`}
                            style={{ width: `${pct}%` }}
                          />

                          {/* Needle Indicator Marker */}
                          <div
                            className="absolute top-0 bottom-0 w-2.5 rounded-sm bg-white shadow-md shadow-black z-20 transition-all duration-200 -ml-1 border border-slate-900"
                            style={{ left: `${pct}%` }}
                            title={`Pin D${s.pin}: ${info.angle}°`}
                          />
                        </div>

                        {/* Sub-bar scale details */}
                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono px-0.5">
                          <span>Min: {s.minAngle}°</span>
                          <span className="hidden sm:inline">
                            {info.isExtreme ? (
                              <span className="text-rose-400 font-bold flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                {info.status === 'extreme_min' ? 'Straining at Minimum Stop' : 'Straining at Maximum Stop'}
                              </span>
                            ) : info.isWarning ? (
                              <span className="text-amber-400 font-semibold">Nearing Travel Limit</span>
                            ) : info.status === 'centered' ? (
                              <span className="text-emerald-400 font-semibold">Balanced at Neutral Center</span>
                            ) : (
                              <span className="text-slate-400">Safe Mid-Range Travel</span>
                            )}
                          </span>
                          <span>Max: {s.maxAngle}°</span>
                        </div>
                      </div>

                      {/* Position Value & Quick Center Button */}
                      <div className="w-full sm:w-28 flex items-center justify-between sm:justify-end gap-2">
                        <div className="text-right">
                          <div className={`font-mono text-base font-extrabold leading-none ${
                            info.isExtreme
                              ? 'text-rose-400'
                              : info.isWarning
                              ? 'text-amber-400'
                              : info.status === 'centered'
                              ? 'text-emerald-400'
                              : 'text-white'
                          }`}>
                            {info.angle}°
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {Math.round(pct)}% travel
                          </div>
                        </div>

                        {/* Quick 90° Center Action */}
                        <button
                          onClick={() => handleAngleChange(s, 90)}
                          className={`px-2 py-1 text-[10px] font-bold font-mono rounded border transition-colors ${
                            info.angle === 90
                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60'
                              : info.isExtreme
                              ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400 shadow-sm shadow-rose-950/50 animate-pulse'
                              : 'bg-[#0c0f17] hover:bg-[#202945] text-slate-300 border-[#27324c]'
                          }`}
                          title="Instantly center motor to neutral 90°"
                        >
                          90°
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Servo Cards Grid */}
        <div className="servo-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {servos.map((servo) => (
            <div
              key={servo.id}
              className="bg-[#111625] border border-[#27324c] rounded-xl p-4 flex flex-col justify-between gap-4 hover:border-purple-500/50 transition-colors shadow-lg shadow-black/20"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-purple-400" />
                  <input
                    type="text"
                    value={servo.name}
                    onChange={(e) => onUpdateServo({ ...servo, name: e.target.value })}
                    className="font-bold text-sm text-white bg-transparent border-b border-transparent hover:border-[#27324c] focus:border-purple-400 focus:outline-none w-36"
                  />
                </div>

                {/* Pin assignment dropdown & Y-Axis indication */}
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 text-[10px] font-mono border border-emerald-800/60 font-semibold" title="Calibrated rotation axis">
                    Y-Axis
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">PIN:</span>
                  <select
                    value={servo.pin}
                    onChange={(e) =>
                      onUpdateServo({ ...servo, pin: parseInt(e.target.value, 10) })
                    }
                    className="bg-[#181f33] border border-[#27324c] rounded px-1.5 py-0.5 text-xs text-purple-300 font-mono font-bold"
                  >
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((pinNum) => (
                      <option key={pinNum} value={pinNum}>
                        D{pinNum}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Angle Slider & Direct Numeric Entry */}
              <div className="bg-[#181f33] p-3 rounded-lg border border-[#27324c]/60 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Position Angle:</span>
                  <div className="flex items-center gap-1">
                    <span className="text-purple-300 font-mono font-bold text-lg">{servo.targetAngle}°</span>
                  </div>
                </div>

                <input
                  type="range"
                  min={servo.minAngle}
                  max={servo.maxAngle}
                  value={servo.targetAngle}
                  onChange={(e) => handleAngleChange(servo, parseInt(e.target.value, 10))}
                  className={`${isKidMode ? 'h-10' : 'h-2'} accent-purple-500 cursor-pointer w-full bg-[#0c0f17] rounded-lg`}
                />

                {/* Preset Step Buttons - simplify if kid mode */}
                <div className="flex items-center gap-1 mt-1">
                  {[0, 90, 180].map((deg) => (
                    <button
                      key={deg}
                      onClick={() => handleAngleChange(servo, deg)}
                      className={`flex-1 ${isKidMode ? 'py-3' : 'py-1.5'} text-xs font-mono rounded border transition-colors ${
                        servo.targetAngle === deg
                          ? 'bg-purple-600 text-white border-purple-400 font-bold'
                          : 'bg-[#0c0f17] hover:bg-purple-950/40 text-slate-300 border-[#27324c]'
                      }`}
                    >
                      {deg}°
                    </button>
                  ))}
                  <button
                    onClick={() => handleSlowMoveSingleTo90(servo)}
                    className={`${isKidMode ? 'px-4 py-3' : 'px-2.5 py-1.5'} text-xs font-bold rounded border bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border-emerald-500/50 flex items-center justify-center gap-1 transition-colors shadow-sm`}
                    title="Slowly ease this specific servo to 90° center"
                  >
                    <span>🐢</span>
                    <span>Slow 90°</span>
                  </button>
                </div>

                {/* Hide fine rotation buttons in Kid Mode */}
                {!isKidMode && (
                  <div className="flex items-center gap-1 mt-1">
                    {[-15, -5, 5, 15].map((delta) => (
                      <button
                        key={delta}
                        onClick={() => handleAngleChange(servo, (servo.targetAngle ?? 90) + delta)}
                        className="flex-1 py-1 text-[10px] font-mono rounded bg-[#0c0f17] hover:bg-purple-950/40 text-purple-300 border border-[#27324c] transition-colors"
                        title={`Rotate servo by ${delta > 0 ? `+${delta}` : delta}°`}
                      >
                        {delta > 0 ? `+${delta}°` : `${delta}°`}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Servo Body Orientation (Pitch X, Yaw Y, Roll Z) */}
              <div className="bg-[#141b2d] p-2.5 rounded-lg border border-[#27324c]/60 flex flex-col gap-2">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                    Servo Body Orientation (Pitch / Yaw / Roll)
                  </span>
                  <button
                    onClick={() => onUpdateServo({ ...servo, rotation: [0, 0, 0] })}
                    className="text-[10px] text-slate-400 hover:text-cyan-300 font-mono"
                    title="Reset servo body rotation to 0°, 0°, 0°"
                  >
                    Reset 0°
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono">
                  <div className="flex flex-col gap-1 bg-[#0c0f17] p-1.5 rounded border border-[#27324c]">
                    <span className="text-rose-400 font-bold">X (Pitch)</span>
                    <input
                      type="number"
                      value={servo.rotation[0] || 0}
                      onChange={(e) =>
                        onUpdateServo({
                          ...servo,
                          rotation: [parseInt(e.target.value, 10) || 0, servo.rotation[1], servo.rotation[2]],
                        })
                      }
                      className="w-full bg-[#181f33] border border-[#27324c] rounded text-center text-white font-bold"
                    />
                  </div>
                  <div className="flex flex-col gap-1 bg-[#0c0f17] p-1.5 rounded border border-[#27324c]">
                    <span className="text-emerald-400 font-bold">Y (Yaw)</span>
                    <input
                      type="number"
                      value={servo.rotation[1] || 0}
                      onChange={(e) =>
                        onUpdateServo({
                          ...servo,
                          rotation: [servo.rotation[0], parseInt(e.target.value, 10) || 0, servo.rotation[2]],
                        })
                      }
                      className="w-full bg-[#181f33] border border-[#27324c] rounded text-center text-white font-bold"
                    />
                  </div>
                  <div className="flex flex-col gap-1 bg-[#0c0f17] p-1.5 rounded border border-[#27324c]">
                    <span className="text-cyan-400 font-bold">Z (Roll)</span>
                    <input
                      type="number"
                      value={servo.rotation[2] || 0}
                      onChange={(e) =>
                        onUpdateServo({
                          ...servo,
                          rotation: [servo.rotation[0], servo.rotation[1], parseInt(e.target.value, 10) || 0],
                        })
                      }
                      className="w-full bg-[#181f33] border border-[#27324c] rounded text-center text-white font-bold"
                    />
                  </div>
                </div>
                {/* Quick 90 deg body flip buttons */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      onUpdateServo({
                        ...servo,
                        rotation: [(servo.rotation[0] + 90) % 360, servo.rotation[1], servo.rotation[2]],
                      })
                    }
                    className="flex-1 py-0.5 text-[9px] font-mono rounded bg-[#0c0f17] hover:bg-rose-950/40 text-rose-300 border border-[#27324c]"
                  >
                    +90° X
                  </button>
                  <button
                    onClick={() =>
                      onUpdateServo({
                        ...servo,
                        rotation: [servo.rotation[0], (servo.rotation[1] + 90) % 360, servo.rotation[2]],
                      })
                    }
                    className="flex-1 py-0.5 text-[9px] font-mono rounded bg-[#0c0f17] hover:bg-emerald-950/40 text-emerald-300 border border-[#27324c]"
                  >
                    +90° Y
                  </button>
                  <button
                    onClick={() =>
                      onUpdateServo({
                        ...servo,
                        rotation: [servo.rotation[0], servo.rotation[1], (servo.rotation[2] + 90) % 360],
                      })
                    }
                    className="flex-1 py-0.5 text-[9px] font-mono rounded bg-[#0c0f17] hover:bg-cyan-950/40 text-cyan-300 border border-[#27324c]"
                  >
                    +90° Z
                  </button>
                </div>
              </div>

              {/* Calibration & Specs: Limits & Pulse Width */}
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                <div className="flex items-center justify-between bg-[#141b2d] p-1.5 rounded border border-[#27324c]/40">
                  <span>Min Angle:</span>
                  <input
                    type="number"
                    min="0"
                    max="90"
                    value={servo.minAngle}
                    onChange={(e) => {
                      onUpdateServo({ ...servo, minAngle: parseInt(e.target.value, 10) || 0 });
                      soundEffects.playServoLocking();
                    }}
                    className="w-10 bg-[#0c0f17] border border-[#27324c] rounded text-center text-white font-mono"
                  />
                </div>
                <div className="flex items-center justify-between bg-[#141b2d] p-1.5 rounded border border-[#27324c]/40">
                  <span>Max Angle:</span>
                  <input
                    type="number"
                    min="90"
                    max="180"
                    value={servo.maxAngle}
                    onChange={(e) => {
                      onUpdateServo({ ...servo, maxAngle: parseInt(e.target.value, 10) || 180 });
                      soundEffects.playServoLocking();
                    }}
                    className="w-10 bg-[#0c0f17] border border-[#27324c] rounded text-center text-white font-mono"
                  />
                </div>
                <div className="flex items-center justify-between bg-[#141b2d] p-1.5 rounded border border-[#27324c]/40">
                  <span>Min Pulse:</span>
                  <input
                    type="number"
                    min="500"
                    max="2500"
                    value={servo.minPulse || 500}
                    onChange={(e) => {
                      onUpdateServo({ ...servo, minPulse: parseInt(e.target.value, 10) || 500 });
                      soundEffects.playServoLocking();
                    }}
                    className="w-10 bg-[#0c0f17] border border-[#27324c] rounded text-center text-white font-mono"
                  />
                </div>
                <div className="flex items-center justify-between bg-[#141b2d] p-1.5 rounded border border-[#27324c]/40">
                  <span>Max Pulse:</span>
                  <input
                    type="number"
                    min="500"
                    max="2500"
                    value={servo.maxPulse || 2500}
                    onChange={(e) => {
                      onUpdateServo({ ...servo, maxPulse: parseInt(e.target.value, 10) || 2500 });
                      soundEffects.playServoLocking();
                    }}
                    className="w-10 bg-[#0c0f17] border border-[#27324c] rounded text-center text-white font-mono"
                  />
                </div>
              </div>

              {/* Card Footer: Model Type & Delete */}
              <div className="flex items-center justify-between pt-2 border-t border-[#27324c]/60 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-500">Model:</span>
                  <select
                    value={servo.model}
                    onChange={(e) =>
                      onUpdateServo({ ...servo, model: e.target.value as ServoModel })
                    }
                    className="bg-[#181f33] border border-[#27324c] rounded px-1.5 py-0.5 text-[10px] text-slate-300"
                  >
                    <option value="SG90">TowerPro SG90 (9g)</option>
                    <option value="MG995">MG995 High-Torque</option>
                    <option value="DS3218">DS3218 20kg Metal</option>
                  </select>
                </div>

                <button
                  onClick={() => onDeleteServo(servo.id)}
                  className="text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-950/30"
                  title="Delete Servo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
        {/* Wiring Tutorial Section */}
        <div className="wiring-tutorial bg-[#111625] border border-[#27324c] rounded-xl p-5 shadow-xl">
          <h3 className="text-sm font-bold text-white mb-4">Real-Time 3D Servo Wiring Guide</h3>
          <div className="h-64 bg-slate-900 rounded-lg flex items-center justify-center border border-[#27324c] dashed">
            <span className="text-slate-500 text-xs">Real-Time 3D Wiring Diagram Placeholder</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4 text-xs text-slate-300">
            <div className="p-2 bg-black rounded border border-slate-700">GND (Brown/Black) ➔ Arduino GND</div>
            <div className="p-2 bg-black rounded border border-slate-700">VCC (Red) ➔ Arduino 5V</div>
            <div className="p-2 bg-black rounded border border-slate-700">Signal (Orange/Yellow) ➔ PWM Pin</div>
          </div>
        </div>

        {/* Existing Content ... */}
        
        {/* Render Tour */}
        {showTour && <GuidedTour steps={tourSteps} onFinish={() => setShowTour(false)} />}
      </div>
    </div>
  );
};

