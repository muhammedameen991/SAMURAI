import { RegionId } from './types';

export const WORLD_HALF_SIZE = 210;
export const TERRAIN_SIZE = 540;

export const REGION_CENTERS: Record<
  RegionId,
  { x: number; z: number; radius: number; name: string; subtitle: string }
> = {
  village: {
    x: 0,
    z: 36,
    radius: 50,
    name: 'Kurokawa Village',
    subtitle: 'Heart of the Valley',
  },
  bamboo_forest: {
    x: 102,
    z: 10,
    radius: 55,
    name: 'Whispering Bamboo Grove',
    subtitle: 'Eastern Mist Woods',
  },
  temple: {
    x: 0,
    z: -112,
    radius: 48,
    name: 'Abandoned Kiyomizu Temple',
    subtitle: 'Sacred Northern Ruins',
  },
  mountain_path: {
    x: -108,
    z: -48,
    radius: 55,
    name: 'Kurogane Mountain Path',
    subtitle: 'Highland Ridge',
  },
  bandit_camp: {
    x: -92,
    z: 86,
    radius: 46,
    name: 'Crimson Skull Camp',
    subtitle: 'Lawless Outskirts',
  },
};

export interface BridgeSpec {
  x: number;
  z: number;
  length: number;
  width: number;
  deckY: number;
}

export function getRiverCenterX(z: number): number {
  return 48 + Math.sin(z * 0.024) * 14;
}

export function getRiverHalfWidth(z: number): number {
  return 8.5 + Math.cos(z * 0.04) * 1.4;
}

export const BRIDGES: BridgeSpec[] = [
  {
    x: getRiverCenterX(24),
    z: 24,
    length: 23,
    width: 5.4,
    deckY: 1.55,
  },
  {
    x: getRiverCenterX(-55),
    z: -55,
    length: 23,
    width: 5.2,
    deckY: 1.55,
  },
];

function hash2D(ix: number, iz: number): number {
  const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function valueNoise2D(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);

  const a = hash2D(ix, iz);
  const b = hash2D(ix + 1, iz);
  const c = hash2D(ix, iz + 1);
  const d = hash2D(ix + 1, iz + 1);

  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

export function fbm2D(x: number, z: number, octaves = 3): number {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    value += amp * (valueNoise2D(x * freq, z * freq) * 2 - 1);
    freq *= 2.02;
    amp *= 0.5;
  }
  return value;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Deterministic terrain elevation at world (x, z).
 * Smoothly flattens playable region hubs, carves the river channel,
 * raises the Mountain Path plateau, and creates surrounding perimeter ridges.
 */
export function getTerrainHeight(x: number, z: number): number {
  // Base rolling hills
  let h = fbm2D(x * 0.011, z * 0.011, 3) * 4.5 + 1.2;
  h += fbm2D(x * 0.032 + 17.3, z * 0.032 - 9.1, 2) * 0.9;

  // Village plateau (flat around y = 0.8)
  const dVillage = Math.hypot(x - 0, z - 36);
  const villageFlatten = 1 - smoothstep(26, 52, dVillage);
  h = h * (1 - villageFlatten) + 0.85 * villageFlatten;

  // Castle hill north-west of village
  const dCastle = Math.hypot(x + 28, z - 12);
  const castleRise = 1 - smoothstep(10, 26, dCastle);
  h += castleRise * 5.2;

  // Abandoned Temple courtyard plateau (slightly elevated sacred ground)
  const dTemple = Math.hypot(x - 0, z + 112);
  const templeFlatten = 1 - smoothstep(22, 46, dTemple);
  h = h * (1 - templeFlatten) + 4.4 * templeFlatten;

  // Bamboo Forest gentle floor
  const dBamboo = Math.hypot(x - 102, z - 10);
  const bambooFlatten = 1 - smoothstep(22, 54, dBamboo);
  h = h * (1 - bambooFlatten) + 1.4 * bambooFlatten;

  // Bandit Camp clearing
  const dBandit = Math.hypot(x + 92, z - 86);
  const banditFlatten = 1 - smoothstep(20, 44, dBandit);
  h = h * (1 - banditFlatten) + 1.6 * banditFlatten;

  // Mountain Path elevated ridge & summit plateau
  const dMountain = Math.hypot(x + 108, z + 48);
  const mountainPlateau = 1 - smoothstep(18, 52, dMountain);
  h += mountainPlateau * 9.5;
  if (dMountain < 22) {
    const summitFlat = 1 - smoothstep(10, 22, dMountain);
    h = h * (1 - summitFlat) + 11.2 * summitFlat;
  }

  // River trough carving
  const riverX = getRiverCenterX(z);
  const riverHW = getRiverHalfWidth(z);
  const distToRiver = Math.abs(x - riverX);
  if (distToRiver < riverHW + 8) {
    const carve = 1 - smoothstep(riverHW * 0.55, riverHW + 7, distToRiver);
    h = h * (1 - carve) + -2.2 * carve;
  }

  // Natural outer mountain perimeter beyond playable bounds
  const edgeDist = Math.max(Math.abs(x), Math.abs(z));
  if (edgeDist > 168) {
    const rim = smoothstep(168, 245, edgeDist);
    const ridgeNoise = 0.65 + 0.55 * (fbm2D(x * 0.025, z * 0.025, 2) * 0.5 + 0.5);
    h += rim * 34 * ridgeNoise;
  }

  return h;
}

/**
 * Walkable height including arched wooden bridges over the river.
 */
export function getWalkableHeight(x: number, z: number): number {
  const terrainY = getTerrainHeight(x, z);
  for (const b of BRIDGES) {
    const dx = Math.abs(x - b.x);
    const dz = Math.abs(z - b.z);
    if (dx <= b.length * 0.5 && dz <= b.width * 0.5) {
      const arch = Math.cos((dx / (b.length * 0.5)) * (Math.PI * 0.5)) * 1.15;
      return Math.max(terrainY, b.deckY + arch);
    }
  }
  return terrainY;
}

export function isOnBridge(x: number, z: number): boolean {
  for (const b of BRIDGES) {
    if (Math.abs(x - b.x) <= b.length * 0.5 && Math.abs(z - b.z) <= b.width * 0.5) {
      return true;
    }
  }
  return false;
}

export function getRegionAt(x: number, z: number): RegionId {
  let closest: RegionId = 'village';
  let minScore = Infinity;
  for (const [id, info] of Object.entries(REGION_CENTERS) as [
    RegionId,
    (typeof REGION_CENTERS)[RegionId],
  ][]) {
    const d = Math.hypot(x - info.x, z - info.z) / info.radius;
    if (d < minScore) {
      minScore = d;
      closest = id;
    }
  }
  return closest;
}

export function clampAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function lerpAngle(current: number, target: number, alpha: number): number {
  const diff = clampAngle(target - current);
  return current + diff * alpha;
}

export function detectHardwareProfile(): { isSoftwareGl: boolean; isLowEnd: boolean } {
  let isSoftwareGl = false;
  let rendererStr = '';
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) {
      return { isSoftwareGl: true, isLowEnd: true };
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    rendererStr = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererStr);
  } catch {
    isSoftwareGl = true;
  }

  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 8;
  const isIntegrated = /Intel.*HD|Intel.*UHD|Mali|Adreno 5|Apple GPU/i.test(rendererStr);
  const isLowEnd = isSoftwareGl || cores <= 4 || mem <= 4 || /Intel.*HD/i.test(rendererStr) || (isIntegrated && cores <= 4);

  return { isSoftwareGl, isLowEnd };
}
