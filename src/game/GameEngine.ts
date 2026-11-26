import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { AudioManager } from './audio';
import { ThirdPersonCamera } from './camera';
import { CombatEffects } from './combat';
import { EnemyManager, EnemyUnit } from './enemies';
import { createInitialMissions, MissionManager } from './missions';
import { InputState, KATANA_TIERS, PlayerController } from './player';
import { clearSaveData, loadSaveData, writeSaveData } from './save';
import { saveSettings } from './settings';
import { createProceduralTextures, ProceduralTexturePack } from './textures';
import {
  GameScreen,
  GameSettings,
  HudSnapshot,
  MinimapMarker,
  Mission,
  RegionId,
  SaveData,
} from './types';
import { detectHardwareProfile, getRegionAt, getWalkableHeight } from './utils';
import { GameWorld, getRegionDisplayName, WorldInteractable } from './world';

export class GameEngine {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly tpCamera: ThirdPersonCamera;
  private readonly tex: ProceduralTexturePack;
  private readonly world: GameWorld;
  private readonly player: PlayerController;
  private readonly vfx: CombatEffects;
  private readonly enemies: EnemyManager;
  public readonly audio: AudioManager;
  public missions: MissionManager;

  private readonly isSoftwareGl: boolean;
  private screen: GameScreen = 'menu';
  private settings: GameSettings;

  private frameId = 0;
  private disposed = false;
  private lastTime = performance.now();
  private elapsed = 0;
  private hitstopTimer = 0;
  private hudSyncTimer = 0;
  private fpsAccum = 0;
  private fpsFrames = 0;
  private currentFps = 60;

  private pointerLocked = false;
  private isMouseDragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  private discoveredRegions = new Set<RegionId>(['village']);
  private collectedIds = new Set<string>();
  private lastCheckpoint = { x: 0, z: 42 };
  private lastRegion: RegionId = 'village';

  private toastMessage: HudSnapshot['toastMessage'] = null;
  private toastTimer = 0;
  private dialogue: HudSnapshot['dialogue'] = null;
  private targetEnemy: EnemyUnit | null = null;

