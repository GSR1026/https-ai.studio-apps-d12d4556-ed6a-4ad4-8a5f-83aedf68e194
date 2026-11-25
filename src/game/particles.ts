import * as THREE from 'three';

const MAX_PARTICLES = 260;
const MAX_BOLTS = 48;

interface ParticleSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  gravity: number;
  color: THREE.Color;
}

export interface ProjectileBolt {
  active: boolean;
  fromPlayer: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  damage: number;
  radius: number;
  colorHex: number;
}

const _dummyMatrix = new THREE.Matrix4();
const _dummyPos = new THREE.Vector3();
const _dummyQuat = new THREE.Quaternion();
const _dummyScale = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();

/**
 * Zero-GC pooled particle + projectile renderer using InstancedMesh ring buffers.
 */
export class ParticleAndBoltPool {
  private particleMesh: THREE.InstancedMesh;
  private boltMesh: THREE.InstancedMesh;
  private particles: ParticleSlot[] = [];
  public bolts: ProjectileBolt[] = [];
  private pCursor = 0;
  private bCursor = 0;

  constructor(scene: THREE.Scene) {
    const pGeo = new THREE.OctahedronGeometry(0.14, 0);
    const pMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.particleMesh = new THREE.InstancedMesh(pGeo, pMat, MAX_PARTICLES);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.frustumCulled = false;

    const bGeo = new THREE.CylinderGeometry(0.07, 0.07, 1.15, 6);
    const bMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    this.boltMesh = new THREE.InstancedMesh(bGeo, bMat, MAX_BOLTS);
    this.boltMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.boltMesh.frustumCulled = false;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -100,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        size: 1,
        gravity: 0,
        color: new THREE.Color(0x00d9ff),
      });
      _dummyScale.set(0, 0, 0);
      _dummyMatrix.compose(_dummyPos.set(0, -100, 0), _dummyQuat, _dummyScale);
      this.particleMesh.setMatrixAt(i, _dummyMatrix);
      this.particleMesh.setColorAt(i, this.particles[i].color);
    }

    for (let i = 0; i < MAX_BOLTS; i++) {
      this.bolts.push({
        active: false,
        fromPlayer: false,
        x: 0,
        y: -100,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        damage: 10,
        radius: 0.35,
        colorHex: 0xff3459,
      });
      _dummyScale.set(0, 0, 0);
      _dummyMatrix.compose(_dummyPos.set(0, -100, 0), _dummyQuat, _dummyScale);
      this.boltMesh.setMatrixAt(i, _dummyMatrix);
      this.boltMesh.setColorAt(i, new THREE.Color(0xff3459));
    }

    scene.add(this.particleMesh);
    scene.add(this.boltMesh);
  }

  public spawnBurst(
    x: number,
    y: number,
    z: number,
    colorHex: number,
    count: number,
    speed = 6,
    size = 1,
    life = 0.45,
    gravity = -6
  ) {
    for (let i = 0; i < count; i++) {
      const slot = this.particles[this.pCursor];
      this.pCursor = (this.pCursor + 1) % MAX_PARTICLES;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const spd = speed * (0.45 + Math.random() * 0.75);
      slot.active = true;
      slot.x = x;
      slot.y = y;
      slot.z = z;
      slot.vx = Math.sin(phi) * Math.cos(theta) * spd;
      slot.vy = Math.cos(phi) * spd * 0.75 + 1.5;
      slot.vz = Math.sin(phi) * Math.sin(theta) * spd;
      slot.life = life * (0.7 + Math.random() * 0.5);
      slot.maxLife = slot.life;
      slot.size = size * (0.7 + Math.random() * 0.6);
      slot.gravity = gravity;
      slot.color.setHex(colorHex);
    }
  }

  public spawnBolt(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    colorHex: number,
    damage: number,
    fromPlayer: boolean,
    radius = 0.4
  ) {
    const b = this.bolts[this.bCursor];
    this.bCursor = (this.bCursor + 1) % MAX_BOLTS;
    b.active = true;
    b.fromPlayer = fromPlayer;
    b.x = x;
    b.y = y;
    b.z = z;
    b.vx = vx;
    b.vy = vy;
    b.vz = vz;
    b.life = 2.6;
    b.damage = damage;
    b.radius = radius;
    b.colorHex = colorHex;
    this.boltMesh.setColorAt(
      (this.bCursor - 1 + MAX_BOLTS) % MAX_BOLTS,
      _dummyColor.setHex(colorHex)
    );
    if (this.boltMesh.instanceColor) {
      this.boltMesh.instanceColor.needsUpdate = true;
    }
  }

  public clearBolts() {
    for (let i = 0; i < MAX_BOLTS; i++) {
      this.bolts[i].active = false;
    }
  }

  public update(dt: number) {
    let pDirty = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      pDirty = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        _dummyScale.set(0, 0, 0);
        _dummyMatrix.compose(_dummyPos.set(0, -100, 0), _dummyQuat, _dummyScale);
        this.particleMesh.setMatrixAt(i, _dummyMatrix);
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const t = Math.max(0, p.life / p.maxLife);
      const s = p.size * t;
      _dummyPos.set(p.x, p.y, p.z);
      _dummyQuat.identity();
      _dummyScale.set(s, s, s);
      _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
      this.particleMesh.setMatrixAt(i, _dummyMatrix);
      this.particleMesh.setColorAt(i, p.color);
    }
    if (pDirty) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
      if (this.particleMesh.instanceColor) {
        this.particleMesh.instanceColor.needsUpdate = true;
      }
    }

    for (let i = 0; i < MAX_BOLTS; i++) {
      const b = this.bolts[i];
      if (!b.active) {
        _dummyScale.set(0, 0, 0);
        _dummyMatrix.compose(_dummyPos.set(0, -100, 0), _dummyQuat, _dummyScale);
        this.boltMesh.setMatrixAt(i, _dummyMatrix);
        continue;
      }
      b.life -= dt;
      if (b.life <= 0) {
        b.active = false;
        continue;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      _dummyPos.set(b.x, b.y, b.z);
      _dir.set(b.vx, b.vy, b.vz).normalize();
      _dummyQuat.setFromUnitVectors(_up, _dir);
      const scale = b.fromPlayer ? 1.15 : 1.0;
      _dummyScale.set(scale, scale, scale);
      _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
      this.boltMesh.setMatrixAt(i, _dummyMatrix);
    }
    this.boltMesh.instanceMatrix.needsUpdate = true;
  }

  public dispose() {
    this.particleMesh.geometry.dispose();
    (this.particleMesh.material as THREE.Material).dispose();
    this.boltMesh.geometry.dispose();
    (this.boltMesh.material as THREE.Material).dispose();
  }
}

const _dummyColor = new THREE.Color();
