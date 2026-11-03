import { RobotProject, ElectronicComponent } from '../types';

export const DEFAULT_BIPED_PROJECT: RobotProject = {
  id: 'proj_biped_01',
  name: 'Bipedal Walker 2.0',
  description: 'Two-legged walking biped robot powered by 2 SG90 hip servos on pins 9 and 10.',
  boardType: 'uno',
  createdAt: '2026-10-31',
  updatedAt: '2026-10-31',
  customCode: `// Bipedal Walker Control Routine
#include <Servo.h>

Servo leftHip;  // Pin 9
Servo rightHip; // Pin 10

void setup() {
  leftHip.attach(9);
  rightHip.attach(10);
  leftHip.write(90);
  rightHip.write(90);
}

void loop() {
  // Walking gait sequence
  leftHip.write(115);
  rightHip.write(65);
  delay(350);

  leftHip.write(65);
  rightHip.write(115);
  delay(350);
}`,
  parts: [
    // Main Body / Torso
    {
      id: 'torso_body',
      name: 'Chassis Torso',
      type: 'box',
      dimensions: [2.2, 2.6, 1.4],
      position: [0, 4.2, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#1e293b',
      metalness: 0.6,
      roughness: 0.3,
      parentId: null,
    },
    // Robot Visor / Head
    {
      id: 'head_unit',
      name: 'Cyber Visor Head',
      type: 'head',
      dimensions: [1.6, 1.2, 1.2],
      position: [0, 5.8, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#0284c7',
      metalness: 0.8,
      roughness: 0.2,
      parentId: 'torso_body',
    },
    // Left Hip Bracket (Bolted to torso)
    {
      id: 'left_hip_bracket',
      name: 'Left Hip Mount',
      type: 'joint_bracket',
      dimensions: [0.6, 0.8, 0.8],
      position: [-1.4, 3.2, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#334155',
      metalness: 0.7,
      roughness: 0.4,
      parentId: 'torso_body',
    },
    // Left Leg Segment (Attached to Left Hip Servo Horn!)
    {
      id: 'left_leg',
      name: 'Left Upper Leg',
      type: 'cylinder',
      dimensions: [0.35, 2.4, 0.35],
      position: [-1.4, 1.6, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#38bdf8',
      metalness: 0.5,
      roughness: 0.3,
      parentId: null,
      servoId: 'servo_left_hip',
    },
    // Left Foot
    {
      id: 'left_foot',
      name: 'Left Foot Pad',
      type: 'box',
      dimensions: [0.9, 0.3, 1.6],
      position: [-1.4, 0.15, 0.3],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#0f172a',
      metalness: 0.8,
      roughness: 0.5,
      parentId: 'left_leg',
    },
    // Right Hip Bracket (Bolted to torso)
    {
      id: 'right_hip_bracket',
      name: 'Right Hip Mount',
      type: 'joint_bracket',
      dimensions: [0.6, 0.8, 0.8],
      position: [1.4, 3.2, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#334155',
      metalness: 0.7,
      roughness: 0.4,
      parentId: 'torso_body',
    },
    // Right Leg Segment (Attached to Right Hip Servo Horn!)
    {
      id: 'right_leg',
      name: 'Right Upper Leg',
      type: 'cylinder',
      dimensions: [0.35, 2.4, 0.35],
      position: [1.4, 1.6, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#818cf8',
      metalness: 0.5,
      roughness: 0.3,
      parentId: null,
      servoId: 'servo_right_hip',
    },
    // Right Foot
    {
      id: 'right_foot',
      name: 'Right Foot Pad',
      type: 'box',
      dimensions: [0.9, 0.3, 1.6],
      position: [1.4, 0.15, 0.3],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#0f172a',
      metalness: 0.8,
      roughness: 0.5,
      parentId: 'right_leg',
    },
  ],
  servos: [
    {
      id: 'servo_left_hip',
      name: 'Left Hip Servo',
      pin: 9,
      currentAngle: 90,
      targetAngle: 90,
      minAngle: 20,
      maxAngle: 160,
      trim: 0,
      speed: 180,
      rotationAxis: 'y',
      model: 'SG90',
      position: [-1.4, 2.9, 0],
      rotation: [0, 0, 0],
      attachedPartId: 'left_leg',
      parentPartId: 'left_hip_bracket',
    },
    {
      id: 'servo_right_hip',
      name: 'Right Hip Servo',
      pin: 10,
      currentAngle: 90,
      targetAngle: 90,
      minAngle: 20,
      maxAngle: 160,
      trim: 0,
      speed: 180,
      rotationAxis: 'y',
      model: 'SG90',
      position: [1.4, 2.9, 0],
      rotation: [0, 0, 0],
      attachedPartId: 'right_leg',
      parentPartId: 'right_hip_bracket',
    },
  ],
  sequences: [
    {
      id: 'seq_walk',
      name: 'Walking Gait Cycle',
      description: 'Alternating stride sequence for forward momentum',
      loop: true,
      speedMultiplier: 1.0,
      keyframes: [
        {
          id: 'kf_1',
          name: 'Neutral Stance',
          timestampMs: 0,
          durationMs: 400,
          angles: { servo_left_hip: 90, servo_right_hip: 90 },
        },
        {
          id: 'kf_2',
          name: 'Left Leg Forward',
          timestampMs: 400,
          durationMs: 400,
          angles: { servo_left_hip: 120, servo_right_hip: 60 },
        },
        {
          id: 'kf_3',
          name: 'Neutral Mid-Stride',
          timestampMs: 800,
          durationMs: 400,
          angles: { servo_left_hip: 90, servo_right_hip: 90 },
        },
        {
          id: 'kf_4',
          name: 'Right Leg Forward',
          timestampMs: 1200,
          durationMs: 400,
          angles: { servo_left_hip: 60, servo_right_hip: 120 },
        },
      ],
    },
    {
      id: 'seq_dance',
      name: 'Wiggle Stance Dance',
      description: 'Rapid side-to-side oscillation',
      loop: true,
      speedMultiplier: 1.5,
      keyframes: [
        {
          id: 'kf_d1',
          name: 'Lean Left',
          timestampMs: 0,
          durationMs: 250,
          angles: { servo_left_hip: 110, servo_right_hip: 110 },
        },
        {
          id: 'kf_d2',
          name: 'Lean Right',
          timestampMs: 250,
          durationMs: 250,
          angles: { servo_left_hip: 70, servo_right_hip: 70 },
        },
      ],
    },
  ],
};

export const DEFAULT_ARM_PROJECT: RobotProject = {
  id: 'proj_arm_01',
  name: '4-DOF Robotic Arm',
  description: 'Precision mechanical articulated arm with base turntable, shoulder, elbow, and claw gripper.',
  boardType: 'uno',
  createdAt: '2026-10-31',
  updatedAt: '2026-10-31',
  customCode: `// 4-DOF Robotic Arm Control
#include <Servo.h>

Servo baseS;     // Pin 3
Servo shoulderS; // Pin 5
Servo elbowS;    // Pin 6
Servo clawS;     // Pin 9

void setup() {
  baseS.attach(3);
  shoulderS.attach(5);
  elbowS.attach(6);
  clawS.attach(9);
  
  baseS.write(90);
  shoulderS.write(45);
  elbowS.write(120);
  clawS.write(40);
}

void loop() {
  // Reach and Grab
  shoulderS.write(85);
  elbowS.write(75);
  delay(600);
  clawS.write(110);
  delay(400);

  // Lift
  shoulderS.write(40);
  delay(500);
  baseS.write(140);
  delay(600);

  // Drop
  clawS.write(40);
  delay(400);
  baseS.write(90);
  delay(600);
}`,
  parts: [
    {
      id: 'arm_base_pedestal',
      name: 'Floor Mount Base',
      type: 'cylinder',
      dimensions: [1.8, 0.5, 1.8],
      position: [0, 0.25, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#1e293b',
      metalness: 0.8,
      roughness: 0.3,
      parentId: null,
    },
    {
      id: 'arm_turntable',
      name: 'Rotating Turntable',
      type: 'cylinder',
      dimensions: [1.4, 0.4, 1.4],
      position: [0, 0.7, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#0284c7',
      metalness: 0.6,
      roughness: 0.4,
      parentId: null,
      servoId: 'servo_base',
    },
    {
      id: 'arm_shoulder_bracket',
      name: 'Shoulder Hinge',
      type: 'joint_bracket',
      dimensions: [0.8, 0.8, 0.8],
      position: [0, 1.3, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#475569',
      metalness: 0.7,
      roughness: 0.3,
      parentId: 'arm_turntable',
    },
    {
      id: 'arm_bicep',
      name: 'Upper Arm Boom',
      type: 'box',
      dimensions: [0.5, 2.6, 0.5],
      position: [0, 2.7, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#38bdf8',
      metalness: 0.4,
      roughness: 0.2,
      parentId: null,
      servoId: 'servo_shoulder',
    },
    {
      id: 'arm_forearm',
      name: 'Forearm Link',
      type: 'box',
      dimensions: [0.4, 2.2, 0.4],
      position: [0, 4.2, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#818cf8',
      metalness: 0.5,
      roughness: 0.2,
      parentId: null,
      servoId: 'servo_elbow',
    },
    {
      id: 'arm_claw',
      name: 'End Effector Gripper',
      type: 'gripper',
      dimensions: [0.8, 0.9, 0.8],
      position: [0, 5.5, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#f59e0b',
      metalness: 0.7,
      roughness: 0.3,
      parentId: null,
      servoId: 'servo_gripper',
    },
  ],
  servos: [
    {
      id: 'servo_base',
      name: 'Base Azimuth (Pan)',
      pin: 3,
      currentAngle: 90,
      targetAngle: 90,
      minAngle: 0,
      maxAngle: 180,
      trim: 0,
      speed: 150,
      rotationAxis: 'y',
      model: 'MG995',
      position: [0, 0.5, 0],
      rotation: [0, 0, 0],
      attachedPartId: 'arm_turntable',
      parentPartId: 'arm_base_pedestal',
    },
    {
      id: 'servo_shoulder',
      name: 'Shoulder Elevation',
      pin: 5,
      currentAngle: 45,
      targetAngle: 45,
      minAngle: 10,
      maxAngle: 170,
      trim: 0,
      speed: 120,
      rotationAxis: 'y',
      model: 'MG995',
      position: [0, 1.4, 0],
      rotation: [0, 0, 0],
      attachedPartId: 'arm_bicep',
      parentPartId: 'arm_shoulder_bracket',
    },
    {
      id: 'servo_elbow',
      name: 'Elbow Joint',
      pin: 6,
      currentAngle: 120,
      targetAngle: 120,
      minAngle: 20,
      maxAngle: 160,
      trim: 0,
      speed: 120,
      rotationAxis: 'y',
      model: 'SG90',
      position: [0, 3.8, 0],
      rotation: [0, 0, 0],
      attachedPartId: 'arm_forearm',
      parentPartId: 'arm_bicep',
    },
    {
      id: 'servo_gripper',
      name: 'Claw Gripper',
      pin: 9,
      currentAngle: 40,
      targetAngle: 40,
      minAngle: 10,
      maxAngle: 130,
      trim: 0,
      speed: 200,
      rotationAxis: 'y',
      model: 'SG90',
      position: [0, 5.1, 0],
      rotation: [0, 0, 0],
      attachedPartId: 'arm_claw',
      parentPartId: 'arm_forearm',
    },
  ],
  sequences: [
    {
      id: 'seq_pick_place',
      name: 'Pick & Place Cycle',
      description: 'Reach down, clamp object, rotate 90 degrees, and release',
      loop: true,
      speedMultiplier: 1.0,
      keyframes: [
        {
          id: 'kf_a1',
          name: 'Home Rest',
          timestampMs: 0,
          durationMs: 500,
          angles: { servo_base: 90, servo_shoulder: 45, servo_elbow: 120, servo_gripper: 40 },
        },
        {
          id: 'kf_a2',
          name: 'Reach Down',
          timestampMs: 500,
          durationMs: 700,
          angles: { servo_base: 45, servo_shoulder: 85, servo_elbow: 75, servo_gripper: 40 },
        },
        {
          id: 'kf_a3',
          name: 'Clamp Jaw',
          timestampMs: 1200,
          durationMs: 400,
          angles: { servo_base: 45, servo_shoulder: 85, servo_elbow: 75, servo_gripper: 110 },
        },
        {
          id: 'kf_a4',
          name: 'Lift Up',
          timestampMs: 1600,
          durationMs: 600,
          angles: { servo_base: 45, servo_shoulder: 40, servo_elbow: 110, servo_gripper: 110 },
        },
        {
          id: 'kf_a5',
          name: 'Swing to Bin',
          timestampMs: 2200,
          durationMs: 700,
          angles: { servo_base: 135, servo_shoulder: 40, servo_elbow: 110, servo_gripper: 110 },
        },
        {
          id: 'kf_a6',
          name: 'Open Jaw',
          timestampMs: 2900,
          durationMs: 400,
          angles: { servo_base: 135, servo_shoulder: 70, servo_elbow: 90, servo_gripper: 30 },
        },
      ],
    },
  ],
};

export const ELECTRONIC_COMPONENTS: ElectronicComponent[] = [
  {
    id: 'comp_sg90_servo',
    name: 'SG90 Micro Servo (9g)',
    category: 'actuator',
    description: 'High-torque miniature 180-degree positional servo motor for robotic joints and arms.',
    workingVoltage: '4.8V – 6.0V',
    iconName: 'Cog',
    pins: [
      { name: 'PWM Signal (Orange/Yellow)', type: 'pwm', recommendedPin: 'Pin 9, 10, or 6' },
      { name: 'VCC (+5V Red)', type: 'power', recommendedPin: '5V (External battery pack recommended for >2 servos)' },
      { name: 'GND (Brown/Black)', type: 'ground', recommendedPin: 'Arduino GND (Common Ground)' },
    ],
    wiringInstructions: [
      'Connect Brown/Black wire to Arduino GND.',
      'Connect Red wire to 5V rail (or external 5V/6V UBEC battery for higher stall currents).',
      'Connect Orange/Yellow wire to any Arduino PWM-capable pin (e.g. Pin 9).',
      'Always connect Arduino GND and external servo power GND together.',
    ],
    exampleCode: `#include <Servo.h>\nServo myServo;\nvoid setup() {\n  myServo.attach(9);\n}\nvoid loop() {\n  myServo.write(90);\n  delay(1000);\n  myServo.write(180);\n  delay(1000);\n}`,
  },
  {
    id: 'comp_led',
    name: 'Standard 5mm LED Indicator',
    category: 'output',
    description: 'Semiconductor light source for status indication, robotic eye illumination, and PWM dimming.',
    workingVoltage: '1.8V – 3.3V (Requires current limiting resistor)',
    iconName: 'Zap',
    pins: [
      { name: 'Anode (+ Long Leg)', type: 'digital', recommendedPin: 'Pin 13 or PWM Pin 3/5/6 via 220Ω' },
      { name: 'Cathode (- Flat edge)', type: 'ground', recommendedPin: 'GND' },
    ],
    wiringInstructions: [
      'Place a 220Ω or 330Ω resistor between Arduino digital pin and LED anode (long leg).',
      'Connect the short leg (cathode) directly to Arduino GND.',
      'Use analogWrite(pin, 0..255) for smooth brightness control.',
    ],
    exampleCode: `void setup() {\n  pinMode(13, OUTPUT);\n}\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(500);\n  digitalWrite(13, LOW);\n  delay(500);\n}`,
  },
  {
    id: 'comp_ultrasonic',
    name: 'HC-SR04 Ultrasonic Distance Sensor',
    category: 'sensor',
    description: 'Sonar distance ranging module detecting obstacles from 2cm to 400cm with 3mm precision.',
    workingVoltage: '5V DC',
    iconName: 'Radio',
    pins: [
      { name: 'VCC', type: 'power', recommendedPin: '5V' },
      { name: 'Trig (Trigger Output)', type: 'digital', recommendedPin: 'Pin 12' },
      { name: 'Echo (Pulse Input)', type: 'digital', recommendedPin: 'Pin 11' },
      { name: 'GND', type: 'ground', recommendedPin: 'GND' },
    ],
    wiringInstructions: [
      'VCC to Arduino 5V, GND to Arduino GND.',
      'Trig pin to Digital Pin 12 (Outputs 10µs ultrasonic burst).',
      'Echo pin to Digital Pin 11 (Reads reflected pulse width in microseconds).',
      'Distance (cm) = (Duration / 2) / 29.1.',
    ],
    exampleCode: `const int trigPin = 12;\nconst int echoPin = 11;\nvoid setup() {\n  Serial.begin(115200);\n  pinMode(trigPin, OUTPUT);\n  pinMode(echoPin, INPUT);\n}\nvoid loop() {\n  digitalWrite(trigPin, LOW);\n  delayMicroseconds(2);\n  digitalWrite(trigPin, HIGH);\n  delayMicroseconds(10);\n  digitalWrite(trigPin, LOW);\n  long duration = pulseIn(echoPin, HIGH);\n  int distance = duration * 0.034 / 2;\n  Serial.print("Distance: "); Serial.print(distance); Serial.println(" cm");\n  delay(100);\n}`,
  },
  {
    id: 'comp_potentiometer',
    name: 'Rotary Potentiometer (10kΩ)',
    category: 'input',
    description: 'Analog rotary dial for manual servo steering, robotic joint teaching, or motor speed throttle.',
    workingVoltage: '0V – 5V',
    iconName: 'Sliders',
    pins: [
      { name: 'Pin 1 (VCC)', type: 'power', recommendedPin: '5V' },
      { name: 'Pin 2 (Wiper Output)', type: 'analog', recommendedPin: 'Analog Pin A0' },
      { name: 'Pin 3 (GND)', type: 'ground', recommendedPin: 'GND' },
    ],
    wiringInstructions: [
      'Outer pin 1 to Arduino 5V.',
      'Center pin (wiper) to Analog Input A0.',
      'Outer pin 3 to Arduino GND.',
      'Map the 0-1023 analog reading to 0-180 degrees using map(val, 0, 1023, 0, 180).',
    ],
    exampleCode: `void setup() {\n  Serial.begin(115200);\n}\nvoid loop() {\n  int raw = analogRead(A0);\n  int angle = map(raw, 0, 1023, 0, 180);\n  Serial.print("Servo Angle: "); Serial.println(angle);\n  delay(50);\n}`,
  },
  {
    id: 'comp_buzzer',
    name: 'Piezo Buzzer (Audio Alert)',
    category: 'output',
    description: 'Acoustic transducer emitting beep signals, boot melodies, and obstacle proximity warnings.',
    workingVoltage: '3.3V – 5V',
    iconName: 'Volume2',
    pins: [
      { name: 'Positive (+)', type: 'pwm', recommendedPin: 'Pin 8 or PWM Pin 3' },
      { name: 'Negative (-)', type: 'ground', recommendedPin: 'GND' },
    ],
    wiringInstructions: [
      'Positive lead to Arduino Pin 8.',
      'Negative lead to Arduino GND.',
      'Use tone(pin, frequencyHz, durationMs) for musical notes or beep alerts.',
    ],
    exampleCode: `void setup() {\n  tone(8, 1000, 200); // 1kHz beep for 200ms\n}\nvoid loop() {}`,
  },
  {
    id: 'comp_ldr',
    name: 'LDR Photoresistor (Light Sensor)',
    category: 'sensor',
    description: 'Cadmium-sulfide light dependent resistor for robot eye vision, day/night trigger, and phototaxis.',
    workingVoltage: '0V – 5V (Voltage divider)',
    iconName: 'Sun',
    pins: [
      { name: 'Terminal 1', type: 'power', recommendedPin: '5V' },
      { name: 'Terminal 2 (Divided)', type: 'analog', recommendedPin: 'A1 (with 10kΩ resistor to GND)' },
    ],
    wiringInstructions: [
      'Connect one leg of LDR to 5V.',
      'Connect other leg to Analog Pin A1 AND to a 10kΩ pull-down resistor to GND.',
      'Reads higher analog values in bright ambient lighting and lower values in darkness.',
    ],
    exampleCode: `void setup() {\n  Serial.begin(115200);\n}\nvoid loop() {\n  int lightLevel = analogRead(A1);\n  Serial.println(lightLevel);\n  delay(200);\n}`,
  },
];

export {
  DEFAULT_40_PART_TITAN_PROJECT,
  ROBOT_40_PARTS,
  ROBOT_40_SERVOS,
  MODULAR_40_PARTS_CATALOG,
} from './robot40Parts';

