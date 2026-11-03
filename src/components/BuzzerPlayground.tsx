import React, { useState, useEffect, useRef } from 'react';
import { RobotProject } from '../types';
import { arduinoSerial } from '../services/arduinoSerial';
import { SONG_LIBRARY_100, SongEntry } from '../services/songLibrary';
import {
  Volume2,
  VolumeX,
  Play,
  Square,
  RotateCcw,
  Music,
  Zap,
  Code,
  CheckCircle2,
  Copy,
  Plus,
  Trash2,
  Sparkles,
  Radio,
  Cpu,
  Layers,
  ListMusic,
  Flame,
  Sliders,
  Activity,
  Wand2,
  Download,
  Search,
  HelpCircle,
} from 'lucide-react';
import { downloadFile } from '../utils/meshFormatUtils';
import { GuidedTour, TourStep } from './GuidedTour'; // Added


export interface NoteDefinition {
  name: string;
  freq: number;
  isSharp?: boolean;
  keyboardKey?: string;
}

export const PIANO_NOTES: NoteDefinition[] = [
  { name: 'C4', freq: 262, keyboardKey: 'A' },
  { name: 'C#4', freq: 277, isSharp: true, keyboardKey: 'W' },
  { name: 'D4', freq: 294, keyboardKey: 'S' },
  { name: 'D#4', freq: 311, isSharp: true, keyboardKey: 'E' },
  { name: 'E4', freq: 330, keyboardKey: 'D' },
  { name: 'F4', freq: 349, keyboardKey: 'F' },
  { name: 'F#4', freq: 370, isSharp: true, keyboardKey: 'T' },
  { name: 'G4', freq: 392, keyboardKey: 'G' },
  { name: 'G#4', freq: 415, isSharp: true, keyboardKey: 'Y' },
  { name: 'A4', freq: 440, keyboardKey: 'H' },
  { name: 'A#4', freq: 466, isSharp: true, keyboardKey: 'U' },
  { name: 'B4', freq: 494, keyboardKey: 'J' },
  { name: 'C5', freq: 523, keyboardKey: 'K' },
  { name: 'C#5', freq: 554, isSharp: true, keyboardKey: 'O' },
  { name: 'D5', freq: 587, keyboardKey: 'L' },
  { name: 'D#5', freq: 622, isSharp: true, keyboardKey: 'P' },
  { name: 'E5', freq: 659, keyboardKey: ';' },
  { name: 'F5', freq: 698 },
  { name: 'F#5', freq: 740, isSharp: true },
  { name: 'G5', freq: 784 },
  { name: 'G#5', freq: 830, isSharp: true },
  { name: 'A5', freq: 880 },
];

export interface MelodyNote {
  id: string;
  note: string;
  freq: number;
  durationMs: number;
}

interface BuzzerPlaygroundProps {
  project: RobotProject;
  isKidMode?: boolean;
}

