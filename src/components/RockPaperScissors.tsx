import React, { useState, useEffect, useRef } from 'react';
import { ServoMotor } from '../types';
import { arduinoSerial } from '../services/arduinoSerial';
import {
  Trophy,
  Play,
  RotateCcw,
  Sparkles,
  Zap,
  Volume2,
  VolumeX,
  Code,
  CheckCircle2,
  Cpu,
  Radio,
  Gamepad2,
  Flame,
  Award,
  Copy,
  Download,
} from 'lucide-react';

export type GestureMove = 'rock' | 'paper' | 'scissors';

interface RockPaperScissorsProps {
  servos: ServoMotor[];
  onUpdateServo: (servo: ServoMotor) => void;
  activeProjectName: string;
  isKidMode?: boolean;
}

export const RockPaperScissors: React.FC<RockPaperScissorsProps> = ({
  servos,
  onUpdateServo,
  activeProjectName,
  isKidMode = false,
}) => {
  // Active Servo Pin selection for gesture arm
  const [selectedServoId, setSelectedServoId] = useState<string>(
    servos.length > 0 ? servos[0].id : ''
  );

  // Servo Poses for Gestures
  const [gestureAngles, setGestureAngles] = useState<Record<GestureMove, number>>({
    rock: 0,
    scissors: 90,
    paper: 180,
  });

  // Sound FX toggle
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Game Score & Stats
  const [humanScore, setHumanScore] = useState<number>(0);
  const [botScore, setBotScore] = useState<number>(0);
  const [ties, setTies] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(0);

  // Round State
  const [humanMove, setHumanMove] = useState<GestureMove | null>(null);
  const [botMove, setBotMove] = useState<GestureMove | null>(null);
  const [result, setResult] = useState<'win' | 'loss' | 'tie' | null>(null);
  const [isCountdown, setIsCountdown] = useState<boolean>(false);
  const [countdownStep, setCountdownStep] = useState<number | null>(null);
  const [roundHistory, setRoundHistory] = useState<
    { id: string; human: GestureMove; bot: GestureMove; result: 'win' | 'loss' | 'tie'; time: string }[]
  >([]);

  // Tournament Auto Mode
  const [isAutoTournament, setIsAutoTournament] = useState<boolean>(false);
  const autoIntervalRef = useRef<number | null>(null);

  // Active Selected Servo
  const activeServo = servos.find((s) => s.id === selectedServoId) || servos[0];

  // Sound synthesis using Web Audio API
  const playBeep = (freq: number, type: OscillatorType = 'sine', duration = 0.15) => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio context fallback
    }
  };

  // Play gesture physical hardware servo action
  const executePhysicalMove = async (move: GestureMove) => {
    const angle = gestureAngles[move];
    if (activeServo) {
      const updated = { ...activeServo, currentAngle: angle, targetAngle: angle };
      onUpdateServo(updated);
      if (arduinoSerial.status === 'connected') {
        await arduinoSerial.setServoAngle(activeServo.pin, angle);
      }
    }
  };

  // Pump countdown motion (pumps servo up & down 3 times)
  const runPumpMotionStep = async (step: number) => {
    if (!activeServo) return;
    const pumpAngle = step % 2 === 1 ? 130 : 60;
    if (arduinoSerial.status === 'connected') {
      await arduinoSerial.setServoAngle(activeServo.pin, pumpAngle);
    }
  };

  // Trigger RPS Round with countdown
  const handlePlayRound = (userSelectedMove: GestureMove) => {
    if (isCountdown) return;

    setHumanMove(userSelectedMove);
    setBotMove(null);
    setResult(null);
    setIsCountdown(true);
    setCountdownStep(3);

    playBeep(440, 'triangle', 0.2);
    runPumpMotionStep(3);

    // Step 2
    setTimeout(() => {
      setCountdownStep(2);
      playBeep(520, 'triangle', 0.2);
      runPumpMotionStep(2);
    }, 600);

    // Step 1
    setTimeout(() => {
      setCountdownStep(1);
      playBeep(660, 'triangle', 0.2);
      runPumpMotionStep(1);
    }, 1200);

    // SHOOT!
    setTimeout(() => {
      setCountdownStep(0); // "SHOOT!"

      // Random Bot Decision
      const moves: GestureMove[] = ['rock', 'paper', 'scissors'];
      const robotChoice = moves[Math.floor(Math.random() * moves.length)];
      setBotMove(robotChoice);

      // Execute physical gesture on servo
      executePhysicalMove(robotChoice);

      // Determine Winner
      let outcome: 'win' | 'loss' | 'tie' = 'tie';

      if (userSelectedMove === robotChoice) {
        outcome = 'tie';
        setTies((prev) => prev + 1);
        playBeep(587, 'square', 0.3);
      } else if (
        (userSelectedMove === 'rock' && robotChoice === 'scissors') ||
        (userSelectedMove === 'paper' && robotChoice === 'rock') ||
        (userSelectedMove === 'scissors' && robotChoice === 'paper')
      ) {
        outcome = 'win';
        setHumanScore((prev) => prev + 1);
        setStreak((prev) => {
          const next = prev + 1;
          if (next > bestStreak) setBestStreak(next);
          return next;
        });
        playBeep(880, 'sine', 0.4);
      } else {
        outcome = 'loss';
        setBotScore((prev) => prev + 1);
        setStreak(0);
        playBeep(220, 'sawtooth', 0.5);
      }

      setResult(outcome);
      setIsCountdown(false);

      // Add to Round History
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setRoundHistory((prev) => [
        { id: Math.random().toString(36).substring(2, 9), human: userSelectedMove, bot: robotChoice, result: outcome, time: timeStr },
        ...prev.slice(0, 19),
      ]);
    }, 1800);
  };

  // Reset Tournament Scores
  const handleResetScores = () => {
    setHumanScore(0);
    setBotScore(0);
    setTies(0);
    setStreak(0);
    setHumanMove(null);
    setBotMove(null);
    setResult(null);
    setRoundHistory([]);
  };

  // Toggle Auto Tournament mode
  useEffect(() => {
    if (isAutoTournament) {
      const moves: GestureMove[] = ['rock', 'paper', 'scissors'];
      autoIntervalRef.current = window.setInterval(() => {
        const randomMove = moves[Math.floor(Math.random() * moves.length)];
        handlePlayRound(randomMove);
      }, 3200);
    } else {
      if (autoIntervalRef.current) clearInterval(autoIntervalRef.current);
    }

    return () => {
      if (autoIntervalRef.current) clearInterval(autoIntervalRef.current);
    };
  }, [isAutoTournament]);

  // Generate Arduino C++ Firmware Code
  const generatedArduinoCode = `/*
  ARDUINO CONTROL STUDIO – ROCK PAPER SCISSORS ROBOT FIRMWARE
  Project: ${activeProjectName}
  Hardware: Arduino Uno / Mega / Nano
  Servo Pin: Digital Pin ${activeServo ? activeServo.pin : 9}
*/

#include <Servo.h>

Servo gestureServo;

const int SERVO_PIN = ${activeServo ? activeServo.pin : 9};

// Calibrated Angles
const int ANGLE_ROCK = ${gestureAngles.rock};
const int ANGLE_PAPER = ${gestureAngles.paper};
const int ANGLE_SCISSORS = ${gestureAngles.scissors};

void setup() {
  Serial.begin(115200);
  gestureServo.attach(SERVO_PIN);
  gestureServo.write(90); // Home position
  Serial.println("RPS Robot Ready!");
}

void loop() {
  if (Serial.available() > 0) {
    String command = Serial.readStringUntil('\\n');
    command.trim();

    if (command == "ROCK") {
      playCountdownAndMove(ANGLE_ROCK);
    } else if (command == "PAPER") {
      playCountdownAndMove(ANGLE_PAPER);
    } else if (command == "SCISSORS") {
      playCountdownAndMove(ANGLE_SCISSORS);
    }
  }
}

void playCountdownAndMove(int targetAngle) {
  // 3-2-1 Countdown Servo Pump
  for (int i = 0; i < 3; i++) {
    gestureServo.write(130);
    delay(300);
    gestureServo.write(60);
    delay(300);
  }
  // Shoot Gesture Pose
  gestureServo.write(targetAngle);
  delay(1000);
  gestureServo.write(90); // Return to neutral
}
`;

  const [copiedCode, setCopiedCode] = useState(false);
  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedArduinoCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const moveEmoji = (move: GestureMove) => {
    if (move === 'rock') return '🪨';
    if (move === 'paper') return '📄';
    return '✂️';
  };

  const moveName = (move: GestureMove) => {
    if (move === 'rock') return 'ROCK';
    if (move === 'paper') return 'PAPER';
    return 'SCISSORS';
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#0c0f17] text-slate-100 flex flex-col gap-6 font-sans select-none">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#27324c]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-purple-950">
            <Gamepad2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-wide">
                ROCK PAPER SCISSORS ROBOT SHOWDOWN
              </h1>
              <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 font-mono text-[10px] border border-purple-800 font-bold">
                AI GAME ENGINE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Challenge your Arduino robot to Rock-Paper-Scissors with real-time physical servo gesture execution!
            </p>
          </div>
        </div>

        {/* Quick Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              soundEnabled
                ? 'bg-purple-950/60 text-purple-300 border-purple-800'
                : 'bg-[#181f33] text-slate-500 border-[#27324c]'
            }`}
            title="Toggle Sound Effects"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-purple-400" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{soundEnabled ? 'Audio FX On' : 'Muted'}</span>
          </button>

          <button
            onClick={handleResetScores}
            className="px-3 py-2 bg-[#181f33] hover:bg-[#202945] text-slate-300 border border-[#27324c] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Reset Scoreboard</span>
          </button>
        </div>
      </div>

      {/* Main Scoreboard & Battle Arena */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Servo Mapping & Hardware Setup */}
        <div className="flex flex-col gap-4">
          <div className="bg-[#111625] border border-[#27324c] rounded-xl p-5 flex flex-col gap-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#27324c]/60">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-purple-400" />
                <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                  1. Servo Hardware Mapping
                </h2>
              </div>
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800 font-semibold">
                PIN D{activeServo ? activeServo.pin : '9'}
              </span>
            </div>

            {/* Select Servo Drive */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-mono text-slate-400">Select Robot Arm Servo:</label>
              <select
                value={selectedServoId}
                onChange={(e) => setSelectedServoId(e.target.value)}
                className="bg-[#181f33] border border-[#27324c] rounded-lg p-2 text-xs text-white outline-none font-bold"
              >
                {servos.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (Pin D{s.pin})
                  </option>
                ))}
              </select>
            </div>

            {/* Calibrate Gesture Pose Angles */}
            <div className="flex flex-col gap-3 pt-2">
              <div className="text-[11px] font-mono text-slate-400 uppercase font-bold">
                Gesture Pose Calibration (°):
              </div>

              {/* Rock Pose */}
              <div className="bg-[#181f33] p-3 rounded-lg border border-[#27324c] flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <span>🪨</span> ROCK Pose:
                  </span>
                  <span className="font-mono text-purple-300 font-bold">{gestureAngles.rock}°</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="180"
                    value={gestureAngles.rock}
                    onChange={(e) =>
                      setGestureAngles({ ...gestureAngles, rock: parseInt(e.target.value, 10) })
                    }
                    className="flex-1 accent-purple-500 cursor-pointer"
                  />
                  <button
                    onClick={() => executePhysicalMove('rock')}
                    className="px-2.5 py-1 bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/40 rounded text-[10px] font-mono font-bold"
                  >
                    Test
                  </button>
                </div>
              </div>

              {/* Scissors Pose */}
              <div className="bg-[#181f33] p-3 rounded-lg border border-[#27324c] flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <span>✂️</span> SCISSORS Pose:
                  </span>
                  <span className="font-mono text-cyan-300 font-bold">{gestureAngles.scissors}°</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="180"
                    value={gestureAngles.scissors}
                    onChange={(e) =>
                      setGestureAngles({ ...gestureAngles, scissors: parseInt(e.target.value, 10) })
                    }
                    className="flex-1 accent-cyan-500 cursor-pointer"
                  />
                  <button
                    onClick={() => executePhysicalMove('scissors')}
                    className="px-2.5 py-1 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/40 rounded text-[10px] font-mono font-bold"
                  >
                    Test
                  </button>
                </div>
              </div>

              {/* Paper Pose */}
              <div className="bg-[#181f33] p-3 rounded-lg border border-[#27324c] flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <span>📄</span> PAPER Pose:
                  </span>
                  <span className="font-mono text-emerald-300 font-bold">{gestureAngles.paper}°</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="180"
                    value={gestureAngles.paper}
                    onChange={(e) =>
                      setGestureAngles({ ...gestureAngles, paper: parseInt(e.target.value, 10) })
                    }
                    className="flex-1 accent-emerald-500 cursor-pointer"
                  />
                  <button
                    onClick={() => executePhysicalMove('paper')}
                    className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 rounded text-[10px] font-mono font-bold"
                  >
                    Test
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Auto Tournament Mode Toggle */}
          <div className="bg-[#111625] border border-[#27324c] rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>Auto Tournament Mode</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Robot automatically plays continuous rounds against computer AI
              </p>
            </div>
            <button
              onClick={() => setIsAutoTournament(!isAutoTournament)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                isAutoTournament
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-950 animate-pulse'
                  : 'bg-[#181f33] text-slate-400 border border-[#27324c] hover:text-white'
              }`}
            >
              {isAutoTournament ? 'Auto Active' : 'Start Auto'}
            </button>
          </div>
        </div>

        {/* Center & Right Column: Interactive Battle Arena & Results */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Telemetry Score Banner */}
          <div className="bg-[#111625] border border-[#27324c] rounded-xl p-5 flex items-center justify-between shadow-2xl relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-transparent to-cyan-500/10 pointer-events-none" />

            {/* Human Score */}
            <div className="flex flex-col items-center gap-1 z-10">
              <span className="text-xs font-mono text-purple-400 font-bold uppercase tracking-wider">
                YOU (HUMAN)
              </span>
              <span className="text-4xl font-extrabold text-white font-mono">{humanScore}</span>
              <span className="text-[10px] text-slate-500 font-mono">PLAYER WINS</span>
            </div>

            {/* VS Divider & Streak Badge */}
            <div className="flex flex-col items-center gap-1 z-10">
              <div className="w-12 h-12 rounded-full bg-[#181f33] border border-[#27324c] flex items-center justify-center font-black text-sm text-cyan-400 font-mono shadow-inner">
                VS
              </div>
              {streak > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-amber-400 font-mono font-bold bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded-full animate-bounce">
                  <Flame className="w-3 h-3 text-amber-400" />
                  <span>{streak} WIN STREAK</span>
                </span>
              )}
            </div>

            {/* Robot Score */}
            <div className="flex flex-col items-center gap-1 z-10">
              <span className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-wider">
                ARDUINO ROBOT
              </span>
              <span className="text-4xl font-extrabold text-white font-mono">{botScore}</span>
              <span className="text-[10px] text-slate-500 font-mono">BOT WINS</span>
            </div>
          </div>

          {/* Main Battle Viewport / Stage */}
          <div className="bg-[#111625] border border-[#27324c] rounded-xl p-8 flex flex-col items-center justify-center gap-6 min-h-[280px] relative shadow-2xl">
            {isCountdown ? (
              /* Countdown Animation */
              <div className="flex flex-col items-center gap-3 my-auto animate-pulse">
                <span className="text-6xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-cyan-300 to-emerald-400">
                  {countdownStep === 0 ? 'SHOOT!' : countdownStep}
                </span>
                <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">
                  {countdownStep === 0 ? 'PHYSICAL SERVO SNAP!' : 'ROBOT PUMPING SERVO...'}
                </span>
              </div>
            ) : humanMove && botMove ? (
              /* Match Result Stage */
              <div className="flex flex-col items-center gap-4 w-full">
                <div className="flex items-center justify-around w-full max-w-md">
                  {/* Human Choice */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-20 h-20 rounded-2xl bg-purple-950/80 border border-purple-500/50 flex items-center justify-center text-4xl shadow-xl shadow-purple-950">
                      {moveEmoji(humanMove)}
                    </div>
                    <span className="text-xs font-mono text-purple-300 font-bold">
                      {moveName(humanMove)}
                    </span>
                  </div>

                  <span className="text-lg font-bold text-slate-600 font-mono">⚡</span>

                  {/* Robot Choice */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-20 h-20 rounded-2xl bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-4xl shadow-xl shadow-cyan-950">
                      {moveEmoji(botMove)}
                    </div>
                    <span className="text-xs font-mono text-cyan-300 font-bold">
                      {moveName(botMove)}
                    </span>
                  </div>
                </div>

                {/* Outcome Result Banner */}
                <div className="mt-2 text-center">
                  {result === 'win' && (
                    <div className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-950/90 border border-emerald-500/60 text-emerald-300 text-sm font-black tracking-wide shadow-lg shadow-emerald-950 animate-bounce">
                      <Trophy className="w-5 h-5 text-emerald-400" />
                      <span>YOU WIN THIS ROUND!</span>
                    </div>
                  )}
                  {result === 'loss' && (
                    <div className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-rose-950/90 border border-rose-500/60 text-rose-300 text-sm font-black tracking-wide shadow-lg shadow-rose-950">
                      <Award className="w-5 h-5 text-rose-400" />
                      <span>ROBOT VICTORY!</span>
                    </div>
                  )}
                  {result === 'tie' && (
                    <div className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-950/90 border border-amber-500/60 text-amber-300 text-sm font-black tracking-wide shadow-lg shadow-amber-950">
                      <Sparkles className="w-5 h-5 text-amber-400" />
                      <span>IT&apos;S A TIE! BOTH CHOSE {moveName(humanMove)}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Idle Prompt */
              <div className="flex flex-col items-center gap-2 text-center text-slate-400 my-auto">
                <Gamepad2 className="w-12 h-12 text-slate-600 mb-1" />
                <div className="text-sm font-bold text-white">Choose your move below to start the showdown!</div>
                <div className="text-xs text-slate-500">
                  The robot will pump its physical servo pin 3 times before revealing its move.
                </div>
              </div>
            )}
          </div>

          {/* Gesture Choice Controls */}
          <div className={`bg-[#111625] border ${isKidMode ? 'border-amber-400/50 shadow-amber-500/10' : 'border-[#27324c]'} rounded-2xl p-5 flex flex-col gap-3 shadow-xl`}>
            <div className={`text-xs font-bold text-center ${isKidMode ? 'text-amber-300 font-sans tracking-wide text-sm' : 'font-mono text-slate-400 uppercase'}`}>
              {isKidMode ? '👇 TAP YOUR MOVE TO PLAY WITH THE ROBOT!' : 'SELECT YOUR MOVE (HUMAN PLAYER):'}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={() => handlePlayRound('rock')}
                disabled={isCountdown}
                className={`${isKidMode ? 'py-6 rounded-2xl border-2 hover:scale-105 active:scale-95 shadow-lg bg-gradient-to-b from-purple-900/40 to-[#181f33] border-purple-400' : 'py-4 rounded-xl border border-[#27324c] hover:border-purple-500/80 bg-[#181f33] hover:bg-purple-950/60'} flex flex-col items-center gap-2 transition-all group disabled:opacity-50`}
              >
                <span className={`${isKidMode ? 'text-5xl animate-bounce' : 'text-3xl group-hover:scale-125'} transition-transform`}>🪨</span>
                <span className={`${isKidMode ? 'text-sm font-black text-purple-200' : 'text-xs font-bold text-white group-hover:text-purple-300'}`}>ROCK</span>
              </button>

              <button
                onClick={() => handlePlayRound('paper')}
                disabled={isCountdown}
                className={`${isKidMode ? 'py-6 rounded-2xl border-2 hover:scale-105 active:scale-95 shadow-lg bg-gradient-to-b from-emerald-900/40 to-[#181f33] border-emerald-400' : 'py-4 rounded-xl border border-[#27324c] hover:border-emerald-500/80 bg-[#181f33] hover:bg-emerald-950/60'} flex flex-col items-center gap-2 transition-all group disabled:opacity-50`}
              >
                <span className={`${isKidMode ? 'text-5xl animate-bounce' : 'text-3xl group-hover:scale-125'} transition-transform`}>📄</span>
                <span className={`${isKidMode ? 'text-sm font-black text-emerald-200' : 'text-xs font-bold text-white group-hover:text-emerald-300'}`}>PAPER</span>
              </button>

              <button
                onClick={() => handlePlayRound('scissors')}
                disabled={isCountdown}
                className={`${isKidMode ? 'py-6 rounded-2xl border-2 hover:scale-105 active:scale-95 shadow-lg bg-gradient-to-b from-cyan-900/40 to-[#181f33] border-cyan-400' : 'py-4 rounded-xl border border-[#27324c] hover:border-cyan-500/80 bg-[#181f33] hover:bg-cyan-950/60'} flex flex-col items-center gap-2 transition-all group disabled:opacity-50`}
              >
                <span className={`${isKidMode ? 'text-5xl animate-bounce' : 'text-3xl group-hover:scale-125'} transition-transform`}>✂️</span>
                <span className={`${isKidMode ? 'text-sm font-black text-cyan-200' : 'text-xs font-bold text-white group-hover:text-cyan-300'}`}>SCISSORS</span>
              </button>
            </div>
          </div>

          {/* Round History Log */}
          {roundHistory.length > 0 && (
            <div className="bg-[#111625] border border-[#27324c] rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span>RECENT MATCH HISTORY LOG</span>
                <span>{roundHistory.length} ROUNDS PLAYED</span>
              </div>
              <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                {roundHistory.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between p-2 rounded bg-[#181f33] border border-[#27324c] text-xs font-mono"
                  >
                    <div className="flex items-center gap-2">
                      <span>{moveEmoji(h.human)} Human</span>
                      <span className="text-slate-500">vs</span>
                      <span>{moveEmoji(h.bot)} Bot</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`font-bold ${
                          h.result === 'win'
                            ? 'text-emerald-400'
                            : h.result === 'loss'
                            ? 'text-rose-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {h.result === 'win' ? 'HUMAN WIN' : h.result === 'loss' ? 'BOT WIN' : 'TIE'}
                      </span>
                      <span className="text-[10px] text-slate-500">{h.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Firmware Code Exporter */}
          <div className="bg-[#111625] border border-[#27324c] rounded-xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold text-white uppercase">
                  Standalone Arduino Firmware Generator
                </h3>
              </div>
              <button
                onClick={handleCopyCode}
                className="px-3 py-1 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/40 rounded text-xs font-semibold flex items-center gap-1.5"
              >
                {copiedCode ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copied Code!' : 'Copy Sketch'}</span>
              </button>
            </div>
            <pre className="bg-[#0c0f17] border border-[#27324c] rounded-lg p-3 text-[11px] font-mono text-cyan-300/90 overflow-x-auto max-h-40">
              {generatedArduinoCode}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
