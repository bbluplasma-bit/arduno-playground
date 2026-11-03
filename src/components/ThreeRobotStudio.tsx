import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RobotPart, ServoMotor, PartGeometryType } from '../types';
import { arduinoSerial } from '../services/arduinoSerial';
import {
  Maximize2,
  Minimize2,
  RotateCw,
  Plus,
  Trash2,
  Copy,
  Layers,
  Sliders,
  Cpu,
  Move,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
  MousePointer,
  Magnet,
  Link,
  Unlink,
  Lock,
  Pause,
  Zap,
  HelpCircle, // Added
} from 'lucide-react';
import { GuidedTour, TourStep } from './GuidedTour'; // Added

function isDescendantOf(child: THREE.Object3D, parent: THREE.Object3D): boolean {
  if (child === parent) return true;
  let curr = child.parent;
  while (curr) {
    if (curr === parent) return true;
    curr = curr.parent;
  }
  return false;
}

function wouldCreateCycle(child: THREE.Object3D, newParent: THREE.Object3D): boolean {
  if (child === newParent) return true;
  let curr: THREE.Object3D | null = newParent;
  while (curr) {
    if (curr === child) return true;
    curr = curr.parent;
  }
  return false;
}

function isHierarchyRelated(a: THREE.Object3D, b: THREE.Object3D): boolean {
  if (a === b) return true;
  let curr: THREE.Object3D | null = a;
  while (curr) {
    if (curr === b) return true;
    curr = curr.parent;
  }
  curr = b;
  while (curr) {
    if (curr === a) return true;
    curr = curr.parent;
  }
  return false;
}

function getAnchorOwner(name: string): { type: 'servo' | 'part'; id: string } | null {
  if (name.startsWith('SNAP_SERVO_HORN_')) return { type: 'servo', id: name.replace('SNAP_SERVO_HORN_', '') };
  if (name.startsWith('SNAP_SERVO_BASE_')) return { type: 'servo', id: name.replace('SNAP_SERVO_BASE_', '') };
  if (name.startsWith('SNAP_PART_TOP_')) return { type: 'part', id: name.replace('SNAP_PART_TOP_', '') };
  if (name.startsWith('SNAP_PART_CENTER_')) return { type: 'part', id: name.replace('SNAP_PART_CENTER_', '') };
  return null;
}

function isObjectInScene(obj: THREE.Object3D | null | undefined, scene: THREE.Scene | null): boolean {
  if (!obj || !scene) return false;
  if (obj === scene) return true;
  let curr: THREE.Object3D | null = obj.parent;
  while (curr) {
    if (curr === scene) return true;
    curr = curr.parent;
  }
  return false;
}

const ELECTRONIC_COMPONENT_TYPES = new Set<PartGeometryType>([
  'arduino_uno',
  'microbit',
  'breadboard',
  'sensor_ultrasonic',
  'sensor_pir',
  'sensor_ldr',
  'piezo_buzzer',
  'led',
  'battery_9v',
  'battery_coin',
  'dc_motor',
  'gearmotor',
  'multimeter',
  'potentiometer',
  'switch_slide',
  'pushbutton',
  'resistor',
  'capacitor',
]);

function createElectronicComponentGroup(part: RobotPart, isSelected: boolean, showWireframe: boolean): THREE.Group {
  const group = new THREE.Group();
  const [w, h, d] = part.dimensions;

  const pcbMat = (colorVal: number, metal = 0.3, rough = 0.4) =>
    new THREE.MeshStandardMaterial({
      color: isSelected ? 0x00d2ff : colorVal,
      metalness: metal,
      roughness: rough,
      wireframe: showWireframe,
      emissive: isSelected ? 0x004466 : 0x000000,
    });

  const metalMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.9,
    roughness: 0.2,
    wireframe: showWireframe,
  });

  const blackMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.2,
    roughness: 0.5,
    wireframe: showWireframe,
  });

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    metalness: 0.8,
    roughness: 0.3,
    wireframe: showWireframe,
  });

  switch (part.type) {
    case 'arduino_uno': {
      const boardGeo = new THREE.BoxGeometry(w, 0.1, d);
      const boardMesh = new THREE.Mesh(boardGeo, pcbMat(0x00878f, 0.4, 0.3));
      group.add(boardMesh);

      const usbGeo = new THREE.BoxGeometry(0.6, 0.3, 0.45);
      const usbMesh = new THREE.Mesh(usbGeo, metalMat);
      usbMesh.position.set(-w / 2 + 0.3, 0.18, d / 4);
      group.add(usbMesh);

      const dcJackGeo = new THREE.BoxGeometry(0.5, 0.35, 0.4);
      const dcJackMesh = new THREE.Mesh(dcJackGeo, blackMat);
      dcJackMesh.position.set(-w / 2 + 0.3, 0.2, -d / 3);
      group.add(dcJackMesh);

      const headerTopGeo = new THREE.BoxGeometry(w * 0.75, 0.18, 0.12);
      const headerTopMesh = new THREE.Mesh(headerTopGeo, blackMat);
      headerTopMesh.position.set(0.1, 0.12, d / 2 - 0.1);
      group.add(headerTopMesh);

      const headerBotGeo = new THREE.BoxGeometry(w * 0.7, 0.18, 0.12);
      const headerBotMesh = new THREE.Mesh(headerBotGeo, blackMat);
      headerBotMesh.position.set(0.1, 0.12, -d / 2 + 0.1);
      group.add(headerBotMesh);

      const icGeo = new THREE.BoxGeometry(1.0, 0.12, 0.3);
      const icMesh = new THREE.Mesh(icGeo, blackMat);
      icMesh.position.set(0.2, 0.1, -0.1);
      group.add(icMesh);

      const btnGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.15, 12);
      const btnMat = new THREE.MeshStandardMaterial({ color: 0xef4444 });
      const btnMesh = new THREE.Mesh(btnGeo, btnMat);
      btnMesh.position.set(-w / 2 + 0.3, 0.15, d / 2 - 0.2);
      group.add(btnMesh);
      break;
    }

    case 'microbit': {
      const bodyGeo = new THREE.BoxGeometry(w, 0.1, d);
      const bodyMesh = new THREE.Mesh(bodyGeo, pcbMat(0x18181b, 0.3, 0.4));
      group.add(bodyMesh);

      const edgeGeo = new THREE.BoxGeometry(w, 0.06, 0.25);
      const edgeMesh = new THREE.Mesh(edgeGeo, goldMat);
      edgeMesh.position.set(0, 0.02, -d / 2 + 0.12);
      group.add(edgeMesh);

      const ledMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          const ledGeo = new THREE.BoxGeometry(0.08, 0.04, 0.08);
          const ledMesh = new THREE.Mesh(ledGeo, ledMat);
          ledMesh.position.set(-0.3 + c * 0.15, 0.08, -0.1 + r * 0.12);
          group.add(ledMesh);
        }
      }

      const btnMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0 });
      const btnAGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.12, 16);
      const btnAMesh = new THREE.Mesh(btnAGeo, btnMat);
      btnAMesh.position.set(-w / 2 + 0.3, 0.1, 0.2);
      const btnBMesh = new THREE.Mesh(btnAGeo, btnMat);
      btnBMesh.position.set(w / 2 - 0.3, 0.1, 0.2);
      group.add(btnAMesh);
      group.add(btnBMesh);
      break;
    }

    case 'breadboard': {
      const bodyGeo = new THREE.BoxGeometry(w, 0.2, d);
      const bodyMesh = new THREE.Mesh(bodyGeo, pcbMat(0xf8fafc, 0.1, 0.2));
      group.add(bodyMesh);

      const channelGeo = new THREE.BoxGeometry(w * 0.95, 0.04, 0.12);
      const channelMesh = new THREE.Mesh(channelGeo, blackMat);
      channelMesh.position.set(0, 0.1, 0);
      group.add(channelMesh);

      const redMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      const blueMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });

      const railRedTop = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.02, 0.05), redMat);
      railRedTop.position.set(0, 0.11, d / 2 - 0.15);
      const railBlueTop = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.02, 0.05), blueMat);
      railBlueTop.position.set(0, 0.11, d / 2 - 0.25);

      const railRedBot = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.02, 0.05), redMat);
      railRedBot.position.set(0, 0.11, -d / 2 + 0.15);
      const railBlueBot = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.02, 0.05), blueMat);
      railBlueBot.position.set(0, 0.11, -d / 2 + 0.25);

      group.add(railRedTop);
      group.add(railBlueTop);
      group.add(railRedBot);
      group.add(railBlueBot);
      break;
    }

    case 'sensor_ultrasonic': {
      const pcbGeo = new THREE.BoxGeometry(w, 0.08, d);
      const pcbMesh = new THREE.Mesh(pcbGeo, pcbMat(0x0284c7, 0.4, 0.3));
      group.add(pcbMesh);

      const eyeGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.45, 20);
      eyeGeo.rotateX(Math.PI / 2);

      const eyeLeft = new THREE.Mesh(eyeGeo, metalMat);
      eyeLeft.position.set(-w / 4 - 0.05, 0.25, 0);

      const eyeRight = new THREE.Mesh(eyeGeo, metalMat);
      eyeRight.position.set(w / 4 + 0.05, 0.25, 0);

      group.add(eyeLeft);
      group.add(eyeRight);

      const pinGeo = new THREE.BoxGeometry(0.4, 0.15, 0.1);
      const pinMesh = new THREE.Mesh(pinGeo, blackMat);
      pinMesh.position.set(0, -0.1, 0);
      group.add(pinMesh);
      break;
    }

    case 'sensor_pir': {
      const pcbGeo = new THREE.BoxGeometry(w, 0.08, d);
      const pcbMesh = new THREE.Mesh(pcbGeo, pcbMat(0x16a34a, 0.3, 0.4));
      group.add(pcbMesh);

      const domeGeo = new THREE.SphereGeometry(w * 0.45, 20, 20, 0, Math.PI * 2, 0, Math.PI / 2);
      const domeMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.1,
        transparent: true,
        opacity: 0.9,
      });
      const domeMesh = new THREE.Mesh(domeGeo, domeMat);
      domeMesh.position.set(0, 0.04, 0);
      group.add(domeMesh);
      break;
    }

    case 'sensor_ldr': {
      const diskGeo = new THREE.CylinderGeometry(w / 2, w / 2, 0.1, 16);
      const diskMesh = new THREE.Mesh(diskGeo, pcbMat(0xf59e0b, 0.2, 0.4));
      group.add(diskMesh);

      const trackGeo = new THREE.BoxGeometry(w * 0.7, 0.02, d * 0.5);
      const trackMat = new THREE.MeshBasicMaterial({ color: 0xdc2626 });
      const trackMesh = new THREE.Mesh(trackGeo, trackMat);
      trackMesh.position.y = 0.06;
      group.add(trackMesh);

      const leadGeo = new THREE.CylinderGeometry(0.02, 0.02, h, 8);
      const lead1 = new THREE.Mesh(leadGeo, metalMat);
      lead1.position.set(-w / 4, -h / 2, 0);
      const lead2 = new THREE.Mesh(leadGeo, metalMat);
      lead2.position.set(w / 4, -h / 2, 0);
      group.add(lead1);
      group.add(lead2);
      break;
    }

    case 'piezo_buzzer': {
      const bodyGeo = new THREE.CylinderGeometry(w / 2, w / 2, h, 24);
      const bodyMesh = new THREE.Mesh(bodyGeo, pcbMat(0x0f172a, 0.2, 0.4));
      group.add(bodyMesh);

      const holeGeo = new THREE.CylinderGeometry(w * 0.15, w * 0.15, 0.02, 12);
      const holeMesh = new THREE.Mesh(holeGeo, new THREE.MeshBasicMaterial({ color: 0x000000 }));
      holeMesh.position.y = h / 2 + 0.01;
      group.add(holeMesh);
      break;
    }

    case 'led': {
      const domeGeo = new THREE.CylinderGeometry(w / 2, w / 2, h * 0.6, 16);
      const topGeo = new THREE.SphereGeometry(w / 2, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
      topGeo.translate(0, h * 0.3, 0);

      const ledMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xaa0000,
        emissiveIntensity: 0.6,
        transparent: true,
        opacity: 0.85,
        roughness: 0.1,
      });

      const ledMesh = new THREE.Mesh(domeGeo, ledMat);
      const topMesh = new THREE.Mesh(topGeo, ledMat);
      group.add(ledMesh);
      group.add(topMesh);

      const rimGeo = new THREE.CylinderGeometry(w / 2 + 0.05, w / 2 + 0.05, 0.08, 16);
      const rimMesh = new THREE.Mesh(rimGeo, ledMat);
      rimMesh.position.y = -h * 0.3;
      group.add(rimMesh);

      const leadGeo1 = new THREE.CylinderGeometry(0.02, 0.02, h * 0.8, 8);
      const leadGeo2 = new THREE.CylinderGeometry(0.02, 0.02, h * 0.6, 8);

      const lead1 = new THREE.Mesh(leadGeo1, metalMat);
      lead1.position.set(-0.08, -h * 0.7, 0);
      const lead2 = new THREE.Mesh(leadGeo2, metalMat);
      lead2.position.set(0.08, -h * 0.6, 0);

      group.add(lead1);
      group.add(lead2);
      break;
    }

    case 'battery_9v': {
      const bodyGeo = new THREE.BoxGeometry(w, h, d);
      const bodyMesh = new THREE.Mesh(bodyGeo, pcbMat(0x0f172a, 0.5, 0.3));
      group.add(bodyMesh);

      const bandGeo = new THREE.BoxGeometry(w * 1.01, h * 0.3, d * 1.01);
      const bandMesh = new THREE.Mesh(bandGeo, goldMat);
      bandMesh.position.y = h * 0.2;
      group.add(bandMesh);

      const posGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.15, 12);
      const posMesh = new THREE.Mesh(posGeo, metalMat);
      posMesh.position.set(-w / 4, h / 2 + 0.075, 0);

      const negGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.12, 6);
      const negMesh = new THREE.Mesh(negGeo, metalMat);
      negMesh.position.set(w / 4, h / 2 + 0.06, 0);

      group.add(posMesh);
      group.add(negMesh);
      break;
    }

    case 'battery_coin': {
      const diskGeo = new THREE.CylinderGeometry(w / 2, w / 2, h, 24);
      const diskMesh = new THREE.Mesh(diskGeo, metalMat);
      group.add(diskMesh);

      const socketGeo = new THREE.CylinderGeometry(w / 2 + 0.08, w / 2 + 0.08, h * 0.8, 24);
      const socketMesh = new THREE.Mesh(socketGeo, blackMat);
      socketMesh.position.y = -h * 0.4;
      group.add(socketMesh);
      break;
    }

    case 'multimeter': {
      const bodyGeo = new THREE.BoxGeometry(w, h, d);
      const bodyMesh = new THREE.Mesh(bodyGeo, pcbMat(0xeab308, 0.2, 0.4));
      group.add(bodyMesh);

      const lcdGeo = new THREE.BoxGeometry(w * 0.75, h * 0.25, 0.05);
      const lcdMat = new THREE.MeshBasicMaterial({ color: 0x064e3b });
      const lcdMesh = new THREE.Mesh(lcdGeo, lcdMat);
      lcdMesh.position.set(0, h * 0.28, d / 2 + 0.01);
      group.add(lcdMesh);

      const dialGeo = new THREE.CylinderGeometry(w * 0.25, w * 0.25, 0.1, 20);
      dialGeo.rotateX(Math.PI / 2);
      const dialMesh = new THREE.Mesh(dialGeo, blackMat);
      dialMesh.position.set(0, -h * 0.05, d / 2 + 0.02);
      group.add(dialMesh);

      const jackRed = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
      jackRed.rotateX(Math.PI / 2);
      jackRed.position.set(-w * 0.25, -h * 0.35, d / 2 + 0.02);

      const jackBlack = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1), blackMat);
      jackBlack.rotateX(Math.PI / 2);
      jackBlack.position.set(0, -h * 0.35, d / 2 + 0.02);

      const jack10A = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
      jack10A.rotateX(Math.PI / 2);
      jack10A.position.set(w * 0.25, -h * 0.35, d / 2 + 0.02);

      group.add(jackRed);
      group.add(jackBlack);
      group.add(jack10A);
      break;
    }

    case 'gearmotor': {
      const boxGeo = new THREE.BoxGeometry(w, h * 0.6, d);
      const boxMesh = new THREE.Mesh(boxGeo, pcbMat(0xfacc15, 0.2, 0.4));
      group.add(boxMesh);

      const motorGeo = new THREE.CylinderGeometry(d * 0.38, d * 0.38, h * 0.45, 16);
      const motorMesh = new THREE.Mesh(motorGeo, metalMat);
      motorMesh.position.set(0, h * 0.45, 0);
      group.add(motorMesh);

      const shaftGeo = new THREE.CylinderGeometry(0.08, 0.08, d * 1.5, 12);
      shaftGeo.rotateX(Math.PI / 2);
      const shaftMesh = new THREE.Mesh(shaftGeo, new THREE.MeshStandardMaterial({ color: 0xf8fafc }));
      group.add(shaftMesh);
      break;
    }

    case 'dc_motor': {
      const bodyGeo = new THREE.CylinderGeometry(w / 2, w / 2, h * 0.75, 20);
      const bodyMesh = new THREE.Mesh(bodyGeo, metalMat);
      group.add(bodyMesh);

      const shaftGeo = new THREE.CylinderGeometry(0.05, 0.05, h * 0.4, 12);
      const shaftMesh = new THREE.Mesh(shaftGeo, metalMat);
      shaftMesh.position.y = h * 0.5;
      group.add(shaftMesh);

      const capGeo = new THREE.CylinderGeometry(w / 2, w / 2, h * 0.1, 20);
      const capMesh = new THREE.Mesh(capGeo, blackMat);
      capMesh.position.y = -h * 0.4;
      group.add(capMesh);
      break;
    }

    case 'potentiometer': {
      const baseGeo = new THREE.BoxGeometry(w, h * 0.4, d);
      const baseMesh = new THREE.Mesh(baseGeo, pcbMat(0x0284c7, 0.3, 0.4));
      group.add(baseMesh);

      const shaftGeo = new THREE.CylinderGeometry(0.12, 0.12, h * 0.6, 16);
      const shaftMesh = new THREE.Mesh(shaftGeo, metalMat);
      shaftMesh.position.y = h * 0.4;
      group.add(shaftMesh);

      const pinGeo = new THREE.BoxGeometry(0.08, h * 0.3, 0.04);
      for (let i = -1; i <= 1; i++) {
        const pin = new THREE.Mesh(pinGeo, metalMat);
        pin.position.set(i * 0.18, -h * 0.3, 0);
        group.add(pin);
      }
      break;
    }

    case 'switch_slide': {
      const bodyGeo = new THREE.BoxGeometry(w, h * 0.5, d);
      const bodyMesh = new THREE.Mesh(bodyGeo, metalMat);
      group.add(bodyMesh);

      const knobGeo = new THREE.BoxGeometry(0.15, 0.25, 0.15);
      const knobMesh = new THREE.Mesh(knobGeo, blackMat);
      knobMesh.position.set(-0.1, h * 0.35, 0);
      group.add(knobMesh);
      break;
    }

    case 'pushbutton': {
      const bodyGeo = new THREE.BoxGeometry(w, h * 0.5, d);
      const bodyMesh = new THREE.Mesh(bodyGeo, blackMat);
      group.add(bodyMesh);

      const btnGeo = new THREE.CylinderGeometry(w * 0.25, w * 0.25, 0.2, 16);
      const btnMat = new THREE.MeshStandardMaterial({ color: 0xef4444 });
      const btnMesh = new THREE.Mesh(btnGeo, btnMat);
      btnMesh.position.y = h * 0.3;
      group.add(btnMesh);
      break;
    }

    case 'resistor': {
      const bodyGeo = new THREE.CylinderGeometry(w, w, h * 0.5, 12);
      const bodyMesh = new THREE.Mesh(bodyGeo, pcbMat(0xfef08a, 0.1, 0.5));
      group.add(bodyMesh);

      const bandColors = [0x78350f, 0x000000, 0xef4444, 0xeab308];
      bandColors.forEach((col, i) => {
        const bandGeo = new THREE.CylinderGeometry(w * 1.05, w * 1.05, 0.05, 12);
        const bandMesh = new THREE.Mesh(bandGeo, new THREE.MeshBasicMaterial({ color: col }));
        bandMesh.position.y = -h * 0.15 + i * 0.1;
        group.add(bandMesh);
      });

      const leadGeo = new THREE.CylinderGeometry(0.02, 0.02, h * 0.4, 8);
      const leadTop = new THREE.Mesh(leadGeo, metalMat);
      leadTop.position.y = h * 0.4;
      const leadBot = new THREE.Mesh(leadGeo, metalMat);
      leadBot.position.y = -h * 0.4;
      group.add(leadTop);
      group.add(leadBot);
      break;
    }

    case 'capacitor': {
      const bodyGeo = new THREE.CylinderGeometry(w / 2, w / 2, h * 0.7, 16);
      const bodyMesh = new THREE.Mesh(bodyGeo, pcbMat(0x1e40af, 0.5, 0.2));
      group.add(bodyMesh);

      const capGeo = new THREE.CylinderGeometry(w / 2, w / 2, 0.02, 16);
      const capMesh = new THREE.Mesh(capGeo, metalMat);
      capMesh.position.y = h * 0.35;
      group.add(capMesh);
      break;
    }

    default:
      break;
  }

  return group;
}

