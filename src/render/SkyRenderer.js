import * as THREE from 'three';

// Sky color keyframes — each defines colors at 5 vertical bands
// (zenith, upper, mid, lower, horizon) at a specific hour.
// Transitions are smoothly interpolated between adjacent keyframes.
const SKY_KEYFRAMES = [
  { hour: 0,    zenith: '#152858', upper: '#1a3068', mid: '#1e3870', lower: '#203a72', horizon: '#1a3060' },
  { hour: 4.5,  zenith: '#152858', upper: '#1a3068', mid: '#203870', lower: '#253e75', horizon: '#2a4478' },
  { hour: 5.5,  zenith: '#1a3468', upper: '#254078', mid: '#384a80', lower: '#604a68', horizon: '#885848' },
  { hour: 6.0,  zenith: '#203c78', upper: '#305088', mid: '#506090', lower: '#906868', horizon: '#cc8055' },
  { hour: 6.5,  zenith: '#305888', upper: '#4070a0', mid: '#6888b0', lower: '#b09878', horizon: '#e8a868' },
  { hour: 7.5,  zenith: '#3870b0', upper: '#4a88c8', mid: '#6aa0d8', lower: '#88b8e0', horizon: '#a8cce0' },
  { hour: 9,    zenith: '#4a90d9', upper: '#5a9ee0', mid: '#70aee5', lower: '#80bee8', horizon: '#87ceeb' },
  { hour: 16,   zenith: '#4a90d9', upper: '#5a9ee0', mid: '#70aee5', lower: '#80bee8', horizon: '#87ceeb' },
  { hour: 17,   zenith: '#4888cc', upper: '#5590c8', mid: '#6898c0', lower: '#8898a8', horizon: '#b8a888' },
  { hour: 18,   zenith: '#2a5090', upper: '#3a5888', mid: '#585880', lower: '#886070', horizon: '#cc7858' },
  { hour: 19,   zenith: '#1e3a70', upper: '#283e6e', mid: '#3a3a68', lower: '#604058', horizon: '#884848' },
  { hour: 20,   zenith: '#183060', upper: '#1e3468', mid: '#223868', lower: '#303868', horizon: '#3a3860' },
  { hour: 21,   zenith: '#152858', upper: '#1a3068', mid: '#1e3870', lower: '#203a72', horizon: '#1a3060' },
  { hour: 24,   zenith: '#152858', upper: '#1a3068', mid: '#1e3870', lower: '#203a72', horizon: '#1a3060' },
];

// Smoothstep for more natural easing between keyframes
function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function getKeyframeColors(hour) {
  // Wrap hour to 0-24
  hour = ((hour % 24) + 24) % 24;

  // Find surrounding keyframes
  let lo = SKY_KEYFRAMES[0], hi = SKY_KEYFRAMES[1];
  for (let i = 0; i < SKY_KEYFRAMES.length - 1; i++) {
    if (hour >= SKY_KEYFRAMES[i].hour && hour < SKY_KEYFRAMES[i + 1].hour) {
      lo = SKY_KEYFRAMES[i];
      hi = SKY_KEYFRAMES[i + 1];
      break;
    }
  }

  const range = hi.hour - lo.hour;
  const t = range > 0 ? smoothstep((hour - lo.hour) / range) : 0;

  const bands = ['zenith', 'upper', 'mid', 'lower', 'horizon'];
  const result = [];
  const c1 = new THREE.Color();
  const c2 = new THREE.Color();

  for (const band of bands) {
    c1.set(lo[band]);
    c2.set(hi[band]);
    c1.lerp(c2, t);
    result.push(c1.clone());
  }

  return result;
}

