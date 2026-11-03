import React, { useState, useEffect } from 'react';
import { arduinoSerial } from '../services/arduinoSerial';
import {
  Cpu,
  Zap,
  Activity,
  Terminal,
  Clock,
  Layers,
  Gauge,
  Sliders,
  ChevronUp,
  ChevronDown,
  X,
  RefreshCw,
  Binary,
  HardDrive,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

interface ExpertHudProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const ExpertHud: React.FC<ExpertHudProps> = ({ isOpen, onToggle }) => {
  const [activeTab, setActiveTab] = useState<'registers' | 'timers' | 'packets' | 'mcu'>('registers');
  
  // Register state simulation
  const [registers, setRegisters] = useState({
    DDRB: 0x20,  // Pin 13 is output (bit 5)
    PORTB: 0x00,
    PINB: 0x00,
    DDRD: 0x6e,  // Pins 1, 2, 3, 5, 6 output
    PORTD: 0x00,
    PIND: 0x00,
    DDRC: 0x00,  // Analog A0-A5 all inputs
    PORTC: 0x00,
    PINC: 0x00,
  });

  const [baudRate, setBaudRate] = useState<number>(arduinoSerial.baudRate || 115200);
  const [mcuClock] = useState('16.000 MHz (ATmega328P)');
  const [txBytes, setTxBytes] = useState(1482);
  const [rxBytes, setRxBytes] = useState(3892);
  const [packetRate, setPacketRate] = useState(48); // packets/sec
  const [recentPackets, setRecentPackets] = useState<Array<{ id: string; dir: 'tx' | 'rx'; hex: string; text: string; time: string }>>([
    { id: '1', dir: 'tx', hex: '50 49 4e 47 0a', text: 'PING', time: '13:52:01.120' },
    { id: '2', dir: 'rx', hex: '50 4f 4e 47 2c 55 4e 4f 0a', text: 'PONG,UNO,2.4', time: '13:52:01.132' },
  ]);

  // Listen to serial messages to update packet inspector
  useEffect(() => {
    const unsub = arduinoSerial.addMessageListener((msg) => {
      if (msg.type === 'tx' || msg.type === 'rx') {
        const hex = Array.from(msg.text)
          .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
          .join(' ');
        setRecentPackets((prev) => [
          ...prev.slice(-20),
          { id: Math.random().toString(36).substring(2, 7), dir: msg.type as 'tx' | 'rx', hex, text: msg.text, time: msg.timestamp },
        ]);
        if (msg.type === 'tx') setTxBytes((b) => b + msg.text.length);
        if (msg.type === 'rx') setRxBytes((b) => b + msg.text.length);
      }
    });
    return unsub;
  }, []);

  const handleToggleRegisterBit = async (reg: 'PORTB' | 'PORTD' | 'PORTC', bit: number) => {
    const currentVal = registers[reg];
    const nextVal = currentVal ^ (1 << bit);
    setRegisters((prev) => ({ ...prev, [reg]: nextVal }));

    // Map bit to Arduino pin number
    let pinNumber = -1;
    if (reg === 'PORTB') {
      pinNumber = bit + 8; // PB0..PB5 = D8..D13
    } else if (reg === 'PORTD') {
      pinNumber = bit;     // PD0..PD7 = D0..D7
    } else if (reg === 'PORTC') {
      pinNumber = bit + 14;// PC0..PC5 = A0..A5
    }

    if (pinNumber >= 0) {
      const bitState: 0 | 1 = (nextVal & (1 << bit)) !== 0 ? 1 : 0;
      await arduinoSerial.setDigitalPin(pinNumber, bitState);
    }
  };

  const toBinaryString = (val: number, bits: number = 8) => {
    return val.toString(2).padStart(bits, '0');
  };

  const toHexString = (val: number) => {
    return '0x' + val.toString(16).toUpperCase().padStart(2, '0');
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 select-none">
      {/* Collapsed HUD Bar */}
      {!isOpen && (
        <div className="bg-[#090d16]/95 backdrop-blur-md border-t border-emerald-500/50 px-4 py-2 flex items-center justify-between shadow-2xl">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-wider text-emerald-400 font-mono">
                ⚡ EXPERT EMBEDDED HUD
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                16MHz ATmega328P
              </span>
              <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                PORTB: {toHexString(registers.PORTB)} | PORTD: {toHexString(registers.PORTD)} | UART: {baudRate} baud
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggle}
              className="px-3 py-1 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/60 rounded-lg text-emerald-300 text-xs font-bold font-mono flex items-center gap-1 transition-all"
            >
              <span>Expand Registers & Telemetry</span>
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Expanded HUD Panel */}
      {isOpen && (
        <div className="bg-[#090d16]/98 backdrop-blur-md border-t-2 border-emerald-500/70 shadow-2xl max-h-[480px] flex flex-col animate-in slide-in-from-bottom-6 duration-200">
          {/* HUD Header */}
          <div className="px-5 py-3 border-b border-[#27324c] flex items-center justify-between bg-[#060910]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-extrabold tracking-wider text-white font-mono">
                    AVR ATmega328P REGISTER & TIMING INSPECTOR
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold">
                    EXPERT ENGINE ACTIVE
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  Microcontroller Core Clock: {mcuClock} • Flash 32KB • SRAM 2048 Bytes • Supply 4.98V VCC
                </div>
              </div>
            </div>

            {/* Tabs & Close */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-[#111625] p-0.5 rounded-lg border border-[#27324c] text-xs font-mono">
                <button
                  onClick={() => setActiveTab('registers')}
                  className={`px-3 py-1 rounded transition-colors ${
                    activeTab === 'registers'
                      ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Registers (DDR/PORT)
                </button>
                <button
                  onClick={() => setActiveTab('timers')}
                  className={`px-3 py-1 rounded transition-colors ${
                    activeTab === 'timers'
                      ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Timers & PWM
                </button>
                <button
                  onClick={() => setActiveTab('packets')}
                  className={`px-3 py-1 rounded transition-colors ${
                    activeTab === 'packets'
                      ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Serial Hex Packets
                </button>
                <button
                  onClick={() => setActiveTab('mcu')}
                  className={`px-3 py-1 rounded transition-colors ${
                    activeTab === 'mcu'
                      ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  MCU Memory & Rails
                </button>
              </div>

              <button
                onClick={onToggle}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                title="Collapse Expert HUD"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* HUD Content Area */}
          <div className="p-4 overflow-y-auto max-h-[380px]">
            {activeTab === 'registers' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* PORTB (Pins 8 to 13) */}
                <div className="bg-[#111625] border border-[#27324c] rounded-xl p-3.5 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between border-b border-[#27324c] pb-2">
                    <span className="font-mono font-bold text-xs text-white">PORTB / DDRB (Pins 8 - 13)</span>
                    <span className="font-mono text-xs text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                      {toHexString(registers.PORTB)}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    PB5 = D13 (Built-in LED) • PB4 = D12 • PB3 = D11 • PB2 = D10 • PB1 = D9 • PB0 = D8
                  </div>
                  {/* 8-bit visual switches */}
                  <div className="grid grid-cols-8 gap-1 font-mono text-center pt-1">
                    {[7, 6, 5, 4, 3, 2, 1, 0].map((bit) => {
                      const isHigh = (registers.PORTB & (1 << bit)) !== 0;
                      return (
                        <div key={bit} className="flex flex-col items-center gap-1">
                          <span className="text-[9px] text-slate-500">B{bit}</span>
                          <button
                            onClick={() => handleToggleRegisterBit('PORTB', bit)}
                            className={`w-full py-1.5 rounded text-xs font-bold transition-all ${
                              isHigh
                                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-500/40 ring-1 ring-white'
                                : 'bg-[#181f33] text-slate-400 hover:bg-slate-700 border border-[#27324c]'
                            }`}
                            title={`Toggle PORTB bit ${bit} (Pin ${bit + 8})`}
                          >
                            {isHigh ? '1' : '0'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-1 flex justify-between">
                    <span>DDRB: {toBinaryString(registers.DDRB)}</span>
                    <span className="text-emerald-400">Atomic OUT 0x25</span>
                  </div>
                </div>

                {/* PORTD (Pins 0 to 7) */}
                <div className="bg-[#111625] border border-[#27324c] rounded-xl p-3.5 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between border-b border-[#27324c] pb-2">
                    <span className="font-mono font-bold text-xs text-white">PORTD / DDRD (Pins 0 - 7)</span>
                    <span className="font-mono text-xs text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800">
                      {toHexString(registers.PORTD)}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    PD0/1 = RX/TX • PD2/3 = INT0/1 • PD4..7 = D4..D7
                  </div>
                  {/* 8-bit visual switches */}
                  <div className="grid grid-cols-8 gap-1 font-mono text-center pt-1">
                    {[7, 6, 5, 4, 3, 2, 1, 0].map((bit) => {
                      const isHigh = (registers.PORTD & (1 << bit)) !== 0;
                      return (
                        <div key={bit} className="flex flex-col items-center gap-1">
                          <span className="text-[9px] text-slate-500">D{bit}</span>
                          <button
                            onClick={() => handleToggleRegisterBit('PORTD', bit)}
                            className={`w-full py-1.5 rounded text-xs font-bold transition-all ${
                              isHigh
                                ? 'bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/40 ring-1 ring-white'
                                : 'bg-[#181f33] text-slate-400 hover:bg-slate-700 border border-[#27324c]'
                            }`}
                            title={`Toggle PORTD bit ${bit} (Pin D${bit})`}
                          >
                            {isHigh ? '1' : '0'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-1 flex justify-between">
                    <span>DDRD: {toBinaryString(registers.DDRD)}</span>
                    <span className="text-cyan-400">Atomic OUT 0x2B</span>
                  </div>
                </div>

                {/* PORTC (Pins A0 to A5) */}
                <div className="bg-[#111625] border border-[#27324c] rounded-xl p-3.5 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between border-b border-[#27324c] pb-2">
                    <span className="font-mono font-bold text-xs text-white">PORTC / DDRC (Analog A0 - A5)</span>
                    <span className="font-mono text-xs text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800">
                      {toHexString(registers.PORTC)}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    PC0..PC5 = A0..A5 (ADC Channels 0-5) • PC4/5 = SDA/SCL I2C
                  </div>
                  {/* 6-bit visual switches */}
                  <div className="grid grid-cols-8 gap-1 font-mono text-center pt-1">
                    {[7, 6, 5, 4, 3, 2, 1, 0].map((bit) => {
                      const isHigh = (registers.PORTC & (1 << bit)) !== 0;
                      const isUnused = bit >= 6;
                      return (
                        <div key={bit} className="flex flex-col items-center gap-1">
                          <span className="text-[9px] text-slate-500">C{bit}</span>
                          <button
                            onClick={() => !isUnused && handleToggleRegisterBit('PORTC', bit)}
                            disabled={isUnused}
                            className={`w-full py-1.5 rounded text-xs font-bold transition-all ${
                              isUnused
                                ? 'bg-slate-900 text-slate-700 cursor-not-allowed'
                                : isHigh
                                ? 'bg-purple-400 text-slate-950 shadow-md shadow-purple-500/40 ring-1 ring-white'
                                : 'bg-[#181f33] text-slate-400 hover:bg-slate-700 border border-[#27324c]'
                            }`}
                            title={`Toggle PORTC bit ${bit} (Pin A${bit})`}
                          >
                            {isUnused ? '-' : isHigh ? '1' : '0'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-1 flex justify-between">
                    <span>DDRC: {toBinaryString(registers.DDRC)}</span>
                    <span className="text-purple-400">Atomic OUT 0x28</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'timers' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#111625] border border-[#27324c] rounded-xl p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between border-b border-[#27324c] pb-2 font-mono text-xs">
                    <span className="font-bold text-white">Timer 0 (8-bit)</span>
                    <span className="text-cyan-400">976.56 Hz</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Controls hardware PWM on Pin 5 and Pin 6 (TCCR0A / TCCR0B). Used for millis() timebase interrupt vector.
                  </p>
                  <div className="bg-[#0c0f17] p-2 rounded text-[10px] font-mono text-slate-300">
                    <div>Prescaler: clk/64 (CS01 | CS00)</div>
                    <div>Mode: Fast PWM (WGM01 | WGM00)</div>
                  </div>
                </div>

                <div className="bg-[#111625] border border-[#27324c] rounded-xl p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between border-b border-[#27324c] pb-2 font-mono text-xs">
                    <span className="font-bold text-white">Timer 1 (16-bit High Res)</span>
                    <span className="text-purple-400">50.00 Hz (Servos)</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Controls servo motor pulses on Pin 9 and Pin 10. Frame period: 20ms, 1500µs pulse neutral resolution.
                  </p>
                  <div className="bg-[#0c0f17] p-2 rounded text-[10px] font-mono text-slate-300">
                    <div>ICR1: 40000 (Top Period)</div>
                    <div>Resolution: 0.5 µs per tick</div>
                  </div>
                </div>

                <div className="bg-[#111625] border border-[#27324c] rounded-xl p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between border-b border-[#27324c] pb-2 font-mono text-xs">
                    <span className="font-bold text-white">Timer 2 (8-bit Async)</span>
                    <span className="text-emerald-400">490.20 Hz</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Controls hardware PWM on Pin 3 and Pin 11 (TCCR2A / TCCR2B). Supports high-frequency phase correct modulation.
                  </p>
                  <div className="bg-[#0c0f17] p-2 rounded text-[10px] font-mono text-slate-300">
                    <div>Prescaler: clk/64 (CS22)</div>
                    <div>Mode: Phase Correct PWM</div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'packets' && (
              <div className="flex flex-col gap-3 font-mono">
                <div className="flex items-center justify-between bg-[#111625] p-2.5 rounded-lg border border-[#27324c] text-xs">
                  <div className="flex items-center gap-4">
                    <span>TX: <strong className="text-cyan-400">{txBytes} Bytes</strong></span>
                    <span>RX: <strong className="text-emerald-400">{rxBytes} Bytes</strong></span>
                    <span>Rate: <strong className="text-purple-400">{packetRate} pkt/s</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">Baud:</span>
                    <select
                      value={baudRate}
                      onChange={(e) => setBaudRate(parseInt(e.target.value, 10))}
                      className="bg-[#181f33] border border-[#27324c] text-white rounded px-2 py-0.5 text-xs"
                    >
                      <option value="57600">57600 bps</option>
                      <option value="115200">115200 bps</option>
                      <option value="250000">250000 bps</option>
                      <option value="500000">500000 bps</option>
                      <option value="1000000">1000000 bps</option>
                    </select>
                  </div>
                </div>

                {/* Packet stream table */}
                <div className="bg-[#0c0f17] p-3 rounded-lg border border-[#27324c] max-h-48 overflow-y-auto flex flex-col gap-1 text-[11px]">
                  {recentPackets.map((pkt) => (
                    <div key={pkt.id} className="flex items-center gap-3">
                      <span className="text-slate-500 text-[10px]">[{pkt.time}]</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                          pkt.dir === 'tx'
                            ? 'bg-cyan-950 text-cyan-400 border border-cyan-800'
                            : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        }`}
                      >
                        {pkt.dir.toUpperCase()}
                      </span>
                      <span className="text-slate-400 font-mono text-[10px]">{pkt.hex}</span>
                      <span className="text-white truncate">"{pkt.text}"</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'mcu' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                <div className="bg-[#111625] p-3 rounded-xl border border-[#27324c]">
                  <div className="text-[10px] text-slate-400">Core Clock</div>
                  <div className="text-base font-bold text-white mt-0.5">16.00 MHz</div>
                  <div className="text-[10px] text-slate-500">62.5ns tick cycle</div>
                </div>

                <div className="bg-[#111625] p-3 rounded-xl border border-[#27324c]">
                  <div className="text-[10px] text-slate-400">SRAM Heap/Stack</div>
                  <div className="text-base font-bold text-emerald-400 mt-0.5">342 / 2048 B</div>
                  <div className="text-[10px] text-slate-500">1706 Bytes Free</div>
                </div>

                <div className="bg-[#111625] p-3 rounded-xl border border-[#27324c]">
                  <div className="text-[10px] text-slate-400">Supply Rail VCC</div>
                  <div className="text-base font-bold text-cyan-400 mt-0.5">4.98 V DC</div>
                  <div className="text-[10px] text-slate-500">USB regulated rail</div>
                </div>

                <div className="bg-[#111625] p-3 rounded-xl border border-[#27324c]">
                  <div className="text-[10px] text-slate-400">Current Load</div>
                  <div className="text-base font-bold text-amber-400 mt-0.5">142 mA</div>
                  <div className="text-[10px] text-slate-500">500mA USB limit</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
