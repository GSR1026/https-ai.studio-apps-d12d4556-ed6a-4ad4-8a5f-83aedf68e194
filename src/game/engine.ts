import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { AudioManager } from './audio';
import {
  createBossModel,
  createGuardianModel,
  createHunterModel,
  createScoutModel,
  createSentinelModel,
  type EnemyRig,
  type GuardianRig,
} from './models';
import { ParticleAndBoltPool } from './particles';
import {
  ECHO_CONFIG,
  computeShotDamage,
  getMissionObjectiveText,
  resolveBossPhase,
  resolveCylinderObstacles,
  resolveZoneFromZ,
  stepEchoShift,
  tryToggleEchoShift,
  type EchoShiftState,
} from './rules';
import { createProceduralTextures, type ProceduralTextures } from './textures';
import {
  PALETTE,
  type AudioSettings,
  type DimensionMode,
  type EnemyAIState,
  type EnemyKind,
  type GamePhase,
  type HudSnapshot,
  type RunSummary,
  type TargetHudSnapshot,
} from './types';
import { buildCityWorld, type WorldArena } from './world';

interface EnemyEntity {
  id: string;
  kind: EnemyKind | 'boss';
  name: string;
  rig: EnemyRig;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  radius: number;
  height: number;
  hp: number;
  maxHp: number;
  speed: number;
  patrolOriginX: number;
  patrolOriginZ: number;
  patrolAngle: number;
  aiState: EnemyAIState;
  stateTimer: number;
  attackCooldown: number;
  hitFlashTimer: number;
  koTimer: number;
  bossPhase: 1 | 2 | 3;
  shieldActive: boolean;
  hitboxMesh: THREE.Mesh;
  weakPointHitMesh: THREE.Mesh;
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _fogColorReality = new THREE.Color(PALETTE.realityFog);
const _fogColorShadow = new THREE.Color(PALETTE.shadowFog);
const _skyColorReality = new THREE.Color(0x070b18);
const _skyColorShadow = new THREE.Color(0x160626);
const _keyColorReality = new THREE.Color(0xdbeafe);
const _keyColorShadow = new THREE.Color(0xe879f9);

export interface EngineCallbacks {
  onHudUpdate: (hud: HudSnapshot) => void;
  onRunComplete: (summary: RunSummary) => void;
  onPhaseChange: (phase: GamePhase) => void;
}

export class ShadowProtocolEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private isSoftwareGl: boolean;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private textures: ProceduralTextures;
  private world: WorldArena;
  private pool: ParticleAndBoltPool;
  public audio: AudioManager;

  private hemiLight: THREE.HemisphereLight;
  private keyLight: THREE.DirectionalLight;
  private rimLight: THREE.DirectionalLight;
  private playerLight: THREE.PointLight;

  private guardian: GuardianRig;
  private enemies: EnemyEntity[] = [];
  private bossEntity: EnemyEntity | null = null;
  private raycaster = new THREE.Raycaster();

  // Loop & lifecycle
  private frameId = 0;
  private lastTime = 0;
  private disposed = false;
  private resizeObserver: ResizeObserver;

  // Game State
  private phase: GamePhase = 'title';
  private elapsedTime = 0;
  private titleOrbitTime = 0;
  private score = 0;
  private enemiesDefeated = 0;
  private reactorGateOpen = false;
  private reactorActivated = false;
  private bossDefeated = false;
  private victoryDelayTimer = 0;
  private defeatDelayTimer = 0;

  // Echo Shift
  private echoState: EchoShiftState = {
    dimension: 'reality',
    energy: ECHO_CONFIG.maxEnergy,
    maxEnergy: ECHO_CONFIG.maxEnergy,
    cooldown: 0,
  };
  private echoVisualBlend = 0; // 0 = reality, 1 = shadow
  private echoTransitionBurst = 0;

  // Player state
  private px = 0;
  private py = 0;
  private pz = 42;
  private pvx = 0;
  private pvy = 0;
  private pvz = 0;
  private playerYaw = 0; // 0 faces -Z
  private onGround = true;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private dashTimer = 0;
  private dashCooldown = 0;
  private dashDirX = 0;
  private dashDirZ = -1;
  private walkCycle = 0;
  private stepSoundCooldown = 0;
  private playerScaleY = 1;
  private playerScaleXZ = 1;
  private playerHurtFlash = 0;

  // Health & Weapon
  private hp = 100;
  private maxHp = 100;
  private ammo = 24;
  private maxAmmo = 24;
  private reloading = false;
  private reloadTimer = 0;
  private fireCooldown = 0;
  private recoilTimer = 0;
  private muzzleTimer = 0;

  // Camera
  private camYaw = 0;
  private camPitch = 0.22;
  private camPos = new THREE.Vector3(0, 4, 48);
  private camLook = new THREE.Vector3(0, 1.8, 36);
  private trauma = 0;
  private hitstopTimer = 0;

  // Feedback & HUD throttling
  private hitMarkerTimer = 0;
  private critMarker = false;
  private damageFlash = 0;
  private targetEnemyHud: TargetHudSnapshot | null = null;
  private hudEmitAccum = 0;
  private hazardCycleTimer = 0;
  private hazardActive = false;

  // Inputs
  private keys = new Set<string>();
  private justPressed = new Set<string>();
  private mouseDown = false;
  private pointerLocked = false;
  private isDraggingLook = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.audio = new AudioManager();

    // Detect software WebGL once
    this.isSoftwareGl = (() => {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 240);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: this.isSoftwareGl,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.setAttribute('data-testid', 'game-canvas');
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.background);
    this.scene.fog = new THREE.FogExp2(PALETTE.realityFog, 0.0068);

    this.camera = new THREE.PerspectiveCamera(62, width / height, 0.15, 240);

