import * as THREE from 'three';
import { CT, GX, POLES, Z_SCALE, clamp, fm, tierOf } from './config.js';
import { Lw } from './config.js';
import { barOpen, lit, skillActive } from './sim.js';

const MAX_HUMANS = 768;
const MAX_BADGES = 256;
const MAX_GLOWS = 256;
const MAX_CARS = 48;
const RAIN_COUNT = 420;

// Reusable scratch math objects (zero GC per frame)
const _m4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scl = new THREE.Vector3();
const _euler = new THREE.Euler();
const _col = new THREE.Color();
const _proj = new THREE.Vector3();

function makeGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const c = canvas.getContext('2d');
  const g = c.createRadialGradient(64, 64, 2, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Actors3D {
  constructor(scene3d, hudContainer) {
    this.scene3d = scene3d;
    this.scene = scene3d.scene;
    this.hudContainer = hudContainer;

    this._initHumans();
    this._initVehicles();
    this._initGlows();
    this._initRain();
    this._initConfetti();
    this._initHudPool();
  }

  _initHumans() {
    const shGeo = new THREE.CircleGeometry(0.24, 10);
    shGeo.rotateX(-Math.PI / 2);
    const shMat = new THREE.MeshBasicMaterial({ color: '#141016', transparent: true, opacity: 0.34, depthWrite: false });
    this.shadowMesh = new THREE.InstancedMesh(shGeo, shMat, MAX_HUMANS);

    const legMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 });
    this.legMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.34, 0.16), legMat, MAX_HUMANS);

    const torsoMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.72 });
    this.torsoMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.42, 0.2), torsoMat, MAX_HUMANS);

    const headMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.65 });
    this.headMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.23, 0.23, 0.23), headMat, MAX_HUMANS);

    const hairMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 });
    this.hairMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.26, 0.13, 0.25), hairMat, MAX_HUMANS);

    const badgeMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    this.badgeMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.09, 0), badgeMat, MAX_BADGES);

    [this.shadowMesh, this.legMesh, this.torsoMesh, this.headMesh, this.hairMesh, this.badgeMesh].forEach((m) => {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      this.scene.add(m);
    });
    _col.setHex(0xffffff);
    [this.legMesh, this.torsoMesh, this.headMesh, this.hairMesh, this.badgeMesh].forEach((m) => {
      m.setColorAt(0, _col);
    });
    this.torsoMesh.castShadow = true;
  }

  _initVehicles() {
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.45, metalness: 0.25 });
    const cabinMat = new THREE.MeshStandardMaterial({ color: '#dce4e6', roughness: 0.35, metalness: 0.15 });
    const motoMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55 });

    this.carBodyMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.55, 1), bodyMat, MAX_CARS);
    this.carCabinMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.4, 0.7), cabinMat, MAX_CARS);
    this.motoMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.32, 0.45, 0.62), motoMat, MAX_CARS);

    _col.setHex(0xffffff);
    [this.carBodyMesh, this.carCabinMesh, this.motoMesh].forEach((m) => {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.castShadow = true;
      m.setColorAt(0, _col);
      this.scene.add(m);
    });
  }

  _initGlows() {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      map: makeGlowTexture(),
      color: '#ffffff',
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.glowMesh = new THREE.InstancedMesh(geo, mat, MAX_GLOWS);
    this.glowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.glowMesh.frustumCulled = false;
    this.glowMesh.setColorAt(0, _col.setHex(0xffffff));
    this.scene.add(this.glowMesh);
  }

  _initRain() {
    const pos = new Float32Array(RAIN_COUNT * 6);
    this.rainSeeds = new Float32Array(RAIN_COUNT * 3);
    for (let i = 0; i < RAIN_COUNT; i++) {
      this.rainSeeds[i * 3] = -20 + Math.random() * 76;
      this.rainSeeds[i * 3 + 1] = Math.random() * 18;
      this.rainSeeds[i * 3 + 2] = -2 + Math.random() * 40;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.LineBasicMaterial({ color: '#9ab7e6', transparent: true, opacity: 0.45 });
    this.rainLines = new THREE.LineSegments(geo, mat);
    this.rainLines.visible = false;
    this.rainLines.frustumCulled = false;
    this.scene.add(this.rainLines);
  }

  _initConfetti() {
    const COUNT = 80;
    const pos = new Float32Array(COUNT * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: '#ffd65c',
      size: 0.28,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.confetti = new THREE.Points(geo, mat);
    this.confetti.visible = false;
    this.confetti.frustumCulled = false;
    this.confettiParticles = [];
    this.scene.add(this.confetti);
  }

  spawnConfettiBurst(x, y, z = 2.0) {
    for (let i = 0; i < 36; i++) {
      if (this.confettiParticles.length >= 80) this.confettiParticles.shift();
      const ang = Math.random() * Math.PI * 2;
      const spd = 1.2 + Math.random() * 2.5;
      this.confettiParticles.push({
        x,
        y: z,
        z: y,
        vx: Math.cos(ang) * spd,
        vy: 3.5 + Math.random() * 3.5,
        vz: Math.sin(ang) * spd,
        life: 1.6 + Math.random() * 0.8,
      });
    }
  }

  _initHudPool() {
    this.hudNodes = [];
    if (!this.hudContainer) return;
    for (let i = 0; i < 52; i++) {
      const el = document.createElement('div');
      el.className = 'whud-pill';
      el.style.display = 'none';
      this.hudContainer.appendChild(el);
      this.hudNodes.push(el);
    }
  }

  _pushHuman(state, x, z, lift, ph, sit, shirt, hair, skin, pants, wide = false, badgeCol = null) {
    if (state.hCount >= MAX_HUMANS) return;
    const idx = state.hCount++;
    const yBase = (lift || 0) * Z_SCALE * 0.65 + 0.08;
    const bounce = sit ? 0 : Math.abs(Math.sin(ph || 0)) * 0.05;
    const wMul = wide ? 1.22 : 1.0;

    // Shadow
    if (!lift) {
      _pos.set(x, 0.11, z);
      _quat.identity();
      _scl.set(1, 1, 1);
      _m4.compose(_pos, _quat, _scl);
    } else {
      _pos.set(0, -100, 0);
      _scl.set(0.001, 0.001, 0.001);
      _m4.compose(_pos, _quat, _scl);
    }
    this.shadowMesh.setMatrixAt(idx, _m4);

    // Legs
    _pos.set(x, yBase + (sit ? 0.14 : 0.17 + bounce * 0.5), z);
    _euler.set(0, 0, 0);
    _quat.setFromEuler(_euler);
    _scl.set(1, sit ? 0.65 : 1, sit ? 1.25 : 1);
    _m4.compose(_pos, _quat, _scl);
    this.legMesh.setMatrixAt(idx, _m4);
    _col.set(pants || '#3e3832');
    this.legMesh.setColorAt(idx, _col);

    // Torso
    const legTop = yBase + (sit ? 0.24 : 0.34) + bounce;
    _pos.set(x, legTop + 0.21, z);
    _scl.set(wMul, 1, wMul);
    _m4.compose(_pos, _quat, _scl);
    this.torsoMesh.setMatrixAt(idx, _m4);
    _col.set(shirt || '#C8574B');
    this.torsoMesh.setColorAt(idx, _col);

    // Head
    _pos.set(x, legTop + 0.53, z);
    _scl.set(1, 1, 1);
    _m4.compose(_pos, _quat, _scl);
    this.headMesh.setMatrixAt(idx, _m4);
    _col.set(skin || '#D7A47C');
    this.headMesh.setColorAt(idx, _col);

    // Hair
    _pos.set(x, legTop + 0.66, z);
    _m4.compose(_pos, _quat, _scl);
    this.hairMesh.setMatrixAt(idx, _m4);
    _col.set(hair || '#2b211b');
    this.hairMesh.setColorAt(idx, _col);

    // Optional badge above head
    if (badgeCol && state.bCount < MAX_BADGES) {
      const bi = state.bCount++;
      _pos.set(x, legTop + 0.92 + Math.sin(state.now / 280 + idx) * 0.04, z);
      _euler.set(0, state.now / 500 + idx, 0);
      _quat.setFromEuler(_euler);
      _scl.set(1, 1, 1);
      _m4.compose(_pos, _quat, _scl);
      this.badgeMesh.setMatrixAt(bi, _m4);
      _col.set(badgeCol);
      this.badgeMesh.setColorAt(bi, _col);
    }
  }

  _pushGlow(state, x, z, radius, hex, y = 0.12) {
    if (state.gCount >= MAX_GLOWS) return;
    const gi = state.gCount++;
    _pos.set(x, y, z);
    _quat.identity();
    _scl.set(radius, 1, radius);
    _m4.compose(_pos, _quat, _scl);
    this.glowMesh.setMatrixAt(gi, _m4);
    _col.set(hex);
    this.glowMesh.setColorAt(gi, _col);
  }

  _pushHud(state, wx, wy, wz, text, cls, onClick = null) {
    if (!this.hudContainer || state.hudIdx >= this.hudNodes.length) return;
    _proj.set(wx, wy, wz).project(this.scene3d.camera);
    if (_proj.z < -1 || _proj.z > 1) return;
    const sx = (_proj.x * 0.5 + 0.5) * this.hudW;
    const sy = (-_proj.y * 0.5 + 0.5) * this.hudH;
    if (sx < -60 || sx > this.hudW + 60 || sy < -40 || sy > this.hudH + 40) return;
    const el = this.hudNodes[state.hudIdx++];
    el.style.display = 'block';
    el.className = `whud-pill ${cls}`;
    el.textContent = text;
    el.style.transform = `translate3d(${Math.round(sx)}px, ${Math.round(sy)}px, 0) translate(-50%, -100%)`;
    el.onclick = onClick;
    el.style.pointerEvents = onClick ? 'auto' : 'none';
  }

  update(G, dtReal, onSelectLot) {
    const now = performance.now();
    const cam = this.scene3d.camera;
    const camDist = cam.position.distanceTo(this.scene3d.controls.target);
    this.hudW = this.hudContainer ? this.hudContainer.clientWidth : 800;
    this.hudH = this.hudContainer ? this.hudContainer.clientHeight : 600;

    const state = { hCount: 0, bCount: 0, gCount: 0, hudIdx: 0, now };

    // 1. Pedestrians
    for (let i = 0; i < G.peds.length; i++) {
      const p = G.peds[i];
      if (p.hidden) continue;
      const l = p.bar != null ? G.lots[p.bar] : null;
      const sitSeat = p.st === 'sit' && p.seat != null && l ? l._seats?.[p.seat] : null;
      const badgeCol = p.vip ? '#ffd65c' : p.bar != null && l?.kind === 'mine' ? CT[p.ctype].col : null;
      this._pushHuman(state, p.x, p.y, sitSeat ? sitSeat.lift : 0, p.ph, !!sitSeat, p.shirt, p.hair, p.skin, '#3d3731', false, badgeCol);
      if (p.bub > 0 && camDist < 52) {
        this._pushHud(state, p.x, 1.38, p.y, p.bt, p.bc === '#FF5C54' || p.bc === '#B5362F' ? 'bad' : p.bc === '#E8B959' ? 'gold' : 'bub');
      }
    }

    // 2. Player bars staff + clerks + DJs
    for (let i = 0; i < G.lots.length; i++) {
      const l = G.lots[i];
      if (l.kind === 'mine') {
        // Bartender
        const [cx, cy] = Lw(l, (l.L * 2.3) / 5, (l.D * 0.3) / 6);
        this._pushHuman(state, cx, cy, 0, 0, false, '#F0E8D6', '#2b211b', '#D7A47C', '#2a2420');
        if (l.dj) {
          const [dx, dy] = Lw(l, l.L - 0.8, l.D - 1.55);
          this._pushHuman(state, dx, dy, 0, barOpen() ? now / 180 : 0, false, '#3F4A5A', '#1f1a18', '#C99670', '#242026', false, barOpen() ? '#ff52d9' : null);
        }
        // Marketing
        for (let m = 0; m < l.mkts.length; m++) {
          const mk = l.mkts[m];
          this._pushHuman(state, mk.x, mk.y, 0, mk._ph, false, '#2F261E', mk.hair, mk.skin, '#242026');
          if (camDist < 24) this._pushHud(state, mk.x, 1.32, mk.y, `${mk.name}·营销`, 'tag');
        }
        // Bouncers
        for (let b = 0; b < (l.bouncers || []).length; b++) {
          const bc = l.bouncers[b];
          this._pushHuman(state, bc.x, bc.y, 0, bc._ph, false, '#18181f', '#121216', bc.skin, '#121216', true, bc._chase > 0 ? '#3DD6A5' : '#5EA8E8');
          if (camDist < 26) this._pushHud(state, bc.x, 1.38, bc.y, `🛡️ ${bc.name}`, 'tag');
        }
        // Hostesses
        for (let hIdx = 0; hIdx < l.hostesses.length; hIdx++) {
          const h = l.hostesses[hIdx];
          if (h.hidden) continue;
          const t = tierOf(h);
          this._pushHuman(
            state, h.x, h.y + (h.sit ? 0.05 : 0), h.lift, h._ph, h.sit,
            h.dress, h.hair, h.skin, h.dress, h.body === 'curvy',
            t === 2 ? '#ffd65c' : t === 1 ? '#ff7c6e' : null,
          );
          if (camDist < 24) this._pushHud(state, h.x, 1.35 + (h.lift || 0) * Z_SCALE * 0.6, h.y, h.name, 'name');
        }
      } else if (l.kind === 'rival') {
        for (let hIdx = 0; hIdx < l.hs.length; hIdx++) {
          const h = l.hs[hIdx];
          this._pushHuman(state, h.x, h.y + (h.sit ? 0.05 : 0), h.lift, h._ph, h.sit, h.dress, h.hair, h.skin, h.dress, h.body === 'curvy');
        }
        for (let tIdx = 0; tIdx < l.touts.length; tIdx++) {
          const t = l.touts[tIdx];
          this._pushHuman(state, t.x, t.y, 0, t._ph, false, '#B5362F', t.hair, t.skin, '#302924');
        }
      } else if (l.kind === 'shop') {
        if (l.type === 'food') {
          const [cx, cy] = Lw(l, l.L * 0.4, 0.2);
          this._pushHuman(state, cx, cy, 0, 0, false, '#3F2E25', '#2b211b', '#D7A47C', '#242026');
        } else if (l.type === 'mart') {
          const [cx, cy] = Lw(l, l.L - 0.9, 0.35);
          this._pushHuman(state, cx, cy, 0, 0, false, '#2F6FB5', '#2b211b', '#D7A47C', '#242026');
        }
      }
    }

    // Security gate guards
    this._pushHuman(state, 50.6, 29.3, 0, 0, false, '#3F4A5A', '#1f1a18', '#C99670', '#2F261E');
    this._pushHuman(state, 50.6, 6.7, 0, 0, false, '#3F4A5A', '#1f1a18', '#C99670', '#2F261E');

    this.shadowMesh.count = state.hCount;
    this.legMesh.count = state.hCount;
    this.torsoMesh.count = state.hCount;
    this.headMesh.count = state.hCount;
    this.hairMesh.count = state.hCount;
    this.badgeMesh.count = state.bCount;
    [this.shadowMesh, this.legMesh, this.torsoMesh, this.headMesh, this.hairMesh, this.badgeMesh].forEach((m) => {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    });

    // 3. Moving Vehicles (Cars, Motorbikes, Police Cruiser)
    let carCount = 0;
    let motoCount = 0;
    const pushCar = (v) => {
      if (v.moto) {
        if (motoCount >= MAX_CARS) return;
        const mi = motoCount++;
        _pos.set(v.x, 0.32, v.y);
        _euler.set(0, v.ax ? 0 : Math.PI / 2, 0);
        _quat.setFromEuler(_euler);
        _scl.set(1, 1, 1);
        _m4.compose(_pos, _quat, _scl);
        this.motoMesh.setMatrixAt(mi, _m4);
        _col.set(v.c);
        this.motoMesh.setColorAt(mi, _col);
      } else {
        if (carCount >= MAX_CARS) return;
        const ci = carCount++;
        const len = v.vipCar ? 2.4 : 1.9;
        const wid = v.vipCar ? 0.96 : 0.84;
        _pos.set(v.x, 0.36, v.y);
        _euler.set(0, v.ax ? Math.PI / 2 : 0, 0);
        _quat.setFromEuler(_euler);
        _scl.set(len, 1, wid);
        _m4.compose(_pos, _quat, _scl);
        this.carBodyMesh.setMatrixAt(ci, _m4);
        _col.set(v.c);
        this.carBodyMesh.setColorAt(ci, _col);

        _pos.set(v.x, 0.78, v.y);
        _scl.set(len * 0.75, 1, wid * 1.15);
        _m4.compose(_pos, _quat, _scl);
        this.carCabinMesh.setMatrixAt(ci, _m4);
        _col.set(v.vipCar ? '#20222a' : '#dce4e6');
        this.carCabinMesh.setColorAt(ci, _col);
      }
    };

    for (let i = 0; i < G.cars.length; i++) pushCar(G.cars[i]);
    if (G.raidUntil && G.t < G.raidUntil) {
      pushCar({ x: GX + 1.6, y: 27, ax: 1, dir: -1, c: '#F3F3F0', moto: false });
    }
    this.carBodyMesh.count = carCount;
    this.carCabinMesh.count = carCount;
    this.motoMesh.count = motoCount;
    [this.carBodyMesh, this.carCabinMesh, this.motoMesh].forEach((m) => {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    });

    // 4. Instanced Additive Glow Pools (1 Draw Call!)
    const night = clamp((G.t / 60 - 17) / 2.4, 0, 1);
    if (night > 0.05) {
      for (let i = 0; i < POLES.length; i++) {
        this._pushGlow(state, POLES[i].lx, POLES[i].ly, 4.6, '#ffcf78');
      }
      this._pushGlow(state, GX + 0.5, 27, 5.2, '#8cb8ff');
      this._pushGlow(state, GX + 0.5, 9, 5.2, '#8cb8ff');

      for (let i = 0; i < G.lots.length; i++) {
        const l = G.lots[i];
        if (!lit(l)) continue;
        const glowRad = l.kind === 'mine' ? 3.2 + (l.sign || 0) * 1.1 + (skillActive(l, 'happyHour') ? 1.5 : 0) : 3.6;
        for (let d = 0; d < l.doors.length; d++) {
          this._pushGlow(state, l.doors[d].out[0], l.doors[d].out[1], glowRad, l.ac);
        }
      }

      for (let i = 0; i < G.cars.length; i++) {
        const v = G.cars[i];
        this._pushGlow(state, v.x + (v.ax ? 0 : v.dir * 1.3), v.y + (v.ax ? v.dir * 1.3 : 0), 2.3, '#fff0b8');
      }
    }
    if (G.raidUntil && G.t < G.raidUntil) {
      const fl = ((now / 220) | 0) % 2;
      const raidCol = fl ? '#ff2a2a' : '#2f6bff';
      this._pushGlow(state, GX + 1.6, 27, 6.0, raidCol);
      for (let i = 0; i < G.lots.length; i++) {
        const l = G.lots[i];
        if (l.kind === 'mine' || l.kind === 'rival') {
          this._pushGlow(state, l.doors[0].out[0], l.doors[0].out[1], 4.2, raidCol);
        }
      }
    }
    this.glowMesh.count = state.gCount;
    this.glowMesh.instanceMatrix.needsUpdate = true;
    if (this.glowMesh.instanceColor) this.glowMesh.instanceColor.needsUpdate = true;

    // 5. Rain & Confetti particles
    if (G.ev && G.ev.rain) {
      this.rainLines.visible = true;
      const posAttr = this.rainLines.geometry.attributes.position;
      const arr = posAttr.array;
      const fall = (now * 0.022) % 18;
      for (let i = 0; i < RAIN_COUNT; i++) {
        const sx = this.rainSeeds[i * 3];
        const sy = ((this.rainSeeds[i * 3 + 1] - fall) % 18 + 18) % 18;
        const sz = this.rainSeeds[i * 3 + 2];
        arr[i * 6] = sx;
        arr[i * 6 + 1] = sy;
        arr[i * 6 + 2] = sz;
        arr[i * 6 + 3] = sx - 0.18;
        arr[i * 6 + 4] = sy - 0.75;
        arr[i * 6 + 5] = sz + 0.12;
      }
      posAttr.needsUpdate = true;
    } else {
      this.rainLines.visible = false;
    }

    if (this.confettiParticles.length) {
      this.confetti.visible = true;
      const posAttr = this.confetti.geometry.attributes.position;
      const arr = posAttr.array;
      let write = 0;
      for (let i = 0; i < this.confettiParticles.length; i++) {
        const pt = this.confettiParticles[i];
        pt.life -= dtReal;
        if (pt.life <= 0) continue;
        pt.vy -= 9.5 * dtReal;
        pt.x += pt.vx * dtReal;
        pt.y = Math.max(0.15, pt.y + pt.vy * dtReal);
        pt.z += pt.vz * dtReal;
        arr[write * 3] = pt.x;
        arr[write * 3 + 1] = pt.y;
        arr[write * 3 + 2] = pt.z;
        this.confettiParticles[write++] = pt;
      }
      this.confettiParticles.length = write;
      this.confetti.geometry.setDrawRange(0, write);
      posAttr.needsUpdate = true;
    } else {
      this.confetti.visible = false;
    }

    // 6. Floating FX money popups & Overview shop signs
    for (let i = 0; i < G.fx.length; i++) {
      const f = G.fx[i];
      this._pushHud(state, f.x, f.z * Z_SCALE * 0.45, f.y, f.t, 'fx');
    }

    if (camDist > 29 && G.view == null) {
      for (let i = 0; i < G.lots.length; i++) {
        const l = G.lots[i];
        if (l.top) continue;
        const c = Lw(l, l.L / 2, l.D / 2);
        let label = l.name;
        let cls = 'shop-lbl';
        if (l.kind === 'empty') {
          label = `招租 ${fm(l.cost)}`;
          cls = 'shop-lbl empty';
        } else if (l.kind === 'mine') {
          label = `★ ${l.name} · ${l._g.length}/${l._seats?.length || 0}`;
          cls = 'shop-lbl mine';
        }
        this._pushHud(state, c[0], 4.2, c[1], label, cls, onSelectLot ? () => onSelectLot(l.i) : null);
      }
    }

    for (let i = state.hudIdx; i < this.hudNodes.length; i++) {
      this.hudNodes[i].style.display = 'none';
    }
  }
}
