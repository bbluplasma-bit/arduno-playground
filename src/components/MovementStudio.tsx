import React, { useState, useEffect, useRef } from 'react';
import { MovementSequence, Keyframe, ServoMotor } from '../types';
import { arduinoSerial } from '../services/arduinoSerial';
import {
  Film,
  Play,
  Pause,
  Square,
  Repeat,
  Plus,
  Trash2,
  Download,
  Copy,
  Clock,
  CheckCircle2,
  Radio,
  Sliders,
  Sparkles,
} from 'lucide-react';

interface MovementStudioProps {
  servos: ServoMotor[];
  sequences: MovementSequence[];
  onUpdateSequences: (seqs: MovementSequence[]) => void;
  onUpdateServo: (servo: ServoMotor) => void;
}

export const MovementStudio: React.FC<MovementStudioProps> = ({
  servos = [],
  sequences = [],
  onUpdateSequences,
  onUpdateServo,
}) => {
  const [activeSeqIndex, setActiveSeqIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentKeyframeIndex, setCurrentKeyframeIndex] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isLooping, setIsLooping] = useState<boolean>(true);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const playbackTimerRef = useRef<any>(null);

  // Fallback default sequence if sequences array is empty or undefined
  const defaultFallbackSequence: MovementSequence = {
    id: 'default_seq',
    name: 'Main Routine',
    keyframes: [],
    loop: true,
    speedMultiplier: 1.0,
  };

  const safeSequences = Array.isArray(sequences) && sequences.length > 0 ? sequences : [defaultFallbackSequence];
  const activeSequence = safeSequences[activeSeqIndex] || safeSequences[0] || defaultFallbackSequence;
  const keyframesList = Array.isArray(activeSequence?.keyframes) ? activeSequence.keyframes : [];

  // Stop playback when unmounting or switching sequences
  useEffect(() => {
    return () => {
      if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
    };
  }, []);

  // Execute a specific keyframe pose
  const applyKeyframe = (kf: Keyframe) => {
    if (!kf || !kf.angles) return;
    for (const servo of servos) {
      if (kf.angles[servo.id] !== undefined) {
        const targetAngle = kf.angles[servo.id];
        onUpdateServo({
          ...servo,
          targetAngle,
          currentAngle: targetAngle,
        });

        if (arduinoSerial.status === 'connected') {
          arduinoSerial.setServoAngle(servo.pin, targetAngle);
        }
      }
    }
  };

  // Step-through animation loop
  const stepAnimation = (index: number) => {
    if (keyframesList.length === 0) {
      setIsPlaying(false);
      return;
    }

    const nextIndex = index >= keyframesList.length ? 0 : index;
    if (index >= keyframesList.length && !isLooping) {
      setIsPlaying(false);
      return;
    }

    setCurrentKeyframeIndex(nextIndex);
    const kf = keyframesList[nextIndex];
    if (kf) {
      applyKeyframe(kf);
    }

    const adjustedDuration = ((kf?.durationMs) || 500) / playbackSpeed;
    playbackTimerRef.current = setTimeout(() => {
      stepAnimation(nextIndex + 1);
    }, adjustedDuration);
  };

  const handlePlay = () => {
    if (keyframesList.length === 0) return;
    setIsPlaying(true);
    stepAnimation(currentKeyframeIndex);
  };

  const handlePause = () => {
    setIsPlaying(false);
    if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
  };

  const handleStop = () => {
    setIsPlaying(false);
    if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
    setCurrentKeyframeIndex(0);
    if (keyframesList.length > 0) {
      applyKeyframe(keyframesList[0]);
    }
  };

  // Record current robot pose as a new keyframe
  const handleRecordPose = () => {
    const angles: Record<string, number> = {};
    servos.forEach((s) => {
      angles[s.id] = s.targetAngle;
    });

    const newKf: Keyframe = {
      id: Math.random().toString(36).substring(2, 9),
      name: `Pose ${keyframesList.length + 1}`,
      timestampMs: keyframesList.length * 500,
      durationMs: 500,
      angles,
    };

    const updatedSeq = {
      ...activeSequence,
      keyframes: [...keyframesList, newKf],
    };

    const currentList = Array.isArray(sequences) && sequences.length > 0 ? sequences : [activeSequence];
    const updatedSeqs = currentList.map((s, idx) => (idx === activeSeqIndex ? updatedSeq : s));
    onUpdateSequences(updatedSeqs);
  };

  const handleDeleteKeyframe = (kfId: string) => {
    const updatedSeq = {
      ...activeSequence,
      keyframes: keyframesList.filter((kf) => kf.id !== kfId),
    };
    const currentList = Array.isArray(sequences) && sequences.length > 0 ? sequences : [activeSequence];
    const updatedSeqs = currentList.map((s, idx) => (idx === activeSeqIndex ? updatedSeq : s));
    onUpdateSequences(updatedSeqs);
  };

  const handleCreateNewSequence = () => {
    const newSeq: MovementSequence = {
      id: Math.random().toString(36).substring(2, 9),
      name: `Sequence ${safeSequences.length + 1}`,
      keyframes: [],
      loop: true,
      speedMultiplier: 1.0,
    };
    onUpdateSequences([...safeSequences, newSeq]);
    setActiveSeqIndex(safeSequences.length);
  };

  // Generate Arduino C++ code from this sequence
  const generateArduinoCode = (): string => {
    let code = `/*\n  Auto-Generated Motion Sequence: ${activeSequence.name || 'Routine'}\n  Arduino Control Studio\n*/\n#include <Servo.h>\n\n`;

    servos.forEach((s) => {
      code += `Servo servo_pin_${s.pin};\n`;
    });

    code += `\nvoid setup() {\n`;
    servos.forEach((s) => {
      code += `  servo_pin_${s.pin}.attach(${s.pin});\n`;
    });
    code += `}\n\nvoid loop() {\n`;

    keyframesList.forEach((kf, idx) => {
      code += `  // Frame ${idx + 1}: ${kf.name}\n`;
      servos.forEach((s) => {
        const angle = kf.angles[s.id] ?? 90;
        code += `  servo_pin_${s.pin}.write(${angle});\n`;
      });
      code += `  delay(${kf.durationMs});\n\n`;
    });

    if (!isLooping) {
      code += `  while(1); // Halt if not looping\n`;
    }
    code += `}\n`;
    return code;
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generateArduinoCode());
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#27324c]">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Film className="w-5 h-5 text-cyan-400" />
              Kinematic Movement Studio & Animation Sequencer
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Record physical & 3D poses, scrub keyframe timelines, and broadcast synchronized routines to Arduino hardware
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateNewSequence}
              className="px-3.5 py-1.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg text-xs font-semibold flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-cyan-400" /> New Routine
            </button>
            <button
              onClick={handleCopyCode}
              className="px-3.5 py-1.5 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              {copiedCode ? 'Code Copied!' : 'Export C++ Code'}
            </button>
          </div>
        </div>

        {/* Routine Selector Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {safeSequences.map((seq, idx) => (
            <button
              key={seq.id}
              onClick={() => {
                handleStop();
                setActiveSeqIndex(idx);
              }}
              className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
                idx === activeSeqIndex
                  ? 'bg-cyan-950/40 border-cyan-500 text-cyan-300 shadow-md'
                  : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {seq.name} ({Array.isArray(seq.keyframes) ? seq.keyframes.length : 0} frames)
            </button>
          ))}
        </div>

        {/* Master Transport Controls */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {isPlaying ? (
              <button
                onClick={handlePause}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 rounded-lg font-bold text-xs uppercase flex items-center gap-1.5"
              >
                <Pause className="w-4 h-4" /> Pause
              </button>
            ) : (
              <button
                onClick={handlePlay}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs uppercase flex items-center gap-1.5 shadow-md shadow-emerald-950/50"
              >
                <Play className="w-4 h-4" /> Play Sequence
              </button>
            )}

            <button
              onClick={handleStop}
              className="px-3.5 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-[var(--border-color)]"
            >
              <Square className="w-3.5 h-3.5" /> Stop
            </button>

            <button
              onClick={() => setIsLooping(!isLooping)}
              className={`px-3 py-2 rounded-lg text-xs flex items-center gap-1.5 border transition-colors ${
                isLooping
                  ? 'bg-cyan-950/60 border-cyan-500 text-cyan-400 font-semibold'
                  : 'bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-secondary)]'
              }`}
            >
              <Repeat className="w-3.5 h-3.5" /> Loop
            </button>
          </div>

          {/* Speed Multiplier & Frame Record */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              <span>Speed:</span>
              {[0.5, 1.0, 1.5, 2.0].map((s) => (
                <button
                  key={s}
                  onClick={() => setPlaybackSpeed(s)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                    playbackSpeed === s
                      ? 'bg-cyan-600 text-slate-950 font-bold'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>

            <button
              onClick={handleRecordPose}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-purple-950/50"
            >
              <Plus className="w-4 h-4" /> Record Current Pose
            </button>
          </div>
        </div>

        {/* Visual Keyframe Timeline Strip */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              Keyframe Nodes & Pose Scrubber ({keyframesList.length} Keyframes)
            </span>
            <span className="text-[var(--text-secondary)] font-mono text-[11px]">
              Active Frame: {currentKeyframeIndex + 1} / {keyframesList.length || 1}
            </span>
          </div>

          {keyframesList.length === 0 ? (
            <div className="p-10 border border-dashed border-[var(--border-color)] rounded-xl text-center text-xs text-[var(--text-secondary)] flex flex-col items-center gap-2">
              <span>No keyframe poses recorded yet.</span>
              <span className="text-slate-500 text-[11px]">
                Adjust servo angles in the 3D Studio or Servo Controller, then click "Record Current Pose".
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {keyframesList.map((kf, idx) => {
                const isActive = idx === currentKeyframeIndex;
                return (
                  <div
                    key={kf.id}
                    onClick={() => {
                      setCurrentKeyframeIndex(idx);
                      applyKeyframe(kf);
                    }}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                      isActive
                        ? 'bg-cyan-950/30 border-cyan-400 shadow-md shadow-cyan-950/50'
                        : 'bg-[var(--bg-tertiary)] border-[var(--border-color)] hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-[var(--text-primary)]">
                        #{idx + 1} {kf.name}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteKeyframe(kf.id);
                        }}
                        className="text-slate-500 hover:text-rose-400 p-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Servo Angles in this pose */}
                    <div className="flex flex-wrap gap-1.5">
                      {servos.map((s) => (
                        <span
                          key={s.id}
                          className="px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-purple-300 font-mono text-[10px] border border-[var(--border-color)]"
                        >
                          P{s.pin}: {kf.angles?.[s.id] ?? 90}°
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] pt-2 border-t border-[var(--border-color)]/40">
                      <span>Hold: {kf.durationMs}ms</span>
                      {isActive && <span className="text-cyan-400 font-mono font-bold">ACTIVE</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
