import * as THREE from 'three';
import { getWalkableHeight } from './utils';

export class ThirdPersonCamera {
  public yaw = 0;
  public pitch = 0.32;
  public distance = 6.2;

  private currentPos = new THREE.Vector3(0, 6, 48);
  private currentLook = new THREE.Vector3(0, 2, 40);
  private shakeIntensity = 0;
  private readonly _desiredPos = new THREE.Vector3();
  private readonly _desiredLook = new THREE.Vector3();

  constructor(public readonly camera: THREE.PerspectiveCamera) {}

  public rotate(dx: number, dy: number, sensitivity: number): void {
    const sens = 0.0024 * sensitivity;
    this.yaw -= dx * sens;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * sens, -0.18, 1.05);
  }

  public addShake(amount: number): void {
    this.shakeIntensity = Math.min(0.65, Math.max(this.shakeIntensity, amount));
  }

  public updateMenuOrbit(dt: number, elapsed: number): void {
    const angle = elapsed * 0.085;
    const radius = 34;
    const tx = Math.sin(angle) * radius;
    const tz = 18 + Math.cos(angle) * radius;
    const ty = getWalkableHeight(tx, tz) + 11.5;

    this._desiredPos.set(tx, ty, tz);
    this._desiredLook.set(-6, 5.5, 16);

    const damp = 1 - Math.exp(-3 * dt);
    this.currentPos.lerp(this._desiredPos, damp);
    this.currentLook.lerp(this._desiredLook, damp);
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLook);
  }

  public snapToPlayer(targetPos: THREE.Vector3): void {
    this.yaw = Math.PI;
    this.pitch = 0.3;
    const horiz = Math.cos(this.pitch) * this.distance;
    const vert = Math.sin(this.pitch) * this.distance;
    this.currentPos.set(
      targetPos.x + Math.sin(this.yaw) * horiz,
      targetPos.y + 1.8 + vert,
      targetPos.z + Math.cos(this.yaw) * horiz
    );
    this.currentLook.set(targetPos.x, targetPos.y + 1.5, targetPos.z);
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLook);
  }

  public updateFollow(dt: number, targetPos: THREE.Vector3): void {
    const horiz = Math.cos(this.pitch) * this.distance;
    const vert = Math.sin(this.pitch) * this.distance;

    // Camera positioned behind player based on camera yaw
    const camX = targetPos.x + Math.sin(this.yaw) * horiz;
    const camZ = targetPos.z + Math.cos(this.yaw) * horiz;
    let camY = targetPos.y + 1.7 + vert;

    // Camera collision avoidance against terrain along ray samples
    for (let s = 0.35; s <= 1.0; s += 0.32) {
      const sx = THREE.MathUtils.lerp(targetPos.x, camX, s);
      const sz = THREE.MathUtils.lerp(targetPos.z, camZ, s);
      const minGround = getWalkableHeight(sx, sz) + 0.75;
      if (s > 0.85) {
        camY = Math.max(camY, minGround);
      } else {
        const sy = THREE.MathUtils.lerp(targetPos.y + 1.6, camY, s);
        if (sy < minGround) {
          camY += (minGround - sy) * 0.75;
        }
      }
    }

    this._desiredPos.set(camX, camY, camZ);
    this._desiredLook.set(targetPos.x, targetPos.y + 1.48, targetPos.z);

    const damp = 1 - Math.exp(-14 * dt);
    this.currentPos.lerp(this._desiredPos, damp);
    this.currentLook.lerp(this._desiredLook, damp);

    this.camera.position.copy(this.currentPos);

    if (this.shakeIntensity > 0.002) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeIntensity * 0.8;
      this.shakeIntensity *= Math.exp(-12 * dt);
    } else {
      this.shakeIntensity = 0;
    }

    this.camera.lookAt(this.currentLook);
  }
}
