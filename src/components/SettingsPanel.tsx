import React, { useState, useEffect } from 'react';
import { arduinoSerial } from '../services/arduinoSerial';
import {
  Settings,
  Cpu,
  Radio,
  Sliders,
  CheckCircle2,
  RefreshCw,
  Terminal,
  Shield,
  Layers,
} from 'lucide-react';
import { AppMode } from '../types';

export interface SettingsPanelProps {
  appMode: AppMode;
  onSetAppMode: (mode: AppMode) => void;
  theme: 'modern' | 'vibrant' | 'minimal';
  onSetTheme: (theme: 'modern' | 'vibrant' | 'minimal') => void;
  uiDensity: 'compact' | 'comfortable' | 'spacious';
  onSetUiDensity: (density: 'compact' | 'comfortable' | 'spacious') => void;
  accentColor: string;
  onSetAccentColor: (color: string) => void;
  sidebarOpacity: number;
  onSetSidebarOpacity: (opacity: number) => void;
  cornerRadius: string;
  onSetCornerRadius: (radius: string) => void;
  particlesEnabled: boolean;
  onSetParticlesEnabled: (enabled: boolean) => void;
  mobileViewportEnabled: boolean;
  onSetMobileViewportEnabled: (enabled: boolean) => void;
  colorScheme: 'dark' | 'light';
  onSetColorScheme: (scheme: 'dark' | 'light') => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
  appMode, onSetAppMode, theme, onSetTheme, uiDensity, onSetUiDensity,
  accentColor, onSetAccentColor, sidebarOpacity, onSetSidebarOpacity,
  cornerRadius, onSetCornerRadius, particlesEnabled, onSetParticlesEnabled,
  mobileViewportEnabled, onSetMobileViewportEnabled, colorScheme, onSetColorScheme
}) => {
  const [defaultBaud, setDefaultBaud] = useState<number>(115200);
  const [telemetryRate, setTelemetryRate] = useState<number>(100);
  const [ollamaUrl, setOllamaUrl] = useState<string>('http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState<string>('llama3');
  const [hasGemini, setHasGemini] = useState<boolean>(true);
  const [gridSize, setGridSize] = useState<number>(24);
  const [savedNotice, setSavedNotice] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/status')
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data.hasGeminiKey === 'boolean') {
          setHasGemini(data.hasGeminiKey);
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = () => {
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  return (
    <div className={`flex-1 overflow-y-auto p-8 transition-colors duration-300 ${
      colorScheme === 'light' 
        ? 'bg-slate-50 text-slate-900' 
        : 'bg-[#0a0c14] text-slate-200'
    }`}>
      <div className="max-w-4xl mx-auto flex flex-col gap-8">
        {/* Header */}
        <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b ${
          theme === 'minimal' ? 'border-slate-200' : 'border-slate-800'
        }`}>
          <div>
            <h1 className={`text-2xl font-bold flex items-center gap-3 ${
              theme === 'minimal' ? 'text-slate-900' : 'text-white'
            }`}>
              <Settings className={`w-6 h-6 ${
                theme === 'minimal' ? 'text-slate-600' : 'text-cyan-400'
              }`} />
              Studio Preferences
            </h1>
            <p className="text-sm text-slate-500 mt-2">
              Configure your workspace, communication protocols, and AI assistant settings.
            </p>
          </div>

          <button
            onClick={handleSave}
            className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-cyan-950/50"
          >
            Save Settings
          </button>
        </div>

        {savedNotice && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-800 text-emerald-300 rounded-lg text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Preferences saved successfully!</span>
          </div>
        )}

        {/* Setting Section: App Mode */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-5 flex flex-col gap-4 transition-colors duration-300">
          <h2 className={`text-sm font-semibold flex items-center gap-2 ${colorScheme === 'light' ? 'text-slate-800' : 'text-white'}`}>
            <Layers className="w-4 h-4 text-purple-400" />
            Application Mode
          </h2>
          <div className="flex gap-2">
            {(['kid', 'standard', 'expert'] as AppMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => onSetAppMode(mode)}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  appMode === mode
                    ? 'bg-cyan-600 text-white shadow-lg'
                    : 'bg-[#181f33] text-slate-400 hover:bg-[#232c46]'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Setting Section: UI Customization */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-5 flex flex-col gap-4 transition-colors duration-300">
          <h2 className={`text-sm font-semibold flex items-center gap-2 ${colorScheme === 'light' ? 'text-slate-800' : 'text-white'}`}>
            <Sliders className="w-4 h-4 text-purple-400" />
            UI Customization & Theme
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-300">Accent Color:</label>
              <input
                type="color"
                value={accentColor}
                onChange={(e) => onSetAccentColor(e.target.value)}
                className="w-full h-8 rounded cursor-pointer"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-300">Sidebar Opacity: {(sidebarOpacity * 100).toFixed(0)}%</label>
              <input
                type="range"
                min="0.5"
                max="1"
                step="0.05"
                value={sidebarOpacity}
                onChange={(e) => onSetSidebarOpacity(parseFloat(e.target.value))}
                className="accent-purple-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-300">Corner Radius:</label>
              <select
                value={cornerRadius}
                onChange={(e) => onSetCornerRadius(e.target.value)}
                className="bg-[#181f33] border border-[#27324c] rounded px-3 py-2 text-white text-xs"
              >
                <option value="0px">None</option>
                <option value="8px">Small</option>
                <option value="12px">Medium</option>
                <option value="20px">Large</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-[#27324c]">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-300">Color Theme:</label>
              <select
                value={theme}
                onChange={(e) => onSetTheme(e.target.value as any)}
                className="bg-[#181f33] border border-[#27324c] rounded px-3 py-2 text-white text-xs"
              >
                <option value="modern">Modern Professional</option>
                <option value="vibrant">Vibrant Playful</option>
                <option value="minimal">Minimalist Clean</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-300">Dark/Light Mode:</label>
              <div className="flex bg-[#181f33] p-1 rounded-lg border border-[#27324c]">
                <button
                  onClick={() => onSetColorScheme('dark')}
                  className={`flex-1 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${
                    colorScheme === 'dark' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Dark
                </button>
                <button
                  onClick={() => onSetColorScheme('light')}
                  className={`flex-1 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${
                    colorScheme === 'light' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Light
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-300">UI Density:</label>
              <select
                value={uiDensity}
                onChange={(e) => onSetUiDensity(e.target.value as any)}
                className="bg-[#181f33] border border-[#27324c] rounded px-3 py-2 text-white text-xs"
              >
                <option value="compact">Compact (Dense)</option>
                <option value="comfortable">Comfortable</option>
                <option value="spacious">Spacious</option>
              </select>
            </div>
          </div>
        </div>

        {/* Setting Section 1: Hardware & Serial */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-5 flex flex-col gap-4 transition-colors duration-300">
          <h2 className={`text-sm font-semibold flex items-center gap-2 ${colorScheme === 'light' ? 'text-slate-800' : 'text-white'}`}>
            <Radio className="w-4 h-4 text-cyan-400" />
            Serial Communication & Hardware Timing
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-300">Default Baud Rate:</label>
              <select
                value={defaultBaud}
                onChange={(e) => setDefaultBaud(parseInt(e.target.value, 10))}
                className="bg-[#181f33] border border-[#27324c] rounded px-3 py-2 text-white"
              >
                <option value="115200">115200 Baud (High-Speed ACS Protocol)</option>
                <option value="57600">57600 Baud</option>
                <option value="38400">38400 Baud</option>
                <option value="9600">9600 Baud (Legacy)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-slate-300">Telemetry Stream Rate (ms):</label>
              <input
                type="number"
                min="20"
                max="1000"
                step="20"
                value={telemetryRate}
                onChange={(e) => setTelemetryRate(parseInt(e.target.value, 10) || 100)}
                className="bg-[#181f33] border border-[#27324c] rounded px-3 py-2 text-white font-mono"
              />
              <span className="text-[11px] text-slate-500">
                Frequency for streaming A0-A5 analog readings over serial (Default: 100ms / 10Hz).
              </span>
            </div>
          </div>
        </div>

        {/* Setting Section 2: 3D Viewport */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-5 flex flex-col gap-4 transition-colors duration-300">
          <h2 className={`text-sm font-semibold flex items-center gap-2 ${colorScheme === 'light' ? 'text-slate-800' : 'text-white'}`}>
            <Layers className="w-4 h-4 text-purple-400" />
            3D Graphics & Kinematic Rendering
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-300">Ground Grid Extent (Units):</label>
              <input
                type="number"
                min="10"
                max="50"
                value={gridSize}
                onChange={(e) => setGridSize(parseInt(e.target.value, 10) || 24)}
                className="bg-[#181f33] border border-[#27324c] rounded px-3 py-2 text-white font-mono"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-slate-300">Mobile Viewport Simulation (9:16 aspect ratio):</label>
              <div className="flex items-center gap-3 mt-1">
                <button
                  onClick={() => onSetMobileViewportEnabled(!mobileViewportEnabled)}
                  className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-all ${
                    mobileViewportEnabled
                      ? 'bg-cyan-600 text-slate-950 shadow-lg'
                      : 'bg-[#181f33] text-slate-400 border border-[#27324c] hover:bg-[#202945]'
                  }`}
                >
                  <span>{mobileViewportEnabled ? '📱 Mobile Viewport: ACTIVE' : '💻 Mobile Viewport: Disabled'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Setting Section 3: AI Engine Config */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-5 flex flex-col gap-4 transition-colors duration-300">
          <h2 className={`text-sm font-semibold flex items-center gap-2 ${colorScheme === 'light' ? 'text-slate-800' : 'text-white'}`}>
            <Cpu className="w-4 h-4 text-emerald-400" />
            Robotics AI Assistant Provider
          </h2>

          <div className="flex flex-col gap-3 text-xs">
            <div className="flex items-center justify-between p-3 bg-[#181f33] rounded-lg border border-[#27324c]">
              <div>
                <div className="font-semibold text-white">Google Gemini 3.8 Flash</div>
                <div className="text-[11px] text-slate-400">
                  Cloud server-side inference for 3D modeling, code generation, and kinematics
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold ${
                  hasGemini
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-amber-950 text-amber-400 border border-amber-800'
                }`}
              >
                {hasGemini ? 'ONLINE' : 'CONFIG CHECK'}
              </span>
            </div>

            <div className="p-3 bg-[#181f33] rounded-lg border border-[#27324c] flex flex-col gap-3">
              <div className="font-semibold text-white">Local Ollama Server Endpoint</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="bg-[#0c0f17] border border-[#27324c] rounded px-3 py-1.5 text-white font-mono text-xs"
                />
                <input
                  type="text"
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  placeholder="llama3 or codellama"
                  className="bg-[#0c0f17] border border-[#27324c] rounded px-3 py-1.5 text-white font-mono text-xs"
                />
              </div>
              <span className="text-[11px] text-slate-400">
                To run fully offline on Windows: install Ollama, run `ollama run llama3`, and leave Ollama running in the background.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