interface ThreeRobotStudioProps {
  parts: RobotPart[];
  servos: ServoMotor[];
  selectedPartId: string | null;
  selectedServoId: string | null;
  onSelectPart: (id: string | null) => void;
  onSelectServo: (id: string | null) => void;
  onUpdatePart: (part: RobotPart) => void;
  onUpdateServo: (servo: ServoMotor) => void;
  onBatchUpdate?: (update: { parts?: RobotPart[]; servos?: ServoMotor[] }) => void;
  onAddPart: (type: PartGeometryType) => void;
  onDeletePart: (id: string) => void;
  onDuplicatePart: (id: string) => void;
  onAddServo: () => void;
  onDeleteServo: (id: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  colorScheme?: 'dark' | 'light';
}

export const ThreeRobotStudio: React.FC<ThreeRobotStudioProps> = ({
  parts,
  servos,
  selectedPartId,
  selectedServoId,
  onSelectPart,
  onSelectServo,
  onUpdatePart,
  onUpdateServo,
  onBatchUpdate,
  onAddPart,
  onDeletePart,
  onDuplicatePart,
  onAddServo,
  onDeleteServo,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  colorScheme = 'dark',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animationFrameRef = useRef<number>(0);
  const transformControlsRef = useRef<TransformControls | null>(null);

  // Map of part ID -> THREE.Mesh or Group
  const partMeshMap = useRef<Map<string, THREE.Object3D>>(new Map());
  // Map of servo ID -> { bodyMesh: THREE.Group, hornPivot: THREE.Group }
  const servoPivots = useRef<Map<string, { bodyMesh: THREE.Group; hornPivot: THREE.Group }>>(new Map());

  // UI state
  const [activeTab, setActiveTab] = useState<'build' | 'servos' | 'hierarchy'>('build');
  const [viewPreset, setViewPreset] = useState<'perspective' | 'front' | 'top' | 'side'>('perspective');
  const [showWireframe, setShowWireframe] = useState<boolean>(false);
  const [isLiveSync, setIsLiveSync] = useState<boolean>(true);
  const [hudCollapsed, setHudCollapsed] = useState<boolean>(false);
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'none'>('translate');
  const [showTour, setShowTour] = useState(false);

  const tourSteps: TourStep[] = [
    { targetSelector: '.part-palette', title: 'Step 1: Build!', content: 'Pick a robot part from here to start your journey.' },
    { targetSelector: '.add-servo-button', title: 'Step 2: Add Movement', content: 'Give your robot a brain and muscle with a servo motor!' },
    { targetSelector: '.hierarchy-tree', title: 'Step 3: Connect!', content: 'Attach parts to servos in the tree to make your robot move!' },
  ];
  const transformModeRef = useRef<'translate' | 'rotate' | 'none'>(transformMode);
  transformModeRef.current = transformMode;

  // Servo rotation target mode: 'body' (casing orientation X,Y,Z) or 'horn' (shaft output angle)
  const [servoRotateTarget, setServoRotateTarget] = useState<'body' | 'horn'>('body');

  // Snap Connection & Stop Movement State
  const [connectingSource, setConnectingSource] = useState<{
    anchorName: string;
    worldPos: THREE.Vector3;
  } | null>(null);
  const connectingSourceRef = useRef<typeof connectingSource>(null);
  connectingSourceRef.current = connectingSource;

  const [snapNotice, setSnapNotice] = useState<string | null>(null);
  const [snapLinkToolActive, setSnapLinkToolActive] = useState<boolean>(false);
  const isConnectActive = snapLinkToolActive || connectingSource !== null;
  const isConnectActiveRef = useRef<boolean>(isConnectActive);
  isConnectActiveRef.current = isConnectActive;

  // Toggle visibility of yellow snap orbs strictly when Connect mode is active
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const root = scene.getObjectByName('ROBOT_ROOT');
    if (root) {
      root.traverse((child) => {
        if (child.name.startsWith('SNAP_') || child.name.startsWith('HALO_')) {
          child.visible = isConnectActive;
        }
      });
    }
  }, [isConnectActive]);

  useEffect(() => {
    if (snapNotice) {
      const timer = setTimeout(() => setSnapNotice(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [snapNotice]);

  // Target angle smoothing state (current interpolated angles)
  const currentAnglesRef = useRef<Map<string, number>>(new Map());
  const servosRef = useRef<ServoMotor[]>(servos);
  servosRef.current = servos;
  const partsRef = useRef<RobotPart[]>(parts);
  partsRef.current = parts;

  const selectedPartIdRef = useRef<string | null>(selectedPartId);
  selectedPartIdRef.current = selectedPartId;
  const selectedServoIdRef = useRef<string | null>(selectedServoId);
  selectedServoIdRef.current = selectedServoId;

  const [sweepingServoIds, setSweepingServoIds] = useState<Set<string>>(new Set());
  const sweepingServoIdsRef = useRef<Set<string>>(sweepingServoIds);
  sweepingServoIdsRef.current = sweepingServoIds;

  const isLiveSyncRef = useRef<boolean>(isLiveSync);
  isLiveSyncRef.current = isLiveSync;
  const isDraggingTransformRef = useRef<boolean>(false);

  // Toggle auto-sweep oscillation for testing 3D servo motion
  const toggleAutoSweep = (servoId: string) => {
    setSweepingServoIds((prev) => {
      const next = new Set(prev);
      if (next.has(servoId)) {
        next.delete(servoId);
      } else {
        next.add(servoId);
      }
      return next;
    });
  };

  // Update target angles in map
  useEffect(() => {
    servos.forEach((s) => {
      if (!currentAnglesRef.current.has(s.id)) {
        currentAnglesRef.current.set(s.id, s.targetAngle ?? s.currentAngle ?? 90);
      }
    });
  }, [servos]);

  // Handle hardware serial ack feedback
  useEffect(() => {
    const unsub = arduinoSerial.addServoAckListener((pin, angle) => {
      const match = servos.find((s) => s.pin === pin);
      if (match && Math.abs(match.currentAngle - angle) > 1) {
        onUpdateServo({
          ...match,
          currentAngle: angle,
          targetAngle: angle,
        });
      }
    });
    return unsub;
  }, [servos, onUpdateServo]);

  // 1. Initialize Scene & Renderer
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // Detect software WebGL
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const scene = new THREE.Scene();
    const bgHex = colorScheme === 'light' ? 0xf8fafc : 0x0c0f17;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, 0.025);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(6, 6, 8);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 3, 0);
    controls.maxPolarAngle = Math.PI / 2 + 0.1; // Don't flip under ground
    controlsRef.current = controls;

    // Studio Environment reflection
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Studio Lighting Rig
    const keyLight = new THREE.DirectionalLight(0xfff5ea, 2.0);
    keyLight.position.set(8, 12, 8);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const fillLight = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 1.2);
    fillLight.position.set(0, 10, 0);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x818cf8, 1.0);
    rimLight.position.set(-8, 6, -8);
    scene.add(rimLight);

