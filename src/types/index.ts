export type BoardType = 'uno' | 'mega' | 'nano' | 'leonardo' | 'esp32';

export type AppMode = 'kid' | 'standard' | 'expert';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface COMPortInfo {
  id: string;
  name: string;
  path: string;
  vendorId?: string;
  productId?: string;
  manufacturer?: string;
}

export interface SerialMessage {
  id: string;
  timestamp: string;
  type: 'tx' | 'rx' | 'sys' | 'err';
  text: string;
}

export type PinMode = 'INPUT' | 'OUTPUT' | 'PWM' | 'SERVO';

export interface PinState {
  pin: number;
  label: string;
  mode: PinMode;
  digitalValue: 0 | 1;
  analogValue: number; // 0 - 1023
  pwmValue: number; // 0 - 255
  isPwmCapable: boolean;
  isAnalogCapable: boolean;
  analogChannel?: number; // e.g. A0 -> 0
  activeServoId?: string;
}

export type ServoModel = 'SG90' | 'MG995' | 'DS3218';

export interface ServoMotor {
  id: string;
  name: string;
  pin: number;
  currentAngle: number;
  targetAngle: number;
  minAngle: number;
  maxAngle: number;
  trim: number;
  speed: number; // deg per second
  rotationAxis: 'x' | 'y' | 'z';
  model: ServoModel;
  position: [number, number, number];
  rotation: [number, number, number];
  attachedPartId: string | null; // Robot part that rotates with this servo horn
  parentPartId: string | null; // Part the servo body is bolted onto
  reverseDirection?: boolean;
  minPulse?: number; // 500-2500us
  maxPulse?: number; // 500-2500us
}

export type PartGeometryType =
  | 'box'
  | 'cylinder'
  | 'sphere'
  | 'torus'
  | 'body'
  | 'arm'
  | 'leg'
  | 'wheel'
  | 'head'
  | 'joint_bracket'
  | 'gripper'
  | 'custom_mesh'
  // 3D Electronics & Microcontrollers
  | 'arduino_uno'
  | 'microbit'
  | 'breadboard'
  | 'sensor_ultrasonic'
  | 'sensor_pir'
  | 'sensor_ldr'
  | 'piezo_buzzer'
  | 'led'
  | 'battery_9v'
  | 'battery_coin'
  | 'dc_motor'
  | 'gearmotor'
  | 'multimeter'
  | 'potentiometer'
  | 'switch_slide'
  | 'pushbutton'
  | 'resistor'
  | 'capacitor';

export interface RobotPart {
  id: string;
  name: string;
  type: PartGeometryType;
  dimensions: [number, number, number]; // width, height, depth or radius
  position: [number, number, number];
  rotation: [number, number, number]; // in degrees
  scale: [number, number, number];
  color: string;
  metalness: number;
  roughness: number;
  parentId: string | null; // Direct parent in assembly hierarchy
  isServoBody?: boolean;
  servoId?: string; // If this part is driven by or houses a servo
  meshVertices?: number[]; // For custom STL/OBJ import
  meshNormals?: number[];
}

export interface Keyframe {
  id: string;
  name: string;
  timestampMs: number;
  durationMs: number;
  angles: Record<string, number>; // servoId -> angle
}

export interface MovementSequence {
  id: string;
  name: string;
  description?: string;
  keyframes: Keyframe[];
  loop: boolean;
  speedMultiplier: number;
}

export interface ElectronicComponent {
  id: string;
  name: string;
  category: 'actuator' | 'sensor' | 'output' | 'input';
  description: string;
  pins: { name: string; type: 'power' | 'ground' | 'digital' | 'analog' | 'pwm'; recommendedPin: string }[];
  workingVoltage: string;
  wiringInstructions: string[];
  exampleCode: string;
  iconName: string;
}

export interface RobotProject {
  id: string;
  name: string;
  description: string;
  boardType: BoardType;
  parts: RobotPart[];
  servos: ServoMotor[];
  sequences: MovementSequence[];
  customCode: string;
  createdAt: string;
  updatedAt: string;
}
