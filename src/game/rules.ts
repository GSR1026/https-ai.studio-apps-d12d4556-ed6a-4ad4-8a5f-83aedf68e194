import type { AABB, DimensionMode, EnemyKind, ZoneId } from './types';

export interface EchoShiftState {
  dimension: DimensionMode;
  energy: number;
  maxEnergy: number;
  cooldown: number;
}

export const ECHO_CONFIG = {
  maxEnergy: 100,
  activationCost: 12,
  drainPerSecond: 14,
  regenPerSecond: 18,
  toggleCooldown: 0.65,
  minEnergyToEnter: 18,
} as const;

/**
 * Attempts to toggle between Reality and Shadow Mode.
 * Enforces cooldown and minimum Echo Energy to enter Shadow Mode.
 */
export function tryToggleEchoShift(state: EchoShiftState): {
  next: EchoShiftState;
  switched: boolean;
  reason?: string;
} {
  if (state.cooldown > 0) {
    return { next: state, switched: false, reason: 'cooldown' };
  }
  if (state.dimension === 'reality') {
    if (state.energy < ECHO_CONFIG.minEnergyToEnter) {
      return { next: state, switched: false, reason: 'low_energy' };
    }
    return {
      next: {
        ...state,
        dimension: 'shadow',
        energy: Math.max(0, state.energy - ECHO_CONFIG.activationCost),
        cooldown: ECHO_CONFIG.toggleCooldown,
      },
      switched: true,
    };
  }
  return {
    next: {
      ...state,
      dimension: 'reality',
      cooldown: ECHO_CONFIG.toggleCooldown,
    },
    switched: true,
  };
}

/**
 * Advances Echo Energy drain (in Shadow Mode) or regeneration (in Reality Mode).
 * Automatically snaps back to Reality Mode when energy hits zero.
 */
export function stepEchoShift(
  state: EchoShiftState,
  dt: number
): { next: EchoShiftState; forcedReturnToReality: boolean } {
  const nextCooldown = Math.max(0, state.cooldown - dt);
  if (state.dimension === 'shadow') {
    const nextEnergy = Math.max(0, state.energy - ECHO_CONFIG.drainPerSecond * dt);
    if (nextEnergy <= 0) {
      return {
        next: {
          ...state,
          dimension: 'reality',
          energy: 0,
          cooldown: ECHO_CONFIG.toggleCooldown * 1.4,
        },
        forcedReturnToReality: true,
      };
    }
    return {
      next: { ...state, energy: nextEnergy, cooldown: nextCooldown },
      forcedReturnToReality: false,
    };
  }

  const nextEnergy = Math.min(
    state.maxEnergy,
    state.energy + ECHO_CONFIG.regenPerSecond * dt
  );
  return {
    next: { ...state, energy: nextEnergy, cooldown: nextCooldown },
    forcedReturnToReality: false,
  };
}

export interface DamageInput {
  baseDamage: number;
  enemyKind: EnemyKind | 'boss';
  dimension: DimensionMode;
  hitWeakPoint: boolean;
  bossPhase?: 1 | 2 | 3;
  bossShieldActive?: boolean;
}

export interface DamageResult {
  damage: number;
  isCrit: boolean;
  wasBlocked: boolean;
}

/**
 * Pure combat damage resolution incorporating Echo Shift tactical mechanics:
 * - Sentinels have heavy frontal armor in Reality Mode (40% damage),
 *   but expose a 2.6x weak point in Shadow Mode.
 * - Boss Phase 2/3 shield blocks Reality Mode body hits (15% chip damage),
 *   requiring Shadow Mode to pierce shields and hit the exposed weak point (2.5x).
 */
export function computeShotDamage(input: DamageInput): DamageResult {
  const { baseDamage, enemyKind, dimension, hitWeakPoint, bossPhase = 1, bossShieldActive = false } = input;

  if (enemyKind === 'boss') {
    if (bossShieldActive && dimension === 'reality') {
      return {
        damage: Math.max(2, Math.round(baseDamage * 0.15)),
        isCrit: false,
        wasBlocked: true,
      };
    }
    if (dimension === 'shadow' && hitWeakPoint) {
      return {
        damage: Math.round(baseDamage * 2.5),
        isCrit: true,
        wasBlocked: false,
      };
    }
    if (bossPhase >= 2 && dimension === 'shadow') {
      return {
        damage: Math.round(baseDamage * 1.35),
        isCrit: false,
        wasBlocked: false,
      };
    }
    return { damage: Math.round(baseDamage), isCrit: false, wasBlocked: false };
  }

  if (enemyKind === 'sentinel') {
    if (dimension === 'shadow' && hitWeakPoint) {
      return {
        damage: Math.round(baseDamage * 2.6),
        isCrit: true,
        wasBlocked: false,
      };
    }
    if (dimension === 'reality') {
      return {
        damage: Math.max(4, Math.round(baseDamage * 0.45)),
        isCrit: false,
        wasBlocked: true,
      };
    }
    return { damage: Math.round(baseDamage * 1.15), isCrit: false, wasBlocked: false };
  }

  // Scout & Hunter
  if (hitWeakPoint) {
    return {
      damage: Math.round(baseDamage * (dimension === 'shadow' ? 1.8 : 1.5)),
      isCrit: true,
      wasBlocked: false,
    };
  }
  return { damage: Math.round(baseDamage), isCrit: false, wasBlocked: false };
}

