import React, { useState, useEffect, useRef } from 'react';
import { RobotProject, ServoMotor } from '../types';
import { arduinoSerial } from '../services/arduinoSerial';
import {
  Blocks,
  Play,
  Square,
  RotateCcw,
  Copy,
  CheckCircle2,
  Code,
  Download,
  Plus,
  Trash2,
  Sparkles,
  Zap,
  Cpu,
  Radio,
  ArrowUp,
  ArrowDown,
  Layers,
  FileCode,
  BookmarkPlus,
} from 'lucide-react';

export type BlockCategory = 'control' | 'pin' | 'servo' | 'sensor' | 'serial';

export interface BlockTemplate {
  type: string;
  category: BlockCategory;
  title: string;
  defaultPin?: number;
  defaultValue?: number | string;
  defaultVal2?: number;
  color: string;
  borderColor: string;
}

export interface ActiveBlock {
  id: string;
  type: string;
  category: BlockCategory;
  title: string;
  pin: number;
  value: number | string;
  val2: number;
  color: string;
  borderColor: string;
}

interface BlockCodingStudioProps {
  project: RobotProject;
  servos: ServoMotor[];
  onUpdateServo: (servo: ServoMotor) => void;
}

export const BlockCodingStudio: React.FC<BlockCodingStudioProps> = ({
  project,
  servos,
  onUpdateServo,
}) => {
  const [activeTab, setActiveTab] = useState<'canvas' | 'cpp'>('canvas');
  const [activeCategory, setActiveCategory] = useState<BlockCategory | 'all'>('all');

  // Active Blocks Stack in Workspace
  const [scriptBlocks, setScriptBlocks] = useState<ActiveBlock[]>([
    {
      id: 'b_1',
      type: 'setup_header',
      category: 'control',
      title: '▶ WHEN PROGRAM STARTS (Setup)',
      pin: 0,
      value: 0,
      val2: 0,
      color: 'bg-amber-600/30 text-amber-200 border-amber-500/50',
      borderColor: 'border-amber-500',
    },
    {
      id: 'b_2',
      type: 'servo_rotate',
      category: 'servo',
      title: '⚙️ Rotate Servo on Pin D',
      pin: 9,
      value: 90,
      val2: 0,
      color: 'bg-purple-600/30 text-purple-200 border-purple-500/50',
      borderColor: 'border-purple-500',
    },
    {
      id: 'b_3',
      type: 'wait_ms',
      category: 'control',
      title: '⏱️ Wait Delay (ms)',
      pin: 0,
      value: 500,
      val2: 0,
      color: 'bg-amber-600/30 text-amber-200 border-amber-500/50',
      borderColor: 'border-amber-500',
    },
    {
      id: 'b_4',
      type: 'loop_header',
      category: 'control',
      title: '⟳ FOREVER REPEAT (Main Loop)',
      pin: 0,
      value: 0,
      val2: 0,
      color: 'bg-amber-600/30 text-amber-200 border-amber-500/50',
      borderColor: 'border-amber-500',
    },
    {
      id: 'b_5',
      type: 'servo_rotate',
      category: 'servo',
      title: '⚙️ Rotate Servo on Pin D',
      pin: 9,
      value: 0,
      val2: 0,
      color: 'bg-purple-600/30 text-purple-200 border-purple-500/50',
      borderColor: 'border-purple-500',
    },
    {
      id: 'b_6',
      type: 'wait_ms',
      category: 'control',
      title: '⏱️ Wait Delay (ms)',
      pin: 0,
      value: 1000,
      val2: 0,
      color: 'bg-amber-600/30 text-amber-200 border-amber-500/50',
      borderColor: 'border-amber-500',
    },
    {
      id: 'b_7',
      type: 'servo_rotate',
      category: 'servo',
      title: '⚙️ Rotate Servo on Pin D',
      pin: 9,
      value: 180,
      val2: 0,
      color: 'bg-purple-600/30 text-purple-200 border-purple-500/50',
      borderColor: 'border-purple-500',
    },
    {
      id: 'b_8',
      type: 'wait_ms',
      category: 'control',
      title: '⏱️ Wait Delay (ms)',
      pin: 0,
      value: 1000,
      val2: 0,
      color: 'bg-amber-600/30 text-amber-200 border-amber-500/50',
      borderColor: 'border-amber-500',
    },
  ]);

  // Live Execution State
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentExecutingBlockId, setCurrentExecutingBlockId] = useState<string | null>(null);
  const executionRef = useRef<boolean>(false);

  // Scratch Palette Templates
  const blockTemplates: BlockTemplate[] = [
    // Control
    {
      type: 'wait_ms',
      category: 'control',
      title: '⏱️ Wait Delay (ms)',
      defaultPin: 0,
      defaultValue: 500,
      color: 'bg-amber-600/20 text-amber-200 border-amber-500/40 hover:bg-amber-600/30',
      borderColor: 'border-amber-500',
    },
    {
      type: 'repeat_times',
      category: 'control',
      title: '🔁 Repeat Loop [N] Times',
      defaultPin: 0,
      defaultValue: 5,
      color: 'bg-amber-600/20 text-amber-200 border-amber-500/40 hover:bg-amber-600/30',
      borderColor: 'border-amber-500',
    },

    // Servo & Motion
    {
      type: 'servo_rotate',
      category: 'servo',
      title: '⚙️ Rotate Servo on Pin D',
      defaultPin: 9,
      defaultValue: 90,
      color: 'bg-purple-600/20 text-purple-200 border-purple-500/40 hover:bg-purple-600/30',
      borderColor: 'border-purple-500',
    },
    {
      type: 'servo_sweep',
      category: 'servo',
      title: '⟳ Sweep Servo on Pin D from min to max',
      defaultPin: 9,
      defaultValue: 0,
      defaultVal2: 180,
      color: 'bg-purple-600/20 text-purple-200 border-purple-500/40 hover:bg-purple-600/30',
      borderColor: 'border-purple-500',
    },

    // Pin IO
    {
      type: 'digital_write',
      category: 'pin',
      title: '🔌 Set Digital Pin D',
      defaultPin: 13,
      defaultValue: 'HIGH',
      color: 'bg-cyan-600/20 text-cyan-200 border-cyan-500/40 hover:bg-cyan-600/30',
      borderColor: 'border-cyan-500',
    },
    {
      type: 'pwm_write',
      category: 'pin',
      title: '⚡ Set PWM Pin D Value (0-255)',
      defaultPin: 3,
      defaultValue: 128,
      color: 'bg-cyan-600/20 text-cyan-200 border-cyan-500/40 hover:bg-cyan-600/30',
      borderColor: 'border-cyan-500',
    },

    // Sensors
    {
      type: 'sensor_ultrasonic',
      category: 'sensor',
      title: '🦇 Read Ultrasonic Distance (cm)',
      defaultPin: 7,
      defaultVal2: 8,
      defaultValue: 30,
      color: 'bg-emerald-600/20 text-emerald-200 border-emerald-500/40 hover:bg-emerald-600/30',
      borderColor: 'border-emerald-500',
    },
    {
      type: 'sensor_analog',
      category: 'sensor',
      title: '📡 Read Analog Pin A0 Sensor',
      defaultPin: 0,
      defaultValue: 500,
      color: 'bg-emerald-600/20 text-emerald-200 border-emerald-500/40 hover:bg-emerald-600/30',
      borderColor: 'border-emerald-500',
    },

    // Serial
    {
      type: 'serial_print',
      category: 'serial',
      title: '💬 Serial Print Message',
      defaultPin: 0,
      defaultValue: 'Hello Arduino!',
      color: 'bg-indigo-600/20 text-indigo-200 border-indigo-500/40 hover:bg-indigo-600/30',
      borderColor: 'border-indigo-500',
    },
  ];

  // Add block to stack
  const handleAddBlock = (template: BlockTemplate) => {
    const newBlock: ActiveBlock = {
      id: `blk_${Math.random().toString(36).substring(2, 9)}`,
      type: template.type,
      category: template.category,
      title: template.title,
      pin: template.defaultPin ?? 9,
      value: template.defaultValue ?? 90,
      val2: template.defaultVal2 ?? 0,
      color: template.color,
      borderColor: template.borderColor,
    };
    setScriptBlocks((prev) => [...prev, newBlock]);
  };

  // Move block up / down
  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index <= 0) return;
    if (direction === 'down' && index >= scriptBlocks.length - 1) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const updated = [...scriptBlocks];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIdx, 0, moved);
    setScriptBlocks(updated);
  };

  // Remove block
  const handleRemoveBlock = (id: string) => {
    setScriptBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  // Update block fields
  const handleUpdateBlock = (id: string, updates: Partial<ActiveBlock>) => {
    setScriptBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...updates } : b))
    );
  };

  // Load Scratch Presets
  const handleLoadPreset = (presetKey: string) => {
    if (presetKey === 'blink') {
      setScriptBlocks([
        {
          id: 'b_s',
          type: 'setup_header',
          category: 'control',
          title: '▶ WHEN PROGRAM STARTS (Setup)',
          pin: 0,
          value: 0,
          val2: 0,
          color: 'bg-amber-600/30 text-amber-200 border-amber-500/50',
          borderColor: 'border-amber-500',
        },
        {
          id: 'b_l',
          type: 'loop_header',
          category: 'control',
          title: '⟳ FOREVER REPEAT (Main Loop)',
          pin: 0,
          value: 0,
          val2: 0,
          color: 'bg-amber-600/30 text-amber-200 border-amber-500/50',
          borderColor: 'border-amber-500',
        },
        {
          id: 'b_1',
          type: 'digital_write',
          category: 'pin',
          title: '🔌 Set Digital Pin D',
          pin: 13,
          value: 'HIGH',
          val2: 0,
          color: 'bg-cyan-600/20 text-cyan-200 border-cyan-500/40',
          borderColor: 'border-cyan-500',
        },
        {
          id: 'b_2',
          type: 'wait_ms',
          category: 'control',
          title: '⏱️ Wait Delay (ms)',
          pin: 0,
          value: 1000,
          val2: 0,
          color: 'bg-amber-600/30 text-amber-200 border-amber-500/50',
          borderColor: 'border-amber-500',
        },
        {
          id: 'b_3',
          type: 'digital_write',
          category: 'pin',
          title: '🔌 Set Digital Pin D',
          pin: 13,
          value: 'LOW',
          val2: 0,
          color: 'bg-cyan-600/20 text-cyan-200 border-cyan-500/40',
          borderColor: 'border-cyan-500',
        },
        {
          id: 'b_4',
          type: 'wait_ms',
          category: 'control',
          title: '⏱️ Wait Delay (ms)',
          pin: 0,
          value: 1000,
          val2: 0,
          color: 'bg-amber-600/30 text-amber-200 border-amber-500/50',
          borderColor: 'border-amber-500',
        },
      ]);
    } else if (presetKey === 'sweep') {
      setScriptBlocks([
        {
          id: 'b_s',
          type: 'setup_header',
          category: 'control',
          title: '▶ WHEN PROGRAM STARTS (Setup)',
          pin: 0,
          value: 0,
          val2: 0,
          color: 'bg-amber-600/30 text-amber-200 border-amber-500/50',
          borderColor: 'border-amber-500',
        },
        {
          id: 'b_l',
          type: 'loop_header',
          category: 'control',
          title: '⟳ FOREVER REPEAT (Main Loop)',
          pin: 0,
          value: 0,
          val2: 0,
          color: 'bg-amber-600/30 text-amber-200 border-amber-500/50',
          borderColor: 'border-amber-500',
        },
        {
          id: 'b_1',
          type: 'servo_rotate',
          category: 'servo',
          title: '⚙️ Rotate Servo on Pin D',
          pin: 9,
          value: 0,
          val2: 0,
          color: 'bg-purple-600/20 text-purple-200 border-purple-500/40',
          borderColor: 'border-purple-500',
        },
        {
          id: 'b_2',
          type: 'wait_ms',
          category: 'control',
          title: '⏱️ Wait Delay (ms)',
          pin: 0,
          value: 800,
          val2: 0,
          color: 'bg-amber-600/30 text-amber-200 border-amber-500/50',
          borderColor: 'border-amber-500',
        },
        {
          id: 'b_3',
          type: 'servo_rotate',
          category: 'servo',
          title: '⚙️ Rotate Servo on Pin D',
          pin: 9,
          value: 180,
          val2: 0,
          color: 'bg-purple-600/20 text-purple-200 border-purple-500/40',
          borderColor: 'border-purple-500',
        },
        {
          id: 'b_4',
          type: 'wait_ms',
          category: 'control',
          title: '⏱️ Wait Delay (ms)',
          pin: 0,
          value: 800,
          val2: 0,
          color: 'bg-amber-600/30 text-amber-200 border-amber-500/50',
          borderColor: 'border-amber-500',
        },
      ]);
    }
  };

  // Generate Real-time Arduino C++ Code from Blocks Stack
  const generateCppCode = () => {
    let setupLines = '';
    let loopLines = '';
    const servoPinsUsed = new Set<number>();

    scriptBlocks.forEach((block) => {
      if (block.type === 'servo_rotate' || block.type === 'servo_sweep') {
        servoPinsUsed.add(block.pin);
      }
    });

    let code = `/*\n  ARDUINO CONTROL STUDIO – SCRATCH BLOCK CODING\n  Project: ${project.name}\n*/\n\n`;

    if (servoPinsUsed.size > 0) {
      code += `#include <Servo.h>\n\n`;
      servoPinsUsed.forEach((p) => {
        code += `Servo servo_pin_${p};\n`;
      });
      code += `\n`;
    }

    let currentSection: 'setup' | 'loop' = 'setup';

    scriptBlocks.forEach((block) => {
      if (block.type === 'setup_header') {
        currentSection = 'setup';
        return;
      }
      if (block.type === 'loop_header') {
        currentSection = 'loop';
        return;
      }

      let line = '';
      if (block.type === 'servo_rotate') {
        line = `  servo_pin_${block.pin}.write(${block.value});\n`;
      } else if (block.type === 'wait_ms') {
        line = `  delay(${block.value});\n`;
      } else if (block.type === 'digital_write') {
        line = `  digitalWrite(${block.pin}, ${block.value});\n`;
      } else if (block.type === 'pwm_write') {
        line = `  analogWrite(${block.pin}, ${block.value});\n`;
      } else if (block.type === 'serial_print') {
        line = `  Serial.println("${block.value}");\n`;
      }

      if (currentSection === 'setup') {
        setupLines += line;
      } else {
        loopLines += line;
      }
    });

    code += `void setup() {\n`;
    code += `  Serial.begin(115200);\n`;
    servoPinsUsed.forEach((p) => {
      code += `  servo_pin_${p}.attach(${p});\n`;
    });
    code += setupLines;
    code += `}\n\n`;

    code += `void loop() {\n`;
    code += loopLines;
    code += `}\n`;

    return code;
  };

  const generatedCode = generateCppCode();

  // Execute Blocks Stack Live on Hardware or Simulated Board
  const handleRunBlocksScript = async () => {
    if (isRunning) {
      executionRef.current = false;
      setIsRunning(false);
      setCurrentExecutingBlockId(null);
      return;
    }

    setIsRunning(true);
    executionRef.current = true;

    for (let i = 0; i < scriptBlocks.length; i++) {
      if (!executionRef.current) break;

      const block = scriptBlocks[i];
      setCurrentExecutingBlockId(block.id);

      if (block.type === 'servo_rotate') {
        const targetPin = block.pin;
        const targetAngle = typeof block.value === 'number' ? block.value : parseInt(block.value as string, 10) || 90;

        // Update React Servo State
        const match = servos.find((s) => s.pin === targetPin);
        if (match) {
          onUpdateServo({ ...match, currentAngle: targetAngle, targetAngle });
        }

        // Send hardware USB Serial command if connected
        if (arduinoSerial.status === 'connected') {
          await arduinoSerial.setServoAngle(targetPin, targetAngle);
        }
      } else if (block.type === 'wait_ms') {
        const delayMs = typeof block.value === 'number' ? block.value : parseInt(block.value as string, 10) || 500;
        await new Promise((res) => setTimeout(res, Math.max(100, delayMs)));
      }
    }

    setIsRunning(false);
    setCurrentExecutingBlockId(null);
  };

  const [copiedCode, setCopiedCode] = useState(false);
  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const filteredTemplates = blockTemplates.filter(
    (t) => activeCategory === 'all' || t.category === activeCategory
  );

  return (
    <div className="flex-1 overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col font-sans select-none">
      {/* Top Header Bar */}
      <div className="h-12 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-400 flex items-center justify-center">
            <Blocks className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-bold text-[var(--text-primary)] tracking-wide">
                SCRATCH BLOCK CODING STUDIO FOR ARDUINO
              </h1>
              <span className="px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 font-mono text-[9px] border border-amber-800 font-semibold">
                VISUAL IDE
              </span>
            </div>
          </div>
        </div>

        {/* Center Mode Switcher */}
        <div className="flex items-center bg-[var(--bg-tertiary)] p-0.5 rounded-lg border border-[var(--border-color)] text-xs">
          <button
            onClick={() => setActiveTab('canvas')}
            className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'canvas'
                ? 'bg-amber-600 text-white font-bold shadow'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Blocks className="w-3.5 h-3.5" />
            <span>Block Canvas ({scriptBlocks.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('cpp')}
            className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'cpp'
                ? 'bg-cyan-600 text-white font-bold shadow'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Arduino C++ Code</span>
          </button>
        </div>

        {/* Right Execution & Presets */}
        <div className="flex items-center gap-2">
          {/* Quick Presets */}
          <button
            onClick={() => handleLoadPreset('blink')}
            className="px-2.5 py-1 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)] rounded text-[11px] font-semibold"
          >
            Blink LED
          </button>
          <button
            onClick={() => handleLoadPreset('sweep')}
            className="px-2.5 py-1 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)] rounded text-[11px] font-semibold"
          >
            Servo Sweep
          </button>

          <div className="h-4 w-[1px] bg-[#27324c] mx-1" />

          {/* Run Blocks Script */}
          <button
            onClick={handleRunBlocksScript}
            className={`px-3.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md transition-all ${
              isRunning
                ? 'bg-rose-600 text-white shadow-rose-950 animate-pulse'
                : 'bg-emerald-600 hover:bg-emerald-500 text-slate-950 shadow-emerald-950'
            }`}
          >
            {isRunning ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{isRunning ? 'Stop Script' : 'Run Script'}</span>
          </button>
        </div>
      </div>

      {/* Main Studio Viewport */}
      {activeTab === 'canvas' ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Left Palette: Scratch Categories & Templates */}
          <div className="w-72 bg-[var(--bg-secondary)] border-r border-[var(--border-color)] flex flex-col shrink-0">
            {/* Category Filter Tabs */}
            <div className="p-3 border-b border-[var(--border-color)] flex flex-wrap gap-1">
              {[
                { id: 'all', label: 'All' },
                { id: 'control', label: 'Control' },
                { id: 'servo', label: 'Servos' },
                { id: 'pin', label: 'Pins' },
                { id: 'sensor', label: 'Sensors' },
                { id: 'serial', label: 'Serial' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id as any)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors border ${
                    activeCategory === cat.id
                      ? 'bg-amber-600 text-white font-bold border-amber-400'
                      : 'bg-[#181f33] text-slate-400 border-[#27324c] hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Block Template Palette List */}
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold mb-1">
                Scratch Block Palette (Click to Add):
              </div>

              {filteredTemplates.map((template, i) => (
                <div
                  key={i}
                  onClick={() => handleAddBlock(template)}
                  className={`p-2.5 rounded-lg border cursor-pointer transition-all hover:scale-[1.02] flex items-center justify-between ${template.color}`}
                >
                  <span className="text-xs font-semibold">{template.title}</span>
                  <Plus className="w-3.5 h-3.5 opacity-70 shrink-0" />
                </div>
              ))}
            </div>
          </div>

          {/* Center Workspace Canvas: Script Stack */}
          <div className="flex-1 overflow-y-auto p-6 bg-[var(--bg-primary)] flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  Script Execution Stack ({scriptBlocks.length} Blocks)
                </span>
              </div>
              <button
                onClick={() => setScriptBlocks([])}
                className="text-[11px] text-rose-400 hover:text-rose-300 font-mono flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> Clear Canvas
              </button>
            </div>

            {/* Script Blocks Stack Rendering */}
            {scriptBlocks.length > 0 ? (
              <div className="flex flex-col gap-2 max-w-2xl">
                {scriptBlocks.map((block, idx) => {
                  const isExecuting = currentExecutingBlockId === block.id;

                  return (
                    <div
                      key={block.id}
                      className={`p-3 rounded-xl border flex items-center justify-between transition-all ${block.color} ${
                        isExecuting ? 'ring-2 ring-cyan-400 shadow-lg shadow-cyan-950 scale-[1.02]' : ''
                      }`}
                    >
                      {/* Left: Block Title & Inline Parameters */}
                      <div className="flex items-center gap-3 flex-1 flex-wrap text-xs font-semibold">
                        <span className="font-bold">{block.title}</span>

                        {/* Pin Selector Input */}
                        {(block.type === 'servo_rotate' ||
                          block.type === 'servo_sweep' ||
                          block.type === 'digital_write' ||
                          block.type === 'pwm_write') && (
                          <div className="flex items-center gap-1 bg-[var(--bg-primary)] px-2 py-1 rounded border border-[var(--border-color)]">
                            <span className="text-[10px] text-[var(--text-secondary)] font-mono">Pin D:</span>
                            <select
                              value={block.pin}
                              onChange={(e) =>
                                handleUpdateBlock(block.id, { pin: parseInt(e.target.value, 10) })
                              }
                              className="bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-color)] rounded px-1.5 py-0.5 text-xs font-mono font-bold"
                            >
                              {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((p) => (
                                <option key={p} value={p}>
                                  D{p}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Servo Angle or Value Input */}
                        {block.type === 'servo_rotate' && (
                          <div className="flex items-center gap-1 bg-[var(--bg-primary)] px-2 py-1 rounded border border-[var(--border-color)]">
                            <span className="text-[10px] text-[var(--text-secondary)] font-mono">Angle:</span>
                            <input
                              type="number"
                              min="0"
                              max="180"
                              value={block.value}
                              onChange={(e) =>
                                handleUpdateBlock(block.id, {
                                  value: parseInt(e.target.value, 10) || 0,
                                })
                              }
                              className="w-14 bg-[var(--bg-tertiary)] text-purple-300 font-mono font-bold rounded px-1 text-center border border-[var(--border-color)]"
                            />
                            <span className="text-xs text-[var(--text-secondary)]">°</span>
                          </div>
                        )}

                        {/* Delay ms Input */}
                        {block.type === 'wait_ms' && (
                          <div className="flex items-center gap-1 bg-[var(--bg-primary)] px-2 py-1 rounded border border-[var(--border-color)]">
                            <span className="text-[10px] text-[var(--text-secondary)] font-mono">Duration (ms):</span>
                            <input
                              type="number"
                              step="50"
                              value={block.value}
                              onChange={(e) =>
                                handleUpdateBlock(block.id, {
                                  value: parseInt(e.target.value, 10) || 100,
                                })
                              }
                              className="w-16 bg-[var(--bg-tertiary)] text-amber-300 font-mono font-bold rounded px-1 text-center border border-[var(--border-color)]"
                            />
                          </div>
                        )}

                        {/* Digital Write HIGH / LOW */}
                        {block.type === 'digital_write' && (
                          <div className="flex items-center gap-1 bg-[var(--bg-primary)] px-2 py-1 rounded border border-[var(--border-color)]">
                            <span className="text-[10px] text-[var(--text-secondary)] font-mono">State:</span>
                            <select
                              value={block.value}
                              onChange={(e) => handleUpdateBlock(block.id, { value: e.target.value })}
                              className="bg-[var(--bg-tertiary)] text-cyan-300 font-mono font-bold rounded px-1.5 py-0.5 text-xs border border-[var(--border-color)]"
                            >
                              <option value="HIGH">HIGH (5V)</option>
                              <option value="LOW">LOW (0V)</option>
                            </select>
                          </div>
                        )}

                        {/* Serial Print message */}
                        {block.type === 'serial_print' && (
                          <div className="flex items-center gap-1 bg-[var(--bg-primary)] px-2 py-1 rounded border border-[var(--border-color)]">
                            <span className="text-[10px] text-[var(--text-secondary)] font-mono">Text:</span>
                            <input
                              type="text"
                              value={block.value}
                              onChange={(e) => handleUpdateBlock(block.id, { value: e.target.value })}
                              className="bg-[var(--bg-tertiary)] text-indigo-300 font-mono rounded px-2 py-0.5 text-xs border border-[var(--border-color)] w-36"
                            />
                          </div>
                        )}
                      </div>

                      {/* Right Actions: Reorder & Delete */}
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                          onClick={() => handleMoveBlock(idx, 'up')}
                          disabled={idx === 0}
                          className="p-1 hover:bg-black/30 rounded text-slate-300 disabled:opacity-20"
                          title="Move Block Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMoveBlock(idx, 'down')}
                          disabled={idx === scriptBlocks.length - 1}
                          className="p-1 hover:bg-black/30 rounded text-slate-300 disabled:opacity-20"
                          title="Move Block Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRemoveBlock(block.id)}
                          className="p-1 hover:bg-rose-950/60 text-rose-300 rounded ml-1"
                          title="Remove Block"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-500 my-auto flex flex-col items-center gap-2">
                <Blocks className="w-8 h-8 text-slate-600" />
                <span>Your Block Canvas is empty. Click any block from the left palette to build a script!</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* C++ Code Tab */
        <div className="flex-1 overflow-y-auto p-6 bg-[var(--bg-primary)] flex flex-col gap-4 max-w-3xl mx-auto w-full">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                Generated Arduino C++ Source Code
              </span>
            </div>
            <button
              onClick={handleCopyCode}
              className="px-3 py-1 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/40 rounded text-xs font-semibold flex items-center gap-1.5"
            >
              {copiedCode ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
            </button>
          </div>

          <pre className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-4 text-xs font-mono text-cyan-300/90 overflow-x-auto shadow-xl leading-relaxed">
            {generatedCode}
          </pre>
        </div>
      )}
    </div>
  );
};
