import * as THREE from 'three';

function hashId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Skin tone palette
const SKIN_TONES = ['#f5d0a9', '#e8b88a', '#d4956b', '#a0704e', '#6b4226', '#3d2b1f'];

// Clothing color palette per role
const CLOTHING = {
  apartment: ['#3366cc', '#4477dd', '#2255aa', '#5588ee', '#336699'],
  office:    ['#2a2a2a', '#3a3a4a', '#4a4a5a', '#333344', '#444455'],
  retail:    ['#cc9933', '#dd8822', '#bb7711', '#ee9944', '#ccaa44'],
  restaurant:['#ffffff', '#f0f0f0', '#eeeeee', '#e8e8e8', '#dddddd'],
  static:    ['#777777', '#888888', '#666666', '#999999', '#555555'],
};

// Build an articulated person as a Group with separate limbs
function createPersonFigure(hash, role) {
  const group = new THREE.Group();

  const skinColor = SKIN_TONES[hash % SKIN_TONES.length];
  const clothes = CLOTHING[role] || CLOTHING.static;
  const shirtColor = clothes[hash % clothes.length];
  const pantsColor = clothes[(hash + 2) % clothes.length];

  const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.9, metalness: 0 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.8, metalness: 0 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.85, metalness: 0 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: '#222222', roughness: 0.9, metalness: 0 });
  const hairMat = new THREE.MeshStandardMaterial({
    color: ['#1a1a1a', '#3d2b1f', '#8b6914', '#c44a2f', '#555555'][hash % 5],
    roughness: 0.9, metalness: 0
  });

  // Head (circle-ish) — 0.12 wide
  const head = new THREE.Mesh(new THREE.CircleGeometry(0.06, 8), skinMat);
  head.position.y = 0.27;
  group.add(head);

  // Hair on top of head
  const hair = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.04), hairMat);
  hair.position.y = 0.32;
  group.add(hair);

  // Torso — 0.14 wide, 0.18 tall
  const torso = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.18), shirtMat);
  torso.position.y = 0.12;
  group.add(torso);

  // Left arm — pivots at shoulder
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.09, 0.2, 0.01);
  const leftArm = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.14), skinMat);
  leftArm.position.y = -0.07; // hang down from pivot
  leftArmPivot.add(leftArm);
  group.add(leftArmPivot);
  group.userData.leftArm = leftArmPivot;

  // Right arm
  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.09, 0.2, -0.01);
  const rightArm = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.14), skinMat);
  rightArm.position.y = -0.07;
  rightArmPivot.add(rightArm);
  group.add(rightArmPivot);
  group.userData.rightArm = rightArmPivot;

  // Left leg — pivots at hip
  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.03, 0.03, 0.01);
  const leftThigh = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.1), pantsMat);
  leftThigh.position.y = -0.05;
  leftLegPivot.add(leftThigh);
  const leftShoe = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.03), shoeMat);
  leftShoe.position.y = -0.11;
  leftLegPivot.add(leftShoe);
  group.add(leftLegPivot);
  group.userData.leftLeg = leftLegPivot;

  // Right leg
  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.03, 0.03, -0.01);
  const rightThigh = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.1), pantsMat);
  rightThigh.position.y = -0.05;
  rightLegPivot.add(rightThigh);
  const rightShoe = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.03), shoeMat);
  rightShoe.position.y = -0.11;
  rightLegPivot.add(rightShoe);
  group.add(rightLegPivot);
  group.userData.rightLeg = rightLegPivot;

  return group;
}

