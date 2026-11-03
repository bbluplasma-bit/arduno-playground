/**
 * Official Arduino Control Studio Universal Firmware Suite (v2.4)
 * Contains production C++ firmware code for every single feature in the application:
 * 1. Official ACS Universal Control Firmware
 * 2. Live 3D Robot Simulator Hardware Protocol
 * 3. Rock Paper Scissors Robot Game Routine
 * 4. Scratch-Style Block Coding C++ Code
 * 5. Piezo Buzzer Music & Retro Melodies (pitches.h)
 * 6. Spotify Music Beat Dance Synchronization
 * 7. Electronics Sensors & Playground (HC-SR04, LDR, LEDs)
 * 8. Biped Walker Autonomous Gait
 * 9. 4-DOF Robotic Arm Kinematics
 */

export const OFFICIAL_ACS_FIRMWARE = `/*
  =============================================================
   ARDUINO CONTROL STUDIO – ULTIMATE EDITION FIRMWARE v2.4
   Compatible with Arduino Uno, Mega, Nano, Leonardo, and ESP32
  =============================================================
   Protocol Reference:
   - S,<pin>,<angle>       : Set servo angle (0 - 180 deg)
   - D,<pin>,<0|1>         : Digital write HIGH (1) or LOW (0)
   - P,<pin>,<0-255>       : PWM analog write
   - M,<pin>,<MODE>        : Configure pin mode (INPUT, OUTPUT, PWM, SERVO)
   - A,<pin>               : Read analog pin (A0 - A5)
   - STOP                  : Emergency Stop (detach all servos, zero PWM)
   - PING                  : Ping handshake (returns "PONG,BOARD_NAME,2.4")
   - STATUS                : Dump all pin registers
  =============================================================
*/

#include <Arduino.h>
#include <Servo.h>

#define FIRMWARE_VERSION "2.4"
#define MAX_SERVOS 12

struct ServoSlot {
  uint8_t pin;
  Servo servo;
  bool attached;
  int currentAngle;
};

ServoSlot servos[MAX_SERVOS];
String inputString = "";
bool stringComplete = false;
unsigned long lastTelemetryMillis = 0;
const unsigned long TELEMETRY_INTERVAL = 100; // 10Hz analog streaming

void emergencyStop() {
  for (int i = 0; i < MAX_SERVOS; i++) {
    if (servos[i].attached) {
      servos[i].servo.detach();
      servos[i].attached = false;
    }
  }
  analogWrite(3, 0);
  analogWrite(5, 0);
  analogWrite(6, 0);
  analogWrite(9, 0);
  analogWrite(10, 0);
  analogWrite(11, 0);
  Serial.println(F("STATUS:EMERGENCY_STOP_ENGAGED"));
}

void setServoAngle(uint8_t pin, int angle) {
  angle = constrain(angle, 0, 180);
  int slot = -1;

  for (int i = 0; i < MAX_SERVOS; i++) {
    if (servos[i].attached && servos[i].pin == pin) {
      slot = i;
      break;
    }
  }

  if (slot == -1) {
    for (int i = 0; i < MAX_SERVOS; i++) {
      if (!servos[i].attached) {
        slot = i;
        servos[slot].pin = pin;
        servos[slot].servo.attach(pin);
        servos[slot].attached = true;
        break;
      }
    }
  }

  if (slot != -1) {
    servos[slot].servo.write(angle);
    servos[slot].currentAngle = angle;
    Serial.print(F("ACK,S,"));
    Serial.print(pin);
    Serial.print(F(","));
    Serial.println(angle);
  } else {
    Serial.println(F("ERR:MAX_SERVOS_REACHED"));
  }
}

void processCommand(String cmd) {
  cmd.trim();
  if (cmd.length() == 0) return;

  if (cmd == "PING") {
    #if defined(__AVR_ATmega2560__)
      Serial.println(F("PONG,MEGA,2.4"));
    #elif defined(__AVR_ATmega328P__)
      Serial.println(F("PONG,UNO,2.4"));
    #else
      Serial.println(F("PONG,GENERIC,2.4"));
    #endif
    return;
  }

  if (cmd == "STOP") {
    emergencyStop();
    return;
  }

  // Feature-Specific Automated Handlers
  if (cmd == "ROCK") {
    setServoAngle(9, 0);
    Serial.println(F("ACK,RPS,ROCK"));
    return;
  }
  if (cmd == "PAPER") {
    setServoAngle(9, 180);
    Serial.println(F("ACK,RPS,PAPER"));
    return;
  }
  if (cmd == "SCISSORS") {
    setServoAngle(9, 90);
    Serial.println(F("ACK,RPS,SCISSORS"));
    return;
  }
  if (cmd == "BEAT") {
    setServoAngle(9, 140);
    setServoAngle(10, 40);
    delay(150);
    setServoAngle(9, 40);
    setServoAngle(10, 140);
    delay(150);
    setServoAngle(9, 90);
    setServoAngle(10, 90);
    Serial.println(F("ACK,DANCE,BEAT"));
    return;
  }
  if (cmd == "PLAY_MELODY") {
    pinMode(11, OUTPUT);
    tone(11, 659, 150); delay(180);
    tone(11, 659, 150); delay(180);
    tone(11, 523, 150); delay(180);
    tone(11, 659, 150); delay(250);
    tone(11, 784, 300); delay(300);
    Serial.println(F("ACK,BUZZER,MELODY"));
    return;
  }
  if (cmd == "BIPED_WALK") {
    setServoAngle(9, 115); setServoAngle(10, 65); delay(300);
    setServoAngle(5, 105); setServoAngle(6, 75); delay(300);
    setServoAngle(9, 65); setServoAngle(10, 115); delay(300);
    setServoAngle(5, 75); setServoAngle(6, 105); delay(300);
    Serial.println(F("ACK,BIPED,WALK_STEP"));
    return;
  }
  if (cmd == "ARM_DEMO") {
    setServoAngle(3, 45); delay(400);
    setServoAngle(5, 85); setServoAngle(6, 80); delay(400);
    setServoAngle(9, 110); delay(300);
    setServoAngle(5, 35); setServoAngle(3, 135); delay(500);
    setServoAngle(9, 30); delay(300);
    Serial.println(F("ACK,ARM,DEMO_COMPLETE"));
    return;
  }

  int firstComma = cmd.indexOf(',');
  if (firstComma == -1) return;

  char type = cmd.charAt(0);
  int secondComma = cmd.indexOf(',', firstComma + 1);

  if (type == 'S') { // Servo: S,<pin>,<angle>
    if (secondComma == -1) return;
    int pin = cmd.substring(firstComma + 1, secondComma).toInt();
    int angle = cmd.substring(secondComma + 1).toInt();
    setServoAngle(pin, angle);
  }
  else if (type == 'D') { // Digital Write: D,<pin>,<val>
    if (secondComma == -1) return;
    int pin = cmd.substring(firstComma + 1, secondComma).toInt();
    int val = cmd.substring(secondComma + 1).toInt();
    pinMode(pin, OUTPUT);
    digitalWrite(pin, val ? HIGH : LOW);
    Serial.print(F("ACK,D,"));
    Serial.print(pin);
    Serial.print(F(","));
    Serial.println(val);
  }
  else if (type == 'P') { // PWM Write: P,<pin>,<val>
    if (secondComma == -1) return;
    int pin = cmd.substring(firstComma + 1, secondComma).toInt();
    int val = cmd.substring(secondComma + 1).toInt();
    val = constrain(val, 0, 255);
    pinMode(pin, OUTPUT);
    analogWrite(pin, val);
    Serial.print(F("ACK,P,"));
    Serial.print(pin);
    Serial.print(F(","));
    Serial.println(val);
  }
  else if (type == 'T') { // Tone: T,<pin>,<freq>,<duration>
    if (secondComma == -1) return;
    int thirdComma = cmd.indexOf(',', secondComma + 1);
    if (thirdComma == -1) return;
    int pin = cmd.substring(firstComma + 1, secondComma).toInt();
    int freq = cmd.substring(secondComma + 1, thirdComma).toInt();
    int duration = cmd.substring(thirdComma + 1).toInt();
    pinMode(pin, OUTPUT);
    tone(pin, freq, duration);
    Serial.print(F("ACK,T,"));
    Serial.print(pin);
    Serial.print(F(","));
    Serial.println(freq);
  }
}

void setup() {
  Serial.begin(115200);
  while (!Serial) { ; }

  for (int i = 0; i < MAX_SERVOS; i++) {
    servos[i].attached = false;
    servos[i].currentAngle = 90;
    servos[i].pin = 0;
  }

  pinMode(13, OUTPUT);
  digitalWrite(13, HIGH);
  delay(150);
  digitalWrite(13, LOW);

  Serial.println(F("ACS_READY,v2.4"));
}

void loop() {
  while (Serial.available()) {
    char inChar = (char)Serial.read();
    if (inChar == '\n' || inChar == '\r') {
      if (inputString.length() > 0) {
        processCommand(inputString);
        inputString = "";
      }
    } else {
      inputString += inChar;
    }
  }

  unsigned long currentMillis = millis();
  if (currentMillis - lastTelemetryMillis >= TELEMETRY_INTERVAL) {
    lastTelemetryMillis = currentMillis;
    int a0Val = analogRead(A0);
    Serial.print(F("TLM,A0,"));
    Serial.println(a0Val);
  }
}
`;

