import * as THREE from 'three';
import { RobotPart } from '../types';

/**
 * Generate standard Wavefront .OBJ file content from robot parts
 */
export function exportPartsToOBJ(parts: RobotPart[], projectName: string = 'robot'): string {
  let output = `# Arduino Control Studio 3D Model Export: ${projectName}\n`;
  output += `# Exported at: ${new Date().toISOString()}\n\n`;

  let vertexOffset = 1;

  for (const part of parts) {
    output += `g ${part.name.replace(/\\s+/g, '_')}\n`;
    output += `o ${part.name.replace(/\\s+/g, '_')}\n`;

    // Create temporary geometry matching the part
    let geo: THREE.BufferGeometry;
    const [w, h, d] = part.dimensions;

    switch (part.type) {
      case 'cylinder':
      case 'leg':
      case 'arm':
        geo = new THREE.CylinderGeometry(w / 2, (d || w) / 2, h, 16);
        break;
      case 'sphere':
      case 'head':
        geo = new THREE.SphereGeometry(w / 2, 16, 16);
        break;
      case 'wheel':
        geo = new THREE.CylinderGeometry(w / 2, w / 2, h, 24);
        geo.rotateZ(Math.PI / 2);
        break;
      case 'box':
      case 'body':
      case 'joint_bracket':
      case 'gripper':
      default:
        geo = new THREE.BoxGeometry(w, h, d);
        break;
    }

    const pos = geo.getAttribute('position');
    const normal = geo.getAttribute('normal');
    const index = geo.getIndex();

    // Transform by part position and rotation
    const [px, py, pz] = part.position;
    const [rx, ry, rz] = part.rotation;
    const [sx, sy, sz] = part.scale;

    const euler = new THREE.Euler(
      THREE.MathUtils.degToRad(rx),
      THREE.MathUtils.degToRad(ry),
      THREE.MathUtils.degToRad(rz)
    );
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(px, py, pz),
      new THREE.Quaternion().setFromEuler(euler),
      new THREE.Vector3(sx, sy, sz)
    );

    geo.applyMatrix4(matrix);

    // Write vertices
    for (let i = 0; i < pos.count; i++) {
      output += `v ${pos.getX(i).toFixed(4)} ${pos.getY(i).toFixed(4)} ${pos.getZ(i).toFixed(4)}\n`;
    }

    // Write normals
    if (normal) {
      for (let i = 0; i < normal.count; i++) {
        output += `vn ${normal.getX(i).toFixed(4)} ${normal.getY(i).toFixed(4)} ${normal.getZ(i).toFixed(4)}\n`;
      }
    }

    // Write faces
    if (index) {
      for (let i = 0; i < index.count; i += 3) {
        const a = index.getX(i) + vertexOffset;
        const b = index.getX(i + 1) + vertexOffset;
        const c = index.getX(i + 2) + vertexOffset;
        output += `f ${a}//${a} ${b}//${b} ${c}//${c}\n`;
      }
    } else {
      for (let i = 0; i < pos.count; i += 3) {
        const a = i + vertexOffset;
        const b = i + 1 + vertexOffset;
        const c = i + 2 + vertexOffset;
        output += `f ${a}//${a} ${b}//${b} ${c}//${c}\n`;
      }
    }

    vertexOffset += pos.count;
    geo.dispose();
  }

  return output;
}

/**
 * Generate standard ASCII STL file content from robot parts
 */
export function exportPartsToSTL(parts: RobotPart[], projectName: string = 'robot'): string {
  let output = `solid ${projectName.replace(/\\s+/g, '_')}\n`;

  for (const part of parts) {
    const [w, h, d] = part.dimensions;
    let geo: THREE.BufferGeometry;

    switch (part.type) {
      case 'cylinder':
      case 'leg':
      case 'arm':
        geo = new THREE.CylinderGeometry(w / 2, (d || w) / 2, h, 16);
        break;
      case 'sphere':
      case 'head':
        geo = new THREE.SphereGeometry(w / 2, 16, 16);
        break;
      case 'wheel':
        geo = new THREE.CylinderGeometry(w / 2, w / 2, h, 20);
        geo.rotateZ(Math.PI / 2);
        break;
      default:
        geo = new THREE.BoxGeometry(w, h, d);
        break;
    }

    const [px, py, pz] = part.position;
    const [rx, ry, rz] = part.rotation;
    const [sx, sy, sz] = part.scale;

    const euler = new THREE.Euler(
      THREE.MathUtils.degToRad(rx),
      THREE.MathUtils.degToRad(ry),
      THREE.MathUtils.degToRad(rz)
    );
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(px, py, pz),
      new THREE.Quaternion().setFromEuler(euler),
      new THREE.Vector3(sx, sy, sz)
    );

    geo.applyMatrix4(matrix);

    const nonIndexed = geo.toNonIndexed();
    const pos = nonIndexed.getAttribute('position');

    for (let i = 0; i < pos.count; i += 3) {
      const vA = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
      const vB = new THREE.Vector3(pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1));
      const vC = new THREE.Vector3(pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));

      const cb = new THREE.Vector3().subVectors(vC, vB);
      const ab = new THREE.Vector3().subVectors(vA, vB);
      const normal = cb.cross(ab).normalize();

      output += `  facet normal ${normal.x.toFixed(4)} ${normal.y.toFixed(4)} ${normal.z.toFixed(4)}\n`;
      output += `    outer loop\n`;
      output += `      vertex ${vA.x.toFixed(4)} ${vA.y.toFixed(4)} ${vA.z.toFixed(4)}\n`;
      output += `      vertex ${vB.x.toFixed(4)} ${vB.y.toFixed(4)} ${vB.z.toFixed(4)}\n`;
      output += `      vertex ${vC.x.toFixed(4)} ${vC.y.toFixed(4)} ${vC.z.toFixed(4)}\n`;
      output += `    endloop\n`;
      output += `  endfacet\n`;
    }

    geo.dispose();
    nonIndexed.dispose();
  }

  output += `endsolid ${projectName.replace(/\\s+/g, '_')}\n`;
  return output;
}

/**
 * Trigger browser file download
 */
export function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
