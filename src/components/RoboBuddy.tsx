import React, { useState } from 'react';
import { Sparkles, Trophy, HelpCircle, Heart, Star, CheckCircle, Smile, Volume2 } from 'lucide-react';

import { AppMode } from '../types';

interface RoboBuddyProps {
  currentTab: string;
  isKidMode: boolean;
  isExpertMode?: boolean;
  appMode?: AppMode;
  onToggleKidMode: () => void;
  onSetAppMode?: (mode: AppMode) => void;
}

export const RoboBuddy: React.FC<RoboBuddyProps> = ({
  currentTab,
  isKidMode,
  isExpertMode = false,
  appMode = 'standard',
  onToggleKidMode,
  onSetAppMode,
}) => {
  const [isBubbleOpen, setIsBubbleOpen] = useState(true);

  // Friendly Kid-Friendly Tips for every single tab in the app!
  const kidTips: Record<string, { title: string; tip: string; emoji: string }> = {
    dashboard: {
      title: 'Welcome to Robot Central! 🚀',
      tip: 'This is your main command base! Check your Arduino board connection and test your digital pins and servos!',
      emoji: '🤖',
    },
    connection: {
      title: 'Connect Your Arduino! 🔌',
      tip: 'Plug in your Arduino board using USB, select your COM port, or switch to Virtual Board mode to test right away!',
      emoji: '⚡',
    },
    pins: {
      title: 'Digital & Analog Pin Magic! 🎛️',
      tip: 'Click ON/OFF buttons to light up LEDs, or tap the 🧪 Test & Calibrate All Pins button to run an automatic checkup on every single pin!',
      emoji: '💡',
    },
    servos: {
      title: 'Servo Motor Steering! 🦾',
      tip: 'Move the sliders to turn your servos! Tap the 🐢 Slow to 90° button to smoothly and gently center all your robot joints!',
      emoji: '⚙️',
    },
    builder: {
      title: '3D Robot Creator Studio! 🎨',
      tip: 'Drag blocks, cylinders, wheels, and arms in 3D space to construct your custom robot body!',
      emoji: '🧱',
    },
    simulator: {
      title: 'Live 3D Hardware Simulator! 🎮',
      tip: 'Press Play to see your 3D robot move on screen and trigger real servos connected to your board!',
      emoji: '🕹️',
    },
    movement: {
      title: 'Robot Dance & Movement Sequencer! 🕺',
      tip: 'Record keyframe poses step by step to create your robot dance routines!',
      emoji: '🎬',
    },
    electronics: {
      title: 'Circuits & Sensor Playground! ⚡',
      tip: 'Wire up LEDs, ultrasonic distance sensors, and light sensors to see live physics graphs!',
      emoji: '🔬',
    },
    code: {
      title: 'Arduino C++ Code Studio! 💻',
      tip: 'Compile real C++ code for your Arduino UNO, Nano, or Mega with one click!',
      emoji: '📜',
    },
    ai: {
      title: 'Robo-AI Smart Assistant! ✨',
      tip: 'Ask AI any question or describe a robot to build automatic parts and C++ sketches!',
      emoji: '🔮',
    },
    projects: {
      title: 'Robot Projects Gallery! 📁',
      tip: 'Save your creations, switch between Biped Walkers and Robotic Arms, or export files!',
      emoji: '🏆',
    },
    spotify: {
      title: 'Spotify Dance Party! 🎧',
      tip: 'Play your favorite music and watch your robot bounce and dance in sync with the beat!',
      emoji: '🎶',
    },
    rps: {
      title: 'Rock Paper Scissors Game! ✊',
      tip: 'Challenge your robot to Rock Paper Scissors! It will countdown 3-2-1 and make gesture poses!',
      emoji: '👾',
    },
    block_coding: {
      title: 'Scratch Visual Block Coding! 🧩',
      tip: 'Drag colorful Scratch coding blocks together to program your robot without typing code!',
      emoji: '🧱',
    },
    buzzer: {
      title: '100-Song Piezo Music Studio! 🎵',
      tip: 'Play piano keys, pick from 100 famous retro songs, and listen to tunes on your buzzer!',
      emoji: '🎹',
    },
    settings: {
      title: 'App Customizer & Config! ⚙️',
      tip: 'Tune serial baud rates, toggle sound synthesizers, and customize your workshop themes!',
      emoji: '🛠️',
    },
  };

  const expertTips: Record<string, { title: string; tip: string; emoji: string }> = {
    dashboard: {
      title: 'Expert MCU Diagnostics ⚡',
      tip: 'ATmega328P 16MHz clock active. Serial throughput and 10-bit analog conversion telemetry monitored live.',
      emoji: '⚡',
    },
    pins: {
      title: 'AVR Register Bitmask Direct Control 💻',
      tip: 'Manipulate DDRB/PORTB, DDRD/PORTD, and DDRC/PORTC bit registers directly with atomic single-cycle writes.',
      emoji: '🔬',
    },
    servos: {
      title: 'Sub-Degree Microsecond Timing 🦾',
      tip: 'Hardware Timer 1 configured at 50Hz (20ms frame). Pulse widths mapped in 0.5µs increments for precision kinematics.',
      emoji: '⏱️',
    },
  };

  const currentTip = isExpertMode
    ? expertTips[currentTab] || {
        title: 'Expert Embedded Mode ⚡',
        tip: 'Low-level AVR register manipulation, microsecond pulse widths, and raw serial hex telemetry are unlocked.',
        emoji: '⚡',
      }
    : kidTips[currentTab] || {
        title: 'Hello Maker! 🌟',
        tip: 'Explore all 16 fun STEM robotics modules using the sidebar on the left!',
        emoji: '🤖',
      };

  const speakTip = (text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.2;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-end gap-3 select-none pointer-events-auto">
      {/* Speech Bubble Card */}
      {isBubbleOpen && (
        <div
          className={`border-2 rounded-2xl p-4 shadow-2xl max-w-sm flex flex-col gap-2 text-slate-100 animate-in fade-in slide-in-from-bottom-3 duration-200 ${
            isExpertMode
              ? 'bg-[#0a0f1d] border-emerald-500/80 shadow-emerald-950/80'
              : 'bg-[#111625] border-amber-500/80 shadow-amber-950/80'
          }`}
        >
          <div className="flex items-center justify-between border-b border-[#27324c] pb-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{currentTip.emoji}</span>
              <span
                className={`font-bold text-xs uppercase tracking-wide ${
                  isExpertMode ? 'text-emerald-400 font-mono' : 'text-amber-300'
                }`}
              >
                {currentTip.title}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => speakTip(currentTip.tip)}
                className={`p-1 rounded-full hover:bg-slate-800 ${
                  isExpertMode ? 'text-emerald-400' : 'text-amber-400'
                }`}
                title="Hear Robo-Buddy speak"
              >
                <Volume2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsBubbleOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold px-1.5 py-0.5 rounded bg-[#181f33]"
              >
                ✕
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-200 leading-relaxed font-sans">{currentTip.tip}</p>

          {/* Mode Switcher inside Bubble */}
          <div className="flex items-center justify-between pt-1 text-[10px] font-mono border-t border-[#27324c]/60">
            {onSetAppMode ? (
              <div className="flex items-center gap-1 bg-[#181f33] p-0.5 rounded-lg border border-[#27324c]">
                <button
                  onClick={() => onSetAppMode('kid')}
                  className={`px-1.5 py-0.5 rounded ${
                    isKidMode ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  🎈 Kid
                </button>
                <button
                  onClick={() => onSetAppMode('standard')}
                  className={`px-1.5 py-0.5 rounded ${
                    !isKidMode && !isExpertMode
                      ? 'bg-cyan-600 text-white font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ⚙️ Standard
                </button>
                <button
                  onClick={() => onSetAppMode('expert')}
                  className={`px-1.5 py-0.5 rounded ${
                    isExpertMode
                      ? 'bg-emerald-500 text-slate-950 font-extrabold'
                      : 'text-slate-400 hover:text-emerald-300'
                  }`}
                >
                  ⚡ Expert
                </button>
              </div>
            ) : (
              <button
                onClick={onToggleKidMode}
                className="px-2 py-0.5 rounded bg-[#181f33] text-amber-300 border border-amber-800"
              >
                Toggle Mode
              </button>
            )}

            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <Trophy className="w-3 h-3 text-amber-400" /> Maker Level 10
            </span>
          </div>
        </div>
      )}

      {/* Mascot Avatar Button */}
      <button
        onClick={() => setIsBubbleOpen(!isBubbleOpen)}
        className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-cyan-500 p-0.5 shadow-2xl shadow-amber-500/50 hover:scale-110 transition-transform flex items-center justify-center cursor-pointer group"
        title="Click for Robo-Buddy Tips & Kid Mode"
      >
        <div className="w-full h-full bg-[#0c0f17] rounded-full flex items-center justify-center text-2xl group-hover:rotate-12 transition-transform">
          🤖
        </div>
      </button>
    </div>
  );
};
