import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  BARPAL, CONCEPTS, DECOR, GX, LAY, POLES, ROOMS, STY, SX, XA, XB, YA, YB, Z_SCALE, WH, SWH,
  LB, Lw, hsh, pickC,
} from './config.js';
import { curEls, seatList, wsSpots } from './state.js';
import { barOpen, lit, skillActive } from './sim.js';

const tmpColor = new THREE.Color();

function makeSignTexture(text, bg, fg, border = null, subText = null) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const c = canvas.getContext('2d');
  c.fillStyle = bg;
  c.fillRect(0, 0, 512, 128);
  if (border) {
    c.strokeStyle = border;
    c.lineWidth = 8;
    c.strokeRect(6, 6, 500, 116);
  }
  c.fillStyle = fg;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = 'bold 46px "DM Sans", "PingFang SC", sans-serif';
  c.fillText(text, 256, subText ? 48 : 64, 470);
  if (subText) {
    c.font = 'bold 28px "DM Sans", "PingFang SC", sans-serif';
    c.globalAlpha = 0.85;
    c.fillText(subText, 256, 94, 470);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeRoadLabelTexture(text, bg = 'rgba(0,0,0,0)', fg = 'rgba(255,255,255,0.72)') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const c = canvas.getContext('2d');
  c.clearRect(0, 0, 512, 96);
  if (bg !== 'rgba(0,0,0,0)') {
    c.fillStyle = bg;
    c.fillRect(0, 0, 512, 96);
  }
  c.fillStyle = fg;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = '700 34px "DM Sans", sans-serif';
  c.fillText(text, 256, 48, 490);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePlankTexture(baseHex) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const c = canvas.getContext('2d');
  c.fillStyle = baseHex;
  c.fillRect(0, 0, 128, 128);
  c.strokeStyle = 'rgba(25,18,14,0.18)';
  c.lineWidth = 2;
  for (let y = 0; y < 128; y += 16) {
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(128, y);
    c.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function colorizeGeometry(geom, hex) {
  const g = geom.index ? geom.toNonIndexed() : geom;
  const count = g.attributes.position.count;
  const colors = new Float32Array(count * 3);
  tmpColor.set(hex);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

function makeBoxGeom(cx, cy, cz, sx, sy, sz, hex) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  g.translate(cx, cy, cz);
  return colorizeGeometry(g, hex);
}

function boxMesh(x0, z0, w, d, h, yBase, mat, cast = false, recv = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x0 + w / 2, yBase + h / 2, z0 + d / 2);
  m.castShadow = cast;
  m.receiveShadow = recv;
  return m;
}

export class World3D {
  constructor(scene3d) {
    this.scene3d = scene3d;
    this.scene = scene3d.scene;
    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.matCache = new Map();
    this.signTexCache = new Map();
    this.lotGroups = [];
    this.lotMeta = [];
    this.gateArms = [];
    this.lampBulbMat = new THREE.MeshStandardMaterial({
      color: '#ffe8a3',
      emissive: '#ffcf6e',
      emissiveIntensity: 0.2,
      roughness: 0.3,
    });
    this.roadMat = new THREE.MeshStandardMaterial({
      color: '#2c2c34',
      roughness: 0.85,
      metalness: 0.08,
    });

    this.selRing = this._createSelectionRing();
    this.root.add(this.selRing);
    this._camDir = new THREE.Vector3();
    this._tmpCenter = new THREE.Vector3();
  }

  getMat(hex, opts = {}) {
    const key = `${hex}|${opts.rough ?? 0.78}|${opts.metal ?? 0.05}|${opts.emissive ?? ''}|${opts.emInt ?? 0}|${opts.opacity ?? 1}`;
    let m = this.matCache.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        color: hex,
        roughness: opts.rough ?? 0.78,
        metalness: opts.metal ?? 0.05,
        emissive: opts.emissive || '#000000',
        emissiveIntensity: opts.emInt ?? 0,
        transparent: (opts.opacity ?? 1) < 1,
        opacity: opts.opacity ?? 1,
      });
      this.matCache.set(key, m);
    }
    return m;
  }

  _createSelectionRing() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const c = canvas.getContext('2d');
    c.clearRect(0, 0, 256, 256);
    c.strokeStyle = '#ff6a5b';
    c.lineWidth = 14;
    c.strokeRect(10, 10, 236, 236);
    c.strokeStyle = 'rgba(255, 190, 92, 0.7)';
    c.lineWidth = 4;
    c.strokeRect(20, 20, 216, 216);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    return mesh;
  }

  buildAll(G) {
    if (this.staticGroup) this.root.remove(this.staticGroup);
    this.staticGroup = new THREE.Group();
    this.gateArms = [];

    this._buildSlabAndRoads();
    this._buildGatesAndProps(G);
    this.root.add(this.staticGroup);

    // Clear old lots
    this.lotGroups.forEach((g) => this.root.remove(g));
    this.lotGroups = [];
    this.lotMeta = [];

    for (let i = 0; i < G.lots.length; i++) {
      const grp = new THREE.Group();
      this.root.add(grp);
      this.lotGroups.push(grp);
      this.lotMeta.push(null);
      this.rebuildLot(G.lots[i], G);
    }
  }

  _buildSlabAndRoads() {
    const g = this.staticGroup;
    const W = XB - XA;
    const D = YB - YA;
    const cx = (XA + XB) / 2;
    const cz = (YA + YB) / 2;

    // Diorama layered plinth
    const groundMat = this.getMat('#3f3b45', { rough: 0.92 });
    const ground = new THREE.Mesh(new THREE.BoxGeometry(W, 0.45, D), groundMat);
    ground.position.set(cx, -0.225, cz);
    ground.receiveShadow = true;
    g.add(ground);

    const earthMat = this.getMat('#3b2c23', { rough: 0.95 });
    const earth = new THREE.Mesh(new THREE.BoxGeometry(W - 0.3, 1.35, D - 0.3), earthMat);
    earth.position.set(cx, -1.12, cz);
    g.add(earth);

    // Sidewalks & lots pads
    const swGeoms = [];
    const addPad = (x1, x2, y1, y2, yTop, thick, hex) => {
      swGeoms.push(makeBoxGeom((x1 + x2) / 2, yTop - thick / 2, (y1 + y2) / 2, x2 - x1, thick, y2 - y1, hex));
    };

    // Block pads
    [[0, GX, 0, 7], [0, SX, 11, 25], [0, GX, 29, 36], [-20.5, -13, 5, 31]].forEach(([a, b, c, d]) =>
      addPad(a, b, c, d, 0.03, 0.04, '#504b54'),
    );
    // Sidewalks along streets
    [
      [-13, GX, 7, 11], [-13, GX, 25, 29], [-4, 0, 7, 29],
      [-13, -9, 7, 29], [SX, GX, 7, 29], [GX, XB, YA, YB],
    ].forEach(([a, b, c, d]) => addPad(a, b, c, d, 0.04, 0.06, '#65606b'));

    // Parking lot concrete
    addPad(-9, -4, 11, 25, 0.03, 0.05, '#3b3b44');

    // White parking stalls & road lane dashes + one-way arrows
    const paintHex = '#ded8cc';
    for (let k = 0; k <= 11; k++) {
      const y = 11 + k * 1.25 + 0.35;
      [[-8.9, -6.8], [-6.2, -4.1]].forEach(([a, b]) => {
        swGeoms.push(makeBoxGeom((a + b) / 2, 0.055, y, b - a, 0.02, 0.08, paintHex));
      });
    }

    const addDashLine = (x1, y1, x2, y2) => {
      const len = Math.hypot(x2 - x1, y2 - y1);
      const steps = Math.max(1, Math.floor(len / 2.2));
      const dx = (x2 - x1) / steps;
      const dy = (y2 - y1) / steps;
      const horiz = Math.abs(x2 - x1) > Math.abs(y2 - y1);
      for (let i = 0; i < steps; i++) {
        const px = x1 + dx * (i + 0.5);
        const py = y1 + dy * (i + 0.5);
        swGeoms.push(makeBoxGeom(px, 0.055, py, horiz ? 1.0 : 0.1, 0.015, horiz ? 0.1 : 1.0, '#d8d2c5'));
      }
    };
    addDashLine(-11, 9, GX, 9);
    addDashLine(-11, 27, GX, 27);
    addDashLine(-2, 9, -2, 27);
    addDashLine(-11, 9, -11, 27);
    addDashLine(49.5, 9, 49.5, 27);
    addDashLine(53.9, YA, 53.9, YB);

    // One-way arrows along the U
    [
      [30, 26.6, -1, 0], [12, 26.6, -1, 0], [-2.4, 22, 0, -1], [-2.4, 14, 0, -1],
      [-11.3, 22, 0, -1], [-11.3, 14, 0, -1], [49.5, 20, 0, -1], [12, 9.4, 1, 0], [30, 9.4, 1, 0],
    ].forEach(([x, y, dx, dy]) => {
      swGeoms.push(makeBoxGeom(x, 0.058, y, Math.abs(dx) ? 0.9 : 0.25, 0.015, Math.abs(dy) ? 0.9 : 0.25, '#f1ead8'));
      swGeoms.push(makeBoxGeom(x + dx * 0.55, 0.058, y + dy * 0.55, 0.35, 0.015, 0.35, '#f1ead8'));
    });

    const swMesh = new THREE.Mesh(
      mergeGeometries(swGeoms, false),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 }),
    );
    swMesh.receiveShadow = true;
    g.add(swMesh);

    // Asphalt roads (separate mesh sharing this.roadMat so rain can make it glossy)
    const roadGeoms = [
      makeBoxGeom((-12.2 + GX) / 2, 0.025, 9, GX + 12.2, 0.05, 2.4, '#ffffff'),
      makeBoxGeom((-12.2 + GX) / 2, 0.025, 27, GX + 12.2, 0.05, 2.4, '#ffffff'),
      makeBoxGeom(-2, 0.025, 18, 2.4, 0.05, 20.4, '#ffffff'),
      makeBoxGeom(-11, 0.025, 18, 2.4, 0.05, 20.4, '#ffffff'),
      makeBoxGeom(49.5, 0.025, 18, 2.4, 0.05, 20.4, '#ffffff'),
      makeBoxGeom((GX + 0.8 + XB) / 2, 0.025, (YA + YB) / 2, XB - GX - 0.8, 0.05, YB - YA, '#ffffff'),
    ];
    const roadMesh = new THREE.Mesh(mergeGeometries(roadGeoms, false), this.roadMat);
    roadMesh.receiveShadow = true;
    g.add(roadMesh);

    // Road name markings
    const addGroundDecal = (x, z, w, h, rotY, text) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ map: makeRoadLabelTexture(text), transparent: true, depthWrite: false }),
      );
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = rotY;
      m.position.set(x, 0.068, z);
      g.add(m);
    };
    addGroundDecal(22, 9.2, 14, 1.5, 0, 'Jl. Komp. Ruko Kota Indah');
    addGroundDecal(22, 27.2, 14, 1.5, 0, 'Jl. Komp. Ruko Kota Indah');
    addGroundDecal(54.3, 22, 15, 1.5, -Math.PI / 2, 'Jl. Pangeran Jayakarta');
    addGroundDecal(-6.5, 18, 8, 1.8, -Math.PI / 2, 'PARKIR');
  }

  _buildGatesAndProps(G) {
    const g = this.staticGroup;
    const geoms = [];
    const pushBox = (cx, cy, cz, sx, sy, sz, hex) => geoms.push(makeBoxGeom(cx, cy, cz, sx, sy, sz, hex));

    // Street lamp poles
    POLES.forEach((p) => {
      const h = 34 * Z_SCALE;
      pushBox(p.x, h / 2, p.y, 0.14, h, 0.14, '#5c5148');
      const ax = (p.x + p.lx) / 2;
      const az = (p.y + p.ly) / 2;
      pushBox(ax, h - 0.3, az, Math.max(0.12, Math.abs(p.lx - p.x)), 0.1, Math.max(0.12, Math.abs(p.ly - p.y)), '#5c5148');
      const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.25), this.lampBulbMat);
      bulb.position.set(p.lx, h - 0.38, p.ly);
      g.add(bulb);
    });

    // Overhead sagging wires
    const wireMat = new THREE.LineBasicMaterial({ color: '#38302b', transparent: true, opacity: 0.55 });
    for (let i = 0; i < POLES.length - 1; i++) {
      const p = POLES[i];
      const q = POLES[i + 1];
      if (p.s !== q.s) continue;
      const yTop = 33 * Z_SCALE;
      [0.3, 0.55].forEach((sag) => {
        const pts = [];
        for (let k = 0; k <= 8; k++) {
          const t = k / 8;
          pts.push(new THREE.Vector3(p.x + (q.x - p.x) * t, yTop - Math.sin(t * Math.PI) * sag, p.y + (q.y - p.y) * t));
        }
        g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
      });
    }

    // Compound fence between MASUK and KELUAR gates
    pushBox(GX - 0.05, 0.5, 18, 0.16, 1.0, 14, '#cfc6b8');

    // Gates at GX
    [[25, 29, '入口 · MASUK', 30.2], [7, 11, '出口 · KELUAR', 5.8]].forEach(([ya, yb, txt, by]) => {
      const gh = 19 * Z_SCALE;
      pushBox(GX, gh / 2, ya, 0.22, gh, 0.22, '#4c4640');
      pushBox(GX, gh / 2, yb, 0.22, gh, 0.22, '#4c4640');
      // Overhead blue portal sign
      const signGeo = new THREE.BoxGeometry(0.28, 1.0, yb - ya);
      const signMat = [
        new THREE.MeshBasicMaterial({ map: makeSignTexture(txt, '#255c9e', '#ffffff') }),
        new THREE.MeshBasicMaterial({ map: makeSignTexture(txt, '#255c9e', '#ffffff') }),
        this.getMat('#255c9e'), this.getMat('#255c9e'), this.getMat('#255c9e'), this.getMat('#255c9e'),
      ];
      const signMesh = new THREE.Mesh(signGeo, signMat);
      signMesh.position.set(GX, 16.5 * Z_SCALE, (ya + yb) / 2);
      g.add(signMesh);

      // Guard booth
      pushBox(50.4, 1.0, by, 1.0, 2.0, 1.0, '#e6dfd0');
      pushBox(50.4, 2.08, by, 1.15, 0.16, 1.15, '#255c9e');

      // Animated gate boom arm
      const pivot = new THREE.Group();
      pivot.position.set(GX, 0.9, yb - 0.25);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, (yb - ya) * 0.68), this.getMat('#d44d42'));
      arm.position.set(0, 0, -((yb - ya) * 0.68) / 2);
      pivot.add(arm);
      g.add(pivot);
      this.gateArms.push({ pivot, yMid: (ya + yb) / 2, open: 0 });
    });

    // Static street props (parked cars, bikes, cones, trees, food cart, fruit stall)
    const addCarGeom = (x, y, ax, c) => {
      const w = ax ? 0.84 : 1.9;
      const d = ax ? 1.9 : 0.84;
      pushBox(x, 0.45, y, w, 0.58, d, c);
      pushBox(x, 0.94, y, ax ? 0.72 : 1.05, 0.42, ax ? 1.05 : 0.72, '#dce2e1');
      pushBox(x - (ax ? 0.3 : 0.6), 0.16, y - (ax ? 0.6 : 0.3), 0.22, 0.22, 0.22, '#222024');
      pushBox(x + (ax ? 0.3 : 0.6), 0.16, y + (ax ? 0.6 : 0.3), 0.22, 0.22, 0.22, '#222024');
    };

    DECOR.forEach((d) => {
      if (d.t === 'car') addCarGeom(d.x, d.y, d.ax, d.c);
      else if (d.t === 'bike') {
        pushBox(d.x, 0.32, d.y, 0.24, 0.4, 0.56, d.c);
        pushBox(d.x, 0.56, d.y - 0.14, 0.34, 0.12, 0.12, '#282320');
      } else if (d.t === 'cone') {
        pushBox(d.x, 0.18, d.y, 0.26, 0.36, 0.26, '#e87236');
      } else if (d.t === 'tree') {
        pushBox(d.x, 0.9, d.y, 0.26, 1.8, 0.26, '#7a5234');
        const crown = new THREE.DodecahedronGeometry(1.05, 1);
        crown.translate(d.x, 2.3, d.y);
        geoms.push(colorizeGeometry(crown, '#5c9c6b'));
        const crown2 = new THREE.DodecahedronGeometry(0.7, 1);
        crown2.translate(d.x - 0.45, 2.65, d.y - 0.3);
        geoms.push(colorizeGeometry(crown2, '#73b581'));
      } else if (d.t === 'cart') {
        // Indonesian Gerobak food cart with blue tarp canopy
        pushBox(d.x + 0.25, 0.55, d.y, 0.65, 1.0, 1.2, '#5B7FA6');
        pushBox(d.x + 0.25, 1.95, d.y, 1.2, 0.16, 1.6, '#3f69a8');
        const lantern = new THREE.Mesh(
          new THREE.SphereGeometry(0.16, 8, 6),
          this.getMat('#ffcf66', { emissive: '#ffaa33', emissiveInt: 1.6 }),
        );
        lantern.position.set(d.x + 0.7, 1.65, d.y);
        g.add(lantern);
      } else if (d.t === 'fruit') {
        pushBox(d.x + 0.25, 0.45, d.y, 0.65, 0.85, 1.2, '#B98654');
        for (let k = 0; k < 5; k++) {
          pushBox(d.x + 0.25, 0.96, d.y - 0.4 + k * 0.2, 0.25, 0.18, 0.18, pickC(k));
        }
      }
    });

    // Parking lot static cars & bikes
    (G.park || []).forEach((d) => {
      if (d.t === 'car') addCarGeom(d.x, d.y, false, d.c);
      else pushBox(d.x, 0.3, d.y, 0.5, 0.38, 0.22, d.c);
    });

    if (geoms.length) {
      const merged = mergeGeometries(geoms, false);
      const staticMesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 }));
      staticMesh.castShadow = true;
      staticMesh.receiveShadow = true;
      g.add(staticMesh);
    }
  }

  _wallColor(l) {
    if (l.kind === 'mine') return ['#EFE6D2', '#EAD9BC', '#E0C4A6', '#C9A9A4'][l.decor || 0];
    if (l.kind === 'rival') return '#D9C7C0';
    if (l.kind === 'empty') return '#DDD4C0';
    return '#EEE7D8';
  }

  _floorColor(l) {
    if (l.kind === 'mine') return ['#C8BEA8', '#B8956A', '#9E734A', '#75503C'][l.decor || 0];
    return l.fl || '#C8BEA8';
  }

  rebuildLot(l, G) {
    const grp = this.lotGroups[l.i];
    if (!grp) return;
    while (grp.children.length) grp.remove(grp.children[0]);

    const cutWalls = [];
    const { x0, y0, x1, y1, L, D } = l;
    const spanX = x1 - x0;
    const spanZ = y1 - y0;
    const isMine = l.kind === 'mine';
    const isEmpty = l.kind === 'empty';
    const isRival = l.kind === 'rival';

    // Base floor slab
    const fCol = this._floorColor(l);
    const floorMat = isMine && l.decor > 0
      ? new THREE.MeshStandardMaterial({ map: makePlankTexture(fCol), roughness: 0.72 })
      : this.getMat(fCol, { rough: 0.86 });
    const floor = boxMesh(x0, y0, spanX, spanZ, 0.08, 0.02, floorMat, false, true);
    grp.add(floor);

    // Work / room floor zone highlights
    const els = curEls(l);
    els.forEach((e) => {
      if (e[0] !== 'work' && e[0] !== 'room' && e[0] !== 'ws') return;
      const pad = e[0] === 'ws' ? 0.45 : 0;
      const [bx, by, bw, bd] = LB(l, Math.max(0.05, e[1] - pad), Math.max(0.05, e[2] - pad), Math.min(L - 0.05, e[3] + pad), Math.min(D - 0.05, e[4] + pad));
      const zoneMat = this.getMat(e[0] === 'room' ? '#584e5a' : '#857766', { rough: 0.9, opacity: 0.38 });
      const zm = boxMesh(bx, by, bw, bd, 0.02, 0.1, zoneMat, false, true);
      grp.add(zm);
    });

    // Wall definitions around perimeter
    const wallHex = this._wallColor(l);
    const wallMat = this.getMat(wallHex, { rough: 0.84 });
    const S = STY[l.style] || STY.oldgrey;
    const upMat = this.getMat(S.up, { rough: 0.76 });
    const lowH = 0.65;
    const midH = 8.6 * Z_SCALE;
    const fullH = (l.top ? l.part : WH) * Z_SCALE;
    const th = 0.16;

    const addCutWall = (x, z, w, d, nx, nz, extraChildren = null) => {
      // Lower permanent wainscot
      grp.add(boxMesh(x, z, w, d, lowH, 0.08, wallMat, true, true));
      // Upper smart-cutaway group
      const ug = new THREE.Group();
      const upper = boxMesh(x, z, w, d, fullH - lowH, lowH + 0.08, isEmpty ? wallMat : upMat, true, true);
      ug.add(upper);
      if (extraChildren) extraChildren.forEach((c) => ug.add(c));
      grp.add(ug);
      cutWalls.push({ mesh: ug, nx, nz });
    };

    // Determine which faces have doors vs tall facade
    const isAlongY = l.f[0] === 'y'; // front/back run along X (yMin/yMax are front/back)
    const cx = (x0 + x1) / 2;
    const cz = (y0 + y1) / 2;

    // 4 walls: xMin (north), xMax (south), yMin (east), yMax (west)
    // Back / facade is at xMin if !alongY, or yMin if alongY (unless f==='yMin' -> back is yMax? Wait: in original drawFacade:
    // F(l, u, z) = l.f[0]==='x' ? iso(l.x0, l.y1-u, z) : iso(l.x0+u, l.y0, z)!
    // That means the TALL facade wall is ALWAYS on x0 (if f is xMin/xMax) or y0 (if f is yMin/yMax)!
    // And nearWalls puts the low wall + door gaps on x1 (if f is xMax) or y1 (if f is yMax)!
    const tallOnY0 = isAlongY;
    const facadeGroup = new THREE.Group();
    const roomWindows = [];
    let signMat = null;

    // Tall facade wall + architectural details + marquee sign
    if (tallOnY0) {
      if (l.f === 'yMin') {
        // Segment lower wall around front door(s) on y0 so guests walk cleanly through door openings
        this._buildSegmentedLowerOnly(grp, x0, y0, spanX, true, l.doorUs, lowH, wallMat);
      } else {
        grp.add(boxMesh(x0, y0, spanX, th, lowH, 0.08, wallMat, true, true));
      }
      facadeGroup.add(boxMesh(x0, y0, spanX, th, midH - lowH, lowH + 0.08, wallMat, true, true));
      if (!l.top) {
        facadeGroup.add(boxMesh(x0, y0, spanX, th, fullH - midH, midH + 0.08, upMat, true, true));
      }
      cutWalls.push({ mesh: facadeGroup, nx: 0, nz: -1 });
      // Side wall x0 (segment lower if xd north doors exist, e.g. NEW SARI AYU)
      if (l.xd && l.xd.length) {
        const xdOffsets = l.xd.map((wy) => y1 - wy);
        this._buildSegmentedWall(grp, cutWalls, x0, y0, spanZ, false, xdOffsets, lowH, fullH, wallMat, -1, 0);
      } else {
        addCutWall(x0, y0, th, spanZ, -1, 0);
      }
      // Side wall x1
      addCutWall(x1 - th, y0, th, spanZ, 1, 0);
      // Front/back wall y1 (with door openings if f==='yMax')
      if (l.f === 'yMax') {
        this._buildSegmentedWall(grp, cutWalls, x0, y1 - th, spanX, true, l.doorUs, lowH, l.part * Z_SCALE, wallMat, 0, 1);
      } else {
        addCutWall(x0, y1 - th, spanX, th, 0, 1);
      }
    } else {
      if (l.f === 'xMin') {
        this._buildSegmentedLowerOnly(grp, x0, y0, spanZ, false, l.doorUs, lowH, wallMat);
      } else {
        grp.add(boxMesh(x0, y0, th, spanZ, lowH, 0.08, wallMat, true, true));
      }
      facadeGroup.add(boxMesh(x0, y0, th, spanZ, midH - lowH, lowH + 0.08, wallMat, true, true));
      if (!l.top) {
        facadeGroup.add(boxMesh(x0, y0, th, spanZ, fullH - midH, midH + 0.08, upMat, true, true));
      }
      cutWalls.push({ mesh: facadeGroup, nx: -1, nz: 0 });
      // Side walls y0 & y1 (spanX)
      addCutWall(x0, y0, spanX, th, 0, -1);
      addCutWall(x0, y1 - th, spanX, th, 0, 1);
      // Front wall x1 (spanZ)
      if (l.f === 'xMax') {
        this._buildSegmentedWall(grp, cutWalls, x1 - th, y0, spanZ, false, l.doorUs, lowH, l.part * Z_SCALE, wallMat, 1, 0);
      } else {
        addCutWall(x1 - th, y0, th, spanZ, 1, 0);
      }
    }
    grp.add(facadeGroup);

    // Style facade details attached to facadeGroup so they cut away smoothly with the tall wall
    this._decorateFacade(facadeGroup, l, tallOnY0, roomWindows, S);

    // Floating Neon / Marquee Signboard (ALWAYS visible above shop front so player always identifies stores!)
    const signLabel = isEmpty ? 'DISEWAKAN · 招租' : l.name.toUpperCase();
    const bg = isEmpty ? '#F7F2E6' : l.style === 'smart' ? '#F3F3F0' : l.ac;
    const fg = isEmpty ? '#B5362F' : l.style === 'smart' ? '#2F6FB5' : l.lay === 'sari' ? '#8E1F1B' : '#FFFFFF';
    const texKey = `${signLabel}|${bg}|${fg}`;
    let tex = this.signTexCache.get(texKey);
    if (!tex) {
      tex = makeSignTexture(signLabel, bg, fg, isEmpty ? '#B5362F' : null);
      this.signTexCache.set(texKey, tex);
    }
    const isOpenNow = lit(l);
    const signLevel = isMine ? l.sign || 0 : isRival ? 2 : 0;
    signMat = new THREE.MeshStandardMaterial({
      map: tex,
      emissive: isEmpty ? '#000000' : l.ac,
      emissiveMap: isEmpty ? null : tex,
      emissiveIntensity: isOpenNow ? 0.55 + 0.38 * signLevel : 0.06,
      roughness: 0.4,
    });
    const signLen = Math.max(2.6, L - 0.6);
    const signGeo = new THREE.BoxGeometry(tallOnY0 ? signLen : 0.24, 0.78, tallOnY0 ? 0.24 : signLen);
    const signMesh = new THREE.Mesh(signGeo, signMat);
    const su = l.signU != null ? l.signU : L / 2;
    if (tallOnY0) signMesh.position.set(x0 + su, 10.7 * Z_SCALE, y0 + 0.12);
    else signMesh.position.set(x0 + 0.12, 10.7 * Z_SCALE, y1 - su);
    grp.add(signMesh);

    // Striped awning over street-side door
    if (!isEmpty && (l.f === 'yMax' || l.f === 'xMax')) {
      for (let u = 0; u < L - 0.01; u++) {
        const seg = Math.min(1, L - u);
        const col = u % 2 ? l.ac : '#F3ECDC';
        const awMat = this.getMat(col, { rough: 0.7 });
        let aw;
        if (l.f === 'yMax') {
          aw = new THREE.Mesh(new THREE.BoxGeometry(seg, 0.08, 0.72), awMat);
          aw.position.set(x0 + u + seg / 2, 8.8 * Z_SCALE, y1 + 0.28);
          aw.rotation.x = 0.4;
        } else {
          aw = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.08, seg), awMat);
          aw.position.set(x1 + 0.28, 8.8 * Z_SCALE, y1 - u - seg / 2);
          aw.rotation.z = -0.4;
        }
        aw.castShadow = true;
        grp.add(aw);
      }
    }

    // Empty lot standing sign
    if (isEmpty) {
      const [bx, by] = Lw(l, L / 2, D / 2);
      const post = boxMesh(bx - 0.06, by - 0.06, 0.12, 0.12, 1.35, 0.1, this.getMat('#6a5848'));
      const boardTex = makeSignTexture('DISEWAKAN', '#F7F2E6', '#B5362F', '#B5362F', '点击租铺开店');
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(isAlongY ? 1.6 : 0.12, 0.85, isAlongY ? 0.12 : 1.6),
        new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.6 }),
      );
      board.position.set(bx, 1.25, by);
      board.castShadow = true;
      grp.add(post, board);
      this.lotMeta[l.i] = { cutWalls, roomWindows, signMat, djCone: null };
      return;
    }

    // Interior Furniture
    const sofaColor = isMine
      ? l.concept === 'ktv' ? '#7D4E9E' : l.concept === 'club' ? '#2B7A8A' : l.ac
      : BARPAL[l.lay]?.sofa || '#A8403A';
    const djCone = this._buildInterior(grp, l, els, sofaColor);

    this.lotMeta[l.i] = { cutWalls, roomWindows, signMat, djCone };
  }

  _wallIntervals(span, doorUs) {
    let iv = [[0, span]];
    (doorUs || []).forEach((g) => {
      const a = g - 0.55;
      const b = g + 0.55;
      iv = iv.flatMap(([s, e]) =>
        e <= a || s >= b ? [[s, e]] : [[s, Math.max(s, a)], [Math.min(e, b), e]].filter((q) => q[1] - q[0] > 0.05),
      );
    });
    return iv;
  }

  _buildSegmentedLowerOnly(grp, wx, wz, span, alongX, doorUs, lowH, mat) {
    this._wallIntervals(span, doorUs).forEach(([s, e]) => {
      const len = e - s;
      const x = alongX ? wx + s : wx;
      const z = alongX ? wz : wz + span - e;
      const w = alongX ? len : 0.16;
      const d = alongX ? 0.16 : len;
      grp.add(boxMesh(x, z, w, d, lowH, 0.08, mat, true, true));
    });
  }

  _buildSegmentedWall(grp, cutWalls, wx, wz, span, alongX, doorUs, lowH, h, mat, nx, nz) {
    this._wallIntervals(span, doorUs).forEach(([s, e]) => {
      const len = e - s;
      const x = alongX ? wx + s : wx;
      const z = alongX ? wz : wz + span - e;
      const w = alongX ? len : 0.16;
      const d = alongX ? 0.16 : len;
      grp.add(boxMesh(x, z, w, d, lowH, 0.08, mat, true, true));
      if (h > lowH) {
        const ug = boxMesh(x, z, w, d, h - lowH, lowH + 0.08, mat, true, true);
        grp.add(ug);
        cutWalls.push({ mesh: ug, nx, nz });
      }
    });
  }

  _decorateFacade(fg, l, tallOnY0, roomWindows, S) {
    const { x0, y0, y1, L } = l;
    const placeU = (u1, u2, z1, z2, mat) => {
      const len = Math.max(0.05, u2 - u1);
      const h = Math.max(0.05, (z2 - z1) * Z_SCALE);
      const y = z1 * Z_SCALE + 0.08;
      if (tallOnY0) {
        fg.add(boxMesh(x0 + u1, y0 + 0.02, len, 0.2, h, y, mat));
      } else {
        fg.add(boxMesh(x0 + 0.02, y1 - u2, 0.2, len, h, y, mat));
      }
    };

    if (l.kind === 'mine') {
      const n = ROOMS[l.rooms || 0];
      const w = (L - 0.5) / n;
      for (let i = 0; i < n; i++) {
        const wm = new THREE.MeshStandardMaterial({
          color: '#3e4756',
          emissive: i % 2 ? '#e46fb0' : '#f0b84f',
          emissiveIntensity: 0,
          roughness: 0.3,
        });
        roomWindows.push(wm);
        placeU(0.25 + i * w + 0.08, 0.25 + (i + 1) * w - 0.08, 13.3, 17.2, wm);
      }
      if ((l.decor || 0) >= 2) {
        const bulbM = this.getMat('#ffe27a', { emissive: '#ffbe44', emissiveInt: 1.1 });
        for (let u = 0.4; u < L - 0.3; u += 0.55) {
          placeU(u, u + 0.14, 8.2 - Math.abs(Math.sin(u * 2.5)) * 0.9, 8.5 - Math.abs(Math.sin(u * 2.5)) * 0.9, bulbM);
        }
      }
    } else if (!l.top) {
      const st = l.style;
      for (let u0 = 0; u0 < L - 0.5; u0 += 5) {
        const bw = Math.min(5, L - u0);
        const sd = l.i * 7 + u0;
        if (st === 'fins') {
          for (let k = 0; k * 0.5 + 0.45 < bw; k++) {
            placeU(u0 + 0.2 + k * 0.5, u0 + 0.4 + k * 0.5, 12.8, WH, this.getMat(k % 2 ? '#C8574B' : '#E2B24A'));
          }
        } else if (st === 'mosaic') {
          for (let r = 0; r < 2; r++) {
            for (let k = 0; k * 0.6 + 0.7 < bw; k++) {
              const h = hsh(sd + r * 11 + k);
              const col = h < 0.38 ? '#B8322F' : h < 0.62 ? '#8E8A86' : h < 0.8 ? '#E9E3D6' : '#C96A5E';
              placeU(u0 + 0.15 + k * 0.6, u0 + 0.68 + k * 0.6, 13.1 + r * 2.4, 15.2 + r * 2.4, this.getMat(col));
            }
          }
        } else if (st === 'mtr') {
          for (let k = 0; k * 0.65 + 0.5 < bw; k++) {
            const col = ['#C8574B', '#E2B24A', '#5B7FA6', '#5E9B80', '#D05A9C'][k % 5];
            placeU(u0 + 0.4 + k * 0.65, u0 + 0.56 + k * 0.65, 13.5, 17.3, this.getMat(col, { emissive: col, emissiveInt: 0.75 }));
          }
        } else if (st === 'dark') {
          const nm = this.getMat('#a974e8', { emissive: '#9452e0', emissiveInt: 0.85 });
          placeU(u0 + 0.3, u0 + bw - 0.3, 14, 14.35, nm);
          placeU(u0 + 0.3, u0 + bw - 0.3, 16.4, 16.75, nm);
        } else {
          placeU(u0 + 0.45, u0 + bw - 0.45, 13.5, 17.2, this.getMat(S.g));
        }
      }
    }
  }

  _buildInterior(grp, l, els, sofaColor) {
    const woodMat = this.getMat('#8C5E3C', { rough: 0.65 });
    const darkWood = this.getMat('#4A362C', { rough: 0.7 });
    const sofaMat = this.getMat(sofaColor, { rough: 0.78 });
    const sofaBackMat = this.getMat(sofaColor, { rough: 0.85 });
    const tableMat = this.getMat('#E0C9A0', { rough: 0.55 });
    const wsMat = this.getMat('#785A43', { rough: 0.7 });
    const wallIntMat = this.getMat('#D2C7B6', { rough: 0.85 });
    const stairMat = this.getMat('#B49E86', { rough: 0.8 });

    const addLB = (u1, v1, u2, v2, h, zBase, mat, cast = true) => {
      const [bx, by, bw, bd] = LB(l, u1, v1, u2, v2);
      grp.add(boxMesh(bx, by, bw, bd, h * Z_SCALE, zBase * Z_SCALE + 0.08, mat, cast, true));
    };

    els.forEach((e, ei) => {
      const [t, a, b, c2, d] = e;
      if (t === 'cbar' || (t === 'bar' && e[5])) {
        addLB(a, b, c2, d, 5.2, 0, woodMat);
      } else if (t === 'bar') {
        const k = 0.42;
        addLB(a, b, c2, b + k, 5.2, 0, woodMat);
        addLB(a, d - k, c2, d, 5.2, 0, woodMat);
        addLB(a, b + k, a + k, d - k, 5.2, 0, woodMat);
        addLB(c2 - k, b + k, c2, d - k, 5.2, 0, woodMat);
        const mu = (a + c2) / 2;
        const mv = (b + d) / 2;
        addLB(mu - 0.45, mv - 0.18, mu + 0.45, mv + 0.18, 7.6, 0, darkWood);
        for (let i = 0; i < 4; i++) {
          const [bx, by] = Lw(l, mu - 0.3 + i * 0.2, mv);
          const bottle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05, 0.06, 0.35, 6),
            this.getMat(pickC(i + ei), { emissive: pickC(i + ei), emissiveInt: 0.25 }),
          );
          bottle.position.set(bx, 7.6 * Z_SCALE + 0.26, by);
          grp.add(bottle);
        }
      } else if (t === 'sofa') {
        const w = c2 - a;
        const h = d - b;
        addLB(a, b, c2, d, 2.5, 0, sofaMat);
        if (w >= h) {
          if (b < l.D - d) addLB(a, b, c2, b + 0.15, 5.2, 0, sofaBackMat);
          else addLB(a, d - 0.15, c2, d, 5.2, 0, sofaBackMat);
        } else {
          if (a < l.L - c2) addLB(a, b, a + 0.15, d, 5.2, 0, sofaBackMat);
          else addLB(c2 - 0.15, b, c2, d, 5.2, 0, sofaBackMat);
        }
      } else if (t === 'rt') {
        const [tx, ty] = Lw(l, a, b);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.72, 6), darkWood);
        leg.position.set(tx, 0.44, ty);
        const top = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 12), tableMat);
        top.position.set(tx, 0.82, ty);
        top.castShadow = true;
        top.receiveShadow = true;
        grp.add(leg, top);
      } else if (t === 'tb') {
        addLB(a, b, c2, d, 3.0, 0, tableMat);
      } else if (t === 'stairs') {
        for (let k = 0; k < 4; k++) {
          addLB(a, d - ((d - b) * (k + 1)) / 4, c2, d - ((d - b) * k) / 4, 2.4 * (k + 1), 0, stairMat);
        }
      } else if (t === 'ws') {
        addLB(a, b, c2, d, 3.4, 0, wsMat);
      } else if (t === 'wall') {
        addLB(a, b, c2, d, 8.2, 0, wallIntMat);
      } else if (t === 'room') {
        const rt = 0.08;
        addLB(a, b, c2, b + rt, 7.6, 0, wallIntMat);
        addLB(a, d - rt, c2, d, 7.6, 0, wallIntMat);
        if (c2 < l.L - 0.05) addLB(c2 - rt, b, c2, d, 7.6, 0, wallIntMat);
        if (a > 0.05) addLB(a, b, a + rt, d, 7.6, 0, wallIntMat);
      }
    });

    // Stools
    seatList(l).forEach((s) => {
      if (s.k === 'stool') {
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.55, 8), darkWood);
        st.position.set(s.x, 0.36, s.y);
        grp.add(st);
      }
    });
    wsSpots(l).forEach((s) => {
      if (s.ring === 0) {
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.4, 6), darkWood);
        st.position.set(s.x, 0.28, s.y);
        grp.add(st);
      }
    });

    // Coffee & Mart interiors
    if (l.type === 'food') {
      addLB(0.5, 0.3, l.L - 0.5, 0.8, 5.2, 0, woodMat);
      addLB(0.7, 0.1, 2.2, 0.3, 8.2, 0, darkWood);
      [[1.2, 2.3], [3, 2.3], [4.8, 2.3], [1.6, 3.3], [3.6, 3.3]].forEach(([u, v]) => {
        if (u < l.L - 0.5 && v < l.D - 0.5) addLB(u - 0.3, v - 0.3, u + 0.3, v + 0.3, 3.2, 0, tableMat);
      });
    } else if (l.type === 'mart') {
      const shelfMat = this.getMat('#ECE7D8');
      addLB(0.4, 0.5, l.L - 1.7, 0.9, 5.8, 0, shelfMat);
      addLB(0.4, 1.6, l.L - 1.7, 2.0, 5.8, 0, shelfMat);
      addLB(l.L - 1.2, 0.6, l.L - 0.6, 2.0, 4.8, 0, this.getMat('#2F6FB5'));
    }

    // Player bar decorations & DJ booth
    let djCone = null;
    if (l.kind === 'mine') {
      if ((l.decor || 0) >= 2) {
        [[0.35, l.D - 0.5], [l.L - 0.35, l.D - 0.5]].forEach(([u, v]) => {
          const [px, py] = Lw(l, u, v);
          grp.add(boxMesh(px - 0.16, py - 0.16, 0.32, 0.32, 0.55, 0.08, this.getMat('#B98654')));
          const leaves = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), this.getMat('#5E9B80'));
          leaves.position.set(px, 0.88, py);
          grp.add(leaves);
        });
      }
      if (l.dj) {
        addLB(l.L - 1.35, l.D - 1.35, l.L - 0.25, l.D - 0.72, 4.6, 0, this.getMat('#221E26'));
        const [dx, dy] = Lw(l, l.L - 0.8, l.D - 1.0);
        const coneGeo = new THREE.ConeGeometry(1.3, 2.8, 12, 1, true);
        const coneMat = new THREE.MeshBasicMaterial({
          color: '#ff52d9',
          transparent: true,
          opacity: 0.2,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        djCone = new THREE.Mesh(coneGeo, coneMat);
        djCone.position.set(dx, 1.6, dy);
        grp.add(djCone);
      }
    }
    return djCone;
  }

  updateDynamic(G, dtReal) {
    const cam = this.scene3d.camera;
    const cut = this.scene3d.cutawayEnabled;
    const now = performance.now();

    // Update animated boom gates at GX
    for (let i = 0; i < this.gateArms.length; i++) {
      const arm = this.gateArms[i];
      const nearCar = G.cars.some((c) => Math.abs(c.x - GX) < 4.5 && Math.abs(c.y - arm.yMid) < 4.0);
      const target = nearCar ? 1.15 : 0;
      arm.open += (target - arm.open) * Math.min(1, dtReal * 8);
      arm.pivot.rotation.x = arm.open;
    }

    // Night intensity for streetlights & wet rain road gloss
    const h = G.t / 60;
    const nightAmt = Math.max(0, Math.min(1, (h - 17) / 2.2));
    this.lampBulbMat.emissiveIntensity = nightAmt > 0.2 ? 1.6 * nightAmt : 0.1;
    this.roadMat.roughness = G.ev && G.ev.rain ? 0.22 : 0.85;
    this.roadMat.metalness = G.ev && G.ev.rain ? 0.25 : 0.08;

    // Selection border highlight
    const sel = G.view != null ? G.lots[G.view] : null;
    if (sel) {
      this.selRing.visible = true;
      this.selRing.scale.set(sel.x1 - sel.x0 + 0.5, sel.y1 - sel.y0 + 0.5, 1);
      this.selRing.position.set((sel.x0 + sel.x1) / 2, 0.14, (sel.y0 + sel.y1) / 2);
      this.selRing.material.opacity = 0.55 + 0.3 * Math.sin(now / 250);
    } else {
      this.selRing.visible = false;
    }

    // Smart Cutaway Walls + Emissive updates per lot
    const pulse = ((now / 400) | 0) % 2;
    for (let i = 0; i < G.lots.length; i++) {
      const l = G.lots[i];
      const meta = this.lotMeta[i];
      if (!meta) continue;

      const cx = (l.x0 + l.x1) / 2;
      const cz = (l.y0 + l.y1) / 2;
      this._camDir.set(cam.position.x - cx, 0, cam.position.z - cz);

      const shouldCut = cut || G.view === i;
      for (let w = 0; w < meta.cutWalls.length; w++) {
        const cw = meta.cutWalls[w];
        if (!shouldCut) {
          cw.mesh.visible = true;
        } else {
          const dot = cw.nx * this._camDir.x + cw.nz * this._camDir.z;
          cw.mesh.visible = dot <= 0.1;
        }
      }

      if (meta.signMat && l.kind !== 'empty') {
        const isOpen = lit(l);
        const sLv = l.kind === 'mine' ? l.sign || 0 : 2;
        meta.signMat.emissiveIntensity = isOpen ? (0.55 + 0.38 * sLv) * Math.max(0.35, nightAmt) : 0.05;
      }

      if (meta.roomWindows.length && l.kind === 'mine') {
        const used = l.roomsUsed || 0;
        const open = barOpen();
        for (let r = 0; r < meta.roomWindows.length; r++) {
          const wm = meta.roomWindows[r];
          if (open && r < used) {
            wm.emissiveIntensity = (pulse ^ (r % 2) ? 1.55 : 0.95);
          } else {
            wm.emissiveIntensity = open ? 0.12 : 0;
          }
        }
      }

      if (meta.djCone) {
        const active = barOpen() && l.dj;
        meta.djCone.visible = active;
        if (active) {
          const hue = ((now / 1400 + i * 0.2) % 1);
          meta.djCone.material.color.setHSL(hue, 0.85, 0.62);
          meta.djCone.material.opacity = skillActive(l, 'showtime') ? 0.34 : 0.18;
          meta.djCone.rotation.y += dtReal * 2.4;
          meta.djCone.rotation.z = Math.sin(now / 420) * 0.22;
        }
      }
    }
  }
}
