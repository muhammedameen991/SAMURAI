import * as THREE from 'three';
import { ProceduralTexturePack } from './textures';

export type SamuraiAppearance =
  | 'player'
  | 'rogue_samurai'
  | 'ronin'
  | 'bandit'
  | 'guard'
  | 'villager';

export interface ArticulatedCharacter {
  root: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  leftShoulder: THREE.Group;
  rightShoulder: THREE.Group;
  leftForearm: THREE.Group;
  rightForearm: THREE.Group;
  leftHip: THREE.Group;
  rightHip: THREE.Group;
  cloak: THREE.Mesh;
  katanaGroup: THREE.Group;
  telegraphRing: THREE.Mesh;
  hitFlashMaterials: THREE.MeshStandardMaterial[];
}

export function createSamuraiCharacter(
  appearance: SamuraiAppearance,
  contactShadowTex: THREE.Texture,
  scale = 1
): ArticulatedCharacter {
  const root = new THREE.Group();
  root.scale.setScalar(scale);

  const hitFlashMaterials: THREE.MeshStandardMaterial[] = [];

  const palette = {
    player: {
      armor: 0x15161a,
      cloth: 0x1d1a20,
      accent: 0xb91c1c,
      trim: 0xd4a441,
      skin: 0xd8b18d,
    },
    rogue_samurai: {
      armor: 0x241215,
      cloth: 0x191216,
      accent: 0xdc2626,
      trim: 0xe5b94c,
      skin: 0xcda37f,
    },
    ronin: {
      armor: 0x2a2f36,
      cloth: 0x2e2a27,
      accent: 0x7c2d12,
      trim: 0xa89262,
      skin: 0xd1a785,
    },
    bandit: {
      armor: 0x3b2c22,
      cloth: 0x29221d,
      accent: 0x991b1b,
      trim: 0x85755b,
      skin: 0xc99c78,
    },
    guard: {
      armor: 0x1e2530,
      cloth: 0x242c38,
      accent: 0x9a3412,
      trim: 0xc8a454,
      skin: 0xd4aa87,
    },
    villager: {
      armor: 0x4b5548,
      cloth: 0x5c4f41,
      accent: 0x9a6b42,
      trim: 0x8f8368,
      skin: 0xddb694,
    },
  }[appearance];

  const armorMat = new THREE.MeshStandardMaterial({
    color: palette.armor,
    roughness: 0.35,
    metalness: 0.65,
  });
  const clothMat = new THREE.MeshStandardMaterial({
    color: palette.cloth,
    roughness: 0.85,
    metalness: 0.05,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: palette.accent,
    roughness: 0.7,
    metalness: 0.12,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: palette.trim,
    roughness: 0.25,
    metalness: 0.88,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: palette.skin,
    roughness: 0.72,
    metalness: 0.02,
  });
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.16,
    metalness: 0.94,
  });
  hitFlashMaterials.push(armorMat, clothMat, accentMat);

  // Soft radial contact shadow on ground
  const shadowGeo = new THREE.PlaneGeometry(1.5, 1.5);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: contactShadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
  });
  const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.03;
  root.add(shadowPlane);

  // Telegraph / highlight ring under character feet
  const ringGeo = new THREE.RingGeometry(0.55, 0.72, 24);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const telegraphRing = new THREE.Mesh(ringGeo, ringMat);
  telegraphRing.rotation.x = -Math.PI / 2;
  telegraphRing.position.y = 0.05;
  root.add(telegraphRing);

  // Hips / Waist pivot (0.9m above ground)
  const hips = new THREE.Group();
  hips.position.y = 0.92;
  root.add(hips);

  // Pelvis + Hakama waist + Kusazuri armored tassets
  const pelvisMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.28), clothMat);
  pelvisMesh.castShadow = true;
  hips.add(pelvisMesh);

  const obiBelt = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.1, 0.31), accentMat);
  obiBelt.position.y = 0.08;
  hips.add(obiBelt);

  // Front/side tassets (kusazuri)
  for (const side of [-1, 1]) {
    const tasset = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 0.28), armorMat);
    tasset.position.set(side * 0.23, -0.1, 0);
    tasset.rotation.z = side * -0.16;
    tasset.castShadow = true;
    hips.add(tasset);
  }

  // Sheathed scabbard (saya) on left hip
  if (appearance !== 'villager') {
    const saya = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.92, 8), armorMat);
    saya.rotation.x = Math.PI * 0.38;
    saya.rotation.z = 0.12;
    saya.position.set(-0.26, -0.02, -0.1);
    hips.add(saya);
  }

  // Torso
  const torso = new THREE.Group();
  torso.position.y = 0.12;
  hips.add(torso);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.52, 0.3), armorMat);
  chest.position.y = 0.26;
  chest.castShadow = true;
  torso.add(chest);

  // Gold clan crest (Mon) on chest
  if (appearance === 'player' || appearance === 'rogue_samurai') {
    const crest = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 12), trimMat);
    crest.rotation.x = Math.PI / 2;
    crest.position.set(0, 0.34, 0.155);
    torso.add(crest);
  }

  // Crimson chest lacing bands (odoshi)
  for (let i = 0; i < 3; i++) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.475, 0.035, 0.312), accentMat);
    band.position.y = 0.14 + i * 0.11;
    torso.add(band);
  }

  // Flowing cloak / haori back drape
  const cloakGeo = new THREE.BoxGeometry(0.42, 0.68, 0.04);
  cloakGeo.translate(0, -0.34, 0);
  const cloak = new THREE.Mesh(cloakGeo, appearance === 'player' ? accentMat : clothMat);
  cloak.position.set(0, 0.48, -0.16);
  cloak.rotation.x = 0.12;
  cloak.castShadow = true;
  torso.add(cloak);

  // Head + Helmet
  const head = new THREE.Group();
  head.position.y = 0.58;
  torso.add(head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.145, 14, 12), skinMat);
  skull.position.y = 0.12;
  skull.castShadow = true;
  head.add(skull);

  if (appearance === 'player' || appearance === 'rogue_samurai') {
    // Menpo half-mask
    const menpo = new THREE.Mesh(new THREE.SphereGeometry(0.148, 12, 8, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.4), armorMat);
    menpo.position.y = 0.11;
    head.add(menpo);

    // Kabuto bowl
    const kabutoBowl = new THREE.Mesh(new THREE.SphereGeometry(0.175, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), armorMat);
    kabutoBowl.position.y = 0.15;
    kabutoBowl.castShadow = true;
    head.add(kabutoBowl);

    // Shikoro flared neck guard
    const shikoro = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.25, 0.14, 12, 1, true, Math.PI * 0.3, Math.PI * 1.4), armorMat);
    shikoro.position.y = 0.11;
    head.add(shikoro);

    // Golden Maedate crescent horns
    const maedate = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 6, 16, Math.PI * 1.15), trimMat);
    maedate.position.set(0, 0.25, 0.16);
    maedate.rotation.z = Math.PI * 0.92;
    head.add(maedate);
  } else if (appearance === 'ronin' || appearance === 'guard') {
    // Wide conical kasa / jingasa hat
    const hat = new THREE.Mesh(
      new THREE.ConeGeometry(appearance === 'ronin' ? 0.36 : 0.28, 0.16, 14),
      appearance === 'ronin' ? new THREE.MeshStandardMaterial({ color: 0xb89b6a, roughness: 0.88 }) : armorMat
    );
    hat.position.y = 0.26;
    hat.castShadow = true;
    head.add(hat);
  } else if (appearance === 'bandit') {
    // Red bandana headband
    const bandana = new THREE.Mesh(new THREE.CylinderGeometry(0.152, 0.152, 0.07, 12), accentMat);
    bandana.position.y = 0.18;
    head.add(bandana);
  } else {
    // Villager hair topknot
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), clothMat);
    hair.position.y = 0.13;
    head.add(hair);
    const knot = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.08, 8), clothMat);
    knot.position.set(0, 0.28, -0.05);
    head.add(knot);
  }

  // Arms
  const makeArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.29, 0.47, 0);
    torso.add(shoulder);

    if (appearance !== 'villager' && appearance !== 'bandit') {
      const sode = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.24), armorMat);
      sode.position.set(side * 0.04, -0.02, 0);
      sode.rotation.z = side * 0.22;
      sode.castShadow = true;
      shoulder.add(sode);
    }

    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.06, 0.28, 8), clothMat);
    upperArm.position.y = -0.14;
    upperArm.castShadow = true;
    shoulder.add(upperArm);

    const forearm = new THREE.Group();
    forearm.position.y = -0.28;
    shoulder.add(forearm);

    const lowerArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.052, 0.26, 8),
      appearance === 'villager' ? clothMat : armorMat
    );
    lowerArm.position.y = -0.13;
    lowerArm.castShadow = true;
    forearm.add(lowerArm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 8), skinMat);
    hand.position.y = -0.26;
    forearm.add(hand);

    return { shoulder, forearm };
  };

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  // Katana attached to right forearm hand
  const katanaGroup = new THREE.Group();
  katanaGroup.position.set(0, -0.26, 0.02);
  katanaGroup.rotation.x = Math.PI * 0.48;
  rightArm.forearm.add(katanaGroup);

  if (appearance !== 'villager') {
    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.26, 8), clothMat);
    katanaGroup.add(hilt);

    const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.018, 12), trimMat);
    tsuba.position.y = 0.13;
    katanaGroup.add(tsuba);

    // Slightly curved katana blade built from a tapered blade profile
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.88, 0.042), steelMat);
    blade.position.set(0, 0.58, 0.01);
    blade.rotation.x = -0.025;
    blade.castShadow = true;
    katanaGroup.add(blade);
  }

  // Legs
  const makeLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.13, -0.06, 0);
    hips.add(hip);

    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.078, 0.42, 8), clothMat);
    thigh.position.y = -0.21;
    thigh.castShadow = true;
    hip.add(thigh);

    const shin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.072, 0.058, 0.42, 8),
      appearance === 'villager' ? clothMat : armorMat
    );
    shin.position.y = -0.6;
    shin.castShadow = true;
    hip.add(shin);

    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.22), clothMat);
    foot.position.set(0, -0.82, 0.04);
    hip.add(foot);

    return hip;
  };

  const leftHip = makeLeg(-1);
  const rightHip = makeLeg(1);

  return {
    root,
    hips,
    torso,
    head,
    leftShoulder: leftArm.shoulder,
    rightShoulder: rightArm.shoulder,
    leftForearm: leftArm.forearm,
    rightForearm: rightArm.forearm,
    leftHip,
    rightHip,
    cloak,
    katanaGroup,
    telegraphRing,
    hitFlashMaterials,
  };
}