    // Procedural Studio Environment Map (RoomEnvironment)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // Lighting Rig
    this.hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 1.35);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xdbeafe, 1.85);
    this.keyLight.position.set(22, 42, 26);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 2;
    this.keyLight.shadow.camera.far = 140;
    this.keyLight.shadow.camera.left = -45;
    this.keyLight.shadow.camera.right = 45;
    this.keyLight.shadow.camera.top = 45;
    this.keyLight.shadow.camera.bottom = -45;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(0xa855f7, 0.72);
    this.rimLight.position.set(-28, 18, -50);
    this.scene.add(this.rimLight);

    this.playerLight = new THREE.PointLight(PALETTE.primaryCyan, 2.5, 14, 1.8);
    this.scene.add(this.playerLight);

    // Zone Accent PointLights (within budget <= 4 unshadowed PointLights)
    const z2Light = new THREE.PointLight(PALETTE.shadowPurple, 5.5, 28, 1.6);
    z2Light.position.set(0, 6, -14);
    this.scene.add(z2Light);

    const reactorLight = new THREE.PointLight(PALETTE.primaryCyan, 7.0, 38, 1.4);
    reactorLight.position.set(0, 10, -72);
    this.scene.add(reactorLight);

    // Textures, World, Particles, Player
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createProceduralTextures(maxAniso);
    this.world = buildCityWorld(this.scene, this.textures);
    this.pool = new ParticleAndBoltPool(this.scene);

    this.guardian = createGuardianModel(this.textures);
    this.guardian.root.position.set(this.px, this.py, this.pz);
    this.scene.add(this.guardian.root);

    this.spawnInitialEnemies();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);

    this.lastTime = performance.now();
    this.updateIdleWorldPreview(0);
    this.world.updateDimensionVisuals('reality', 0);
    this.renderer.render(this.scene, this.camera);
    this.emitHud();
    this.startLoop();
  }

  private spawnInitialEnemies() {
    // Clear existing enemies
    for (const e of this.enemies) {
      this.scene.remove(e.rig.root);
    }
    this.enemies = [];
    this.bossEntity = null;

    const specs: {
      id: string;
      kind: EnemyKind;
      x: number;
      z: number;
    }[] = [
      { id: 'scout_1', kind: 'scout', x: -3.5, z: 26 },
      { id: 'scout_2', kind: 'scout', x: 6.5, z: 16 },
      { id: 'hunter_1', kind: 'hunter', x: 1.5, z: 12 },
      { id: 'scout_3', kind: 'scout', x: -2.0, z: -7 },
      { id: 'hunter_2', kind: 'hunter', x: -4.5, z: -21 },
      { id: 'sentinel_1', kind: 'sentinel', x: 0, z: -17 },
    ];

    for (const s of specs) {
      this.enemies.push(this.createEnemyEntity(s.id, s.kind, s.x, s.z));
    }
  }

  private createEnemyEntity(
    id: string,
    kind: EnemyKind | 'boss',
    x: number,
    z: number
  ): EnemyEntity {
    let rig: EnemyRig;
    let name = 'Shadow Scout';
    let maxHp = 55;
    let speed = 5.4;
    let radius = 0.7;
    let height = 2.4;

    if (kind === 'scout') {
      rig = createScoutModel(this.textures);
      name = 'Shadow Scout';
      maxHp = 55;
      speed = 5.6;
      radius = 0.72;
      height = 2.5;
    } else if (kind === 'hunter') {
      rig = createHunterModel(this.textures);
      name = 'Shadow Hunter';
      maxHp = 95;
      speed = 6.2;
      radius = 0.75;
      height = 2.1;
    } else if (kind === 'sentinel') {
      rig = createSentinelModel(this.textures);
      name = 'Shadow Sentinel';
      maxHp = 180;
      speed = 2.8;
      radius = 1.2;
      height = 2.9;
    } else {
      rig = createBossModel(this.textures);
      name = 'THE SHADOW GUARDIAN';
      maxHp = 650;
      speed = 3.8;
      radius = 2.2;
      height = 5.2;
    }

    rig.root.position.set(x, 0, z);

    // Simplified invisible hitbox meshes for snappy raycast aiming
    const hitGeo = new THREE.BoxGeometry(radius * 2.1, height, radius * 2.1);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitboxMesh = new THREE.Mesh(hitGeo, hitMat);
    hitboxMesh.position.y = height * 0.5;
    hitboxMesh.userData = { enemyId: id, isWeakPoint: false };
    rig.root.add(hitboxMesh);

    const wpRadius = kind === 'boss' ? 0.95 : kind === 'sentinel' ? 0.58 : 0.42;
    const wpHitMesh = new THREE.Mesh(
      new THREE.SphereGeometry(wpRadius, 8, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    rig.weakPoint.getWorldPosition(_v1);
    wpHitMesh.position.copy(rig.weakPoint.position);
    // Lift into body local height
    wpHitMesh.position.y += rig.body.position.y;
    wpHitMesh.userData = { enemyId: id, isWeakPoint: true };
    rig.root.add(wpHitMesh);

    this.scene.add(rig.root);

    return {
      id,
      kind,
      name,
      rig,
      x,
      y: 0,
      z,
      vx: 0,
      vz: 0,
      yaw: 0,
      radius,
      height,
      hp: maxHp,
      maxHp,
      speed,
      patrolOriginX: x,
      patrolOriginZ: z,
      patrolAngle: Math.random() * Math.PI * 2,
      aiState: kind === 'boss' ? 'chase' : 'patrol',
      stateTimer: 0,
      attackCooldown: 1.0 + Math.random() * 0.8,
      hitFlashTimer: 0,
      koTimer: 0,
      bossPhase: 1,
      shieldActive: false,
      hitboxMesh,
      weakPointHitMesh: wpHitMesh,
    };
  }

  // =========================================================================
  // PUBLIC GAME LIFECYCLE CONTROLS
  // =========================================================================

  public startMission() {
    this.audio.unlock();
    this.resetMissionState();
    this.setPhase('playing');
  }

  public restartMission() {
    this.audio.unlock();
    this.resetMissionState();
    this.setPhase('playing');
  }

  public pauseGame() {
    if (this.phase !== 'playing') return;
    this.keys.clear();
    this.justPressed.clear();
    this.mouseDown = false;
    document.exitPointerLock?.();
    this.audio.setPaused(true);
    this.setPhase('paused');
  }

  public resumeGame() {
    if (this.phase !== 'paused') return;
    this.audio.unlock();
    this.audio.setPaused(false);
    this.keys.clear();
    this.justPressed.clear();
    this.setPhase('playing');
  }

  public returnToTitle() {
    document.exitPointerLock?.();
    this.keys.clear();
    this.justPressed.clear();
    this.mouseDown = false;
    this.resetMissionState();
    this.audio.setPaused(false);
    this.setPhase('title');
  }

  public updateSettings(next: Partial<AudioSettings>) {
    this.audio.updateSettings(next);
  }

  private setPhase(next: GamePhase) {
    this.phase = next;
    if (next === 'title') document.body.dataset.state = 'title';
    else if (next === 'playing') document.body.dataset.state = 'playing';
    else if (next === 'paused') document.body.dataset.state = 'paused';
    else document.body.dataset.state = 'gameover';

    this.callbacks.onPhaseChange(next);
    this.emitHud();
  }

  private resetMissionState() {
    this.px = 0;
    this.py = 0;
    this.pz = 42;
    this.pvx = 0;
    this.pvy = 0;
    this.pvz = 0;
    this.playerYaw = 0;
    this.camYaw = 0;
    this.camPitch = 0.22;
    this.onGround = true;
    this.hp = this.maxHp;
    this.ammo = this.maxAmmo;
    this.reloading = false;
    this.reloadTimer = 0;
    this.fireCooldown = 0;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.score = 0;
    this.enemiesDefeated = 0;
    this.elapsedTime = 0;
    this.reactorGateOpen = false;
    this.reactorActivated = false;
    this.bossDefeated = false;
    this.victoryDelayTimer = 0;
    this.defeatDelayTimer = 0;
    this.hitstopTimer = 0;
    this.trauma = 0;
    this.damageFlash = 0;
    this.hitMarkerTimer = 0;
    this.targetEnemyHud = null;
    this.hazardActive = false;
    this.hazardCycleTimer = 0;
    this.world.hazardRings.forEach((r) => {
      (r.material as THREE.MeshBasicMaterial).opacity = 0;
    });

    this.echoState = {
      dimension: 'reality',
      energy: ECHO_CONFIG.maxEnergy,
      maxEnergy: ECHO_CONFIG.maxEnergy,
      cooldown: 0,
    };
    this.echoVisualBlend = 0;
    this.audio.setAmbienceDimension('reality');

    this.world.setReactorGateOpen(false);
    this.world.setReactorActivated(false);
    for (const c of this.world.cores) {
      c.collected = false;
      c.mesh.visible = !c.shadowOnly;
    }

    this.pool.clearBolts();
    this.spawnInitialEnemies();

    this.guardian.root.position.set(this.px, this.py, this.pz);
    this.guardian.root.rotation.y = this.playerYaw;
    this.camPos.set(0.6, 3.2, 47.6);
    this.camLook.set(0, 1.8, 34);
  }

  // =========================================================================
  // INPUT & WINDOW EVENTS
  // =========================================================================

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (this.phase === 'playing') {
        e.preventDefault();
        this.pauseGame();
        return;
      } else if (this.phase === 'paused') {
        e.preventDefault();
        this.resumeGame();
        return;
      }
    }

    if (this.phase === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
      e.preventDefault();
      this.startMission();
      return;
    }

    if (this.phase !== 'playing') return;

    if (!this.keys.has(e.code)) {
      this.justPressed.add(e.code);
    }
    this.keys.add(e.code);

    if (e.code === 'Space') {
      this.jumpBufferTimer = 0.14;
      e.preventDefault();
    }
    if (e.code === 'KeyQ') {
      this.handleEchoShiftToggle();
    }
    if (e.code === 'KeyE') {
      this.handleInteract();
    }
    if (e.code === 'KeyR') {
      this.startReload();
    }
    if (e.code === 'KeyM') {
      const s = this.audio.getSettings();
      this.audio.updateSettings({ muted: !s.muted });
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
    if (e.code === 'Space' && this.pvy > 2.0) {
      this.pvy *= 0.48; // variable jump cut
    }
  };

  private onPointerDown = (e: PointerEvent) => {
    if (this.phase !== 'playing') return;
    if (e.target !== this.renderer.domElement) return;
    this.audio.unlock();

    if (e.button === 0) {
      this.mouseDown = true;
      this.isDraggingLook = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.tryFireWeapon();

      // Request pointer lock cleanly when supported
      if (!this.pointerLocked && this.renderer.domElement.requestPointerLock) {
        try {
          const p = this.renderer.domElement.requestPointerLock() as unknown as
            | Promise<void>
            | undefined;
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } catch {}
      }
    }
  };

  private onPointerUp = () => {
    this.mouseDown = false;
    this.isDraggingLook = false;
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.phase !== 'playing') return;
    const sens = 0.0024 * this.audio.getSettings().mouseSensitivity;
    if (document.pointerLockElement === this.renderer.domElement) {
      // Guard against browser synthetic pointer-lock activation spikes
      if (Math.abs(e.movementX) > 140 || Math.abs(e.movementY) > 140) return;
      this.camYaw -= e.movementX * sens;
      this.camPitch = THREE.MathUtils.clamp(
        this.camPitch + e.movementY * sens * 0.85,
        -0.38,
        0.65
      );
    } else if (this.isDraggingLook) {
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.camYaw -= dx * sens * 1.4;
      this.camPitch = THREE.MathUtils.clamp(
        this.camPitch + dy * sens * 1.1,
        -0.38,
        0.65
      );
    }
  };

  private onPointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
  };

  private onBlur = () => {
    this.keys.clear();
    this.justPressed.clear();
    this.mouseDown = false;
    this.isDraggingLook = false;
  };

  private bindEvents() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
  }

  private unbindEvents() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
  }

  private handleResize() {
    const w = Math.max(this.container.clientWidth, 320);
    const h = Math.max(this.container.clientHeight, 240);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.render(this.scene, this.camera);
  }

  // =========================================================================
  // GAMEPLAY ACTIONS
  // =========================================================================

  private handleEchoShiftToggle() {
    const res = tryToggleEchoShift(this.echoState);
    if (!res.switched) return;
    this.echoState = res.next;
    const toShadow = this.echoState.dimension === 'shadow';
    this.echoTransitionBurst = 1.0;
    this.audio.playEchoShift(toShadow);
    this.audio.setAmbienceDimension(this.echoState.dimension);
    this.pool.spawnBurst(
      this.px,
      this.py + 1.1,
      this.pz,
      toShadow ? PALETTE.shadowPurple : PALETTE.primaryCyan,
      18,
      7.5,
      1.15,
      0.5,
      -2
    );
    this.trauma = Math.min(1, this.trauma + 0.22);
    this.emitHud();
  }

  private handleInteract() {
    // 1) Check Reactor Console activation
    const distConsole = Math.hypot(
      this.px - this.world.reactorConsolePos.x,
      this.pz - this.world.reactorConsolePos.z
    );
    if (
      !this.reactorActivated &&
      this.reactorGateOpen &&
      distConsole < 4.8
    ) {
      this.activateReactorAndSpawnBoss();
      return;
    }

    // 2) Manual core collection if near (auto-collect also triggers on walk-up)
    for (const c of this.world.cores) {
      if (c.collected) continue;
      if (c.shadowOnly && this.echoState.dimension !== 'shadow') continue;
      const dist = Math.hypot(this.px - c.x, this.pz - c.z);
      if (dist < 3.4 && Math.abs(this.py - c.y) < 2.6) {
        this.collectCore(c);
        return;
      }
    }
  }

  private collectCore(c: WorldArena['cores'][number]) {
    if (c.collected) return;
    c.collected = true;
    c.mesh.visible = false;
    this.score += 300;
    this.audio.playCoreCollect();
    this.pool.spawnBurst(c.x, c.y + 1.2, c.z, PALETTE.energyGold, 24, 8, 1.3, 0.65, -3);
    this.echoState.energy = this.echoState.maxEnergy;

    const collectedCount = this.world.cores.filter((core) => core.collected).length;
    if (collectedCount >= this.world.cores.length && !this.reactorGateOpen) {
      this.reactorGateOpen = true;
      this.world.setReactorGateOpen(true);
      this.pool.spawnBurst(0, 3, -32, PALETTE.primaryCyan, 28, 9, 1.4, 0.7, -2);
    }
    this.emitHud();
  }

  private activateReactorAndSpawnBoss() {
    this.reactorActivated = true;
    this.audio.playBossIntro();
    this.trauma = Math.min(1, this.trauma + 0.45);
    this.pool.spawnBurst(0, 2, -62, PALETTE.dangerRed, 32, 11, 1.6, 0.75, -4);

    // Seal reactor entrance behind player during boss battle
    this.world.setReactorGateOpen(false);
    this.bossEntity = this.createEnemyEntity('boss_guardian', 'boss', 0, -64);
    this.enemies.push(this.bossEntity);
    this.emitHud();
  }

  private startReload() {
    if (this.reloading || this.ammo >= this.maxAmmo) return;
    this.reloading = true;
    this.reloadTimer = 1.05;
  }

  private tryFireWeapon() {
    if (this.phase !== 'playing') return;
    if (this.reloading || this.fireCooldown > 0) return;
    if (this.ammo <= 0) {
      this.startReload();
      return;
    }

    this.ammo -= 1;
    this.fireCooldown = 0.16;
    this.recoilTimer = 0.1;
    this.muzzleTimer = 0.06;
    this.guardian.muzzleFlash.visible = true;
    this.audio.playShoot();

    // Face camera aim yaw when shooting
    this.playerYaw = this.camYaw;

    // Raycast from camera center crosshair
    this.raycaster.setFromCamera(_v2_zero, this.camera);
    _rayOrigin.copy(this.raycaster.ray.origin);
    _rayDir.copy(this.raycaster.ray.direction);

    // Collect live enemy hitboxes + world walls
    const targets: THREE.Object3D[] = [];
    for (const e of this.enemies) {
      if (e.aiState === 'dead') continue;
      targets.push(e.weakPointHitMesh);
      targets.push(e.hitboxMesh);
    }
    for (const w of this.world.raycastWalls) {
      targets.push(w);
    }

    const hits = this.raycaster.intersectObjects(targets, false);
    this.guardian.muzzlePoint.getWorldPosition(_v1);

    let endPoint = _v2.copy(_rayOrigin).addScaledVector(_rayDir, 65);
    let hitEnemy: EnemyEntity | null = null;
    let hitWeakPoint = false;

    for (const h of hits) {
      // Skip hits behind player camera
      if (h.distance < 2.2) continue;
      endPoint.copy(h.point);
      const ud = h.object.userData;
      if (ud && ud.enemyId) {
        hitEnemy = this.enemies.find((en) => en.id === ud.enemyId) || null;
        hitWeakPoint = Boolean(ud.isWeakPoint);
      }
      break;
    }

    // Spawn fast visible plasma tracer bolt from muzzle toward endPoint
    const boltDir = _v3.copy(endPoint).sub(_v1).normalize();
    const boltColor =
      this.echoState.dimension === 'shadow' ? PALETTE.shadowPurple : PALETTE.primaryCyan;
    this.pool.spawnBolt(
      _v1.x,
      _v1.y,
      _v1.z,
      boltDir.x * 78,
      boltDir.y * 78,
      boltDir.z * 78,
      boltColor,
      0,
      true
    );

    if (hitEnemy) {
      const dmg = computeShotDamage({
        baseDamage: 26,
        enemyKind: hitEnemy.kind,
        dimension: this.echoState.dimension,
        hitWeakPoint,
        bossPhase: hitEnemy.bossPhase,
        bossShieldActive: hitEnemy.shieldActive,
      });

      hitEnemy.hp = Math.max(0, hitEnemy.hp - dmg.damage);
      hitEnemy.hitFlashTimer = 0.08;
      this.hitMarkerTimer = 0.16;
      this.critMarker = dmg.isCrit;

      this.targetEnemyHud = {
        name: hitEnemy.name,
        hp: hitEnemy.hp,
        maxHp: hitEnemy.maxHp,
        armored: dmg.wasBlocked,
        weakPointExposed:
          this.echoState.dimension === 'shadow' &&
          (hitEnemy.kind === 'sentinel' || hitEnemy.kind === 'boss'),
      };

      this.audio.playHit(dmg.isCrit, dmg.wasBlocked);
      this.pool.spawnBurst(
        endPoint.x,
        endPoint.y,
        endPoint.z,
        dmg.isCrit ? PALETTE.energyGold : dmg.wasBlocked ? 0x94a3b8 : boltColor,
        dmg.isCrit ? 14 : 7,
        dmg.isCrit ? 8 : 5,
        dmg.isCrit ? 1.2 : 0.85,
        0.35,
        -5
      );

      if (dmg.isCrit) {
        this.hitstopTimer = 0.032;
        this.trauma = Math.min(1, this.trauma + 0.14);
      }

      if (hitEnemy.hp <= 0) {
        this.killEnemy(hitEnemy);
      } else if (hitEnemy.aiState === 'patrol' || hitEnemy.aiState === 'idle') {
        hitEnemy.aiState = 'chase';
      }
    } else {
      // Wall spark impact
      this.pool.spawnBurst(
        endPoint.x,
        endPoint.y,
        endPoint.z,
        boltColor,
        5,
        4.5,
        0.75,
        0.25,
        -4
      );
    }

    if (this.ammo === 0) {
      this.startReload();
    }
  }

  private killEnemy(enemy: EnemyEntity) {
    enemy.aiState = 'dead';
    enemy.koTimer = enemy.kind === 'boss' ? 0.9 : 0.38;
    this.enemiesDefeated += 1;
    const pts =
      enemy.kind === 'boss'
        ? 1500
        : enemy.kind === 'sentinel'
        ? 350
        : enemy.kind === 'hunter'
        ? 180
        : 120;
    this.score += pts;

    const isBoss = enemy.kind === 'boss';
    this.audio.playEnemyExplode(isBoss);
    this.hitstopTimer = isBoss ? 0.08 : 0.045;
    this.trauma = Math.min(1, this.trauma + (isBoss ? 0.65 : 0.25));
    this.pool.spawnBurst(
      enemy.x,
      enemy.y + enemy.height * 0.5,
      enemy.z,
      isBoss ? PALETTE.energyGold : PALETTE.dangerRed,
      isBoss ? 48 : 22,
      isBoss ? 13 : 8,
      isBoss ? 1.8 : 1.15,
      isBoss ? 0.9 : 0.55,
      -6
    );

    if (isBoss) {
      this.bossDefeated = true;
      this.hazardActive = false;
      this.world.hazardRings.forEach((r) => {
        (r.material as THREE.MeshBasicMaterial).opacity = 0;
      });
      this.world.setReactorActivated(true);
      this.world.setReactorGateOpen(true);
      this.audio.playVictory();
      this.victoryDelayTimer = 1.25;
    }
  }

  private damagePlayer(amount: number) {
    if (this.phase !== 'playing' || this.hp <= 0 || this.dashTimer > 0) return;
    this.hp = Math.max(0, this.hp - amount);
    this.damageFlash = 1.0;
    this.playerHurtFlash = 0.14;
    this.trauma = Math.min(1, this.trauma + 0.35);
    this.audio.playPlayerHurt();

    if (this.hp <= 0) {
      this.defeatDelayTimer = 0.55;
      this.pool.spawnBurst(this.px, this.py + 1, this.pz, PALETTE.dangerRed, 24, 7, 1.1, 0.6, -5);
    }
  }

  // =========================================================================
  // MAIN SIMULATION LOOP
  // =========================================================================

  private startLoop() {
    const tick = () => {
      if (this.disposed) return;
      const now = performance.now();
      const rawDt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      const totalDt = Math.min(Math.max(rawDt, 0.001), 0.24);
      // Sub-step into <= 0.045s physics slices so software WebGL stays real-time without tunneling
      const steps = Math.max(1, Math.ceil(totalDt / 0.045));
      const subDt = totalDt / steps;
      for (let i = 0; i < steps; i++) {
        this.update(subDt);
      }
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.afterDraw(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
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

  private update(dt: number) {
    if (this.phase === 'title') {
      this.titleOrbitTime += dt;
      this.world.updateDimensionVisuals('reality', this.titleOrbitTime);
      this.updateIdleWorldPreview(this.titleOrbitTime);
      return;
    }

    if (this.phase !== 'playing') {
      return;
    }

    // Visual-only timers run even during hitstop
    this.hitMarkerTimer = Math.max(0, this.hitMarkerTimer - dt);
    this.damageFlash = Math.max(0, this.damageFlash - dt * 2.6);
    this.echoTransitionBurst = Math.max(0, this.echoTransitionBurst - dt * 2.4);
    this.trauma = Math.max(0, this.trauma - dt * 1.9);
    this.muzzleTimer = Math.max(0, this.muzzleTimer - dt);
    if (this.muzzleTimer <= 0) {
      this.guardian.muzzleFlash.visible = false;
    }

    if (this.victoryDelayTimer > 0) {
      this.victoryDelayTimer -= dt;
      this.pool.update(dt);
      this.updateDimensionVisualsBlend(dt);
      this.updateCamera(dt);
      if (this.victoryDelayTimer <= 0) {
        this.finishRun(true);
      }
      return;
    }

    if (this.defeatDelayTimer > 0) {
      this.defeatDelayTimer -= dt;
      this.pool.update(dt);
      this.updateCamera(dt);
      if (this.defeatDelayTimer <= 0) {
        this.finishRun(false);
      }
      return;
    }

    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.updateCamera(dt);
      return;
    }

    this.elapsedTime += dt;

    // 1. Echo Shift energy step
    const echoRes = stepEchoShift(this.echoState, dt);
    this.echoState = echoRes.next;
    if (echoRes.forcedReturnToReality) {
      this.echoTransitionBurst = 0.85;
      this.audio.playEchoShift(false);
      this.audio.setAmbienceDimension('reality');
    }
    this.updateDimensionVisualsBlend(dt);

    // 2. Player Movement, Weapon, Collectibles
    this.updatePlayer(dt);
    this.updateCollectibles();

    // 3. Enemies & Boss AI
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.pool.update(dt);

    // 4. Camera
    this.updateCamera(dt);

    // 5. Throttled HUD Sync (~12Hz)
    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.08) {
      this.hudEmitAccum = 0;
      this.emitHud();
    }

    this.justPressed.clear();
  }

  private updateIdleWorldPreview(t: number) {
    // Cinematic flyover framing the Fallen City boulevard & Central Reactor Spire in the right two-thirds
    const sway = Math.sin(t * 0.22) * 3.5;
    this.camera.position.set(-9.5 + sway, 6.2 + Math.sin(t * 0.35) * 0.8, 49);
    this.camera.lookAt(5, 4.2, -16);
    this.guardian.reactorCore.rotation.y = t * 1.8;
  }

  private updateDimensionVisualsBlend(dt: number) {
    const targetBlend = this.echoState.dimension === 'shadow' ? 1 : 0;
    this.echoVisualBlend = THREE.MathUtils.damp(this.echoVisualBlend, targetBlend, 8.5, dt);

    const fog = this.scene.fog as THREE.FogExp2;
    fog.color.copy(_fogColorReality).lerp(_fogColorShadow, this.echoVisualBlend);
    (this.scene.background as THREE.Color)
      .copy(_skyColorReality)
      .lerp(_skyColorShadow, this.echoVisualBlend);
    this.keyLight.color.copy(_keyColorReality).lerp(_keyColorShadow, this.echoVisualBlend);

    this.world.updateDimensionVisuals(this.echoState.dimension, this.elapsedTime);

    const coreColor =
      this.echoState.dimension === 'shadow' ? PALETTE.shadowPurple : PALETTE.primaryCyan;
    (this.guardian.reactorCore.material as THREE.MeshStandardMaterial).color.setHex(coreColor);
    (this.guardian.reactorCore.material as THREE.MeshStandardMaterial).emissive.setHex(coreColor);
    (this.guardian.backCore.material as THREE.MeshStandardMaterial).color.setHex(coreColor);
    (this.guardian.backCore.material as THREE.MeshStandardMaterial).emissive.setHex(coreColor);
    this.playerLight.color.setHex(coreColor);
    this.playerLight.position.set(this.px, this.py + 2.2, this.pz);
  }

  private updatePlayer(dt: number) {
    // Keyboard camera yaw assist (ArrowLeft / ArrowRight)
    if (this.keys.has('ArrowLeft')) this.camYaw += 2.1 * dt;
    if (this.keys.has('ArrowRight')) this.camYaw -= 2.1 * dt;

    // Reload & firing cooldown
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.recoilTimer = Math.max(0, this.recoilTimer - dt);
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        this.ammo = this.maxAmmo;
      }
    }
    if (this.mouseDown) {
      this.tryFireWeapon();
    }

    // Movement Input relative to camera yaw
    let moveForward = 0;
    let moveRight = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) moveForward += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) moveForward -= 1;
    if (this.keys.has('KeyD')) moveRight += 1;
    if (this.keys.has('KeyA')) moveRight -= 1;

    const fwdX = -Math.sin(this.camYaw);
    const fwdZ = -Math.cos(this.camYaw);
    const rightX = Math.cos(this.camYaw);
    const rightZ = -Math.sin(this.camYaw);

    let wishX = fwdX * moveForward + rightX * moveRight;
    let wishZ = fwdZ * moveForward + rightZ * moveRight;
    const wishLen = Math.hypot(wishX, wishZ);
    if (wishLen > 0.001) {
      wishX /= wishLen;
      wishZ /= wishLen;
    }

    // Dash
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    if (
      (this.justPressed.has('ShiftLeft') || this.justPressed.has('ShiftRight')) &&
      this.dashCooldown <= 0
    ) {
      this.dashTimer = 0.18;
      this.dashCooldown = 1.05;
      this.dashDirX = wishLen > 0.01 ? wishX : fwdX;
      this.dashDirZ = wishLen > 0.01 ? wishZ : fwdZ;
      this.audio.playDash();
      this.pool.spawnBurst(
        this.px,
        this.py + 0.9,
        this.pz,
        this.echoState.dimension === 'shadow' ? PALETTE.shadowPurple : PALETTE.primaryCyan,
        10,
        5,
        0.9,
        0.32,
        0
      );
    }

    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      this.pvx = this.dashDirX * 22;
      this.pvz = this.dashDirZ * 22;
    } else {
      const targetSpeed = 8.4;
      const accel = this.onGround ? 14 : 7;
      this.pvx = THREE.MathUtils.damp(this.pvx, wishX * targetSpeed, accel, dt);
      this.pvz = THREE.MathUtils.damp(this.pvz, wishZ * targetSpeed, accel, dt);
    }

    // Coyote time & Jump buffer
    this.coyoteTimer = this.onGround ? 0.11 : Math.max(0, this.coyoteTimer - dt);
    this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.pvy = 10.6;
      this.onGround = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this.playerScaleY = 1.18;
      this.playerScaleXZ = 0.86;
    }

    // Gravity
    this.pvy -= 26 * dt;

    // Integrate & resolve dimension-aware collisions
    this.px += this.pvx * dt;
    this.pz += this.pvz * dt;
    this.py += this.pvy * dt;

    const resolved = resolveCylinderObstacles(
      this.px,
      this.py,
      this.pz,
      0.55,
      1.85,
      this.world.colliders,
      this.echoState.dimension
    );
    this.px = THREE.MathUtils.clamp(resolved.x, -21.5, 21.5);
    this.pz = THREE.MathUtils.clamp(resolved.z, -83, 49.5);

    if (this.py <= resolved.floorY) {
      if (!this.onGround && this.pvy < -4) {
        this.playerScaleY = 0.8;
        this.playerScaleXZ = 1.16;
      }
      this.py = resolved.floorY;
      this.pvy = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    // Face movement or aiming direction
    const horizSpeed = Math.hypot(this.pvx, this.pvz);
    if (this.mouseDown || this.recoilTimer > 0) {
      this.playerYaw = this.camYaw;
    } else if (horizSpeed > 0.7) {
      const targetYaw = Math.atan2(-this.pvx, -this.pvz);
      let diff = targetYaw - this.playerYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.playerYaw += diff * Math.min(1, dt * 12);
    }

    // Procedural limb animation
    this.playerScaleY = THREE.MathUtils.damp(this.playerScaleY, 1, 14, dt);
    this.playerScaleXZ = THREE.MathUtils.damp(this.playerScaleXZ, 1, 14, dt);
    this.guardian.root.position.set(this.px, this.py, this.pz);
    this.guardian.root.rotation.y = this.playerYaw;
    this.guardian.root.scale.set(this.playerScaleXZ, this.playerScaleY, this.playerScaleXZ);

    if (this.onGround && horizSpeed > 0.8) {
      this.walkCycle += horizSpeed * dt * 1.15;
      const swing = Math.sin(this.walkCycle) * 0.55;
      this.guardian.leftLeg.rotation.x = swing;
      this.guardian.rightLeg.rotation.x = -swing;
      this.guardian.leftArm.rotation.x = -swing * 0.6;
      this.guardian.body.position.y = 0.95 + Math.abs(Math.sin(this.walkCycle)) * 0.06;

      this.stepSoundCooldown -= dt;
      if (this.stepSoundCooldown <= 0) {
        this.audio.playFootstep();
        this.stepSoundCooldown = 0.34;
      }
    } else {
      this.guardian.leftLeg.rotation.x = THREE.MathUtils.damp(
        this.guardian.leftLeg.rotation.x,
        this.onGround ? 0 : 0.35,
        10,
        dt
      );
      this.guardian.rightLeg.rotation.x = THREE.MathUtils.damp(
        this.guardian.rightLeg.rotation.x,
        this.onGround ? 0 : -0.25,
        10,
        dt
      );
      this.guardian.leftArm.rotation.x = THREE.MathUtils.damp(
        this.guardian.leftArm.rotation.x,
        0,
        10,
        dt
      );
      this.guardian.body.position.y =
        0.95 + Math.sin(this.elapsedTime * 2.5) * 0.025;
    }

    this.guardian.rightArm.rotation.x = this.recoilTimer > 0 ? 0.25 : 0;
    this.guardian.reactorCore.rotation.y += dt * 2.4;
    this.guardian.capePivot.rotation.x =
      0.08 + Math.min(0.45, horizSpeed * 0.045) + Math.sin(this.elapsedTime * 4.2) * 0.06;

    // Hurt emissive flash on guardian suit
    if (this.playerHurtFlash > 0) {
      this.playerHurtFlash -= dt;
      this.guardian.hitMaterials.forEach((m) => {
        m.emissive.setHex(PALETTE.dangerRed);
        m.emissiveIntensity = 1.2;
      });
    } else {
      this.guardian.hitMaterials.forEach((m) => {
        m.emissive.setHex(0x000000);
        m.emissiveIntensity = 0;
      });
    }
  }

  private updateCollectibles() {
    for (const c of this.world.cores) {
      if (c.collected) continue;
      if (c.shadowOnly && this.echoState.dimension !== 'shadow') continue;
      const dist = Math.hypot(this.px - c.x, this.pz - c.z);
      if (dist < 2.2 && Math.abs(this.py - c.y) < 2.1) {
        this.collectCore(c);
      }
    }
  }

  private updateEnemies(dt: number) {
    let activeAttackers = 0;
    for (const e of this.enemies) {
      if (e.aiState === 'windup' || e.aiState === 'attack') activeAttackers++;
    }

    const isShadow = this.echoState.dimension === 'shadow';

    for (const e of this.enemies) {
      // Hit flash decay
      if (e.hitFlashTimer > 0) {
        e.hitFlashTimer -= dt;
        e.rig.hitMaterials.forEach((m) => {
          m.emissive.setHex(0xffffff);
          m.emissiveIntensity = 1.1;
        });
      } else {
        e.rig.hitMaterials.forEach((m) => {
          m.emissive.setHex(0x000000);
          m.emissiveIntensity = 0;
        });
      }

      // KO animation
      if (e.aiState === 'dead') {
        e.koTimer -= dt;
        const t = Math.max(0, e.koTimer / (e.kind === 'boss' ? 0.9 : 0.38));
        e.rig.root.scale.setScalar(t);
        e.rig.root.rotation.x += dt * 4;
        if (e.koTimer <= 0) {
          e.rig.root.visible = false;
        }
        continue;
      }

      // Update weak point glow based on Echo Shift
      const wpMat = e.rig.weakPoint.material as THREE.MeshStandardMaterial;
      if (e.kind === 'sentinel' || e.kind === 'boss') {
        wpMat.emissive.setHex(isShadow ? PALETTE.energyGold : 0x475569);
        wpMat.emissiveIntensity = isShadow
          ? 2.8 + Math.sin(this.elapsedTime * 8) * 0.6
          : 0.25;
        e.rig.weakPoint.scale.setScalar(isShadow ? 1.22 : 0.85);
      }

      // Boss phase transitions & floor hazards
      if (e.kind === 'boss') {
        e.bossPhase = resolveBossPhase(e.hp, e.maxHp);
        e.shieldActive = e.bossPhase >= 2;
        if (e.rig.shieldMesh) {
          e.rig.shieldMesh.visible = e.shieldActive;
          const shMat = e.rig.shieldMesh.material as THREE.MeshBasicMaterial;
          shMat.color.setHex(isShadow ? PALETTE.shadowPurple : PALETTE.dangerRed);
          shMat.opacity = isShadow ? 0.14 : 0.28;
          e.rig.shieldMesh.rotation.y += dt * 1.1;
        }
        if (e.rig.pylons) {
          e.rig.pylons.rotation.y += dt * (1.2 + e.bossPhase * 0.6);
        }
        if (e.bossPhase === 3) {
          this.updateBossFloorHazards(dt);
        }
      }

      const dx = this.px - e.x;
      const dz = this.pz - e.z;
      const distToPlayer = Math.hypot(dx, dz);
      const detectRange = e.kind === 'boss' ? 40 : e.kind === 'sentinel' ? 24 : 18;
      const attackRange =
        e.kind === 'hunter' ? 2.4 : e.kind === 'boss' ? 22 : e.kind === 'sentinel' ? 20 : 14;

      e.attackCooldown = Math.max(0, e.attackCooldown - dt);

      // AI State Machine
      if (e.aiState === 'patrol') {
        e.patrolAngle += dt * 0.8;
        const tx = e.patrolOriginX + Math.cos(e.patrolAngle) * 3.2;
        const tz = e.patrolOriginZ + Math.sin(e.patrolAngle) * 3.2;
        const pdx = tx - e.x;
        const pdz = tz - e.z;
        const pLen = Math.hypot(pdx, pdz) || 1;
        e.vx = (pdx / pLen) * (e.speed * 0.45);
        e.vz = (pdz / pLen) * (e.speed * 0.45);
        e.yaw = Math.atan2(-e.vx, -e.vz);

        if (distToPlayer < detectRange) {
          e.aiState = 'chase';
        }
      } else if (e.aiState === 'chase') {
        e.yaw = Math.atan2(-dx, -dz);
        const desiredSpeed =
          e.kind === 'boss' ? e.speed * (1 + (e.bossPhase - 1) * 0.22) : e.speed;

        if (distToPlayer > attackRange * 0.85) {
          e.vx = (dx / (distToPlayer || 1)) * desiredSpeed;
          e.vz = (dz / (distToPlayer || 1)) * desiredSpeed;
        } else {
          // Strafe slightly for Scout/Sentinel
          e.vx = (-dz / (distToPlayer || 1)) * (e.speed * 0.35);
          e.vz = (dx / (distToPlayer || 1)) * (e.speed * 0.35);
        }

        if (
          distToPlayer <= attackRange &&
          e.attackCooldown <= 0 &&
          (e.kind === 'boss' || activeAttackers < 3)
        ) {
          e.aiState = 'windup';
          e.stateTimer = e.kind === 'boss' ? 0.55 : e.kind === 'hunter' ? 0.35 : 0.42;
          activeAttackers++;
        }
      } else if (e.aiState === 'windup') {
        e.vx *= 0.85;
        e.vz *= 0.85;
        e.yaw = Math.atan2(-dx, -dz);
        e.stateTimer -= dt;
        // Telegraph pulse
        e.rig.weakPoint.scale.setScalar(1.35 + Math.sin(this.elapsedTime * 28) * 0.25);

        if (e.stateTimer <= 0) {
          this.performEnemyAttack(e, dx, dz, distToPlayer);
          e.aiState = 'chase';
          e.attackCooldown =
            e.kind === 'boss'
              ? Math.max(0.85, 1.8 - e.bossPhase * 0.3)
              : e.kind === 'hunter'
              ? 1.15
              : 1.75;
        }
      }

      // Move & clamp enemy inside valid arena
      e.x += e.vx * dt;
      e.z += e.vz * dt;
      if (e.kind !== 'scout') {
        const res = resolveCylinderObstacles(
          e.x,
          0,
          e.z,
          e.radius,
          e.height,
          this.world.colliders,
          this.echoState.dimension
        );
        e.x = THREE.MathUtils.clamp(res.x, -21, 21);
        e.z =
          e.kind === 'boss'
            ? THREE.MathUtils.clamp(res.z, -81, -35)
            : THREE.MathUtils.clamp(res.z, -29, 46);
      } else {
        e.x = THREE.MathUtils.clamp(e.x, -20, 20);
        e.z = THREE.MathUtils.clamp(e.z, -28, 45);
      }

      e.rig.root.position.set(e.x, e.y, e.z);
      e.rig.root.rotation.y = e.yaw;

      // Procedural enemy limb animation
      if (e.kind === 'scout') {
        e.rig.body.position.y = 1.9 + Math.sin(this.elapsedTime * 3.5 + e.patrolAngle) * 0.22;
      } else if (e.rig.leftLeg && e.rig.rightLeg) {
        const spd = Math.hypot(e.vx, e.vz);
        if (spd > 0.4) {
          const swing = Math.sin(this.elapsedTime * spd * 1.4) * 0.45;
          e.rig.leftLeg.rotation.x = swing;
          e.rig.rightLeg.rotation.x = -swing;
        }
      }
    }
  }

  private performEnemyAttack(e: EnemyEntity, dx: number, dz: number, dist: number) {
    if (e.kind === 'hunter') {
      // Melee lunge toward player
      this.audio.playEnemyAttack(false);
      if (dist < 3.1 && Math.abs(this.py - e.y) < 1.8) {
        this.damagePlayer(14);
      }
      e.vx = (dx / (dist || 1)) * 12;
      e.vz = (dz / (dist || 1)) * 12;
      return;
    }

    const originY = e.y + (e.kind === 'boss' ? 3.2 : e.kind === 'sentinel' ? 1.8 : 1.9);
    const dirX = dx / (dist || 1);
    const dirZ = dz / (dist || 1);
    const dirY = (this.py + 1.1 - originY) / (dist || 1);

    if (e.kind === 'boss') {
      this.audio.playEnemyAttack(true);
      const spreadCount = e.bossPhase >= 2 ? 3 : 2;
      for (let i = 0; i < spreadCount; i++) {
        const offsetAngle = (i - (spreadCount - 1) / 2) * 0.22;
        const cos = Math.cos(offsetAngle);
        const sin = Math.sin(offsetAngle);
        const vx = (dirX * cos - dirZ * sin) * 20;
        const vz = (dirX * sin + dirZ * cos) * 20;
        this.pool.spawnBolt(
          e.x,
          originY,
          e.z,
          vx,
          dirY * 20,
          vz,
          PALETTE.dangerRed,
          15,
          false,
          0.55
        );
      }
      return;
    }

    this.audio.playEnemyAttack(false);
    const spd = e.kind === 'sentinel' ? 22 : 16;
    const dmg = e.kind === 'sentinel' ? 14 : 9;
    this.pool.spawnBolt(
      e.x,
      originY,
      e.z,
      dirX * spd,
      dirY * spd,
      dirZ * spd,
      PALETTE.dangerRed,
      dmg,
      false,
      0.42
    );
  }

  private updateBossFloorHazards(dt: number) {
    this.hazardCycleTimer += dt;
    const cycle = this.hazardCycleTimer % 5.0;
    const warning = cycle > 2.2 && cycle <= 3.6;
    const active = cycle > 3.6;

    this.world.hazardRings.forEach((ring) => {
      const mat = ring.material as THREE.MeshBasicMaterial;
      if (active) {
        mat.opacity = 0.65;
        mat.color.setHex(PALETTE.dangerRed);
        const d = Math.hypot(this.px - ring.position.x, this.pz - ring.position.z);
        if (d < 3.6 && this.py < 0.8 && !this.hazardActive) {
          this.damagePlayer(12);
          this.hazardActive = true;
        }
      } else if (warning) {
        mat.opacity = 0.28 + Math.sin(this.elapsedTime * 18) * 0.14;
        mat.color.setHex(PALETTE.energyGold);
      } else {
        mat.opacity = 0;
        this.hazardActive = false;
      }
    });
  }

  private updateProjectiles(dt: number) {
    for (const b of this.pool.bolts) {
      if (!b.active || b.fromPlayer) continue;
      const dist = Math.hypot(b.x - this.px, b.z - this.pz);
      if (dist < 0.72 + b.radius && Math.abs(b.y - (this.py + 1.0)) < 1.15) {
        b.active = false;
        this.damagePlayer(b.damage);
        this.pool.spawnBurst(b.x, b.y, b.z, PALETTE.dangerRed, 8, 5, 0.8, 0.3, -4);
      }
    }
    void dt;
  }

  private updateCamera(dt: number) {
    const anchorX = this.px + Math.cos(this.camYaw) * 0.55;
    const anchorY = this.py + 1.75;
    const anchorZ = this.pz - Math.sin(this.camYaw) * 0.55;

    const backDist = 5.4;
    const horizDist = Math.cos(this.camPitch) * backDist;
    const vertOffset = Math.sin(this.camPitch) * backDist + 0.65;

    let desiredX = anchorX + Math.sin(this.camYaw) * horizDist;
    let desiredY = anchorY + vertOffset;
    let desiredZ = anchorZ + Math.cos(this.camYaw) * horizDist;

    // Wall pull-in raycast so camera never clips behind walls
    _rayOrigin.set(anchorX, anchorY, anchorZ);
    _rayDir.set(desiredX - anchorX, desiredY - anchorY, desiredZ - anchorZ);
    const maxDist = _rayDir.length();
    if (maxDist > 0.01) {
      _rayDir.divideScalar(maxDist);
      this.raycaster.set(_rayOrigin, _rayDir);
      this.raycaster.far = maxDist;
      const wallHits = this.raycaster.intersectObjects(this.world.raycastWalls, false);
      this.raycaster.far = Infinity;
      if (wallHits.length > 0 && wallHits[0].distance < maxDist) {
        const safeDist = Math.max(1.2, wallHits[0].distance - 0.35);
        desiredX = anchorX + _rayDir.x * safeDist;
        desiredY = anchorY + _rayDir.y * safeDist;
        desiredZ = anchorZ + _rayDir.z * safeDist;
      }
    }

    this.camPos.x = THREE.MathUtils.damp(this.camPos.x, desiredX, 14, dt);
    this.camPos.y = THREE.MathUtils.damp(this.camPos.y, Math.max(0.8, desiredY), 14, dt);
    this.camPos.z = THREE.MathUtils.damp(this.camPos.z, desiredZ, 14, dt);

    const shake = this.trauma * this.trauma * 0.28;
    this.camera.position.set(
      this.camPos.x + (Math.random() - 0.5) * shake,
      this.camPos.y + (Math.random() - 0.5) * shake,
      this.camPos.z + (Math.random() - 0.5) * shake
    );

    const lookTargetX = anchorX - Math.sin(this.camYaw) * 14;
    const lookTargetY = anchorY - Math.sin(this.camPitch) * 10;
    const lookTargetZ = anchorZ - Math.cos(this.camYaw) * 14;
    this.camLook.x = THREE.MathUtils.damp(this.camLook.x, lookTargetX, 18, dt);
    this.camLook.y = THREE.MathUtils.damp(this.camLook.y, lookTargetY, 18, dt);
    this.camLook.z = THREE.MathUtils.damp(this.camLook.z, lookTargetZ, 18, dt);
    this.camera.lookAt(this.camLook);
  }

  private finishRun(victory: boolean) {
    document.exitPointerLock?.();
    this.keys.clear();
    this.justPressed.clear();
    this.mouseDown = false;
    const coresCollected = this.world.cores.filter((c) => c.collected).length;
    const zone = resolveZoneFromZ(this.pz);
    const summary: RunSummary = {
      victory,
      score: this.score + (victory ? Math.max(0, Math.round(300 - this.elapsedTime) * 3) : 0),
      elapsedTime: this.elapsedTime,
      enemiesDefeated: this.enemiesDefeated,
      coresCollected,
      totalCores: this.world.cores.length,
      zoneReached: zone.id,
      bossHpRemaining: this.bossEntity ? Math.round(this.bossEntity.hp) : 650,
    };
    this.setPhase(victory ? 'victory' : 'gameover');
    this.callbacks.onRunComplete(summary);
  }

  private computeInteractPrompt(): string | null {
    const distConsole = Math.hypot(
      this.px - this.world.reactorConsolePos.x,
      this.pz - this.world.reactorConsolePos.z
    );
    if (!this.reactorActivated && this.reactorGateOpen && distConsole < 4.8) {
      return 'Press E to Activate Central Reactor';
    }
    return null;
  }

  private emitHud() {
    const zone = resolveZoneFromZ(this.pz);
    const coresCollected = this.world.cores.filter((c) => c.collected).length;

    const snapshot: HudSnapshot = {
      phase: this.phase,
      dimension: this.echoState.dimension,
      echoEnergy: Math.round(this.echoState.energy),
      maxEchoEnergy: this.echoState.maxEnergy,
      echoCooldown: Number(this.echoState.cooldown.toFixed(1)),
      echoTransition: this.echoTransitionBurst,
      hp: Math.round(this.hp),
      maxHp: this.maxHp,
      ammo: this.ammo,
      maxAmmo: this.maxAmmo,
      reloading: this.reloading,
      dashCooldown: Number(this.dashCooldown.toFixed(1)),
      coresCollected,
      totalCores: this.world.cores.length,
      reactorGateOpen: this.reactorGateOpen,
      reactorActivated: this.reactorActivated,
      currentZone: zone.id,
      zoneName: zone.name,
      objectiveText: getMissionObjectiveText({
        currentZone: zone.id,
        coresCollected,
        totalCores: this.world.cores.length,
        reactorActivated: this.reactorActivated,
        bossDefeated: this.bossDefeated,
      }),
      interactPrompt: this.computeInteractPrompt(),
      score: this.score,
      enemiesDefeated: this.enemiesDefeated,
      elapsedTime: this.elapsedTime,
      hitMarkerTimer: this.hitMarkerTimer,
      critMarker: this.critMarker,
      damageFlash: this.damageFlash,
      pointerLocked: this.pointerLocked,
      targetEnemy: this.targetEnemyHud,
      boss: {
        active: Boolean(this.bossEntity && this.bossEntity.aiState !== 'dead'),
        name: 'THE SHADOW GUARDIAN',
        hp: this.bossEntity ? Math.round(this.bossEntity.hp) : 0,
        maxHp: this.bossEntity ? this.bossEntity.maxHp : 650,
        phase: this.bossEntity ? this.bossEntity.bossPhase : 1,
        shieldActive: Boolean(this.bossEntity?.shieldActive),
        weakPointExposed: Boolean(
          this.bossEntity &&
            this.echoState.dimension === 'shadow' &&
            this.bossEntity.aiState !== 'dead'
        ),
      },
      playerPos: { x: this.px, z: this.pz, yaw: this.playerYaw },
    };

    this.callbacks.onHudUpdate(snapshot);
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.resizeObserver.disconnect();
    this.unbindEvents();
    this.audio.dispose();
    this.pool.dispose();
    this.world.dispose();
    this.textures.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}

const _v2_zero = new THREE.Vector2(0, 0);