    // Grid Floor
    const gridHelper = new THREE.GridHelper(24, 24, 0x00d2ff, 0x27324c);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // Ground contact shadow circle
    const groundShadowGeo = new THREE.PlaneGeometry(16, 16);
    const groundShadowMat = new THREE.MeshBasicMaterial({
      color: 0x05070d,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    const groundShadow = new THREE.Mesh(groundShadowGeo, groundShadowMat);
    groundShadow.rotation.x = -Math.PI / 2;
    groundShadow.position.y = -0.01;
    scene.add(groundShadow);

    // Resize handler
    const handleResize = () => {
      if (!mountRef.current || !renderer || !camera) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // TransformControls for interactive drag & rotate gizmo
    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.size = 0.85;
    const transformHelper = transformControls.getHelper();
    scene.add(transformHelper);
    transformControlsRef.current = transformControls;

    // Snap Link Dynamic 3D Connecting Line (between yellow spheres)
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0),
    ]);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xffea00,
      linewidth: 3,
      transparent: true,
      opacity: 0.95,
    });
    const snapLine = new THREE.Line(lineGeo, lineMat);
    snapLine.name = 'ACTIVE_SNAP_LINE';
    snapLine.visible = false;
    scene.add(snapLine);

    // Dynamic glowing bead that travels along the connecting line
    const beadGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const beadMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00ffff,
      emissiveIntensity: 1.2,
      roughness: 0.1,
    });
    const snapBead = new THREE.Mesh(beadGeo, beadMat);
    snapBead.name = 'ACTIVE_SNAP_BEAD';
    snapBead.visible = false;
    scene.add(snapBead);

    // Proximity Snap & Motion Halt: When dragging object close to another, snap flush and STOP MOVING!
    transformControls.addEventListener('objectChange', () => {
      const obj = transformControls.object;
      if (!obj) return;

      // Real-time Drag-and-Rotate: Strictly restrict servo rotation to Y-axis
      if (transformControls.mode === 'rotate') {
        let activeServo: ServoMotor | null = null;
        let activeHornPivot: THREE.Group | null = null;

        if (obj.name.startsWith('HORN_')) {
          const sId = obj.name.replace('HORN_', '');
          activeServo = servosRef.current.find((s) => s.id === sId) || null;
          const node = servoPivots.current.get(sId);
          if (node) activeHornPivot = node.hornPivot;
        } else if (obj.name.startsWith('PART_')) {
          const pId = obj.name.replace('PART_', '');
          const p = partsRef.current.find((item) => item.id === pId);
          activeServo =
            servosRef.current.find((s) => s.attachedPartId === pId || (p?.servoId && s.id === p.servoId)) || null;
          if (activeServo) {
            const node = servoPivots.current.get(activeServo.id);
            if (node) activeHornPivot = node.hornPivot;
          }
        }

        if (activeServo && activeHornPivot) {
          // Read rotation strictly around the Y-axis (yaw / azimuth)
          const currentYRad = activeHornPivot.rotation.y;
          let deg = Math.round(THREE.MathUtils.radToDeg(currentYRad) + 90);
          const min = activeServo.minAngle ?? 0;
          const max = activeServo.maxAngle ?? 180;
          const clamped = Math.max(min, Math.min(max, deg));

          // Strictly lock rotation to Y-axis! Eliminate any X or Z wobble
          activeHornPivot.rotation.set(0, THREE.MathUtils.degToRad(clamped - 90), 0);
          currentAnglesRef.current.set(activeServo.id, clamped);

          // If attached part was directly rotated, keep its local frame locked to the horn
          if (obj.name.startsWith('PART_')) {
            obj.rotation.set(0, 0, 0);
          }

          if (isLiveSyncRef.current && arduinoSerial.status === 'connected') {
            arduinoSerial.setServoAngle(activeServo.pin, clamped);
          }
          setSnapNotice(`🔄 Servo Joint (${activeServo.name}): ${clamped}° on Pin ${activeServo.pin} (Strict Y-Axis)`);
          return;
        }
        return;
      }

      // Proximity Snap in Translate Mode
      const movingAnchors: THREE.Object3D[] = [];
      obj.traverse((child) => {
        if (child.name.startsWith('SNAP_')) {
          movingAnchors.push(child);
        }
      });
      if (movingAnchors.length === 0) return;

      const root = scene.getObjectByName('ROBOT_ROOT');
      if (!root) return;

      const otherAnchors: THREE.Object3D[] = [];
      root.traverse((child) => {
        if (
          child.name.startsWith('SNAP_') &&
          !movingAnchors.includes(child) &&
          !isHierarchyRelated(child, obj)
        ) {
          otherAnchors.push(child);
        }
      });

      const p1 = new THREE.Vector3();
      const p2 = new THREE.Vector3();

      for (const mAnchor of movingAnchors) {
        const mOwner = getAnchorOwner(mAnchor.name);
        if (!mOwner) continue;

        mAnchor.getWorldPosition(p1);
        for (const oAnchor of otherAnchors) {
          const oOwner = getAnchorOwner(oAnchor.name);
          if (!oOwner) continue;

          // Never snap to anchors belonging to the same item
          if (mOwner.type === oOwner.type && mOwner.id === oOwner.id) continue;

          // Don't snap already connected servo & part
          if (mOwner.type === 'servo' && oOwner.type === 'part') {
            const s = servosRef.current.find((item) => item.id === mOwner.id);
            if (s && (s.attachedPartId === oOwner.id || s.parentPartId === oOwner.id)) continue;
          }
          if (mOwner.type === 'part' && oOwner.type === 'servo') {
            const s = servosRef.current.find((item) => item.id === oOwner.id);
            if (s && (s.attachedPartId === mOwner.id || s.parentPartId === mOwner.id)) continue;
          }
          if (mOwner.type === 'part' && oOwner.type === 'part') {
            const p1Obj = partsRef.current.find((item) => item.id === mOwner.id);
            const p2Obj = partsRef.current.find((item) => item.id === oOwner.id);
            if (p1Obj && p2Obj && (p1Obj.parentId === p2Obj.id || p2Obj.parentId === p1Obj.id)) continue;
          }

          oAnchor.getWorldPosition(p2);
          const dist = p1.distanceTo(p2);

          // Proximity snap threshold: 0.65 units
          if (dist < 0.65) {
            const offset = p2.clone().sub(p1);
            obj.position.add(offset);

            // STOP MOVING immediately as requested!
            transformControls.detach();
            setTransformMode('none');

            triggerProximitySnap(mAnchor.name, oAnchor.name, obj);
            return;
          }
        }
      }
    });

    transformControls.addEventListener('dragging-changed', (event: any) => {
      if (controlsRef.current) {
        controlsRef.current.enabled = !event.value;
      }
      isDraggingTransformRef.current = !!event.value;

      if (!event.value) {
        // Drag or rotation finished: sync updated world position & rotation to React state
        const obj = transformControls.object;
        if (obj) {
          if (transformControls.mode === 'rotate') {
            if (obj.name.startsWith('HORN_')) {
              const sId = obj.name.replace('HORN_', '');
              const s = servosRef.current.find((item) => item.id === sId);
              if (s) {
                const currentAngle = currentAnglesRef.current.get(s.id) ?? s.currentAngle ?? 90;
                onUpdateServo({ ...s, currentAngle, targetAngle: currentAngle });
              }
            } else if (obj.name.startsWith('PART_')) {
              const pId = obj.name.replace('PART_', '');
              const p = partsRef.current.find((item) => item.id === pId);
              const drivingServo = servosRef.current.find((s) => s.attachedPartId === pId || p?.servoId === s.id);
              if (drivingServo) {
                const currentAngle = currentAnglesRef.current.get(drivingServo.id) ?? drivingServo.currentAngle ?? 90;
                onUpdateServo({ ...drivingServo, currentAngle, targetAngle: currentAngle });
              }
            }
          } else {
            if (obj.name.startsWith('PART_')) {
              const pId = obj.name.replace('PART_', '');
              const p = partsRef.current.find((item) => item.id === pId);
              if (p) {
                onUpdatePart({
                  ...p,
                  position: [
                    parseFloat(obj.position.x.toFixed(2)),
                    parseFloat(obj.position.y.toFixed(2)),
                    parseFloat(obj.position.z.toFixed(2)),
                  ],
                  rotation: [
                    parseFloat(THREE.MathUtils.radToDeg(obj.rotation.x).toFixed(1)),
                    parseFloat(THREE.MathUtils.radToDeg(obj.rotation.y).toFixed(1)),
                    parseFloat(THREE.MathUtils.radToDeg(obj.rotation.z).toFixed(1)),
                  ],
                });
              }
            } else if (obj.name.startsWith('SERVO_')) {
              const sId = obj.name.replace('SERVO_', '');
              const s = servosRef.current.find((item) => item.id === sId);
              if (s) {
                onUpdateServo({
                  ...s,
                  position: [
                    parseFloat(obj.position.x.toFixed(2)),
                    parseFloat(obj.position.y.toFixed(2)),
                    parseFloat(obj.position.z.toFixed(2)),
                  ],
                  rotation: [
                    parseFloat(THREE.MathUtils.radToDeg(obj.rotation.x).toFixed(1)),
                    parseFloat(THREE.MathUtils.radToDeg(obj.rotation.y).toFixed(1)),
                    parseFloat(THREE.MathUtils.radToDeg(obj.rotation.z).toFixed(1)),
                  ],
                });
              }
            }
          }
        }

        // Keep gizmo attached so object remains selected and interactive after moving
        setSnapNotice('✅ Move complete.');
      }
    });

    // Animation Loop with smooth kinematic damping and live 3D servo rotation
    let lastTime = performance.now();
    const animate = (currentTime: number) => {
      animationFrameRef.current = requestAnimationFrame(animate);
      const delta = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      // Kinematic servo rotation & dynamic limb animation
      if (servosRef.current) {
        servosRef.current.forEach((servo) => {
          // If currently dragging this servo's horn in rotate mode, maintain 1:1 user drag control!
          const isActivelyDragged =
            isDraggingTransformRef.current &&
            transformControls.mode === 'rotate' &&
            (transformControls.object?.name === `HORN_${servo.id}` ||
              (transformControls.object?.name.startsWith('PART_') &&
                servo.attachedPartId === transformControls.object.name.replace('PART_', '')));

          if (isActivelyDragged) {
            return;
          }

          let target = servo.targetAngle ?? servo.currentAngle ?? 90;

          // Auto-sweep oscillation if enabled for this servo
          if (sweepingServoIdsRef.current.has(servo.id)) {
            const min = servo.minAngle ?? 0;
            const max = servo.maxAngle ?? 180;
            const range = (max - min) / 2;
            const center = min + range;
            const osc = Math.sin(currentTime * 0.0035);
            target = Math.round(center + osc * range);
          }

          const current = currentAnglesRef.current.get(servo.id) ?? servo.currentAngle ?? 90;
          const speed = servo.speed || 300; // deg/sec
          const maxStep = speed * delta;
          let newAngle = current;

          if (Math.abs(target - current) <= maxStep) {
            newAngle = target;
          } else {
            newAngle += target > current ? maxStep : -maxStep;
          }
          currentAnglesRef.current.set(servo.id, newAngle);

          // Strictly Y-axis servo rotation!
          const servoNode = servoPivots.current.get(servo.id);
          if (servoNode) {
            // Neutral 90 deg = 0 rad on Y axis
            const rad = THREE.MathUtils.degToRad(newAngle - 90);
            servoNode.hornPivot.rotation.set(0, rad, 0);
          }
        });
      }

      // Pulse snap orbs and spin halo rings when Connect mode is active
      if (isConnectActiveRef.current && scene) {
        const root = scene.getObjectByName('ROBOT_ROOT');
        if (root) {
          const pulseScale = 1 + 0.12 * Math.sin(currentTime * 0.007);
          root.traverse((child) => {
            if (child.name.startsWith('SNAP_')) {
              child.scale.set(pulseScale, pulseScale, pulseScale);
            } else if (child.name.startsWith('HALO_')) {
              child.rotation.z += 0.04;
            }
          });
        }
      }

      // Ensure attached transform object is always valid and in the scene graph
      if (transformControls.object && (!transformControls.object.parent || !isObjectInScene(transformControls.object, scene))) {
        transformControls.detach();
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      window.removeEventListener('resize', handleResize);
      transformControls.dispose();
      scene.remove(transformHelper);
      scene.remove(snapLine);
      scene.remove(snapBead);
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    if (sceneRef.current) {
      const bgHex = colorScheme === 'light' ? 0xf8fafc : 0x0c0f17;
      sceneRef.current.background = new THREE.Color(bgHex);
      if (sceneRef.current.fog) {
        (sceneRef.current.fog as THREE.FogExp2).color.setHex(bgHex);
      }
    }
  }, [colorScheme]);

  // Synchronize TransformControls with selected object and mode safely
  const syncTransformControls = useCallback(() => {
    const tc = transformControlsRef.current;
    const scene = sceneRef.current;
    if (!tc || !scene) return;

    if (transformMode === 'none') {
      tc.detach();
      return;
    }

    tc.setMode(transformMode);

    if (selectedPartId) {
      const part = partsRef.current.find((p) => p.id === selectedPartId);
      const drivingServo = servosRef.current.find(
        (s) => s.attachedPartId === selectedPartId || (part?.servoId && s.id === part.servoId)
      );

      if (transformMode === 'rotate' && drivingServo) {
        // When rotating an attached part, attach TransformControls to the servo horn pivot!
        const servoNode = servoPivots.current.get(drivingServo.id);
        if (servoNode && servoNode.hornPivot.parent && isObjectInScene(servoNode.hornPivot, scene)) {
          tc.showX = false;
          tc.showZ = false;
          tc.showY = true; // Strictly lock to Y-axis!
          try {
            servoNode.hornPivot.updateMatrixWorld(true);
            tc.attach(servoNode.hornPivot);
          } catch (e) {
            tc.detach();
          }
          return;
        }
      }

      const mesh = partMeshMap.current.get(selectedPartId);
      if (mesh && mesh.parent && isObjectInScene(mesh, scene)) {
        if (transformMode === 'rotate' && drivingServo) {
          tc.showX = false;
          tc.showZ = false;
          tc.showY = true;
        } else {
          tc.showX = true;
          tc.showY = true;
          tc.showZ = true;
        }
        try {
          mesh.updateMatrixWorld(true);
          tc.attach(mesh);
        } catch (e) {
          tc.detach();
        }
        return;
      }
    }

    if (selectedServoId) {
      const servoNode = servoPivots.current.get(selectedServoId);
      if (servoNode) {
        if (transformMode === 'rotate') {
          if (servoRotateTarget === 'horn') {
            if (servoNode.hornPivot.parent && isObjectInScene(servoNode.hornPivot, scene)) {
              tc.showX = false;
              tc.showZ = false;
              tc.showY = true;
              try {
                servoNode.hornPivot.updateMatrixWorld(true);
                tc.attach(servoNode.hornPivot);
              } catch (e) {
                tc.detach();
              }
              return;
            }
          } else {
            // Rotate Servo Body (X, Y, Z full 3D orientation)
            if (servoNode.bodyMesh.parent && isObjectInScene(servoNode.bodyMesh, scene)) {
              tc.showX = true;
              tc.showY = true;
              tc.showZ = true;
              try {
                servoNode.bodyMesh.updateMatrixWorld(true);
                tc.attach(servoNode.bodyMesh);
              } catch (e) {
                tc.detach();
              }
              return;
            }
          }
        } else {
          // Translate Servo Body
          if (servoNode.bodyMesh.parent && isObjectInScene(servoNode.bodyMesh, scene)) {
            tc.showX = true;
            tc.showY = true;
            tc.showZ = true;
            try {
              servoNode.bodyMesh.updateMatrixWorld(true);
              tc.attach(servoNode.bodyMesh);
            } catch (e) {
              tc.detach();
            }
            return;
          }
        }
      }
    }

    tc.detach();
  }, [selectedPartId, selectedServoId, transformMode, servoRotateTarget]);

  useEffect(() => {
    syncTransformControls();
  }, [syncTransformControls]);

  const cancelSnapLine = useCallback(() => {
    setConnectingSource(null);
    const scene = sceneRef.current;
    if (scene) {
      const line = scene.getObjectByName('ACTIVE_SNAP_LINE') as THREE.Line;
      const bead = scene.getObjectByName('ACTIVE_SNAP_BEAD') as THREE.Mesh;
      if (line) line.visible = false;
      if (bead) bead.visible = false;
    }
  }, []);

  // Dedicated delete handler that removes the selected object and its associated constraints
  const handleDeleteSelected = useCallback(() => {
    transformControlsRef.current?.detach();
    setTransformMode('none');

    if (selectedPartIdRef.current) {
      const part = partsRef.current.find((p) => p.id === selectedPartIdRef.current);
      const name = part?.name || 'Selected block';
      onDeletePart(selectedPartIdRef.current);
      onSelectPart(null);
      setSnapNotice(`🗑 Deleted "${name}" and removed associated kinematic constraints.`);
    } else if (selectedServoIdRef.current) {
      const servo = servosRef.current.find((s) => s.id === selectedServoIdRef.current);
      const name = servo?.name || 'Selected servo';
      onDeleteServo(selectedServoIdRef.current);
      onSelectServo(null);
      setSnapNotice(`🗑 Deleted "${name}" and cleared joint constraints.`);
    }
  }, [onDeletePart, onDeleteServo, onSelectPart, onSelectServo]);

  // Keyboard shortcuts for Transform tools: W = Move, E = Rotate, Q = Select Only, Space/Esc = Stop Moving, Del/Backspace = Delete, C = Snap Link
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'w' || e.key === 'W') {
        setTransformMode('translate');
      } else if (e.key === 'e' || e.key === 'E') {
        setTransformMode('rotate');
      } else if (e.key === 'q' || e.key === 'Q') {
        setTransformMode('none');
      } else if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Escape') {
        // Space / Escape: STOP MOVING & Lock!
        transformControlsRef.current?.detach();
        setTransformMode('none');
        cancelSnapLine();
        setSnapNotice('⏹ Movement stopped & object locked in place.');
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDeleteSelected();
      } else if (e.key === 'c' || e.key === 'C') {
        // C: Toggle Snap Connect Tool
        setSnapLinkToolActive((prev) => {
          const next = !prev;
          if (next) {
            setSnapNotice('⚡ Connect Mode Active: Yellow snap orbs are now visible! Click any orb to connect.');
          } else {
            cancelSnapLine();
            setSnapNotice('Connect Mode exited. Snap orbs hidden.');
          }
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDeleteSelected, cancelSnapLine]);

  // 2. Rebuild Kinematic Tree & 3D Objects whenever parts or servos change
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Immediately detach TransformControls before clearing or unparenting old scene meshes
    transformControlsRef.current?.detach();

    // Clear old meshes
    partMeshMap.current.forEach((obj) => {
      if (obj.parent) obj.parent.remove(obj);
      if ((obj as any).geometry) (obj as any).geometry.dispose();
    });
    partMeshMap.current.clear();

    servoPivots.current.forEach((s) => {
      if (s.hornPivot) {
        [...s.hornPivot.children].forEach((child) => {
          if (child.name.startsWith('PART_')) {
            s.hornPivot.remove(child);
          }
        });
      }
      if (s.bodyMesh.parent) s.bodyMesh.parent.remove(s.bodyMesh);
    });
    servoPivots.current.clear();

    // Group for robot model
    let robotRoot = scene.getObjectByName('ROBOT_ROOT');
    if (robotRoot) {
      scene.remove(robotRoot);
    }
    robotRoot = new THREE.Group();
    robotRoot.name = 'ROBOT_ROOT';
    scene.add(robotRoot);

    // Build Servo 3D Models and Horn Pivot Groups
    servos.forEach((servo) => {
      const servoGroup = new THREE.Group();
      servoGroup.name = `SERVO_${servo.id}`;
      servoGroup.position.set(...servo.position);
      servoGroup.rotation.set(
        THREE.MathUtils.degToRad(servo.rotation[0]),
        THREE.MathUtils.degToRad(servo.rotation[1]),
        THREE.MathUtils.degToRad(servo.rotation[2])
      );

      // 3D Servo Casing (Authentic blue SG90 or black MG995)
      const isSG90 = servo.model === 'SG90';
      const bodyColor = isSG90 ? 0x0284c7 : 0x1e293b;
      const bodyGeo = new THREE.BoxGeometry(0.7, 0.9, 0.5);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: bodyColor,
        metalness: isSG90 ? 0.3 : 0.8,
        roughness: isSG90 ? 0.4 : 0.3,
        wireframe: showWireframe,
      });
      const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
      bodyMesh.castShadow = true;
      bodyMesh.receiveShadow = true;
      servoGroup.add(bodyMesh);

      // Mounting ears
      const earGeo = new THREE.BoxGeometry(1.0, 0.1, 0.5);
      const earMesh = new THREE.Mesh(earGeo, bodyMat);
      earMesh.position.y = 0.1;
      servoGroup.add(earMesh);

      // Brass/Nylon Output Gear Spindle & Central Y-Axis Axle Shaft
      const gearGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.25, 16);
      const gearMat = new THREE.MeshStandardMaterial({
        color: isSG90 ? 0xffffff : 0xeab308,
        metalness: isSG90 ? 0.1 : 0.9,
        roughness: 0.3,
      });
      const gearMesh = new THREE.Mesh(gearGeo, gearMat);
      gearMesh.position.set(0.15, 0.52, 0);
      servoGroup.add(gearMesh);

      // Central vertical Y-axis pivot axle shaft (metal pin)
      const axleGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.35, 16);
      const axleMat = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        metalness: 0.9,
        roughness: 0.1,
      });
      const axleMesh = new THREE.Mesh(axleGeo, axleMat);
      axleMesh.position.set(0.15, 0.58, 0);
      servoGroup.add(axleMesh);

      // Visual 180° Degree Protractor Dial Plate on the Y-Plane (XZ plane)
      const dialPlateGeo = new THREE.RingGeometry(0.22, 0.58, 36, 1, 0, Math.PI);
      dialPlateGeo.rotateX(Math.PI / 2);
      const dialPlateMat = new THREE.MeshBasicMaterial({
        color: 0x0284c7,
        transparent: true,
        opacity: 0.38,
        side: THREE.DoubleSide,
      });
      const dialPlate = new THREE.Mesh(dialPlateGeo, dialPlateMat);
      dialPlate.position.set(0.15, 0.508, 0);
      servoGroup.add(dialPlate);

      // Outer Neon Cyan Graduation Arc Guide
      const arcGeo = new THREE.RingGeometry(0.55, 0.59, 36, 1, 0, Math.PI);
      arcGeo.rotateX(Math.PI / 2);
      const arcMat = new THREE.MeshBasicMaterial({
        color: 0x00d2ff,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      });
      const arcMesh = new THREE.Mesh(arcGeo, arcMat);
      arcMesh.position.set(0.15, 0.51, 0);
      servoGroup.add(arcMesh);

      // 5 Graduation Tick Markers on Y-plane (0°, 45°, 90°, 135°, 180°)
      [0, 45, 90, 135, 180].forEach((deg) => {
        const rad = THREE.MathUtils.degToRad(deg);
        const tickGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.08, 8);
        const tickMat = new THREE.MeshBasicMaterial({
          color: deg === 90 ? 0x22c55e : deg === 0 || deg === 180 ? 0xf59e0b : 0xffffff,
        });
        const tickMesh = new THREE.Mesh(tickGeo, tickMat);
        tickMesh.position.set(0.15 + Math.cos(rad) * 0.53, 0.52, Math.sin(rad) * 0.53);
        servoGroup.add(tickMesh);
      });

      // Rotating Horn Pivot Group (Positioned at output gear axle, strictly rotating on Y)
      const hornPivot = new THREE.Group();
      hornPivot.name = `HORN_${servo.id}`;
      hornPivot.position.set(0.15, 0.55, 0);

      // High-visibility Y-Axis Rotation Ring on the Horn (Glow Cyan Ring)
      const hornGuideRingGeo = new THREE.TorusGeometry(0.5, 0.018, 12, 36);
      hornGuideRingGeo.rotateX(Math.PI / 2);
      const hornGuideRingMat = new THREE.MeshBasicMaterial({
        color: 0x06b6d4,
        transparent: true,
        opacity: 0.8,
      });
      const hornGuideRing = new THREE.Mesh(hornGuideRingGeo, hornGuideRingMat);
      hornPivot.add(hornGuideRing);

      // Visual Servo Horn (High-visibility RC double-arm cross with direction pointer)
      const hornArmGeo = new THREE.BoxGeometry(0.9, 0.08, 0.2);
      const hornArmMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.2,
        metalness: 0.1,
      });
      const hornArmMesh = new THREE.Mesh(hornArmGeo, hornArmMat);
      hornPivot.add(hornArmMesh);

      // Transverse horn cross arm
      const crossArmGeo = new THREE.BoxGeometry(0.2, 0.08, 0.55);
      const crossArmMesh = new THREE.Mesh(crossArmGeo, hornArmMat);
      hornPivot.add(crossArmMesh);

      // Center retaining screw (metallic)
      const screwGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.12, 12);
      const screwMat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        metalness: 0.9,
        roughness: 0.2,
      });
      const screwMesh = new THREE.Mesh(screwGeo, screwMat);
      screwMesh.position.y = 0.06;
      hornPivot.add(screwMesh);

      // Directional angle pointer tip on the horn arm
      const pointerGeo = new THREE.ConeGeometry(0.1, 0.22, 8);
      pointerGeo.rotateZ(-Math.PI / 2);
      const pointerMat = new THREE.MeshStandardMaterial({
        color: 0x00d2ff,
        emissive: 0x0088aa,
        roughness: 0.2,
      });
      const pointerMesh = new THREE.Mesh(pointerGeo, pointerMat);
      pointerMesh.position.set(0.48, 0, 0);
      hornPivot.add(pointerMesh);

      // Yellow Snap Sphere on Servo Horn (driving joint for blocks)
      const hornSnapGeo = new THREE.SphereGeometry(0.14, 16, 16);
      const yellowSnapMat = new THREE.MeshStandardMaterial({
        color: 0xffea00,
        emissive: 0xffaa00,
        emissiveIntensity: 0.95,
        roughness: 0.2,
        metalness: 0.1,
      });
      const hornSnapMesh = new THREE.Mesh(hornSnapGeo, yellowSnapMat);
      hornSnapMesh.name = `SNAP_SERVO_HORN_${servo.id}`;
      hornSnapMesh.position.set(0.48, 0, 0);
      hornSnapMesh.visible = isConnectActiveRef.current;

      // Yellow Halo Ring around horn snap sphere
      const haloGeo = new THREE.RingGeometry(0.18, 0.23, 24);
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0xffea00,
        wireframe: true,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7,
      });
      const hornHalo = new THREE.Mesh(haloGeo, haloMat);
      hornHalo.name = `HALO_SERVO_HORN_${servo.id}`;
      hornHalo.rotation.x = Math.PI / 2;
      hornHalo.visible = isConnectActiveRef.current;
      hornSnapMesh.add(hornHalo);
      hornPivot.add(hornSnapMesh);

      // Yellow Snap Sphere on Servo Mounting Base (mounts onto blocks)
      const baseSnapMesh = new THREE.Mesh(hornSnapGeo.clone(), yellowSnapMat.clone());
      baseSnapMesh.name = `SNAP_SERVO_BASE_${servo.id}`;
      baseSnapMesh.position.set(0, -0.45, 0);
      baseSnapMesh.visible = isConnectActiveRef.current;
      const baseHalo = new THREE.Mesh(haloGeo.clone(), haloMat.clone());
      baseHalo.name = `HALO_SERVO_BASE_${servo.id}`;
      baseHalo.rotation.x = Math.PI / 2;
      baseHalo.visible = isConnectActiveRef.current;
      baseSnapMesh.add(baseHalo);
      servoGroup.add(baseSnapMesh);

      // Set initial rotation strictly on Y axis (azimuth/yaw)
      const initialAngle = servo.targetAngle ?? servo.currentAngle ?? 90;
      const initialRad = THREE.MathUtils.degToRad(initialAngle - 90);
      hornPivot.rotation.set(0, initialRad, 0);

      servoGroup.add(hornPivot);
      servoPivots.current.set(servo.id, { bodyMesh: servoGroup, hornPivot });

      // Add to root if no parent part, otherwise attach later
      if (!servo.parentPartId) {
        robotRoot.add(servoGroup);
      }
    });

    // Build Part Meshes
    parts.forEach((part) => {
      const [w, h, d] = part.dimensions;
      const isSelected = selectedPartId === part.id;
      let partObj: THREE.Object3D;

      if (ELECTRONIC_COMPONENT_TYPES.has(part.type)) {
        partObj = createElectronicComponentGroup(part, isSelected, showWireframe);
      } else {
        let geo: THREE.BufferGeometry;
        switch (part.type) {
          case 'cylinder':
          case 'leg':
          case 'arm':
            geo = new THREE.CylinderGeometry(w / 2, (d || w) / 2, h, 20);
            break;
          case 'sphere':
            geo = new THREE.SphereGeometry(w / 2, 24, 24);
            break;
          case 'head': {
            const groupGeo = new THREE.BoxGeometry(w, h, d);
            geo = groupGeo;
            break;
          }
          case 'wheel':
            geo = new THREE.CylinderGeometry(w / 2, w / 2, h, 24);
            geo.rotateZ(Math.PI / 2);
            break;
          case 'joint_bracket':
            geo = new THREE.BoxGeometry(w, h, d);
            break;
          case 'gripper':
            geo = new THREE.BoxGeometry(w, h, d);
            break;
          case 'box':
          case 'body':
          default:
            geo = new THREE.BoxGeometry(w, h, d);
            break;
        }

        const mat = new THREE.MeshStandardMaterial({
          color: isSelected ? 0x00d2ff : new THREE.Color(part.color),
          metalness: part.metalness,
          roughness: part.roughness,
          wireframe: showWireframe,
          emissive: isSelected ? 0x004466 : 0x000000,
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        partObj = mesh;
      }

      partObj.name = `PART_${part.id}`;
      partObj.position.set(...part.position);
      partObj.rotation.set(
        THREE.MathUtils.degToRad(part.rotation[0]),
        THREE.MathUtils.degToRad(part.rotation[1]),
        THREE.MathUtils.degToRad(part.rotation[2])
      );
      partObj.scale.set(...part.scale);

      // Yellow Snap Spheres on Block
      const partSnapGeo = new THREE.SphereGeometry(0.14, 16, 16);
      const partSnapMat = new THREE.MeshStandardMaterial({
        color: 0xffea00,
        emissive: 0xffaa00,
        emissiveIntensity: 0.95,
        roughness: 0.2,
        metalness: 0.1,
      });

      // Top Yellow Snap Sphere
      const topSnapMesh = new THREE.Mesh(partSnapGeo, partSnapMat);
      topSnapMesh.name = `SNAP_PART_TOP_${part.id}`;
      topSnapMesh.position.set(0, h / 2 + 0.12, 0);
      topSnapMesh.visible = isConnectActiveRef.current;
      const topHalo = new THREE.Mesh(
        new THREE.RingGeometry(0.18, 0.23, 24),
        new THREE.MeshBasicMaterial({
          color: 0xffea00,
          wireframe: true,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.7,
        })
      );
      topHalo.name = `HALO_PART_TOP_${part.id}`;
      topHalo.rotation.x = Math.PI / 2;
      topHalo.visible = isConnectActiveRef.current;
      topSnapMesh.add(topHalo);
      partObj.add(topSnapMesh);

      // Center/Face Yellow Snap Sphere
      const centerSnapMesh = new THREE.Mesh(partSnapGeo.clone(), partSnapMat.clone());
      centerSnapMesh.name = `SNAP_PART_CENTER_${part.id}`;
      centerSnapMesh.position.set(0, 0, (d || w) / 2 + 0.12);
      centerSnapMesh.visible = isConnectActiveRef.current;
      const centerHalo = new THREE.Mesh(
        new THREE.RingGeometry(0.18, 0.23, 24),
        new THREE.MeshBasicMaterial({
          color: 0xffea00,
          wireframe: true,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.7,
        })
      );
      centerHalo.name = `HALO_PART_CENTER_${part.id}`;
      centerHalo.rotation.x = Math.PI / 2;
      centerHalo.visible = isConnectActiveRef.current;
      centerSnapMesh.add(centerHalo);
      partObj.add(centerSnapMesh);

      partMeshMap.current.set(part.id, partObj);
    });

    // Assemble Parent-Child Kinematic Hierarchy
    robotRoot.updateMatrixWorld(true);

    // 1. Attach servos with parentPartId to their parent parts
    servos.forEach((servo) => {
      const node = servoPivots.current.get(servo.id);
      if (node && servo.parentPartId) {
        if (servo.parentPartId === servo.attachedPartId) {
          robotRoot.add(node.bodyMesh);
          return;
        }
        const parentMesh = partMeshMap.current.get(servo.parentPartId);
        if (parentMesh && !wouldCreateCycle(node.bodyMesh, parentMesh)) {
          parentMesh.add(node.bodyMesh);
        } else {
          robotRoot.add(node.bodyMesh);
        }
      }
    });

    // 2. Attach parts:
    // If a part is attached to a servo horn, attach preserving world transform!
    parts.forEach((part) => {
      const mesh = partMeshMap.current.get(part.id);
      if (!mesh) return;

      const drivingServo = servos.find(
        (s) =>
          (s.attachedPartId === part.id || (part.servoId && s.id === part.servoId)) &&
          s.parentPartId !== part.id
      );

      if (drivingServo) {
        const servoNode = servoPivots.current.get(drivingServo.id);
        if (servoNode && !wouldCreateCycle(mesh, servoNode.hornPivot)) {
          try {
            robotRoot.updateMatrixWorld(true);
            servoNode.hornPivot.updateMatrixWorld(true);
            mesh.updateMatrixWorld(true);
            servoNode.hornPivot.attach(mesh);
            return;
          } catch (err) {
            console.warn('Failed attach to hornPivot, falling back to root:', err);
          }
        }
      }

      // If attached to a parent part
      if (part.parentId && part.parentId !== part.id) {
        const parentMesh = partMeshMap.current.get(part.parentId);
        if (parentMesh && !wouldCreateCycle(mesh, parentMesh)) {
          try {
            parentMesh.updateMatrixWorld(true);
            mesh.updateMatrixWorld(true);
            parentMesh.attach(mesh);
            return;
          } catch (err) {
            console.warn('Failed attach to parentMesh, falling back to root:', err);
          }
        }
      }

      // Root level part
      robotRoot.add(mesh);
    });

    robotRoot.updateMatrixWorld(true);
    syncTransformControls();
  }, [
    parts.map((p) => `${p.id}_${p.type}_${p.dimensions.join(',')}_${p.position.join(',')}_${p.rotation.join(',')}_${p.color}_${p.parentId || ''}_${p.servoId || ''}`).join('|'),
    servos.map((s) => `${s.id}_${s.pin}_${s.rotationAxis}_${s.model}_${s.attachedPartId || ''}_${s.parentPartId || ''}_${s.position.join(',')}_${s.rotation.join(',')}`).join('|'),
    selectedPartId,
    selectedServoId,
    transformMode,
    showWireframe,
    syncTransformControls,
  ]);

  const triggerProximitySnap = useCallback(
    (movingAnchorName: string, targetAnchorName: string, movedObj: THREE.Object3D) => {
      let servoId: string | null = null;
      let partId: string | null = null;
      let isHorn = false;

      if (movingAnchorName.startsWith('SNAP_SERVO_HORN_')) {
        servoId = movingAnchorName.replace('SNAP_SERVO_HORN_', '');
        isHorn = true;
      } else if (movingAnchorName.startsWith('SNAP_SERVO_BASE_')) {
        servoId = movingAnchorName.replace('SNAP_SERVO_BASE_', '');
      }

      if (targetAnchorName.startsWith('SNAP_SERVO_HORN_')) {
        servoId = targetAnchorName.replace('SNAP_SERVO_HORN_', '');
        isHorn = true;
      } else if (targetAnchorName.startsWith('SNAP_SERVO_BASE_')) {
        servoId = targetAnchorName.replace('SNAP_SERVO_BASE_', '');
      }

      if (movingAnchorName.startsWith('SNAP_PART_TOP_')) {
        partId = movingAnchorName.replace('SNAP_PART_TOP_', '');
      } else if (movingAnchorName.startsWith('SNAP_PART_CENTER_')) {
        partId = movingAnchorName.replace('SNAP_PART_CENTER_', '');
      }

      if (targetAnchorName.startsWith('SNAP_PART_TOP_')) {
        partId = targetAnchorName.replace('SNAP_PART_TOP_', '');
      } else if (targetAnchorName.startsWith('SNAP_PART_CENTER_')) {
        partId = targetAnchorName.replace('SNAP_PART_CENTER_', '');
      }

      // Detach controls and stop moving immediately
      transformControlsRef.current?.detach();
      setTransformMode('none');

      if (servoId && partId) {
        const servo = servosRef.current.find((s) => s.id === servoId);
        const part = partsRef.current.find((p) => p.id === partId);
        if (servo && part) {
          if (isHorn) {
            const updatedServo: ServoMotor = {
              ...servo,
              attachedPartId: part.id,
              parentPartId: servo.parentPartId === part.id ? null : servo.parentPartId,
              position: [
                parseFloat(movedObj.position.x.toFixed(2)),
                parseFloat(movedObj.position.y.toFixed(2)),
                parseFloat(movedObj.position.z.toFixed(2)),
              ],
            };
            const updatedPart: RobotPart = {
              ...part,
              servoId: servo.id,
              parentId: part.parentId === part.id ? null : part.parentId,
            };
            if (onBatchUpdate) {
              onBatchUpdate({ servos: [updatedServo], parts: [updatedPart] });
            } else {
              onUpdateServo(updatedServo);
              onUpdatePart(updatedPart);
            }
            setSnapNotice(`⚡ SNAPPED! Servo horn connected to Block "${part.name}". Movement stopped & locked.`);
          } else {
            const updatedServo: ServoMotor = {
              ...servo,
              parentPartId: part.id,
              attachedPartId: servo.attachedPartId === part.id ? null : servo.attachedPartId,
              position: [
                parseFloat(movedObj.position.x.toFixed(2)),
                parseFloat(movedObj.position.y.toFixed(2)),
                parseFloat(movedObj.position.z.toFixed(2)),
              ],
            };
            const updatedPart: RobotPart = {
              ...part,
              servoId: part.servoId === servo.id ? undefined : part.servoId,
            };
            if (onBatchUpdate) {
              onBatchUpdate({ servos: [updatedServo], parts: [updatedPart] });
            } else {
              onUpdateServo(updatedServo);
              onUpdatePart(updatedPart);
            }
            setSnapNotice(`⚡ SNAPPED! Servo "${servo.name}" mounted onto Block "${part.name}". Movement stopped & locked.`);
          }
          return;
        }
      }

      // Block to Block proximity snap
      if (movingAnchorName.startsWith('SNAP_PART_') && targetAnchorName.startsWith('SNAP_PART_')) {
        const p1Id = movingAnchorName.replace('SNAP_PART_TOP_', '').replace('SNAP_PART_CENTER_', '');
        const p2Id = targetAnchorName.replace('SNAP_PART_TOP_', '').replace('SNAP_PART_CENTER_', '');
        if (p1Id && p2Id && p1Id !== p2Id) {
          const p1 = partsRef.current.find((p) => p.id === p1Id);
          const p2 = partsRef.current.find((p) => p.id === p2Id);
          if (p1 && p2) {
            const updatedP1: RobotPart = {
              ...p1,
              parentId: p2.id,
              position: [
                parseFloat(movedObj.position.x.toFixed(2)),
                parseFloat(movedObj.position.y.toFixed(2)),
                parseFloat(movedObj.position.z.toFixed(2)),
              ],
            };
            const updatedP2: RobotPart = {
              ...p2,
              parentId: p2.parentId === p1.id ? null : p2.parentId,
            };
            if (onBatchUpdate) {
              onBatchUpdate({ parts: [updatedP1, updatedP2] });
            } else {
              onUpdatePart(updatedP1);
              if (p2.parentId === p1.id) onUpdatePart(updatedP2);
            }
            setSnapNotice(`⚡ SNAPPED! Block "${p1.name}" connected to Block "${p2.name}". Movement stopped & locked.`);
            return;
          }
        }
      }

      setSnapNotice('⚡ Snapped into place! Movement stopped & locked.');
    },
    [onUpdatePart, onUpdateServo, onBatchUpdate]
  );

  const executeLineSnap = useCallback(
    (sourceAnchor: string, targetAnchor: string, sourcePos: THREE.Vector3, targetPos: THREE.Vector3) => {
      let servoId: string | null = null;
      let partId: string | null = null;
      let isHorn = false;

      if (sourceAnchor.startsWith('SNAP_SERVO_HORN_')) {
        servoId = sourceAnchor.replace('SNAP_SERVO_HORN_', '');
        isHorn = true;
      } else if (sourceAnchor.startsWith('SNAP_SERVO_BASE_')) {
        servoId = sourceAnchor.replace('SNAP_SERVO_BASE_', '');
      }

      if (targetAnchor.startsWith('SNAP_SERVO_HORN_')) {
        servoId = targetAnchor.replace('SNAP_SERVO_HORN_', '');
        isHorn = true;
      } else if (targetAnchor.startsWith('SNAP_SERVO_BASE_')) {
        servoId = targetAnchor.replace('SNAP_SERVO_BASE_', '');
      }

      if (sourceAnchor.startsWith('SNAP_PART_TOP_')) {
        partId = sourceAnchor.replace('SNAP_PART_TOP_', '');
      } else if (sourceAnchor.startsWith('SNAP_PART_CENTER_')) {
        partId = sourceAnchor.replace('SNAP_PART_CENTER_', '');
      }

      if (targetAnchor.startsWith('SNAP_PART_TOP_')) {
        partId = targetAnchor.replace('SNAP_PART_TOP_', '');
      } else if (targetAnchor.startsWith('SNAP_PART_CENTER_')) {
        partId = targetAnchor.replace('SNAP_PART_CENTER_', '');
      }

      // Stop moving immediately on snap
      transformControlsRef.current?.detach();
      setTransformMode('none');

      if (servoId && partId) {
        const servo = servosRef.current.find((s) => s.id === servoId);
        const part = partsRef.current.find((p) => p.id === partId);
        if (servo && part) {
          if (isHorn) {
            // Align block directly onto servo horn
            const snapX = parseFloat((servo.position[0] + 0.15).toFixed(2));
            const snapY = parseFloat((servo.position[1] + 0.55 + part.dimensions[1] / 2).toFixed(2));
            const snapZ = parseFloat(servo.position[2].toFixed(2));

            const updatedServo: ServoMotor = {
              ...servo,
              attachedPartId: part.id,
              parentPartId: servo.parentPartId === part.id ? null : servo.parentPartId,
            };
            const updatedPart: RobotPart = {
              ...part,
              position: [snapX, snapY, snapZ],
              servoId: servo.id,
              parentId: part.parentId === part.id ? null : part.parentId,
            };
            if (onBatchUpdate) {
              onBatchUpdate({ servos: [updatedServo], parts: [updatedPart] });
            } else {
              onUpdateServo(updatedServo);
              onUpdatePart(updatedPart);
            }
            setSnapNotice(`⚡ SNAPPED! Servo horn connected to Block "${part.name}". Movement stopped & locked.`);
          } else {
            // Mount servo onto top of block
            const snapX = parseFloat(part.position[0].toFixed(2));
            const snapY = parseFloat((part.position[1] + part.dimensions[1] / 2 + 0.45).toFixed(2));
            const snapZ = parseFloat(part.position[2].toFixed(2));

            const updatedServo: ServoMotor = {
              ...servo,
              parentPartId: part.id,
              attachedPartId: servo.attachedPartId === part.id ? null : servo.attachedPartId,
              position: [snapX, snapY, snapZ],
            };
            const updatedPart: RobotPart = {
              ...part,
              servoId: part.servoId === servo.id ? undefined : part.servoId,
            };
            if (onBatchUpdate) {
              onBatchUpdate({ servos: [updatedServo], parts: [updatedPart] });
            } else {
              onUpdateServo(updatedServo);
              onUpdatePart(updatedPart);
            }
            setSnapNotice(`⚡ SNAPPED! Servo "${servo.name}" mounted onto Block "${part.name}". Movement stopped & locked.`);
          }
          return;
        }
      }

      // Block to Block
      if (sourceAnchor.startsWith('SNAP_PART_') && targetAnchor.startsWith('SNAP_PART_')) {
        const p1Id = sourceAnchor.replace('SNAP_PART_TOP_', '').replace('SNAP_PART_CENTER_', '');
        const p2Id = targetAnchor.replace('SNAP_PART_TOP_', '').replace('SNAP_PART_CENTER_', '');
        if (p1Id && p2Id && p1Id !== p2Id) {
          const p1 = partsRef.current.find((p) => p.id === p1Id);
          const p2 = partsRef.current.find((p) => p.id === p2Id);
          if (p1 && p2) {
            const snapY = parseFloat((p2.position[1] + p2.dimensions[1] / 2 + p1.dimensions[1] / 2).toFixed(2));
            const updatedP1: RobotPart = {
              ...p1,
              parentId: p2.id,
              position: [p2.position[0], snapY, p2.position[2]],
            };
            const updatedP2: RobotPart = {
              ...p2,
              parentId: p2.parentId === p1.id ? null : p2.parentId,
            };
            if (onBatchUpdate) {
              onBatchUpdate({ parts: [updatedP1, updatedP2] });
            } else {
              onUpdatePart(updatedP1);
              if (p2.parentId === p1.id) onUpdatePart(updatedP2);
            }
            setSnapNotice(`⚡ SNAPPED! Block "${p1.name}" connected to Block "${p2.name}". Movement stopped & locked.`);
            return;
          }
        }
      }

      setSnapNotice('⚡ Connected via line! Movement stopped & locked.');
    },
    [onUpdatePart, onUpdateServo, onBatchUpdate]
  );

  const handleSnapAnchorClick = useCallback(
    (anchorMesh: THREE.Object3D) => {
      const anchorName = anchorMesh.name;
      const worldPos = anchorMesh.getWorldPosition(new THREE.Vector3());

      const currentSrc = connectingSourceRef.current;
      if (!currentSrc) {
        // Step 1: Set source yellow sphere and start dynamic line!
        setConnectingSource({
          anchorName,
          worldPos,
        });
        setSnapNotice('⚡ Snap Line Active! Move cursor and click the second yellow sphere on any block or servo to snap connect.');

        const scene = sceneRef.current;
        if (scene) {
          const line = scene.getObjectByName('ACTIVE_SNAP_LINE') as THREE.Line;
          const bead = scene.getObjectByName('ACTIVE_SNAP_BEAD') as THREE.Mesh;
          if (line) {
            line.geometry.setFromPoints([worldPos, worldPos]);
            line.geometry.attributes.position.needsUpdate = true;
            line.visible = true;
          }
          if (bead) {
            bead.position.copy(worldPos);
            bead.visible = true;
          }
        }
      } else {
        // Step 2: Second yellow sphere clicked!
        if (anchorName === currentSrc.anchorName) {
          cancelSnapLine();
          return;
        }

        executeLineSnap(currentSrc.anchorName, anchorName, currentSrc.worldPos, worldPos);
        cancelSnapLine();
        setSnapLinkToolActive(false);
      }
    },
    [cancelSnapLine, executeLineSnap]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const currentSrc = connectingSourceRef.current;
      if (!currentSrc || !mountRef.current || !cameraRef.current || !sceneRef.current) return;

      const rect = mountRef.current.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);

      const scene = sceneRef.current;
      const activeLine = scene.getObjectByName('ACTIVE_SNAP_LINE') as THREE.Line;
      const bead = scene.getObjectByName('ACTIVE_SNAP_BEAD') as THREE.Mesh;
      if (!activeLine) return;

      const robotRoot = scene.getObjectByName('ROBOT_ROOT');
      let targetPoint: THREE.Vector3 | null = null;

      if (robotRoot) {
        const hits = raycaster.intersectObjects(robotRoot.children, true);
        for (const hit of hits) {
          if (hit.object.name.startsWith('SNAP_') && hit.object.name !== currentSrc.anchorName) {
            targetPoint = hit.object.getWorldPosition(new THREE.Vector3());
            break;
          }
        }
      }

      if (!targetPoint) {
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -currentSrc.worldPos.y);
        const hit = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(plane, hit)) {
          targetPoint = hit;
        } else {
          targetPoint = currentSrc.worldPos.clone().add(raycaster.ray.direction.clone().multiplyScalar(5));
        }
      }

      activeLine.geometry.setFromPoints([currentSrc.worldPos, targetPoint]);
      activeLine.geometry.attributes.position.needsUpdate = true;
      activeLine.visible = true;

      if (bead) {
        bead.visible = true;
        bead.position.copy(targetPoint);
      }
    },
    []
  );

  // Click Raycaster for selecting 3D parts & Snap yellow spheres
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!mountRef.current || !cameraRef.current || !sceneRef.current) return;
      const rect = mountRef.current.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);

      const robotRoot = sceneRef.current.getObjectByName('ROBOT_ROOT');
      if (!robotRoot) return;

      const intersects = raycaster.intersectObjects(robotRoot.children, true);
      if (intersects.length > 0) {
        let hitObj: THREE.Object3D | null = intersects[0].object;

        // Check if user clicked a yellow snap sphere
        let anchorObj: THREE.Object3D | null = hitObj;
        while (anchorObj && anchorObj !== robotRoot) {
          if (anchorObj.name.startsWith('SNAP_')) {
            handleSnapAnchorClick(anchorObj);
            return;
          }
          anchorObj = anchorObj.parent;
        }

        // If line mode was active and user clicked a normal object, cancel line
        if (connectingSourceRef.current) {
          cancelSnapLine();
          return;
        }

        // Regular selection
        while (hitObj && hitObj !== robotRoot) {
          if (hitObj.name.startsWith('PART_')) {
            const partId = hitObj.name.replace('PART_', '');
            onSelectPart(partId);
            onSelectServo(null);
            return;
          }
          if (hitObj.name.startsWith('SERVO_')) {
            const servoId = hitObj.name.replace('SERVO_', '');
            onSelectServo(servoId);
            onSelectPart(null);
            return;
          }
          hitObj = hitObj.parent;
        }
      } else {
        if (connectingSourceRef.current) {
          cancelSnapLine();
        }
        transformControlsRef.current?.detach();
        setTransformMode('none');
        onSelectPart(null);
        onSelectServo(null);
      }
    },
    [handleSnapAnchorClick, cancelSnapLine, onSelectPart, onSelectServo]
  );

  // Set Camera View Presets
  const setCameraView = (view: 'perspective' | 'front' | 'top' | 'side') => {
    if (!cameraRef.current || !controlsRef.current) return;
    setViewPreset(view);
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    controls.target.set(0, 3, 0);

    if (view === 'front') {
      camera.position.set(0, 3, 10);
    } else if (view === 'top') {
      camera.position.set(0, 12, 0.001);
    } else if (view === 'side') {
      camera.position.set(10, 3, 0);
    } else {
      camera.position.set(6, 6, 8);
    }
    camera.lookAt(0, 3, 0);
    controls.update();
  };

  // Handle live servo angle change
  const handleServoAngleChange = (servo: ServoMotor, newAngle: number) => {
    const clamped = Math.max(servo.minAngle, Math.min(servo.maxAngle, newAngle));
    currentAnglesRef.current.set(servo.id, clamped);

    // Apply immediate 3D horn rotation for real-time responsiveness (Locked to Y-axis)
    const servoNode = servoPivots.current.get(servo.id);
    if (servoNode) {
      const rad = THREE.MathUtils.degToRad(clamped - 90);
      servoNode.hornPivot.rotation.set(0, rad, 0);
    }

    const updated = { ...servo, targetAngle: clamped, currentAngle: clamped };
    onUpdateServo(updated);

    if (isLiveSync && arduinoSerial.status === 'connected') {
      arduinoSerial.setServoAngle(servo.pin, clamped);
    }
  };

  const [isSlowMoving, setIsSlowMoving] = useState<boolean>(false);
  const [slowMoveProgress, setSlowMoveProgress] = useState<number>(0);
  const slowMoveAbortRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      slowMoveAbortRef.current = true;
    };
  }, []);

  const handleSlowMoveAllTo90 = async () => {
    if (isSlowMoving) {
      slowMoveAbortRef.current = true;
      setIsSlowMoving(false);
      return;
    }

    if (servos.length === 0) return;

    slowMoveAbortRef.current = false;
    setIsSlowMoving(true);
    setSlowMoveProgress(0);

    const startAngles: Record<string, number> = {};
    let maxDistance = 0;
    servos.forEach((s) => {
      const current = s.currentAngle ?? s.targetAngle ?? 90;
      startAngles[s.id] = current;
      const dist = Math.abs(current - 90);
      if (dist > maxDistance) maxDistance = dist;
    });

    if (maxDistance === 0) {
      for (const s of servos) {
        handleServoAngleChange(s, 90);
      }
      setIsSlowMoving(false);
      return;
    }

    const totalSteps = Math.max(30, Math.round(maxDistance * 1.5));
    const stepDelay = 45;

    for (let step = 1; step <= totalSteps; step++) {
      if (slowMoveAbortRef.current) break;

      const progress = step / totalSteps;
      setSlowMoveProgress(Math.round(progress * 100));

      for (const s of servos) {
        const start = startAngles[s.id] ?? 90;
        const currentInterp = Math.round(start + (90 - start) * progress);
        handleServoAngleChange(s, currentInterp);
      }

      await new Promise((resolve) => setTimeout(resolve, stepDelay));
    }

    setIsSlowMoving(false);
    setSlowMoveProgress(0);
  };

  const selectedPart = parts.find((p) => p.id === selectedPartId);
  const selectedServo = servos.find((s) => s.id === selectedServoId);
  const attachedServo = selectedPart
    ? servos.find((s) => s.attachedPartId === selectedPart.id || selectedPart.servoId === s.id)
    : null;
  const targetServo = selectedServo || attachedServo;

  return (
    <div className="relative w-full h-full flex flex-col bg-[#0c0f17] overflow-hidden select-none">
      {/* Top 3D Studio Toolbar */}
      <div className="h-12 bg-[#111625]/90 border-b border-[#27324c] px-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-[#181f33] px-2.5 py-1 rounded-md text-xs font-mono text-cyan-400 border border-[#27324c]">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>3D ROBOT VIEWPORT</span>
          </div>

          <div className="h-4 w-[1px] bg-[#27324c] mx-1" />

          {/* Transform Mode Tool Switcher: Drag/Move, Rotate, Select Only, Stop Moving */}
          <div className="flex items-center bg-[#181f33] p-0.5 rounded-md border border-[#27324c] text-xs transform-controls">
            <button
              onClick={() => setTransformMode('translate')}
              className={`px-2 py-1 rounded flex items-center gap-1.5 transition-colors ${
                transformMode === 'translate'
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Move / Drag Object (Shortcut: W)"
            >
              <Move className="w-3.5 h-3.5" />
              <span>Drag / Move</span>
              <kbd className="text-[9px] px-1 rounded bg-black/30 font-mono">W</kbd>
            </button>
            <button
              onClick={() => setTransformMode('rotate')}
              className={`px-2 py-1 rounded flex items-center gap-1.5 transition-colors ${
                transformMode === 'rotate'
                  ? 'bg-purple-500 text-white font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Rotate Object (Shortcut: E)"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Rotate</span>
              <kbd className="text-[9px] px-1 rounded bg-black/30 font-mono">E</kbd>
            </button>
            <button
              onClick={() => setTransformMode('none')}
              className={`px-2 py-1 rounded flex items-center gap-1.5 transition-colors ${
                transformMode === 'none' && !snapLinkToolActive
                  ? 'bg-slate-700 text-cyan-300 font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Select Only / Orbit Camera (Shortcut: Q)"
            >
              <MousePointer className="w-3.5 h-3.5" />
              <span>Select</span>
              <kbd className="text-[9px] px-1 rounded bg-black/30 font-mono">Q</kbd>
            </button>

            {/* Servo Rotation Target Toggle: Servo Body vs Horn Angle */}
            {selectedServo && transformMode === 'rotate' && (
              <div className="flex items-center bg-[#0c0f17] p-0.5 rounded border border-purple-500/50 text-[11px] ml-1">
                <button
                  onClick={() => setServoRotateTarget('body')}
                  className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                    servoRotateTarget === 'body'
                      ? 'bg-purple-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Rotate Servo Body Casing (Pitch, Yaw, Roll X/Y/Z)"
                >
                  📦 Servo Body
                </button>
                <button
                  onClick={() => setServoRotateTarget('horn')}
                  className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                    servoRotateTarget === 'horn'
                      ? 'bg-cyan-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Rotate Servo Horn Output Shaft Angle"
                >
                  ⚙️ Horn Shaft
                </button>
              </div>
            )}

            {/* Instant STOP MOVING / Freeze Button */}
            <button
              onClick={() => {
                transformControlsRef.current?.detach();
                setTransformMode('none');
                cancelSnapLine();
                setSnapNotice('⏹ Movement stopped & object locked in position.');
              }}
              className="px-2 py-1 rounded flex items-center gap-1.5 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 transition-colors ml-1"
              title="Stop moving immediately and lock object position (Shortcut: Space)"
            >
              <Pause className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-semibold">Stop Moving</span>
              <kbd className="text-[9px] px-1 rounded bg-black/40 font-mono text-amber-200">Space</kbd>
            </button>

            {/* Dedicated Delete Button in Toolbar */}
            <button
              onClick={handleDeleteSelected}
              disabled={!selectedPart && !selectedServo}
              className={`px-2.5 py-1 rounded flex items-center gap-1.5 transition-all ml-1 ${
                selectedPart || selectedServo
                  ? 'bg-rose-600/30 text-rose-200 hover:bg-rose-600/50 border border-rose-500/60 font-semibold shadow-sm cursor-pointer'
                  : 'bg-[#181f33]/40 text-slate-500 border border-[#27324c]/40 font-medium cursor-not-allowed opacity-50'
              }`}
              title={
                selectedPart || selectedServo
                  ? `Delete selected ${selectedPart ? selectedPart.name : selectedServo?.name} and its constraints (Shortcut: Delete / Backspace)`
                  : 'Select an object in 3D to delete it'
              }
            >
              <Trash2 className={`w-3.5 h-3.5 ${selectedPart || selectedServo ? 'text-rose-400' : 'text-slate-600'}`} />
              <span className="font-semibold">Delete</span>
              {(selectedPart || selectedServo) && (
                <kbd className="text-[9px] px-1 rounded bg-black/40 font-mono text-rose-200">Del</kbd>
              )}
            </button>
          </div>

          <div className="h-4 w-[1px] bg-[#27324c] mx-1" />

          {/* Connect Tool: Click to show/hide yellow snap orbs */}
          <button
            onClick={() => {
              const nextActive = !snapLinkToolActive;
              setSnapLinkToolActive(nextActive);
              if (nextActive) {
                setSnapNotice('⚡ Connect Mode Active: Yellow snap orbs are now visible! Click any orb to connect.');
              } else {
                cancelSnapLine();
                setSnapNotice('Connect Mode exited. Snap orbs hidden.');
              }
            }}
            className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 border transition-all shadow-sm ${
              snapLinkToolActive || connectingSource
                ? 'bg-yellow-400 text-slate-950 border-yellow-300 font-bold shadow-lg shadow-yellow-500/25 ring-2 ring-yellow-400/50'
                : 'bg-[#181f33] text-yellow-400 hover:text-yellow-300 border-yellow-500/40 hover:bg-[#1f2842]'
            }`}
            title="Connect: Click to show yellow snap orbs on blocks & servos (Shortcut: C)"
          >
            <Magnet className="w-3.5 h-3.5 text-current" />
            <span>Connect</span>
            {(snapLinkToolActive || connectingSource) && (
              <span className="text-[10px] bg-slate-950/20 text-slate-950 px-1 rounded font-bold uppercase">Orbs On</span>
            )}
            <kbd className={`text-[9px] px-1 rounded font-mono ${snapLinkToolActive || connectingSource ? 'bg-black/30 text-slate-900 font-bold' : 'bg-black/40 text-yellow-300'}`}>
              C
            </kbd>
          </button>

          <div className="h-4 w-[1px] bg-[#27324c] mx-1" />

          {/* Camera View Buttons */}
          <div className="flex items-center bg-[#181f33] p-0.5 rounded-md border border-[#27324c] text-xs">
            <button
              onClick={() => setCameraView('perspective')}
              className={`px-2 py-1 rounded ${viewPreset === 'perspective' ? 'bg-cyan-500/20 text-cyan-400 font-medium' : 'text-slate-400 hover:text-white'}`}
            >
              Perspective
            </button>
            <button
              onClick={() => setCameraView('front')}
              className={`px-2 py-1 rounded ${viewPreset === 'front' ? 'bg-cyan-500/20 text-cyan-400 font-medium' : 'text-slate-400 hover:text-white'}`}
            >
              Front
            </button>
            <button
              onClick={() => setCameraView('side')}
              className={`px-2 py-1 rounded ${viewPreset === 'side' ? 'bg-cyan-500/20 text-cyan-400 font-medium' : 'text-slate-400 hover:text-white'}`}
            >
              Side
            </button>
            <button
              onClick={() => setCameraView('top')}
              className={`px-2 py-1 rounded ${viewPreset === 'top' ? 'bg-cyan-500/20 text-cyan-400 font-medium' : 'text-slate-400 hover:text-white'}`}
            >
              Top
            </button>
          </div>

          <button
            onClick={() => setShowWireframe(!showWireframe)}
            className={`px-2.5 py-1 rounded text-xs flex items-center gap-1 border border-[#27324c] transition-colors ${showWireframe ? 'bg-cyan-500/20 text-cyan-400' : 'bg-[#181f33] text-slate-400 hover:text-white'}`}
          >
            <Eye className="w-3 h-3" />
            Wireframe
          </button>
        </div>

        {/* Live Arduino Sync Status & Emergency Stop */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={isLiveSync}
              onChange={(e) => setIsLiveSync(e.target.checked)}
              className="rounded accent-cyan-500"
            />
            <span>Live Hardware Sync</span>
          </label>

          {canUndo && (
            <button
              onClick={onUndo}
              className="p-1.5 rounded bg-[#181f33] text-slate-300 hover:text-white border border-[#27324c]"
              title="Undo (Ctrl+Z)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          {canRedo && (
            <button
              onClick={onRedo}
              className="p-1.5 rounded bg-[#181f33] text-slate-300 hover:text-white border border-[#27324c]"
              title="Redo (Ctrl+Y)"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => arduinoSerial.emergencyStop()}
            className="px-3 py-1 rounded text-xs font-bold uppercase tracking-wider bg-rose-600 hover:bg-rose-500 text-white shadow-md flex items-center gap-1.5 transition-all"
            title="Immediately detach all servos and zero PWM"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Emergency STOP
          </button>
        </div>
      </div>

      {/* Main 3D Canvas Viewport (100% Unobstructed Center) */}
      <div
        ref={mountRef}
        onClick={handleCanvasClick}
        onPointerMove={handlePointerMove}
        className={`flex-1 w-full relative cursor-grab active:cursor-grabbing ${
          connectingSource ? 'cursor-crosshair' : ''
        }`}
      >
        {/* Snap & Movement Notifications */}
        {snapNotice && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-950 font-bold px-4 py-1.5 rounded-full text-xs shadow-2xl flex items-center gap-2 z-30 pointer-events-auto border border-amber-300 animate-in fade-in zoom-in-95 duration-150">
            <Zap className="w-4 h-4 text-slate-950 fill-current animate-pulse" />
            <span>{snapNotice}</span>
            <button
              onClick={() => setSnapNotice(null)}
              className="ml-2 w-4 h-4 rounded-full bg-black/20 hover:bg-black/30 text-black flex items-center justify-center text-[10px]"
            >
              ✕
            </button>
          </div>
        )}

        {/* Dynamic Snap Line Active Banner */}
        {connectingSource && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-[#111625]/95 border-2 border-yellow-400 text-yellow-300 font-semibold px-4 py-2 rounded-xl text-xs shadow-2xl flex items-center gap-3 z-30 pointer-events-auto backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-ping"></span>
              <span>CONNECTING LINE ACTIVE: Click a second yellow sphere on any block or servo to snap connect!</span>
            </div>
            <button
              onClick={cancelSnapLine}
              className="px-2 py-0.5 rounded bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 border border-rose-500/40 text-[11px]"
            >
              Cancel Line (ESC)
            </button>
          </div>
        )}

        {/* Floating Quick Selection & Interactive Manipulation Card */}
        {(selectedPart || selectedServo) && (
          <div className="absolute top-3 left-4 bg-[#111625]/95 border border-[#27324c] rounded-lg px-3 py-2 text-xs text-slate-300 shadow-xl flex flex-col gap-2 backdrop-blur-sm pointer-events-auto">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-cyan-400 font-mono text-[11px] font-semibold">SELECTED:</span>
                <span className="font-semibold text-white">
                  {selectedPart ? selectedPart.name : selectedServo?.name}
                </span>
                <span className="text-slate-400 text-[10px]">
                  {selectedPart ? `(${selectedPart.type.toUpperCase()})` : `[Pin ${selectedServo?.pin}]`}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectPart(null);
                  onSelectServo(null);
                }}
                className="text-slate-500 hover:text-white text-[10px]"
                title="Deselect"
              >
                ✕
              </button>
            </div>

            {/* Quick Gizmo Mode Switcher for Active Selection */}
            <div className="flex items-center flex-wrap gap-1.5 text-[11px] pt-1 border-t border-[#27324c]/60">
              <span className="text-slate-500 font-mono text-[10px]">GIZMO:</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setTransformMode('translate');
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 transition-colors ${
                  transformMode === 'translate'
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'bg-[#181f33] text-slate-300 hover:text-white border border-[#27324c]'
                }`}
              >
                <Move className="w-2.5 h-2.5" /> Drag / Move [W]
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setTransformMode('rotate');
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 transition-colors ${
                  transformMode === 'rotate'
                    ? 'bg-purple-500 text-white font-bold'
                    : 'bg-[#181f33] text-slate-300 hover:text-white border border-[#27324c]'
                }`}
              >
                <RotateCw className="w-2.5 h-2.5" /> Rotate [E]
              </button>

              {/* Stop Moving Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  transformControlsRef.current?.detach();
                  setTransformMode('none');
                  setSnapNotice('⏹ Movement stopped & object locked in place.');
                }}
                className="px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 transition-colors"
                title="Stop moving immediately and lock position"
              >
                <Pause className="w-2.5 h-2.5 text-amber-400" /> Stop Moving
              </button>

              {/* Dedicated Delete Object Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteSelected();
                }}
                className="px-2.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 bg-rose-600/30 hover:bg-rose-600/50 text-rose-200 border border-rose-500/50 transition-colors shadow-sm"
                title="Delete selected object and remove its constraints (Shortcut: Delete / Backspace)"
              >
                <Trash2 className="w-2.5 h-2.5 text-rose-400" /> Delete
              </button>

              {/* Connect Button: Toggle Yellow Orbs */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const nextActive = !snapLinkToolActive;
                  setSnapLinkToolActive(nextActive);
                  if (nextActive) {
                    setSnapNotice('⚡ Connect Mode Active: Yellow snap orbs shown! Click an orb to connect.');
                  } else {
                    cancelSnapLine();
                    setSnapNotice('Connect Mode exited. Snap orbs hidden.');
                  }
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors border ${
                  snapLinkToolActive || connectingSource
                    ? 'bg-yellow-400 text-slate-950 font-bold border-yellow-300 ring-1 ring-yellow-400'
                    : 'bg-[#181f33] text-yellow-300 hover:text-yellow-200 border-yellow-500/40 hover:bg-[#202945]'
                }`}
                title="Connect: Show yellow orbs to snap this object (Shortcut: C)"
              >
                <Magnet className="w-2.5 h-2.5" /> Connect [C]
              </button>

              {/* Unsnap button if connected */}
              {selectedServo && (selectedServo.attachedPartId || selectedServo.parentPartId) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateServo({
                      ...selectedServo,
                      attachedPartId: null,
                      parentPartId: null,
                    });
                    setSnapNotice(`Unsnapped ${selectedServo.name}`);
                  }}
                  className="px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40 transition-colors"
                  title="Disconnect from block"
                >
                  <Unlink className="w-2.5 h-2.5" /> Unsnap
                </button>
              )}

              {selectedPart && (selectedPart.servoId || selectedPart.parentId) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdatePart({
                      ...selectedPart,
                      servoId: undefined,
                      parentId: null,
                    });
                    const parentServo = servos.find((s) => s.attachedPartId === selectedPart.id);
                    if (parentServo) {
                      onUpdateServo({ ...parentServo, attachedPartId: null });
                    }
                    setSnapNotice(`Unsnapped ${selectedPart.name}`);
                  }}
                  className="px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40 transition-colors"
                  title="Disconnect from servo/block"
                >
                  <Unlink className="w-2.5 h-2.5" /> Unsnap
                </button>
              )}
            </div>

            {/* Dedicated Servo Joint (Strict Y-Axis) Drag-and-Rotate Controller */}
            {targetServo && (
              <div className="flex flex-col gap-1.5 p-2 bg-[#141b2d] rounded border border-cyan-500/30 mt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-cyan-300 font-semibold text-[11px]">
                    <RotateCw className="w-3 h-3 text-cyan-400" />
                    <span>
                      {selectedPart ? `SERVO JOINT: ${targetServo.name}` : 'SERVO Y-AXIS ROTATION'}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                    PIN {targetServo.pin} [Y-AXIS]
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Angle (0° - 180°):</span>
                  <span className="font-mono text-cyan-400 font-bold text-xs">
                    {Math.round(currentAnglesRef.current.get(targetServo.id) ?? targetServo.targetAngle ?? targetServo.currentAngle ?? 90)}°
                  </span>
                </div>

                {/* Interactive Angle Scrubber / Slider */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 font-mono">0°</span>
                  <input
                    type="range"
                    min={targetServo.minAngle ?? 0}
                    max={targetServo.maxAngle ?? 180}
                    value={Math.round(currentAnglesRef.current.get(targetServo.id) ?? targetServo.targetAngle ?? targetServo.currentAngle ?? 90)}
                    onChange={(e) => handleServoAngleChange(targetServo, parseInt(e.target.value))}
                    className="flex-1 accent-cyan-400 h-1.5 bg-[#0c0f17] rounded cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-500 font-mono">180°</span>
                </div>

                {/* Quick Angle Jump Buttons & 3D Auto-Sweep */}
                <div className="flex items-center justify-between gap-1 pt-0.5">
                  <div className="flex items-center gap-1">
                    {[0, 45, 90, 135, 180].map((deg) => (
                      <button
                        key={deg}
                        onClick={() => handleServoAngleChange(targetServo, deg)}
                        className="px-1.5 py-0.5 text-[9px] font-mono bg-[#181f33] hover:bg-cyan-950 text-slate-300 hover:text-cyan-300 border border-[#27324c] rounded transition-colors"
                      >
                        {deg}°
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => toggleAutoSweep(targetServo.id)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                      sweepingServoIds.has(targetServo.id)
                        ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                        : 'bg-[#181f33] text-slate-400 hover:text-white border-[#27324c]'
                    }`}
                    title="Toggle continuous sweep oscillation"
                  >
                    {sweepingServoIds.has(targetServo.id) ? '⟳ Sweeping' : '⟳ Sweep'}
                  </button>
                </div>

                <div className="text-[10px] text-cyan-300/80 bg-cyan-950/40 rounded px-2 py-1 border border-cyan-800/40 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-cyan-400 shrink-0" />
                  <span>
                    Press <kbd className="px-1 py-0.2 bg-black/50 text-white rounded font-mono font-bold">E</kbd> to drag-rotate this attached part around the green Y-axis ring in 3D!
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Collapsible Studio Control Dock (Compliant with Skill Zero-Occlusion Rules) */}
      <div className="w-full bg-[#111625]/95 border-t border-[#27324c] z-20 transition-all duration-300 flex flex-col">
        {/* Dock Header & Toggle */}
        <div className="h-9 px-4 flex items-center justify-between border-b border-[#27324c]/60 bg-[#141b2d]">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowTour(true)}
              className="p-1.5 text-cyan-400 hover:text-cyan-300 hover:bg-[#181f33] rounded transition-colors"
              title="Take a Tour"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setActiveTab('build');
                if (hudCollapsed) setHudCollapsed(false);
              }}
              className={`px-3 py-1 text-xs font-medium rounded-t border-t border-x transition-colors ${
                activeTab === 'build' && !hudCollapsed
                  ? 'bg-[#181f33] text-cyan-400 border-[#27324c]'
                  : 'text-slate-400 border-transparent hover:text-white'
              }`}
            >
              Build & Parts
            </button>
            <button
              onClick={() => {
                setActiveTab('servos');
                if (hudCollapsed) setHudCollapsed(false);
              }}
              className={`px-3 py-1 text-xs font-medium rounded-t border-t border-x transition-colors ${
                activeTab === 'servos' && !hudCollapsed
                  ? 'bg-[#181f33] text-purple-400 border-[#27324c]'
                  : 'text-slate-400 border-transparent hover:text-white'
              }`}
            >
              Servo Motors ({servos.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('hierarchy');
                if (hudCollapsed) setHudCollapsed(false);
              }}
              className={`px-3 py-1 text-xs font-medium rounded-t border-t border-x transition-colors ${
                activeTab === 'hierarchy' && !hudCollapsed
                  ? 'bg-[#181f33] text-emerald-400 border-[#27324c]'
                  : 'text-slate-400 border-transparent hover:text-white'
              }`}
            >
              Kinematic Hierarchy
            </button>
          </div>

          <button
            onClick={() => setHudCollapsed(!hudCollapsed)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded"
          >
            {hudCollapsed ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
            <span>{hudCollapsed ? 'Expand Dock' : 'Collapse Dock'}</span>
          </button>
        </div>

        {/* Dock Content Body */}
        {!hudCollapsed && (
          <div className="p-3 max-h-60 overflow-y-auto">
            {activeTab === 'build' && (
              <div className="flex flex-col gap-3">
                {/* Palette to Add Primitive Parts */}
                <div className="flex flex-wrap items-center gap-2 part-palette">
                  <span className="text-xs text-slate-400 font-mono">ADD PART:</span>
                  <button
                    onClick={() => onAddPart('box')}
                    className="px-2.5 py-1 text-xs bg-[#181f33] hover:bg-[#202945] text-slate-200 border border-[#27324c] rounded flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3 text-cyan-400" /> Box
                  </button>
                  <button
                    onClick={() => onAddPart('cylinder')}
                    className="px-2.5 py-1 text-xs bg-[#181f33] hover:bg-[#202945] text-slate-200 border border-[#27324c] rounded flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3 text-cyan-400" /> Cylinder
                  </button>
                  <button
                    onClick={() => onAddPart('sphere')}
                    className="px-2.5 py-1 text-xs bg-[#181f33] hover:bg-[#202945] text-slate-200 border border-[#27324c] rounded flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3 text-cyan-400" /> Sphere
                  </button>
                  <button
                    onClick={() => onAddPart('leg')}
                    className="px-2.5 py-1 text-xs bg-[#181f33] hover:bg-[#202945] text-slate-200 border border-[#27324c] rounded flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3 text-cyan-400" /> Leg Link
                  </button>
                  <button
                    onClick={() => onAddPart('arm')}
                    className="px-2.5 py-1 text-xs bg-[#181f33] hover:bg-[#202945] text-slate-200 border border-[#27324c] rounded flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3 text-cyan-400" /> Arm Link
                  </button>
                  <button
                    onClick={() => onAddPart('wheel')}
                    className="px-2.5 py-1 text-xs bg-[#181f33] hover:bg-[#202945] text-slate-200 border border-[#27324c] rounded flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3 text-cyan-400" /> Wheel
                  </button>
                  <button
                    onClick={() => onAddPart('head')}
                    className="px-2.5 py-1 text-xs bg-[#181f33] hover:bg-[#202945] text-slate-200 border border-[#27324c] rounded flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3 text-cyan-400" /> Head Visor
                  </button>
                  <button
                    onClick={() => onAddPart('gripper')}
                    className="px-2.5 py-1 text-xs bg-[#181f33] hover:bg-[#202945] text-slate-200 border border-[#27324c] rounded flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3 text-cyan-400" /> Claw Gripper
                  </button>

                  <div className="h-4 w-[1px] bg-[#27324c] mx-2" />

                  <button
                    onClick={onAddServo}
                    className="add-servo-button px-3 py-1 text-xs bg-purple-600/30 hover:bg-purple-600/40 text-purple-300 border border-purple-500/40 rounded flex items-center gap-1.5 font-medium"
                  >
                    <Cpu className="w-3.5 h-3.5 text-purple-400" /> Add Servo Motor
                  </button>
                </div>

                {/* 3D Electronics & Microcontrollers Palette */}
                <div className="flex flex-col gap-1.5 pt-2 border-t border-[#27324c]/60">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-cyan-400 font-mono font-semibold flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-cyan-400" />
                      3D ELECTRONICS & SENSORS:
                    </span>
                    <span className="text-[10px] text-slate-400">Click any component to drop directly into 3D scene</span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-9 gap-1.5">
                    <button
                      onClick={() => onAddPart('arduino_uno')}
                      className="px-2 py-1 text-[11px] bg-[#181f33] hover:bg-[#202945] text-teal-300 border border-teal-500/30 hover:border-teal-400 rounded flex items-center justify-center gap-1 font-medium transition-colors"
                      title="Arduino Uno R3 Microcontroller Board"
                    >
                      <Cpu className="w-3 h-3 text-teal-400" /> Arduino Uno
                    </button>
                    <button
                      onClick={() => onAddPart('microbit')}
                      className="px-2 py-1 text-[11px] bg-[#181f33] hover:bg-[#202945] text-amber-300 border border-amber-500/30 hover:border-amber-400 rounded flex items-center justify-center gap-1 font-medium transition-colors"
                      title="BBC micro:bit V2 Board with 5x5 LED Matrix"
                    >
                      <Zap className="w-3 h-3 text-amber-400" /> micro:bit
                    </button>
                    <button
                      onClick={() => onAddPart('breadboard')}
                      className="px-2 py-1 text-[11px] bg-[#181f33] hover:bg-[#202945] text-slate-200 border border-slate-500/30 hover:border-slate-400 rounded flex items-center justify-center gap-1 font-medium transition-colors"
                      title="Solderless Breadboard Small"
                    >
                      <Layers className="w-3 h-3 text-slate-300" /> Breadboard
                    </button>
                    <button
                      onClick={() => onAddPart('sensor_ultrasonic')}
                      className="px-2 py-1 text-[11px] bg-[#181f33] hover:bg-[#202945] text-cyan-300 border border-cyan-500/30 hover:border-cyan-400 rounded flex items-center justify-center gap-1 font-medium transition-colors"
                      title="HC-SR04 Ultrasonic Distance Sensor"
                    >
                      <Eye className="w-3 h-3 text-cyan-400" /> HC-SR04
                    </button>
                    <button
                      onClick={() => onAddPart('sensor_pir')}
                      className="px-2 py-1 text-[11px] bg-[#181f33] hover:bg-[#202945] text-emerald-300 border border-emerald-500/30 hover:border-emerald-400 rounded flex items-center justify-center gap-1 font-medium transition-colors"
                      title="PIR Motion Detection Sensor"
                    >
                      <Sparkles className="w-3 h-3 text-emerald-400" /> PIR Sensor
                    </button>
                    <button
                      onClick={() => onAddPart('sensor_ldr')}
                      className="px-2 py-1 text-[11px] bg-[#181f33] hover:bg-[#202945] text-yellow-300 border border-yellow-500/30 hover:border-yellow-400 rounded flex items-center justify-center gap-1 font-medium transition-colors"
                      title="Photoresistor Light Sensor"
                    >
                      <Zap className="w-3 h-3 text-yellow-400" /> Photoresistor
                    </button>
                    <button
                      onClick={() => onAddPart('piezo_buzzer')}
                      className="px-2 py-1 text-[11px] bg-[#181f33] hover:bg-[#202945] text-sky-300 border border-sky-500/30 hover:border-sky-400 rounded flex items-center justify-center gap-1 font-medium transition-colors"
                      title="Piezo Acoustic Buzzer"
                    >
                      <RotateCw className="w-3 h-3 text-sky-400" /> Piezo Buzzer
                    </button>
                    <button
                      onClick={() => onAddPart('led')}
                      className="px-2 py-1 text-[11px] bg-[#181f33] hover:bg-[#202945] text-rose-300 border border-rose-500/30 hover:border-rose-400 rounded flex items-center justify-center gap-1 font-medium transition-colors"
                      title="High-Brightness 5mm Red LED"
                    >
                      <Zap className="w-3 h-3 text-rose-400" /> Red LED
                    </button>
                    <button
                      onClick={() => onAddPart('multimeter')}
                      className="px-2 py-1 text-[11px] bg-[#181f33] hover:bg-[#202945] text-yellow-300 border border-yellow-500/30 hover:border-yellow-400 rounded flex items-center justify-center gap-1 font-medium transition-colors"
                      title="Digital Multimeter Probe"
                    >
                      <Sliders className="w-3 h-3 text-yellow-400" /> Multimeter
                    </button>
                    <button
                      onClick={() => onAddPart('gearmotor')}
                      className="px-2 py-1 text-[11px] bg-[#181f33] hover:bg-[#202945] text-amber-300 border border-amber-500/30 hover:border-amber-400 rounded flex items-center justify-center gap-1 font-medium transition-colors"
                      title="TT Dual-Shaft Gearmotor"
                    >
                      <RotateCw className="w-3 h-3 text-amber-400" /> Gearmotor
                    </button>
                    <button
                      onClick={() => onAddPart('dc_motor')}
                      className="px-2 py-1 text-[11px] bg-[#181f33] hover:bg-[#202945] text-slate-300 border border-slate-500/30 hover:border-slate-400 rounded flex items-center justify-center gap-1 font-medium transition-colors"
                      title="High-RPM Micro DC Motor"
                    >
                      <RotateCw className="w-3 h-3 text-slate-300" /> DC Motor
                    </button>
                    <button
                      onClick={() => onAddPart('battery_9v')}
                      className="px-2 py-1 text-[11px] bg-[#181f33] hover:bg-[#202945] text-indigo-300 border border-indigo-500/30 hover:border-indigo-400 rounded flex items-center justify-center gap-1 font-medium transition-colors"
                      title="9V Power Battery Block"
                    >
                      <Zap className="w-3 h-3 text-indigo-400" /> 9V Battery
                    </button>
                    <button
                      onClick={() => onAddPart('battery_coin')}
                      className="px-2 py-1 text-[11px] bg-[#181f33] hover:bg-[#202945] text-slate-300 border border-slate-500/30 hover:border-slate-400 rounded flex items-center justify-center gap-1 font-medium transition-colors"
                      title="3V CR2032 Coin Cell Battery"
                    >
                      <Zap className="w-3 h-3 text-slate-300" /> CR2032 Battery
                    </button>
                    <button
                      onClick={() => onAddPart('potentiometer')}
                      className="px-2 py-1 text-[11px] bg-[#181f33] hover:bg-[#202945] text-blue-300 border border-blue-500/30 hover:border-blue-400 rounded flex items-center justify-center gap-1 font-medium transition-colors"
                      title="10K Rotary Potentiometer Knob"
                    >
                      <Sliders className="w-3 h-3 text-blue-400" /> Potentiometer
                    </button>
                    <button
                      onClick={() => onAddPart('switch_slide')}
                      className="px-2 py-1 text-[11px] bg-[#181f33] hover:bg-[#202945] text-purple-300 border border-purple-500/30 hover:border-purple-400 rounded flex items-center justify-center gap-1 font-medium transition-colors"
                      title="3-Pin Slide Switch"
                    >
                      <Sliders className="w-3 h-3 text-purple-400" /> Slide Switch
                    </button>
                    <button
                      onClick={() => onAddPart('pushbutton')}
                      className="px-2 py-1 text-[11px] bg-[#181f33] hover:bg-[#202945] text-pink-300 border border-pink-500/30 hover:border-pink-400 rounded flex items-center justify-center gap-1 font-medium transition-colors"
                      title="Tactile Pushbutton Switch"
                    >
                      <MousePointer className="w-3 h-3 text-pink-400" /> Pushbutton
                    </button>
                    <button
                      onClick={() => onAddPart('resistor')}
                      className="px-2 py-1 text-[11px] bg-[#181f33] hover:bg-[#202945] text-orange-300 border border-orange-500/30 hover:border-orange-400 rounded flex items-center justify-center gap-1 font-medium transition-colors"
                      title="220 Ohm Resistor"
                    >
                      <Cpu className="w-3 h-3 text-orange-400" /> Resistor
                    </button>
                    <button
                      onClick={() => onAddPart('capacitor')}
                      className="px-2 py-1 text-[11px] bg-[#181f33] hover:bg-[#202945] text-blue-300 border border-blue-500/30 hover:border-blue-400 rounded flex items-center justify-center gap-1 font-medium transition-colors"
                      title="10uF Capacitor"
                    >
                      <Cpu className="w-3 h-3 text-blue-400" /> Capacitor
                    </button>
                  </div>
                </div>

                {/* Selected Part Parameter Inspector */}
                {selectedPart ? (
                  <div className="bg-[#141b2d] border border-[#27324c] rounded p-2.5 flex flex-wrap items-center gap-4 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Name:</span>
                      <input
                        type="text"
                        value={selectedPart.name}
                        onChange={(e) => onUpdatePart({ ...selectedPart, name: e.target.value })}
                        className="bg-[#181f33] border border-[#27324c] rounded px-2 py-0.5 text-white w-32"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">Color:</span>
                      <input
                        type="color"
                        value={selectedPart.color}
                        onChange={(e) => onUpdatePart({ ...selectedPart, color: e.target.value })}
                        className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                      />
                    </div>

                    {/* Dimensions */}
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Size (W,H,D):</span>
                      <input
                        type="number"
                        step="0.1"
                        value={selectedPart.dimensions[0]}
                        onChange={(e) =>
                          onUpdatePart({
                            ...selectedPart,
                            dimensions: [parseFloat(e.target.value) || 0.1, selectedPart.dimensions[1], selectedPart.dimensions[2]],
                          })
                        }
                        className="bg-[#181f33] border border-[#27324c] rounded px-1.5 py-0.5 w-14 text-white"
                      />
                      <input
                        type="number"
                        step="0.1"
                        value={selectedPart.dimensions[1]}
                        onChange={(e) =>
                          onUpdatePart({
                            ...selectedPart,
                            dimensions: [selectedPart.dimensions[0], parseFloat(e.target.value) || 0.1, selectedPart.dimensions[2]],
                          })
                        }
                        className="bg-[#181f33] border border-[#27324c] rounded px-1.5 py-0.5 w-14 text-white"
                      />
                      <input
                        type="number"
                        step="0.1"
                        value={selectedPart.dimensions[2]}
                        onChange={(e) =>
                          onUpdatePart({
                            ...selectedPart,
                            dimensions: [selectedPart.dimensions[0], selectedPart.dimensions[1], parseFloat(e.target.value) || 0.1],
                          })
                        }
                        className="bg-[#181f33] border border-[#27324c] rounded px-1.5 py-0.5 w-14 text-white"
                      />
                    </div>

                    {/* Position Y slider for elevation */}
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Pos Y:</span>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        step="0.1"
                        value={selectedPart.position[1]}
                        onChange={(e) =>
                          onUpdatePart({
                            ...selectedPart,
                            position: [selectedPart.position[0], parseFloat(e.target.value), selectedPart.position[2]],
                          })
                        }
                        className="w-20 accent-cyan-500"
                      />
                      <span className="text-slate-300 font-mono w-8">{selectedPart.position[1].toFixed(1)}</span>
                    </div>

                    {/* Actions: Duplicate & Delete */}
                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        onClick={() => onDuplicatePart(selectedPart.id)}
                        className="px-2 py-1 bg-[#181f33] hover:bg-[#202945] text-slate-300 rounded border border-[#27324c] flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3 text-cyan-400" /> Duplicate
                      </button>
                      <button
                        onClick={handleDeleteSelected}
                        className="px-2 py-1 bg-rose-900/30 hover:bg-rose-900/50 text-rose-300 rounded border border-rose-800/40 flex items-center gap-1 font-semibold"
                        title="Delete this block and associated constraints"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  </div>
                ) : selectedServo ? (
                  <div className="bg-[#141b2d] border border-purple-500/40 rounded p-2.5 flex flex-wrap items-center gap-3 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Cpu className="w-4 h-4 text-purple-400" />
                      <span className="text-slate-400">Servo:</span>
                      <input
                        type="text"
                        value={selectedServo.name}
                        onChange={(e) => onUpdateServo({ ...selectedServo, name: e.target.value })}
                        className="bg-[#181f33] border border-[#27324c] rounded px-2 py-0.5 text-white w-28 font-bold"
                      />
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">Pin:</span>
                      <select
                        value={selectedServo.pin}
                        onChange={(e) => onUpdateServo({ ...selectedServo, pin: parseInt(e.target.value, 10) })}
                        className="bg-[#181f33] border border-[#27324c] rounded px-1.5 py-0.5 text-xs text-purple-300 font-mono font-bold"
                      >
                        {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((p) => (
                          <option key={p} value={p}>
                            D{p}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Servo Body Rotation Controls (Pitch X, Yaw Y, Roll Z) */}
                    <div className="flex items-center gap-1.5 bg-[#0c0f17] px-2 py-1 rounded border border-[#27324c]">
                      <span className="text-purple-300 font-mono text-[11px] font-bold">Body Rot (X,Y,Z):</span>
                      <input
                        type="number"
                        value={selectedServo.rotation[0] || 0}
                        onChange={(e) =>
                          onUpdateServo({
                            ...selectedServo,
                            rotation: [parseInt(e.target.value, 10) || 0, selectedServo.rotation[1], selectedServo.rotation[2]],
                          })
                        }
                        className="w-11 bg-[#181f33] border border-[#27324c] rounded text-center text-white font-mono"
                        title="Body Pitch X°"
                      />
                      <input
                        type="number"
                        value={selectedServo.rotation[1] || 0}
                        onChange={(e) =>
                          onUpdateServo({
                            ...selectedServo,
                            rotation: [selectedServo.rotation[0], parseInt(e.target.value, 10) || 0, selectedServo.rotation[2]],
                          })
                        }
                        className="w-11 bg-[#181f33] border border-[#27324c] rounded text-center text-white font-mono"
                        title="Body Yaw Y°"
                      />
                      <input
                        type="number"
                        value={selectedServo.rotation[2] || 0}
                        onChange={(e) =>
                          onUpdateServo({
                            ...selectedServo,
                            rotation: [selectedServo.rotation[0], selectedServo.rotation[1], parseInt(e.target.value, 10) || 0],
                          })
                        }
                        className="w-11 bg-[#181f33] border border-[#27324c] rounded text-center text-white font-mono"
                        title="Body Roll Z°"
                      />
                      <button
                        onClick={() =>
                          onUpdateServo({
                            ...selectedServo,
                            rotation: [(selectedServo.rotation[0] + 90) % 360, selectedServo.rotation[1], selectedServo.rotation[2]],
                          })
                        }
                        className="px-1.5 py-0.5 bg-[#181f33] text-rose-300 rounded border border-[#27324c] text-[10px] font-mono hover:bg-rose-950/40"
                      >
                        +90° X
                      </button>
                      <button
                        onClick={() =>
                          onUpdateServo({
                            ...selectedServo,
                            rotation: [selectedServo.rotation[0], (selectedServo.rotation[1] + 90) % 360, selectedServo.rotation[2]],
                          })
                        }
                        className="px-1.5 py-0.5 bg-[#181f33] text-emerald-300 rounded border border-[#27324c] text-[10px] font-mono hover:bg-emerald-950/40"
                      >
                        +90° Y
                      </button>
                      <button
                        onClick={() =>
                          onUpdateServo({
                            ...selectedServo,
                            rotation: [selectedServo.rotation[0], selectedServo.rotation[1], (selectedServo.rotation[2] + 90) % 360],
                          })
                        }
                        className="px-1.5 py-0.5 bg-[#181f33] text-cyan-300 rounded border border-[#27324c] text-[10px] font-mono hover:bg-cyan-950/40"
                      >
                        +90° Z
                      </button>
                    </div>

                    {/* Horn Shaft Angle Slider */}
                    <div className="flex items-center gap-2 bg-[#0c0f17] px-2 py-1 rounded border border-[#27324c]">
                      <span className="text-cyan-300 font-mono text-[11px] font-bold">Horn:</span>
                      <input
                        type="range"
                        min={selectedServo.minAngle}
                        max={selectedServo.maxAngle}
                        value={selectedServo.targetAngle}
                        onChange={(e) => handleServoAngleChange(selectedServo, parseInt(e.target.value, 10))}
                        className="w-16 accent-cyan-500 cursor-pointer"
                      />
                      <span className="text-white font-mono text-xs font-bold w-7 text-right">{selectedServo.targetAngle}°</span>
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        onClick={handleDeleteSelected}
                        className="px-2 py-1 bg-rose-900/30 hover:bg-rose-900/50 text-rose-300 rounded border border-rose-800/40 flex items-center gap-1 font-semibold text-xs"
                        title="Delete selected servo"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 pt-1 border-t border-[#27324c]/40">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Click any part in the 3D viewport to inspect, or manage robot objects below:</span>
                      <span className="font-mono text-[11px] text-cyan-400">{parts.length} Parts Total</span>
                    </div>
                    {parts.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {parts.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => {
                              onSelectPart(p.id);
                              onSelectServo(null);
                            }}
                            className="flex items-center justify-between p-1.5 rounded bg-[#181f33] border border-[#27324c] hover:border-cyan-500/50 cursor-pointer transition-colors text-xs"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/30"
                                style={{ backgroundColor: p.color }}
                              />
                              <span className="text-slate-200 truncate text-[11px] font-medium">{p.name}</span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeletePart(p.id);
                                setSnapNotice(`🗑 Deleted ${p.name}`);
                              }}
                              className="text-slate-500 hover:text-rose-400 p-1 shrink-0 transition-colors ml-1"
                              title={`Delete ${p.name}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 italic">No robot parts added yet. Click an "ADD PART" button above.</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB: SERVOS & REAL-TIME HARDWARE SYNC */}
            {activeTab === 'servos' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between p-2.5 bg-[#141b2d] border border-[#27324c] rounded-lg">
                  <div className="text-xs font-semibold text-white flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-purple-400" />
                    <span>3D Kinematic Servos ({servos.length})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        servos.forEach((s) => handleServoAngleChange(s, 90));
                      }}
                      className="px-2.5 py-1 text-xs bg-[#181f33] hover:bg-[#202945] text-slate-300 border border-[#27324c] rounded"
                      title="Snap all servos directly to 90°"
                    >
                      All to 90°
                    </button>
                    <button
                      onClick={handleSlowMoveAllTo90}
                      className={`px-3 py-1 text-xs font-bold rounded flex items-center gap-1.5 transition-all shadow-sm ${
                        isSlowMoving
                          ? 'bg-amber-600 text-white animate-pulse'
                          : 'bg-emerald-950/70 hover:bg-emerald-900/90 text-emerald-300 border border-emerald-500/50'
                      }`}
                      title="Smoothly and slowly ease all servos to 90° center"
                    >
                      <span className="text-sm">🐢</span>
                      <span>{isSlowMoving ? `Slow (${slowMoveProgress}%) - Stop` : 'Slow Move All to 90°'}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {servos.map((servo) => (
                  <div
                    key={servo.id}
                    className={`p-3 rounded border transition-colors ${
                      selectedServoId === servo.id
                        ? 'bg-[#181f33] border-purple-500'
                        : 'bg-[#141b2d] border-[#27324c]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Cpu className="w-4 h-4 text-purple-400" />
                        <span className="font-semibold text-xs text-white">{servo.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => toggleAutoSweep(servo.id)}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors border ${
                            sweepingServoIds.has(servo.id)
                              ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                              : 'bg-[#0c0f17] text-slate-400 hover:text-white border-[#27324c]'
                          }`}
                          title="Animate servo continuously back and forth in 3D"
                        >
                          {sweepingServoIds.has(servo.id) ? '⟳ Sweeping' : '⟳ Sweep'}
                        </button>
                        <span className="px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 text-[10px] font-mono border border-purple-800">
                          PIN {servo.pin}
                        </span>
                      </div>
                    </div>

                    {/* Live Angle Slider */}
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="range"
                        min={servo.minAngle}
                        max={servo.maxAngle}
                        value={servo.targetAngle}
                        onChange={(e) => handleServoAngleChange(servo, parseInt(e.target.value, 10))}
                        className="flex-1 accent-purple-500 cursor-pointer"
                      />
                      <input
                        type="number"
                        min={servo.minAngle}
                        max={servo.maxAngle}
                        value={servo.targetAngle}
                        onChange={(e) => handleServoAngleChange(servo, parseInt(e.target.value, 10) || 0)}
                        className="w-12 bg-[#0c0f17] border border-[#27324c] rounded px-1 py-0.5 text-center text-xs text-purple-300 font-mono"
                      />
                      <span className="text-xs text-slate-400">°</span>
                    </div>

                    {/* Quick Preset Angles */}
                    <div className="flex items-center gap-1 mb-1">
                      {[0, 45, 90, 135, 180].map((deg) => (
                        <button
                          key={deg}
                          onClick={() => handleServoAngleChange(servo, deg)}
                          className="flex-1 py-0.5 text-[10px] bg-[#0c0f17] hover:bg-purple-950/60 text-slate-300 rounded border border-[#27324c]"
                        >
                          {deg}°
                        </button>
                      ))}
                      <button
                        onClick={async () => {
                          const start = servo.currentAngle ?? servo.targetAngle ?? 90;
                          const distance = Math.abs(start - 90);
                          if (distance === 0) return;
                          const steps = Math.max(20, Math.round(distance * 1.5));
                          for (let i = 1; i <= steps; i++) {
                            const interp = Math.round(start + (90 - start) * (i / steps));
                            handleServoAngleChange(servo, interp);
                            await new Promise((r) => setTimeout(r, 45));
                          }
                        }}
                        className="px-2 py-0.5 text-[10px] font-bold bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 rounded border border-emerald-500/50 flex items-center gap-0.5"
                        title="Slowly ease this servo to 90°"
                      >
                        <span>🐢</span>
                        <span>Slow</span>
                      </button>
                    </div>

                    {/* Fine Rotation Step Buttons */}
                    <div className="flex items-center gap-1 mb-2">
                      {[-15, -5, 5, 15].map((delta) => (
                        <button
                          key={delta}
                          onClick={() => handleServoAngleChange(servo, (servo.targetAngle ?? 90) + delta)}
                          className="flex-1 py-0.5 text-[10px] font-mono bg-[#0c0f17] hover:bg-purple-950/60 text-purple-300 rounded border border-[#27324c]"
                          title={`Rotate by ${delta > 0 ? `+${delta}` : delta}°`}
                        >
                          {delta > 0 ? `+${delta}°` : `${delta}°`}
                        </button>
                      ))}
                    </div>

                    {/* Axis & Attached Child Part */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-[#27324c]/60 pt-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">Axis:</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-950/70 text-emerald-300 text-[10px] font-mono border border-emerald-800/60 font-semibold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          Y-Axis (Azimuth)
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <span>Child:</span>
                        <select
                          value={servo.attachedPartId || ''}
                          onChange={(e) =>
                            onUpdateServo({ ...servo, attachedPartId: e.target.value || null })
                          }
                          className="bg-[#0c0f17] border border-[#27324c] rounded text-white text-[10px] px-1 py-0.5 max-w-[90px] truncate"
                        >
                          <option value="">(None)</option>
                          {parts.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        onClick={() => onDeleteServo(servo.id)}
                        className="text-rose-400 hover:text-rose-300 p-0.5"
                        title="Remove servo"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

            {/* TAB: KINEMATIC HIERARCHY TREE */}
            {activeTab === 'hierarchy' && (
              <div className="hierarchy-tree bg-[#141b2d] border border-[#27324c] rounded p-3 text-xs">
                <div className="text-slate-400 mb-2 font-mono text-[11px]">
                  ASSEMBLY KINEMATICS TREE: (Root → Servos → Attached Parts)
                </div>
                <div className="flex flex-col gap-1.5">
                  {servos.map((servo) => {
                    const childPart = parts.find((p) => p.id === servo.attachedPartId);
                    return (
                      <div
                        key={servo.id}
                        className="flex items-center gap-2 p-1.5 bg-[#181f33] rounded border border-[#27324c] hover:border-purple-500/40 transition-colors"
                      >
                        <button
                          onClick={() => {
                            onSelectServo(servo.id);
                            onSelectPart(null);
                          }}
                          className="flex items-center gap-1.5 hover:text-purple-300 transition-colors"
                          title="Select servo in 3D"
                        >
                          <Cpu className="w-3.5 h-3.5 text-purple-400" />
                          <span className="font-semibold text-white">{servo.name}</span>
                          <span className="text-purple-400 font-mono text-[10px]">[Pin {servo.pin}]</span>
                        </button>
                        <span className="text-slate-500">──►</span>
                        {childPart ? (
                          <button
                            onClick={() => {
                              onSelectPart(childPart.id);
                              onSelectServo(null);
                            }}
                            className="flex items-center gap-1 text-cyan-300 hover:text-cyan-200 transition-colors"
                            title="Select child part in 3D"
                          >
                            <Move className="w-3.5 h-3.5 text-cyan-400" />
                            <span>{childPart.name}</span>
                          </button>
                        ) : (
                          <span className="flex items-center gap-1 text-slate-500 italic text-[11px]">
                            <Move className="w-3 h-3 text-slate-600" />
                            No attached part
                          </span>
                        )}
                        <span className="text-slate-400 ml-auto font-mono text-[10px]">
                          Angle: {servo.targetAngle}°
                        </span>
                        <button
                          onClick={() => {
                            onDeleteServo(servo.id);
                            setSnapNotice(`🗑 Deleted ${servo.name}`);
                          }}
                          className="text-slate-500 hover:text-rose-400 p-1 shrink-0 transition-colors ml-1"
                          title={`Delete ${servo.name}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {showTour && <GuidedTour steps={tourSteps} onFinish={() => setShowTour(false)} />}
    </div>
  );
};
