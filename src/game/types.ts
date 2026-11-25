export type GamePhase = 'title' | 'playing' | 'paused' | 'victory' | 'gameover';
export type DimensionMode = 'reality' | 'shadow';
export type ZoneId = 'fallen_city' | 'shadow_district' | 'central_reactor';
export type EnemyKind = 'scout' | 'hunter' | 'sentinel';
export type EnemyAIState =
  | 'idle'
  | 'patrol'
  | 'detect'
  | 'chase'
  | 'windup'
  | 'attack'
  | 'stunned'
  | 'dead';

export const PALETTE = {
  background: 0x070b18,
  backgroundHex: '#070B18',
  primaryCyan: 0x00d9ff,
  primaryCyanHex: '#00D9FF',
  shadowPurple: 0xa855f7,
  shadowPurpleHex: '#A855F7',
  shadowMagenta: 0xe838ff,
  dangerRed: 0xff3459,
  dangerRedHex: '#FF3459',
  energyGold: 0xffc857,
  energyGoldHex: '#FFC857',
  uiPanelHex: '#10192B',
  realityFog: 0x070d1e,
  shadowFog: 0x1a082c,
} as const;

export interface AudioSettings {
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  mouseSensitivity: number;
}

export interface AABB {
  id: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  /** 'always' = solid in both modes; 'reality' = solid only in reality; 'shadow' = solid only in shadow */
  dimension: 'always' | 'reality' | 'shadow';
  isWalkableTop?: boolean;
  label?: string;
}

export interface MissionStep {
  id: string;
  title: string;
  zone: ZoneId;
  completed: boolean;
}

export interface BossHudSnapshot {
  active: boolean;
  name: string;
  hp: number;
  maxHp: number;
  phase: 1 | 2 | 3;
  shieldActive: boolean;
  weakPointExposed: boolean;
}

export interface TargetHudSnapshot {
  name: string;
  hp: number;
  maxHp: number;
  armored: boolean;
  weakPointExposed: boolean;
}

export interface HudSnapshot {
  phase: GamePhase;
  dimension: DimensionMode;
  echoEnergy: number;
  maxEchoEnergy: number;
  echoCooldown: number;
  echoTransition: number;
  hp: number;
  maxHp: number;
  ammo: number;
  maxAmmo: number;
  reloading: boolean;
  dashCooldown: number;
  coresCollected: number;
  totalCores: number;
  reactorGateOpen: boolean;
  reactorActivated: boolean;
  currentZone: ZoneId;
  zoneName: string;
  objectiveText: string;
  interactPrompt: string | null;
  score: number;
  enemiesDefeated: number;
  elapsedTime: number;
  hitMarkerTimer: number;
  critMarker: boolean;
  damageFlash: number;
  pointerLocked: boolean;
  targetEnemy: TargetHudSnapshot | null;
  boss: BossHudSnapshot;
  playerPos: { x: number; z: number; yaw: number };
}

export interface RunSummary {
  victory: boolean;
  score: number;
  elapsedTime: number;
  enemiesDefeated: number;
  coresCollected: number;
  totalCores: number;
  zoneReached: ZoneId;
  bossHpRemaining: number;
}