export class SkyRenderer {
  constructor(scene) {
    this.scene = scene;

    // Sky plane with 5 vertical rows for gradient bands
    // PlaneGeometry(width, height, wSegments, hSegments)
    // 1x4 segments = 2 cols x 5 rows = 10 vertices
    const geo = new THREE.PlaneGeometry(200, 200, 1, 4);
    const colorAttr = new Float32Array(10 * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(colorAttr, 3));

    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, depthWrite: false });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set(20, 10, -50);
    scene.add(this.mesh);

    // Stars
    this.stars = this.createStars();
    scene.add(this.stars.points);

    // Sun with glow
    this.sunGroup = this.createSun();
    scene.add(this.sunGroup);

    // Moon
    this.moonGroup = this.createMoon();
    scene.add(this.moonGroup);

    // Clouds
    this.clouds = [];
    this.cloudGroup = new THREE.Group();
    this.cloudGroup.position.z = -42;
    scene.add(this.cloudGroup);
    this.createClouds();

    this.setTime(8);
  }

  createStars() {
    const count = 250;
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 180 + 20;
      positions[i * 3 + 1] = Math.random() * 70 + 15;
      positions[i * 3 + 2] = -49;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: '#ffffff',
      size: 1.0,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      sizeAttenuation: false,
    });

    return { points: new THREE.Points(geo, mat), count };
  }

  createSun() {
    const group = new THREE.Group();
    group.position.z = -47;
    group.visible = false;

    const core = new THREE.Mesh(
      new THREE.CircleGeometry(0.7, 24),
      new THREE.MeshBasicMaterial({ color: '#fffde8', transparent: true, depthWrite: false })
    );
    group.add(core);

    const innerGlow = new THREE.Mesh(
      new THREE.CircleGeometry(1.4, 24),
      new THREE.MeshBasicMaterial({ color: '#ffee88', transparent: true, opacity: 0.2, depthWrite: false })
    );
    innerGlow.position.z = -0.01;
    group.add(innerGlow);

    const outerGlow = new THREE.Mesh(
      new THREE.CircleGeometry(2.5, 24),
      new THREE.MeshBasicMaterial({ color: '#ffcc44', transparent: true, opacity: 0.06, depthWrite: false })
    );
    outerGlow.position.z = -0.02;
    group.add(outerGlow);

    group.userData.core = core;
    group.userData.innerGlow = innerGlow;
    group.userData.outerGlow = outerGlow;

    return group;
  }

  createMoon() {
    const group = new THREE.Group();
    group.position.z = -47;
    group.visible = false;

    const surface = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 20),
      new THREE.MeshBasicMaterial({ color: '#dddde8', transparent: true, depthWrite: false })
    );
    group.add(surface);

    // Subtle craters
    for (const c of [{ x: -0.12, y: 0.08, r: 0.06 }, { x: 0.15, y: -0.04, r: 0.05 }, { x: 0.04, y: 0.16, r: 0.04 }]) {
      const crater = new THREE.Mesh(
        new THREE.CircleGeometry(c.r, 8),
        new THREE.MeshBasicMaterial({ color: '#bbbbc8', transparent: true, depthWrite: false })
      );
      crater.position.set(c.x, c.y, 0.01);
      group.add(crater);
    }

    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(1.0, 20),
      new THREE.MeshBasicMaterial({ color: '#9999bb', transparent: true, opacity: 0.06, depthWrite: false })
    );
    glow.position.z = -0.01;
    group.add(glow);

    group.userData.surface = surface;
    group.userData.glow = glow;

    return group;
  }

  createClouds() {
    for (let i = 0; i < 6; i++) {
      const cloud = new THREE.Group();
      const numBlobs = 3 + Math.floor(Math.random() * 3);
      const baseW = 2 + Math.random() * 3;

      for (let b = 0; b < numBlobs; b++) {
        const blobW = (0.5 + Math.random() * 0.6) * baseW * 0.4;
        const blobH = blobW * (0.25 + Math.random() * 0.2);

        const geo = new THREE.CircleGeometry(blobW / 2, 12);
        geo.scale(1, blobH / blobW * 2, 1);

        const mat = new THREE.MeshBasicMaterial({
          color: '#ffffff',
          transparent: true,
          opacity: 0.12 + Math.random() * 0.1,
          depthWrite: false,
        });

        const blob = new THREE.Mesh(geo, mat);
        blob.position.set(
          (Math.random() - 0.5) * baseW * 0.5,
          (Math.random() - 0.5) * blobH * 0.4,
          Math.random() * 0.03
        );
        cloud.add(blob);
      }

      cloud.position.set(Math.random() * 200 - 80, 28 + Math.random() * 30, 0);
      cloud.userData.speed = 0.05 + Math.random() * 0.1;
      cloud.userData.baseOpacity = 0.1 + Math.random() * 0.12;

      this.cloudGroup.add(cloud);
      this.clouds.push(cloud);
    }
  }

  setTime(hour) {
    const bandColors = getKeyframeColors(hour);

    // PlaneGeometry(1, 4) has 10 vertices in 5 rows (top to bottom)
    // Row layout: vertices 0,1 = top row ... vertices 8,9 = bottom row
    const colors = this.mesh.geometry.attributes.color;
    for (let row = 0; row < 5; row++) {
      const c = bandColors[row];
      const i0 = row * 2;
      const i1 = row * 2 + 1;
      colors.setXYZ(i0, c.r, c.g, c.b);
      colors.setXYZ(i1, c.r, c.g, c.b);
    }
    colors.needsUpdate = true;
  }

  update(delta, hour, nightFactor) {
    // Stars
    if (nightFactor > 0.1) {
      this.stars.points.visible = true;
      this.stars.points.material.opacity = Math.min(0.8, (nightFactor - 0.1) * 0.9);
    } else {
      this.stars.points.visible = false;
    }

    // Sun arc (5:30am - 6:30pm)
    if (hour >= 5.5 && hour < 18.5) {
      this.sunGroup.visible = true;
      const t = (hour - 5.5) / 13;
      const angle = t * Math.PI;
      const elevation = Math.sin(angle);

      this.sunGroup.position.x = 20 + Math.cos(angle) * 55;
      this.sunGroup.position.y = elevation * 30 + 5;

      // Fade smoothly at horizon
      const horizonFade = Math.min(1, elevation * 4);
      this.sunGroup.userData.core.material.opacity = horizonFade;
      this.sunGroup.userData.innerGlow.material.opacity = horizonFade * 0.2;
      this.sunGroup.userData.outerGlow.material.opacity = horizonFade * 0.06;

      // Color: deep orange at horizon → warm yellow → white at zenith
      const c = this.sunGroup.userData.core.material.color;
      if (elevation < 0.3) {
        // Near horizon — deep orange
        const ht = elevation / 0.3;
        c.set('#e86830').lerp(new THREE.Color('#ffcc66'), ht);
      } else {
        // Rising — warm yellow to white
        const ht = (elevation - 0.3) / 0.7;
        c.set('#ffcc66').lerp(new THREE.Color('#fffde8'), ht);
      }

      // Glow is larger and more orange near horizon
      const glowScale = 1 + (1 - elevation) * 0.5;
      this.sunGroup.userData.innerGlow.scale.setScalar(glowScale);
      this.sunGroup.userData.outerGlow.scale.setScalar(glowScale);
    } else {
      this.sunGroup.visible = false;
    }

    // Moon arc (7pm - 5am)
    if (hour >= 19 || hour < 5) {
      this.moonGroup.visible = true;
      const moonHour = hour >= 19 ? hour - 19 : hour + 5;
      const t = moonHour / 10;
      const angle = t * Math.PI;
      const elevation = Math.sin(angle);

      this.moonGroup.position.x = 20 + Math.cos(angle) * 45;
      this.moonGroup.position.y = elevation * 25 + 8;

      const horizonFade = Math.min(1, elevation * 4);
      this.moonGroup.userData.surface.material.opacity = horizonFade;
      this.moonGroup.userData.glow.material.opacity = horizonFade * 0.06;
    } else {
      this.moonGroup.visible = false;
    }

    // Cloud drift
    for (const cloud of this.clouds) {
      cloud.position.x += cloud.userData.speed * delta;

      if (cloud.position.x > 120) {
        cloud.position.x = -80;
        cloud.position.y = 28 + Math.random() * 30;
      }

      // Tint clouds based on time of day
      const targetOpacity = cloud.userData.baseOpacity * (1 - nightFactor * 0.4);

      // During sunset/sunrise, tint clouds warm
      let warmth = 0;
      if (hour >= 5.5 && hour < 8) warmth = Math.max(0, 1 - (hour - 5.5) / 2.5);
      else if (hour >= 17 && hour < 20) warmth = Math.min(1, (hour - 17) / 1.5) * (1 - Math.max(0, (hour - 19)) / 1);

      cloud.children.forEach(blob => {
        blob.material.opacity += (targetOpacity - blob.material.opacity) * delta * 2;
        // White during day, warm during golden hour, gray at night
        const r = 1 - nightFactor * 0.25 + warmth * 0.1;
        const g = 1 - nightFactor * 0.25 - warmth * 0.15;
        const b = 1 - nightFactor * 0.2 - warmth * 0.25;
        blob.material.color.setRGB(r, g, b);
      });
    }
  }
}
