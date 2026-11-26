import * as THREE from 'three';
import {
  AtmosphereMode,
  GameSettings,
  InteractableInfo,
  RegionId,
} from './types';
import {
  BRIDGES,
  TERRAIN_SIZE,
  getRiverCenterX,
  getRiverHalfWidth,
  getTerrainHeight,
} from './utils';
import { ProceduralTexturePack } from './textures';
import {
  ArticulatedCharacter,
  createAbandonedTemple,
  createCherryBlossomTree,
  createJapaneseHouse,
  createSamuraiCastle,
  createSamuraiCharacter,
  createStoneLantern,
  createToriiGate,
  createWoodenBridge,
} from './models';

export interface CircleCollider {
  x: number;
  z: number;
  r: number;
}

export interface WorldInteractable {
  id: string;
  kind: InteractableInfo['kind'];
  label: string;
  sublabel?: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  mesh: THREE.Object3D;
  collected: boolean;
  npcRig?: ArticulatedCharacter;
  missionTag?: string;
  goldValue?: number;
  healValue?: number;
}

interface PetalParticle {
  x: number;
  y: number;
  z: number;
  vy: number;
  vx: number;
  vz: number;
  phase: number;
}

export class GameWorld {
  public readonly group = new THREE.Group();
  public readonly colliders: CircleCollider[] = [];
  public readonly interactables: WorldInteractable[] = [];
  public readonly waterMesh: THREE.Mesh;
  public readonly missionBeacon: THREE.Group;

  public readonly sunLight: THREE.DirectionalLight;
  public readonly hemiLight: THREE.HemisphereLight;

  private readonly skyMesh: THREE.Mesh;
  private readonly skyMat: THREE.ShaderMaterial;
  private readonly sunDisc: THREE.Mesh;
  private readonly cloudsGroup = new THREE.Group();
  private readonly grassMesh: THREE.InstancedMesh;
  private readonly bambooMesh: THREE.InstancedMesh;
  private readonly grassShaderUniforms = { uTime: { value: 0 } };
  private readonly waterShaderUniforms = { uTime: { value: 0 } };
  private readonly bambooUniforms = { uTime: { value: 0 } };

  private petalPoints: THREE.Points | null = null;
  private petalPositions: Float32Array | null = null;
  private petalData: PetalParticle[] = [];
  private readonly petalCount = 320;

  private campFireLight: THREE.PointLight | null = null;
  private cycleTime = 0.28; // Start near golden sunset/late afternoon

