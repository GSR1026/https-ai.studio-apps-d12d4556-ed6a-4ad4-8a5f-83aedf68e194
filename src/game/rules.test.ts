import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ECHO_CONFIG,
  computeShotDamage,
  formatMissionTime,
  getMissionObjectiveText,
  resolveBossPhase,
  resolveCylinderObstacles,
  resolveZoneFromZ,
  stepEchoShift,
  tryToggleEchoShift,
} from './rules';
import type { AABB } from './types';

test('Echo Shift toggles into Shadow Mode when energy and cooldown allow', () => {
  const initial = {
    dimension: 'reality' as const,
    energy: 100,
    maxEnergy: 100,
    cooldown: 0,
  };
  const { next, switched } = tryToggleEchoShift(initial);
  assert.equal(switched, true);
  assert.equal(next.dimension, 'shadow');
  assert.equal(next.energy, 100 - ECHO_CONFIG.activationCost);
  assert.ok(next.cooldown > 0);
});

test('Echo Shift blocks toggling when cooldown active or energy too low', () => {
  const onCooldown = {
    dimension: 'reality' as const,
    energy: 100,
    maxEnergy: 100,
    cooldown: 0.4,
  };
  assert.equal(tryToggleEchoShift(onCooldown).switched, false);

  const lowEnergy = {
    dimension: 'reality' as const,
    energy: 5,
    maxEnergy: 100,
    cooldown: 0,
  };
  assert.equal(tryToggleEchoShift(lowEnergy).switched, false);
});

test('Echo Shift drains energy in Shadow Mode and forces Reality when depleted', () => {
  let state = {
    dimension: 'shadow' as const,
    energy: 10,
    maxEnergy: 100,
    cooldown: 0,
  };
  const stepped = stepEchoShift(state, 1.0);
  assert.equal(stepped.forcedReturnToReality, true);
  assert.equal(stepped.next.dimension, 'reality');
  assert.equal(stepped.next.energy, 0);

  const regen = stepEchoShift(stepped.next, 2.0);
  assert.equal(regen.next.dimension, 'reality');
  assert.ok(regen.next.energy > 30);
});

test('Combat damage honors Sentinel armor in Reality and weak point crit in Shadow Mode', () => {
  const realityArmor = computeShotDamage({
    baseDamage: 25,
    enemyKind: 'sentinel',
    dimension: 'reality',
    hitWeakPoint: false,
  });
  assert.equal(realityArmor.wasBlocked, true);
  assert.ok(realityArmor.damage < 25);

  const shadowCrit = computeShotDamage({
    baseDamage: 25,
    enemyKind: 'sentinel',
    dimension: 'shadow',
    hitWeakPoint: true,
  });
  assert.equal(shadowCrit.isCrit, true);
  assert.equal(shadowCrit.wasBlocked, false);
  assert.equal(shadowCrit.damage, 65);
});

test('Boss shield blocks Reality Mode attacks and exposes weak point in Shadow Mode', () => {
  assert.equal(resolveBossPhase(650, 650), 1);
  assert.equal(resolveBossPhase(400, 650), 2);
  assert.equal(resolveBossPhase(150, 650), 3);

  const blocked = computeShotDamage({
    baseDamage: 25,
    enemyKind: 'boss',
    dimension: 'reality',
    hitWeakPoint: true,
    bossPhase: 2,
    bossShieldActive: true,
  });
  assert.equal(blocked.wasBlocked, true);
  assert.ok(blocked.damage <= 5);

  const pierced = computeShotDamage({
    baseDamage: 25,
    enemyKind: 'boss',
    dimension: 'shadow',
    hitWeakPoint: true,
    bossPhase: 2,
    bossShieldActive: true,
  });
  assert.equal(pierced.wasBlocked, false);
  assert.equal(pierced.isCrit, true);
  assert.equal(pierced.damage, 63);
});

test('Zone resolution and Mission objective progression', () => {
  assert.equal(resolveZoneFromZ(40).id, 'fallen_city');
  assert.equal(resolveZoneFromZ(-10).id, 'shadow_district');
  assert.equal(resolveZoneFromZ(-50).id, 'central_reactor');

  assert.match(
    getMissionObjectiveText({
      currentZone: 'fallen_city',
      coresCollected: 0,
      totalCores: 3,
      reactorActivated: false,
      bossDefeated: false,
    }),
    /Core 1\/3/
  );
  assert.match(
    getMissionObjectiveText({
      currentZone: 'shadow_district',
      coresCollected: 3,
      totalCores: 3,
      reactorActivated: false,
      bossDefeated: false,
    }),
    /Reactor Gate Open/
  );
  assert.match(
    getMissionObjectiveText({
      currentZone: 'central_reactor',
      coresCollected: 3,
      totalCores: 3,
      reactorActivated: true,
      bossDefeated: false,
    }),
    /Shadow Guardian/
  );
});

test('Dimension-aware obstacle collision and walkable Echo bridges', () => {
  const boxes: AABB[] = [
    {
      id: 'shadow_bridge',
      minX: -3,
      maxX: 3,
      minY: 0,
      maxY: 1.5,
      minZ: -5,
      maxZ: 5,
      dimension: 'shadow',
      isWalkableTop: true,
    },
    {
      id: 'reality_wall',
      minX: -4,
      maxX: 4,
      minY: 0,
      maxY: 4,
      minZ: -12,
      maxZ: -10,
      dimension: 'reality',
    },
  ];

  // In Reality Mode, bridge is not solid (floorY = 0) and wall blocks at z = -10
  const inReality = resolveCylinderObstacles(0, 1.6, 0, 0.5, 1.8, boxes, 'reality');
  assert.equal(inReality.floorY, 0);
  const hitWall = resolveCylinderObstacles(0, 0, -9.8, 0.5, 1.8, boxes, 'reality');
  assert.ok(hitWall.z >= -9.5);

  // In Shadow Mode, bridge supports player at y=1.5 and reality wall phases out
  const onBridge = resolveCylinderObstacles(0, 1.5, 0, 0.5, 1.8, boxes, 'shadow');
  assert.equal(onBridge.floorY, 1.5);
  const throughWall = resolveCylinderObstacles(0, 0, -10.5, 0.5, 1.8, boxes, 'shadow');
  assert.equal(throughWall.z, -10.5);
});

test('formatMissionTime formats mm:ss', () => {
  assert.equal(formatMissionTime(0), '00:00');
  assert.equal(formatMissionTime(75.9), '01:15');
});