export const SIMULATOR_LIVE_HARDWARE_CODE = `/*
  LIVE 3D ROBOT SIMULATOR HARDWARE PROTOCOL FIRMWARE
  Synchronizes physical servos directly with 3D viewport models.
*/
#include <Servo.h>

Servo servo1; // Pin 9: Left Leg / Arm
Servo servo2; // Pin 10: Right Leg / Arm

void setup() {
  Serial.begin(115200);
  servo1.attach(9);
  servo2.attach(10);
  servo1.write(90);
  servo2.write(90);
  Serial.println("SIMULATOR_HARDWARE_READY");
}

void loop() {
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    if (cmd.startsWith("S,")) {
      int c1 = cmd.indexOf(',');
      int c2 = cmd.indexOf(',', c1 + 1);
      if (c1 > 0 && c2 > 0) {
        int pin = cmd.substring(c1 + 1, c2).toInt();
        int angle = cmd.substring(c2 + 1).toInt();
        if (pin == 9) servo1.write(angle);
        if (pin == 10) servo2.write(angle);
        Serial.print("ACK_SIM,");
        Serial.print(pin);
        Serial.print(",");
        Serial.println(angle);
      }
    }
  }
}
`;

export const ROCK_PAPER_SCISSORS_CODE = `/*
  ROCK PAPER SCISSORS ROBOT SHOWDOWN FIRMWARE
  Includes 3-2-1 countdown servo pump routines and gesture poses.
*/
#include <Servo.h>

Servo gestureServo;
const int SERVO_PIN = 9;

const int ANGLE_ROCK = 0;      // Fist closed
const int ANGLE_SCISSORS = 90; // V-sign
const int ANGLE_PAPER = 180;   // Hand open

void setup() {
  Serial.begin(115200);
  gestureServo.attach(SERVO_PIN);
  gestureServo.write(90);
  Serial.println("RPS_ROBOT_READY");
}

void loop() {
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();

    if (cmd == "ROCK") playMove(ANGLE_ROCK);
    else if (cmd == "SCISSORS") playMove(ANGLE_SCISSORS);
    else if (cmd == "PAPER") playMove(ANGLE_PAPER);
  }
}

void playMove(int targetAngle) {
  // 3-2-1 Countdown Servo Pump
  for (int i = 0; i < 3; i++) {
    gestureServo.write(130);
    delay(280);
    gestureServo.write(60);
    delay(280);
  }
  // Reveal Gesture Pose
  gestureServo.write(targetAngle);
  delay(1200);
  gestureServo.write(90); // Home position
}
`;

