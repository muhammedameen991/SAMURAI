import * as THREE from 'three';
import { AudioManager } from './audio';
import { CombatEffects } from './combat';
import { ArticulatedCharacter, createSamuraiCharacter } from './models';
import { PlayerController } from './player';
import { EnemyKind, RegionId } from './types';
import { getWalkableHeight, lerpAngle } from './utils';
import { CircleCollider } from './world';

export type EnemyAiState =
  | 'patrol'
  | 'chase'
  | 'circle'
  | 'windup'
  | 'attack'
  | 'block'
  | 'stagger'
  | 'dead';

export interface EnemyUnit {
  id: string;
  name: string;
  kind: EnemyKind;
  region: RegionId;
  isBoss: boolean;
  missionTag?: string;
  rig: ArticulatedCharacter;
  position: THREE.Vector3;
  homePos: THREE.Vector3;
  patrolTarget: THREE.Vector3;
  velocity: THREE.Vector3;
  yaw: number;
  health: number;
  maxHealth: number;
  damage: number;
  xpReward: number;
  goldReward: number;
  detectRange: number;
  attackRange: number;
  moveSpeed: number;
  state: EnemyAiState;
  stateTimer: number;
  stateDuration: number;
  cooldownTimer: number;
  hitFlashTimer: number;
  respawnTimer: number;
  attackApplied: boolean;
  strafeSign: number;
}

