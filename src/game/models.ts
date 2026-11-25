import * as THREE from 'three';
import type { ProceduralTextures } from './textures';
import { PALETTE } from './types';

export interface GuardianRig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  reactorCore: THREE.Mesh;
  backCore: THREE.Mesh;
  capePivot: THREE.Group;
  visor: THREE.Mesh;
  muzzlePoint: THREE.Object3D;
  muzzleFlash: THREE.Mesh;
  hitMaterials: THREE.MeshStandardMaterial[];
}

export interface EnemyRig {
  root: THREE.Group;
  body: THREE.Group;
  weakPoint: THREE.Mesh;
  shieldMesh?: THREE.Mesh;
  leftArm?: THREE.Group;
  rightArm?: THREE.Group;
  leftLeg?: THREE.Group;
  rightLeg?: THREE.Group;
  pylons?: THREE.Group;
  hitMaterials: THREE.MeshStandardMaterial[];
}

function makeContactShadow(tex: THREE.CanvasTexture, radius: number): THREE.Mesh {
  const geo = new THREE.CircleGeometry(radius, 20);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.02;
  return mesh;
}

export function createGuardianModel(textures: ProceduralTextures): GuardianRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 0.95;
  root.add(body);
  root.add(makeContactShadow(textures.contactShadow, 0.72));

  const armorMat = new THREE.MeshStandardMaterial({
    color: 0x1c2842,
    metalness: 0.78,
    roughness: 0.3,
    bumpMap: textures.armorBump,
    bumpScale: 0.02,
  });
  const darkJointMat = new THREE.MeshStandardMaterial({
    color: 0x0d1322,
    metalness: 0.4,
    roughness: 0.72,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x334b74,
    metalness: 0.88,
    roughness: 0.22,
  });
  const glowCyanMat = new THREE.MeshStandardMaterial({
    color: PALETTE.primaryCyan,
    emissive: PALETTE.primaryCyan,
    emissiveIntensity: 2.2,
    roughness: 0.15,
    metalness: 0.2,
  });

  // Torso (primary silhouette)
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.56, 0.34), armorMat);
  chest.position.y = 0.28;
  chest.castShadow = true;
  body.add(chest);

  const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.19, 0.26, 8), darkJointMat);
  waist.position.y = -0.1;
  body.add(waist);

  // Chest reactor core (accent detail)
  const reactorCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), glowCyanMat);
  reactorCore.position.set(0, 0.3, -0.19);
  body.add(reactorCore);

  // Back thrusters + glowing triangular energy core + crimson cape (matching key art!)
  const jetpack = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.44, 0.16), trimMat);
  jetpack.position.set(0, 0.3, 0.22);
  jetpack.castShadow = true;
  body.add(jetpack);

  const backCoreGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.06, 3);
  backCoreGeo.rotateX(Math.PI / 2);
  backCoreGeo.rotateZ(Math.PI);
  const backCore = new THREE.Mesh(backCoreGeo, glowCyanMat);
  backCore.position.set(0, 0.34, 0.31);
  body.add(backCore);

  const capePivot = new THREE.Group();
  capePivot.position.set(0, 0.46, 0.25);
  body.add(capePivot);
  const capeMat = new THREE.MeshStandardMaterial({
    color: 0x8f1d2c,
    roughness: 0.78,
    metalness: 0.12,
    side: THREE.DoubleSide,
  });
  const capeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.92, 0.03), capeMat);
  capeMesh.position.set(-0.06, -0.46, 0.06);
  capeMesh.rotation.set(0.18, 0, -0.1);
  capePivot.add(capeMesh);

  // Shoulder pauldrons (secondary read)
  const pauldronGeo = new THREE.BoxGeometry(0.24, 0.2, 0.3);
  const leftPauldron = new THREE.Mesh(pauldronGeo, trimMat);
  leftPauldron.position.set(-0.4, 0.48, 0);
  leftPauldron.rotation.z = 0.24;
  body.add(leftPauldron);

  const rightPauldron = new THREE.Mesh(pauldronGeo, trimMat);
  rightPauldron.position.set(0.4, 0.48, 0);
  rightPauldron.rotation.z = -0.24;
  body.add(rightPauldron);

  // Head & luminous visor
  const head = new THREE.Group();
  head.position.set(0, 0.74, 0);
  body.add(head);

  const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.34), armorMat);
  helmet.castShadow = true;
  head.add(helmet);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.08), glowCyanMat);
  visor.position.set(0, 0.02, -0.15);
  head.add(visor);

  const crest = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.3), glowCyanMat);
  crest.position.set(0, 0.19, 0.02);
  head.add(crest);

  // Arms
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.42, 0.44, 0);
  body.add(leftArm);
  const lUpper = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.46, 0.16), darkJointMat);
  lUpper.position.y = -0.22;
  leftArm.add(lUpper);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.42, 0.44, 0);
  body.add(rightArm);
  const rUpper = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.44, 0.16), armorMat);
  rUpper.position.set(0, -0.18, -0.1);
  rUpper.rotation.x = Math.PI * 0.35;
  rightArm.add(rUpper);

  // Energy Plasma Rifle (multi-part weapon)
  const rifleGroup = new THREE.Group();
  rifleGroup.position.set(0, -0.22, -0.38);
  rightArm.add(rifleGroup);

  const rifleBody = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.15, 0.68), darkJointMat);
  rifleGroup.add(rifleBody);

  const rifleRail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.56), glowCyanMat);
  rifleRail.position.set(0, 0.07, -0.05);
  rifleGroup.add(rifleRail);

  const muzzlePoint = new THREE.Object3D();
  muzzlePoint.position.set(0, 0.04, -0.4);
  rifleGroup.add(muzzlePoint);

  const muzzleFlash = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.16, 0),
    new THREE.MeshBasicMaterial({
      color: 0x80f3ff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    })
  );
  muzzleFlash.position.copy(muzzlePoint.position);
  muzzleFlash.visible = false;
  rifleGroup.add(muzzleFlash);

  // Legs
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.17, -0.22, 0);
  body.add(leftLeg);
  const lThigh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.38, 0.22), armorMat);
  lThigh.position.y = -0.2;
  leftLeg.add(lThigh);
  const lShin = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.38, 0.2), darkJointMat);
  lShin.position.y = -0.54;
  leftLeg.add(lShin);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.17, -0.22, 0);
  body.add(rightLeg);
  const rThigh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.38, 0.22), armorMat);
  rThigh.position.y = -0.2;
  rightLeg.add(rThigh);
  const rShin = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.38, 0.2), darkJointMat);
  rShin.position.y = -0.54;
  rightLeg.add(rShin);

  return {
    root,
    body,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    reactorCore,
    backCore,
    capePivot,
    visor,
    muzzlePoint,
    muzzleFlash,
    hitMaterials: [armorMat, trimMat],
  };
}