  private readonly input: InputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    block: false,
    jumpQueued: false,
    dodgeQueued: false,
    lightAttackQueued: false,
    heavyAttackQueued: false,
    interactQueued: false,
    healQueued: false,
  };

  private readonly onHudUpdate: (snapshot: HudSnapshot) => void;
  private readonly onScreenChange: (screen: GameScreen) => void;

  constructor(
    private readonly container: HTMLElement,
    initialSettings: GameSettings,
    onHudUpdate: (snapshot: HudSnapshot) => void,
    onScreenChange: (screen: GameScreen) => void
  ) {
    this.settings = { ...initialSettings };
    this.onHudUpdate = onHudUpdate;
    this.onScreenChange = onScreenChange;

    const profile = detectHardwareProfile();
    this.isSoftwareGl = profile.isSoftwareGl;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && this.settings.quality !== 'low',
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && this.settings.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.applyResolutionScale();
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x7c4a3e, 0.0062);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(
      60,
      (container.clientWidth || window.innerWidth) / Math.max(1, container.clientHeight || window.innerHeight),
      0.15,
      this.settings.drawDistance
    );
    this.tpCamera = new ThirdPersonCamera(this.camera);

    this.audio = new AudioManager(this.settings);
    this.tex = createProceduralTextures(this.renderer.capabilities.getMaxAnisotropy());
    this.world = new GameWorld(this.scene, this.tex, this.settings);
    this.player = new PlayerController(this.scene, this.tex.contactShadow, this.audio);
    this.vfx = new CombatEffects(this.scene, this.tex.sparkSprite);
    this.vfx.setParticlesEnabled(this.settings.particleEffects);
    this.enemies = new EnemyManager(this.scene, this.tex.contactShadow, this.audio, this.vfx);
    this.missions = new MissionManager();

    this.world.setMissionMarker(this.missions.getCurrentMarker());

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.pushHudSnapshot();
    this.startLoop();
  }

  private applyResolutionScale(): void {
    const baseDpr = this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(baseDpr * this.settings.resolutionScale);
  }

  public updateSettings(next: GameSettings): void {
    this.settings = { ...next };
    saveSettings(this.settings);
    this.applyResolutionScale();
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && this.settings.shadows;
    this.camera.far = this.settings.drawDistance;
    this.camera.updateProjectionMatrix();
    this.world.applySettings(this.settings);
    this.vfx.setParticlesEnabled(this.settings.particleEffects);
    this.audio.applySettings(this.settings);
  }

  public startNewGame(): void {
    this.audio.unlock();
    this.audio.playUiClick(true);
    clearSaveData();

    this.player.level = 1;
    this.player.xp = 0;
    this.player.maxHealth = 120;
    this.player.maxStamina = 100;
    this.player.gold = 25;
    this.player.katanaTier = 0;
    this.player.healingCharges = 2;
    this.player.resetForRespawn(0, 40);
    this.player.yaw = Math.PI;

    this.discoveredRegions = new Set(['village']);
    this.collectedIds.clear();
    for (const item of this.world.interactables) {
      item.collected = false;
      item.mesh.visible = true;
    }

    this.missions = new MissionManager(createInitialMissions());
    this.world.setMissionMarker(this.missions.getCurrentMarker());
    this.tpCamera.snapToPlayer(this.player.position);

    this.setScreen('playing');
    this.showToast('Kurokawa Village', 'Speak with Elder Kenji or defend the village perimeter.', 'gold');
    this.saveGame();
  }

  public continueGame(): boolean {
    const save = loadSaveData();
    if (!save) return false;

    this.audio.unlock();
    this.audio.playUiClick(true);

    this.player.level = save.player.level;
    this.player.xp = save.player.xp;
    this.player.maxHealth = save.player.maxHealth;
    this.player.health = Math.max(25, save.player.health);
    this.player.gold = save.player.gold;
    this.player.katanaTier = save.player.katanaTier;
    this.player.healingCharges = save.player.healingCharges;
    this.player.position.set(
      save.player.x,
      getWalkableHeight(save.player.x, save.player.z),
      save.player.z
    );
    this.player.yaw = save.player.yaw;
    this.player.state = 'idle';

    this.discoveredRegions = new Set(save.discoveredRegions);
    this.collectedIds = new Set(save.collectedIds);
    for (const id of this.collectedIds) {
      this.world.markCollected(id);
    }

    const baseMissions = createInitialMissions();
    for (const savedM of save.missions) {
      const m = baseMissions.find((x) => x.id === savedM.id);
      if (m) {
        m.status = savedM.status;
        for (const so of savedM.objectives) {
          const obj = m.objectives.find((o) => o.id === so.id);
          if (obj) {
            obj.current = so.current;
            obj.completed = so.completed;
          }
        }
      }
    }
    this.missions = new MissionManager(baseMissions);
    this.missions.activeMissionId = save.activeMissionId;
    this.world.setMissionMarker(this.missions.getCurrentMarker());
    this.tpCamera.snapToPlayer(this.player.position);

    this.setScreen('playing');
    this.showToast('Journey Resumed', getRegionDisplayName(getRegionAt(this.player.position.x, this.player.position.z)), 'gold');
    return true;
  }

  public saveGame(): void {
    const data: SaveData = {
      version: 1,
      timestamp: Date.now(),
      player: {
        x: this.player.position.x,
        y: this.player.position.y,
        z: this.player.position.z,
        yaw: this.player.yaw,
        health: this.player.health,
        maxHealth: this.player.maxHealth,
        xp: this.player.xp,
        level: this.player.level,
        gold: this.player.gold,
        katanaTier: this.player.katanaTier,
        healingCharges: this.player.healingCharges,
      },
      discoveredRegions: Array.from(this.discoveredRegions),
      collectedIds: Array.from(this.collectedIds),
      missions: this.missions.missions.map((m) => ({
        id: m.id,
        status: m.status,
        objectives: m.objectives.map((o) => ({
          id: o.id,
          current: o.current,
          completed: o.completed,
        })),
      })),
      activeMissionId: this.missions.activeMissionId,
    };
    writeSaveData(data);
  }

  public setScreen(screen: GameScreen): void {
    this.screen = screen;
    this.audio.setPlayingState(screen === 'playing');
    if (screen !== 'playing' && document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }
    this.clearHeldInputs();
    this.onScreenChange(screen);
    this.pushHudSnapshot();
  }

  public resumeGame(): void {
    this.audio.playUiClick(true);
    this.setScreen('playing');
    this.requestPointerLockSafe();
  }

  public respawnAtCheckpoint(): void {
    this.audio.playUiClick(true);
    this.player.resetForRespawn(this.lastCheckpoint.x, this.lastCheckpoint.z);
    this.tpCamera.snapToPlayer(this.player.position);
    this.setScreen('playing');
    this.showToast('Restored at Shrine', 'Your spirit endures. Face your foes anew.', 'neutral');
  }

  public closeDialogue(): void {
    this.dialogue = null;
    this.pushHudSnapshot();
  }

  public handleDialogueAction(actionId?: string): void {
    if (actionId === 'upgrade_katana') {
      const nextTier = this.player.katanaTier + 1;
      if (nextTier < KATANA_TIERS.length) {
        const tierInfo = KATANA_TIERS[nextTier];
        if (this.player.gold >= tierInfo.cost) {
          this.player.gold -= tierInfo.cost;
          this.player.katanaTier = nextTier;
          this.audio.playSwordClash(true);
          this.showToast('Katana Forged', `${tierInfo.name} unlocked (+Damage)`, 'gold');
          this.saveGame();
        } else {
          this.showToast('Insufficient Gold', `Need ${tierInfo.cost} Gold to forge ${tierInfo.name}`, 'crimson');
        }
      }
    }
    this.dialogue = null;
    this.requestPointerLockSafe();
    this.pushHudSnapshot();
  }

  public setActiveMission(missionId: string): void {
    this.missions.setActiveMission(missionId);
    this.world.setMissionMarker(this.missions.getCurrentMarker());
    this.pushHudSnapshot();
  }

  public requestPointerLockSafe(): void {
    if (this.screen !== 'playing' || this.dialogue) return;
    try {
      this.renderer.domElement.requestPointerLock?.();
    } catch {
      // Fallback drag look remains active
    }
  }

  private showToast(title: string, subtitle: string, tone: 'gold' | 'crimson' | 'neutral'): void {
    this.toastMessage = { title, subtitle, tone };
    this.toastTimer = 3.8;
    this.pushHudSnapshot();
  }

  private clearHeldInputs(): void {
    this.input.forward = false;
    this.input.backward = false;
    this.input.left = false;
    this.input.right = false;
    this.input.sprint = false;
    this.input.block = false;
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);

    const dom = this.renderer.domElement;
    dom.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    dom.addEventListener('contextmenu', this.handleContextMenu);
    dom.addEventListener('webglcontextlost', this.handleContextLost);
  }

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
  };

  private handleContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

  private handleResize = (): void => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private handleBlur = (): void => {
    this.clearHeldInputs();
    this.isMouseDragging = false;
  };

  private handlePointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    this.pushHudSnapshot();
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Escape') {
      if (this.dialogue) {
        this.closeDialogue();
        return;
      }
      if (this.screen === 'playing') {
        this.setScreen('paused');
      } else if (this.screen === 'paused') {
        this.resumeGame();
      }
      return;
    }

    if (this.screen !== 'playing' || this.dialogue) return;

    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.input.forward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.input.backward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.input.left = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.input.right = true;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.input.sprint = true;
        break;
      case 'Space':
        e.preventDefault();
        this.input.jumpQueued = true;
        break;
      case 'KeyQ':
        this.input.dodgeQueued = true;
        break;
      case 'KeyE':
        this.input.interactQueued = true;
        break;
      case 'KeyR':
        this.input.healQueued = true;
        break;
      case 'KeyF':
        this.input.block = true;
        break;
      case 'KeyJ':
        this.input.lightAttackQueued = true;
        break;
      case 'KeyK':
        this.input.heavyAttackQueued = true;
        break;
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.input.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.input.backward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.input.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.input.right = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.input.sprint = false;
        break;
      case 'KeyF':
        this.input.block = false;
        break;
    }
  };

  private handleMouseDown = (e: MouseEvent): void => {
    if (this.screen !== 'playing' || this.dialogue) return;
    this.audio.unlock();

    if (!this.pointerLocked) {
      this.requestPointerLockSafe();
    }

    if (e.button === 0) {
      this.isMouseDragging = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      if (this.input.sprint) {
        this.input.heavyAttackQueued = true;
      } else {
        this.input.lightAttackQueued = true;
      }
    } else if (e.button === 1) {
      e.preventDefault();
      this.input.heavyAttackQueued = true;
    } else if (e.button === 2) {
      this.input.block = true;
    }
  };

  private handleMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) {
      this.isMouseDragging = false;
    } else if (e.button === 2) {
      this.input.block = false;
    }
  };

  private handleMouseMove = (e: MouseEvent): void => {
    if (this.screen !== 'playing' || this.dialogue) return;
    if (this.pointerLocked) {
      this.tpCamera.rotate(e.movementX, e.movementY, this.settings.mouseSensitivity);
    } else if (this.isMouseDragging) {
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.tpCamera.rotate(dx, dy, this.settings.mouseSensitivity);
    }
  };

  private findClosestInteractable(): WorldInteractable | null {
    let best: WorldInteractable | null = null;
    let bestDist = Infinity;
    for (const item of this.world.interactables) {
      if (item.collected) continue;
      const d = Math.hypot(item.x - this.player.position.x, item.z - this.player.position.z);
      if (d <= item.radius && d < bestDist) {
        bestDist = d;
        best = item;
      }
    }
    return best;
  }

  private handleInteraction(item: WorldInteractable): void {
    this.audio.playUiClick(true);

    if (item.kind === 'pickup') {
      this.world.markCollected(item.id);
      this.collectedIds.add(item.id);
      if (item.goldValue) {
        this.player.gold += item.goldValue;
        this.showToast('Gold Collected', `+${item.goldValue} Gold`, 'gold');
      }
      if (item.healValue) {
        this.player.healingCharges += item.healValue;
        this.showToast('Elixir Found', '+1 Healing Charge (Press R to use)', 'neutral');
      }
      this.audio.playPickup();
      this.saveGame();
      return;
    }

    if (item.kind === 'shrine') {
      this.player.health = this.player.maxHealth;
      this.player.stamina = this.player.maxStamina;
      this.player.healingCharges = Math.max(this.player.healingCharges, 2);
      this.lastCheckpoint = { x: item.x, z: item.z + 2.5 };
      this.saveGame();
      this.audio.playMissionComplete();
      this.showToast('Shrine Sanctuary', 'Health restored & progress saved.', 'gold');
      return;
    }

    if (item.kind === 'captive') {
      const nearbyAlive = this.enemies.countAliveByTag('camp_bandit') + this.enemies.countAliveByTag('camp_boss');
      if (nearbyAlive > 0) {
        this.showToast('Camp Still Guarded', 'Defeat the bandits in the camp before freeing the villager!', 'crimson');
        return;
      }
      this.world.markCollected(item.id);
      this.collectedIds.add(item.id);
      const completed = this.missions.recordInteraction(item.id);
      this.handleMissionCompletions(completed);
      this.showToast('Villager Rescued', 'The captive safely returns to Kurokawa Village.', 'gold');
      this.saveGame();
      return;
    }

    if (item.kind === 'relic') {
      this.world.markCollected(item.id);
      this.collectedIds.add(item.id);
      if (this.player.katanaTier < 2) {
        this.player.katanaTier = 2;
      }
      const completed = this.missions.recordInteraction(item.id);
      this.handleMissionCompletions(completed);
      this.audio.playMissionComplete();
      this.showToast('Ancestral Blade Claimed', 'You wield the Muramasa Crimson Edge!', 'gold');
      this.saveGame();
      return;
    }

    if (item.kind === 'npc') {
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock();
      }
      this.dialogue = {
        speaker: 'Elder Kenji',
        role: 'Kurokawa Village Leader',
        lines: [
          'Shadow falls across the valley, young samurai. Kuroda, once sworn to the Shogun, has rallied bandits and rogue blades against our lands.',
          'Drive the raiders from our village perimeter, clear Crimson Skull Camp to the southwest, and face Kuroda atop Kurogane Mountain Path.',
          'Remember: Left Click strikes, Shift + Left Click delivers a heavy cleave, Right Click blocks, and Q dodges.',
        ],
      };
      this.pushHudSnapshot();
      return;
    }

    if (item.kind === 'blacksmith') {
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock();
      }
      const nextTier = this.player.katanaTier + 1;
      const canUpgrade = nextTier < KATANA_TIERS.length;
      const nextInfo = canUpgrade ? KATANA_TIERS[nextTier] : null;
      this.dialogue = {
        speaker: 'Master Tetsuo',
        role: 'Master Swordsmith',
        lines: [
          `Your current blade: ${this.player.katanaName} (Base Damage: ${this.player.baseDamage}).`,
          nextInfo
            ? `I can temper the ${nextInfo.name} for ${nextInfo.cost} Gold (${nextInfo.damage} base blade damage).`
            : 'Your katana has reached masterwork perfection. May it cleave through Kuroda’s shadow.',
        ],
        actionLabel: nextInfo ? `Forge ${nextInfo.name} (${nextInfo.cost} Gold)` : undefined,
        actionId: nextInfo ? 'upgrade_katana' : undefined,
      };
      this.pushHudSnapshot();
    }
  }

  private handleMissionCompletions(completed: Mission[]): void {
    for (const m of completed) {
      this.player.gold += m.goldReward;
      const leveled = this.player.addXp(m.xpReward);
      this.audio.playMissionComplete();
      this.showToast(
        `Mission Complete: ${m.title}`,
        `+${m.xpReward} XP · +${m.goldReward} Gold${leveled ? ' · LEVEL UP!' : ''}`,
        'gold'
      );
    }
    this.world.setMissionMarker(this.missions.getCurrentMarker());
    if (this.missions.allCompleted) {
      this.saveGame();
      window.setTimeout(() => {
        if (!this.disposed && this.screen === 'playing') {
          this.setScreen('victory');
        }
      }, 2100);
    } else if (completed.length > 0) {
      this.saveGame();
    }
  }

  private startLoop(): void {
    const tick = () => {
      if (this.disposed) return;

      const now = performance.now();
      const rawDt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      this.fpsAccum += rawDt;
      this.fpsFrames += 1;
      if (this.fpsAccum >= 0.5) {
        this.currentFps = Math.round(this.fpsFrames / this.fpsAccum);
        this.fpsAccum = 0;
        this.fpsFrames = 0;
      }

      if (this.screen === 'menu') {
        this.elapsed += dt;
        this.world.update(dt, this.elapsed, this.player.position, this.settings.atmosphere);
        this.tpCamera.updateMenuOrbit(dt, this.elapsed);
      } else if (this.screen === 'playing') {
        if (this.hitstopTimer > 0) {
          this.hitstopTimer -= dt;
        } else if (!this.dialogue) {
          this.updateGameplay(dt);
        }
      }

      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.frameId = window.setTimeout(tick, 16);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private updateGameplay(dt: number): void {
    this.elapsed += dt;

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) {
        this.toastMessage = null;
      }
    }

    // Player Update
    const { startedAttack } = this.player.update(
      dt,
      this.elapsed,
      this.input,
      this.tpCamera.yaw,
      this.world.colliders
    );

    if (startedAttack) {
      this.vfx.spawnSlashArc(
        this.player.position,
        this.player.yaw,
        startedAttack === 'heavy',
        this.player.comboStep
      );
    }

    // Check Player Death
    if (this.player.state === 'dead' && this.player.stateTimer >= 1.2) {
      this.setScreen('gameover');
      return;
    }

    // Check Interactable Trigger [E] + Auto-pickup Coins on walkover
    const closestInteractable = this.findClosestInteractable();
    if (closestInteractable && closestInteractable.kind === 'pickup') {
      this.handleInteraction(closestInteractable);
    } else if (this.input.interactQueued && closestInteractable) {
      this.handleInteraction(closestInteractable);
    }
    this.input.interactQueued = false;

    // Region Discovery & Mission Check
    const region = getRegionAt(this.player.position.x, this.player.position.z);
    if (region !== this.lastRegion) {
      this.lastRegion = region;
      const firstTime = !this.discoveredRegions.has(region);
      this.discoveredRegions.add(region);
      const regCompleted = this.missions.recordRegionEntered(region);
      if (regCompleted.length > 0) {
        this.handleMissionCompletions(regCompleted);
      } else if (firstTime) {
        this.showToast(`Discovered: ${getRegionDisplayName(region)}`, 'New territory charted on your map.', 'neutral');
      }
    }

    // Update Enemies & Combat Hits
    this.targetEnemy = this.enemies.update(
      dt,
      this.elapsed,
      this.player,
      this.world.colliders,
      (killed) => {
        this.player.gold += killed.goldReward;
        const leveled = this.player.addXp(killed.xpReward);
        if (leveled) {
          this.showToast(`Level ${this.player.level}`, 'Health & Stamina increased!', 'gold');
        }
        const completed = this.missions.recordEnemyKill(killed.missionTag);
        this.handleMissionCompletions(completed);
      },
      (heavy, hitstopMs, shake) => {
        this.hitstopTimer = Math.max(this.hitstopTimer, hitstopMs / 1000);
        this.tpCamera.addShake(shake);
        if (heavy) {
          this.vfx.spawnSparks(this.player.position, 6, 0xfef08a);
        }
      }
    );

    // Update VFX & World
    this.vfx.update(dt);
    this.world.update(dt, this.elapsed, this.player.position, this.settings.atmosphere);

    // Camera Follow
    this.tpCamera.updateFollow(dt, this.player.position);

    // Throttled HUD Sync (18 Hz)
    this.hudSyncTimer += dt;
    if (this.hudSyncTimer >= 0.055) {
      this.hudSyncTimer = 0;
      this.pushHudSnapshot();
    }
  }

  public pushHudSnapshot(): void {
    const closest = this.screen === 'playing' ? this.findClosestInteractable() : null;
    const markers: MinimapMarker[] = [];

    for (const e of this.enemies.enemies) {
      if (e.state === 'dead') continue;
      markers.push({ x: e.position.x, z: e.position.z, type: e.isBoss ? 'boss' : 'enemy' });
    }
    for (const item of this.world.interactables) {
      if (item.collected) continue;
      if (item.kind === 'npc' || item.kind === 'blacksmith') {
        markers.push({ x: item.x, z: item.z, type: 'npc' });
      } else if (item.kind === 'shrine') {
        markers.push({ x: item.x, z: item.z, type: 'shrine' });
      }
    }
    const mPos = this.missions.getCurrentMarker();
    if (mPos) {
      markers.push({ x: mPos.x, z: mPos.z, type: 'mission' });
    }

    const timeLabel =
      this.settings.atmosphere === 'night'
        ? 'Nightfall'
        : this.settings.atmosphere === 'sunset'
        ? 'Crimson Dusk'
        : 'Cycle';

    this.onHudUpdate({
      health: this.player.health,
      maxHealth: this.player.maxHealth,
      stamina: Math.round(this.player.stamina),
      maxStamina: this.player.maxStamina,
      xp: this.player.xp,
      xpToNext: this.player.xpToNext,
      level: this.player.level,
      gold: this.player.gold,
      katanaTier: this.player.katanaTier,
      katanaName: this.player.katanaName,
      healingCharges: this.player.healingCharges,
      currentRegion: this.lastRegion,
      regionName: getRegionDisplayName(this.lastRegion),
      fps: this.currentFps,
      timeOfDayLabel: timeLabel,
      activeMission: this.missions.activeMission,
      completedMissionsCount: this.missions.completedCount,
      totalMissionsCount: this.missions.missions.length,
      targetEnemy: this.targetEnemy
        ? {
            name: this.targetEnemy.name,
            kind: this.targetEnemy.kind,
            health: this.targetEnemy.health,
            maxHealth: this.targetEnemy.maxHealth,
            isBoss: this.targetEnemy.isBoss,
            isBlocking: this.targetEnemy.state === 'block',
          }
        : null,
      interactPrompt: closest
        ? {
            id: closest.id,
            kind: closest.kind,
            label: closest.label,
            sublabel: closest.sublabel,
          }
        : null,
      isBlocking: this.player.isBlocking(),
      comboStep: this.player.comboStep,
      pointerLocked: this.pointerLocked,
      playerPos: {
        x: this.player.position.x,
        z: this.player.position.z,
        yaw: this.player.yaw,
      },
      minimapMarkers: markers,
      toastMessage: this.toastMessage,
      dialogue: this.dialogue,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);

    const dom = this.renderer.domElement;
    dom.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    dom.removeEventListener('contextmenu', this.handleContextMenu);
    dom.removeEventListener('webglcontextlost', this.handleContextLost);

    this.audio.dispose();
    this.tex.dispose();
    this.renderer.dispose();
    if (dom.parentElement === this.container) {
      this.container.removeChild(dom);
    }
  }
}