export class PersonRenderer {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.position.z = 0.3;
    scene.add(this.group);
    this.entries = new Map(); // personId -> { figure, hash, role, lastState }
    this.elevatorRenderer = null; // set by main.js
  }

  sync(people) {
    const activePeople = new Set();

    for (const [id, person] of people) {
      activePeople.add(id);

      let entry = this.entries.get(id);
      if (!entry) {
        const hash = hashId(id);
        const role = person.schedule?.type || 'static';
        const figure = createPersonFigure(hash, role);
        this.group.add(figure);
        entry = { figure, hash, role, lastState: null };
        this.entries.set(id, entry);
      }

      entry.figure.visible = !person.hidden;
      entry.figure.position.x = person.position.x;
      // Simulation sets y to floor + 0.5 (cell center).
      // Offset down so feet touch the floor line instead of floating.
      entry.figure.position.y = person.position.y - 0.37;
      entry.lastState = person.state;

      // Flip figure based on walking direction
      if (person.state === 'walking' && person.targetX !== undefined) {
        const dir = person.targetX - person.position.x;
        if (Math.abs(dir) > 0.01) {
          entry.figure.scale.x = dir > 0 ? 1 : -1;
        }
      }
    }

    // Remove figures for people who left
    for (const [id, entry] of this.entries) {
      if (!activePeople.has(id)) {
        this.group.remove(entry.figure);
        entry.figure.traverse(child => {
          if (child.isMesh) {
            child.geometry.dispose();
            child.material.dispose();
          }
        });
        this.entries.delete(id);
      }
    }
  }

  animate(delta, elapsed, people) {
    for (const [id, entry] of this.entries) {
      if (!entry.figure.visible) continue;

      const person = people?.get(id);
      if (!person) continue;

      const h = entry.hash;
      const ud = entry.figure.userData;
      const speed = 10 + (h % 4); // slightly different walk speeds

      // Always sync position from game state every frame
      entry.figure.position.x = person.position.x;
      if (person.state === 'in_elevator' && person.elevatorId && this.elevatorRenderer) {
        // Follow the elevator's smooth visual position, not the integer game position
        const cabY = this.elevatorRenderer.getVisualY(person.elevatorId);
        if (cabY !== null) {
          entry.figure.position.y = cabY - 0.4; // feet on cab floor
        } else {
          entry.figure.position.y = person.position.y - 0.4;
        }
      } else {
        entry.figure.position.y = person.position.y - 0.37;
      }

      if (person.state === 'walking') {
        // Walking animation — legs and arms swing
        const swing = Math.sin(elapsed * speed + h) * 0.5;
        ud.leftLeg.rotation.z = swing;
        ud.rightLeg.rotation.z = -swing;
        ud.leftArm.rotation.z = -swing * 0.6;
        ud.rightArm.rotation.z = swing * 0.6;

        // Subtle body bob
        entry.figure.position.y += Math.abs(Math.sin(elapsed * speed * 2 + h)) * 0.015;

      } else if (person.state === 'in_room') {
        ud.leftLeg.rotation.z = 0;
        ud.rightLeg.rotation.z = 0;
        ud.leftArm.rotation.z = Math.sin(elapsed * 1.5 + h) * 0.05;
        ud.rightArm.rotation.z = Math.sin(elapsed * 1.5 + h + 1) * 0.05;

      } else if (person.state === 'waiting_elevator') {
        ud.leftLeg.rotation.z = Math.sin(elapsed * 3 + h) * 0.1;
        ud.rightLeg.rotation.z = -Math.sin(elapsed * 3 + h) * 0.1;
        ud.leftArm.rotation.z = Math.sin(elapsed * 4 + h) * 0.15;
        ud.rightArm.rotation.z = -Math.sin(elapsed * 4 + h) * 0.15;
        entry.figure.position.x += Math.sin(elapsed * 2 + h) * 0.02;

      } else if (person.state === 'in_elevator') {
        ud.leftLeg.rotation.z = 0;
        ud.rightLeg.rotation.z = 0;
        ud.leftArm.rotation.z = 0;
        ud.rightArm.rotation.z = 0;

      } else {
        // Default — neutral pose
        ud.leftLeg.rotation.z = 0;
        ud.rightLeg.rotation.z = 0;
        ud.leftArm.rotation.z = 0;
        ud.rightArm.rotation.z = 0;
      }
    }
  }
}