export function createJapaneseHouse(tex: ProceduralTexturePack, width = 7.5, depth = 6.5): THREE.Group {
  const g = new THREE.Group();

  const stoneMat = new THREE.MeshStandardMaterial({
    map: tex.stoneAlbedo,
    bumpMap: tex.stoneBump,
    bumpScale: 0.05,
    roughness: 0.88,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    map: tex.woodAlbedo,
    bumpMap: tex.woodBump,
    bumpScale: 0.03,
    roughness: 0.78,
  });
  const wallMat = new THREE.MeshStandardMaterial({
    map: tex.shojiAlbedo,
    roughness: 0.9,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    map: tex.roofTileAlbedo,
    roughness: 0.48,
    metalness: 0.15,
  });

  // Stone foundation plinth
  const base = new THREE.Mesh(new THREE.BoxGeometry(width + 0.8, 0.65, depth + 0.8), stoneMat);
  base.position.y = 0.32;
  base.receiveShadow = true;
  base.castShadow = true;
  g.add(base);

  // Main shoji & plaster body
  const walls = new THREE.Mesh(new THREE.BoxGeometry(width, 3.0, depth), wallMat);
  walls.position.y = 2.1;
  walls.castShadow = true;
  walls.receiveShadow = true;
  g.add(walls);

  // Timber corner pillars & veranda beams
  const corners = [
    [-width / 2, -depth / 2],
    [width / 2, -depth / 2],
    [-width / 2, depth / 2],
    [width / 2, depth / 2],
  ];
  for (const [cx, cz] of corners) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.1, 0.28), woodMat);
    pillar.position.set(cx, 2.15, cz);
    pillar.castShadow = true;
    g.add(pillar);
  }

  // Front wooden veranda deck
  const deck = new THREE.Mesh(new THREE.BoxGeometry(width + 0.4, 0.18, 1.3), woodMat);
  deck.position.set(0, 0.68, depth / 2 + 0.55);
  deck.receiveShadow = true;
  g.add(deck);

  // Two-tier sloped Kawara roof (front & back flared eaves + ridge)
  const roofLower = new THREE.Mesh(new THREE.ConeGeometry(Math.max(width, depth) * 0.86, 2.2, 4), roofMat);
  roofLower.rotation.y = Math.PI / 4;
  roofLower.scale.set(1.12, 1, depth / width);
  roofLower.position.y = 4.65;
  roofLower.castShadow = true;
  roofLower.receiveShadow = true;
  g.add(roofLower);

  const ridge = new THREE.Mesh(new THREE.BoxGeometry(width * 0.65, 0.34, 0.36), woodMat);
  ridge.position.y = 5.65;
  g.add(ridge);

  return g;
}

