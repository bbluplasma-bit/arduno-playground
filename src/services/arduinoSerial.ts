import { ConnectionStatus, SerialMessage, BoardType } from '../types';

export type SerialMessageListener = (msg: SerialMessage) => void;
export type StatusListener = (status: ConnectionStatus, boardInfo?: string) => void;
export type TelemetryListener = (channel: string, value: number) => void;
export type ServoAckListener = (pin: number, angle: number) => void;

class ArduinoSerialService {
  private port: any = null;
  private reader: any = null;
  private writer: any = null;
  private readableStreamClosed: Promise<void> | null = null;
  private writableStreamClosed: Promise<void> | null = null;
  private textDecoder: any = null;
  private textEncoder: any = null;

  public status: ConnectionStatus = 'disconnected';
  public boardType: BoardType = 'uno';
  public isVirtual: boolean = false;
  public comPortName: string = 'COM3 (Arduino Uno)';
  public baudRate: number = 115200;

  private messageListeners: Set<SerialMessageListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();
  private telemetryListeners: Set<TelemetryListener> = new Set();
  private servoAckListeners: Set<ServoAckListener> = new Set();
  private rawLineListeners: Set<(line: string) => void> = new Set();

  public unresponsivePins: Set<number> = new Set();

  private virtualInterval: any = null;
  private simulatedPins: Record<number, { mode: string; val: number }> = {
    13: { mode: 'OUTPUT', val: 0 },
    9: { mode: 'SERVO', val: 90 },
    10: { mode: 'SERVO', val: 90 },
  };

  constructor() {
    if (typeof window !== 'undefined' && 'TextDecoder' in window) {
      this.textDecoder = new TextDecoderStream();
      this.textEncoder = new TextEncoderStream();
    }
  }

  public isWebSerialSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  public addMessageListener(listener: SerialMessageListener) {
    this.messageListeners.add(listener);
    return () => {
      this.messageListeners.delete(listener);
    };
  }

