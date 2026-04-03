import * as THREE from 'three';
import { SKY_COLORS } from '../constants.js';

export class SkyRenderer {
  constructor(scene) {
    // Large background plane behind everything
    const geo = new THREE.PlaneGeometry(200, 200);

    // Vertex colors for gradient (top to bottom)
    const colors = new Float32Array(4 * 3); // 4 vertices, 3 components each
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, depthWrite: false });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set(20, 10, -50); // behind everything, centered on tower
    scene.add(this.mesh);

    this.setTime(8); // default to daytime
  }

  setTime(hour) {
    let topColor, bottomColor;

    if (hour >= 6 && hour < 8) {
      // Dawn
      const t = (hour - 6) / 2;
      topColor = lerpColor(SKY_COLORS.night.top, SKY_COLORS.day.top, t);
      bottomColor = lerpColor(SKY_COLORS.dawn.bottom, SKY_COLORS.day.bottom, t);
    } else if (hour >= 8 && hour < 17) {
      // Day
      topColor = SKY_COLORS.day.top;
      bottomColor = SKY_COLORS.day.bottom;
    } else if (hour >= 17 && hour < 20) {
      // Sunset
      const t = (hour - 17) / 3;
      topColor = lerpColor(SKY_COLORS.day.top, SKY_COLORS.night.top, t);
      bottomColor = lerpColor(SKY_COLORS.day.bottom, SKY_COLORS.sunset.bottom, t);
    } else if (hour >= 20 && hour < 21) {
      // Dusk to night
      const t = hour - 20;
      topColor = SKY_COLORS.night.top;
      bottomColor = lerpColor(SKY_COLORS.sunset.bottom, SKY_COLORS.night.bottom, t);
    } else {
      // Night
      topColor = SKY_COLORS.night.top;
      bottomColor = SKY_COLORS.night.bottom;
    }

    const top = new THREE.Color(topColor);
    const bottom = new THREE.Color(bottomColor);

    // PlaneGeometry vertices: 0=top-left, 1=top-right, 2=bottom-left, 3=bottom-right
    const colors = this.mesh.geometry.attributes.color;
    colors.setXYZ(0, top.r, top.g, top.b);       // top-left
    colors.setXYZ(1, top.r, top.g, top.b);       // top-right
    colors.setXYZ(2, bottom.r, bottom.g, bottom.b); // bottom-left
    colors.setXYZ(3, bottom.r, bottom.g, bottom.b); // bottom-right
    colors.needsUpdate = true;
  }
}

function lerpColor(hex1, hex2, t) {
  const c1 = new THREE.Color(hex1);
  const c2 = new THREE.Color(hex2);
  c1.lerp(c2, t);
  return '#' + c1.getHexString();
}