export class EnemyManager {
  public readonly enemies: EnemyUnit[] = [];
  private readonly _toPlayer = new THREE.Vector3();
  private readonly _tmpDir = new THREE.Vector3();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly contactShadowTex: THREE.Texture,
    private readonly audio: AudioManager,
    private readonly vfx: CombatEffects
  ) {
    this.spawnInitialRoster();
  }

  private spawnInitialRoster(): void {
    // 1. Village Perimeter Bandits (Mission: Protect the Village)
    this.createEnemy('bandit_v1', 'Scout Bandit', 'bandit', 'village', -22, 62, false, 'village_bandit');
    this.createEnemy('bandit_v2', 'Scout Bandit', 'bandit', 'village', 24, 58, false, 'village_bandit');
    this.createEnemy('bandit_v3', 'Raider Bandit', 'bandit', 'village', -26, 44, false, 'village_bandit');

    // 2. Bandit Camp Enemies + Boss (Mission: Clear the Bandit Camp)
    this.createEnemy('bandit_c1', 'Camp Marauder', 'bandit', 'bandit_camp', -84, 78, false, 'camp_bandit');
    this.createEnemy('bandit_c2', 'Camp Marauder', 'bandit', 'bandit_camp', -100, 82, false, 'camp_bandit');
    this.createEnemy('bandit_c3', 'Camp Guard', 'guard', 'bandit_camp', -86, 94, false, 'camp_bandit');
    this.createEnemy('bandit_c4', 'Camp Guard', 'guard', 'bandit_camp', -98, 96, false, 'camp_bandit');
    this.createEnemy('boss_bandit', 'Takeshi the Bandit Chief', 'rogue_samurai', 'bandit_camp', -92, 89, true, 'camp_boss');

    // 3. Bamboo Forest Ronin & Bandits
    this.createEnemy('ronin_b1', 'Wandering Ronin', 'ronin', 'bamboo_forest', 84, 14, false);
    this.createEnemy('ronin_b2', 'Mist Ronin', 'ronin', 'bamboo_forest', 110, -4, false);
    this.createEnemy('bandit_b1', 'Forest Ambush Bandit', 'bandit', 'bamboo_forest', 96, 26, false);

    // 4. Abandoned Temple Guards
    this.createEnemy('guard_t1', 'Fallen Ashigaru Guard', 'guard', 'temple', -8, -90, false);
    this.createEnemy('guard_t2', 'Fallen Ashigaru Guard', 'guard', 'temple', 8, -90, false);
    this.createEnemy('ronin_t1', 'Shrine Ronin', 'ronin', 'temple', 0, -104, false);

    // 5. Mountain Path Guards & Final Boss (Mission: Defeat the Rogue Samurai)
    this.createEnemy('guard_m1', 'Highland Sentinel', 'guard', 'mountain_path', -84, -36, false);
    this.createEnemy('ronin_m1', 'Mountain Blade Ronin', 'ronin', 'mountain_path', -98, -44, false);
    this.createEnemy('boss_rogue', 'Kuroda, Shadow of the Shogun', 'rogue_samurai', 'mountain_path', -110, -50, true, 'rogue_boss');
  }

  private createEnemy(
    id: string,
    name: string,
    kind: EnemyKind,
    region: RegionId,
    x: number,
    z: number,
    isBoss: boolean,
    missionTag?: string
  ): void {
    const stats = {
      bandit: { hp: 70, dmg: 12, xp: 35, gold: 14, speed: 4.5, detect: 20 },
      guard: { hp: 95, dmg: 16, xp: 48, gold: 20, speed: 4.3, detect: 22 },
      ronin: { hp: 120, dmg: 20, xp: 65, gold: 28, speed: 5.0, detect: 24 },
      rogue_samurai: { hp: isBoss ? 240 : 145, dmg: isBoss ? 26 : 22, xp: isBoss ? 180 : 85, gold: isBoss ? 90 : 38, speed: 5.2, detect: 26 },
    }[kind];

    const scale = isBoss ? 1.16 : 1.0;
    const rig = createSamuraiCharacter(kind, this.contactShadowTex, scale);
    const y = getWalkableHeight(x, z);
    rig.root.position.set(x, y, z);
    this.scene.add(rig.root);

    this.enemies.push({
      id,
      name,
      kind,
      region,
      isBoss,
      missionTag,
      rig,
      position: new THREE.Vector3(x, y, z),
      homePos: new THREE.Vector3(x, y, z),
      patrolTarget: new THREE.Vector3(x + 4, y, z - 4),
      velocity: new THREE.Vector3(),
      yaw: Math.random() * Math.PI * 2,
      health: stats.hp,
      maxHealth: stats.hp,
      damage: stats.dmg,
      xpReward: stats.xp,
      goldReward: stats.gold,
      detectRange: stats.detect,
      attackRange: isBoss ? 2.65 : 2.25,
      moveSpeed: stats.speed,
      state: 'patrol',
      stateTimer: 0,
      stateDuration: 2.5,
      cooldownTimer: 0,
      hitFlashTimer: 0,
      respawnTimer: 0,
      attackApplied: false,
      strafeSign: Math.random() < 0.5 ? 1 : -1,
    });
  }

  public countAliveByTag(tag: string): number {
    return this.enemies.filter((e) => e.missionTag === tag && e.state !== 'dead').length;
  }

  public update(
    dt: number,
    elapsed: number,
    player: PlayerController,
    colliders: CircleCollider[],
    onEnemyKilled: (enemy: EnemyUnit) => void,
    onPlayerHitImpact: (heavy: boolean, hitstopMs: number, shake: number) => void
  ): EnemyUnit | null {
    let lockedTarget: EnemyUnit | null = null;
    let bestTargetDist = 18;

    for (const e of this.enemies) {
      if (e.hitFlashTimer > 0) {
        e.hitFlashTimer = Math.max(0, e.hitFlashTimer - dt);
        const amt = e.hitFlashTimer > 0 ? 0.75 : 0;
        for (const m of e.rig.hitFlashMaterials) {
          m.emissive.setHex(0xef4444);
          m.emissiveIntensity = amt;
        }
      }

      if (e.state === 'dead') {
        e.stateTimer += dt;
        e.rig.hips.rotation.x = THREE.MathUtils.lerp(e.rig.hips.rotation.x, -Math.PI * 0.45, Math.min(1, dt * 8));
        e.rig.hips.position.y = THREE.MathUtils.lerp(e.rig.hips.position.y, 0.22, Math.min(1, dt * 8));
        (e.rig.telegraphRing.material as THREE.MeshBasicMaterial).opacity = 0;
        if (e.stateTimer > 5 && !e.isBoss && !e.missionTag) {
          e.respawnTimer += dt;
          if (e.respawnTimer > 35) {
            e.health = e.maxHealth;
            e.state = 'patrol';
            e.position.copy(e.homePos);
            e.rig.hips.rotation.x = 0;
            e.rig.hips.position.y = 0.92;
            e.respawnTimer = 0;
          }
        }
        e.rig.root.visible = e.stateTimer < 10;
        continue;
      }

      e.rig.root.visible = true;
      if (e.cooldownTimer > 0) e.cooldownTimer = Math.max(0, e.cooldownTimer - dt);

      this._toPlayer.subVectors(player.position, e.position);
      const distPlayer = Math.hypot(this._toPlayer.x, this._toPlayer.z);
      const distHome = Math.hypot(e.position.x - e.homePos.x, e.position.z - e.homePos.z);

      if (distPlayer < bestTargetDist && (e.state !== 'patrol' || distPlayer < 10)) {
        bestTargetDist = distPlayer;
        lockedTarget = e;
      }

      // Check if player's active katana swing hits this enemy
      if (player.isAttackActiveWindow() && !player.attackHasHit && distPlayer <= 2.95) {
        const playerFacingX = Math.sin(player.yaw);
        const playerFacingZ = Math.cos(player.yaw);
        const toEnemyX = (e.position.x - player.position.x) / Math.max(0.01, distPlayer);
        const toEnemyZ = (e.position.z - player.position.z) / Math.max(0.01, distPlayer);
        const dot = playerFacingX * toEnemyX + playerFacingZ * toEnemyZ;

        if (dot > 0.28 || distPlayer < 1.25) {
          player.attackHasHit = true;
          const isHeavy = player.state === 'attack_heavy';
          const dmg = Math.round(player.baseDamage * (isHeavy ? 1.75 : player.comboStep === 3 ? 1.3 : 1.0));

          if (e.state === 'block' && !isHeavy) {
            // Enemy blocked light attack! Sparks fly
            this.audio.playSwordClash(false);
            this.vfx.spawnSparks(e.position, 14, 0xfef08a);
            e.state = 'chase';
            e.cooldownTimer = 0.35;
            onPlayerHitImpact(false, 20, 0.08);
          } else {
            e.health = Math.max(0, e.health - dmg);
            e.hitFlashTimer = 0.16;
            this.audio.playHitImpact(isHeavy);
            this.vfx.spawnSparks(e.position, isHeavy ? 18 : 11, 0xef4444);

            // Knockback
            const kb = isHeavy ? 9.5 : 5.2;
            e.velocity.x = toEnemyX * kb;
            e.velocity.z = toEnemyZ * kb;

            onPlayerHitImpact(isHeavy, isHeavy ? 55 : 28, isHeavy ? 0.22 : 0.11);

            if (e.health <= 0) {
              e.state = 'dead';
              e.stateTimer = 0;
              this.vfx.spawnSparks(e.position, 22, 0xfbbf24);
              onEnemyKilled(e);
              continue;
            } else {
              e.state = 'stagger';
              e.stateTimer = 0;
              e.stateDuration = isHeavy ? 0.55 : 0.32;
            }
          }
        }
      }

      // AI State Machine
      e.stateTimer += dt;
      let moveX = 0;
      let moveZ = 0;
      let telegraphOpacity = 0;

      if (player.state === 'dead') {
        e.state = 'patrol';
      }

      switch (e.state) {
        case 'stagger': {
          if (e.stateTimer >= e.stateDuration) {
            e.state = 'chase';
            e.stateTimer = 0;
          }
          break;
        }
        case 'block': {
          const targetYaw = Math.atan2(this._toPlayer.x, this._toPlayer.z);
          e.yaw = lerpAngle(e.yaw, targetYaw, 1 - Math.exp(-10 * dt));
          if (e.stateTimer >= e.stateDuration) {
            e.state = 'chase';
            e.stateTimer = 0;
          }
          break;
        }
        case 'patrol': {
          if (distPlayer < e.detectRange && player.state !== 'dead') {
            e.state = 'chase';
            e.stateTimer = 0;
            break;
          }
          const pdx = e.patrolTarget.x - e.position.x;
          const pdz = e.patrolTarget.z - e.position.z;
          const pDist = Math.hypot(pdx, pdz);
          if (pDist < 1.2 || e.stateTimer > 5.0) {
            const ang = Math.random() * Math.PI * 2;
            const rad = 4 + Math.random() * 6;
            e.patrolTarget.set(e.homePos.x + Math.cos(ang) * rad, 0, e.homePos.z + Math.sin(ang) * rad);
            e.stateTimer = 0;
          } else {
            moveX = (pdx / pDist) * (e.moveSpeed * 0.45);
            moveZ = (pdz / pDist) * (e.moveSpeed * 0.45);
            e.yaw = lerpAngle(e.yaw, Math.atan2(pdx, pdz), 1 - Math.exp(-6 * dt));
          }
          break;
        }
        case 'chase': {
          if (distPlayer > e.detectRange * 1.65 || distHome > 44) {
            e.state = 'patrol';
            e.stateTimer = 0;
            break;
          }
          const targetYaw = Math.atan2(this._toPlayer.x, this._toPlayer.z);
          e.yaw = lerpAngle(e.yaw, targetYaw, 1 - Math.exp(-9 * dt));

          if (distPlayer <= e.attackRange && e.cooldownTimer <= 0) {
            e.state = 'windup';
            e.stateTimer = 0;
            e.stateDuration = e.isBoss ? 0.44 : 0.56;
            e.attackApplied = false;
          } else if (distPlayer <= e.attackRange + 1.4 && e.cooldownTimer > 0) {
            e.state = 'circle';
            e.stateTimer = 0;
            e.stateDuration = 0.9;
            e.strafeSign = Math.random() < 0.5 ? 1 : -1;
          } else {
            const nx = this._toPlayer.x / Math.max(0.01, distPlayer);
            const nz = this._toPlayer.z / Math.max(0.01, distPlayer);
            moveX = nx * e.moveSpeed;
            moveZ = nz * e.moveSpeed;
          }
          break;
        }
        case 'circle': {
          const targetYaw = Math.atan2(this._toPlayer.x, this._toPlayer.z);
          e.yaw = lerpAngle(e.yaw, targetYaw, 1 - Math.exp(-10 * dt));
          const nx = this._toPlayer.x / Math.max(0.01, distPlayer);
          const nz = this._toPlayer.z / Math.max(0.01, distPlayer);
          moveX = -nz * e.strafeSign * (e.moveSpeed * 0.55);
          moveZ = nx * e.strafeSign * (e.moveSpeed * 0.55);

          // Occasionally raise guard if player attacks nearby
          if (player.isAttacking() && distPlayer < 3.4 && (e.kind === 'guard' || e.kind === 'rogue_samurai' || e.kind === 'ronin') && Math.random() < 0.35) {
            e.state = 'block';
            e.stateTimer = 0;
            e.stateDuration = 0.7;
            break;
          }
          if (e.stateTimer >= e.stateDuration || distPlayer > e.attackRange + 2.2) {
            e.state = 'chase';
            e.stateTimer = 0;
          }
          break;
        }
        case 'windup': {
          const targetYaw = Math.atan2(this._toPlayer.x, this._toPlayer.z);
          e.yaw = lerpAngle(e.yaw, targetYaw, 1 - Math.exp(-8 * dt));
          telegraphOpacity = 0.35 + (e.stateTimer / e.stateDuration) * 0.55;
          if (e.stateTimer >= e.stateDuration) {
            e.state = 'attack';
            e.stateTimer = 0;
            e.stateDuration = 0.38;
            this.audio.playKatanaSlash(e.isBoss);
          }
          break;
        }
        case 'attack': {
          // Lunge slightly
          if (e.stateTimer < 0.16) {
            moveX = Math.sin(e.yaw) * 4.5;
            moveZ = Math.cos(e.yaw) * 4.5;
          }
          if (!e.attackApplied && e.stateTimer >= 0.12 && e.stateTimer <= 0.28) {
            if (distPlayer <= e.attackRange + 0.55) {
              e.attackApplied = true;
              const result = player.takeDamage(e.damage, e.position, elapsed);
              if (result === 'parried') {
                this.vfx.spawnSparks(player.position, 20, 0xfef08a);
                e.state = 'stagger';
                e.stateTimer = 0;
                e.stateDuration = 1.05;
                onPlayerHitImpact(true, 45, 0.18);
              } else if (result === 'blocked') {
                this.vfx.spawnSparks(player.position, 10, 0xfbbf24);
                onPlayerHitImpact(false, 15, 0.08);
              } else if (result === 'hit') {
                this.vfx.spawnSparks(player.position, 10, 0xdc2626);
                onPlayerHitImpact(false, 25, 0.15);
              }
            }
          }
          if (e.stateTimer >= e.stateDuration) {
            e.state = 'circle';
            e.stateTimer = 0;
            e.stateDuration = e.isBoss ? 0.65 : 1.05;
            e.cooldownTimer = e.isBoss ? 0.75 : 1.15;
          }
          break;
        }
      }

      // Telegraph ring opacity
      (e.rig.telegraphRing.material as THREE.MeshBasicMaterial).opacity = telegraphOpacity;

      // Apply movement + knockback decay
      e.position.x += (moveX + e.velocity.x) * dt;
      e.position.z += (moveZ + e.velocity.z) * dt;
      e.velocity.multiplyScalar(Math.exp(-10 * dt));

      // Obstacle collisions
      for (const c of colliders) {
        const dx = e.position.x - c.x;
        const dz = e.position.z - c.z;
        const minD = c.r + 0.58;
        const dSq = dx * dx + dz * dz;
        if (dSq < minD * minD && dSq > 0.0001) {
          const d = Math.sqrt(dSq);
          e.position.x += (dx / d) * (minD - d);
          e.position.z += (dz / d) * (minD - d);
        }
      }

      // Separation from other enemies so they don't stack
      for (const other of this.enemies) {
        if (other === e || other.state === 'dead') continue;
        const dx = e.position.x - other.position.x;
        const dz = e.position.z - other.position.z;
        const dSq = dx * dx + dz * dz;
        if (dSq < 1.3 * 1.3 && dSq > 0.0001) {
          const d = Math.sqrt(dSq);
          e.position.x += (dx / d) * (1.3 - d) * 0.5;
          e.position.z += (dz / d) * (1.3 - d) * 0.5;
        }
      }

      e.position.y = getWalkableHeight(e.position.x, e.position.z);
      e.rig.root.position.copy(e.position);
      e.rig.root.rotation.y = e.yaw;

      this.animateEnemyPose(e, dt, elapsed, Math.hypot(moveX, moveZ));
    }

    return lockedTarget;
  }

  private animateEnemyPose(e: EnemyUnit, dt: number, elapsed: number, speed: number): void {
    const r = e.rig;
    const damp = 1 - Math.exp(-16 * dt);

    let torsoPitch = 0;
    let torsoYaw = 0;
    let rShoulderX = -0.35;
    let rShoulderZ = -0.18;
    let lLegX = 0;
    let rLegX = 0;
    let katanaPitch = Math.PI * 0.48;

    if (e.state === 'windup') {
      const p = Math.min(1, e.stateTimer / Math.max(0.01, e.stateDuration));
      torsoPitch = -0.18 * p;
      rShoulderX = -2.35 * p;
      rShoulderZ = -0.35;
    } else if (e.state === 'attack') {
      const p = Math.min(1, e.stateTimer / Math.max(0.01, e.stateDuration));
      const swing = THREE.MathUtils.smoothstep(p, 0, 0.7);
      torsoPitch = THREE.MathUtils.lerp(-0.18, 0.32, swing);
      torsoYaw = THREE.MathUtils.lerp(-0.5, 0.65, swing);
      rShoulderX = THREE.MathUtils.lerp(-2.35, 0.15, swing);
    } else if (e.state === 'block') {
      rShoulderX = -1.2;
      rShoulderZ = 0.45;
      katanaPitch = Math.PI * 0.12;
    } else if (e.state === 'stagger') {
      torsoPitch = -0.38;
      rShoulderX = 0.45;
    } else if (speed > 0.3) {
      const s = Math.sin(elapsed * 8.5 + e.homePos.x);
      torsoPitch = 0.1;
      lLegX = s * 0.45;
      rLegX = -s * 0.45;
      rShoulderX = -0.35 + s * 0.25;
    } else {
      rShoulderX = -0.32 + Math.sin(elapsed * 2 + e.homePos.z) * 0.04;
    }

    r.torso.rotation.x = THREE.MathUtils.lerp(r.torso.rotation.x, torsoPitch, damp);
    r.torso.rotation.y = THREE.MathUtils.lerp(r.torso.rotation.y, torsoYaw, damp);
    r.rightShoulder.rotation.x = THREE.MathUtils.lerp(r.rightShoulder.rotation.x, rShoulderX, damp);
    r.rightShoulder.rotation.z = THREE.MathUtils.lerp(r.rightShoulder.rotation.z, rShoulderZ, damp);
    r.leftHip.rotation.x = THREE.MathUtils.lerp(r.leftHip.rotation.x, lLegX, damp);
    r.rightHip.rotation.x = THREE.MathUtils.lerp(r.rightHip.rotation.x, rLegX, damp);
    r.katanaGroup.rotation.x = THREE.MathUtils.lerp(r.katanaGroup.rotation.x, katanaPitch, damp);
  }
}