export function createScoutModel(textures: ProceduralTextures): EnemyRig {
  const root = new THREE.Group();
  root.add(makeContactShadow(textures.contactShadow, 0.7));

  const body = new THREE.Group();
  body.position.y = 1.9;
  root.add(body);

  const hullMat = new THREE.MeshStandardMaterial({
    color: 0x1b2234,
    metalness: 0.85,
    roughness: 0.28,
  });
  const finMat = new THREE.MeshStandardMaterial({
    color: 0x2a3550,
    metalness: 0.7,
    roughness: 0.45,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: PALETTE.dangerRed,
    emissive: PALETTE.dangerRed,
    emissiveIntensity: 2.4,
    roughness: 0.15,
  });

  // Central sphere-octa chassis
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 1), hullMat);
  core.scale.set(1.15, 0.72, 1.3);
  core.castShadow = true;
  body.add(core);

  // Twin thruster pods
  const podGeo = new THREE.CylinderGeometry(0.16, 0.2, 0.6, 8);
  podGeo.rotateX(Math.PI / 2);
  const leftPod = new THREE.Mesh(podGeo, finMat);
  leftPod.position.set(-0.62, 0, 0.1);
  body.add(leftPod);
  const rightPod = new THREE.Mesh(podGeo, finMat);
  rightPod.position.set(0.62, 0, 0.1);
  body.add(rightPod);

  // Stabilizer wings
  const wingGeo = new THREE.BoxGeometry(1.55, 0.06, 0.34);
  const wings = new THREE.Mesh(wingGeo, finMat);
  wings.position.set(0, 0.16, 0.08);
  body.add(wings);

  // Red optic eye / weak point
  const weakPoint = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), eyeMat);
  weakPoint.position.set(0, 0, -0.52);
  body.add(weakPoint);

  return {
    root,
    body,
    weakPoint,
    hitMaterials: [hullMat, finMat],
  };
}

