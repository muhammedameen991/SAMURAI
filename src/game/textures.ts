import * as THREE from 'three';

export interface ProceduralTexturePack {
  woodAlbedo: THREE.CanvasTexture;
  woodBump: THREE.CanvasTexture;
  roofTileAlbedo: THREE.CanvasTexture;
  stoneAlbedo: THREE.CanvasTexture;
  stoneBump: THREE.CanvasTexture;
  shojiAlbedo: THREE.CanvasTexture;
  groundDetail: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  petalSprite: THREE.CanvasTexture;
  sparkSprite: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTexturePack {
  // 1. Timber Wood Albedo + Bump
  const [woodC, wCtx] = makeCanvas(256, 256);
  wCtx.fillStyle = '#4a3121';
  wCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 120; i++) {
    const y = (i / 120) * 256;
    const shade = 28 + Math.floor(Math.sin(i * 0.7) * 14 + Math.random() * 12);
    wCtx.fillStyle = `rgb(${shade + 35}, ${shade + 16}, ${shade + 4})`;
    wCtx.fillRect(0, y, 256, 2 + Math.random() * 2);
  }
  wCtx.strokeStyle = 'rgba(20,10,5,0.45)';
  wCtx.lineWidth = 2;
  for (let p = 0; p < 4; p++) {
    wCtx.beginPath();
    wCtx.moveTo(0, p * 64);
    wCtx.lineTo(256, p * 64);
    wCtx.stroke();
  }
  const woodAlbedo = new THREE.CanvasTexture(woodC);
  woodAlbedo.colorSpace = THREE.SRGBColorSpace;
  woodAlbedo.wrapS = woodAlbedo.wrapT = THREE.RepeatWrapping;
  woodAlbedo.anisotropy = maxAnisotropy;