export const BuzzerPlayground: React.FC<BuzzerPlaygroundProps> = ({ project, isKidMode = false }) => {
  // Pin Configuration & General Settings
  const [buzzerPin, setBuzzerPin] = useState<number>(11);
  const [buzzerType, setBuzzerType] = useState<'passive' | 'active'>('passive');
  const [volumeEnabled, setVolumeEnabled] = useState<boolean>(true);
  const [waveForm, setWaveForm] = useState<OscillatorType>('square');
  const [bpmTempo, setBpmTempo] = useState<number>(120);

  // Frequency Synthesizer Slider
  const [customFreq, setCustomFreq] = useState<number>(440);

  // Active playing note & melody state
  const [activeFreq, setActiveFreq] = useState<number | null>(null);
  const [isPlayingMelody, setIsPlayingMelody] = useState<boolean>(false);
  const [currentMelodyNoteIdx, setCurrentMelodyNoteIdx] = useState<number | null>(null);

  // 100 Song Library Filter State
  const [songCategory, setSongCategory] = useState<string>('All');
  const [songSearchTerm, setSongSearchTerm] = useState<string>('');

  // Canvas Oscilloscope Reference
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Custom Melody Score
  const [customSequence, setCustomSequence] = useState<MelodyNote[]>([
    { id: 'm1', note: 'E5', freq: 659, durationMs: 150 },
    { id: 'm2', note: 'E5', freq: 659, durationMs: 150 },
    { id: 'm3', note: 'REST', freq: 0, durationMs: 100 },
    { id: 'm4', note: 'E5', freq: 659, durationMs: 150 },
    { id: 'm5', note: 'REST', freq: 0, durationMs: 100 },
    { id: 'm6', note: 'C5', freq: 523, durationMs: 150 },
    { id: 'm7', note: 'E5', freq: 659, durationMs: 250 },
    { id: 'm8', note: 'G5', freq: 784, durationMs: 300 },
  ]);

  const melodyPlaybackRef = useRef<boolean>(false);
  const [showTour, setShowTour] = useState(false);

  const tourSteps: TourStep[] = [
    { targetSelector: '.piano-keys', title: 'Piano Synth', content: 'Click keys or use keyboard to play notes!' },
    { targetSelector: '.waveform-selector', title: 'Waveforms', content: 'Choose different sounds for your buzzer!' },
    { targetSelector: '.song-library', title: 'Song Jukebox', content: 'Load and play from 100+ songs!' },
  ];

  // Canvas Audio Oscilloscope Waveform Animation Loop
  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;

    const render = () => {
      ctx.fillStyle = '#090c12';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#27324c';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      if (activeFreq && activeFreq > 0) {
        ctx.strokeStyle = '#f59e0b'; // Amber pulse
        ctx.lineWidth = 2.5;
        ctx.beginPath();

        const wavelength = Math.max(10, (1000 / activeFreq) * 15);

        for (let x = 0; x < canvas.width; x++) {
          let y = canvas.height / 2;
          const progress = (x + phase) / wavelength;

          if (waveForm === 'square') {
            y += Math.sin(progress * Math.PI * 2) >= 0 ? -18 : 18;
          } else if (waveForm === 'sawtooth') {
            y += ((progress % 1) - 0.5) * 36;
          } else if (waveForm === 'triangle') {
            y += Math.abs((progress % 1) - 0.5) * 72 - 18;
          } else {
            y += Math.sin(progress * Math.PI * 2) * 20;
          }

          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        ctx.stroke();
        phase += 4;
      } else {
        // Idle flat line with slight glow
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [activeFreq, waveForm]);

  // Web Audio Synth Synthesizer
  const playWebAudioTone = (freq: number, durationMs = 200) => {
    if (!volumeEnabled || freq <= 0) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = waveForm;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + durationMs / 1000);
    } catch {
      // Audio fallback
    }
  };

  // Play Note Action (In-browser sound + USB Serial Hardware pulse to Buzzer)
  const handlePlayNote = async (freq: number, durationMs = 200) => {
    const scaledDuration = Math.round(durationMs * (120 / bpmTempo));
    setActiveFreq(freq);
    playWebAudioTone(freq, scaledDuration);

    if (arduinoSerial.status === 'connected') {
      if (buzzerType === 'passive') {
        await arduinoSerial.sendTone(buzzerPin, freq, scaledDuration);
      } else {
        await arduinoSerial.setDigitalPin(buzzerPin, 1);
        setTimeout(() => arduinoSerial.setDigitalPin(buzzerPin, 0), scaledDuration);
      }
    }

    setTimeout(() => {
      setActiveFreq((prev) => (prev === freq ? null : prev));
    }, scaledDuration);
  };

  // Add Note to Custom Sequence
  const handleAddNoteToSequence = (noteName: string, freq: number) => {
    const newNote: MelodyNote = {
      id: `n_${Math.random().toString(36).substring(2, 9)}`,
      note: noteName,
      freq,
      durationMs: 200,
    };
    setCustomSequence((prev) => [...prev, newNote]);
    handlePlayNote(freq, 200);
  };

  // Load Any Song from the 100-Song Library
  const handleLoadLibrarySong = (song: SongEntry) => {
    const newScore: MelodyNote[] = song.notes.map((n, idx) => ({
      id: `s_${song.id}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      note: n.note,
      freq: n.freq,
      durationMs: n.durationMs,
    }));
    setCustomSequence(newScore);
  };

  // Play Sequence Routine
  const handlePlaySequence = async () => {
    if (isPlayingMelody) {
      melodyPlaybackRef.current = false;
      setIsPlayingMelody(false);
      setCurrentMelodyNoteIdx(null);
      return;
    }

    setIsPlayingMelody(true);
    melodyPlaybackRef.current = true;

    for (let i = 0; i < customSequence.length; i++) {
      if (!melodyPlaybackRef.current) break;

      const item = customSequence[i];
      setCurrentMelodyNoteIdx(i);

      if (item.freq > 0) {
        await handlePlayNote(item.freq, item.durationMs);
      }

      const scaledDelay = Math.round((item.durationMs + 30) * (120 / bpmTempo));
      await new Promise((res) => setTimeout(res, scaledDelay));
    }

    setIsPlayingMelody(false);
    setCurrentMelodyNoteIdx(null);
  };

  // Robot SFX Generator
  const playSfx = async (
    sfxType:
      | 'siren'
      | 'laser'
      | 'success'
      | 'error'
      | 'powerup'
      | 'gameover'
      | 'chatter'
      | 'coin'
      | 'chirp'
  ) => {
    if (sfxType === 'siren') {
      for (let i = 0; i < 4; i++) {
        await handlePlayNote(600, 100);
        await handlePlayNote(1000, 100);
      }
    } else if (sfxType === 'laser') {
      for (let f = 1200; f >= 300; f -= 100) {
        await handlePlayNote(f, 25);
      }
    } else if (sfxType === 'success') {
      await handlePlayNote(523, 100); // C5
      await handlePlayNote(659, 100); // E5
      await handlePlayNote(784, 250); // G5
    } else if (sfxType === 'error') {
      await handlePlayNote(300, 150);
      await handlePlayNote(200, 250);
    } else if (sfxType === 'powerup') {
      for (let f = 300; f <= 900; f += 80) {
        await handlePlayNote(f, 30);
      }
    } else if (sfxType === 'gameover') {
      await handlePlayNote(440, 150);
      await handlePlayNote(415, 150);
      await handlePlayNote(392, 150);
      await handlePlayNote(349, 350);
    } else if (sfxType === 'chatter') {
      for (let i = 0; i < 6; i++) {
        const randomPitch = Math.floor(Math.random() * 600) + 400;
        await handlePlayNote(randomPitch, 50);
      }
    } else if (sfxType === 'coin') {
      await handlePlayNote(988, 80); // B5
      await handlePlayNote(1318, 250); // E6
    } else if (sfxType === 'chirp') {
      await handlePlayNote(1500, 40);
      await handlePlayNote(2000, 60);
    }
  };

  // Filter 100 Songs
  const filteredSongs = SONG_LIBRARY_100.filter((song) => {
    const matchesCategory = songCategory === 'All' || song.category === songCategory;
    const matchesSearch =
      songSearchTerm.trim() === '' ||
      song.title.toLowerCase().includes(songSearchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Keyboard shortcut listener for piano keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const keyUpper = e.key.toUpperCase();
      const match = PIANO_NOTES.find((n) => n.keyboardKey === keyUpper);
      if (match) {
        handlePlayNote(match.freq, 200);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [buzzerPin, volumeEnabled, bpmTempo, waveForm]);

  // Generate Standalone Arduino C++ Code with pitches.h constants
  const generatedArduinoCode = `/*
  ARDUINO CONTROL STUDIO – PIEZO BUZZER MUSIC FIRMWARE
  Project: ${project.name}
  Buzzer Pin: Digital Pin ${buzzerPin}
*/

#define BUZZER_PIN ${buzzerPin}

// Musical Note Frequencies (Hz)
#define NOTE_C4  262
#define NOTE_CS4 277
#define NOTE_D4  294
#define NOTE_DS4 311
#define NOTE_E4  330
#define NOTE_F4  349
#define NOTE_FS4 370
#define NOTE_G4  392
#define NOTE_GS4 415
#define NOTE_A4  440
#define NOTE_AS4 466
#define NOTE_B4  494
#define NOTE_C5  523
#define NOTE_CS5 554
#define NOTE_D5  587
#define NOTE_DS5 622
#define NOTE_E5  659
#define NOTE_F5  698
#define NOTE_FS5 740
#define NOTE_G5  784
#define NOTE_GS5 830
#define NOTE_A5  880

// Melody Notes Sequence
int melody[] = {
${customSequence.map((n) => `  ${n.freq > 0 ? `NOTE_${n.note.replace('#', 'S')}` : '0'}`).join(',\n')}
};

// Note Durations (ms)
int noteDurations[] = {
${customSequence.map((n) => `  ${n.durationMs}`).join(',\n')}
};

void setup() {
  pinMode(BUZZER_PIN, OUTPUT);
  playMelody();
}

void loop() {
  // Idle loop or repeat melody
}

void playMelody() {
  int totalNotes = sizeof(melody) / sizeof(melody[0]);
  for (int thisNote = 0; thisNote < totalNotes; thisNote++) {
    int duration = noteDurations[thisNote];
    if (melody[thisNote] > 0) {
      tone(BUZZER_PIN, melody[thisNote], duration);
    }
    delay(duration * 1.30);
    noTone(BUZZER_PIN);
  }
}
`;

  const [copiedCode, setCopiedCode] = useState(false);
  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedArduinoCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#0c0f17] text-slate-100 flex flex-col gap-6 font-sans select-none">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#27324c]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowTour(true)}
            className="p-2 bg-[#181f33] hover:bg-[#202945] text-cyan-400 border border-[#27324c] rounded-lg"
            title="Take a Tour"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center shadow-lg shadow-amber-950">
            <Volume2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-wide">
                ARDUINO PIEZO BUZZER & MUSIC STUDIO
              </h1>
              <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 font-mono text-[10px] border border-amber-800 font-bold">
                100 SONG JUKEBOX v2.4
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Compose 8-bit melodies, explore 100 famous songs & game themes, play interactive piano synths, view live oscilloscope waveforms, and export Arduino C++ tone() code.
            </p>
          </div>
        </div>

        {/* Pin Configuration & Sound Controls Bar */}
        <div className="flex flex-wrap items-center gap-3 bg-[#111625] p-2 rounded-xl border border-[#27324c]">
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <Cpu className="w-4 h-4 text-amber-400" />
            <span className="text-slate-400">Buzzer Pin:</span>
            <select
              value={buzzerPin}
              onChange={(e) => setBuzzerPin(parseInt(e.target.value, 10))}
              className="bg-[#181f33] text-amber-300 font-bold border border-[#27324c] rounded px-2 py-1 outline-none"
            >
              {[3, 5, 6, 8, 9, 10, 11, 12, 13].map((pin) => (
                <option key={pin} value={pin}>
                  D{pin} (PWM)
                </option>
              ))}
            </select>
          </div>

          <div className="h-4 w-[1px] bg-[#27324c]" />

          {/* Waveform Selector */}
          <div className="flex items-center gap-1.5 text-xs font-mono waveform-selector">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-400">Wave:</span>
            <select
              value={waveForm}
              onChange={(e) => setWaveForm(e.target.value as OscillatorType)}
              className="bg-[#181f33] text-cyan-300 font-bold border border-[#27324c] rounded px-2 py-1 outline-none"
            >
              <option value="square">Square 🔲 (Piezo)</option>
              <option value="sine">Sine 🌊 (Pure)</option>
              <option value="triangle">Triangle 🔺 (Soft)</option>
              <option value="sawtooth">Sawtooth 🪚 (Biting)</option>
            </select>
          </div>

          <div className="h-4 w-[1px] bg-[#27324c]" />

          {/* Sound Mute Toggle */}
          <button
            onClick={() => setVolumeEnabled(!volumeEnabled)}
            className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              volumeEnabled
                ? 'bg-amber-950/60 text-amber-300 border-amber-800'
                : 'bg-[#181f33] text-slate-500 border-[#27324c]'
            }`}
            title="Toggle Web Audio Synthesizer"
          >
            {volumeEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{volumeEnabled ? 'Synth On' : 'Muted'}</span>
          </button>
        </div>
      </div>

      {/* Main Piano Synthesizer & Visualizer Oscilloscope Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive Piano Synthesizer Keyboard Roll (2 Columns) */}
        <div className="lg:col-span-2 bg-[#111625] border border-[#27324c] rounded-xl p-5 flex flex-col gap-4 shadow-xl">
          <div className="flex items-center justify-between pb-2 border-b border-[#27324c]/60">
            <div className="flex items-center gap-2">
              <Music className="w-4 h-4 text-amber-400" />
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                Interactive Piano Synthesizer (Click or Use Computer Keyboard Keys)
              </h2>
            </div>
            {activeFreq && (
              <span className="text-xs font-mono text-amber-300 bg-amber-950 px-2.5 py-0.5 rounded border border-amber-800 font-bold animate-pulse">
                Playing: {activeFreq} Hz
              </span>
            )}
          </div>

          {/* Piano Keys Roll */}
          <div className={`relative flex items-start justify-center ${isKidMode ? 'h-56' : 'h-36'} bg-[#0c0f17] p-3 rounded-xl border border-[#27324c] overflow-x-auto piano-keys`}>
            {PIANO_NOTES.map((note) => {
              const isActive = activeFreq === note.freq;

              if (note.isSharp) {
                return (
                  <button
                    key={note.name}
                    onClick={() => {
                      handlePlayNote(note.freq);
                      handleAddNoteToSequence(note.name, note.freq);
                    }}
                    className={`${isKidMode ? 'w-16 h-32' : 'w-8 h-20'} -mx-4 z-10 rounded-b-md font-mono text-xs font-bold flex flex-col justify-end p-2 transition-all shadow-lg ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 scale-95 shadow-amber-500/50'
                        : 'bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-700'
                    }`}
                    title={`${note.name} (${note.freq}Hz)`}
                  >
                    <span className="truncate">{note.name}</span>
                  </button>
                );
              }

              return (
                <button
                  key={note.name}
                  onClick={() => {
                    handlePlayNote(note.freq);
                    handleAddNoteToSequence(note.name, note.freq);
                  }}
                  className={`${isKidMode ? 'w-20 h-48' : 'w-12 h-32'} rounded-b-lg font-mono text-xs font-bold flex flex-col justify-end p-3 transition-all shadow-md mx-1 ${
                    isActive
                      ? 'bg-amber-400 text-slate-950 shadow-amber-400/50 scale-[0.98]'
                      : 'bg-slate-200 hover:bg-white text-slate-900'
                  }`}
                  title={`${note.name} (${note.freq}Hz)`}
                >
                  <span>{note.name}</span>
                </button>
              );
            })}
          </div>


          {/* Custom Frequency Slider Synthesizer Dial */}
          <div className="flex flex-col gap-2 pt-2 border-t border-[#27324c]/50">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-mono flex items-center gap-1.5">
                <Wand2 className="w-3.5 h-3.5 text-cyan-400" />
                Custom Frequency Synthesizer Slider:
              </span>
              <span className="font-mono text-cyan-300 font-bold bg-[#181f33] px-2 py-0.5 rounded border border-[#27324c]">
                {customFreq} Hz
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="100"
                max="3000"
                step="10"
                value={customFreq}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setCustomFreq(val);
                  handlePlayNote(val, 120);
                }}
                className="flex-1 accent-cyan-400 cursor-pointer h-2 bg-[#181f33] rounded-lg border border-[#27324c]"
              />
              <button
                onClick={() => handlePlayNote(customFreq, 300)}
                className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs rounded-lg shadow-md"
              >
                Pulse {customFreq}Hz
              </button>
            </div>
          </div>
        </div>

        {/* Live Audio Oscilloscope Canvas */}
        <div className="bg-[#111625] border border-[#27324c] rounded-xl p-5 flex flex-col gap-3 shadow-xl justify-between">
          <div className="flex items-center justify-between border-b border-[#27324c]/60 pb-2">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                Live Waveform Oscilloscope
              </h2>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800 font-bold">
              REALTIME
            </span>
          </div>

          <div className="flex-1 bg-[#090c12] rounded-xl border border-[#27324c] p-2 flex items-center justify-center overflow-hidden min-h-[160px]">
            <canvas ref={canvasRef} width={280} height={140} className="w-full h-full rounded" />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1">
            <span>Type: {waveForm.toUpperCase()}</span>
            <span>Freq: {activeFreq ? `${activeFreq}Hz` : 'IDLE'}</span>
          </div>
        </div>
      </div>

      {/* 100-SONG JUKEBOX EXPLORER LIBRARY */}
      <div className="bg-[#111625] border border-[#27324c] rounded-xl p-5 flex flex-col gap-4 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#27324c]/60">
          <div className="flex items-center gap-2">
            <ListMusic className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                100-Song Arduino Jukebox Library
                <span className="text-[10px] text-amber-300 font-mono bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
                  {filteredSongs.length} Songs Available
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Click any song to load its full 8-bit score into the melody sequencer and export to Arduino C++
              </p>
            </div>
          </div>

          {/* Search & Category Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5" />
              <input
                type="text"
                placeholder="Search 100 songs..."
                value={songSearchTerm}
                onChange={(e) => setSongSearchTerm(e.target.value)}
                className="bg-[#181f33] text-xs text-white pl-8 pr-3 py-1.5 rounded-lg border border-[#27324c] outline-none focus:border-amber-500 w-44"
              />
            </div>

            <div className="flex items-center gap-1 bg-[#181f33] p-1 rounded-lg border border-[#27324c] text-xs font-mono">
              {['All', 'Game Themes', 'Movie & TV', 'Classical', 'Pop & Memes', 'Folk & Holidays'].map(
                (cat) => (
                  <button
                    key={cat}
                    onClick={() => setSongCategory(cat)}
                    className={`px-2 py-1 rounded transition-colors ${
                      songCategory === cat
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        {/* 100 Song Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-80 overflow-y-auto p-1 song-library">
          {filteredSongs.length === 0 ? (
            <p className="text-xs text-slate-500 italic col-span-full text-center py-6">
              No songs found matching "{songSearchTerm}". Try another search!
            </p>
          ) : (
            filteredSongs.map((song) => (
              <button
                key={song.id}
                onClick={() => {
                  handleLoadLibrarySong(song);
                  handlePlaySequence();
                }}
                className="p-3 bg-[#181f33] hover:bg-[#202945] border border-[#27324c] hover:border-amber-500/60 rounded-xl text-xs font-bold text-slate-200 flex flex-col items-start gap-1.5 transition-all text-left group hover:scale-[1.02]"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xl group-hover:scale-110 transition-transform">{song.icon}</span>
                  <span className="text-[9px] font-mono text-amber-400 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-800/80">
                    {song.notes.length} Notes
                  </span>
                </div>
                <span className="font-bold text-white group-hover:text-amber-300 line-clamp-1">
                  {song.title}
                </span>
                <span className="text-[10px] text-slate-500 font-mono font-normal">
                  {song.category}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Robot Sound Effects (SFX) Row */}
      <div className="bg-[#111625] border border-[#27324c] rounded-xl p-5 flex flex-col gap-4 shadow-xl">
        <div className="flex items-center gap-2 pb-2 border-b border-[#27324c]/60">
          <Zap className="w-4 h-4 text-rose-400" />
          <h2 className="text-xs font-bold text-white uppercase tracking-wider">
            Robot Sound Effects (SFX) & Alarms
          </h2>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
          <button
            onClick={() => playSfx('siren')}
            className="p-2.5 bg-[#181f33] hover:bg-rose-950/60 border border-[#27324c] hover:border-rose-500/60 rounded-xl text-xs font-bold text-slate-200 hover:text-rose-300 flex flex-col items-center gap-1 transition-all"
          >
            <span className="text-lg">🚨</span>
            <span>Police Siren</span>
          </button>

          <button
            onClick={() => playSfx('laser')}
            className="p-2.5 bg-[#181f33] hover:bg-purple-950/60 border border-[#27324c] hover:border-purple-500/60 rounded-xl text-xs font-bold text-slate-200 hover:text-purple-300 flex flex-col items-center gap-1 transition-all"
          >
            <span className="text-lg">👾</span>
            <span>Laser Blast</span>
          </button>

          <button
            onClick={() => playSfx('success')}
            className="p-2.5 bg-[#181f33] hover:bg-emerald-950/60 border border-[#27324c] hover:border-emerald-500/60 rounded-xl text-xs font-bold text-slate-200 hover:text-emerald-300 flex flex-col items-center gap-1 transition-all"
          >
            <span className="text-lg">✅</span>
            <span>Success</span>
          </button>

          <button
            onClick={() => playSfx('error')}
            className="p-2.5 bg-[#181f33] hover:bg-amber-950/60 border border-[#27324c] hover:border-amber-500/60 rounded-xl text-xs font-bold text-slate-200 hover:text-amber-300 flex flex-col items-center gap-1 transition-all"
          >
            <span className="text-lg">❌</span>
            <span>Error Alert</span>
          </button>

          <button
            onClick={() => playSfx('powerup')}
            className="p-2.5 bg-[#181f33] hover:bg-cyan-950/60 border border-[#27324c] hover:border-cyan-500/60 rounded-xl text-xs font-bold text-slate-200 hover:text-cyan-300 flex flex-col items-center gap-1 transition-all"
          >
            <span className="text-lg">⚡</span>
            <span>Power Up</span>
          </button>

          <button
            onClick={() => playSfx('gameover')}
            className="p-2.5 bg-[#181f33] hover:bg-red-950/60 border border-[#27324c] hover:border-red-500/60 rounded-xl text-xs font-bold text-slate-200 hover:text-red-300 flex flex-col items-center gap-1 transition-all"
          >
            <span className="text-lg">💀</span>
            <span>Game Over</span>
          </button>

          <button
            onClick={() => playSfx('chatter')}
            className="p-2.5 bg-[#181f33] hover:bg-amber-950/60 border border-[#27324c] hover:border-amber-500/60 rounded-xl text-xs font-bold text-slate-200 hover:text-amber-300 flex flex-col items-center gap-1 transition-all"
          >
            <span className="text-lg">🤖</span>
            <span>Robot Chat</span>
          </button>

          <button
            onClick={() => playSfx('coin')}
            className="p-2.5 bg-[#181f33] hover:bg-yellow-950/60 border border-[#27324c] hover:border-yellow-500/60 rounded-xl text-xs font-bold text-slate-200 hover:text-yellow-300 flex flex-col items-center gap-1 transition-all"
          >
            <span className="text-lg">🪙</span>
            <span>Coin Pickup</span>
          </button>

          <button
            onClick={() => playSfx('chirp')}
            className="p-2.5 bg-[#181f33] hover:bg-emerald-950/60 border border-[#27324c] hover:border-emerald-500/60 rounded-xl text-xs font-bold text-slate-200 hover:text-emerald-300 flex flex-col items-center gap-1 transition-all"
          >
            <span className="text-lg">🐣</span>
            <span>Chirp Alert</span>
          </button>
        </div>
      </div>

      {/* Custom Melody Sequencer & Score Editor */}
      <div className="bg-[#111625] border border-[#27324c] rounded-xl p-5 flex flex-col gap-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#27324c]/60">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              Custom Melody Sequencer & Musical Score Editor ({customSequence.length} Notes Loaded)
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* BPM Slider */}
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-slate-400">Tempo:</span>
              <input
                type="range"
                min="60"
                max="240"
                value={bpmTempo}
                onChange={(e) => setBpmTempo(parseInt(e.target.value, 10))}
                className="w-24 accent-amber-400 cursor-pointer h-1.5 bg-[#181f33] rounded border border-[#27324c]"
              />
              <span className="text-amber-300 font-bold w-12">{bpmTempo} BPM</span>
            </div>

            <button
              onClick={handlePlaySequence}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md transition-all ${
                isPlayingMelody
                  ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 uppercase tracking-wider'
              }`}
            >
              {isPlayingMelody ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" /> Stop Melody
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" /> Play Melody
                </>
              )}
            </button>

            <button
              onClick={() => setCustomSequence([])}
              className="p-1.5 text-slate-400 hover:text-rose-400 bg-[#181f33] hover:bg-rose-950/40 rounded-lg border border-[#27324c]"
              title="Clear Sequence Score"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Note Sequence Score Grid */}
        <div className="flex items-center gap-2 overflow-x-auto p-3 bg-[#090c12] rounded-xl border border-[#27324c] min-h-[90px]">
          {customSequence.length === 0 ? (
            <p className="text-xs text-slate-500 italic mx-auto">
              No notes in score yet. Select a song from the 100-Song Jukebox or click piano keys above!
            </p>
          ) : (
            customSequence.map((item, idx) => {
              const isPlaying = currentMelodyNoteIdx === idx;
              return (
                <div
                  key={item.id}
                  className={`flex-shrink-0 w-16 p-2 rounded-lg border flex flex-col items-center gap-1 text-xs font-mono transition-all ${
                    isPlaying
                      ? 'bg-amber-500 text-slate-950 font-bold border-amber-300 scale-105 shadow-md shadow-amber-500/40'
                      : 'bg-[#181f33] text-slate-200 border-[#27324c] hover:border-amber-500/50'
                  }`}
                >
                  <span className="font-bold">{item.note}</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {item.freq > 0 ? `${item.freq}Hz` : 'REST'}
                  </span>

                  <button
                    onClick={() => setCustomSequence((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-[9px] text-rose-400 hover:text-rose-300 mt-1"
                    title="Remove Note"
                  >
                    × remove
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Arduino C++ Code Export Box */}
      <div className="bg-[#111625] border border-[#27324c] rounded-xl p-5 flex flex-col gap-3 shadow-xl">
        <div className="flex items-center justify-between pb-2 border-b border-[#27324c]/60">
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4 text-cyan-400" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              Generated Standalone Arduino C++ Melody Code (.ino)
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadFile(generatedArduinoCode, 'BuzzerMelody.ino', 'text/plain')}
              className="px-3 py-1.5 bg-[#181f33] hover:bg-[#202945] text-amber-300 border border-[#27324c] rounded-lg text-xs font-semibold flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Download .ino
            </button>
            <button
              onClick={handleCopyCode}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-cyan-950/50"
            >
              {copiedCode ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCode ? 'Copied Code!' : 'Copy Sketch'}
            </button>
          </div>
        </div>

        <pre className="p-4 bg-[#090c12] border border-[#27324c] rounded-xl text-xs font-mono text-cyan-200 overflow-x-auto max-h-48 leading-relaxed">
          {generatedArduinoCode}
        </pre>
      </div>
      {showTour && <GuidedTour steps={tourSteps} onFinish={() => setShowTour(false)} />}
    </div>
  );
};