export function createSamuraiCastle(tex: ProceduralTexturePack): THREE.Group {
  const g = new THREE.Group();

  const stoneMat = new THREE.MeshStandardMaterial({
    map: tex.stoneAlbedo,
    bumpMap: tex.stoneBump,
    bumpScale: 0.08,
    roughness: 0.86,
  });
  const plasterMat = new THREE.MeshStandardMaterial({ color: 0xe7e1d4, roughness: 0.85 });
  const timberMat = new THREE.MeshStandardMaterial({ map: tex.woodAlbedo, roughness: 0.72 });
  const roofMat = new THREE.MeshStandardMaterial({
    map: tex.roofTileAlbedo,
    roughness: 0.42,
    metalness: 0.22,
  });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.25, metalness: 0.9 });

  // Massive sloped stone rampart (Ishigaki)
  const rampart = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 11.2, 5.5, 4), stoneMat);
  rampart.rotation.y = Math.PI / 4;
  rampart.position.y = 2.75;
  rampart.castShadow = true;
  rampart.receiveShadow = true;
  g.add(rampart);

  // Three-tiered Tenshu Keep
  const tiers = [
    { size: 9.6, h: 4.2, y: 7.4, roofR: 8.6 },
    { size: 7.2, h: 3.6, y: 11.4, roofR: 6.6 },
    { size: 4.8, h: 3.2, y: 15.0, roofR: 4.8 },
  ];

  tiers.forEach((t, idx) => {
    const body = new THREE.Mesh(new THREE.BoxGeometry(t.size, t.h, t.size), plasterMat);
    body.position.y = t.y;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);

    const trim = new THREE.Mesh(new THREE.BoxGeometry(t.size + 0.18, 0.35, t.size + 0.18), timberMat);
    trim.position.y = t.y - t.h * 0.35;
    g.add(trim);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(t.roofR, idx === 2 ? 2.8 : 2.1, 4), roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = t.y + t.h * 0.5 + (idx === 2 ? 1.2 : 0.7);
    roof.castShadow = true;
    g.add(roof);
  });

  // Top ridge & Golden Shachihoko finials
  const topRidge = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.4, 0.45), timberMat);
  topRidge.position.y = 19.0;
  g.add(topRidge);

  for (const s of [-1.35, 1.35]) {
    const finial = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.9, 6), goldMat);
    finial.position.set(s, 19.55, 0);
    g.add(finial);
  }

  return g;
}

