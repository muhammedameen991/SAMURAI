import * as THREE from 'three';
import { AudioManager } from './audio';
import { ArticulatedCharacter, createSamuraiCharacter } from './models';
import {
  WORLD_HALF_SIZE,
  getRiverCenterX,
  getRiverHalfWidth,
  getWalkableHeight,
  isOnBridge,
  lerpAngle,
} from './utils';
import { CircleCollider } from './world';

export type PlayerActionState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'jump'
  | 'dodge'
  | 'attack_light_1'
  | 'attack_light_2'
  | 'attack_light_3'
  | 'attack_heavy'
  | 'block'
  | 'hit'
  | 'dead';

export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  block: boolean;
  jumpQueued: boolean;
  dodgeQueued: boolean;
  lightAttackQueued: boolean;
  heavyAttackQueued: boolean;
  interactQueued: boolean;
  healQueued: boolean;
}

export const KATANA_TIERS = [
  { name: 'Ronin Uchigatana', damage: 24, cost: 0 },
  { name: 'Tamahagane Folded Blade', damage: 34, cost: 50 },
  { name: 'Muramasa Crimson Edge', damage: 46, cost: 110 },
  { name: 'Shogunate Masamune', damage: 62, cost: 180 },
];

export class PlayerController {
  public readonly rig: ArticulatedCharacter;
  public readonly position = new THREE.Vector3(0, 1, 40);
  public readonly velocity = new THREE.Vector3();
  public yaw = Math.PI; // Facing north (-Z) toward Village Torii

  public health = 120;
  public maxHealth = 120;
  public stamina = 100;
  public maxStamina = 100;
  public xp = 0;
  public level = 1;
  public gold = 25;
  public katanaTier = 0;
  public healingCharges = 2;

  public state: PlayerActionState = 'idle';
  public stateTimer = 0;
  public stateDuration = 0;
  public comboWindowTimer = 0;
  public comboStep = 0;
  public attackHasHit = false;
  public blockStartTime = -10;
  public invulnTimer = 0;
  public hitFlashTimer = 0;
  public grounded = true;
  private coyoteTimer = 0;
  private stepTimer = 0;
  private dodgeDir = new THREE.Vector3();
  private knockbackVel = new THREE.Vector3();

  private readonly _moveVec = new THREE.Vector3();
  private readonly _camFwd = new THREE.Vector3();
  private readonly _camRight = new THREE.Vector3();

  constructor(
    scene: THREE.Scene,
    contactShadowTex: THREE.Texture,
    private readonly audio: AudioManager
  ) {
    this.rig = createSamuraiCharacter('player', contactShadowTex, 1.0);
    this.position.y = getWalkableHeight(this.position.x, this.position.z);
    this.rig.root.position.copy(this.position);
    scene.add(this.rig.root);
  }

  public get xpToNext(): number {
    return 100 + (this.level - 1) * 65;
  }

  public get baseDamage(): number {
    return KATANA_TIERS[Math.min(this.katanaTier, KATANA_TIERS.length - 1)].damage + (this.level - 1) * 4;
  }

  public get katanaName(): string {
    return KATANA_TIERS[Math.min(this.katanaTier, KATANA_TIERS.length - 1)].name;
  }

