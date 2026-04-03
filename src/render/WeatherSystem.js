import * as THREE from 'three';

export class WeatherSystem {
  constructor(scene) {
    this.scene = scene;
    this.isRaining = false;
    this.rainIntensity = 0;
    this.nextWeatherCheck = 0;
    this.rainEndHour = 0;

    // Rain as line segments (streaks, not dots)
    const count = 600;
    const positions = new Float32Array(count * 6); // 2 vertices per line segment (x,y,z each)
    this.rainVelocities = new Float32Array(count * 2); // vy, vx per raindrop
    this.rainCount = count;

    const windX = -0.8; // slight wind

    for (let i = 0; i < count; i++) {
      const x = Math.random() * 120 - 40;
      const y = Math.random() * 50;
      const z = -25 + Math.random() * 20;
      const vy = -(12 + Math.random() * 6); // fall speed
      const vx = windX + (Math.random() - 0.5) * 0.5;
      this.rainVelocities[i * 2] = vy;
      this.rainVelocities[i * 2 + 1] = vx;

      // Top of streak
      positions[i * 6 + 0] = x;
      positions[i * 6 + 1] = y;
      positions[i * 6 + 2] = z;
      // Bottom of streak (offset shows direction/length)
      const streakLen = 0.3 + Math.random() * 0.3;
      positions[i * 6 + 3] = x + vx * 0.02;
      positions[i * 6 + 4] = y + vy * 0.02 * streakLen;
      positions[i * 6 + 5] = z;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.LineBasicMaterial({
      color: '#8899bb',
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    this.rainLines = new THREE.LineSegments(geo, mat);
    this.rainLines.visible = false;
    scene.add(this.rainLines);

    // Splash particles at ground level
    this.splashes = this.createSplashes();
    scene.add(this.splashes.points);
  }

  createSplashes() {
    const count = 60;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 2);
    const ages = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = Math.random() * 80 - 20;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0.2;
      velocities[i * 2] = (Math.random() - 0.5) * 1.5;
      velocities[i * 2 + 1] = Math.random() * 2 + 1;
      ages[i] = Math.random(); // staggered start
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: '#99aacc',
      size: 1.5,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      sizeAttenuation: false,
    });

    return { points: new THREE.Points(geo, mat), velocities, ages, count };
  }

  update(delta, hour, lighting) {
    // Weather state machine
    if (hour >= this.nextWeatherCheck) {
      if (!this.isRaining) {
        if (Math.random() < 0.15) {
          this.isRaining = true;
          this.rainEndHour = hour + 2 + Math.random() * 3;
        }
        this.nextWeatherCheck = hour + 1 + Math.random() * 2;
      }
    }

    if (this.isRaining && hour >= this.rainEndHour) {
      this.isRaining = false;
      this.nextWeatherCheck = hour + 2 + Math.random() * 3;
    }

    if (hour < 1 && this.nextWeatherCheck > 23) {
      this.nextWeatherCheck = Math.random() * 2;
    }

    // Smooth intensity transition
    const targetIntensity = this.isRaining ? 1 : 0;
    this.rainIntensity += (targetIntensity - this.rainIntensity) * delta * 2;

    // Update rain line segments
    if (this.rainIntensity > 0.01) {
      this.rainLines.visible = true;
      // Day: dark rain against bright sky. Night: light rain against dark sky.
      const nf = lighting ? lighting.nightFactor : 0;
      if (nf > 0.5) {
        this.rainLines.material.color.set('#aabbdd');
        this.rainLines.material.opacity = this.rainIntensity * 0.5;
      } else {
        this.rainLines.material.color.set('#445566');
        this.rainLines.material.opacity = this.rainIntensity * 0.7;
      }

      const pos = this.rainLines.geometry.attributes.position;
      for (let i = 0; i < this.rainCount; i++) {
        const vy = this.rainVelocities[i * 2];
        const vx = this.rainVelocities[i * 2 + 1];

        // Move top vertex
        let x = pos.getX(i * 2);
        let y = pos.getY(i * 2);
        x += vx * delta;
        y += vy * delta;

        // Recycle when below ground
        if (y < -2) {
          y = 40 + Math.random() * 15;
          // Spawn outside building footprint (x 0-40)
          x = Math.random() > 0.5
            ? -40 + Math.random() * 38   // left of building
            : 42 + Math.random() * 38;   // right of building
        }
        if (x < -50) x = 80;
        // Push rain out of building area — if inside building x-range
        // and above ground, skip to sides
        if (x > -1 && x < 41 && y > 0) {
          x = x < 20 ? -2 : 42;
        }

        pos.setX(i * 2, x);
        pos.setY(i * 2, y);

        // Bottom vertex follows with streak offset
        const streakLen = 0.3 + (i % 3) * 0.15;
        pos.setX(i * 2 + 1, x + vx * 0.02);
        pos.setY(i * 2 + 1, y + vy * 0.02 * streakLen);
      }
      pos.needsUpdate = true;

      // Update splash particles
      this.splashes.points.visible = true;
      this.splashes.points.material.opacity = this.rainIntensity * 0.3;
      const sPos = this.splashes.points.geometry.attributes.position;
      for (let i = 0; i < this.splashes.count; i++) {
        this.splashes.ages[i] += delta * 3;
        if (this.splashes.ages[i] > 1) {
          this.splashes.ages[i] = 0;
          sPos.setX(i, Math.random() * 80 - 20);
          sPos.setY(i, 0);
          this.splashes.velocities[i * 2] = (Math.random() - 0.5) * 1.5;
          this.splashes.velocities[i * 2 + 1] = Math.random() * 1.5 + 0.5;
        }
        const age = this.splashes.ages[i];
        sPos.setX(i, sPos.getX(i) + this.splashes.velocities[i * 2] * delta);
        sPos.setY(i, age * this.splashes.velocities[i * 2 + 1] * 0.15);
      }
      sPos.needsUpdate = true;

      // Dim lighting when raining
      if (lighting) {
        lighting.sun.intensity *= (1 - this.rainIntensity * 0.5);
        lighting.hemi.intensity *= (1 - this.rainIntensity * 0.3);
      }
    } else {
      this.rainLines.visible = false;
      this.splashes.points.visible = false;
    }
  }
}