export function createAbandonedTemple(tex: ProceduralTexturePack): THREE.Group {
  const g = new THREE.Group();

  const stoneMat = new THREE.MeshStandardMaterial({
    map: tex.stoneAlbedo,
    color: 0x8b9288,
    roughness: 0.92,
  });
  const agedWood = new THREE.MeshStandardMaterial({
    map: tex.woodAlbedo,
    color: 0x61554a,
    roughness: 0.85,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    map: tex.roofTileAlbedo,
    color: 0x2d3733,
    roughness: 0.55,
    metalness: 0.15,
  });

  // Raised stone terrace + steps
  const platform = new THREE.Mesh(new THREE.BoxGeometry(15, 1.4, 13), stoneMat);
  platform.position.y = 0.7;
  platform.receiveShadow = true;
  platform.castShadow = true;
  g.add(platform);

  const stairs = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.7, 2.2), stoneMat);
  stairs.position.set(0, 0.35, 7.2);
  stairs.receiveShadow = true;
  g.add(stairs);

  // Inner sanctum walls (open front colonnade)
  const sanctum = new THREE.Mesh(new THREE.BoxGeometry(10.5, 4.6, 7.2), agedWood);
  sanctum.position.set(0, 3.7, -1.2);
  sanctum.castShadow = true;
  sanctum.receiveShadow = true;
  g.add(sanctum);

  // 4 grand front pillars
  for (const px of [-5.4, -2.2, 2.2, 5.4]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 4.8, 10), agedWood);
    pillar.position.set(px, 3.8, 4.2);
    pillar.castShadow = true;
    g.add(pillar);
  }

  // Sweeping double-tiered temple roof
  const lowerRoof = new THREE.Mesh(new THREE.ConeGeometry(12.2, 2.6, 4), roofMat);
  lowerRoof.rotation.y = Math.PI / 4;
  lowerRoof.scale.set(1.18, 1, 0.96);
  lowerRoof.position.y = 7.1;
  lowerRoof.castShadow = true;
  g.add(lowerRoof);

  const upperRoof = new THREE.Mesh(new THREE.ConeGeometry(8.2, 2.4, 4), roofMat);
  upperRoof.rotation.y = Math.PI / 4;
  upperRoof.scale.set(1.2, 1, 0.9);
  upperRoof.position.y = 8.9;
  upperRoof.castShadow = true;
  g.add(upperRoof);

  return g;
}