/**
 * Determines Boss phase (1, 2, or 3) from current HP ratio.
 */
export function resolveBossPhase(hp: number, maxHp: number): 1 | 2 | 3 {
  const ratio = maxHp > 0 ? hp / maxHp : 0;
  if (ratio <= 0.34) return 3;
  if (ratio <= 0.68) return 2;
  return 1;
}

/**
 * Determines which Zone the player is in based on Z world coordinate.
 * Player spawns at Z = +42 facing north (-Z).
 */
export function resolveZoneFromZ(z: number): { id: ZoneId; name: string } {
  if (z > 10) {
    return { id: 'fallen_city', name: 'Zone 1: The Fallen City' };
  }
  if (z > -32) {
    return { id: 'shadow_district', name: 'Zone 2: The Shadow District' };
  }
  return { id: 'central_reactor', name: 'Zone 3: Central Reactor' };
}

export interface MissionProgressInput {
  currentZone: ZoneId;
  coresCollected: number;
  totalCores: number;
  reactorActivated: boolean;
  bossDefeated: boolean;
}

export function getMissionObjectiveText(input: MissionProgressInput): string {
  if (input.bossDefeated) {
    return 'City Power Restored — Mission Complete';
  }
  if (input.reactorActivated) {
    return 'Defeat The Shadow Guardian (Use Q Echo Shift on Shields)';
  }
  if (input.coresCollected < input.totalCores) {
    if (input.currentZone === 'fallen_city' && input.coresCollected === 0) {
      return `Locate Energy Core 1/${input.totalCores} in The Fallen City`;
    }
    return `Collect Energy Cores (${input.coresCollected}/${input.totalCores}) — Press Q for Echo Shift`;
  }
  if (input.currentZone !== 'central_reactor') {
    return 'Reactor Gate Open — Enter the Central Reactor';
  }
  return 'Approach Reactor Console & Press E to Activate';
}

/**
 * Checks if an AABB is solid in the current dimension.
 */
export function isBoxSolidInDimension(box: AABB, dimension: DimensionMode): boolean {
  if (box.dimension === 'always') return true;
  return box.dimension === dimension;
}

/**
 * Resolves horizontal circle-vs-AABB collision for player/enemies against active boxes,
 * plus calculates the floor support Y height from walkable boxes.
 */
export function resolveCylinderObstacles(
  x: number,
  y: number,
  z: number,
  radius: number,
  height: number,
  boxes: AABB[],
  dimension: DimensionMode
): { x: number; z: number; floorY: number } {
  let outX = x;
  let outZ = z;
  let floorY = 0;

  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (!isBoxSolidInDimension(b, dimension)) continue;

    // Check if cylinder is horizontally overlapping walkable top
    if (
      b.isWalkableTop &&
      outX + radius * 0.6 > b.minX &&
      outX - radius * 0.6 < b.maxX &&
      outZ + radius * 0.6 > b.minZ &&
      outZ - radius * 0.6 < b.maxZ &&
      y >= b.maxY - 0.55
    ) {
      if (b.maxY > floorY) {
        floorY = b.maxY;
      }
      continue;
    }

    // Ignore obstacles strictly below feet or above head
    if (y >= b.maxY - 0.25 || y + height <= b.minY + 0.05) {
      continue;
    }

    const closestX = Math.max(b.minX, Math.min(outX, b.maxX));
    const closestZ = Math.max(b.minZ, Math.min(outZ, b.maxZ));
    const dx = outX - closestX;
    const dz = outZ - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < radius * radius) {
      if (distSq > 1e-6) {
        const dist = Math.sqrt(distSq);
        const push = radius - dist;
        outX += (dx / dist) * push;
        outZ += (dz / dist) * push;
      } else {
        // Inside box center fallback: push out nearest edge
        const dLeft = Math.abs(outX - b.minX);
        const dRight = Math.abs(b.maxX - outX);
        const dFront = Math.abs(outZ - b.minZ);
        const dBack = Math.abs(b.maxZ - outZ);
        const minEdge = Math.min(dLeft, dRight, dFront, dBack);
        if (minEdge === dLeft) outX = b.minX - radius;
        else if (minEdge === dRight) outX = b.maxX + radius;
        else if (minEdge === dFront) outZ = b.minZ - radius;
        else outZ = b.maxZ + radius;
      }
    }
  }

  return { x: outX, z: outZ, floorY };
}

export function formatMissionTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
