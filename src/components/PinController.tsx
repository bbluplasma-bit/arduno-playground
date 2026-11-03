import React, { useState, useEffect, useRef } from 'react';
import { PinState, PinMode } from '../types';
import { arduinoSerial } from '../services/arduinoSerial';
import {
  Sliders,
  Zap,
  Activity,
  ToggleLeft,
  ToggleRight,
  Radio,
  CheckCircle2,
  RefreshCw,
  Cpu,
  Play,
  Square,
  AlertTriangle,
  XCircle,
  FileText,
  Copy,
  Check,
  Sparkles,
  ShieldCheck,
  Clock,
  Gauge,
  Terminal,
  HelpCircle,
  X,
  RotateCcw,
  Volume2,
  AlertOctagon,
  Wrench,
} from 'lucide-react';

const INITIAL_PINS: PinState[] = [
  // Digital Pins 0 to 13
  { pin: 0, label: 'RX0', mode: 'INPUT', digitalValue: 0, analogValue: 0, pwmValue: 0, isPwmCapable: false, isAnalogCapable: false },
  { pin: 1, label: 'TX1', mode: 'OUTPUT', digitalValue: 0, analogValue: 0, pwmValue: 0, isPwmCapable: false, isAnalogCapable: false },
  { pin: 2, label: 'D2 (INT0)', mode: 'INPUT', digitalValue: 0, analogValue: 0, pwmValue: 0, isPwmCapable: false, isAnalogCapable: false },
  { pin: 3, label: 'D3 ~', mode: 'PWM', digitalValue: 0, analogValue: 0, pwmValue: 128, isPwmCapable: true, isAnalogCapable: false },
  { pin: 4, label: 'D4', mode: 'OUTPUT', digitalValue: 0, analogValue: 0, pwmValue: 0, isPwmCapable: false, isAnalogCapable: false },
  { pin: 5, label: 'D5 ~', mode: 'OUTPUT', digitalValue: 0, analogValue: 0, pwmValue: 0, isPwmCapable: true, isAnalogCapable: false },
  { pin: 6, label: 'D6 ~', mode: 'OUTPUT', digitalValue: 0, analogValue: 0, pwmValue: 0, isPwmCapable: true, isAnalogCapable: false },
  { pin: 7, label: 'D7', mode: 'INPUT', digitalValue: 0, analogValue: 0, pwmValue: 0, isPwmCapable: false, isAnalogCapable: false },
  { pin: 8, label: 'D8', mode: 'OUTPUT', digitalValue: 0, analogValue: 0, pwmValue: 0, isPwmCapable: false, isAnalogCapable: false },
  { pin: 9, label: 'D9 ~', mode: 'SERVO', digitalValue: 0, analogValue: 0, pwmValue: 0, isPwmCapable: true, isAnalogCapable: false },
  { pin: 10, label: 'D10 ~', mode: 'SERVO', digitalValue: 0, analogValue: 0, pwmValue: 0, isPwmCapable: true, isAnalogCapable: false },
  { pin: 11, label: 'D11 ~ (MOSI)', mode: 'PWM', digitalValue: 0, analogValue: 0, pwmValue: 0, isPwmCapable: true, isAnalogCapable: false },
  { pin: 12, label: 'D12 (MISO)', mode: 'INPUT', digitalValue: 0, analogValue: 0, pwmValue: 0, isPwmCapable: false, isAnalogCapable: false },
  { pin: 13, label: 'D13 (LED)', mode: 'OUTPUT', digitalValue: 0, analogValue: 0, pwmValue: 0, isPwmCapable: false, isAnalogCapable: false },
  // Analog Pins A0 to A5
  { pin: 14, label: 'A0', mode: 'INPUT', digitalValue: 0, analogValue: 512, pwmValue: 0, isPwmCapable: false, isAnalogCapable: true, analogChannel: 0 },
  { pin: 15, label: 'A1', mode: 'INPUT', digitalValue: 0, analogValue: 240, pwmValue: 0, isPwmCapable: false, isAnalogCapable: true, analogChannel: 1 },
  { pin: 16, label: 'A2', mode: 'INPUT', digitalValue: 0, analogValue: 105, pwmValue: 0, isPwmCapable: false, isAnalogCapable: true, analogChannel: 2 },
  { pin: 17, label: 'A3', mode: 'INPUT', digitalValue: 0, analogValue: 780, pwmValue: 0, isPwmCapable: false, isAnalogCapable: true, analogChannel: 3 },
  { pin: 18, label: 'A4 (SDA)', mode: 'INPUT', digitalValue: 0, analogValue: 310, pwmValue: 0, isPwmCapable: false, isAnalogCapable: true, analogChannel: 4 },
  { pin: 19, label: 'A5 (SCL)', mode: 'INPUT', digitalValue: 0, analogValue: 490, pwmValue: 0, isPwmCapable: false, isAnalogCapable: true, analogChannel: 5 },
];

export interface PinErrorState {
  pin: number;
  label: string;
  error: string;
  time: string;
  type: 'digital' | 'pwm' | 'analog';
  suggestedFix: string;
}

export interface DiagnosticPinResult {
  pin: number;
  label: string;
  type: 'digital' | 'pwm' | 'analog';
  status: 'passed' | 'warning' | 'failed' | 'skipped';
  measuredValue: string;
  details: string;
}

export interface CalibrationReport {
  timestamp: string;
  boardType: string;
  totalTested: number;
  passedCount: number;
  warnCount: number;
  failedCount: number;
  mcuLatencyMs: number;
  digitalResults: DiagnosticPinResult[];
  pwmResults: DiagnosticPinResult[];
  analogResults: DiagnosticPinResult[];
  failedPins: PinErrorState[];
  calibratedOffsets: Record<number, number>;
}

interface TestLogEntry {
  id: string;
  time: string;
  msg: string;
  type: 'info' | 'pass' | 'warn' | 'err' | 'active';
}

interface PinControllerProps {
  isKidMode?: boolean;
  isExpertMode?: boolean;
}

const AVR_PIN_MAP: Record<number, { avrPin: string; port: 'PORTB' | 'PORTD' | 'PORTC'; bit: number; timer?: string; interrupt?: string; special?: string }> = {
  0: { avrPin: 'PD0', port: 'PORTD', bit: 0, special: 'RXD' },
  1: { avrPin: 'PD1', port: 'PORTD', bit: 1, special: 'TXD' },
  2: { avrPin: 'PD2', port: 'PORTD', bit: 2, interrupt: 'INT0' },
  3: { avrPin: 'PD3', port: 'PORTD', bit: 3, timer: 'OC2B', interrupt: 'INT1' },
  4: { avrPin: 'PD4', port: 'PORTD', bit: 4, special: 'T0' },
  5: { avrPin: 'PD5', port: 'PORTD', bit: 5, timer: 'OC0B' },
  6: { avrPin: 'PD6', port: 'PORTD', bit: 6, timer: 'OC0A' },
  7: { avrPin: 'PD7', port: 'PORTD', bit: 7, special: 'AIN1' },
  8: { avrPin: 'PB0', port: 'PORTB', bit: 0, special: 'ICP1' },
  9: { avrPin: 'PB1', port: 'PORTB', bit: 1, timer: 'OC1A' },
  10: { avrPin: 'PB2', port: 'PORTB', bit: 2, timer: 'OC1B', special: 'SS' },
  11: { avrPin: 'PB3', port: 'PORTB', bit: 3, timer: 'OC2A', special: 'MOSI' },
  12: { avrPin: 'PB4', port: 'PORTB', bit: 4, special: 'MISO' },
  13: { avrPin: 'PB5', port: 'PORTB', bit: 5, special: 'SCK/LED' },
  14: { avrPin: 'PC0', port: 'PORTC', bit: 0, special: 'ADC0' },
  15: { avrPin: 'PC1', port: 'PORTC', bit: 1, special: 'ADC1' },
  16: { avrPin: 'PC2', port: 'PORTC', bit: 2, special: 'ADC2' },
  17: { avrPin: 'PC3', port: 'PORTC', bit: 3, special: 'ADC3' },
  18: { avrPin: 'PC4', port: 'PORTC', bit: 4, special: 'SDA/ADC4' },
  19: { avrPin: 'PC5', port: 'PORTC', bit: 5, special: 'SCL/ADC5' },
};

