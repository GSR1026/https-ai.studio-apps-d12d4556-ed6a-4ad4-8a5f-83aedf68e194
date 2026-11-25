import * as THREE from 'three';

export interface ProceduralTextures {
  roadMap: THREE.CanvasTexture;
  roadBump: THREE.CanvasTexture;
  buildingMap: THREE.CanvasTexture;
  armorBump: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  holoAd1: THREE.CanvasTexture;
  holoAd2: THREE.CanvasTexture;
  dispose: () => void;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextures {
  // 1. Futuristic cyber-asphalt road & plaza grid
  const roadCanvas = document.createElement('canvas');
  roadCanvas.width = 512;
  roadCanvas.height = 512;
  const rctx = roadCanvas.getContext('2d')!;
  rctx.fillStyle = '#111b30';
  rctx.fillRect(0, 0, 512, 512);
  // Subtle panel seams
  rctx.strokeStyle = 'rgba(0, 217, 255, 0.26)';
  rctx.lineWidth = 2;
  for (let i = 0; i <= 512; i += 64) {
    rctx.beginPath();
    rctx.moveTo(i, 0);
    rctx.lineTo(i, 512);
    rctx.stroke();
    rctx.beginPath();
    rctx.moveTo(0, i);
    rctx.lineTo(512, i);
    rctx.stroke();
  }
  // Center dashed lane accent + outer curb stripes
  rctx.fillStyle = 'rgba(0, 217, 255, 0.72)';
  for (let y = 12; y < 512; y += 64) {
    rctx.fillRect(251, y, 10, 36);
  }
  rctx.fillStyle = 'rgba(168, 85, 247, 0.55)';
  rctx.fillRect(16, 0, 6, 512);
  rctx.fillRect(490, 0, 6, 512);
  // Micro grit speckles
  for (let i = 0; i < 1400; i++) {
    const x = (i * 73) % 512;
    const y = (i * 139) % 512;
    rctx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.22)';
    rctx.fillRect(x, y, 2, 2);
  }
  const roadMap = new THREE.CanvasTexture(roadCanvas);
  roadMap.colorSpace = THREE.SRGBColorSpace;
  roadMap.wrapS = THREE.RepeatWrapping;
  roadMap.wrapT = THREE.RepeatWrapping;
  roadMap.repeat.set(3, 16);
  roadMap.anisotropy = maxAnisotropy;

  // 2. Road bump / micro-relief
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 256;
  bumpCanvas.height = 256;
  const bctx = bumpCanvas.getContext('2d')!;
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 256, 256);
  bctx.strokeStyle = '#383838';
  bctx.lineWidth = 3;
  for (let i = 0; i <= 256; i += 32) {
    bctx.beginPath();
    bctx.moveTo(i, 0);
    bctx.lineTo(i, 256);
    bctx.stroke();
    bctx.beginPath();
    bctx.moveTo(0, i);
    bctx.lineTo(256, i);
    bctx.stroke();
  }
  const roadBump = new THREE.CanvasTexture(bumpCanvas);
  roadBump.wrapS = THREE.RepeatWrapping;
  roadBump.wrapT = THREE.RepeatWrapping;
  roadBump.repeat.set(6, 24);
  roadBump.anisotropy = maxAnisotropy;

  // 3. Skyscraper modular facade with glowing windows
  const bldCanvas = document.createElement('canvas');
  bldCanvas.width = 256;
  bldCanvas.height = 512;
  const blctx = bldCanvas.getContext('2d')!;
  blctx.fillStyle = '#121d36';
  blctx.fillRect(0, 0, 256, 512);
  // Structural ribs
  blctx.fillStyle = '#1d2d4e';
  for (let x = 0; x < 256; x += 32) {
    blctx.fillRect(x, 0, 5, 512);
  }
  for (let y = 0; y < 512; y += 24) {
    blctx.fillRect(0, y, 256, 3);
  }
  // Lit cyber windows
  for (let row = 0; row < 20; row++) {
    for (let col = 0; col < 8; col++) {
      const seed = (row * 31 + col * 17) % 10;
      if (seed < 4) {
        blctx.fillStyle = seed === 0 ? '#00D9FF' : seed === 1 ? '#38bdf8' : '#0284c7';
        blctx.fillRect(col * 32 + 8, row * 24 + 6, 17, 11);
      } else if (seed === 7) {
        blctx.fillStyle = '#A855F7';
        blctx.fillRect(col * 32 + 8, row * 24 + 6, 17, 11);
      } else if (seed === 8) {
        blctx.fillStyle = '#FFC857';
        blctx.fillRect(col * 32 + 8, row * 24 + 6, 17, 11);
      } else {
        blctx.fillStyle = '#091022';
        blctx.fillRect(col * 32 + 8, row * 24 + 6, 17, 11);
      }
    }
  }
  const buildingMap = new THREE.CanvasTexture(bldCanvas);
  buildingMap.colorSpace = THREE.SRGBColorSpace;
  buildingMap.wrapS = THREE.RepeatWrapping;
  buildingMap.wrapT = THREE.RepeatWrapping;
  buildingMap.anisotropy = maxAnisotropy;

  // 4. Brushed metal armor bump
  const armorCanvas = document.createElement('canvas');
  armorCanvas.width = 128;
  armorCanvas.height = 128;
  const actx = armorCanvas.getContext('2d')!;
  actx.fillStyle = '#888888';
  actx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 2) {
    actx.fillStyle = y % 4 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    actx.fillRect(0, y, 128, 1);
  }
  const armorBump = new THREE.CanvasTexture(armorCanvas);
  armorBump.wrapS = THREE.RepeatWrapping;
  armorBump.wrapT = THREE.RepeatWrapping;

  // 5. Radial contact shadow disc
  const shCanvas = document.createElement('canvas');
  shCanvas.width = 128;
  shCanvas.height = 128;
  const sctx = shCanvas.getContext('2d')!;
  const grad = sctx.createRadialGradient(64, 64, 4, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.32)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 128, 128);
  const contactShadow = new THREE.CanvasTexture(shCanvas);

  // 6. Holographic city signs (2099 cyberpunk billboards)
  const makeHoloSign = (title: string, sub: string, accent: string) => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#081226';
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, 496, 240);
    // Scanlines
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let y = 0; y < 256; y += 6) {
      ctx.fillRect(10, y, 492, 2);
    }
    ctx.fillStyle = accent;
    ctx.font = 'bold 54px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, 256, 120);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 24px monospace';
    ctx.fillText(sub, 256, 176);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    return tex;
  };

  const holoAd1 = makeHoloSign('SECTOR 09 // GRID', 'POWER NETWORK CRITICAL', '#00D9FF');
  const holoAd2 = makeHoloSign('ECHO PROTOCOL', 'Q: SHIFT REALITY', '#A855F7');

  return {
    roadMap,
    roadBump,
    buildingMap,
    armorBump,
    contactShadow,
    holoAd1,
    holoAd2,
    dispose: () => {
      roadMap.dispose();
      roadBump.dispose();
      buildingMap.dispose();
      armorBump.dispose();
      contactShadow.dispose();
      holoAd1.dispose();
      holoAd2.dispose();
    },
  };
}