export function createHunterModel(textures: ProceduralTextures): EnemyRig {
  const root = new THREE.Group();
  root.add(makeContactShadow(textures.contactShadow, 0.8));

  const body = new THREE.Group();
  body.position.y = 1.05;
  root.add(body);

  const chassisMat = new THREE.MeshStandardMaterial({
    color: 0x24192c,
    metalness: 0.72,
    roughness: 0.35,
  });
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0xff3459,
    emissive: 0x991133,
    emissiveIntensity: 1.5,
    metalness: 0.8,
    roughness: 0.2,
  });
  const headMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    metalness: 0.85,
    roughness: 0.25,
  });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.72, 0.44), chassisMat);
  torso.position.y = 0.2;
  torso.castShadow = true;
  body.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.28, 0.42), headMat);
  head.position.set(0, 0.68, -0.06);
  body.add(head);

  const weakPoint = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.1), bladeMat);
  weakPoint.position.set(0, 0.68, -0.25);
  body.add(weakPoint);

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.46, 0.42, 0);
  body.add(leftArm);
  const lBlade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.56, 0.22), bladeMat);
  lBlade.position.set(0, -0.24, -0.14);
  leftArm.add(lBlade);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.46, 0.42, 0);
  body.add(rightArm);
  const rBlade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.56, 0.22), bladeMat);
  rBlade.position.set(0, -0.24, -0.14);
  rightArm.add(rBlade);

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.2, -0.18, 0);
  body.add(leftLeg);
  const lLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.74, 0.22), headMat);
  lLegMesh.position.y = -0.38;
  leftLeg.add(lLegMesh);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.2, -0.18, 0);
  body.add(rightLeg);
  const rLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.74, 0.22), headMat);
  rLegMesh.position.y = -0.38;
  rightLeg.add(rLegMesh);

  return {
    root,
    body,
    weakPoint,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    hitMaterials: [chassisMat, headMat],
  };
}

export function createSentinelModel(textures: ProceduralTextures): EnemyRig {
  const root = new THREE.Group();
  root.add(makeContactShadow(textures.contactShadow, 1.35));

  const body = new THREE.Group();
  body.position.y = 1.55;
  root.add(body);

  const heavyArmor = new THREE.MeshStandardMaterial({
    color: 0x1a2639,
    metalness: 0.88,
    roughness: 0.32,
  });
  const plateMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.7,
    roughness: 0.52,
  });
  const weakMat = new THREE.MeshStandardMaterial({
    color: PALETTE.energyGold,
    emissive: PALETTE.energyGold,
    emissiveIntensity: 0.3,
    roughness: 0.2,
    metalness: 0.3,
  });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.25, 0.9), heavyArmor);
  torso.position.y = 0.2;
  torso.castShadow = true;
  body.add(torso);

  // Heavy shoulder shields
  const lShield = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.9, 1.0), plateMat);
  lShield.position.set(-0.88, 0.35, -0.1);
  body.add(lShield);
  const rShield = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.9, 1.0), plateMat);
  rShield.position.set(0.88, 0.35, -0.1);
  body.add(rShield);

  // Cannon arm
  const rightArm = new THREE.Group();
  rightArm.position.set(0.95, 0.1, -0.25);
  body.add(rightArm);
  const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.2, 8), heavyArmor);
  cannon.rotation.x = Math.PI / 2;
  cannon.position.z = -0.5;
  rightArm.add(cannon);

  // Heavy legs
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.38, -0.45, 0);
  body.add(leftLeg);
  const lCol = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.05, 0.44), plateMat);
  lCol.position.y = -0.55;
  leftLeg.add(lCol);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.38, -0.45, 0);
  body.add(rightLeg);
  const rCol = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.05, 0.44), plateMat);
  rCol.position.y = -0.55;
  rightLeg.add(rCol);

  // Head dome
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.36, 8), heavyArmor);
  head.position.set(0, 0.96, 0);
  body.add(head);

  // Weak point (prominent chest core that illuminates brightly in Shadow Mode)
  const weakPoint = new THREE.Mesh(new THREE.OctahedronGeometry(0.36, 1), weakMat);
  weakPoint.position.set(0, 0.25, -0.48);
  body.add(weakPoint);

  return {
    root,
    body,
    weakPoint,
    rightArm,
    leftLeg,
    rightLeg,
    hitMaterials: [heavyArmor, plateMat],
  };
}