  const [woodBC, wbCtx] = makeCanvas(256, 256);
  wbCtx.fillStyle = '#808080';
  wbCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) {
    const v = 100 + Math.floor(Math.random() * 60);
    wbCtx.fillStyle = `rgb(${v},${v},${v})`;
    wbCtx.fillRect(0, (i / 90) * 256, 256, 2);
  }
  const woodBump = new THREE.CanvasTexture(woodBC);
  woodBump.wrapS = woodBump.wrapT = THREE.RepeatWrapping;

  // 2. Kawara Roof Tiles
  const [roofC, rCtx] = makeCanvas(256, 256);
  rCtx.fillStyle = '#252930';
  rCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    for (let x = 0; x < 256; x += 32) {
      const grad = rCtx.createLinearGradient(x, y, x + 32, y);
      grad.addColorStop(0, '#1b1e24');
      grad.addColorStop(0.5, '#343a44');
      grad.addColorStop(1, '#1a1d22');
      rCtx.fillStyle = grad;
      rCtx.fillRect(x, y, 30, 30);
    }
  }
  const roofTileAlbedo = new THREE.CanvasTexture(roofC);
  roofTileAlbedo.colorSpace = THREE.SRGBColorSpace;
  roofTileAlbedo.wrapS = roofTileAlbedo.wrapT = THREE.RepeatWrapping;
  roofTileAlbedo.repeat.set(3, 2);
  roofTileAlbedo.anisotropy = maxAnisotropy;

  // 3. Stone Masonry (Ishigaki)
  const [stoneC, sCtx] = makeCanvas(256, 256);
  sCtx.fillStyle = '#4f5256';
  sCtx.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 8; row++) {
    const offset = (row % 2) * 24;
    for (let col = -1; col < 6; col++) {
      const shade = 74 + Math.floor(Math.random() * 34);
      sCtx.fillStyle = `rgb(${shade}, ${shade + 2}, ${shade + 5})`;
      sCtx.fillRect(col * 48 + offset + 2, row * 32 + 2, 44, 28);
    }
  }
  const stoneAlbedo = new THREE.CanvasTexture(stoneC);
  stoneAlbedo.colorSpace = THREE.SRGBColorSpace;
  stoneAlbedo.wrapS = stoneAlbedo.wrapT = THREE.RepeatWrapping;
  stoneAlbedo.anisotropy = maxAnisotropy;

  const [stoneBC, sbCtx] = makeCanvas(256, 256);
  sbCtx.fillStyle = '#404040';
  sbCtx.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 8; row++) {
    const offset = (row % 2) * 24;
    for (let col = -1; col < 6; col++) {
      const v = 135 + Math.floor(Math.random() * 55);
      sbCtx.fillStyle = `rgb(${v},${v},${v})`;
      sbCtx.fillRect(col * 48 + offset + 3, row * 32 + 3, 42, 26);
    }
  }
  const stoneBump = new THREE.CanvasTexture(stoneBC);
  stoneBump.wrapS = stoneBump.wrapT = THREE.RepeatWrapping;

  // 4. Shoji Paper Screen
  const [shojiC, shCtx] = makeCanvas(256, 256);
  shCtx.fillStyle = '#e8dfc8';
  shCtx.fillRect(0, 0, 256, 256);
  shCtx.strokeStyle = '#3a2618';
  shCtx.lineWidth = 8;
  shCtx.strokeRect(4, 4, 248, 248);
  shCtx.lineWidth = 4;
  for (let i = 1; i < 4; i++) {
    shCtx.beginPath();
    shCtx.moveTo(i * 64, 0);
    shCtx.lineTo(i * 64, 256);
    shCtx.moveTo(0, i * 64);
    shCtx.lineTo(256, i * 64);
    shCtx.stroke();
  }
  const shojiAlbedo = new THREE.CanvasTexture(shojiC);
  shojiAlbedo.colorSpace = THREE.SRGBColorSpace;
  shojiAlbedo.anisotropy = maxAnisotropy;

  // 5. Ground Detail Noise
  const [groundC, gCtx] = makeCanvas(256, 256);
  gCtx.fillStyle = '#8b8b8b';
  gCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) {
    const v = 110 + Math.floor(Math.random() * 55);
    gCtx.fillStyle = `rgb(${v},${v},${v})`;
    gCtx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const groundDetail = new THREE.CanvasTexture(groundC);
  groundDetail.wrapS = groundDetail.wrapT = THREE.RepeatWrapping;
  groundDetail.repeat.set(36, 36);

  // 6. Soft Radial Contact Shadow
  const [csC, csCtx] = makeCanvas(128, 128);
  const csGrad = csCtx.createRadialGradient(64, 64, 6, 64, 64, 60);
  csGrad.addColorStop(0, 'rgba(0,0,0,0.62)');
  csGrad.addColorStop(0.55, 'rgba(0,0,0,0.24)');
  csGrad.addColorStop(1, 'rgba(0,0,0,0)');
  csCtx.fillStyle = csGrad;
  csCtx.fillRect(0, 0, 128, 128);
  const contactShadow = new THREE.CanvasTexture(csC);
  contactShadow.colorSpace = THREE.SRGBColorSpace;

  // 7. Cherry Blossom Petal Sprite
  const [petC, pCtx] = makeCanvas(64, 64);
  pCtx.clearRect(0, 0, 64, 64);
  pCtx.fillStyle = '#f9c2d1';
  pCtx.beginPath();
  pCtx.moveTo(32, 8);
  pCtx.quadraticCurveTo(54, 22, 46, 50);
  pCtx.lineTo(32, 44);
  pCtx.lineTo(18, 50);
  pCtx.quadraticCurveTo(10, 22, 32, 8);
  pCtx.fill();
  const petalSprite = new THREE.CanvasTexture(pCtx.canvas);
  petalSprite.colorSpace = THREE.SRGBColorSpace;

  // 8. Spark Glow Sprite
  const [spC, spCtx] = makeCanvas(64, 64);
  const spGrad = spCtx.createRadialGradient(32, 32, 2, 32, 32, 30);
  spGrad.addColorStop(0, 'rgba(255,255,220,1)');
  spGrad.addColorStop(0.35, 'rgba(255,190,70,0.85)');
  spGrad.addColorStop(1, 'rgba(255,90,20,0)');
  spCtx.fillStyle = spGrad;
  spCtx.fillRect(0, 0, 64, 64);
  const sparkSprite = new THREE.CanvasTexture(spC);
  sparkSprite.colorSpace = THREE.SRGBColorSpace;

  return {
    woodAlbedo,
    woodBump,
    roofTileAlbedo,
    stoneAlbedo,
    stoneBump,
    shojiAlbedo,
    groundDetail,
    contactShadow,
    petalSprite,
    sparkSprite,
    dispose: () => {
      woodAlbedo.dispose();
      woodBump.dispose();
      roofTileAlbedo.dispose();
      stoneAlbedo.dispose();
      stoneBump.dispose();
      shojiAlbedo.dispose();
      groundDetail.dispose();
      contactShadow.dispose();
      petalSprite.dispose();
      sparkSprite.dispose();
    },
  };
}
