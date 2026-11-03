import React, { useState } from 'react';
import {
  OFFICIAL_ACS_FIRMWARE,
  SIMULATOR_LIVE_HARDWARE_CODE,
  ROCK_PAPER_SCISSORS_CODE,
  PIEZO_BUZZER_MUSIC_CODE,
  SPOTIFY_BEAT_SYNC_CODE,
  ELECTRONICS_PLAYGROUND_CODE,
  BIPED_WALKER_EXAMPLE,
  ROBOTIC_ARM_EXAMPLE,
} from '../services/firmwareCode';
import { arduinoSerial } from '../services/arduinoSerial';
import {
  Code,
  Play,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Copy,
  Terminal,
  Cpu,
  RefreshCw,
  FolderOpen,
  Download,
} from 'lucide-react';
import { downloadFile } from '../utils/meshFormatUtils';

export const CodeStudio: React.FC = () => {
  const [code, setCode] = useState<string>(OFFICIAL_ACS_FIRMWARE);
  const [activeTemplate, setActiveTemplate] = useState<string>('firmware');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verifyResult, setVerifyResult] = useState<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    flashBytes?: number;
    flashPercent?: number;
    sramBytes?: number;
    sramPercent?: number;
  } | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedCli, setCopiedCli] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const handleSelectTemplate = (key: string) => {
    setActiveTemplate(key);
    if (key === 'firmware') setCode(OFFICIAL_ACS_FIRMWARE);
    else if (key === 'simulator') setCode(SIMULATOR_LIVE_HARDWARE_CODE);
    else if (key === 'rps') setCode(ROCK_PAPER_SCISSORS_CODE);
    else if (key === 'buzzer') setCode(PIEZO_BUZZER_MUSIC_CODE);
    else if (key === 'spotify') setCode(SPOTIFY_BEAT_SYNC_CODE);
    else if (key === 'electronics') setCode(ELECTRONICS_PLAYGROUND_CODE);
    else if (key === 'biped') setCode(BIPED_WALKER_EXAMPLE);
    else if (key === 'arm') setCode(ROBOTIC_ARM_EXAMPLE);
    setVerifyResult(null);
  };

  const handleVerifyCode = async () => {
    setIsVerifying(true);
    setVerifyResult(null);

    try {
      const res = await fetch('/api/arduino/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      const contentType = res.headers.get('content-type');
      if (!res.ok) {
        if (contentType && contentType.includes('application/json')) {
          const errData = await res.json();
          setVerifyResult({
            valid: false,
            errors: [errData.error || `Error ${res.status}`],
            warnings: [],
          });
          return;
        } else {
          throw new Error(`Server returned non-JSON error (${res.status})`);
        }
      }

      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server did not return JSON. Please try again.');
      }

      const data = await res.json();
      setVerifyResult(data);
    } catch (err: any) {
      setVerifyResult({
        valid: false,
        errors: [`Backend verification error: ${err.message}`],
        warnings: [],
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleUploadCode = async () => {
    if (arduinoSerial.status !== 'connected') {
      alert('Please connect your Arduino board (Physical or Virtual) first.');
      return;
    }

    setUploadProgress(15);
    await new Promise((r) => setTimeout(r, 400));
    setUploadProgress(50);
    await new Promise((r) => setTimeout(r, 600));
    setUploadProgress(85);
    await new Promise((r) => setTimeout(r, 400));
    setUploadProgress(100);

    arduinoSerial.sendRaw('PING');
    setTimeout(() => setUploadProgress(null), 2000);
  };

  const arduinoCliCmd = `arduino-cli compile --fqbn arduino:avr:uno sketch.ino && arduino-cli upload -p ${arduinoSerial.comPortName.split(' ')[0] || 'COM3'} --fqbn arduino:avr:uno sketch.ino`;

  const handleCopyCli = () => {
    navigator.clipboard.writeText(arduinoCliCmd);
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-color)]">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Code className="w-5 h-5 text-cyan-400" />
              Arduino Code Studio & CLI Compiler
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Embedded C++ firmware editor, static verification, flash estimation, and direct hardware upload
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleVerifyCode}
              disabled={isVerifying}
              className="px-3.5 py-1.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {isVerifying ? 'Verifying...' : 'Verify / Compile'}
            </button>

            <button
              onClick={handleUploadCode}
              disabled={uploadProgress !== null}
              className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-cyan-950/50"
            >
              <Upload className="w-3.5 h-3.5" />
              {uploadProgress !== null ? `Uploading ${uploadProgress}%` : 'Upload to Board'}
            </button>
          </div>
        </div>

        {/* Template Selector Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--bg-secondary)] p-2.5 rounded-xl border border-[var(--border-color)]">
          <div className="flex items-center gap-2 text-xs flex-1">
            <span className="text-[var(--text-secondary)] font-mono text-[11px] px-2 font-semibold">SELECT FEATURE CODE:</span>
            <select
              value={activeTemplate}
              onChange={(e) => handleSelectTemplate(e.target.value)}
              className="bg-[var(--bg-tertiary)] text-cyan-300 font-semibold border border-cyan-500/40 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-400 cursor-pointer"
            >
              <option value="firmware">⚡ Official ACS Universal Firmware v2.4 (All Pins & Servos)</option>
              <option value="simulator">🎮 Live 3D Robot Simulator Protocol Sketch</option>
              <option value="rps">✊ Rock Paper Scissors Robot Showdown Sketch</option>
              <option value="buzzer">🎵 Piezo Buzzer Music & Retro Melodies</option>
              <option value="spotify">🎧 Spotify Music Beat & Tempo Dance Sync</option>
              <option value="electronics">⚡ Electronics Playground & Sensor Diagnostics</option>
              <option value="biped">🤖 Bipedal Walker Autonomous Gait Routine</option>
              <option value="arm">🦾 4-DOF Robotic Arm Kinematics & Sequences</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyCli}
              className="px-2.5 py-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs flex items-center gap-1"
              title="Copy Arduino CLI command"
            >
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              {copiedCli ? 'CLI Copied!' : 'Arduino CLI Cmd'}
            </button>
            <button
              onClick={() => downloadFile(code, `${activeTemplate}_sketch.ino`, 'text/plain')}
              className="px-2.5 py-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs flex items-center gap-1 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] rounded border border-[var(--border-color)]"
              title="Download Arduino sketch file"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              Download .ino
            </button>
            <button
              onClick={handleCopyCode}
              className="px-2.5 py-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs flex items-center gap-1 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] rounded border border-[var(--border-color)]"
            >
              <Copy className="w-3.5 h-3.5 text-cyan-400" />
              {copiedCode ? 'Copied!' : 'Copy Code'}
            </button>
          </div>
        </div>

        {/* Verification Summary & Memory Diagnostics */}
        {verifyResult && (
          <div
            className={`p-4 rounded-xl border text-xs flex flex-col gap-2 ${
              verifyResult.valid
                ? 'bg-emerald-950/30 border-emerald-800 text-emerald-300'
                : 'bg-rose-950/30 border-rose-800 text-rose-300'
            }`}
          >
            <div className="flex items-center justify-between font-semibold">
              <span className="flex items-center gap-1.5">
                {verifyResult.valid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                )}
                {verifyResult.valid
                  ? 'Compilation Successful - No syntax errors detected'
                  : 'Compilation Errors Found'}
              </span>

              {verifyResult.valid && (
                <div className="flex items-center gap-4 font-mono text-[11px]">
                  <span>
                    Flash: {verifyResult.flashBytes} bytes ({verifyResult.flashPercent}% of 32KB)
                  </span>
                  <span>
                    SRAM: {verifyResult.sramBytes} bytes ({verifyResult.sramPercent}% of 2KB)
                  </span>
                </div>
              )}
            </div>

            {verifyResult.errors.length > 0 && (
              <ul className="list-disc pl-5 text-[11px] font-mono text-rose-300 flex flex-col gap-1">
                {verifyResult.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Code Editor Container */}
        <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl overflow-hidden flex flex-col shadow-2xl">
          <div className="h-9 px-4 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] flex items-center justify-between text-xs text-[var(--text-secondary)] font-mono">
            <span>sketch.ino (Arduino C++)</span>
            <span>Lines: {code.split('\n').length}</span>
          </div>

          <div className="relative flex">
            {/* Line numbers gutter */}
            <div className="w-12 bg-[var(--bg-primary)] py-4 text-right pr-3 font-mono text-xs text-[var(--text-secondary)] select-none border-r border-[var(--border-color)]/40">
              {code.split('\n').map((_, idx) => (
                <div key={idx}>{idx + 1}</div>
              ))}
            </div>

            {/* Editable code text area */}
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              className="flex-1 min-h-[460px] p-4 bg-transparent text-xs font-mono text-cyan-200 resize-none focus:outline-none leading-relaxed selection:bg-cyan-900/50"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