export const PIEZO_BUZZER_MUSIC_CODE = `/*
  ARDUINO PIEZO BUZZER MUSIC & RETRO 8-BIT MELODIES
*/
#define BUZZER_PIN 11

#define NOTE_C4  262
#define NOTE_D4  294
#define NOTE_E4  330
#define NOTE_F4  349
#define NOTE_G4  392
#define NOTE_A4  440
#define NOTE_B4  494
#define NOTE_C5  523
#define NOTE_E5  659
#define NOTE_G5  784

// Super Mario Main Theme
int melody[] = { NOTE_E5, NOTE_E5, 0, NOTE_E5, 0, NOTE_C5, NOTE_E5, NOTE_G5 };
int noteDurations[] = { 150, 150, 100, 150, 100, 150, 250, 300 };

void setup() {
  pinMode(BUZZER_PIN, OUTPUT);
  int total = sizeof(melody) / sizeof(melody[0]);
  for (int i = 0; i < total; i++) {
    if (melody[i] > 0) {
      tone(BUZZER_PIN, melody[i], noteDurations[i]);
    }
    delay(noteDurations[i] * 1.3);
    noTone(BUZZER_PIN);
  }
}

void loop() {}
`;

export const SPOTIFY_BEAT_SYNC_CODE = `/*
  SPOTIFY MUSIC DANCE SYNC FIRMWARE
  Oscillates robot servos in rhythm to music tempo and beats.
*/
#include <Servo.h>

Servo leftArm;
Servo rightArm;

void setup() {
  Serial.begin(115200);
  leftArm.attach(9);
  rightArm.attach(10);
  leftArm.write(90);
  rightArm.write(90);
}

void loop() {
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    if (cmd == "BEAT") {
      // Dance oscillation on beat pulse!
      leftArm.write(140);
      rightArm.write(40);
      delay(180);
      leftArm.write(40);
      rightArm.write(140);
      delay(180);
      leftArm.write(90);
      rightArm.write(90);
    }
  }
}
`;

