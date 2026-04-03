import * as THREE from 'three';

export class PersonRenderer {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.position.z = 0.3;
    scene.add(this.group);
    this.meshes = new Map(); // personId -> mesh
  }

  sync(people) {
    const activePeople = new Set();

    for (const [id, person] of people) {
      activePeople.add(id);

      let mesh = this.meshes.get(id);
      if (!mesh) {
        const geo = new THREE.PlaneGeometry(0.15, 0.3);
        const mat = new THREE.MeshBasicMaterial({ color: this.getColor(person) });
        mesh = new THREE.Mesh(geo, mat);
        this.group.add(mesh);
        this.meshes.set(id, mesh);
      }

      mesh.visible = !person.hidden;
      mesh.position.set(person.position.x, person.position.y, 0);
    }

    // Remove meshes for people who left
    for (const [id, mesh] of this.meshes) {
      if (!activePeople.has(id)) {
        this.group.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
        this.meshes.delete(id);
      }
    }
  }

  getColor(person) {
    if (person.satisfaction > 70) return '#3366cc';
    if (person.satisfaction > 40) return '#cc9933';
    return '#cc3333';
  }
}
