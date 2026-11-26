import * as THREE from 'three';

interface SlashArcEffect {
  mesh: THREE.Mesh;
  timer: number;
  duration: number;
}

interface SparkParticle {
  sprite: THREE.Sprite;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

export class CombatEffects {
  private readonly slashPool: SlashArcEffect[] = [];
  private readonly sparkPool: SparkParticle[] = [];
  private readonly group = new THREE.Group();
  private particlesEnabled = true;

  constructor(scene: THREE.Scene, sparkTex: THREE.Texture) {
    scene.add(this.group);

    // Pre-allocate 6 slash crescent arcs
    const arcGeo = new THREE.RingGeometry(0.95, 1.85, 20, 1, -Math.PI * 0.45, Math.PI * 0.9);
    for (let i = 0; i < 6; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xfef3c7,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(arcGeo, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.slashPool.push({ mesh, timer: 0, duration: 0.22 });
    }

    // Pre-allocate 36 spark sprites
    for (let i = 0; i < 36; i++) {
      const mat = new THREE.SpriteMaterial({
        map: sparkTex,
        color: 0xffd27d,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      sprite.scale.setScalar(0.28);
      this.group.add(sprite);
      this.sparkPool.push({
        sprite,
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 0.3,
      });
    }
  }

  public setParticlesEnabled(enabled: boolean): void {
    this.particlesEnabled = enabled;
  }

  public spawnSlashArc(pos: THREE.Vector3, yaw: number, heavy: boolean, comboStep: number): void {
    const slot = this.slashPool.find((s) => !s.mesh.visible) || this.slashPool[0];
    slot.mesh.visible = true;
    slot.timer = 0;
    slot.duration = heavy ? 0.28 : 0.18;
    slot.mesh.position.set(pos.x + Math.sin(yaw) * 0.55, pos.y + 1.25, pos.z + Math.cos(yaw) * 0.55);
    slot.mesh.rotation.set(0, 0, 0);
    slot.mesh.rotation.y = yaw + Math.PI * 0.5;
    if (heavy) {
      slot.mesh.rotation.x = Math.PI * 0.48;
      slot.mesh.rotation.z = 0;
      slot.mesh.scale.setScalar(1.35);
      (slot.mesh.material as THREE.MeshBasicMaterial).color.setHex(0xef4444);
    } else {
      slot.mesh.rotation.x = Math.PI * 0.5 + (comboStep === 2 ? -0.35 : 0.32);
      slot.mesh.scale.setScalar(1.0);
      (slot.mesh.material as THREE.MeshBasicMaterial).color.setHex(0xfef3c7);
    }
    (slot.mesh.material as THREE.MeshBasicMaterial).opacity = 0.85;
  }

  public spawnSparks(pos: THREE.Vector3, count = 12, colorHex = 0xffd27d): void {
    if (!this.particlesEnabled) return;
    let spawned = 0;
    for (const p of this.sparkPool) {
      if (p.sprite.visible) continue;
      p.sprite.visible = true;
      p.sprite.position.set(pos.x, pos.y + 1.15, pos.z);
      (p.sprite.material as THREE.SpriteMaterial).color.setHex(colorHex);
      (p.sprite.material as THREE.SpriteMaterial).opacity = 1;
      p.vel.set(
        (Math.random() - 0.5) * 8.5,
        2.0 + Math.random() * 5.0,
        (Math.random() - 0.5) * 8.5
      );
      p.life = 0;
      p.maxLife = 0.22 + Math.random() * 0.16;
      spawned++;
      if (spawned >= count) break;
    }
  }

  public update(dt: number): void {
    for (const s of this.slashPool) {
      if (!s.mesh.visible) continue;
      s.timer += dt;
      const t = s.timer / s.duration;
      if (t >= 1) {
        s.mesh.visible = false;
      } else {
        const mat = s.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = (1 - t) * 0.82;
        s.mesh.scale.multiplyScalar(1 + dt * 1.8);
      }
    }

    for (const p of this.sparkPool) {
      if (!p.sprite.visible) continue;
      p.life += dt;
      const t = p.life / p.maxLife;
      if (t >= 1) {
        p.sprite.visible = false;
      } else {
        p.vel.y -= 14 * dt;
        p.sprite.position.addScaledVector(p.vel, dt);
        (p.sprite.material as THREE.SpriteMaterial).opacity = 1 - t;
      }
    }
  }
}