  public addXp(amount: number): boolean {
    this.xp += amount;
    let leveled = false;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level += 1;
      this.maxHealth += 15;
      this.maxStamina += 10;
      this.health = this.maxHealth;
      this.stamina = this.maxStamina;
      leveled = true;
    }
    return leveled;
  }

  public useHealingElixir(): boolean {
    if (this.state === 'dead' || this.healingCharges <= 0 || this.health >= this.maxHealth) {
      return false;
    }
    this.healingCharges -= 1;
    this.health = Math.min(this.maxHealth, this.health + Math.round(this.maxHealth * 0.55));
    this.audio.playPickup();
    return true;
  }

  public isAttacking(): boolean {
    return (
      this.state === 'attack_light_1' ||
      this.state === 'attack_light_2' ||
      this.state === 'attack_light_3' ||
      this.state === 'attack_heavy'
    );
  }

  public isAttackActiveWindow(): boolean {
    if (!this.isAttacking()) return false;
    const progress = this.stateTimer / Math.max(0.01, this.stateDuration);
    if (this.state === 'attack_heavy') {
      return progress >= 0.36 && progress <= 0.68;
    }
    return progress >= 0.24 && progress <= 0.65;
  }

  public isBlocking(): boolean {
    return this.state === 'block';
  }

  public isParryWindow(elapsed: number): boolean {
    return this.isBlocking() && elapsed - this.blockStartTime <= 0.24;
  }

  public takeDamage(amount: number, attackerPos: THREE.Vector3, elapsed: number): 'hit' | 'blocked' | 'parried' | 'evaded' {
    if (this.state === 'dead') return 'evaded';
    if (this.invulnTimer > 0) return 'evaded';

    // Check block/parry arc (front 140 deg)
    if (this.isBlocking()) {
      const toAttacker = this._moveVec.subVectors(attackerPos, this.position).setY(0).normalize();
      const facing = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      if (toAttacker.dot(facing) > 0.15) {
        if (this.isParryWindow(elapsed)) {
          this.audio.playSwordClash(true);
          return 'parried';
        }
        this.stamina = Math.max(0, this.stamina - 18);
        this.health = Math.max(1, this.health - Math.round(amount * 0.2));
        this.audio.playSwordClash(false);
        return 'blocked';
      }
    }

    this.health = Math.max(0, this.health - amount);
    this.hitFlashTimer = 0.16;
    this.audio.playHitImpact(false);

    const push = this._moveVec.subVectors(this.position, attackerPos).setY(0);
    if (push.lengthSq() > 0.001) {
      push.normalize().multiplyScalar(6.5);
      this.knockbackVel.copy(push);
    }

    if (this.health <= 0) {
      this.state = 'dead';
      this.stateTimer = 0;
      this.stateDuration = 1.2;
    } else if (!this.isAttacking() || this.state !== 'attack_heavy') {
      this.state = 'hit';
      this.stateTimer = 0;
      this.stateDuration = 0.26;
    }
    return 'hit';
  }

  public resetForRespawn(x: number, z: number): void {
    this.position.set(x, getWalkableHeight(x, z), z);
    this.velocity.set(0, 0, 0);
    this.knockbackVel.set(0, 0, 0);
    this.health = this.maxHealth;
    this.stamina = this.maxStamina;
    this.state = 'idle';
    this.stateTimer = 0;
    this.invulnTimer = 0.8;
    this.rig.root.position.copy(this.position);
  }

  public update(
    dt: number,
    elapsed: number,
    input: InputState,
    cameraYaw: number,
    colliders: CircleCollider[]
  ): { startedAttack: 'light' | 'heavy' | null } {
    let startedAttack: 'light' | 'heavy' | null = null;

    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.comboWindowTimer > 0) this.comboWindowTimer = Math.max(0, this.comboWindowTimer - dt);

    // Hit flash fade
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
      const emissiveAmt = this.hitFlashTimer > 0 ? 0.65 : 0;
      for (const m of this.rig.hitFlashMaterials) {
        m.emissive.setHex(0xdc2626);
        m.emissiveIntensity = emissiveAmt;
      }
    }

    if (this.state === 'dead') {
      this.stateTimer += dt;
      this.animatePose(dt, elapsed);
      return { startedAttack: null };
    }

    // Stamina regeneration when not blocking/sprinting/attacking
    if (!input.sprint && !this.isBlocking() && !this.isAttacking() && this.state !== 'dodge') {
      this.stamina = Math.min(this.maxStamina, this.stamina + 26 * dt);
    }

    // Compute camera-relative movement vector
    this._camFwd.set(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    this._camRight.set(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
    this._moveVec.set(0, 0, 0);
    if (input.forward) this._moveVec.add(this._camFwd);
    if (input.backward) this._moveVec.sub(this._camFwd);
    if (input.right) this._moveVec.add(this._camRight);
    if (input.left) this._moveVec.sub(this._camRight);
    const hasMove = this._moveVec.lengthSq() > 0.001;
    if (hasMove) this._moveVec.normalize();

    // State timers & transitions
    if (this.state === 'hit' || this.state === 'dodge' || this.isAttacking()) {
      this.stateTimer += dt;
      if (this.stateTimer >= this.stateDuration) {
        this.state = 'idle';
        this.stateTimer = 0;
      }
    }

    const canAct = this.state === 'idle' || this.state === 'walk' || this.state === 'run' || this.state === 'block';

    // Heal shortcut
    if (input.healQueued && canAct) {
      this.useHealingElixir();
    }
    input.healQueued = false;

    // Dodge (Q)
    if (input.dodgeQueued && (canAct || (this.isAttacking() && this.stateTimer > this.stateDuration * 0.5)) && this.stamina >= 22) {
      this.stamina -= 22;
      this.state = 'dodge';
      this.stateTimer = 0;
      this.stateDuration = 0.34;
      this.invulnTimer = 0.32;
      if (hasMove) {
        this.dodgeDir.copy(this._moveVec);
        this.yaw = Math.atan2(this._moveVec.x, this._moveVec.z);
      } else {
        this.dodgeDir.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      }
      this.audio.playDodge();
    }
    input.dodgeQueued = false;

    // Attacks (Left Click / Shift+Left Click)
    const canChainCombo = this.isAttacking() && this.stateTimer >= this.stateDuration * 0.62;
    if (input.heavyAttackQueued && (canAct || canChainCombo) && this.stamina >= 28) {
      this.stamina -= 28;
      this.state = 'attack_heavy';
      this.stateTimer = 0;
      this.stateDuration = 0.64;
      this.attackHasHit = false;
      this.comboStep = 0;
      if (hasMove) this.yaw = Math.atan2(this._moveVec.x, this._moveVec.z);
      this.audio.playKatanaSlash(true);
      startedAttack = 'heavy';
    } else if (input.lightAttackQueued && (canAct || canChainCombo) && this.stamina >= 12) {
      this.stamina -= 12;
      const nextStep = this.comboWindowTimer > 0 ? (this.comboStep % 3) + 1 : 1;
      this.comboStep = nextStep;
      this.comboWindowTimer = 0.85;
      this.state = nextStep === 1 ? 'attack_light_1' : nextStep === 2 ? 'attack_light_2' : 'attack_light_3';
      this.stateTimer = 0;
      this.stateDuration = nextStep === 3 ? 0.46 : 0.36;
      this.attackHasHit = false;
      if (hasMove) this.yaw = Math.atan2(this._moveVec.x, this._moveVec.z);
      this.audio.playKatanaSlash(false);
      startedAttack = 'light';
    }
    input.lightAttackQueued = false;
    input.heavyAttackQueued = false;

    // Block (Right Mouse / F)
    if (input.block && (canAct || this.state === 'block') && this.stamina > 4) {
      if (this.state !== 'block') {
        this.blockStartTime = elapsed;
      }
      this.state = 'block';
    } else if (this.state === 'block' && !input.block) {
      this.state = 'idle';
    }

    // Horizontal Movement
    let speed = 0;
    if (this.state === 'dodge') {
      this.velocity.x = this.dodgeDir.x * 15.5;
      this.velocity.z = this.dodgeDir.z * 15.5;
    } else if (this.isAttacking()) {
      // Subtle forward lunge during slash windup/swing
      const lunge = this.stateTimer < this.stateDuration * 0.4 ? (this.state === 'attack_heavy' ? 4.2 : 3.2) : 0.4;
      this.velocity.x = Math.sin(this.yaw) * lunge;
      this.velocity.z = Math.cos(this.yaw) * lunge;
    } else if (this.state === 'hit') {
      this.velocity.x = 0;
      this.velocity.z = 0;
    } else {
      const sprinting = input.sprint && hasMove && !this.isBlocking() && this.stamina > 2;
      if (sprinting) {
        this.stamina = Math.max(0, this.stamina - 15 * dt);
        speed = 11.4;
      } else if (this.isBlocking()) {
        speed = hasMove ? 3.4 : 0;
      } else {
        speed = hasMove ? 6.8 : 0;
      }

      if (hasMove) {
        const targetYaw = Math.atan2(this._moveVec.x, this._moveVec.z);
        this.yaw = lerpAngle(this.yaw, targetYaw, 1 - Math.exp(-14 * dt));
      }

      this.velocity.x = this._moveVec.x * speed;
      this.velocity.z = this._moveVec.z * speed;

      if (this.grounded && !this.isBlocking()) {
        this.state = speed > 8 ? 'run' : speed > 0.5 ? 'walk' : 'idle';
      }
    }

    // Knockback decay
    this.velocity.x += this.knockbackVel.x;
    this.velocity.z += this.knockbackVel.z;
    this.knockbackVel.multiplyScalar(Math.exp(-10 * dt));

    // Jump & Gravity with coyote time
    if (this.grounded) {
      this.coyoteTimer = 0.12;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }

    if (input.jumpQueued && this.coyoteTimer > 0 && this.state !== 'dodge' && !this.isAttacking()) {
      this.velocity.y = 9.2;
      this.grounded = false;
      this.coyoteTimer = 0;
      this.state = 'jump';
    }
    input.jumpQueued = false;

    this.velocity.y -= 24 * dt;

    // Integrate Position
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this.position.y += this.velocity.y * dt;

    // World perimeter bounds (natural cliffs)
    this.position.x = THREE.MathUtils.clamp(this.position.x, -WORLD_HALF_SIZE, WORLD_HALF_SIZE);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -WORLD_HALF_SIZE, WORLD_HALF_SIZE);

    // Cylinder obstacle collisions
    const playerRad = 0.6;
    for (const c of colliders) {
      const dx = this.position.x - c.x;
      const dz = this.position.z - c.z;
      const minD = c.r + playerRad;
      const dSq = dx * dx + dz * dz;
      if (dSq < minD * minD && dSq > 0.0001) {
        const d = Math.sqrt(dSq);
        const push = minD - d;
        this.position.x += (dx / d) * push;
        this.position.z += (dz / d) * push;
      }
    }

    // Prevent wading into deep water (allow shallow edges & bridges)
    const onBridge = isOnBridge(this.position.x, this.position.z);
    if (!onBridge) {
      const rx = getRiverCenterX(this.position.z);
      const rhw = getRiverHalfWidth(this.position.z);
      const dxRiver = this.position.x - rx;
      if (Math.abs(dxRiver) < rhw * 0.55) {
        this.position.x = rx + Math.sign(dxRiver || 1) * rhw * 0.55;
      }
    }

    // Terrain / Bridge grounding
    const groundY = getWalkableHeight(this.position.x, this.position.z);
    if (this.position.y <= groundY) {
      this.position.y = groundY;
      this.velocity.y = 0;
      this.grounded = true;
      if (this.state === 'jump') {
        this.state = hasMove ? 'walk' : 'idle';
      }
    } else {
      this.grounded = false;
      if (canAct && this.position.y > groundY + 0.35) {
        this.state = 'jump';
      }
    }

    // Footstep Audio
    if (this.grounded && (this.state === 'walk' || this.state === 'run')) {
      this.stepTimer += dt * (this.state === 'run' ? 1.55 : 1.0);
      if (this.stepTimer >= 0.42) {
        this.stepTimer = 0;
        this.audio.playFootstep(onBridge);
      }
    }

    this.rig.root.position.copy(this.position);
    this.rig.root.rotation.y = this.yaw;

    this.animatePose(dt, elapsed);

    return { startedAttack };
  }

  private animatePose(dt: number, elapsed: number): void {
    const r = this.rig;
    const damp = 1 - Math.exp(-18 * dt);

    let hipY = 0.92;
    let torsoPitch = 0;
    let torsoYaw = 0;
    let rShoulderX = -0.35;
    let rShoulderZ = -0.18;
    let rForearmX = -0.65;
    let lShoulderX = 0.25;
    let lShoulderZ = 0.2;
    let lForearmX = -0.4;
    let lLegX = 0;
    let rLegX = 0;
    let katanaPitch = Math.PI * 0.48;
    let cloakPitch = 0.14;

    if (this.state === 'dead') {
      const t = Math.min(1, this.stateTimer / 0.8);
      r.hips.rotation.x = THREE.MathUtils.lerp(0, -Math.PI * 0.46, t);
      r.hips.position.y = THREE.MathUtils.lerp(0.92, 0.22, t);
      return;
    }
    r.hips.rotation.x = THREE.MathUtils.lerp(r.hips.rotation.x, 0, damp);

    if (this.state === 'idle') {
      hipY = 0.92 + Math.sin(elapsed * 2.4) * 0.018;
      torsoPitch = 0.04;
      rShoulderX = -0.3 + Math.sin(elapsed * 2.4) * 0.03;
      cloakPitch = 0.12 + Math.sin(elapsed * 2.2) * 0.04;
    } else if (this.state === 'walk' || this.state === 'run') {
      const freq = this.state === 'run' ? 12.5 : 8.2;
      const amp = this.state === 'run' ? 0.72 : 0.46;
      const s = Math.sin(elapsed * freq);
      hipY = 0.92 + Math.abs(Math.cos(elapsed * freq)) * (this.state === 'run' ? 0.08 : 0.04);
      torsoPitch = this.state === 'run' ? 0.24 : 0.1;
      lLegX = s * amp;
      rLegX = -s * amp;
      lShoulderX = -s * amp * 0.7;
      rShoulderX = s * amp * 0.45 - 0.35;
      cloakPitch = this.state === 'run' ? 0.58 + s * 0.08 : 0.26;
    } else if (this.state === 'jump') {
      hipY = 0.98;
      torsoPitch = 0.12;
      lLegX = -0.45;
      rLegX = 0.35;
      lShoulderX = -0.6;
      rShoulderX = -0.8;
      cloakPitch = 0.5;
    } else if (this.state === 'dodge') {
      torsoPitch = 0.65;
      hipY = 0.72;
      lLegX = -0.5;
      rLegX = 0.55;
      rShoulderX = 0.5;
      lShoulderX = 0.5;
      cloakPitch = 0.9;
    } else if (this.state === 'block') {
      hipY = 0.86;
      torsoYaw = -0.25;
      rShoulderX = -1.25;
      rShoulderZ = 0.45;
      rForearmX = -0.85;
      katanaPitch = Math.PI * 0.12;
      lShoulderX = -1.0;
      lShoulderZ = -0.3;
    } else if (this.state === 'hit') {
      torsoPitch = -0.35;
      rShoulderX = 0.4;
      lShoulderX = -0.4;
    } else if (this.isAttacking()) {
      const p = Math.min(1, this.stateTimer / Math.max(0.01, this.stateDuration));
      if (this.state === 'attack_light_1') {
        const swing = THREE.MathUtils.smoothstep(p, 0.15, 0.65);
        torsoYaw = THREE.MathUtils.lerp(-0.6, 0.75, swing);
        torsoPitch = 0.22;
        rShoulderX = THREE.MathUtils.lerp(-1.8, -0.5, swing);
        rShoulderZ = THREE.MathUtils.lerp(-0.9, 0.95, swing);
        rForearmX = -0.25;
      } else if (this.state === 'attack_light_2') {
        const swing = THREE.MathUtils.smoothstep(p, 0.15, 0.65);
        torsoYaw = THREE.MathUtils.lerp(0.75, -0.75, swing);
        torsoPitch = 0.22;
        rShoulderX = THREE.MathUtils.lerp(-0.5, -1.65, swing);
        rShoulderZ = THREE.MathUtils.lerp(0.95, -0.85, swing);
        rForearmX = -0.2;
      } else if (this.state === 'attack_light_3') {
        const swing = THREE.MathUtils.smoothstep(p, 0.15, 0.65);
        torsoYaw = THREE.MathUtils.lerp(-0.9, 1.1, swing);
        torsoPitch = 0.3;
        rShoulderX = -1.35;
        rShoulderZ = THREE.MathUtils.lerp(-1.2, 1.25, swing);
        rForearmX = -0.15;
      } else {
        // Heavy overhead cleave
        const wind = p < 0.35 ? p / 0.35 : 1;
        const slam = p >= 0.35 ? THREE.MathUtils.smoothstep((p - 0.35) / 0.35, 0, 1) : 0;
        torsoPitch = THREE.MathUtils.lerp(-0.22 * wind, 0.42, slam);
        rShoulderX = THREE.MathUtils.lerp(-2.55 * wind, 0.2, slam);
        lShoulderX = THREE.MathUtils.lerp(-2.2 * wind, -0.2, slam);
        rForearmX = THREE.MathUtils.lerp(-0.5, -0.1, slam);
      }
      cloakPitch = 0.45;
    }

    r.hips.position.y = THREE.MathUtils.lerp(r.hips.position.y, hipY, damp);
    r.torso.rotation.x = THREE.MathUtils.lerp(r.torso.rotation.x, torsoPitch, damp);
    r.torso.rotation.y = THREE.MathUtils.lerp(r.torso.rotation.y, torsoYaw, damp);
    r.rightShoulder.rotation.x = THREE.MathUtils.lerp(r.rightShoulder.rotation.x, rShoulderX, damp);
    r.rightShoulder.rotation.z = THREE.MathUtils.lerp(r.rightShoulder.rotation.z, rShoulderZ, damp);
    r.rightForearm.rotation.x = THREE.MathUtils.lerp(r.rightForearm.rotation.x, rForearmX, damp);
    r.leftShoulder.rotation.x = THREE.MathUtils.lerp(r.leftShoulder.rotation.x, lShoulderX, damp);
    r.leftShoulder.rotation.z = THREE.MathUtils.lerp(r.leftShoulder.rotation.z, lShoulderZ, damp);
    r.leftForearm.rotation.x = THREE.MathUtils.lerp(r.leftForearm.rotation.x, lForearmX, damp);
    r.leftHip.rotation.x = THREE.MathUtils.lerp(r.leftHip.rotation.x, lLegX, damp);
    r.rightHip.rotation.x = THREE.MathUtils.lerp(r.rightHip.rotation.x, rLegX, damp);
    r.katanaGroup.rotation.x = THREE.MathUtils.lerp(r.katanaGroup.rotation.x, katanaPitch, damp);
    r.cloak.rotation.x = THREE.MathUtils.lerp(r.cloak.rotation.x, cloakPitch, damp);
  }
}