export function createToriiGate(scale = 1): THREE.Group {
  const g = new THREE.Group();
  g.scale.setScalar(scale);

  const vermilion = new THREE.MeshStandardMaterial({
    color: 0xb91c1c,
    roughness: 0.48,
    metalness: 0.08,
  });
  const blackStone = new THREE.MeshStandardMaterial({
    color: 0x1c1917,
    roughness: 0.82,
    metalness: 0.1,
  });
  const gold = new THREE.MeshStandardMaterial({
    color: 0xd4a441,
    roughness: 0.3,
    metalness: 0.85,
  });

  // Left & Right Pillars + Base Stones
  for (const sx of [-2.4, 2.4]) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.75, 10), blackStone);
    base.position.set(sx, 0.37, 0);
    base.castShadow = true;
    g.add(base);

    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.31, 5.4, 12), vermilion);
    pillar.position.set(sx, 3.0, 0);
    pillar.castShadow = true;
    g.add(pillar);
  }

  // Nuki lower tie-beam
  const nuki = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.36, 0.3), vermilion);
  nuki.position.y = 4.55;
  nuki.castShadow = true;
  g.add(nuki);

  // Kasagi top lintel + dark cap
  const kasagi = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.44, 0.56), vermilion);
  kasagi.position.y = 5.65;
  kasagi.castShadow = true;
  g.add(kasagi);

  const cap = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.22, 0.64), blackStone);
  cap.position.y = 5.92;
  g.add(cap);

  // Center plaque (Gakuzuka)
  const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.8, 0.24), blackStone);
  plaque.position.y = 5.05;
  g.add(plaque);

  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.66, 0.27), gold);
  frame.position.y = 5.05;
  g.add(frame);

  return g;
}