export function createBossModel(textures: ProceduralTextures): EnemyRig {
  const root = new THREE.Group();
  root.add(makeContactShadow(textures.contactShadow, 2.8));

  const body = new THREE.Group();
  body.position.y = 2.6;
  root.add(body);

  const obsidianArmor = new THREE.MeshStandardMaterial({
    color: 0x131826,
    metalness: 0.9,
    roughness: 0.26,
  });
  const crimsonTrim = new THREE.MeshStandardMaterial({
    color: PALETTE.dangerRed,
    emissive: 0xaa1133,
    emissiveIntensity: 1.6,
    metalness: 0.7,
    roughness: 0.25,
  });
  const weakMat = new THREE.MeshStandardMaterial({
    color: PALETTE.energyGold,
    emissive: PALETTE.energyGold,
    emissiveIntensity: 0.4,
    roughness: 0.15,
    metalness: 0.3,
  });

  // Towering mech torso
  const upperTorso = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.8, 1.45), obsidianArmor);
  upperTorso.position.y = 0.7;
  upperTorso.castShadow = true;
  body.add(upperTorso);

  const lowerTorso = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, 0.9, 8), obsidianArmor);
  lowerTorso.position.y = -0.55;
  body.add(lowerTorso);

  // Crowned head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.78, 0.85), obsidianArmor);
  head.position.set(0, 1.95, -0.1);
  body.add(head);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.2, 0.14), crimsonTrim);
  visor.position.set(0, 1.95, -0.5);
  body.add(visor);

  // Massive shoulder plates
  const lShoulder = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 1.25), obsidianArmor);
  lShoulder.position.set(-1.62, 1.2, 0);
  lShoulder.rotation.z = 0.22;
  body.add(lShoulder);

  const rShoulder = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 1.25), obsidianArmor);
  rShoulder.position.set(1.62, 1.2, 0);
  rShoulder.rotation.z = -0.22;
  body.add(rShoulder);

  // Articulated arms
  const leftArm = new THREE.Group();
  leftArm.position.set(-1.7, 0.75, 0);
  body.add(leftArm);
  const lGauntlet = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.7, 0.7), obsidianArmor);
  lGauntlet.position.set(0, -0.85, -0.2);
  leftArm.add(lGauntlet);
  const lGlow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.1, 0.2), crimsonTrim);
  lGlow.position.set(0, -0.9, -0.55);
  leftArm.add(lGlow);

  const rightArm = new THREE.Group();
  rightArm.position.set(1.7, 0.75, 0);
  body.add(rightArm);
  const rGauntlet = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.7, 0.7), obsidianArmor);
  rGauntlet.position.set(0, -0.85, -0.2);
  rightArm.add(rGauntlet);
  const rGlow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.1, 0.2), crimsonTrim);
  rGlow.position.set(0, -0.9, -0.55);
  rightArm.add(rGlow);

  // Heavy mech legs
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.68, -0.9, 0);
  body.add(leftLeg);
  const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.64, 1.7, 0.76), obsidianArmor);
  lLeg.position.y = -0.85;
  leftLeg.add(lLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.68, -0.9, 0);
  body.add(rightLeg);
  const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.64, 1.7, 0.76), obsidianArmor);
  rLeg.position.y = -0.85;
  rightLeg.add(rLeg);

  // Orbiting shoulder pylons
  const pylons = new THREE.Group();
  pylons.position.y = 1.6;
  body.add(pylons);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const pylon = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), crimsonTrim);
    pylon.position.set(Math.cos(a) * 2.5, 0, Math.sin(a) * 2.5);
    pylons.add(pylon);
  }

  // Central Weak Point Core
  const weakPoint = new THREE.Mesh(new THREE.OctahedronGeometry(0.68, 1), weakMat);
  weakPoint.position.set(0, 0.72, -0.78);
  body.add(weakPoint);

  // Protective energy shield dome (active in Phase 2/3)
  const shieldMesh = new THREE.Mesh(
    new THREE.SphereGeometry(2.95, 24, 18),
    new THREE.MeshBasicMaterial({
      color: PALETTE.dangerRed,
      transparent: true,
      opacity: 0.24,
      wireframe: true,
    })
  );
  shieldMesh.position.y = 0.2;
  shieldMesh.visible = false;
  body.add(shieldMesh);

  return {
    root,
    body,
    weakPoint,
    shieldMesh,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    pylons,
    hitMaterials: [obsidianArmor],
  };
}

