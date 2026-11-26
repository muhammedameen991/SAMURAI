export type GameScreen = 'menu' | 'playing' | 'paused' | 'gameover' | 'victory';

export type QualityPreset = 'low' | 'medium' | 'high';

export type AtmosphereMode = 'dynamic' | 'sunset' | 'night';

export type RegionId =
  | 'village'
  | 'bamboo_forest'
  | 'temple'
  | 'mountain_path'
  | 'bandit_camp';

export type EnemyKind = 'bandit' | 'guard' | 'ronin' | 'rogue_samurai';

export interface GameSettings {
  quality: QualityPreset;
  resolutionScale: number; // 0.6 to 1.0
  shadows: boolean;
  ambientEffects: boolean;
  drawDistance: number; // 140 to 340
  particleEffects: boolean;
  showFps: boolean;
  atmosphere: AtmosphereMode;
  masterVolume: number; // 0 to 1
  musicVolume: number; // 0 to 1
  sfxVolume: number; // 0 to 1
  muted: boolean;
  mouseSensitivity: number; // 0.4 to 2.0
}

export interface MissionObjective {
  id: string;
  description: string;
  current: number;
  target: number;
  completed: boolean;
  markerPos?: { x: number; z: number };
}

export interface Mission {
  id: string;
  title: string;
  region: RegionId;
  giver: string;
  summary: string;
  xpReward: number;
  goldReward: number;
  status: 'locked' | 'available' | 'active' | 'completed';
  objectives: MissionObjective[];
}

export interface InteractableInfo {
  id: string;
  kind: 'npc' | 'shrine' | 'blacksmith' | 'pickup' | 'relic' | 'captive' | 'chest';
  label: string;
  sublabel?: string;
}

export interface MinimapMarker {
  x: number;
  z: number;
  type: 'enemy' | 'boss' | 'npc' | 'mission' | 'shrine' | 'pickup';
}

export interface HudSnapshot {
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  xp: number;
  xpToNext: number;
  level: number;
  gold: number;
  katanaTier: number;
  katanaName: string;
  healingCharges: number;
  currentRegion: RegionId;
  regionName: string;
  fps: number;
  timeOfDayLabel: string;
  activeMission: Mission | null;
  completedMissionsCount: number;
  totalMissionsCount: number;
  targetEnemy: {
    name: string;
    kind: EnemyKind;
    health: number;
    maxHealth: number;
    isBoss: boolean;
    isBlocking: boolean;
  } | null;
  interactPrompt: InteractableInfo | null;
  isBlocking: boolean;
  comboStep: number;
  pointerLocked: boolean;
  playerPos: { x: number; z: number; yaw: number };
  minimapMarkers: MinimapMarker[];
  toastMessage: { title: string; subtitle: string; tone: 'gold' | 'crimson' | 'neutral' } | null;
  dialogue: {
    speaker: string;
    role: string;
    lines: string[];
    actionLabel?: string;
    actionId?: string;
  } | null;
}

export interface SaveData {
  version: number;
  timestamp: number;
  player: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    health: number;
    maxHealth: number;
    xp: number;
    level: number;
    gold: number;
    katanaTier: number;
    healingCharges: number;
  };
  discoveredRegions: RegionId[];
  collectedIds: string[];
  missions: {
    id: string;
    status: Mission['status'];
    objectives: { id: string; current: number; completed: boolean }[];
  }[];
  activeMissionId: string | null;
}
