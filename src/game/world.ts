import * as THREE from 'three';
import {
  createEnergyCoreModel,
  createStreetLightProp,
  createVehicleProp,
} from './models';
import type { ProceduralTextures } from './textures';
import { type AABB, type DimensionMode, PALETTE } from './types';

export interface CollectibleCore {
  id: number;
  x: number;
  y: number;
  z: number;
  shadowOnly: boolean;
  collected: boolean;
  mesh: THREE.Group;
  label: string;
}

export interface WorldArena {
  colliders: AABB[];
  raycastWalls: THREE.Object3D[];
  realityOnlyMeshes: THREE.Object3D[];
  shadowOnlyMeshes: THREE.Object3D[];
  reactorGateMesh: THREE.Group;
  reactorGateCollider: AABB;
  reactorConsolePos: THREE.Vector3;
  reactorBeamMesh: THREE.Mesh;
  reactorRings: THREE.Mesh[];
  hazardRings: THREE.Mesh[];
  cores: CollectibleCore[];
  ambientParticles: THREE.Points;
  updateDimensionVisuals: (dim: DimensionMode, elapsed: number) => void;
  setReactorGateOpen: (open: boolean) => void;
  setReactorActivated: (active: boolean) => void;
  dispose: () => void;
}

export function buildCityWorld(
  scene: THREE.Scene,
  textures: ProceduralTextures
): WorldArena {
  const colliders: AABB[] = [];
  const raycastWalls: THREE.Object3D[] = [];
  const realityOnlyMeshes: THREE.Object3D[] = [];
  const shadowOnlyMeshes: THREE.Object3D[] = [];
  const disposables: { dispose: () => void }[] = [];

  const track = <T extends { dispose: () => void }>(d: T): T => {
    disposables.push(d);
    return d;
  };

  // Shared materials
  const groundMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.roadMap,
      bumpMap: textures.roadBump,
      bumpScale: 0.04,
      roughness: 0.72,
      metalness: 0.22,
    })
  );
  const sidewalkMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x111a2e,
      roughness: 0.8,
      metalness: 0.25,
    })
  );
  const buildingMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.buildingMap,
      emissive: 0x0f2744,
      emissiveMap: textures.buildingMap,
      emissiveIntensity: 0.75,
      roughness: 0.45,
      metalness: 0.5,
    })
  );
  const metalTrimMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x243658,
      roughness: 0.35,
      metalness: 0.85,
    })
  );
  const cyanNeonMat = track(
    new THREE.MeshStandardMaterial({
      color: PALETTE.primaryCyan,
      emissive: PALETTE.primaryCyan,
      emissiveIntensity: 2.2,
      roughness: 0.2,
    })
  );
  const shadowPlatformMat = track(
    new THREE.MeshStandardMaterial({
      color: PALETTE.shadowPurple,
      emissive: PALETTE.shadowPurple,
      emissiveIntensity: 1.45,
      transparent: true,
      opacity: 0.82,
      roughness: 0.2,
      metalness: 0.4,
    })
  );
  const realityBarrierMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x00d9ff,
      emissive: 0x0099dd,
      emissiveIntensity: 1.3,
      transparent: true,
      opacity: 0.58,
      roughness: 0.2,
      side: THREE.DoubleSide,
    })
  );

  // 1. Expansive Ground Plane (extends well beyond playable arena for natural horizon blend)
  const groundGeo = track(new THREE.PlaneGeometry(240, 260));
  groundGeo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.set(0, 0, -20);
  ground.receiveShadow = true;
  scene.add(ground);

  // Raised cyber sidewalks flanking the boulevard (Zones 1 & 2)
  const swGeo = track(new THREE.BoxGeometry(15, 0.24, 86));
  const leftWalk = new THREE.Mesh(swGeo, sidewalkMat);
  leftWalk.position.set(-14.5, 0.12, 8);
  leftWalk.receiveShadow = true;
  scene.add(leftWalk);

  const rightWalk = new THREE.Mesh(swGeo, sidewalkMat);
  rightWalk.position.set(14.5, 0.12, 8);
  rightWalk.receiveShadow = true;
  scene.add(rightWalk);

  // Helper to add solid obstacle box + collider
  const addBoxObstacle = (
    id: string,
    cx: number,
    cy: number,
    cz: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    dimension: 'always' | 'reality' | 'shadow' = 'always',
    isWalkableTop = false
  ): THREE.Mesh => {
    const geo = track(new THREE.BoxGeometry(w, h, d));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx, cy, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    if (dimension === 'reality') realityOnlyMeshes.push(mesh);
    else if (dimension === 'shadow') shadowOnlyMeshes.push(mesh);

    if (dimension === 'always') raycastWalls.push(mesh);

    colliders.push({
      id,
      minX: cx - w / 2,
      maxX: cx + w / 2,
      minY: cy - h / 2,
      maxY: cy + h / 2,
      minZ: cz - d / 2,
      maxZ: cz + d / 2,
      dimension,
      isWalkableTop,
    });
    return mesh;
  };

  // =========================================================================
  // PERIMETER SKYSCRAPERS & DISTANT SKYLINE (No floating void box!)
  // =========================================================================
  const perimeterTowers: [number, number, number, number, number][] = [
    // [x, z, w, h, d]
    [-27, 36, 9, 28, 12],
    [-27, 16, 10, 36, 14],
    [-27, -6, 9, 32, 14],
    [-27, -26, 10, 42, 12],
    [27, 36, 10, 34, 12],
    [27, 14, 9, 26, 14],
    [27, -8, 10, 38, 14],
    [27, -28, 9, 30, 12],
    // Distant skyline silhouettes
    [-46, 25, 14, 54, 14],
    [-48, -15, 16, 68, 16],
    [-46, -55, 14, 58, 14],
    [46, 28, 14, 48, 14],
    [48, -12, 16, 64, 16],
    [46, -56, 14, 52, 14],
    [-26, -86, 16, 56, 14],
    [26, -86, 16, 60, 14],
    [0, -104, 20, 72, 16],
  ];

  perimeterTowers.forEach(([x, z, w, h, d], idx) => {
    const grp = new THREE.Group();
    grp.position.set(x, 0, z);

    const bMesh = new THREE.Mesh(track(new THREE.BoxGeometry(w, h, d)), buildingMat);
    bMesh.position.y = h / 2;
    grp.add(bMesh);

    const crown = new THREE.Mesh(track(new THREE.BoxGeometry(w + 0.6, 0.7, d + 0.6)), metalTrimMat);
    crown.position.y = h + 0.35;
    grp.add(crown);

    const neonTrim = new THREE.Mesh(
      track(new THREE.BoxGeometry(w + 0.7, 0.35, d + 0.7)),
      cyanNeonMat
    );
    neonTrim.position.y = h - 1.2;
    grp.add(neonTrim);

    // Vertical cyber beacon strip facing boulevard
    const beaconStrip = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.35, h * 0.85, 0.35)),
      cyanNeonMat
    );
    beaconStrip.position.set(x < 0 ? w / 2 + 0.1 : -w / 2 - 0.1, h * 0.45, 0);
    grp.add(beaconStrip);

    scene.add(grp);
    if (idx < 8) {
      raycastWalls.push(bMesh);
    }
  });

  // Low sleek cyberpunk guardrails along playable corridor (x = ±22, height 1.0m)
  addBoxObstacle('bound_left', -22.5, 0.5, 10, 0.8, 1.0, 84, metalTrimMat, 'always');
  addBoxObstacle('bound_right', 22.5, 0.5, 10, 0.8, 1.0, 84, metalTrimMat, 'always');
  addBoxObstacle('bound_south', 0, 0.5, 51, 46, 1.0, 0.8, metalTrimMat, 'always');

  // Street lights & abandoned vehicles in Zone 1 & Zone 2
  const lightPositions: [number, number, boolean][] = [
    [-7.5, 38, false],
    [7.5, 38, false],
    [-7.5, 20, false],
    [7.5, 20, false],
    [-7.5, -10, true],
    [7.5, -10, true],
    [-7.5, -26, true],
    [7.5, -26, true],
  ];
  lightPositions.forEach(([lx, lz, isShadow]) => {
    const lamp = createStreetLightProp(isShadow);
    lamp.position.set(lx, 0, lz);
    if (lx > 0) lamp.rotation.y = Math.PI;
    scene.add(lamp);
  });

  const car1 = createVehicleProp(textures);
  car1.position.set(-4.2, 0, 29);
  car1.rotation.y = 0.28;
  scene.add(car1);
  colliders.push({
    id: 'car1',
    minX: -5.4,
    maxX: -3.0,
    minY: 0,
    maxY: 1.6,
    minZ: 26.8,
    maxZ: 31.2,
    dimension: 'always',
  });
  raycastWalls.push(car1);

  const car2 = createVehicleProp(textures);
  car2.position.set(4.5, 0, 15);
  car2.rotation.y = -0.42;
  scene.add(car2);
  colliders.push({
    id: 'car2',
    minX: 3.1,
    maxX: 5.9,
    minY: 0,
    maxY: 1.6,
    minZ: 12.8,
    maxZ: 17.2,
    dimension: 'always',
  });
  raycastWalls.push(car2);

  // Holographic billboards
  const makeAdBoard = (tex: THREE.CanvasTexture, x: number, y: number, z: number, ry: number) => {
    const grp = new THREE.Group();
    grp.position.set(x, y, z);
    grp.rotation.y = ry;
    const screen = new THREE.Mesh(
      track(new THREE.PlaneGeometry(7.2, 3.6)),
      track(
        new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide,
        })
      )
    );
    grp.add(screen);
    const frame = new THREE.Mesh(track(new THREE.BoxGeometry(7.5, 3.9, 0.2)), metalTrimMat);
    frame.position.z = -0.14;
    grp.add(frame);
    scene.add(grp);
  };
  makeAdBoard(textures.holoAd1, -18.5, 6.2, 24, Math.PI / 3);
  makeAdBoard(textures.holoAd2, 18.5, 6.5, 4, -Math.PI / 3);

  // =========================================================================
  // ZONE 1: THE FALLEN CITY — Core #1 Elevated Plaza + Cover Blocks
  // =========================================================================
  addBoxObstacle('z1_cover_l', -5.5, 0.75, 22, 2.2, 1.5, 2.2, metalTrimMat, 'always', true);
  // Core #1 stepped platform & ramp
  addBoxObstacle('z1_step1', 9.2, 0.45, 27.5, 3.6, 0.9, 3.2, metalTrimMat, 'always', true);
  addBoxObstacle('z1_plaza', 11.5, 0.9, 22.5, 5.2, 1.8, 5.8, metalTrimMat, 'always', true);

  // =========================================================================
  // ZONE 2: THE SHADOW DISTRICT — Echo Shift Puzzles!
  // =========================================================================
  // 1) Central Reality Phase Barrier spanning z = 2 (solid in Reality, transparent passable in Shadow!)
  addBoxObstacle('z2_phase_gate_c', 0, 2.4, 2, 14, 4.8, 0.8, realityBarrierMat, 'reality');
  addBoxObstacle('z2_phase_gate_l', -14.5, 2.4, 2, 15, 4.8, 0.8, realityBarrierMat, 'reality');
  addBoxObstacle('z2_phase_gate_r', 14.5, 2.4, 2, 15, 4.8, 0.8, realityBarrierMat, 'reality');

  // 2) Shadow Vault on the left (-12, -14) housing Core #2 (Reality wall blocks entrance, Shadow Mode opens it!)
  addBoxObstacle('vault_back', -13, 2, -18, 8, 4, 0.8, metalTrimMat, 'always');
  addBoxObstacle('vault_left', -17, 2, -14, 0.8, 4, 8, metalTrimMat, 'always');
  addBoxObstacle('vault_front', -13, 2, -10, 8, 4, 0.8, metalTrimMat, 'always');
  addBoxObstacle('vault_phase_door', -9, 2, -14, 0.7, 4, 7.6, realityBarrierMat, 'reality');

  // 3) Elevated Shadow Echo Platforms on the right leading to Core #3 at (13, 3.1, -21)
  addBoxObstacle('echo_step_1', 8.5, 0.95, -12.5, 3.4, 0.4, 3.4, shadowPlatformMat, 'shadow', true);
  addBoxObstacle('echo_step_2', 11.2, 1.95, -16.5, 3.4, 0.4, 3.4, shadowPlatformMat, 'shadow', true);
  addBoxObstacle('core3_tower', 13.5, 1.45, -21.5, 4.6, 2.9, 4.6, metalTrimMat, 'always', true);

  // Zone 2 tactical cover blocks
  addBoxObstacle('z2_cover_1', -3.5, 0.85, -15, 2.4, 1.7, 2.4, metalTrimMat, 'always', true);
  addBoxObstacle('z2_cover_2', 3.5, 0.85, -22, 2.4, 1.7, 2.4, metalTrimMat, 'always', true);

  // =========================================================================
  // ZONE 3: THE CENTRAL REACTOR ARENA (z = -32 to -82)
  // =========================================================================
  // Reactor Gate Wall flanking left & right of central doorway
  addBoxObstacle('gate_wall_l', -15.5, 3.5, -32, 15, 7, 2, metalTrimMat, 'always');
  addBoxObstacle('gate_wall_r', 15.5, 3.5, -32, 15, 7, 2, metalTrimMat, 'always');

  // Dynamic Reactor Gate (slides open when 3/3 cores collected)
  const reactorGateMesh = new THREE.Group();
  reactorGateMesh.position.set(0, 0, -32);
  const gateDoorMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xff3459,
      emissive: 0xff3459,
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.72,
    })
  );
  const gatePanel = new THREE.Mesh(track(new THREE.BoxGeometry(16, 6.5, 1.2)), gateDoorMat);
  gatePanel.position.y = 3.25;
  reactorGateMesh.add(gatePanel);
  scene.add(reactorGateMesh);

  const reactorGateCollider: AABB = {
    id: 'reactor_gate_door',
    minX: -8,
    maxX: 8,
    minY: 0,
    maxY: 6.5,
    minZ: -32.6,
    maxZ: -31.4,
    dimension: 'always',
  };
  colliders.push(reactorGateCollider);

  // Reactor Arena boundary walls (box around circular-feel plaza x: ±24, z: -32 to -84)
  addBoxObstacle('arena_wall_l', -24.5, 4, -58, 2, 8, 54, metalTrimMat, 'always');
  addBoxObstacle('arena_wall_r', 24.5, 4, -58, 2, 8, 54, metalTrimMat, 'always');
  addBoxObstacle('arena_wall_n', 0, 4, -85, 51, 8, 2, metalTrimMat, 'always');

  // 4 Arena Cover Pillars inside Central Reactor
  const pillarOffsets: [number, number][] = [
    [-11, -46],
    [11, -46],
    [-12, -66],
    [12, -66],
  ];
  pillarOffsets.forEach(([px, pz], idx) => {
    addBoxObstacle(`arena_pillar_${idx}`, px, 2.5, pz, 2.4, 5, 2.4, metalTrimMat, 'always');
  });

  // Towering Central Reactor Spire at (0, 0, -76)
  const reactorTower = new THREE.Group();
  reactorTower.position.set(0, 0, -76);
  const spireBase = new THREE.Mesh(
    track(new THREE.CylinderGeometry(3.2, 4.4, 3.2, 12)),
    metalTrimMat
  );
  spireBase.position.y = 1.6;
  reactorTower.add(spireBase);

  const spireCore = new THREE.Mesh(
    track(new THREE.CylinderGeometry(1.4, 1.4, 18, 16)),
    track(
      new THREE.MeshStandardMaterial({
        color: PALETTE.primaryCyan,
        emissive: PALETTE.dangerRed,
        emissiveIntensity: 1.8,
        transparent: true,
        opacity: 0.85,
      })
    )
  );
  spireCore.position.y = 11;
  reactorTower.add(spireCore);

  const reactorRings: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      track(new THREE.TorusGeometry(3.2 + i * 0.7, 0.16, 10, 32)),
      cyanNeonMat
    );
    ring.position.y = 5.5 + i * 4.0;
    ring.rotation.x = Math.PI / 2;
    reactorTower.add(ring);
    reactorRings.push(ring);
  }

  const reactorBeamMesh = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.9, 1.8, 55, 16)),
    track(
      new THREE.MeshBasicMaterial({
        color: PALETTE.primaryCyan,
        transparent: true,
        opacity: 0.15,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
  );
  reactorBeamMesh.position.y = 32;
  reactorTower.add(reactorBeamMesh);

  // Dimension Rift Ring above the Central Reactor Spire (mirrors poster rift!)
  const riftRing = new THREE.Mesh(
    track(new THREE.TorusGeometry(9.5, 0.35, 10, 40)),
    track(
      new THREE.MeshBasicMaterial({
        color: PALETTE.shadowPurple,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
      })
    )
  );
  riftRing.position.set(0, 26, 0);
  reactorTower.add(riftRing);
  reactorRings.push(riftRing);
  scene.add(reactorTower);

  // Luminous Cyber Moon in the northwest horizon
  const moonMesh = new THREE.Mesh(
    track(new THREE.SphereGeometry(7.5, 24, 24)),
    track(
      new THREE.MeshBasicMaterial({
        color: 0xbfe9ff,
        fog: false,
      })
    )
  );
  moonMesh.position.set(-34, 46, -125);
  scene.add(moonMesh);

  // Shadow Mode Crystal Spires (materialize when Q Echo Shift is active!)
  const crystalPositions: [number, number, number][] = [
    [-16, -6, 1.4],
    [16, -8, 1.6],
    [-19, -24, 1.9],
    [19, -25, 1.7],
    [-20, -48, 2.2],
    [20, -50, 2.0],
  ];
  crystalPositions.forEach(([cx, cz, scale]) => {
    const cGrp = new THREE.Group();
    cGrp.position.set(cx, 0, cz);
    const shardMat = shadowPlatformMat;
    const mainShard = new THREE.Mesh(
      track(new THREE.ConeGeometry(0.7 * scale, 4.2 * scale, 5)),
      shardMat
    );
    mainShard.position.y = 2.1 * scale;
    mainShard.rotation.z = cx < 0 ? -0.18 : 0.18;
    cGrp.add(mainShard);
    const sideShard = new THREE.Mesh(
      track(new THREE.ConeGeometry(0.45 * scale, 2.6 * scale, 5)),
      shardMat
    );
    sideShard.position.set(cx < 0 ? 0.6 : -0.6, 1.3 * scale, 0.4);
    sideShard.rotation.z = cx < 0 ? -0.35 : 0.35;
    cGrp.add(sideShard);
    cGrp.visible = false;
    scene.add(cGrp);
    shadowOnlyMeshes.push(cGrp);
  });

  // Interactive Reactor Console at (0, 0, -45)
  const reactorConsolePos = new THREE.Vector3(0, 0, -45);
  const consoleGroup = new THREE.Group();
  consoleGroup.position.copy(reactorConsolePos);
  const consolePedestal = new THREE.Mesh(
    track(new THREE.BoxGeometry(1.6, 1.2, 1.0)),
    metalTrimMat
  );
  consolePedestal.position.y = 0.6;
  consoleGroup.add(consolePedestal);
  const consoleScreen = new THREE.Mesh(
    track(new THREE.BoxGeometry(1.3, 0.55, 0.15)),
    cyanNeonMat
  );
  consoleScreen.position.set(0, 1.35, 0);
  consoleScreen.rotation.x = -0.35;
  consoleGroup.add(consoleScreen);
  scene.add(consoleGroup);

  // Boss Phase 3 Floor Hazard Rings
  const hazardRings: THREE.Mesh[] = [];
  const hazardPositions: [number, number][] = [
    [-7, -54],
    [7, -54],
    [-6, -64],
    [6, -64],
  ];
  hazardPositions.forEach(([hx, hz]) => {
    const rMesh = new THREE.Mesh(
      track(new THREE.RingGeometry(0.4, 3.8, 28)),
      track(
        new THREE.MeshBasicMaterial({
          color: PALETTE.dangerRed,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      )
    );
    rMesh.rotation.x = -Math.PI / 2;
    rMesh.position.set(hx, 0.04, hz);
    scene.add(rMesh);
    hazardRings.push(rMesh);
  });

  // =========================================================================
  // 3 COLLECTIBLE ENERGY CORES
  // =========================================================================
  const coreDefs = [
    { id: 1, x: 11.5, y: 1.8, z: 22.5, shadowOnly: false, label: 'Sector 01 Plaza Core' },
    { id: 2, x: -13.0, y: 0.0, z: -14.0, shadowOnly: true, label: 'Shadow Vault Core' },
    { id: 3, x: 13.5, y: 2.9, z: -21.5, shadowOnly: true, label: 'Echo Skywalk Core' },
  ];
  const cores: CollectibleCore[] = coreDefs.map((cd) => {
    const mesh = createEnergyCoreModel(cd.shadowOnly);
    mesh.position.set(cd.x, cd.y, cd.z);
    mesh.visible = !cd.shadowOnly;
    scene.add(mesh);
    return { ...cd, collected: false, mesh };
  });

  // =========================================================================
  // AMBIENT FLOATING DUST / SPARK PARTICLES
  // =========================================================================
  const dustCount = 240;
  const dustPositions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPositions[i * 3] = (Math.random() - 0.5) * 60;
    dustPositions[i * 3 + 1] = 0.5 + Math.random() * 14;
    dustPositions[i * 3 + 2] = 45 - Math.random() * 130;
  }
  const dustGeo = track(new THREE.BufferGeometry());
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dustMat = track(
    new THREE.PointsMaterial({
      color: PALETTE.primaryCyan,
      size: 0.16,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  const ambientParticles = new THREE.Points(dustGeo, dustMat);
  scene.add(ambientParticles);

  const updateDimensionVisuals = (dim: DimensionMode, elapsed: number) => {
    const isShadow = dim === 'shadow';
    realityOnlyMeshes.forEach((m) => {
      if (m instanceof THREE.Mesh) {
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.opacity = isShadow ? 0.12 : 0.58;
        mat.emissiveIntensity = isShadow ? 0.25 : 1.1;
      }
    });
    shadowOnlyMeshes.forEach((m) => {
      m.visible = isShadow;
    });
    cores.forEach((c) => {
      if (c.collected) {
        c.mesh.visible = false;
      } else {
        c.mesh.visible = !c.shadowOnly || isShadow;
        c.mesh.rotation.y = elapsed * 1.4;
        const crystal = c.mesh.getObjectByName('crystal');
        if (crystal) {
          crystal.position.y = 1.35 + Math.sin(elapsed * 2.5 + c.id) * 0.14;
        }
        const r1 = c.mesh.getObjectByName('ring1');
        const r2 = c.mesh.getObjectByName('ring2');
        if (r1) r1.rotation.x = elapsed * 1.1;
        if (r2) r2.rotation.y = elapsed * 1.6;
      }
    });
    dustMat.color.setHex(isShadow ? PALETTE.shadowPurple : PALETTE.primaryCyan);
    ambientParticles.position.y = Math.sin(elapsed * 0.5) * 0.35;

    reactorRings.forEach((ring, i) => {
      ring.rotation.z = elapsed * (0.6 + i * 0.25) * (i % 2 === 0 ? 1 : -1);
    });
  };

  const setReactorGateOpen = (open: boolean) => {
    reactorGateMesh.visible = !open;
    reactorGateCollider.minY = open ? -20 : 0;
    reactorGateCollider.maxY = open ? -19 : 6.5;
  };

  const setReactorActivated = (active: boolean) => {
    const coreMat = spireCore.material as THREE.MeshStandardMaterial;
    const beamMat = reactorBeamMesh.material as THREE.MeshBasicMaterial;
    if (active) {
      coreMat.emissive.setHex(PALETTE.primaryCyan);
      coreMat.emissiveIntensity = 3.0;
      beamMat.opacity = 0.45;
      beamMat.color.setHex(PALETTE.primaryCyan);
    } else {
      coreMat.emissive.setHex(PALETTE.dangerRed);
      coreMat.emissiveIntensity = 1.8;
      beamMat.opacity = 0.14;
    }
  };

  return {
    colliders,
    raycastWalls,
    realityOnlyMeshes,
    shadowOnlyMeshes,
    reactorGateMesh,
    reactorGateCollider,
    reactorConsolePos,
    reactorBeamMesh,
    reactorRings,
    hazardRings,
    cores,
    ambientParticles,
    updateDimensionVisuals,
    setReactorGateOpen,
    setReactorActivated,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