  public addStatusListener(listener: StatusListener) {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public addTelemetryListener(listener: TelemetryListener) {
    this.telemetryListeners.add(listener);
    return () => {
      this.telemetryListeners.delete(listener);
    };
  }

  public addServoAckListener(listener: ServoAckListener) {
    this.servoAckListeners.add(listener);
    return () => {
      this.servoAckListeners.delete(listener);
    };
  }

  public addRawLineListener(listener: (line: string) => void) {
    this.rawLineListeners.add(listener);
    return () => {
      this.rawLineListeners.delete(listener);
    };
  }

  public setPinUnresponsive(pin: number, unresponsive: boolean) {
    if (unresponsive) {
      this.unresponsivePins.add(pin);
    } else {
      this.unresponsivePins.delete(pin);
    }
  }

  public isPinUnresponsive(pin: number): boolean {
    return this.unresponsivePins.has(pin);
  }

  public async waitForPinResponse(
    expectedPrefix: string,
    timeoutMs: number = 300
  ): Promise<{ ok: boolean; line?: string; latencyMs: number }> {
    const startTime = performance.now();
    return new Promise((resolve) => {
      let resolved = false;

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve({ ok: false, latencyMs: Math.round(performance.now() - startTime) });
        }
      }, timeoutMs);

      const cleanup = this.addRawLineListener((line) => {
        if (line.startsWith(expectedPrefix)) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            cleanup();
            resolve({
              ok: true,
              line,
              latencyMs: Math.round(performance.now() - startTime),
            });
          }
        }
      });
    });
  }

  private notifyMessage(type: 'tx' | 'rx' | 'sys' | 'err', text: string) {
    const msg: SerialMessage = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      type,
      text,
    };
    this.messageListeners.forEach((l) => l(msg));
  }

  private updateStatus(newStatus: ConnectionStatus, boardInfo?: string) {
    this.status = newStatus;
    this.statusListeners.forEach((l) => l(newStatus, boardInfo));
  }

  /**
   * Connect to physical Arduino via Web Serial API
   */
  public async connectPhysical(baud: number = 115200): Promise<boolean> {
    if (!this.isWebSerialSupported()) {
      this.notifyMessage('err', 'Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.');
      return false;
    }

    // Ensure any previously active streams or ports are cleanly closed
    if (this.port || this.status === 'connected') {
      await this.disconnect();
    }

    try {
      this.updateStatus('connecting');
      this.notifyMessage('sys', `Requesting USB COM port at ${baud} baud...`);

      // @ts-ignore
      const port = await navigator.serial.requestPort();
      if (!port) {
        this.updateStatus('disconnected');
        return false;
      }

      // Check if port is already open before attempting to open it
      const isAlreadyOpen = Boolean(port.readable || port.writable);
      if (!isAlreadyOpen) {
        await port.open({ baudRate: baud });
      }

      this.port = port;
      this.baudRate = baud;
      this.isVirtual = false;

      // Extract device info if available
      try {
        const info = port.getInfo ? port.getInfo() : {};
        const vid = info.usbVendorId ? `0x${info.usbVendorId.toString(16).padStart(4, '0')}` : '';
        const pid = info.usbProductId ? `0x${info.usbProductId.toString(16).padStart(4, '0')}` : '';
        this.comPortName = vid && pid ? `Arduino USB (${vid}:${pid})` : 'Physical USB Serial Port';
      } catch (e) {
        this.comPortName = 'Physical USB Serial Port';
      }

      // Setup streams
      const textDecoder = new TextDecoderStream();
      this.readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable).catch(() => {});
      this.reader = textDecoder.readable.getReader();

      const textEncoder = new TextEncoderStream();
      this.writableStreamClosed = textEncoder.readable.pipeTo(this.port.writable).catch(() => {});
      this.writer = textEncoder.writable.getWriter();

      this.updateStatus('connected', 'Arduino (Physical)');
      this.notifyMessage('sys', `Connected to ${this.comPortName} @ ${baud} baud.`);

      // Send initial handshake ping
      setTimeout(() => {
        this.sendRaw('PING');
      }, 150);

      // Start read loop
      this.startReading();
      return true;
    } catch (err: any) {
      console.warn('Serial connection event:', err);

      // Handle user cancellation gracefully
      if (err.name === 'NotFoundError' || err.message?.includes('No port selected')) {
        this.updateStatus('disconnected');
        this.notifyMessage('sys', 'Port selection cancelled.');
        return false;
      }

      // Handle port already open
      if (err.name === 'InvalidStateError' || err.message?.includes('already open')) {
        this.notifyMessage('sys', 'Port is already open. Resetting serial connection...');
        await this.disconnect();
        this.updateStatus('disconnected');
        return false;
      }

      // Other hardware or permission error
      this.updateStatus('error');
      this.notifyMessage('err', `Connection failed: ${err.message || 'Port busy or access denied'}`);
      return false;
    }
  }

  /**
   * Connect to built-in high-fidelity Virtual ATmega328P Arduino emulator
   */
  public connectVirtual(board: BoardType = 'uno', baud: number = 115200) {
    this.disconnect();
    this.isVirtual = true;
    this.boardType = board;
    this.baudRate = baud;
    this.comPortName = `COM3 (Virtual ${board.toUpperCase()})`;
    this.updateStatus('connected', `Virtual ${board.toUpperCase()}`);
    this.notifyMessage('sys', `Connected to Virtual Arduino (${board.toUpperCase()}) on ${this.comPortName} @ ${baud} baud.`);
    this.notifyMessage('rx', `ACS_READY,v2.4 [EMULATOR_ATMEGA328P]`);

    // Simulated analog jitter & telemetry generator
    let a0Base = 512;
    this.virtualInterval = setInterval(() => {
      a0Base += Math.floor((Math.random() - 0.5) * 12);
      a0Base = Math.max(0, Math.min(1023, a0Base));
      this.telemetryListeners.forEach((l) => l('A0', a0Base));
    }, 250);
  }

  private async startReading() {
    let buffer = '';
    try {
      while (this.port && this.reader) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          const lines = buffer.split(/[\r\n]+/);
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (line.trim()) {
              this.handleIncomingLine(line.trim());
            }
          }
        }
      }
    } catch (err: any) {
      console.warn('Serial read error:', err);
      if (err.name === 'NetworkError' || err.message?.includes('device has been lost') || err.message?.includes('disconnected')) {
        this.notifyMessage('err', 'USB connection lost: Device was disconnected or unplugged.');
        await this.disconnect();
      } else if (this.status === 'connected') {
        this.notifyMessage('err', `Read stream error: ${err.message}`);
        await this.disconnect();
      }
    }
  }

  private handleIncomingLine(line: string) {
    this.notifyMessage('rx', line);

    this.rawLineListeners.forEach((l) => {
      try {
        l(line);
      } catch (err) {
        console.warn('Raw line listener error:', err);
      }
    });

    // Parse protocol
    if (line.startsWith('ACK,S,')) {
      const parts = line.split(',');
      const pin = parseInt(parts[2], 10);
      const angle = parseInt(parts[3], 10);
      if (!isNaN(pin) && !isNaN(angle)) {
        this.servoAckListeners.forEach((l) => l(pin, angle));
      }
    } else if (line.startsWith('TLM,') || line.startsWith('DATA,A,')) {
      const parts = line.split(',');
      const channel = parts[1] === 'A' ? `A${parts[2]}` : parts[1];
      const val = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(val)) {
        this.telemetryListeners.forEach((l) => l(channel, val));
      }
    } else if (line.startsWith('PONG,')) {
      const parts = line.split(',');
      const detected = parts[1]?.toLowerCase() as BoardType;
      if (detected) this.boardType = detected;
      this.notifyMessage('sys', `Handshake verified with Arduino hardware (${parts[1]} FW v${parts[2] || '2.4'})`);
    }
  }

  public async disconnect(): Promise<void> {
    if (this.virtualInterval) {
      clearInterval(this.virtualInterval);
      this.virtualInterval = null;
    }

    // Release reader lock
    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch (e) {}
      try {
        this.reader.releaseLock();
      } catch (e) {}
      this.reader = null;
    }

    if (this.readableStreamClosed) {
      try {
        await this.readableStreamClosed;
      } catch (e) {}
      this.readableStreamClosed = null;
    }

    // Release writer lock
    if (this.writer) {
      try {
        await this.writer.close();
      } catch (e) {
        try {
          await this.writer.abort();
        } catch (e2) {}
      }
      try {
        this.writer.releaseLock();
      } catch (e) {}
      this.writer = null;
    }

    if (this.writableStreamClosed) {
      try {
        await this.writableStreamClosed;
      } catch (e) {}
      this.writableStreamClosed = null;
    }

    // Close port if open
    if (this.port) {
      try {
        if (this.port.readable || this.port.writable) {
          await this.port.close();
        }
      } catch (e) {}
      this.port = null;
    }

    this.isVirtual = false;
    this.updateStatus('disconnected');
    this.notifyMessage('sys', 'Disconnected from Arduino.');
  }

  /**
   * Send raw string to Arduino hardware
   */
  public async sendRaw(cmd: string): Promise<boolean> {
    if (this.status !== 'connected') {
      this.notifyMessage('err', `Cannot send command "${cmd}": Arduino is disconnected.`);
      return false;
    }

    this.notifyMessage('tx', cmd);

    if (this.isVirtual) {
      setTimeout(() => {
        this.handleVirtualCommand(cmd);
      }, 15);
      return true;
    }

    if (this.writer) {
      try {
        await this.writer.write(`${cmd}\n`);
        return true;
      } catch (err: any) {
        console.warn('Serial write error:', err);
        if (err.name === 'NetworkError' || err.message?.includes('device has been lost')) {
          this.notifyMessage('err', 'USB connection lost while writing. Device was unplugged.');
          await this.disconnect();
        } else {
          this.notifyMessage('err', `Write failed: ${err.message}`);
        }
        return false;
      }
    }
    return false;
  }

  private handleVirtualCommand(cmd: string) {
    if (cmd === 'PING') {
      if (this.unresponsivePins.has(-1)) return; // Simulated full MCU timeout
      this.handleIncomingLine(`PONG,${this.boardType.toUpperCase()},2.4`);
    } else if (cmd === 'STOP') {
      this.handleIncomingLine('STATUS:EMERGENCY_STOP_ENGAGED');
    } else if (cmd.startsWith('S,')) {
      const parts = cmd.split(',');
      const pin = parseInt(parts[1], 10);
      const angle = parseInt(parts[2], 10);
      if (this.unresponsivePins.has(pin)) return;
      this.simulatedPins[pin] = { mode: 'SERVO', val: angle };
      this.handleIncomingLine(`ACK,S,${pin},${angle}`);
    } else if (cmd.startsWith('D,')) {
      const parts = cmd.split(',');
      const pin = parseInt(parts[1], 10);
      const val = parseInt(parts[2], 10);
      if (this.unresponsivePins.has(pin)) return; // No ACK returned!
      this.simulatedPins[pin] = { mode: 'OUTPUT', val };
      this.handleIncomingLine(`ACK,D,${pin},${val}`);
    } else if (cmd.startsWith('P,')) {
      const parts = cmd.split(',');
      const pin = parseInt(parts[1], 10);
      const val = parseInt(parts[2], 10);
      if (this.unresponsivePins.has(pin)) return; // No ACK returned!
      this.simulatedPins[pin] = { mode: 'PWM', val };
      this.handleIncomingLine(`ACK,P,${pin},${val}`);
    } else if (cmd.startsWith('T,') || cmd.startsWith('TONE,')) {
      const parts = cmd.split(',');
      const pin = parseInt(parts[1], 10);
      const freq = parseInt(parts[2], 10);
      if (this.unresponsivePins.has(pin)) return;
      this.simulatedPins[pin] = { mode: 'TONE', val: freq };
      this.handleIncomingLine(`ACK,T,${pin},${freq}`);
    } else if (cmd.startsWith('M,')) {
      const parts = cmd.split(',');
      const pin = parseInt(parts[1], 10);
      const mode = parts[2];
      if (this.unresponsivePins.has(pin)) return;
      this.simulatedPins[pin] = { mode, val: 0 };
      this.handleIncomingLine(`ACK,M,${pin},${mode}`);
    } else if (cmd.startsWith('A,')) {
      const parts = cmd.split(',');
      const pinStr = parts[1];
      const channelNum = parseInt(pinStr.replace('A', ''), 10);
      if (
        this.unresponsivePins.has(channelNum) ||
        this.unresponsivePins.has(channelNum + 14) ||
        this.unresponsivePins.has(parseInt(pinStr, 10))
      ) {
        return; // No DATA returned!
      }
      const val = Math.floor(Math.random() * 1024);
      this.handleIncomingLine(`DATA,A,${channelNum},${val}`);
    }
  }

  // High-level controller methods
  public async setServoAngle(pin: number, angle: number): Promise<boolean> {
    return this.sendRaw(`S,${pin},${Math.round(angle)}`);
  }

  public async setDigitalPin(pin: number, val: 0 | 1): Promise<boolean> {
    return this.sendRaw(`D,${pin},${val}`);
  }

  public async setPwmPin(pin: number, val: number): Promise<boolean> {
    return this.sendRaw(`P,${pin},${Math.round(val)}`);
  }

  public async sendTone(pin: number, freq: number, durationMs: number = 200): Promise<boolean> {
    return this.sendRaw(`T,${pin},${Math.round(freq)},${Math.round(durationMs)}`);
  }

  public async setPinMode(pin: number, mode: string): Promise<boolean> {
    return this.sendRaw(`M,${pin},${mode}`);
  }

  public async pollAnalogPin(pin: number): Promise<boolean> {
    return this.sendRaw(`A,${pin}`);
  }

  public async emergencyStop(): Promise<boolean> {
    return this.sendRaw('STOP');
  }
}

export const arduinoSerial = new ArduinoSerialService();