export function createEnergyCoreModel(shadowOnly: boolean): THREE.Group {
  const group = new THREE.Group();

  const crystalMat = new THREE.MeshStandardMaterial({
    color: shadowOnly ? PALETTE.shadowPurple : PALETTE.energyGold,
    emissive: shadowOnly ? PALETTE.shadowPurple : PALETTE.energyGold,
    emissiveIntensity: 2.6,
    roughness: 0.1,
    metalness: 0.3,
  });
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.46, 0), crystalMat);
  crystal.position.y = 1.35;
  crystal.name = 'crystal';
  group.add(crystal);

  const ringMat = new THREE.MeshStandardMaterial({
    color: PALETTE.primaryCyan,
    emissive: shadowOnly ? PALETTE.shadowPurple : PALETTE.primaryCyan,
    emissiveIntensity: 1.4,
    roughness: 0.2,
    metalness: 0.85,
  });
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.045, 8, 28), ringMat);
  ring1.position.y = 1.35;
  ring1.name = 'ring1';
  group.add(ring1);

  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.035, 8, 24), ringMat);
  ring2.position.y = 1.35;
  ring2.rotation.x = Math.PI / 2;
  ring2.name = 'ring2';
  group.add(ring2);

  // Pedestal base grounded on floor
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x18233a,
    metalness: 0.8,
    roughness: 0.35,
  });
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.72, 0.35, 12), baseMat);
  pedestal.position.y = 0.175;
  group.add(pedestal);

  return group;
}

export function createVehicleProp(textures: ProceduralTextures): THREE.Group {
  const g = new THREE.Group();
  g.add(makeContactShadow(textures.contactShadow, 2.2));

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1a273f,
    metalness: 0.82,
    roughness: 0.35,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0b1628,
    metalness: 0.2,
    roughness: 0.1,
  });
  const neonMat = new THREE.MeshStandardMaterial({
    color: PALETTE.primaryCyan,
    emissive: PALETTE.primaryCyan,
    emissiveIntensity: 1.5,
  });

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.65, 4.2), bodyMat);
  chassis.position.y = 0.65;
  chassis.castShadow = true;
  g.add(chassis);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.55, 2.1), glassMat);
  cabin.position.set(0, 1.18, 0.1);
  g.add(cabin);

  // Hover thrusters (4 corners)
  const podGeo = new THREE.CylinderGeometry(0.32, 0.38, 0.3, 10);
  const offsets: [number, number][] = [
    [-0.95, -1.4],
    [0.95, -1.4],
    [-0.95, 1.4],
    [0.95, 1.4],
  ];
  offsets.forEach(([ox, oz]) => {
    const pod = new THREE.Mesh(podGeo, bodyMat);
    pod.position.set(ox, 0.28, oz);
    g.add(pod);
  });

  // Headlight bar
  const lightBar = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.12, 0.08), neonMat);
  lightBar.position.set(0, 0.68, -2.11);
  g.add(lightBar);

  return g;
}

export function createStreetLightProp(isShadowSide = false): THREE.Group {
  const g = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x1f2d47,
    metalness: 0.85,
    roughness: 0.3,
  });
  const lampColor = isShadowSide ? PALETTE.shadowPurple : PALETTE.primaryCyan;
  const lampMat = new THREE.MeshStandardMaterial({
    color: lampColor,
    emissive: lampColor,
    emissiveIntensity: 2.4,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.4, 8), poleMat);
  base.position.y = 0.2;
  g.add(base);

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 6.2, 8), poleMat);
  pole.position.y = 3.3;
  g.add(pole);

  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.16), poleMat);
  arm.position.set(0.65, 6.3, 0);
  g.add(arm);

  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.12, 0.26), lampMat);
  lamp.position.set(1.05, 6.2, 0);
  g.add(lamp);

  return g;
}