  private readonly _sunsetSkyTop = new THREE.Color(0x1f2347);
  private readonly _sunsetSkyHorizon = new THREE.Color(0xd96b43);
  private readonly _nightSkyTop = new THREE.Color(0x060914);
  private readonly _nightSkyHorizon = new THREE.Color(0x162038);
  private readonly _daySkyTop = new THREE.Color(0x2d5488);
  private readonly _daySkyHorizon = new THREE.Color(0x9fb8c9);
  private readonly _tmpColorTop = new THREE.Color();
  private readonly _tmpColorHor = new THREE.Color();
  private readonly _tmpSunColor = new THREE.Color();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly tex: ProceduralTexturePack,
    settings: GameSettings
  ) {
    this.scene.add(this.group);

    // 1. Sky Dome
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x1f2347) },
        bottomColor: { value: new THREE.Color(0xd96b43) },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos).y;
          float t = pow(max(h, 0.0), 0.55);
          gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
        }
      `,
    });
    this.skyMesh = new THREE.Mesh(new THREE.SphereGeometry(380, 24, 16), this.skyMat);
    this.group.add(this.skyMesh);

    this.sunDisc = new THREE.Mesh(
      new THREE.CircleGeometry(14, 24),
      new THREE.MeshBasicMaterial({ color: 0xffb36b, fog: false })
    );
    this.group.add(this.sunDisc);

    // 2. Lighting Rig
    this.hemiLight = new THREE.HemisphereLight(0x8fa8c8, 0x2d241e, 0.75);
    this.group.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xffb878, 2.2);
    this.sunLight.castShadow = settings.shadows;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    const d = 44;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 160;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.group.add(this.sunLight);
    this.group.add(this.sunLight.target);

    // 3. Terrain & River
    this.buildTerrain();
    this.waterMesh = this.buildWater();
    this.group.add(this.waterMesh);

    // 4. Clouds
    this.buildClouds();

    // 5. Landmarks, Regions & Architecture
    this.buildBridges();
    this.buildVillage();
    this.buildCastle();
    this.buildAbandonedTemple();
    this.buildBanditCamp();
    this.buildMountainPath();
    this.buildInteractables();

    // 6. Instanced Foliage (Bamboo, Grass, Rocks, Cherry Blossom Trees)
    this.bambooMesh = this.buildBambooForest();
    this.grassMesh = this.buildGrassField();
    this.buildTreesAndRocks();

    // 7. Falling Cherry Blossom Petals
    this.buildPetals();

    // 8. Active Mission Beacon
    this.missionBeacon = this.buildMissionBeacon();
    this.group.add(this.missionBeacon);

    this.applySettings(settings);
  }

  private isOnDirtRoad(x: number, z: number): boolean {
    // Roads connecting Village (0,36) -> Temple (0,-112), -> Bamboo (102,10) via Bridge 1, -> Bandit (-92,86), -> Mountain (-108,-48)
    const distSeg = (px: number, pz: number, ax: number, az: number, bx: number, bz: number) => {
      const dx = bx - ax;
      const dz = bz - az;
      const lenSq = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lenSq));
      return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
    };

    const bridge1X = BRIDGES[0].x;
    const bridge2X = BRIDGES[1].x;

    return (
      distSeg(x, z, 0, 36, 0, -108) < 3.4 ||
      distSeg(x, z, 0, 36, bridge1X - 10, 24) < 3.0 ||
      distSeg(x, z, bridge1X + 10, 24, 102, 10) < 3.0 ||
      distSeg(x, z, 0, 36, -92, 86) < 3.0 ||
      distSeg(x, z, 0, -18, -108, -48) < 3.2 ||
      distSeg(x, z, 0, -55, bridge2X - 10, -55) < 2.8
    );
  }

  private buildTerrain(): void {
    const segs = 160;
    const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, segs, segs);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);

    const grassCol = new THREE.Color(0x3a4f2b);
    const forestGrass = new THREE.Color(0x2a4024);
    const dirtCol = new THREE.Color(0x634d36);
    const rockCol = new THREE.Color(0x4f4e4a);
    const sandCol = new THREE.Color(0x70634e);
    const tmp = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = getTerrainHeight(x, z);
      pos.setY(i, y);

      const riverDist = Math.abs(x - getRiverCenterX(z)) - getRiverHalfWidth(z);
      if (riverDist < 2.5) {
        tmp.copy(sandCol);
      } else if (this.isOnDirtRoad(x, z)) {
        tmp.copy(dirtCol);
      } else if (y > 8.2) {
        const rockMix = Math.min(1, (y - 8.2) / 10);
        tmp.copy(grassCol).lerp(rockCol, rockMix);
      } else if (x > 55) {
        tmp.copy(forestGrass);
      } else {
        tmp.copy(grassCol);
      }

      const jitter = (Math.sin(x * 0.27) * Math.cos(z * 0.23)) * 0.04;
      colors[i * 3] = Math.max(0, tmp.r + jitter);
      colors[i * 3 + 1] = Math.max(0, tmp.g + jitter);
      colors[i * 3 + 2] = Math.max(0, tmp.b + jitter);
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.94,
      metalness: 0.02,
      bumpMap: this.tex.groundDetail,
      bumpScale: 0.14,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  private buildWater(): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(42, TERRAIN_SIZE, 24, 120);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i);
      const z = pos.getZ(i);
      pos.setX(i, lx + getRiverCenterX(z));
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0x1b4554,
      roughness: 0.14,
      metalness: 0.55,
      transparent: true,
      opacity: 0.86,
    });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.waterShaderUniforms.uTime;
      shader.vertexShader = `uniform float uTime;\n` + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        transformed.y += sin(position.z * 0.35 + uTime * 2.1) * 0.05 + cos(position.x * 0.45 - uTime * 1.6) * 0.03;
        `
      );
    };

    const water = new THREE.Mesh(geo, mat);
    water.position.y = -0.38;
    water.receiveShadow = true;
    return water;
  }

  private buildClouds(): void {
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xf1e6db,
      roughness: 0.95,
      transparent: true,
      opacity: 0.72,
    });
    for (let i = 0; i < 16; i++) {
      const cluster = new THREE.Group();
      const puffs = 3 + (i % 3);
      for (let p = 0; p < puffs; p++) {
        const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(6 + (p % 2) * 3, 1), cloudMat);
        puff.position.set((p - 1) * 6.5, (p % 2) * 1.6, ((p * 3) % 4) - 2);
        puff.scale.set(1.5, 0.55, 1.1);
        cluster.add(puff);
      }
      cluster.position.set(
        ((i * 73) % 360) - 180,
        58 + (i % 4) * 7,
        ((i * 119) % 360) - 180
      );
      this.cloudsGroup.add(cluster);
    }
    this.group.add(this.cloudsGroup);
  }

  private buildBridges(): void {
    for (const b of BRIDGES) {
      const bridge = createWoodenBridge(this.tex, b.length, b.width);
      bridge.position.set(b.x, b.deckY, b.z);
      this.group.add(bridge);
    }
  }

  private placeOnGround(obj: THREE.Object3D, x: number, z: number, rotY = 0, colliderRadius = 0): void {
    obj.position.set(x, getTerrainHeight(x, z), z);
    obj.rotation.y = rotY;
    this.group.add(obj);
    if (colliderRadius > 0) {
      this.colliders.push({ x, z, r: colliderRadius });
    }
  }

  private buildVillage(): void {
    // Traditional wooden houses around Kurokawa Village
    const houseSpots: [number, number, number, number, number][] = [
      [-15, 28, Math.PI * 0.15, 7.5, 6.2],
      [16, 26, -Math.PI * 0.18, 7.2, 6.0],
      [-18, 48, Math.PI * 0.42, 8.0, 6.5],
      [18, 49, -Math.PI * 0.35, 7.2, 5.8],
      [-5, 60, Math.PI, 6.8, 5.8],
    ];
    for (const [hx, hz, rot, w, d] of houseSpots) {
      const house = createJapaneseHouse(this.tex, w, d);
      this.placeOnGround(house, hx, hz, rot, 4.1);
    }

    // Village entrance Torii Gate (North road toward Temple)
    const villageTorii = createToriiGate(1.0);
    this.placeOnGround(villageTorii, 0, 11, 0, 0);

    // Stone Lanterns along Village Main Road
    const lanternCoords: [number, number, boolean][] = [
      [-4.2, 16, true],
      [4.2, 16, false],
      [-4.8, 36, true],
      [4.8, 36, false],
      [35, 22, true],
      [70, 21, false],
    ];
    for (const [lx, lz, lit] of lanternCoords) {
      this.placeOnGround(createStoneLantern(lit), lx, lz, 0, 0.5);
    }

    // Small Farm Plot on south-east edge of Village
    const farmGroup = new THREE.Group();
    const fenceMat = new THREE.MeshStandardMaterial({ map: this.tex.woodAlbedo, roughness: 0.88 });
    const soilMat = new THREE.MeshStandardMaterial({ color: 0x3b2c1e, roughness: 0.95 });
    const cropMat = new THREE.MeshStandardMaterial({ color: 0x7a9638, roughness: 0.8 });
    for (let row = -2; row <= 2; row++) {
      const furrow = new THREE.Mesh(new THREE.BoxGeometry(9, 0.25, 0.9), soilMat);
      furrow.position.set(0, 0.12, row * 1.5);
      farmGroup.add(furrow);
      for (let c = -3; c <= 3; c++) {
        const stalk = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.75, 5), cropMat);
        stalk.position.set(c * 1.15, 0.55, row * 1.5);
        farmGroup.add(stalk);
      }
    }
    const fence1 = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.75, 0.14), fenceMat);
    fence1.position.set(0, 0.38, -4.4);
    farmGroup.add(fence1);
    const fence2 = fence1.clone();
    fence2.position.z = 4.4;
    farmGroup.add(fence2);
    this.placeOnGround(farmGroup, 14, 66, 0.12, 0);
  }

  private buildCastle(): void {
    const castle = createSamuraiCastle(this.tex);
    this.placeOnGround(castle, -28, 12, 0.35, 9.5);
  }

  private buildAbandonedTemple(): void {
    // Grand Torii approach
    this.placeOnGround(createToriiGate(1.25), 0, -68, 0, 0);
    this.placeOnGround(createToriiGate(1.1), 0, -88, 0, 0);

    for (const lz of [-74, -84, -96]) {
      this.placeOnGround(createStoneLantern(lz === -96), -5.5, lz, 0, 0.5);
      this.placeOnGround(createStoneLantern(lz === -96), 5.5, lz, 0, 0.5);
    }

    const temple = createAbandonedTemple(this.tex);
    this.placeOnGround(temple, 0, -118, 0, 7.6);
  }

  private buildBanditCamp(): void {
    const tentMat = new THREE.MeshStandardMaterial({ color: 0x574838, roughness: 0.9 });
    const poleMat = new THREE.MeshStandardMaterial({ map: this.tex.woodAlbedo, roughness: 0.85 });

    const tentCoords: [number, number, number][] = [
      [-104, 78, 0.6],
      [-102, 98, -0.4],
      [-78, 96, -1.1],
    ];
    for (const [tx, tz, rot] of tentCoords) {
      const tent = new THREE.Group();
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(3.4, 3.1, 5), tentMat);
      canopy.position.y = 1.55;
      canopy.castShadow = true;
      tent.add(canopy);
      const banner = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.2, 0.12), poleMat);
      banner.position.y = 2.1;
      tent.add(banner);
      this.placeOnGround(tent, tx, tz, rot, 2.5);
    }

    // Wooden palisade stakes around camp rim
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2;
      if (Math.abs(ang - 0.15) < 0.55) continue; // Entrance gap facing village
      const px = -92 + Math.cos(ang) * 20;
      const pz = 86 + Math.sin(ang) * 20;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.8, 0.45), poleMat);
      wall.position.y = 1.4;
      wall.castShadow = true;
      this.placeOnGround(wall, px, pz, -ang + Math.PI / 2, 1.5);
    }

    // Central Campfire
    const fireGroup = new THREE.Group();
    const logMat = new THREE.MeshStandardMaterial({ color: 0x2b1d14, roughness: 0.95 });
    for (let i = 0; i < 4; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 1.6, 6), logMat);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = (i * Math.PI) / 4;
      log.position.y = 0.14;
      fireGroup.add(log);
    }
    const embers = new THREE.Mesh(
      new THREE.ConeGeometry(0.45, 0.9, 6),
      new THREE.MeshBasicMaterial({ color: 0xff6b2b })
    );
    embers.position.y = 0.48;
    fireGroup.add(embers);
    this.campFireLight = new THREE.PointLight(0xff7722, 6, 22, 1.8);
    this.campFireLight.position.y = 1.2;
    fireGroup.add(this.campFireLight);
    this.placeOnGround(fireGroup, -92, 86, 0, 1.1);
  }

  private buildMountainPath(): void {
    // Torii gate marking the mountain ascent + summit shrine stone
    this.placeOnGround(createToriiGate(0.95), -68, -32, -Math.PI * 0.35, 0);
    this.placeOnGround(createStoneLantern(true), -98, -42, 0, 0.5);
    this.placeOnGround(createStoneLantern(true), -114, -56, 0, 0.5);
  }

  private buildBambooForest(): THREE.InstancedMesh {
    const count = 300;
    const geo = new THREE.CylinderGeometry(0.13, 0.18, 12.5, 6);
    geo.translate(0, 6.25, 0);

    const mat = new THREE.MeshStandardMaterial({
      color: 0x4d7c3f,
      roughness: 0.42,
      metalness: 0.05,
    });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.bambooUniforms.uTime;
      shader.vertexShader = `uniform float uTime;\n` + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        float sway = sin(uTime * 1.4 + float(gl_InstanceID) * 0.7) * 0.22 * (position.y / 12.5);
        transformed.x += sway;
        `
      );
    };

    const inst = new THREE.InstancedMesh(geo, mat, count);
    inst.castShadow = true;
    inst.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    let placed = 0;
    for (let i = 0; i < count * 2 && placed < count; i++) {
      const ang = (i * 2.39996) % (Math.PI * 2);
      const rad = 10 + ((i * 19.7) % 44);
      const x = 102 + Math.cos(ang) * rad;
      const z = 10 + Math.sin(ang) * rad;
      if (Math.hypot(x - 102, z - 10) < 7) continue; // Keep clearing open
      if (Math.abs(x - getRiverCenterX(z)) < getRiverHalfWidth(z) + 3) continue;

      dummy.position.set(x, getTerrainHeight(x, z) - 0.15, z);
      dummy.rotation.set(
        (Math.sin(i) * 0.05),
        (i * 1.3) % (Math.PI * 2),
        (Math.cos(i) * 0.05)
      );
      const s = 0.75 + ((i * 0.37) % 0.55);
      dummy.scale.set(s, 0.8 + ((i * 0.23) % 0.45), s);
      dummy.updateMatrix();
      inst.setMatrixAt(placed, dummy.matrix);

      col.setHSL(0.26 + ((i % 5) * 0.01), 0.38, 0.28 + ((i % 4) * 0.04));
      inst.setColorAt(placed, col);
      if (placed % 3 === 0) {
        this.colliders.push({ x, z, r: 0.32 });
      }
      placed++;
    }
    inst.count = placed;
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.computeBoundingSphere();
    this.group.add(inst);
    return inst;
  }

  private buildGrassField(): THREE.InstancedMesh {
    const count = 1600;
    const geo = new THREE.ConeGeometry(0.11, 0.72, 3);
    geo.translate(0, 0.36, 0);

    const mat = new THREE.MeshStandardMaterial({
      color: 0x4f6d34,
      roughness: 0.88,
    });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.grassShaderUniforms.uTime;
      shader.vertexShader = `uniform float uTime;\n` + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        float bend = sin(uTime * 2.2 + float(gl_InstanceID) * 0.31) * 0.18 * (position.y / 0.72);
        transformed.x += bend;
        `
      );
    };

    const inst = new THREE.InstancedMesh(geo, mat, count);
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    let placed = 0;

    for (let i = 0; i < count * 2 && placed < count; i++) {
      const rx = Math.sin(i * 12.9898) * 43758.5453;
      const rz = Math.sin(i * 78.233) * 23421.631;
      const x = ((rx - Math.floor(rx)) - 0.5) * 290;
      const z = ((rz - Math.floor(rz)) - 0.5) * 290;

      if (this.isOnDirtRoad(x, z)) continue;
      if (Math.abs(x - getRiverCenterX(z)) < getRiverHalfWidth(z) + 2) continue;
      const y = getTerrainHeight(x, z);
      if (y > 9.5) continue;

      dummy.position.set(x, y - 0.05, z);
      dummy.rotation.y = (i * 1.7) % (Math.PI * 2);
      const s = 0.75 + ((i % 7) * 0.12);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      inst.setMatrixAt(placed, dummy.matrix);

      col.setHSL(0.24 + ((i % 5) * 0.012), 0.34, 0.25 + ((i % 6) * 0.03));
      inst.setColorAt(placed, col);
      placed++;
    }
    inst.count = placed;
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.computeBoundingSphere();
    this.group.add(inst);
    return inst;
  }

  private buildTreesAndRocks(): void {
    // Cherry blossom trees in scenic Village, Temple, and Mountain spots
    const sakuraSpots: [number, number][] = [
      [-10, 20],
      [12, 34],
      [-24, 38],
      [14, 14],
      [-14, -104],
      [15, -104],
      [-18, -124],
      [18, -124],
      [-82, -32],
      [-118, -60],
      [78, 30],
    ];
    sakuraSpots.forEach(([sx, sz], idx) => {
      const tree = createCherryBlossomTree(idx);
      this.placeOnGround(tree, sx, sz, idx * 0.9, 0.65);
    });

    // Instanced Rocks
    const rockGeo = new THREE.DodecahedronGeometry(1.1, 0);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x575b5e,
      roughness: 0.9,
      flatShading: true,
    });
    const rockCount = 90;
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
    rocks.castShadow = true;
    rocks.receiveShadow = true;

    const dummy = new THREE.Object3D();
    let placed = 0;
    for (let i = 0; i < 180 && placed < rockCount; i++) {
      const ang = (i * 2.399) % (Math.PI * 2);
      const dist = 28 + ((i * 29) % 145);
      const x = Math.cos(ang) * dist;
      const z = Math.sin(ang) * dist;
      if (this.isOnDirtRoad(x, z)) continue;
      if (Math.hypot(x, z - 36) < 22) continue;
      if (Math.abs(x - getRiverCenterX(z)) < getRiverHalfWidth(z) - 1) continue;

      const s = 0.7 + ((i % 5) * 0.45);
      dummy.position.set(x, getTerrainHeight(x, z) + s * 0.25, z);
      dummy.rotation.set(i * 0.4, i * 1.1, 0);
      dummy.scale.set(s * 1.2, s * 0.85, s);
      dummy.updateMatrix();
      rocks.setMatrixAt(placed, dummy.matrix);
      this.colliders.push({ x, z, r: s * 0.95 });
      placed++;
    }
    rocks.count = placed;
    rocks.instanceMatrix.needsUpdate = true;
    rocks.computeBoundingSphere();
    this.group.add(rocks);

    // Instanced Mountain Pine Trees around perimeter & mountain path
    const pineGeo = new THREE.ConeGeometry(1.9, 6.2, 6);
    pineGeo.translate(0, 3.6, 0);
    const pineMat = new THREE.MeshStandardMaterial({ color: 0x1e3826, roughness: 0.88 });
    const pineCount = 110;
    const pines = new THREE.InstancedMesh(pineGeo, pineMat, pineCount);
    pines.castShadow = true;
    let pPlaced = 0;
    for (let i = 0; i < 220 && pPlaced < pineCount; i++) {
      const ang = (i * 1.91) % (Math.PI * 2);
      const dist = 70 + ((i * 37) % 110);
      const x = Math.cos(ang) * dist;
      const z = Math.sin(ang) * dist;
      if (Math.hypot(x - 102, z - 10) < 42) continue;
      if (Math.hypot(x + 92, z - 86) < 28) continue;
      if (Math.hypot(x, z + 112) < 28) continue;
      if (this.isOnDirtRoad(x, z)) continue;

      const s = 0.85 + ((i % 4) * 0.28);
      dummy.position.set(x, getTerrainHeight(x, z) - 0.3, z);
      dummy.rotation.set(0, i * 0.7, 0);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      pines.setMatrixAt(pPlaced, dummy.matrix);
      this.colliders.push({ x, z, r: 0.75 });
      pPlaced++;
    }
    pines.count = pPlaced;
    pines.instanceMatrix.needsUpdate = true;
    pines.computeBoundingSphere();
    this.group.add(pines);
  }

  private buildPetals(): void {
    const positions = new Float32Array(this.petalCount * 3);
    for (let i = 0; i < this.petalCount; i++) {
      const x = (Math.random() - 0.5) * 90;
      const y = 2 + Math.random() * 18;
      const z = (Math.random() - 0.5) * 90;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      this.petalData.push({
        x,
        y,
        z,
        vy: 0.8 + Math.random() * 0.9,
        vx: 0.6 + Math.random() * 0.8,
        vz: (Math.random() - 0.5) * 0.6,
        phase: Math.random() * Math.PI * 2,
      });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      map: this.tex.petalSprite,
      size: 0.45,
      transparent: true,
      depthWrite: false,
      alphaTest: 0.15,
    });
    this.petalPoints = new THREE.Points(geo, mat);
    this.petalPoints.frustumCulled = false;
    this.petalPositions = positions;
    this.group.add(this.petalPoints);
  }

  private buildMissionBeacon(): THREE.Group {
    const g = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.55, 28, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.24,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    beam.position.y = 14;
    g.add(beam);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.35, 24),
      new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.12;
    g.add(ring);
    g.visible = false;
    return g;
  }

  private buildInteractables(): void {
    // 1. Village Elder NPC
    const elder = createSamuraiCharacter('villager', this.tex.contactShadow);
    this.placeInteractable({
      id: 'npc_elder',
      kind: 'npc',
      label: 'Speak with Elder Kenji',
      sublabel: 'Village Leader',
      x: -3.5,
      z: 34,
      radius: 3.0,
      mesh: elder.root,
      npcRig: elder,
    });
    elder.root.rotation.y = Math.PI * 0.15;

    // 2. Village Blacksmith (Katana Upgrades)
    const smithGroup = new THREE.Group();
    const smith = createSamuraiCharacter('villager', this.tex.contactShadow);
    smithGroup.add(smith.root);
    const anvil = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.55, 0.45),
      new THREE.MeshStandardMaterial({ color: 0x2a2d32, metalness: 0.85, roughness: 0.35 })
    );
    anvil.position.set(1.1, 0.28, 0.2);
    smithGroup.add(anvil);
    this.placeInteractable({
      id: 'npc_blacksmith',
      kind: 'blacksmith',
      label: 'Forge Katana Upgrade',
      sublabel: 'Master Tetsuo',
      x: 10.5,
      z: 38,
      radius: 3.0,
      mesh: smithGroup,
      npcRig: smith,
    });

    // 3. Captive Villager inside Bandit Camp
    const captive = createSamuraiCharacter('villager', this.tex.contactShadow);
    this.placeInteractable({
      id: 'captive_villager',
      kind: 'captive',
      label: 'Rescue Captured Villager',
      sublabel: 'Clear nearby bandits first',
      x: -97,
      z: 93,
      radius: 3.2,
      mesh: captive.root,
      npcRig: captive,
    });

    // 4. Checkpoint / Healing Shrines (3 across the world)
    const shrineSpots: [string, string, number, number][] = [
      ['shrine_village', 'Kurokawa Shrine (Heal & Save)', 0, 44],
      ['shrine_bamboo', 'Bamboo Grove Shrine (Heal & Save)', 98, 12],
      ['shrine_temple', 'Kiyomizu Sanctuary (Heal & Save)', -12, -100],
    ];
    for (const [id, label, sx, sz] of shrineSpots) {
      const shrine = new THREE.Group();
      const plinth = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.9, 1.4),
        new THREE.MeshStandardMaterial({ map: this.tex.stoneAlbedo, roughness: 0.85 })
      );
      plinth.position.y = 0.45;
      shrine.add(plinth);
      const orb = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.32, 0),
        new THREE.MeshStandardMaterial({
          color: 0xfef08a,
          emissive: 0xf59e0b,
          emissiveIntensity: 1.6,
          roughness: 0.2,
        })
      );
      orb.position.y = 1.45;
      shrine.add(orb);
      this.placeInteractable({
        id,
        kind: 'shrine',
        label,
        sublabel: 'Restores Health & Saves Progress',
        x: sx,
        z: sz,
        radius: 3.0,
        mesh: shrine,
      });
    }

    // 5. Lost Katana Relic in Bamboo Forest hidden clearing
    const relicGroup = new THREE.Group();
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.7, 0.9, 8),
      new THREE.MeshStandardMaterial({ map: this.tex.stoneAlbedo, roughness: 0.8 })
    );
    pedestal.position.y = 0.45;
    relicGroup.add(pedestal);
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 1.25, 0.08),
      new THREE.MeshStandardMaterial({
        color: 0xfef3c7,
        emissive: 0xd97706,
        emissiveIntensity: 0.9,
        metalness: 0.95,
        roughness: 0.15,
      })
    );
    blade.position.y = 1.4;
    blade.rotation.z = 0.18;
    relicGroup.add(blade);
    this.placeInteractable({
      id: 'relic_lost_katana',
      kind: 'relic',
      label: 'Claim the Lost Katana',
      sublabel: 'Ancestral Shogunate Blade',
      x: 118,
      z: -12,
      radius: 3.0,
      mesh: relicGroup,
    });

    // 6. Collectible Coins & Healing Herbs scattered across regions
    const pickups: [string, 'pickup', string, number, number, number, number][] = [
      ['coin_1', 'pickup', 'Ancient Gold Pouch (+25 Gold)', 22, 30, 25, 0],
      ['coin_2', 'pickup', 'Ancient Gold Pouch (+25 Gold)', 68, 22, 25, 0],
      ['coin_3', 'pickup', 'Bandit Stash (+40 Gold)', -88, 76, 40, 0],
      ['coin_4', 'pickup', 'Temple Offering (+35 Gold)', 6, -110, 35, 0],
      ['heal_1', 'pickup', 'Medicinal Elixir (+1 Charge)', 86, 2, 0, 1],
      ['heal_2', 'pickup', 'Medicinal Elixir (+1 Charge)', -74, -22, 0, 1],
      ['heal_3', 'pickup', 'Medicinal Elixir (+1 Charge)', -94, 80, 0, 1],
    ];
    for (const [id, kind, label, px, pz, goldValue, healValue] of pickups) {
      const isHeal = healValue > 0;
      const mesh = new THREE.Mesh(
        isHeal ? new THREE.CylinderGeometry(0.24, 0.28, 0.55, 8) : new THREE.OctahedronGeometry(0.32, 0),
        new THREE.MeshStandardMaterial({
          color: isHeal ? 0x10b981 : 0xfbbf24,
          emissive: isHeal ? 0x059669 : 0xd97706,
          emissiveIntensity: 0.9,
          metalness: isHeal ? 0.2 : 0.9,
          roughness: 0.25,
        })
      );
      mesh.position.y = 0.65;
      this.placeInteractable({
        id,
        kind,
        label,
        x: px,
        z: pz,
        radius: 2.3,
        mesh,
        goldValue,
        healValue,
      });
    }
  }

  private placeInteractable(spec: Omit<WorldInteractable, 'y' | 'collected'>): void {
    const y = getTerrainHeight(spec.x, spec.z);
    spec.mesh.position.set(spec.x, y, spec.z);
    this.group.add(spec.mesh);
    this.interactables.push({
      ...spec,
      y,
      collected: false,
    });
  }

  public markCollected(id: string): void {
    const item = this.interactables.find((i) => i.id === id);
    if (item && !item.collected) {
      item.collected = true;
      item.mesh.visible = false;
    }
  }

  public setMissionMarker(pos: { x: number; z: number } | undefined): void {
    if (!pos) {
      this.missionBeacon.visible = false;
      return;
    }
    this.missionBeacon.visible = true;
    this.missionBeacon.position.set(pos.x, getTerrainHeight(pos.x, pos.z), pos.z);
  }

  public applySettings(settings: GameSettings): void {
    this.sunLight.castShadow = settings.shadows;
    if (this.petalPoints) {
      this.petalPoints.visible = settings.ambientEffects;
    }
    this.cloudsGroup.visible = settings.ambientEffects;
    this.grassMesh.visible = settings.quality !== 'low';
    const fogDensity = settings.drawDistance < 180 ? 0.009 : settings.drawDistance < 260 ? 0.0062 : 0.0045;
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = fogDensity;
    } else {
      this.scene.fog = new THREE.FogExp2(0x7c4a3e, fogDensity);
    }
  }

  public update(
    dt: number,
    elapsed: number,
    playerPos: THREE.Vector3,
    atmosphere: AtmosphereMode
  ): string {
    this.grassShaderUniforms.uTime.value = elapsed;
    this.waterShaderUniforms.uTime.value = elapsed;
    this.bambooUniforms.uTime.value = elapsed;

    // Update sky/sun cycle
    if (atmosphere === 'dynamic') {
      this.cycleTime = (this.cycleTime + dt * 0.0055) % 1;
    } else if (atmosphere === 'sunset') {
      this.cycleTime = 0.25;
    } else {
      this.cycleTime = 0.75;
    }

    // Smoothly blend Sunset (0.25) -> Night (0.75) -> Day/Golden (0.0/1.0)
    const nightMix = Math.max(0, Math.sin((this.cycleTime - 0.5) * Math.PI * 2) * 0.5 + 0.5);
    const sunsetMix = Math.max(0, 1 - Math.abs(this.cycleTime - 0.25) * 4);

    this._tmpColorTop.copy(this._daySkyTop).lerp(this._sunsetSkyTop, sunsetMix).lerp(this._nightSkyTop, nightMix);
    this._tmpColorHor.copy(this._daySkyHorizon).lerp(this._sunsetSkyHorizon, sunsetMix).lerp(this._nightSkyHorizon, nightMix);

    this.skyMat.uniforms.topColor.value.copy(this._tmpColorTop);
    this.skyMat.uniforms.bottomColor.value.copy(this._tmpColorHor);
    this.scene.background = this._tmpColorHor;
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(this._tmpColorHor);
    }

    const sunAngle = this.cycleTime * Math.PI * 2;
    const sunDirX = Math.cos(sunAngle) * 55;
    const sunDirY = Math.max(14, Math.sin(sunAngle) * 42 + 24);
    const sunDirZ = Math.sin(sunAngle) * 35 - 20;

    // Follow player with directional shadow camera for razor-sharp local shadows
    this.sunLight.position.set(playerPos.x + sunDirX, playerPos.y + sunDirY, playerPos.z + sunDirZ);
    this.sunLight.target.position.copy(playerPos);
    this.sunLight.target.updateMatrixWorld();

    this._tmpSunColor
      .setHex(0xffe0b2)
      .lerp(new THREE.Color(0xff7d47), sunsetMix)
      .lerp(new THREE.Color(0x6e89c4), nightMix);
    this.sunLight.color.copy(this._tmpSunColor);
    this.sunLight.intensity = 2.4 - nightMix * 1.45;
    this.hemiLight.intensity = 0.82 - nightMix * 0.42;

    this.sunDisc.position.set(sunDirX * 5.2, sunDirY * 3.5, sunDirZ * 5.2);
    this.sunDisc.lookAt(playerPos);
    (this.sunDisc.material as THREE.MeshBasicMaterial).color.setHex(nightMix > 0.55 ? 0xdbeafe : 0xffb36b);

    // Drift clouds gently
    for (let i = 0; i < this.cloudsGroup.children.length; i++) {
      const c = this.cloudsGroup.children[i];
      c.position.x += dt * (1.2 + (i % 3) * 0.4);
      if (c.position.x > 210) c.position.x = -210;
    }

    // Flicker campfire
    if (this.campFireLight) {
      this.campFireLight.intensity = 5.4 + Math.sin(elapsed * 14) * 1.1;
    }

    // Animate falling cherry blossom petals around the player
    if (this.petalPoints && this.petalPoints.visible && this.petalPositions) {
      for (let i = 0; i < this.petalCount; i++) {
        const p = this.petalData[i];
        p.y -= p.vy * dt;
        p.x += (p.vx + Math.sin(elapsed * 1.5 + p.phase) * 0.7) * dt;
        p.z += (p.vz + Math.cos(elapsed * 1.2 + p.phase) * 0.4) * dt;

        if (p.y < -1 || Math.hypot(p.x - playerPos.x, p.z - playerPos.z) > 65) {
          p.x = playerPos.x + (Math.random() - 0.5) * 85;
          p.z = playerPos.z + (Math.random() - 0.5) * 85;
          p.y = playerPos.y + 12 + Math.random() * 14;
        }
        this.petalPositions[i * 3] = p.x;
        this.petalPositions[i * 3 + 1] = p.y;
        this.petalPositions[i * 3 + 2] = p.z;
      }
      this.petalPoints.geometry.attributes.position.needsUpdate = true;
    }

    // Bob pickups & spin shrine orbs
    for (const item of this.interactables) {
      if (item.collected) continue;
      if (item.kind === 'pickup') {
        item.mesh.rotation.y += dt * 1.8;
        item.mesh.position.y = item.y + 0.65 + Math.sin(elapsed * 3 + item.x) * 0.14;
      } else if (item.kind === 'shrine' || item.kind === 'relic') {
        const orb = item.mesh.children[1];
        if (orb) {
          orb.rotation.y += dt * 1.4;
        }
      }
    }

    if (this.missionBeacon.visible) {
      this.missionBeacon.rotation.y += dt * 0.9;
    }

    return nightMix > 0.55 ? 'Nightfall' : sunsetMix > 0.4 ? 'Crimson Dusk' : 'Late Afternoon';
  }
}

export function getRegionDisplayName(region: RegionId): string {
  switch (region) {
    case 'village':
      return 'Kurokawa Village';
    case 'bamboo_forest':
      return 'Whispering Bamboo Grove';
    case 'temple':
      return 'Abandoned Kiyomizu Temple';
    case 'mountain_path':
      return 'Kurogane Mountain Path';
    case 'bandit_camp':
      return 'Crimson Skull Camp';
  }
}