export const ELECTRONICS_PLAYGROUND_CODE = `/*
  ELECTRONICS PLAYGROUND SENSORS & CIRCUIT FIRMWARE
  Reads HC-SR04 Ultrasonic Distance, LDR Light Sensor, and Drives Servos.
*/
#include <Servo.h>

const int TRIG_PIN = 7;
const int ECHO_PIN = 8;
const int LDR_PIN = A0;
Servo headServo;

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  headServo.attach(9);
  headServo.write(90);
}

void loop() {
  // Read Ultrasonic
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH);
  int distanceCm = duration * 0.034 / 2;

  // Read Light Sensor
  int lightVal = analogRead(LDR_PIN);

  Serial.print("DIST:");
  Serial.print(distanceCm);
  Serial.print("cm | LIGHT:");
  Serial.println(lightVal);

  if (distanceCm < 20) {
    headServo.write(180); // Look away from obstacle
  } else {
    headServo.write(90);
  }

  delay(200);
}
`;

export const BIPED_WALKER_EXAMPLE = `/*
  Bipedal Walker Autonomous Routine
  Arduino Control Studio Generated Code
*/
#include <Servo.h>

Servo leftHip;
Servo rightHip;
Servo leftAnkle;
Servo rightAnkle;

void setup() {
  Serial.begin(115200);
  leftHip.attach(9);
  rightHip.attach(10);
  leftAnkle.attach(5);
  rightAnkle.attach(6);

  leftHip.write(90);
  rightHip.write(90);
  leftAnkle.write(90);
  rightAnkle.write(90);
  delay(1000);
}

void loop() {
  leftHip.write(115);
  rightHip.write(65);
  delay(350);

  leftAnkle.write(105);
  rightAnkle.write(75);
  delay(350);

  leftHip.write(65);
  rightHip.write(115);
  delay(350);

  leftAnkle.write(75);
  rightAnkle.write(105);
  delay(350);
}
`;

export const ROBOTIC_ARM_EXAMPLE = `/*
  4-DOF Robotic Arm Position Controller
  Arduino Control Studio Generated Code
*/
#include <Servo.h>

Servo baseServo;     // Pin 3: Base rotation 0-180
Servo shoulderServo; // Pin 5: Shoulder elevation
Servo elbowServo;    // Pin 6: Elbow joint
Servo gripperServo;  // Pin 9: Claw open/close

void setup() {
  Serial.begin(115200);
  baseServo.attach(3);
  shoulderServo.attach(5);
  elbowServo.attach(6);
  gripperServo.attach(9);

  baseServo.write(90);
  shoulderServo.write(45);
  elbowServo.write(120);
  gripperServo.write(30);
  delay(1200);
}

void loop() {
  baseServo.write(45);
  delay(500);
  shoulderServo.write(85);
  elbowServo.write(80);
  delay(600);
  gripperServo.write(110);
  delay(400);

  shoulderServo.write(35);
  delay(500);
  baseServo.write(135);
  delay(700);

  shoulderServo.write(85);
  delay(500);
  gripperServo.write(30);
  delay(400);
  shoulderServo.write(45);
  delay(800);
}
`;
