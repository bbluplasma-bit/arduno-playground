import React, { useState } from 'react';
import { ElectronicComponent } from '../types';
import { ELECTRONIC_COMPONENTS } from '../data/defaultProjects';
import { arduinoSerial } from '../services/arduinoSerial';
import {
  Cpu,
  Zap,
  Volume2,
  Sliders,
  Sun,
  Radio,
  Cog,
  CheckCircle2,
  Copy,
  Play,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react';

export const ElectronicsPlayground: React.FC = () => {
  const [selectedCompId, setSelectedCompId] = useState<string>(ELECTRONIC_COMPONENTS[0].id);
  const [simulatedLedOn, setSimulatedLedOn] = useState<boolean>(false);
  const [potentiometerAngle, setPotentiometerAngle] = useState<number>(90);
  const [ldrLux, setLdrLux] = useState<number>(650);
  const [ultrasonicDistance, setUltrasonicDistance] = useState<number>(24);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const activeComp =
    ELECTRONIC_COMPONENTS.find((c) => c.id === selectedCompId) || ELECTRONIC_COMPONENTS[0];

  const handleTestHardware = async (compId: string) => {
    if (arduinoSerial.status !== 'connected') {
      alert('Connect your Arduino (Physical or Virtual) first to send hardware signals.');
      return;
    }

    if (compId === 'comp_led') {
      const next = !simulatedLedOn;
      setSimulatedLedOn(next);
      await arduinoSerial.setDigitalPin(13, next ? 1 : 0);
    } else if (compId === 'comp_sg90_servo') {
      await arduinoSerial.setServoAngle(9, potentiometerAngle);
    } else if (compId === 'comp_buzzer') {
      // Send quick PWM burst
      await arduinoSerial.setPwmPin(8, 128);
      setTimeout(() => arduinoSerial.setPwmPin(8, 0), 200);
    } else if (compId === 'comp_potentiometer' || compId === 'comp_ldr') {
      await arduinoSerial.pollAnalogPin(0);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(activeComp.exampleCode);
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
              <Zap className="w-5 h-5 text-amber-400" />
              Electronics Playground & Schematic Guide
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Interactive breadboard component library, wiring diagrams, pin assignment rules, and live actuation tests
            </p>
          </div>
        </div>

        {/* 2-Column Layout: Component List + Detail Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Component Catalog */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Hardware Component Library
            </span>
            {ELECTRONIC_COMPONENTS.map((comp) => {
              const isSelected = comp.id === selectedCompId;
              return (
                <div
                  key={comp.id}
                  onClick={() => setSelectedCompId(comp.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-amber-950/30 border-amber-500 shadow-md shadow-amber-950/40'
                      : 'bg-[#111625] border-[#27324c] hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        isSelected ? 'bg-amber-500/20 text-amber-400' : 'bg-[#181f33] text-slate-400'
                      }`}
                    >
                      {comp.iconName === 'Cog' && <Cog className="w-4 h-4" />}
                      {comp.iconName === 'Zap' && <Zap className="w-4 h-4" />}
                      {comp.iconName === 'Radio' && <Radio className="w-4 h-4" />}
                      {comp.iconName === 'Sliders' && <Sliders className="w-4 h-4" />}
                      {comp.iconName === 'Volume2' && <Volume2 className="w-4 h-4" />}
                      {comp.iconName === 'Sun' && <Sun className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="font-semibold text-xs text-white">{comp.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono capitalize">
                        {comp.category} • {comp.workingVoltage}
                      </div>
                    </div>
                  </div>

                  <ArrowRight
                    className={`w-4 h-4 ${isSelected ? 'text-amber-400' : 'text-slate-600'}`}
                  />
                </div>
              );
            })}
          </div>

          {/* Right Column: Detailed Schematic, Wiring & Live Simulator */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            {/* Component Summary Card */}
            <div className="bg-[#111625] border border-[#27324c] rounded-xl p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#27324c]">
                <div>
                  <h2 className="text-base font-bold text-white">{activeComp.name}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">{activeComp.description}</p>
                </div>
                <button
                  onClick={() => handleTestHardware(activeComp.id)}
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-amber-950/50"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Live Pin Trigger
                </button>
              </div>

              {/* Pin Assignment Table */}
              <div>
                <span className="text-xs font-semibold text-slate-300 mb-2 block">
                  Hardware Pin Assignments & Electrical Specs
                </span>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-[#27324c] rounded-lg overflow-hidden">
                    <thead className="bg-[#141b2d] text-slate-400 font-mono text-[11px]">
                      <tr>
                        <th className="p-2.5">Component Terminal</th>
                        <th className="p-2.5">Signal Type</th>
                        <th className="p-2.5">Recommended Arduino Pin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#27324c] font-mono text-[11px]">
                      {activeComp.pins.map((pin, idx) => (
                        <tr key={idx} className="bg-[#181f33]/40">
                          <td className="p-2.5 text-white font-sans">{pin.name}</td>
                          <td className="p-2.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] uppercase ${
                                pin.type === 'power'
                                  ? 'bg-rose-950 text-rose-400'
                                  : pin.type === 'ground'
                                  ? 'bg-slate-800 text-slate-300'
                                  : pin.type === 'pwm'
                                  ? 'bg-purple-950 text-purple-400'
                                  : 'bg-cyan-950 text-cyan-400'
                              }`}
                            >
                              {pin.type}
                            </span>
                          </td>
                          <td className="p-2.5 text-cyan-300">{pin.recommendedPin}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Step-by-Step Wiring Instructions */}
              <div>
                <span className="text-xs font-semibold text-slate-300 mb-2 block">
                  Wiring Instructions
                </span>
                <div className="flex flex-col gap-2">
                  {activeComp.wiringInstructions.map((instruction, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 text-xs text-slate-300 bg-[#181f33] p-2.5 rounded-lg border border-[#27324c]/60"
                    >
                      <span className="w-5 h-5 rounded-full bg-cyan-950 text-cyan-400 flex items-center justify-center font-mono font-bold text-[10px] shrink-0 border border-cyan-800">
                        {idx + 1}
                      </span>
                      <span className="leading-relaxed">{instruction}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Interactive Virtual Component Tester */}
              <div className="bg-[#141b2d] p-4 rounded-xl border border-[#27324c] flex flex-col gap-3">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  Live Simulator & Hardware Loopback
                </span>

                {activeComp.id === 'comp_led' && (
                  <div className="flex items-center justify-between p-3 bg-[#181f33] rounded-lg">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-6 h-6 rounded-full border-2 transition-all ${
                          simulatedLedOn
                            ? 'bg-amber-400 border-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.8)]'
                            : 'bg-slate-800 border-slate-700'
                        }`}
                      />
                      <span className="text-xs text-slate-200">LED Anode Pin 13 State</span>
                    </div>
                    <button
                      onClick={() => handleTestHardware('comp_led')}
                      className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                        simulatedLedOn ? 'bg-amber-500 text-slate-950' : 'bg-[#111625] text-slate-300 border border-[#27324c]'
                      }`}
                    >
                      {simulatedLedOn ? 'HIGH' : 'LOW'}
                    </button>
                  </div>
                )}

                {activeComp.id === 'comp_potentiometer' && (
                  <div className="flex flex-col gap-2 p-3 bg-[#181f33] rounded-lg">
                    <div className="flex items-center justify-between text-xs">
                      <span>Rotary Wiper Angle:</span>
                      <span className="font-mono text-cyan-400 font-bold">{potentiometerAngle}°</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="180"
                      value={potentiometerAngle}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setPotentiometerAngle(val);
                        arduinoSerial.setServoAngle(9, val);
                      }}
                      className="accent-cyan-500 cursor-pointer"
                    />
                  </div>
                )}

                {activeComp.id === 'comp_ultrasonic' && (
                  <div className="flex flex-col gap-2 p-3 bg-[#181f33] rounded-lg">
                    <div className="flex items-center justify-between text-xs">
                      <span>Simulated Target Distance:</span>
                      <span className="font-mono text-emerald-400 font-bold">{ultrasonicDistance} cm</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="200"
                      value={ultrasonicDistance}
                      onChange={(e) => setUltrasonicDistance(parseInt(e.target.value, 10))}
                      className="accent-emerald-500 cursor-pointer"
                    />
                  </div>
                )}

                {activeComp.id === 'comp_sg90_servo' && (
                  <div className="flex flex-col gap-2 p-3 bg-[#181f33] rounded-lg">
                    <div className="flex items-center justify-between text-xs">
                      <span>Servo Sweep Target:</span>
                      <span className="font-mono text-purple-400 font-bold">{potentiometerAngle}°</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="180"
                      value={potentiometerAngle}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setPotentiometerAngle(val);
                        arduinoSerial.setServoAngle(9, val);
                      }}
                      className="accent-purple-500 cursor-pointer"
                    />
                  </div>
                )}

                {activeComp.id === 'comp_ldr' && (
                  <div className="flex flex-col gap-2 p-3 bg-[#181f33] rounded-lg">
                    <div className="flex items-center justify-between text-xs">
                      <span>Ambient Light Level:</span>
                      <span className="font-mono text-amber-400 font-bold">{ldrLux} Lux</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="1023"
                      value={ldrLux}
                      onChange={(e) => setLdrLux(parseInt(e.target.value, 10))}
                      className="accent-amber-500 cursor-pointer"
                    />
                  </div>
                )}

                {activeComp.id === 'comp_buzzer' && (
                  <div className="flex items-center justify-between p-3 bg-[#181f33] rounded-lg">
                    <span className="text-xs text-slate-300">Piezo Acoustic Tone Test</span>
                    <button
                      onClick={() => handleTestHardware('comp_buzzer')}
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-semibold"
                    >
                      Play 1kHz Chirp
                    </button>
                  </div>
                )}
              </div>

              {/* Ready-to-Upload Arduino C++ Example Code */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">
                    Standalone Arduino (.ino) Sketch
                  </span>
                  <button
                    onClick={handleCopyCode}
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    {copiedCode ? 'Copied!' : 'Copy Code'}
                  </button>
                </div>
                <pre className="p-3 bg-[#090c12] border border-[#27324c] rounded-lg text-xs font-mono text-cyan-300 overflow-x-auto">
                  {activeComp.exampleCode}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