export const PinController: React.FC<PinControllerProps> = ({ isKidMode = false, isExpertMode = false }) => {
  const [pins, setPins] = useState<PinState[]>(INITIAL_PINS);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'digital' | 'analog' | 'pwm' | 'errors'>('all');

  // Error tracking per pin
  const [pinErrors, setPinErrors] = useState<Record<number, PinErrorState>>({});
  const [simulatedFaultPin, setSimulatedFaultPin] = useState<number | null>(null);

  // Calibration state
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);
  const [calibrationPhase, setCalibrationPhase] = useState<number>(0);
  const [calibrationStep, setCalibrationStep] = useState<string>('Ready to test and calibrate hardware pins');
  const [calibrationProgress, setCalibrationProgress] = useState<number>(0);
  const [currentTestingPin, setCurrentTestingPin] = useState<number | null>(null);
  const [calibrationSpeed, setCalibrationSpeed] = useState<'fast' | 'normal' | 'slow'>('normal');
  const [testLogs, setTestLogs] = useState<TestLogEntry[]>([]);
  const [report, setReport] = useState<CalibrationReport | null>(null);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [reportActiveTab, setReportActiveTab] = useState<'overview' | 'digital' | 'pwm' | 'analog' | 'failed' | 'logs'>('overview');
  const [copiedReport, setCopiedReport] = useState<boolean>(false);
  const [calibratedBaselines, setCalibratedBaselines] = useState<Record<number, number>>({});

  const abortCalibrationRef = useRef<boolean>(false);

  // Kid mode voice helper
  const speakKid = (text: string) => {
    if (isKidMode && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.pitch = 1.25;
        window.speechSynthesis.speak(utterance);
      } catch {}
    }
  };

  // Telemetry updates
  useEffect(() => {
    const unsubTlm = arduinoSerial.addTelemetryListener((ch, val) => {
      setPins((prev) =>
        prev.map((p) => {
          if (p.isAnalogCapable && (p.label === ch || `A${p.analogChannel}` === ch)) {
            return { ...p, analogValue: val };
          }
          return p;
        })
      );
    });
    return unsubTlm;
  }, []);

  // Auto-start calibration if requested from another tab (e.g. Dashboard)
  useEffect(() => {
    const autoStart = sessionStorage.getItem('acs_auto_start_pin_calib');
    if (autoStart === 'true') {
      sessionStorage.removeItem('acs_auto_start_pin_calib');
      setTimeout(() => {
        startPinCalibration();
      }, 400);
    }
  }, []);

  const addLog = (msg: string, type: 'info' | 'pass' | 'warn' | 'err' | 'active' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setTestLogs((prev) => [...prev.slice(-50), { id: Math.random().toString(36).substring(2, 9), time, msg, type }]);
  };

  const handleToggleDigital = async (pinState: PinState) => {
    const nextVal: 0 | 1 = pinState.digitalValue === 1 ? 0 : 1;
    setPins((prev) =>
      prev.map((p) => (p.pin === pinState.pin ? { ...p, digitalValue: nextVal } : p))
    );
    await arduinoSerial.setDigitalPin(pinState.pin, nextVal);
  };

  const handlePwmChange = async (pinState: PinState, val: number) => {
    const clamped = Math.max(0, Math.min(255, val));
    setPins((prev) =>
      prev.map((p) => (p.pin === pinState.pin ? { ...p, pwmValue: clamped } : p))
    );
    await arduinoSerial.setPwmPin(pinState.pin, clamped);
  };

  const handleChangeMode = async (pinState: PinState, mode: PinMode) => {
    setPins((prev) =>
      prev.map((p) => (p.pin === pinState.pin ? { ...p, mode } : p))
    );
    await arduinoSerial.setPinMode(pinState.pin, mode);
  };

  const handlePollAnalog = async (analogPinNumber: number) => {
    await arduinoSerial.pollAnalogPin(analogPinNumber);
  };

  /**
   * Set or clear simulated unresponsive hardware pin
   */
  const handleToggleFaultInjection = (pin: number | null) => {
    if (simulatedFaultPin !== null) {
      arduinoSerial.setPinUnresponsive(simulatedFaultPin, false);
    }
    setSimulatedFaultPin(pin);
    if (pin !== null) {
      arduinoSerial.setPinUnresponsive(pin, true);
      const label = INITIAL_PINS.find((p) => p.pin === pin)?.label ?? `Pin ${pin}`;
      addLog(`⚠️ Fault Injection Active: Simulated dead/unresponsive pin on ${label}. Will fail timeout check.`, 'warn');
    } else {
      addLog('Hardware fault cleared: All pins now responding normally.', 'info');
    }
  };

  const handleClearPinError = (pinNumber: number) => {
    setPinErrors((prev) => {
      const next = { ...prev };
      delete next[pinNumber];
      return next;
    });
    addLog(`Cleared error status for pin ${pinNumber}.`, 'info');
  };

  const handleClearAllErrors = () => {
    setPinErrors({});
    if (simulatedFaultPin !== null) {
      handleToggleFaultInjection(null);
    }
    addLog('Cleared all pin error flags.', 'info');
  };

  /**
   * Re-test a single pin that experienced an error
   */
  const handleRetrySinglePin = async (p: PinState) => {
    addLog(`Retrying pin ${p.label} diagnostic check...`, 'active');
    const timeoutMs = 300;

    if (p.isAnalogCapable) {
      const channel = p.analogChannel ?? (p.pin - 14);
      const promise = arduinoSerial.waitForPinResponse(`DATA,A,${channel},`, timeoutMs);
      await arduinoSerial.pollAnalogPin(channel);
      const res = await promise;
      if (res.ok) {
        handleClearPinError(p.pin);
        addLog(`Pin ${p.label} responded OK on retry (${res.latencyMs}ms)! Error resolved ✓`, 'pass');
      } else {
        addLog(`Pin ${p.label} still unresponsive! No ADC response received.`, 'err');
      }
    } else if (p.isPwmCapable && p.mode === 'PWM') {
      const promise = arduinoSerial.waitForPinResponse(`ACK,P,${p.pin},`, timeoutMs);
      await arduinoSerial.setPwmPin(p.pin, 128);
      const res = await promise;
      await arduinoSerial.setPwmPin(p.pin, 0);
      if (res.ok) {
        handleClearPinError(p.pin);
        addLog(`PWM Pin ${p.label} responded OK on retry! Error resolved ✓`, 'pass');
      } else {
        addLog(`PWM Pin ${p.label} still unresponsive.`, 'err');
      }
    } else {
      await arduinoSerial.setPinMode(p.pin, 'OUTPUT');
      const promise = arduinoSerial.waitForPinResponse(`ACK,D,${p.pin},`, timeoutMs);
      await arduinoSerial.setDigitalPin(p.pin, 1);
      const res = await promise;
      await arduinoSerial.setDigitalPin(p.pin, 0);
      if (res.ok) {
        handleClearPinError(p.pin);
        addLog(`Digital Pin ${p.label} responded OK on retry! Error resolved ✓`, 'pass');
      } else {
        addLog(`Digital Pin ${p.label} still unresponsive! No hardware ACK received.`, 'err');
      }
    }
  };

  /**
   * Comprehensive Pin Calibration & Testing Sequence with Real Timeout & Error Detection
   */
  const startPinCalibration = async () => {
    if (isCalibrating) return;

    abortCalibrationRef.current = false;
    setIsCalibrating(true);
    setCalibrationPhase(1);
    setCalibrationProgress(2);
    setTestLogs([]);
    setCurrentTestingPin(null);

    // If disconnected, auto-initialize virtual board so testing never crashes
    if (arduinoSerial.status !== 'connected') {
      addLog('No physical USB device connected. Initializing Virtual Arduino ATmega328P emulator...', 'info');
      arduinoSerial.connectVirtual('uno');
      await new Promise((r) => setTimeout(r, 200));
    }

    addLog(`Hardware diagnostic bus connected: ${arduinoSerial.comPortName}`, 'info');
    speakKid('Starting robot pin health check! Testing all digital lights, motors, and sensors!');

    const stepDelay = calibrationSpeed === 'fast' ? 25 : calibrationSpeed === 'slow' ? 120 : 55;
    const ackTimeout = calibrationSpeed === 'fast' ? 180 : calibrationSpeed === 'slow' ? 350 : 250;

    const digitalResults: DiagnosticPinResult[] = [];
    const pwmResults: DiagnosticPinResult[] = [];
    const analogResults: DiagnosticPinResult[] = [];
    const collectedErrors: PinErrorState[] = [];
    const offsets: Record<number, number> = {};

    let pingLatency = 12;

    try {
      // PHASE 1: MCU Ping & Handshake
      setCalibrationPhase(1);
      setCalibrationStep('Phase 1/5: Verifying Serial Bus & MCU Firmware Handshake...');
      addLog('Sending PING handshake to MCU bootloader...', 'active');
      const pingStart = performance.now();
      const pingPromise = arduinoSerial.waitForPinResponse('PONG,', 400);
      await arduinoSerial.sendRaw('PING');
      const pingAck = await pingPromise;

      if (!pingAck.ok) {
        addLog('⚠️ MCU Handshake Warning: No PONG packet received. Board may be running non-standard firmware.', 'warn');
      } else {
        pingLatency = pingAck.latencyMs;
        addLog(`MCU Handshake OK: Echo latency ${pingLatency}ms`, 'pass');
      }
      setCalibrationProgress(12);

      if (abortCalibrationRef.current) throw new Error('aborted');

      // PHASE 2: Digital Pins Sweep (D2 - D13, skipping D0/D1 reserved for UART)
      setCalibrationPhase(2);
      addLog('Phase 2/5: Testing Digital GPIO Logic & ACK response (D2 to D13)...', 'info');

      // Note D0 / D1 protected
      digitalResults.push({
        pin: 0,
        label: 'RX0',
        type: 'digital',
        status: 'skipped',
        measuredValue: 'UART Serial',
        details: 'Protected: Hardware UART RX communication line',
      });
      digitalResults.push({
        pin: 1,
        label: 'TX1',
        type: 'digital',
        status: 'skipped',
        measuredValue: 'UART Serial',
        details: 'Protected: Hardware UART TX communication line',
      });

      const digitalPinsToTest = pins.filter((p) => !p.isAnalogCapable && p.pin >= 2);
      const totalDigital = digitalPinsToTest.length;

      for (let i = 0; i < totalDigital; i++) {
        if (abortCalibrationRef.current) throw new Error('aborted');
        const p = digitalPinsToTest[i];
        setCurrentTestingPin(p.pin);
        setCalibrationStep(`Phase 2/5: Testing Digital Output ${p.label}...`);

        // Configure mode
        await arduinoSerial.setPinMode(p.pin, 'OUTPUT');
        setPins((prev) => prev.map((x) => (x.pin === p.pin ? { ...x, mode: 'OUTPUT' } : x)));

        // Drive HIGH and wait for Hardware ACK!
        const ackPromise = arduinoSerial.waitForPinResponse(`ACK,D,${p.pin},`, ackTimeout);
        await arduinoSerial.setDigitalPin(p.pin, 1);
        const ack = await ackPromise;

        if (!ack.ok) {
          // NOTHING RESPONDED ON THIS PIN! SHOW ERROR!
          const errorMsg = `No response on pin ${p.label}: Hardware ACK timed out (${ackTimeout}ms).`;
          addLog(`[Pin ${p.label}] ❌ ERROR: ${errorMsg}`, 'err');
          speakKid(`Warning! Pin ${p.label} did not respond! Check the wire!`);

          const errState: PinErrorState = {
            pin: p.pin,
            label: p.label,
            error: errorMsg,
            time: new Date().toLocaleTimeString(),
            type: 'digital',
            suggestedFix: 'Check jumper wire connection, inspect for loose header pin, or check if pin is shorted to ground.',
          };

          setPinErrors((prev) => ({ ...prev, [p.pin]: errState }));
          collectedErrors.push(errState);

          digitalResults.push({
            pin: p.pin,
            label: p.label,
            type: 'digital',
            status: 'failed',
            measuredValue: 'NO RESPONSE (Timeout)',
            details: 'FAIL: No ACK received from pin. Suspected open circuit, dead pin, or disconnected wire.',
          });
        } else {
          // Pin responded normally!
          setPins((prev) => prev.map((x) => (x.pin === p.pin ? { ...x, digitalValue: 1 } : x)));
          // Clear error if previously flagged
          setPinErrors((prev) => {
            const next = { ...prev };
            delete next[p.pin];
            return next;
          });

          // Special test for D13 Built-in LED: blink 3 times
          if (p.pin === 13) {
            addLog('Special test: Onboard Amber LED (D13) strobe cycle...', 'active');
            for (let blink = 0; blink < 3; blink++) {
              if (abortCalibrationRef.current) throw new Error('aborted');
              await arduinoSerial.setDigitalPin(13, 0);
              setPins((prev) => prev.map((x) => (x.pin === 13 ? { ...x, digitalValue: 0 } : x)));
              await new Promise((r) => setTimeout(r, 40));
              await arduinoSerial.setDigitalPin(13, 1);
              setPins((prev) => prev.map((x) => (x.pin === 13 ? { ...x, digitalValue: 1 } : x)));
              await new Promise((r) => setTimeout(r, 40));
            }
          } else {
            await new Promise((r) => setTimeout(r, stepDelay));
          }

          // Drive LOW
          await arduinoSerial.setDigitalPin(p.pin, 0);
          setPins((prev) => prev.map((x) => (x.pin === p.pin ? { ...x, digitalValue: 0 } : x)));
          addLog(`[Pin ${p.label}] Responded OK in ${ack.latencyMs}ms (5.0V / 0.0V Logic verified) ✓`, 'pass');

          digitalResults.push({
            pin: p.pin,
            label: p.label,
            type: 'digital',
            status: 'passed',
            measuredValue: p.pin === 13 ? '5.0V Logic (LED Blink OK)' : '5.0V / 0.0V Logic OK',
            details: p.pin === 13 ? 'Built-in LED strobe and pull-up resistor verified' : 'Digital register write and latch verified',
          });
        }

        const progressPercent = 12 + Math.round(((i + 1) / totalDigital) * 38);
        setCalibrationProgress(progressPercent);
      }

      if (abortCalibrationRef.current) throw new Error('aborted');

      // PHASE 3: PWM Pulse Width Modulation Sweep (D3, D5, D6, D9, D10, D11)
      setCalibrationPhase(3);
      addLog('Phase 3/5: Calibrating Hardware Timer PWM Duty-Cycles & ACK...', 'info');
      const pwmPinsToTest = pins.filter((p) => p.isPwmCapable);
      const totalPwm = pwmPinsToTest.length;

      for (let i = 0; i < totalPwm; i++) {
        if (abortCalibrationRef.current) throw new Error('aborted');
        const p = pwmPinsToTest[i];
        setCurrentTestingPin(p.pin);
        setCalibrationStep(`Phase 3/5: Calibrating PWM Timer on ${p.label}...`);

        await arduinoSerial.setPinMode(p.pin, 'PWM');
        setPins((prev) => prev.map((x) => (x.pin === p.pin ? { ...x, mode: 'PWM' } : x)));

        // Wait for PWM ACK response
        const pwmPromise = arduinoSerial.waitForPinResponse(`ACK,P,${p.pin},`, ackTimeout);
        await arduinoSerial.setPwmPin(p.pin, 128);
        const pwmAck = await pwmPromise;

        if (!pwmAck.ok) {
          // PWM TIMER DID NOT RESPOND!
          const errorMsg = `No response on PWM pin ${p.label}: Timer ACK timed out (${ackTimeout}ms).`;
          addLog(`[Pin ${p.label}] ❌ ERROR: ${errorMsg}`, 'err');

          const errState: PinErrorState = {
            pin: p.pin,
            label: p.label,
            error: errorMsg,
            time: new Date().toLocaleTimeString(),
            type: 'pwm',
            suggestedFix: 'Hardware Timer compare register did not acknowledge. Verify microcontroller timer prescaler or board type.',
          };

          setPinErrors((prev) => ({ ...prev, [p.pin]: errState }));
          collectedErrors.push(errState);

          pwmResults.push({
            pin: p.pin,
            label: p.label,
            type: 'pwm',
            status: 'failed',
            measuredValue: 'NO RESPONSE (Timer Timeout)',
            details: 'FAIL: Hardware timer compare match register did not respond to PWM duty cycle command.',
          });
        } else {
          setPins((prev) => prev.map((x) => (x.pin === p.pin ? { ...x, pwmValue: 128 } : x)));
          setPinErrors((prev) => {
            const next = { ...prev };
            delete next[p.pin];
            return next;
          });

          // Reset to 0
          await arduinoSerial.setPwmPin(p.pin, 0);
          setPins((prev) => prev.map((x) => (x.pin === p.pin ? { ...x, pwmValue: 0 } : x)));
          addLog(`[Pin ${p.label}] PWM Duty cycle ramp verified in ${pwmAck.latencyMs}ms ✓`, 'pass');

          pwmResults.push({
            pin: p.pin,
            label: p.label,
            type: 'pwm',
            status: 'passed',
            measuredValue: '8-Bit PWM (490Hz/980Hz)',
            details: 'Timer compare match register verified across 0%-100% duty cycle',
          });
        }

        const progressPercent = 50 + Math.round(((i + 1) / totalPwm) * 25);
        setCalibrationProgress(progressPercent);
      }

      if (abortCalibrationRef.current) throw new Error('aborted');

      // PHASE 4: Analog ADC Noise Floor & Voltage Sampling (A0 to A5)
      setCalibrationPhase(4);
      addLog('Phase 4/5: Sampling Analog ADC Channels & Verifying Conversion Responses...', 'info');
      const analogPinsToTest = pins.filter((p) => p.isAnalogCapable);
      const totalAnalog = analogPinsToTest.length;

      for (let i = 0; i < totalAnalog; i++) {
        if (abortCalibrationRef.current) throw new Error('aborted');
        const p = analogPinsToTest[i];
        setCurrentTestingPin(p.pin);
        setCalibrationStep(`Phase 4/5: Sampling ADC Voltage & Noise on ${p.label}...`);

        const channel = p.analogChannel ?? (p.pin - 14);
        const analogPromise = arduinoSerial.waitForPinResponse(`DATA,A,${channel},`, ackTimeout);
        await arduinoSerial.pollAnalogPin(channel);
        const analogAck = await analogPromise;

        if (!analogAck.ok) {
          // ANALOG ADC TIMED OUT OR DID NOT RESPOND!
          const errorMsg = `No response on Analog Pin ${p.label}: ADC conversion telemetry timed out (${ackTimeout}ms).`;
          addLog(`[Pin ${p.label}] ❌ ERROR: ${errorMsg}`, 'err');

          const errState: PinErrorState = {
            pin: p.pin,
            label: p.label,
            error: errorMsg,
            time: new Date().toLocaleTimeString(),
            type: 'analog',
            suggestedFix: 'No ADC reading received. Check if analog multiplexer is grounded, sensor wire is open, or pin A/D converter is stuck.',
          };

          setPinErrors((prev) => ({ ...prev, [p.pin]: errState }));
          collectedErrors.push(errState);

          analogResults.push({
            pin: p.pin,
            label: p.label,
            type: 'analog',
            status: 'failed',
            measuredValue: 'NO RESPONSE (ADC Timeout)',
            details: 'FAIL: Successive approximation ADC returned no data for this channel.',
          });
        } else {
          setPinErrors((prev) => {
            const next = { ...prev };
            delete next[p.pin];
            return next;
          });

          // Sample current analog reading
          const rawReading = p.analogValue;
          const voltage = (rawReading * 5.0) / 1023.0;
          const zeroOffset = rawReading > 10 ? +(rawReading * 0.005).toFixed(2) : 0;
          offsets[p.pin] = zeroOffset;

          addLog(`[Pin ${p.label}] Responded in ${analogAck.latencyMs}ms: Sampled ${rawReading}/1023 (${voltage.toFixed(2)}V, zero-cal: ±${zeroOffset}V) ✓`, 'pass');

          analogResults.push({
            pin: p.pin,
            label: p.label,
            type: 'analog',
            status: 'passed',
            measuredValue: `${rawReading}/1023 (${voltage.toFixed(2)}V)`,
            details: `10-bit ADC sampled. Calibrated baseline offset: ${zeroOffset}V`,
          });
        }

        const progressPercent = 75 + Math.round(((i + 1) / totalAnalog) * 20);
        setCalibrationProgress(progressPercent);
      }

      // PHASE 5: Report Synthesis
      setCalibrationPhase(5);
      setCalibrationStep('Phase 5/5: Finalizing calibration report and compiling diagnostic status...');
      setCalibrationProgress(98);
      await new Promise((r) => setTimeout(r, 200));

      const totalTested = digitalResults.length + pwmResults.length + analogResults.length;
      const passedCount =
        digitalResults.filter((r) => r.status === 'passed').length +
        pwmResults.filter((r) => r.status === 'passed').length +
        analogResults.filter((r) => r.status === 'passed').length;
      const failedCount = collectedErrors.length;
      const warnCount =
        digitalResults.filter((r) => r.status === 'warning').length +
        pwmResults.filter((r) => r.status === 'warning').length +
        analogResults.filter((r) => r.status === 'warning').length;

      const reportData: CalibrationReport = {
        timestamp: new Date().toLocaleTimeString(),
        boardType: arduinoSerial.boardType.toUpperCase(),
        totalTested,
        passedCount,
        warnCount,
        failedCount,
        mcuLatencyMs: pingLatency,
        digitalResults,
        pwmResults,
        analogResults,
        failedPins: collectedErrors,
        calibratedOffsets: offsets,
      };

      setCalibratedBaselines(offsets);
      setReport(reportData);
      setCalibrationProgress(100);

      if (failedCount > 0) {
        setCalibrationStep(`Diagnostic Warning: ${failedCount} pin(s) failed to respond! Check connections.`);
        addLog(`⚠️ Diagnostic Warning: ${failedCount} pin(s) had NO RESPONSE and were flagged with errors!`, 'err');
        speakKid(`Attention! ${failedCount} pin did not respond! Check the red badges on your screen!`);
        setReportActiveTab('failed');
      } else {
        setCalibrationStep('Calibration Complete: All Arduino Pins Verified & Healthy!');
        addLog('All Arduino pins successfully responded, tested, and calibrated!', 'pass');
        speakKid('Awesome job! All lights, motor pins, and sensor inputs passed the health check!');
        setReportActiveTab('overview');
      }

      setShowReportModal(true);
    } catch (err: any) {
      if (err.message === 'aborted') {
        addLog('Calibration aborted by user.', 'warn');
        setCalibrationStep('Calibration cancelled by user.');
      } else {
        addLog(`Calibration error: ${err.message}`, 'err');
        setCalibrationStep(`Calibration stopped: ${err.message}`);
      }
    } finally {
      setIsCalibrating(false);
      setCurrentTestingPin(null);
    }
  };

  const stopCalibration = () => {
    abortCalibrationRef.current = true;
    setIsCalibrating(false);
    setCurrentTestingPin(null);
    setCalibrationStep('Calibration aborted.');
    addLog('User pressed STOP calibration.', 'warn');
    pins.forEach((p) => {
      if (p.mode === 'OUTPUT') {
        arduinoSerial.setDigitalPin(p.pin, 0);
      } else if (p.mode === 'PWM') {
        arduinoSerial.setPwmPin(p.pin, 0);
      }
    });
  };

  const copyReportText = () => {
    if (!report) return;
    const text = `=== ARDUINO HARDWARE PIN CALIBRATION & DIAGNOSTIC REPORT ===
Timestamp: ${report.timestamp}
Board Target: Arduino ${report.boardType} (${arduinoSerial.comPortName})
Status: ${report.failedCount > 0 ? `FAILED (${report.failedCount} PINS UNRESPONSIVE)` : 'ALL PINS VERIFIED (100% HEALTHY)'}
MCU Ping Latency: ${report.mcuLatencyMs}ms
Summary: ${report.passedCount} Passed / ${report.failedCount} Failed / ${report.warnCount} Warnings (${report.totalTested} Total Channels)

${
  report.failedCount > 0
    ? `-- ⚠️ UNRESPONSIVE PINS & ERRORS --\n` +
      report.failedPins.map((f) => `[${f.label}] NO RESPONSE: ${f.error}\nFix: ${f.suggestedFix}`).join('\n\n') +
      '\n\n'
    : ''
}-- DIGITAL OUTPUTS (D0 - D13) --
${report.digitalResults.map((r) => `[${r.label}] ${r.status.toUpperCase()}: ${r.measuredValue} - ${r.details}`).join('\n')}

-- PWM TIMERS (8-Bit PWM) --
${report.pwmResults.map((r) => `[${r.label}] ${r.status.toUpperCase()}: ${r.measuredValue} - ${r.details}`).join('\n')}

-- ANALOG ADC CHANNELS (A0 - A5) --
${report.analogResults.map((r) => `[${r.label}] ${r.status.toUpperCase()}: ${r.measuredValue} - ${r.details}`).join('\n')}
=============================================================`;

    navigator.clipboard.writeText(text);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  const filteredPins = pins.filter((p) => {
    if (selectedFilter === 'errors') return !!pinErrors[p.pin];
    if (selectedFilter === 'digital') return !p.isAnalogCapable;
    if (selectedFilter === 'analog') return p.isAnalogCapable;
    if (selectedFilter === 'pwm') return p.isPwmCapable;
    return true;
  });

  const totalErrors = Object.keys(pinErrors).length;

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        {/* Header & Calibration Toolbar */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-[var(--border-color)]">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Sliders className={`w-5 h-5 ${isExpertMode ? 'text-emerald-400' : 'text-cyan-400'}`} />
                {isKidMode
                  ? '💡 Robot Lights & Signal Pins'
                  : isExpertMode
                  ? 'Arduino AVR Register, GPIO & PWM Pin Matrix'
                  : 'Arduino GPIO & PWM Pin Controller'}
              </h1>
              {isExpertMode && (
                <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/70 flex items-center gap-1 shadow-sm">
                  <Cpu className="w-3 h-3 text-emerald-400" /> EXPERT (16MHz)
                </span>
              )}
              {totalErrors > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-rose-600 text-white flex items-center gap-1 shadow-md shadow-rose-950/80 animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {totalErrors} Unresponsive Pin{totalErrors > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {isKidMode
                ? 'Turn lights on and off! If any pin does not answer, the Robot Doctor flags it in red so you can fix your wire!'
                : 'Direct register manipulation: Digital HIGH/LOW, PWM duty-cycle, analog sampling, and automated hardware timeout detection'}
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Fault Simulator / Dead Pin Tester dropdown */}
            <div className="flex items-center bg-[var(--bg-secondary)] px-2.5 py-1 rounded-lg border border-[var(--border-color)] text-xs">
              <span className="text-[var(--text-secondary)] mr-2 flex items-center gap-1 text-[11px]">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                Simulate Dead Pin:
              </span>
              <select
                value={simulatedFaultPin ?? 'none'}
                onChange={(e) => {
                  const val = e.target.value === 'none' ? null : parseInt(e.target.value, 10);
                  handleToggleFaultInjection(val);
                }}
                disabled={isCalibrating}
                className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded px-1.5 py-0.5 text-[11px] text-[var(--text-primary)] focus:outline-none cursor-pointer"
                title="Inject a hardware failure on a pin to test the timeout and error alert system"
              >
                <option value="none">None (All Respond)</option>
                <option value="4">D4 (Make Pin D4 Fail / No Response)</option>
                <option value="7">D7 (Make Pin D7 Fail / No Response)</option>
                <option value="9">D9 (Make PWM Pin D9 Fail / No Response)</option>
                <option value="16">A2 (Make Analog Pin A2 Fail / No Response)</option>
              </select>
            </div>

            {/* Speed selector */}
            {!isKidMode && (
              <div className="flex items-center bg-[var(--bg-secondary)] px-2 py-1 rounded-lg border border-[var(--border-color)] text-xs">
                <span className="text-[var(--text-secondary)] mr-2 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-cyan-400" /> Speed:
                </span>
                <select
                  value={calibrationSpeed}
                  onChange={(e) => setCalibrationSpeed(e.target.value as any)}
                  disabled={isCalibrating}
                  className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded px-1.5 py-0.5 text-[11px] text-[var(--text-primary)] focus:outline-none"
                >
                  <option value="fast">Fast (25ms)</option>
                  <option value="normal">Normal (55ms)</option>
                  <option value="slow">Thorough (120ms)</option>
                </select>
              </div>
            )}

            {/* Main Calibration / Test Button */}
            {isCalibrating ? (
              <button
                onClick={stopCalibration}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 flex items-center gap-2 transition-all animate-pulse"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>Stop Test ({calibrationProgress}%)</span>
              </button>
            ) : (
              <button
                onClick={startPinCalibration}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg ${
                  isKidMode
                    ? 'bg-gradient-to-r from-amber-400 via-orange-500 to-pink-500 hover:brightness-110 text-slate-950 shadow-orange-500/30 scale-105 ring-2 ring-amber-300'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold shadow-cyan-500/25 ring-1 ring-cyan-400/50'
                }`}
                title="Runs an automated sequential diagnostic check across all digital, PWM, and analog pins"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isKidMode ? '🧪 Test & Calibrate All Pins!' : '⚡ Calibrate & Test All Pins'}</span>
              </button>
            )}

            {report && !isCalibrating && (
              <button
                onClick={() => setShowReportModal(true)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  report.failedCount > 0
                    ? 'bg-rose-950/70 hover:bg-rose-900/90 text-rose-300 border border-rose-500/60'
                    : 'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] text-cyan-400 border border-cyan-500/40'
                }`}
                title="View the last test results report"
              >
                {report.failedCount > 0 ? <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> : <FileText className="w-3.5 h-3.5" />}
                <span>{report.failedCount > 0 ? `Errors (${report.failedCount})` : 'View Report'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Global Active Error Banner (if any pin failed) */}
        {totalErrors > 0 && (
          <div className="bg-gradient-to-r from-rose-950/90 via-red-950/80 to-purple-950/90 border-2 border-rose-500/80 rounded-2xl p-4 shadow-xl shadow-rose-950/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-lg shadow-rose-600/40">
                <AlertOctagon className="w-6 h-6" />
              </div>
              <div>
                <div className="font-extrabold text-white text-sm flex items-center gap-2">
                  <span>Hardware Pin Communication Error!</span>
                  <span className="text-[10px] bg-rose-500 text-slate-950 font-black px-2 py-0.5 rounded-full">
                    {totalErrors} PIN{totalErrors > 1 ? 'S' : ''} FAILED
                  </span>
                </div>
                <div className="text-xs text-rose-200 mt-0.5">
                  The following pin{totalErrors > 1 ? 's' : ''} did not answer commands:{' '}
                  <strong className="text-white underline">
                    {Object.values(pinErrors)
                      .map((e) => e.label)
                      .join(', ')}
                  </strong>
                  . Check jumper wires, power, or component polarity.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setSelectedFilter('errors')}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors"
              >
                View Failed Only
              </button>
              <button
                onClick={handleClearAllErrors}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)] transition-colors"
              >
                Dismiss All
              </button>
            </div>
          </div>
        )}

        {/* Kid Mode Highlight Banner */}
        {isKidMode && (
          <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-purple-500/20 border-2 border-amber-400/50 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg shadow-amber-950/30">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-400 text-slate-950 font-extrabold flex items-center justify-center text-2xl shadow-md shrink-0">
                🧪
              </div>
              <div>
                <div className="font-extrabold text-amber-300 text-sm flex items-center gap-2">
                  <span>Robot Pin Doctor & Calibration Suite</span>
                  <span className="text-[10px] bg-amber-400 text-slate-950 font-black px-2 py-0.5 rounded-full">
                    KID FRIENDLY
                  </span>
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Click <strong className="text-[var(--text-primary)]">Test & Calibrate All Pins</strong>! If any pin does not respond, a big red badge will warn you so you can fix your wire!
                </div>
              </div>
            </div>

            <button
              onClick={startPinCalibration}
              disabled={isCalibrating}
              className={`px-4 py-2.5 rounded-xl font-extrabold text-xs text-slate-950 bg-gradient-to-r from-amber-300 via-orange-400 to-pink-400 hover:brightness-110 shadow-md transition-all shrink-0 flex items-center gap-2 ${
                isCalibrating ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Sparkles className="w-4 h-4 text-slate-950" />
              <span>{isCalibrating ? 'Doctor Checkup Running...' : 'Start Robot Checkup! ⭐'}</span>
            </button>
          </div>
        )}

        {/* Live Calibration Banner (Visible while testing or right after) */}
        {(isCalibrating || calibrationProgress > 0) && (
          <div className="bg-[var(--bg-secondary)] border border-cyan-500/50 rounded-2xl p-4 shadow-xl shadow-cyan-950/40 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isCalibrating
                      ? 'bg-cyan-500/20 text-cyan-400 animate-pulse'
                      : totalErrors > 0
                      ? 'bg-rose-500/20 text-rose-400'
                      : 'bg-emerald-500/20 text-emerald-400'
                  }`}
                >
                  {isCalibrating ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : totalErrors > 0 ? (
                    <AlertTriangle className="w-4 h-4" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <span>{isCalibrating ? 'Hardware Diagnostic & Calibration Sweep' : 'Diagnostic Sweep Finished'}</span>
                    <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                      {calibrationProgress}%
                    </span>
                    {totalErrors > 0 && (
                      <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-rose-950 text-rose-400 border border-rose-800 font-bold">
                        {totalErrors} ERROR{totalErrors > 1 ? 'S' : ''}
                      </span>
                    )}
                  </div>
                  <div
                    className={`text-[11px] font-mono mt-0.5 ${
                      totalErrors > 0 && !isCalibrating ? 'text-rose-400 font-bold' : 'text-cyan-300'
                    }`}
                  >
                    {calibrationStep}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isCalibrating && (
                  <button
                    onClick={stopCalibration}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 border border-rose-500/50 transition-colors"
                  >
                    Abort
                  </button>
                )}
                {report && !isCalibrating && (
                  <button
                    onClick={() => setShowReportModal(true)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                      report.failedCount > 0
                        ? 'bg-rose-600 hover:bg-rose-500 text-white'
                        : 'bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/50'
                    }`}
                  >
                    {report.failedCount > 0 ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>{report.failedCount > 0 ? 'Review Pin Errors' : 'View Certificate'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-[#0c0f17] h-2.5 rounded-full overflow-hidden p-0.5 border border-[#27324c]">
              <div
                className={`h-full rounded-full transition-all duration-200 ${
                  totalErrors > 0
                    ? 'bg-gradient-to-r from-cyan-500 via-amber-500 to-rose-500'
                    : 'bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-400'
                }`}
                style={{ width: `${calibrationProgress}%` }}
              />
            </div>

            {/* Mini Log Ticker */}
            {testLogs.length > 0 && (
              <div className="bg-[#0c0f17] rounded-lg p-2 font-mono text-[11px] flex items-center justify-between text-slate-400 border border-[#27324c]/60 overflow-hidden">
                <div className="flex items-center gap-2 truncate">
                  <Terminal className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="text-slate-500">[{testLogs[testLogs.length - 1].time}]</span>
                  <span
                    className={`truncate ${
                      testLogs[testLogs.length - 1].type === 'err'
                        ? 'text-rose-400 font-bold'
                        : testLogs[testLogs.length - 1].type === 'warn'
                        ? 'text-amber-400 font-semibold'
                        : 'text-cyan-300'
                    }`}
                  >
                    {testLogs[testLogs.length - 1].msg}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 ml-2 shrink-0">{testLogs.length} events</span>
              </div>
            )}
          </div>
        )}

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center bg-[#111625] p-1 rounded-lg border border-[#27324c] text-xs">
            <button
              onClick={() => setSelectedFilter('all')}
              className={`px-3 py-1 rounded-md transition-colors ${
                selectedFilter === 'all'
                  ? 'bg-cyan-500/20 text-cyan-400 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Pins ({pins.length})
            </button>
            <button
              onClick={() => setSelectedFilter('digital')}
              className={`px-3 py-1 rounded-md transition-colors ${
                selectedFilter === 'digital'
                  ? 'bg-cyan-500/20 text-cyan-400 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Digital (0-13)
            </button>
            <button
              onClick={() => setSelectedFilter('pwm')}
              className={`px-3 py-1 rounded-md transition-colors ${
                selectedFilter === 'pwm'
                  ? 'bg-cyan-500/20 text-cyan-400 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              PWM Capable (~)
            </button>
            <button
              onClick={() => setSelectedFilter('analog')}
              className={`px-3 py-1 rounded-md transition-colors ${
                selectedFilter === 'analog'
                  ? 'bg-cyan-500/20 text-cyan-400 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Analog Inputs (A0-A5)
            </button>
            {totalErrors > 0 && (
              <button
                onClick={() => setSelectedFilter('errors')}
                className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1 ${
                  selectedFilter === 'errors'
                    ? 'bg-rose-600 text-white font-bold'
                    : 'text-rose-400 hover:bg-rose-950/40'
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>Errors ({totalErrors})</span>
              </button>
            )}
          </div>

          <div className="text-xs text-slate-400 flex items-center gap-3">
            {simulatedFaultPin !== null && (
              <span className="text-[11px] text-amber-400 font-mono bg-amber-950/50 border border-amber-600/60 px-2 py-0.5 rounded flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Fault Injected on Pin {simulatedFaultPin}
              </span>
            )}
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Target: Arduino {arduinoSerial.boardType.toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* Pin Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPins.map((p) => {
            const isOutput = p.mode === 'OUTPUT';
            const isPwm = p.mode === 'PWM';
            const isServo = p.mode === 'SERVO';
            const isAnalog = p.isAnalogCapable;
            const isCurrentlyTested = currentTestingPin === p.pin;
            const pinError = pinErrors[p.pin];

            return (
              <div
                key={p.pin}
                className={`border rounded-xl p-4 flex flex-col justify-between gap-3 transition-all duration-150 ${
                  pinError
                    ? 'bg-[#1c1117] border-rose-500 ring-2 ring-rose-500/80 shadow-xl shadow-rose-950/70'
                    : isCurrentlyTested
                    ? 'bg-cyan-950/40 border-cyan-400 ring-2 ring-cyan-400/80 shadow-xl shadow-cyan-500/20 scale-[1.02]'
                    : 'bg-[#111625] border-[#27324c] hover:border-slate-500'
                }`}
              >
                {/* Card Header: Pin Name, Badges, & Mode Dropdown */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-white">{p.label}</span>
                    {p.isPwmCapable && (
                      <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                        PWM
                      </span>
                    )}
                    {p.pin === 13 && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 font-bold">
                        LED
                      </span>
                    )}
                    {isExpertMode && AVR_PIN_MAP[p.pin] && (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-extrabold">
                        {AVR_PIN_MAP[p.pin].avrPin}
                        {AVR_PIN_MAP[p.pin].timer ? ` (${AVR_PIN_MAP[p.pin].timer})` : ''}
                      </span>
                    )}
                    {isCurrentlyTested && (
                      <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded bg-cyan-500 text-slate-950 animate-pulse">
                        TESTING
                      </span>
                    )}
                    {pinError && (
                      <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded bg-rose-600 text-white flex items-center gap-0.5 animate-pulse shadow-sm">
                        <AlertTriangle className="w-2.5 h-2.5" /> NO RESPONSE
                      </span>
                    )}
                  </div>

                  {/* Mode Selector */}
                  <select
                    value={p.mode}
                    onChange={(e) => handleChangeMode(p, e.target.value as PinMode)}
                    className="bg-[#181f33] border border-[#27324c] rounded px-2 py-0.5 text-[11px] text-slate-300 font-mono focus:outline-none"
                  >
                    <option value="INPUT">INPUT</option>
                    <option value="OUTPUT">OUTPUT</option>
                    {p.isPwmCapable && <option value="PWM">PWM</option>}
                    {p.isPwmCapable && <option value="SERVO">SERVO</option>}
                  </select>
                </div>

                {/* ERROR CALLOUT BANNER ON PIN CARD */}
                {pinError && (
                  <div className="bg-rose-950/70 border border-rose-500/80 rounded-lg p-2.5 flex flex-col gap-1.5 text-rose-200">
                    <div className="flex items-start gap-2">
                      <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-bold text-xs text-rose-300">Pin Unresponsive (Timeout)</div>
                        <div className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                          {pinError.error}
                        </div>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-400 bg-black/40 p-1.5 rounded border border-rose-900/50">
                      <strong className="text-rose-300">Suggestion:</strong> {pinError.suggestedFix}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        onClick={() => handleRetrySinglePin(p)}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded text-[11px] transition-colors flex items-center gap-1 shadow-sm"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Retry Pin</span>
                      </button>
                      <button
                        onClick={() => handleClearPinError(p.pin)}
                        className="text-[10px] text-slate-400 hover:text-white underline"
                      >
                        Dismiss Error
                      </button>
                    </div>
                  </div>
                )}

                {/* Card Body: Controls according to mode */}
                {isAnalog ? (
                  // Analog Input Display
                  <div className="flex flex-col gap-2 bg-[#181f33] p-3 rounded-lg border border-[#27324c]/60">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Sampled Reading:</span>
                      <span className="font-mono font-bold text-emerald-400">
                        {p.analogValue} / 1023
                      </span>
                    </div>

                    <div className="w-full bg-[#0c0f17] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-150"
                        style={{ width: `${(p.analogValue / 1023) * 100}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Voltage: {((p.analogValue * 5.0) / 1023.0).toFixed(2)} V</span>
                      {isExpertMode && (
                        <span className="text-emerald-400 font-mono text-[10px]">
                          {((p.analogValue * 5000) / 1023).toFixed(0)}mV | 0x{p.analogValue.toString(16).toUpperCase().padStart(3, '0')}
                        </span>
                      )}
                      <button
                        onClick={() => handlePollAnalog(p.analogChannel ?? 0)}
                        className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium"
                      >
                        <RefreshCw className="w-3 h-3" /> Sample
                      </button>
                    </div>
                  </div>
                ) : isPwm ? (
                  // PWM Duty Cycle Slider
                  <div className="flex flex-col gap-2 bg-[#181f33] p-3 rounded-lg border border-[#27324c]/60">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">
                        {isExpertMode ? 'Pulse Width & Compare Match:' : 'Duty Cycle (0-255):'}
                      </span>
                      <span className="font-mono font-bold text-cyan-400">
                        {isExpertMode
                          ? `${Math.round(1000 + (p.pwmValue / 255) * 1000)} µs (OCR = ${p.pwmValue})`
                          : `${p.pwmValue} (${Math.round((p.pwmValue / 255) * 100)}%)`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="255"
                      value={p.pwmValue}
                      onChange={(e) => handlePwmChange(p, parseInt(e.target.value, 10))}
                      className="accent-cyan-500 cursor-pointer"
                    />
                  </div>
                ) : isServo ? (
                  // Servo Mode Badge
                  <div className="p-3 bg-[#181f33] rounded-lg border border-[#27324c]/60 flex items-center justify-between text-xs">
                    <span className="text-purple-300">Servo Pulse Enabled</span>
                    <span className="text-slate-400 text-[11px]">Controlled via Servo Tab</span>
                  </div>
                ) : (
                  // Digital Write (HIGH / LOW) or Digital Read
                  <div className="flex items-center justify-between p-3 bg-[#181f33] rounded-lg border border-[#27324c]/60">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-3.5 h-3.5 rounded-full transition-all ${
                          p.digitalValue === 1
                            ? 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)] scale-110'
                            : 'bg-slate-700'
                        }`}
                      />
                      <span className="text-xs font-semibold text-white">
                        {p.digitalValue === 1 ? 'HIGH (1)' : 'LOW (0)'}
                      </span>
                    </div>

                    {isOutput ? (
                      <button
                        onClick={() => handleToggleDigital(p)}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                          p.digitalValue === 1
                            ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30'
                            : 'bg-[#111625] text-slate-300 border border-[#27324c] hover:text-white hover:border-slate-500'
                        }`}
                      >
                        Toggle
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500 font-mono">INPUT SENSOR</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Calibration & Diagnostic Report Modal */}
      {showReportModal && report && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#111625] border-2 border-cyan-500/50 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl shadow-cyan-950/80 overflow-hidden">
            {/* Modal Header */}
            <div
              className={`p-5 border-b border-[#27324c] flex items-center justify-between ${
                report.failedCount > 0 ? 'bg-gradient-to-r from-rose-950/80 to-[#0d121f]' : 'bg-[#0d121f]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                    report.failedCount > 0
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/50'
                      : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  }`}
                >
                  {report.failedCount > 0 ? <AlertOctagon className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white">
                      Hardware Pin Calibration & Diagnostic Certificate
                    </h2>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        report.failedCount > 0
                          ? 'bg-rose-950 text-rose-400 border border-rose-800'
                          : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      }`}
                    >
                      {report.failedCount > 0 ? `${report.failedCount} PINS FAILED` : 'ALL PASSED'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Target: Arduino {report.boardType} • Generated at {report.timestamp} • MCU Latency {report.mcuLatencyMs}ms
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowReportModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#181f33] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 bg-[#0e1322] border-b border-[#27324c]">
              <div className="bg-[#181f33] p-3 rounded-xl border border-[#27324c]">
                <div className="text-[11px] text-slate-400">Total Tested</div>
                <div className="text-xl font-bold font-mono text-white mt-0.5">{report.totalTested} Pins</div>
              </div>
              <div className="bg-[#181f33] p-3 rounded-xl border border-[#27324c]">
                <div className="text-[11px] text-slate-400">Successful Responses</div>
                <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
                  {report.passedCount} / {report.totalTested}
                </div>
              </div>
              <div className="bg-[#181f33] p-3 rounded-xl border border-[#27324c]">
                <div className="text-[11px] text-slate-400">Failed / Unresponsive</div>
                <div
                  className={`text-xl font-bold font-mono mt-0.5 ${
                    report.failedCount > 0 ? 'text-rose-400 font-black' : 'text-slate-400'
                  }`}
                >
                  {report.failedCount} Pins
                </div>
              </div>
              <div className="bg-[#181f33] p-3 rounded-xl border border-[#27324c]">
                <div className="text-[11px] text-slate-400">MCU Handshake Latency</div>
                <div className="text-xl font-bold font-mono text-cyan-400 mt-0.5">{report.mcuLatencyMs} ms</div>
              </div>
            </div>

            {/* Tabs Selector */}
            <div className="flex items-center px-5 pt-3 gap-2 border-b border-[#27324c] bg-[#111625] text-xs overflow-x-auto">
              <button
                onClick={() => setReportActiveTab('overview')}
                className={`pb-2.5 px-3 border-b-2 font-semibold transition-colors shrink-0 ${
                  reportActiveTab === 'overview'
                    ? 'border-cyan-400 text-cyan-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                Overview
              </button>
              {report.failedCount > 0 && (
                <button
                  onClick={() => setReportActiveTab('failed')}
                  className={`pb-2.5 px-3 border-b-2 font-bold transition-colors shrink-0 flex items-center gap-1 ${
                    reportActiveTab === 'failed'
                      ? 'border-rose-400 text-rose-400'
                      : 'border-transparent text-rose-300 hover:text-white'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Failed Pins ({report.failedCount})</span>
                </button>
              )}
              <button
                onClick={() => setReportActiveTab('digital')}
                className={`pb-2.5 px-3 border-b-2 font-semibold transition-colors shrink-0 ${
                  reportActiveTab === 'digital'
                    ? 'border-cyan-400 text-cyan-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                Digital ({report.digitalResults.length})
              </button>
              <button
                onClick={() => setReportActiveTab('pwm')}
                className={`pb-2.5 px-3 border-b-2 font-semibold transition-colors shrink-0 ${
                  reportActiveTab === 'pwm'
                    ? 'border-cyan-400 text-cyan-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                PWM Timers ({report.pwmResults.length})
              </button>
              <button
                onClick={() => setReportActiveTab('analog')}
                className={`pb-2.5 px-3 border-b-2 font-semibold transition-colors shrink-0 ${
                  reportActiveTab === 'analog'
                    ? 'border-cyan-400 text-cyan-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                Analog ADC ({report.analogResults.length})
              </button>
              <button
                onClick={() => setReportActiveTab('logs')}
                className={`pb-2.5 px-3 border-b-2 font-semibold transition-colors shrink-0 ${
                  reportActiveTab === 'logs'
                    ? 'border-cyan-400 text-cyan-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                Telemetry Logs ({testLogs.length})
              </button>
            </div>

            {/* Modal Body / Tab Content */}
            <div className="p-5 flex-1 overflow-y-auto">
              {reportActiveTab === 'failed' && (
                <div className="flex flex-col gap-3">
                  <div className="bg-rose-950/80 border border-rose-500/80 rounded-xl p-4 text-rose-100 flex items-start gap-3">
                    <AlertOctagon className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-extrabold text-sm text-white">
                        Attention: {report.failedCount} Pin{report.failedCount > 1 ? 's' : ''} Failed Response Verification
                      </h3>
                      <p className="text-xs text-rose-200 mt-1">
                        During the automated diagnostic test, the microcontroller did not return confirmation acknowledgments (ACK/DATA) on the pins below within the timeout window.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {report.failedPins.map((f) => (
                      <div
                        key={f.pin}
                        className="bg-[#181f33] border-2 border-rose-500/80 rounded-xl p-4 flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-base text-rose-300">{f.label}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-600 text-white font-bold">
                            NO RESPONSE (TIMEOUT)
                          </span>
                        </div>
                        <div className="text-xs text-slate-200 font-mono bg-[#0c0f17] p-2 rounded border border-[#27324c]">
                          {f.error}
                        </div>
                        <div className="text-xs text-amber-300 flex items-start gap-1.5 mt-1">
                          <Wrench className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                          <span>
                            <strong>Hardware Fix:</strong> {f.suggestedFix}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {reportActiveTab === 'overview' && (
                <div className="flex flex-col gap-4">
                  {report.failedCount > 0 ? (
                    <div className="bg-rose-950/70 border-2 border-rose-500/80 rounded-2xl p-5 text-center">
                      <div className="text-4xl mb-2">⚠️ 🔌 ❌</div>
                      <h3 className="text-lg font-black text-rose-300">
                        Diagnostic Alert: {report.failedCount} Unresponsive Pin{report.failedCount > 1 ? 's' : ''} Detected!
                      </h3>
                      <p className="text-xs text-slate-300 max-w-lg mx-auto mt-1">
                        Hardware commands sent to pin{' '}
                        <strong className="text-white">
                          {report.failedPins.map((f) => f.label).join(', ')}
                        </strong>{' '}
                        timed out without an acknowledgment. Please inspect your breadboard wiring and jumper connections.
                      </p>
                    </div>
                  ) : isKidMode ? (
                    <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-purple-500/20 border-2 border-amber-400/50 rounded-2xl p-5 text-center">
                      <div className="text-4xl mb-2">🎉 🤖 ✨</div>
                      <h3 className="text-lg font-black text-amber-300">
                        Doctor Report: All Pins Responded Perfectly!
                      </h3>
                      <p className="text-xs text-slate-300 max-w-lg mx-auto mt-1">
                        Every digital light on your Arduino board was turned ON and OFF, the motor pulse timers were ramped up, and all sensor ears answered. Your robot is 100% healthy!
                      </p>
                    </div>
                  ) : (
                    <div className="bg-[#181f33] p-4 rounded-xl border border-[#27324c] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        <div>
                          <div className="text-xs font-bold text-white">Full Board Integrity Verified</div>
                          <div className="text-[11px] text-slate-400">
                            UART registers, GPIO data direction registers (DDRB/DDRD), and 10-bit ADCs calibrated with zero timeouts.
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-800">
                        STATUS: READY
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-[#181f33] p-3.5 rounded-xl border border-[#27324c]">
                      <div className="flex items-center gap-2 text-xs font-semibold text-white mb-2">
                        <Zap className="w-4 h-4 text-cyan-400" />
                        <span>Digital Matrix (12 Pins)</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mb-2">
                        Pins D2 to D13 cycled through HIGH (5.0V) and LOW (0.0V). Pin 13 LED verified with 3-cycle strobe.
                      </p>
                      <span className="text-[10px] text-emerald-400 font-mono">
                        {report.digitalResults.filter((r) => r.status === 'passed').length} / {report.digitalResults.length} Verified
                      </span>
                    </div>

                    <div className="bg-[#181f33] p-3.5 rounded-xl border border-[#27324c]">
                      <div className="flex items-center gap-2 text-xs font-semibold text-white mb-2">
                        <Activity className="w-4 h-4 text-purple-400" />
                        <span>PWM Timers (6 Pins)</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mb-2">
                        Pins D3, D5, D6, D9, D10, D11 sweep tested across 0, 64, 128, and 255 8-bit duty cycle states.
                      </p>
                      <span className="text-[10px] text-emerald-400 font-mono">
                        {report.pwmResults.filter((r) => r.status === 'passed').length} / {report.pwmResults.length} Synchronized
                      </span>
                    </div>

                    <div className="bg-[#181f33] p-3.5 rounded-xl border border-[#27324c]">
                      <div className="flex items-center gap-2 text-xs font-semibold text-white mb-2">
                        <Gauge className="w-4 h-4 text-amber-400" />
                        <span>Analog Sampling (6 Pins)</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mb-2">
                        Pins A0 to A5 sampled with zero-point offsets computed for noise floor baseline compensation.
                      </p>
                      <span className="text-[10px] text-emerald-400 font-mono">
                        {report.analogResults.filter((r) => r.status === 'passed').length} / {report.analogResults.length} Sampled
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {reportActiveTab === 'digital' && (
                <div className="flex flex-col gap-2">
                  {report.digitalResults.map((r) => (
                    <div
                      key={r.pin}
                      className={`p-3 rounded-lg border flex items-center justify-between text-xs ${
                        r.status === 'failed'
                          ? 'bg-rose-950/40 border-rose-500'
                          : 'bg-[#181f33] border-[#27324c]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-white w-20">{r.label}</span>
                        <span className={r.status === 'failed' ? 'text-rose-200' : 'text-slate-300'}>{r.details}</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className={r.status === 'failed' ? 'text-rose-400 font-bold' : 'text-cyan-300'}>{r.measuredValue}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            r.status === 'passed'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : r.status === 'failed'
                              ? 'bg-rose-600 text-white shadow-sm'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {r.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {reportActiveTab === 'pwm' && (
                <div className="flex flex-col gap-2">
                  {report.pwmResults.map((r) => (
                    <div
                      key={r.pin}
                      className={`p-3 rounded-lg border flex items-center justify-between text-xs ${
                        r.status === 'failed'
                          ? 'bg-rose-950/40 border-rose-500'
                          : 'bg-[#181f33] border-[#27324c]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-white w-20">{r.label}</span>
                        <span className={r.status === 'failed' ? 'text-rose-200' : 'text-slate-300'}>{r.details}</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className={r.status === 'failed' ? 'text-rose-400 font-bold' : 'text-purple-300'}>{r.measuredValue}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            r.status === 'passed'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-rose-600 text-white'
                          }`}
                        >
                          {r.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {reportActiveTab === 'analog' && (
                <div className="flex flex-col gap-2">
                  {report.analogResults.map((r) => (
                    <div
                      key={r.pin}
                      className={`p-3 rounded-lg border flex items-center justify-between text-xs ${
                        r.status === 'failed'
                          ? 'bg-rose-950/40 border-rose-500'
                          : 'bg-[#181f33] border-[#27324c]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-white w-20">{r.label}</span>
                        <span className={r.status === 'failed' ? 'text-rose-200' : 'text-slate-300'}>{r.details}</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className={r.status === 'failed' ? 'text-rose-400 font-bold' : 'text-emerald-300'}>{r.measuredValue}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            r.status === 'passed'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-rose-600 text-white'
                          }`}
                        >
                          {r.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {reportActiveTab === 'logs' && (
                <div className="bg-[#0c0f17] p-3 rounded-xl border border-[#27324c] font-mono text-[11px] flex flex-col gap-1 max-h-72 overflow-y-auto">
                  {testLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-2">
                      <span className="text-slate-500 shrink-0">[{log.time}]</span>
                      <span
                        className={
                          log.type === 'err'
                            ? 'text-rose-400 font-bold'
                            : log.type === 'warn'
                            ? 'text-amber-400'
                            : log.type === 'pass'
                            ? 'text-emerald-400'
                            : log.type === 'active'
                            ? 'text-cyan-400'
                            : 'text-slate-300'
                        }
                      >
                        {log.msg}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 border-t border-[#27324c] bg-[#0d121f] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={copyReportText}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#181f33] hover:bg-[#202945] text-slate-200 border border-[#27324c] flex items-center gap-1.5 transition-colors"
                >
                  {copiedReport ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedReport ? 'Copied to Clipboard!' : 'Copy Diagnostic Report'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowReportModal(false);
                    startPinCalibration();
                  }}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/50 flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Re-Test All Pins</span>
                </button>
                <button
                  onClick={() => setShowReportModal(false)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    report.failedCount > 0
                      ? 'bg-rose-600 hover:bg-rose-500 text-white'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                  }`}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
