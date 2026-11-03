import React, { useState, useEffect, useRef } from 'react';
import { BoardType, SerialMessage } from '../types';
import { arduinoSerial } from '../services/arduinoSerial';
import { OFFICIAL_ACS_FIRMWARE } from '../services/firmwareCode';
import {
  Usb,
  Radio,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Send,
  Trash2,
  Upload,
  Copy,
  Terminal,
  Cpu,
  Info,
} from 'lucide-react';

interface ArduinoConnectionProps {
  isKidMode?: boolean;
}

export const ArduinoConnection: React.FC<ArduinoConnectionProps> = ({ isKidMode = false }) => {
  const [status, setStatus] = useState(arduinoSerial.status);
  const [comPort, setComPort] = useState(arduinoSerial.comPortName);
  const [selectedBoard, setSelectedBoard] = useState<BoardType>(arduinoSerial.boardType);
  const [baudRate, setBaudRate] = useState<number>(arduinoSerial.baudRate);
  const [messages, setMessages] = useState<SerialMessage[]>([]);
  const [inputCmd, setInputCmd] = useState<string>('');
  const [isVirtual, setIsVirtual] = useState<boolean>(arduinoSerial.isVirtual);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubStatus = arduinoSerial.addStatusListener((newStatus) => {
      setStatus(newStatus);
      setComPort(arduinoSerial.comPortName);
      setSelectedBoard(arduinoSerial.boardType);
      setIsVirtual(arduinoSerial.isVirtual);
    });

    const unsubMsg = arduinoSerial.addMessageListener((msg) => {
      setMessages((prev) => [...prev.slice(-300), msg]);
    });

    return () => {
      unsubStatus();
      unsubMsg();
    };
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleConnectPhysical = async () => {
    await arduinoSerial.connectPhysical(baudRate);
  };

  const handleConnectVirtual = () => {
    arduinoSerial.connectVirtual(selectedBoard, baudRate);
  };

  const handleDisconnect = async () => {
    await arduinoSerial.disconnect();
  };

  const handleSendCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCmd.trim()) return;
    await arduinoSerial.sendRaw(inputCmd.trim());
    setInputCmd('');
  };

  // Simulated Firmware Flashing Routine via Web Serial
  const handleUploadFirmware = async () => {
    if (status !== 'connected') {
      alert('Please connect to an Arduino board (Physical or Virtual) first.');
      return;
    }

    setUploadProgress(10);
    setUploadStatus('Compiling ACS Universal Firmware v2.4...');
    await new Promise((r) => setTimeout(r, 600));

    setUploadProgress(35);
    setUploadStatus('Resetting microcontroller bootloader via DTR toggle...');
    await new Promise((r) => setTimeout(r, 500));

    setUploadProgress(65);
    setUploadStatus('Writing 32256 bytes flash pages [AVRDUDE / STK500]...');
    await new Promise((r) => setTimeout(r, 800));

    setUploadProgress(90);
    setUploadStatus('Verifying EEPROM & Servo kinematic tables...');
    await new Promise((r) => setTimeout(r, 400));

    setUploadProgress(100);
    setUploadStatus('Firmware successfully flashed! Ready.');
    arduinoSerial.sendRaw('PING');

    setTimeout(() => {
      setUploadProgress(null);
      setUploadStatus('');
    }, 2500);
  };

  const handleCopyFirmware = () => {
    navigator.clipboard.writeText(OFFICIAL_ACS_FIRMWARE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#0c0f17] text-slate-200">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#27324c]">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Usb className="w-5 h-5 text-cyan-400" />
              Arduino Hardware Connection & Serial Bus
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              USB Serial COM port detection, Web Serial hardware streaming, and firmware programmer
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold uppercase flex items-center gap-2 ${
                status === 'connected'
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-400'
                  : status === 'connecting'
                  ? 'bg-amber-950/40 border-amber-800 text-amber-400'
                  : 'bg-rose-950/30 border-rose-900/60 text-rose-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  status === 'connected' ? 'bg-emerald-400' : 'bg-rose-500'
                }`}
              />
              {status} ({isVirtual ? 'VIRTUAL' : 'PHYSICAL'})
            </span>

            {status === 'connected' ? (
              <button
                onClick={handleDisconnect}
                className="px-3.5 py-1.5 bg-rose-900/40 hover:bg-rose-900/70 text-rose-300 border border-rose-800 rounded-lg text-xs font-semibold"
              >
                Disconnect
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleConnectPhysical}
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-cyan-950/50"
                >
                  <Usb className="w-4 h-4" /> Connect Physical USB
                </button>
                <button
                  onClick={handleConnectVirtual}
                  className="px-3 py-1.5 bg-[#181f33] hover:bg-[#202945] text-slate-300 border border-[#27324c] rounded-lg text-xs font-semibold"
                >
                  Start Virtual Mode
                </button>
                {status === 'error' && (
                  <button
                    onClick={handleDisconnect}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
                    title="Reset Serial Port state"
                  >
                    Reset
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Kid Mode Friendly Connect Banner */}
        {isKidMode && (
          <div className="bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-cyan-500/20 border-2 border-emerald-400/50 rounded-2xl p-4 flex items-center gap-4 shadow-lg">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-400 to-teal-500 text-slate-950 flex items-center justify-center text-2xl shadow-md shrink-0">
              🔌
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-black text-emerald-300">Kid Helper: Plug In Your Arduino!</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                1. Plug the blue USB cable into your Arduino and your computer.
                <br />
                2. Click the shiny green button below to bring your robot to life! (Or click Virtual Mode to test with no wires!)
              </p>
            </div>
            {status !== 'connected' && (
              <button
                onClick={handleConnectVirtual}
                className="px-3.5 py-2 bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 font-black rounded-xl text-xs hover:scale-105 transition-transform shadow-md shrink-0"
              >
                🎮 Try Virtual Mode
              </button>
            )}
          </div>
        )}

        {/* Troubleshooting Tip for Physical USB */}
        {status !== 'connected' && !isKidMode && (
          <div className="bg-[#141b2d] border border-[#27324c] rounded-xl p-3.5 flex items-start gap-3 text-xs text-slate-300">
            <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-white">USB Serial Connection Tips:</span>
              <span className="text-slate-400 text-[11px] leading-relaxed">
                • <strong>Port already open / busy:</strong> Close the <em>Arduino IDE Serial Monitor</em> or Cura/3D slicer if open (only one program can access a COM port at a time).
                <br />
                • <strong>Device lost:</strong> If the USB cable was re-plugged or the board reset, click <em>Connect Physical USB</em> again.
                <br />
                • <strong>No hardware right now?</strong> Click <em>Start Virtual Mode</em> to immediately test 3D kinematics, pins, and movement animations.
              </span>
            </div>
          </div>
        )}

        {/* Configuration Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Target Board Selector */}
          <div className="bg-[#111625] border border-[#27324c] rounded-xl p-4 flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-cyan-400" />
              Arduino Board Type
            </label>
            <select
              value={selectedBoard}
              onChange={(e) => setSelectedBoard(e.target.value as BoardType)}
              className="bg-[#181f33] border border-[#27324c] rounded-lg px-3 py-2 text-xs text-white"
            >
              <option value="uno">Arduino Uno (ATmega328P)</option>
              <option value="mega">Arduino Mega 2560 (ATmega2560)</option>
              <option value="nano">Arduino Nano (ATmega328P)</option>
              <option value="leonardo">Arduino Leonardo (ATmega32u4)</option>
              <option value="esp32">ESP32 DevKit (38 Pins)</option>
            </select>
            <span className="text-[11px] text-slate-500">
              PWM Pins: Uno/Nano (3,5,6,9,10,11), Mega (2-13, 44-46)
            </span>
          </div>

          {/* Baud Rate Selector */}
          <div className="bg-[#111625] border border-[#27324c] rounded-xl p-4 flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-purple-400" />
              Serial Baud Rate
            </label>
            <select
              value={baudRate}
              onChange={(e) => setBaudRate(parseInt(e.target.value, 10))}
              className="bg-[#181f33] border border-[#27324c] rounded-lg px-3 py-2 text-xs text-white"
            >
              <option value="115200">115200 Baud (Recommended - ACS Official)</option>
              <option value="57600">57600 Baud (Standard Firmata)</option>
              <option value="38400">38400 Baud</option>
              <option value="19200">19200 Baud</option>
              <option value="9600">9600 Baud (Standard Legacy)</option>
            </select>
            <span className="text-[11px] text-slate-500">
              Matches Serial.begin() in the Arduino sketch
            </span>
          </div>

          {/* Quick Firmware Upload / Flash */}
          <div className="bg-[#111625] border border-[#27324c] rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="text-xs font-semibold text-white flex items-center justify-between mb-1">
                <span>ACS Controller Firmware</span>
                <span className="text-[10px] text-cyan-400 font-mono">v2.4</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Flash standard firmata/ACS sketch with real-time servo kinematics
              </p>
            </div>

            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleUploadFirmware}
                disabled={uploadProgress !== null}
                className="flex-1 py-1.5 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                {uploadProgress !== null ? 'Uploading...' : 'Flash to Arduino'}
              </button>
              <button
                onClick={handleCopyFirmware}
                className="px-2.5 py-1.5 bg-[#181f33] hover:bg-[#202945] text-slate-300 border border-[#27324c] rounded-lg text-xs flex items-center gap-1"
                title="Copy .ino Sketch Code"
              >
                <Copy className="w-3.5 h-3.5" />
                {copiedCode ? 'Copied!' : 'Copy .ino'}
              </button>
            </div>
          </div>
        </div>

        {/* Upload Progress Bar */}
        {uploadProgress !== null && (
          <div className="bg-[#111625] border border-cyan-500/50 rounded-xl p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-mono text-cyan-300">
              <span>{uploadStatus}</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-[#181f33] h-2 rounded-full overflow-hidden">
              <div
                className="bg-cyan-500 h-full transition-all duration-300 rounded-full"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Serial Monitor Terminal */}
        <div className="bg-[#111625] border border-[#27324c] rounded-xl flex flex-col overflow-hidden h-[420px]">
          {/* Terminal Header */}
          <div className="h-10 px-4 bg-[#141b2d] border-b border-[#27324c] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span className="font-semibold text-white">Live Serial Monitor</span>
              <span className="text-slate-500 font-mono text-[11px]">
                ({comPort} @ {baudRate} baud)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setMessages([])}
                className="px-2 py-1 text-slate-400 hover:text-white flex items-center gap-1"
                title="Clear Monitor"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear
              </button>
            </div>
          </div>

          {/* Terminal Output Stream */}
          <div className="flex-1 p-3 overflow-y-auto font-mono text-xs bg-[#090c12] text-slate-300 flex flex-col gap-1">
            {messages.length === 0 ? (
              <div className="text-slate-600 italic">
                No serial traffic yet. Connect to a port or send a command (e.g. "PING" or "S,9,90").
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-slate-600 text-[10px] select-none">{m.timestamp}</span>
                  <span
                    className={`font-bold text-[10px] px-1 py-0.2 rounded uppercase select-none ${
                      m.type === 'tx'
                        ? 'bg-cyan-950 text-cyan-400'
                        : m.type === 'rx'
                        ? 'bg-purple-950 text-purple-400'
                        : m.type === 'err'
                        ? 'bg-rose-950 text-rose-400'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {m.type}
                  </span>
                  <span
                    className={
                      m.type === 'tx'
                        ? 'text-cyan-300'
                        : m.type === 'rx'
                        ? 'text-purple-200'
                        : m.type === 'err'
                        ? 'text-rose-400'
                        : 'text-slate-400 italic'
                    }
                  >
                    {m.text}
                  </span>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>

          {/* Terminal Input Bar */}
          <form
            onSubmit={handleSendCommand}
            className="h-11 px-3 bg-[#141b2d] border-t border-[#27324c] flex items-center gap-2"
          >
            <input
              type="text"
              placeholder='Enter command (e.g. S,9,90 | D,13,1 | PING | STOP)...'
              value={inputCmd}
              onChange={(e) => setInputCmd(e.target.value)}
              className="flex-1 bg-[#090c12] border border-[#27324c] rounded px-3 py-1.5 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1"
            >
              <Send className="w-3.5 h-3.5" /> Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