export function createStoneLantern(withLight = false): THREE.Group {
  const g = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6b7075, roughness: 0.9 });
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0xffd27d,
    emissive: 0xff9a2e,
    emissiveIntensity: 2.0,
    roughness: 0.4,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.46, 0.35, 6), stoneMat);
  base.position.y = 0.17;
  g.add(base);

  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 1.35, 8), stoneMat);
  post.position.y = 1.02;
  post.castShadow = true;
  g.add(post);

  const fireBox = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.44, 0.42), glowMat);
  fireBox.position.y = 1.88;
  g.add(fireBox);

  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.42, 6), stoneMat);
  cap.position.y = 2.3;
  cap.castShadow = true;
  g.add(cap);

  if (withLight) {
    const pl = new THREE.PointLight(0xffa43b, 4.5, 16, 1.8);
    pl.position.y = 1.9;
    g.add(pl);
  }

  return g;
}

export function createWoodenBridge(tex: ProceduralTexturePack, length: number, width: number): THREE.Group {
  const g = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({
    map: tex.woodAlbedo,
    bumpMap: tex.woodBump,
    bumpScale: 0.03,
    roughness: 0.8,
  });
  const redRail = new THREE.MeshStandardMaterial({ color: 0x8b1e1e, roughness: 0.62 });

  const segments = 12;
  const segLen = length / segments;
  for (let i = 0; i < segments; i++) {
    const t = (i + 0.5) / segments;
    const x = (t - 0.5) * length;
    const archY = Math.cos((x / (length * 0.5)) * (Math.PI * 0.5)) * 1.15;

    const plank = new THREE.Mesh(new THREE.BoxGeometry(segLen * 0.96, 0.24, width), woodMat);
    plank.position.set(x, archY, 0);
    plank.receiveShadow = true;
    plank.castShadow = true;
    g.add(plank);

    for (const sz of [-width / 2 + 0.18, width / 2 - 0.18]) {
      if (i % 2 === 0) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.95, 0.18), redRail);
        post.position.set(x, archY + 0.52, sz);
        post.castShadow = true;
        g.add(post);
      }
      const rail = new THREE.Mesh(new THREE.BoxGeometry(segLen * 1.04, 0.12, 0.14), redRail);
      rail.position.set(x, archY + 0.9, sz);
      g.add(rail);
    }
  }

  // Bridge support pilings into river bed
  for (const px of [-length * 0.32, length * 0.32]) {
    for (const pz of [-width * 0.4, width * 0.4]) {
      const piling = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 3.8, 8), woodMat);
      piling.position.set(px, -1.3, pz);
      g.add(piling);
    }
  }

  return g;
}

export function createCherryBlossomTree(seed: number): THREE.Group {
  const g = new THREE.Group();
  const barkMat = new THREE.MeshStandardMaterial({ color: 0x3b2820, roughness: 0.92 });
  const blossomMat = new THREE.MeshStandardMaterial({
    color: seed % 2 === 0 ? 0xf7b2c6 : 0xf49bb6,
    roughness: 0.78,
  });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.44, 3.2, 8), barkMat);
  trunk.position.y = 1.6;
  trunk.rotation.z = ((seed % 5) - 2) * 0.04;
  trunk.castShadow = true;
  g.add(trunk);

  const offsets = [
    [0, 3.9, 0, 1.85],
    [-1.25, 3.45, 0.7, 1.35],
    [1.3, 3.55, -0.65, 1.4],
    [0.3, 4.35, 1.1, 1.25],
    [-0.5, 3.8, -1.1, 1.2],
  ];
  for (const [bx, by, bz, r] of offsets) {
    const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), blossomMat);
    canopy.position.set(bx, by, bz);
    canopy.scale.set(1.15, 0.78, 1.15);
    canopy.castShadow = true;
    canopy.receiveShadow = true;
    g.add(canopy);
  }

  return g;
}
