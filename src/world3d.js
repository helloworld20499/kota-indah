import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  BARPAL, CONCEPTS, DECOR, GX, LAY, POLES, ROOMS, STY, SX, XA, XB, YA, YB, Z_SCALE, WH, SWH,
  LB, Lw, hsh, pickC,
} from './config.js';
import { STORYBOOK_THEME } from './themes.js';
import {
  buildStorybookTreeGeom, buildStaticBikeGeom, buildStaticSedanGeom,
  makeGridPaperTexture, makeInteriorMuralTexture, makePebblePlinthTexture,
} from './meshes3d.js';
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
  c.font = 'bold 46px "Plus Jakarta Sans", "Noto Sans SC", "PingFang SC", sans-serif';
  c.fillText(text, 256, subText ? 48 : 64, 470);
  if (subText) {
    c.font = 'bold 28px "Plus Jakarta Sans", "Noto Sans SC", "PingFang SC", sans-serif';
    c.globalAlpha = 0.85;
    c.fillText(subText, 256, 94, 470);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeRoadLabelTexture(text, bg = 'rgba(0,0,0,0)', fg = 'rgba(47, 38, 30, 0.68)') {
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
  c.font = '700 34px "Plus Jakarta Sans", "Noto Sans SC", "PingFang SC", sans-serif';
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
    this.inkLineMat = new THREE.LineBasicMaterial({ color: '#2F261E', transparent: true, opacity: 0.65 });
    this.gridPaperTex = makeGridPaperTexture();
    this.pebbleTex = makePebblePlinthTexture();
    this.muralTex = {
      bar: makeInteriorMuralTexture('bar'),
      food: makeInteriorMuralTexture('food'),
      mart: makeInteriorMuralTexture('mart'),
    };

    this.selRing = this._createSelectionRing();
    this.root.add(this.selRing);
    this.raidGroup = this._createRaidBeacons();
    this.root.add(this.raidGroup);
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

  _createRaidBeacons() {
    const grp = new THREE.Group();
    grp.position.set(GX + 1.6, 1.05, 27);
    grp.visible = false;
    const coneGeo = new THREE.ConeGeometry(1.1, 3.6, 10, 1, true);
    coneGeo.translate(0, -1.8, 0);
    coneGeo.rotateX(Math.PI / 2);
    ['#ff2e3b', '#2f6bff'].forEach((hex, idx) => {
      const m = new THREE.Mesh(
        coneGeo,
        new THREE.MeshBasicMaterial({
          color: hex,
          transparent: true,
          opacity: 0.34,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      m.rotation.y = idx * Math.PI;
      grp.add(m);
    });
    return grp;
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
    const theme = STORYBOOK_THEME;
    this.roadMat.color.set(theme.road);
    const W = XB - XA;
    const D = YB - YA;
    const cx = (XA + XB) / 2;
    const cz = (YA + YB) / 2;

    // Storybook layered plinth with pebbled earth & grid paper backdrop
    const groundMat = this.getMat(theme.slabTop, { rough: 0.9 });
    const ground = new THREE.Mesh(new THREE.BoxGeometry(W, 0.45, D), groundMat);
    ground.position.set(cx, -0.225, cz);
    ground.castShadow = true;
    ground.receiveShadow = true;
    g.add(ground);

    const rimMat = this.getMat(theme.slabEdge, { rough: 0.92 });
    const rim = new THREE.Mesh(new THREE.BoxGeometry(W + 0.08, 0.25, D + 0.08), rimMat);
    rim.position.set(cx, -0.45, cz);
    g.add(rim);

    const earthMat = new THREE.MeshStandardMaterial({ map: this.pebbleTex, roughness: 0.92 });
    const earth = new THREE.Mesh(new THREE.BoxGeometry(W - 0.2, 1.28, D - 0.2), earthMat);
    earth.position.set(cx, -1.16, cz);
    earth.castShadow = true;
    g.add(earth);

    const paper = new THREE.Mesh(
      new THREE.PlaneGeometry(240, 240),
      new THREE.MeshStandardMaterial({ map: this.gridPaperTex, roughness: 0.96 }),
    );
    paper.rotation.x = -Math.PI / 2;
    paper.position.set(cx, -1.85, cz);
    paper.receiveShadow = true;
    g.add(paper);
    earth.add(new THREE.LineSegments(new THREE.EdgesGeometry(earth.geometry, 25), this.inkLineMat));
    ground.add(new THREE.LineSegments(new THREE.EdgesGeometry(ground.geometry, 25), this.inkLineMat));

    // Sidewalks & lots pads
    const swGeoms = [];
    const addPad = (x1, x2, y1, y2, yTop, thick, hex) => {
      swGeoms.push(makeBoxGeom((x1 + x2) / 2, yTop - thick / 2, (y1 + y2) / 2, x2 - x1, thick, y2 - y1, hex));
    };

    // Block pads
    [[0, GX, 0, 7], [0, SX, 11, 25], [0, GX, 29, 36], [-20.5, -13, 5, 31]].forEach(([a, b, c, d]) =>
      addPad(a, b, c, d, 0.03, 0.04, theme.blockPad),
    );
    // Sidewalks along streets
    [
      [-13, GX, 7, 11], [-13, GX, 25, 29], [-4, 0, 7, 29],
      [-13, -9, 7, 29], [SX, GX, 7, 29], [GX, XB, YA, YB],
    ].forEach(([a, b, c, d]) => addPad(a, b, c, d, 0.04, 0.06, theme.sidewalk));

    // Parking lot concrete
    addPad(-9, -4, 11, 25, 0.03, 0.05, theme.parking);

    // White parking stalls & crosswalk zebra stripes
    const paintHex = '#f1eadb';
    for (let k = 0; k <= 11; k++) {
      const y = 11 + k * 1.25 + 0.35;
      [[-8.9, -6.8], [-6.2, -4.1]].forEach(([a, b]) => {
        swGeoms.push(makeBoxGeom((a + b) / 2, 0.055, y, b - a, 0.02, 0.08, paintHex));
      });
    }
    const addCrosswalk = (x, z, alongX) => {
      for (let s = -2; s <= 2; s++) {
        swGeoms.push(
          makeBoxGeom(
            alongX ? x : x + s * 0.38,
            0.058,
            alongX ? z + s * 0.38 : z,
            alongX ? 1.15 : 0.2,
            0.015,
            alongX ? 0.2 : 1.15,
            paintHex,
          ),
        );
      }
    };
    addCrosswalk(46.2, 9, true);
    addCrosswalk(46.2, 27, true);
    addCrosswalk(1.2, 9, true);
    addCrosswalk(1.2, 27, true);
    addCrosswalk(49.5, 11.4, false);
    addCrosswalk(49.5, 24.6, false);

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

    // Static street props (sculpted parked cars, scooters, cones, rounded trees, food cart, fruit stall)
    const addCarGeom = (x, y, ax, c) => {
      const cg = buildStaticSedanGeom(c, ax);
      cg.translate(x, 0.04, y);
      geoms.push(cg);
    };
    const treeProto = buildStorybookTreeGeom();

    DECOR.forEach((d) => {
      if (d.t === 'car') addCarGeom(d.x, d.y, d.ax, d.c);
      else if (d.t === 'bike') {
        const bg = buildStaticBikeGeom(d.c);
        bg.translate(d.x, 0.04, d.y);
        geoms.push(bg);
      } else if (d.t === 'cone') {
        pushBox(d.x, 0.18, d.y, 0.26, 0.36, 0.26, '#e87236');
      } else if (d.t === 'tree') {
        const tg = treeProto.clone();
        tg.translate(d.x, 0.04, d.y);
        geoms.push(tg);
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

    // Parking lot static cars & scooters
    (G.park || []).forEach((d) => {
      if (d.t === 'car') addCarGeom(d.x, d.y, false, d.c);
      else {
        const bg = buildStaticBikeGeom(d.c);
        bg.rotateY(Math.PI / 2);
        bg.translate(d.x, 0.04, d.y);
        geoms.push(bg);
      }
    });

    if (geoms.length) {
      const merged = mergeGeometries(geoms, false);
      const staticMesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 }));
      staticMesh.castShadow = true;
      staticMesh.receiveShadow = true;
      staticMesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(staticMesh.geometry, 32), this.inkLineMat));
      g.add(staticMesh);
    }
  }

  _wallColor(l) {
    if (l.kind === 'mine') return [STORYBOOK_THEME.wallColor, '#EAD9BC', '#E0C4A6', '#D4B6AC'][l.decor || 0];
    if (l.kind === 'rival') return '#E5D3CB';
    if (l.kind === 'empty') return '#E5DEC9';
    return '#F2EBDC';
  }

  _floorColor(l) {
    if (l.kind === 'mine') return STORYBOOK_THEME.floorMine[l.decor || 0];
    if (l.kind === 'empty') return STORYBOOK_THEME.floorEmpty;
    if (l.kind === 'rival') return STORYBOOK_THEME.floorRival;
    return l.fl || STORYBOOK_THEME.floorEmpty;
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

    // Base floor slab (unique material per lot so open bars glow warmly at night)
    const fCol = this._floorColor(l);
    const floorMat = isMine && l.decor > 0
      ? new THREE.MeshStandardMaterial({ map: makePlankTexture(fCol), roughness: 0.72, emissive: '#ffcf86', emissiveIntensity: 0 })
      : new THREE.MeshStandardMaterial({ color: fCol, roughness: 0.86, emissive: '#ffcf86', emissiveIntensity: 0 });
    const floor = boxMesh(x0, y0, spanX, spanZ, 0.08, 0.02, floorMat, false, true);
    grp.add(floor);

    // Work / room floor zone highlights
    const els = curEls(l);
    els.forEach((e) => {
      if (e[0] !== 'work' && e[0] !== 'room' && e[0] !== 'ws') return;
      const pad = e[0] === 'ws' ? 0.45 : 0;
      const [bx, by, bw, bd] = LB(l, Math.max(0.05, e[1] - pad), Math.max(0.05, e[2] - pad), Math.min(L - 0.05, e[3] + pad), Math.min(D - 0.05, e[4] + pad));
      const zoneMat = this.getMat(e[0] === 'room' ? '#6b606e' : '#968774', { rough: 0.9, opacity: 0.34 });
      const zm = boxMesh(bx, by, bw, bd, 0.02, 0.1, zoneMat, false, true);
      grp.add(zm);
    });

    // Low-profile zero-occlusion dollhouse wall heights
    const wallHex = this._wallColor(l);
    const wallMat = this.getMat(wallHex, { rough: 0.84 });
    const S = STY[l.style] || STY.oldgrey;
    const upMat = this.getMat(S.up, { rough: 0.76 });
    const lowH = 0.42;
    const curbH = 0.26;
    const sideH = 1.08;
    const backH = l.top ? 1.18 : 1.85;
    const th = 0.15;

    const addCutWall = (x, z, w, d, hWall, nx, nz) => {
      grp.add(boxMesh(x, z, w, d, lowH, 0.08, wallMat, true, true));
      if (hWall > lowH) {
        const ug = new THREE.Group();
        ug.add(boxMesh(x, z, w, d, hWall - lowH, lowH + 0.08, isEmpty ? wallMat : upMat, true, true));
        grp.add(ug);
        cutWalls.push({ mesh: ug, nx, nz });
      }
    };

    const isAlongY = l.f[0] === 'y';
    const tallOnY0 = isAlongY;
    const facadeGroup = new THREE.Group();
    const roomWindows = [];
    let signMat = null;

    if (tallOnY0) {
      if (l.f === 'yMin') {
        this._buildSegmentedLowerOnly(grp, x0, y0, spanX, true, l.doorUs, curbH, wallMat);
      } else {
        grp.add(boxMesh(x0, y0, spanX, th, lowH, 0.08, wallMat, true, true));
        facadeGroup.add(boxMesh(x0, y0, spanX, th, backH - lowH, lowH + 0.08, wallMat, true, true));
      }
      cutWalls.push({ mesh: facadeGroup, nx: 0, nz: -1 });
      if (l.xd && l.xd.length) {
        const xdOffsets = l.xd.map((wy) => y1 - wy);
        this._buildSegmentedWall(grp, cutWalls, x0, y0, spanZ, false, xdOffsets, curbH, sideH, wallMat, -1, 0);
      } else {
        addCutWall(x0, y0, th, spanZ, sideH, -1, 0);
      }
      addCutWall(x1 - th, y0, th, spanZ, sideH, 1, 0);
      if (l.f === 'yMax') {
        this._buildSegmentedLowerOnly(grp, x0, y1 - th, spanX, true, l.doorUs, curbH, wallMat);
      } else {
        addCutWall(x0, y1 - th, spanX, th, sideH, 0, 1);
      }
    } else {
      if (l.f === 'xMin') {
        this._buildSegmentedLowerOnly(grp, x0, y0, spanZ, false, l.doorUs, curbH, wallMat);
      } else {
        grp.add(boxMesh(x0, y0, th, spanZ, lowH, 0.08, wallMat, true, true));
        facadeGroup.add(boxMesh(x0, y0, th, spanZ, backH - lowH, lowH + 0.08, wallMat, true, true));
      }
      cutWalls.push({ mesh: facadeGroup, nx: -1, nz: 0 });
      addCutWall(x0, y0, spanX, th, sideH, 0, -1);
      addCutWall(x0, y1 - th, spanX, th, sideH, 0, 1);
      if (l.f === 'xMax') {
        this._buildSegmentedLowerOnly(grp, x1 - th, y0, spanZ, false, l.doorUs, curbH, wallMat);
      } else {
        addCutWall(x1 - th, y0, th, spanZ, sideH, 1, 0);
      }
    }
    grp.add(facadeGroup);

    // Architectural trim & attic windows on low-profile back facade
    this._decorateFacade(facadeGroup, l, tallOnY0, roomWindows, S, backH);

    // Floating Neon / Marquee Signboard (never blocks street behind it)
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
      emissiveIntensity: isOpenNow ? 0.55 + 0.35 * signLevel : 0.08,
      roughness: 0.4,
    });
    const signLen = Math.max(2.6, L - 0.6);
    const signGeo = new THREE.BoxGeometry(tallOnY0 ? signLen : 0.22, 0.54, tallOnY0 ? 0.22 : signLen);
    const signMesh = new THREE.Mesh(signGeo, signMat);
    const su = l.signU != null ? l.signU : L / 2;
    if (tallOnY0) signMesh.position.set(x0 + su, backH + 0.36, y0 + 0.14);
    else signMesh.position.set(x0 + 0.14, backH + 0.36, y1 - su);
    grp.add(signMesh);

    // Striped awning over street-side door
    if (!isEmpty && (l.f === 'yMax' || l.f === 'xMax')) {
      for (let u = 0; u < L - 0.01; u++) {
        const seg = Math.min(1, L - u);
        const col = u % 2 ? l.ac : '#F7F2E6';
        const awMat = this.getMat(col, { rough: 0.68 });
        let aw;
        if (l.f === 'yMax') {
          aw = new THREE.Mesh(new THREE.BoxGeometry(seg, 0.07, 0.68), awMat);
          aw.position.set(x0 + u + seg / 2, 1.48, y1 + 0.26);
          aw.rotation.x = 0.38;
        } else {
          aw = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.07, seg), awMat);
          aw.position.set(x1 + 0.26, 1.48, y1 - u - seg / 2);
          aw.rotation.z = -0.38;
        }
        aw.castShadow = true;
        grp.add(aw);
      }
    }

    // Empty lot standing sign
    if (isEmpty) {
      const [bx, by] = Lw(l, L / 2, D / 2);
      const post = boxMesh(bx - 0.06, by - 0.06, 0.12, 0.12, 1.1, 0.1, this.getMat('#6a5848'));
      const boardTex = makeSignTexture('DISEWAKAN', '#F7F2E6', '#B5362F', '#B5362F', '点击租铺开店');
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(isAlongY ? 1.6 : 0.12, 0.8, isAlongY ? 0.12 : 1.6),
        new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.6 }),
      );
      board.position.set(bx, 1.05, by);
      board.castShadow = true;
      grp.add(post, board);
      this._applyInkEdges(grp);
      this.lotMeta[l.i] = { cutWalls, roomWindows, signMat, floorMat, djCone: null, clubLasers: [] };
      return;
    }

    // Interior Furniture
    const sofaColor = isMine
      ? l.concept === 'ktv' ? '#7D4E9E' : l.concept === 'club' ? '#2B7A8A' : l.ac
      : BARPAL[l.lay]?.sofa || '#A8403A';
    const interiorFX = this._buildInterior(grp, l, els, sofaColor);

    // Storybook hand-drawn back-wall mural (bottle racks / cafe chalkboard / mart shelves)
    if (!l.top) {
      const mKind = l.type === 'food' ? 'food' : l.type === 'mart' ? 'mart' : 'bar';
      const mw = Math.min(4.0, Math.max(1.8, L - 1.1));
      const mural = new THREE.Mesh(
        new THREE.PlaneGeometry(mw, 1.05),
        new THREE.MeshStandardMaterial({ map: this.muralTex[mKind], roughness: 0.9 }),
      );
      if (tallOnY0) {
        mural.position.set(x0 + L / 2, 0.95, y0 + 0.18);
      } else {
        mural.rotation.y = Math.PI / 2;
        mural.position.set(x0 + 0.18, 0.95, y1 - L / 2);
      }
      facadeGroup.add(mural);
    }

    this._applyInkEdges(grp);

    this.lotMeta[l.i] = {
      cutWalls,
      roomWindows,
      signMat,
      floorMat,
      djCone: interiorFX.djCone,
      clubLasers: interiorFX.clubLasers,
    };
  }

  _applyInkEdges(grp) {
    const targets = [];
    grp.traverse((obj) => {
      if (!obj.isMesh || !obj.geometry) return;
      if (obj.material && obj.material.blending === THREE.AdditiveBlending) return;
      if (obj.geometry.type === 'PlaneGeometry') return;
      if (obj.position.y < 0.12 && obj.scale.y <= 1) return;
      targets.push(obj);
    });
    for (let i = 0; i < targets.length; i++) {
      const m = targets[i];
      const edges = new THREE.EdgesGeometry(m.geometry, 26);
      m.add(new THREE.LineSegments(edges, this.inkLineMat));
    }
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

  _decorateFacade(fg, l, tallOnY0, roomWindows, S, backH = 1.85) {
    const { x0, y0, y1, L } = l;
    const placeNorm = (u1, u2, yLow, yHigh, mat) => {
      const len = Math.max(0.05, u2 - u1);
      const h = Math.max(0.05, yHigh - yLow);
      if (tallOnY0) {
        fg.add(boxMesh(x0 + u1, y0 + 0.02, len, 0.2, h, yLow, mat));
      } else {
        fg.add(boxMesh(x0 + 0.02, y1 - u2, 0.2, len, h, yLow, mat));
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
        placeNorm(0.25 + i * w + 0.08, 0.25 + (i + 1) * w - 0.08, backH - 0.38, backH - 0.04, wm);
      }
      if ((l.decor || 0) >= 2) {
        const bulbM = this.getMat('#ffe27a', { emissive: '#ffbe44', emissiveInt: 1.1 });
        for (let u = 0.4; u < L - 0.3; u += 0.55) {
          placeNorm(u, u + 0.14, 1.32 - Math.abs(Math.sin(u * 2.5)) * 0.14, 1.39 - Math.abs(Math.sin(u * 2.5)) * 0.14, bulbM);
        }
      }
    } else if (!l.top) {
      const st = l.style;
      for (let u0 = 0; u0 < L - 0.5; u0 += 5) {
        const bw = Math.min(5, L - u0);
        const sd = l.i * 7 + u0;
        if (st === 'fins') {
          for (let k = 0; k * 0.5 + 0.45 < bw; k++) {
            placeNorm(u0 + 0.2 + k * 0.5, u0 + 0.4 + k * 0.5, 1.15, backH, this.getMat(k % 2 ? '#C8574B' : '#E2B24A'));
          }
        } else if (st === 'mosaic') {
          for (let r = 0; r < 2; r++) {
            for (let k = 0; k * 0.6 + 0.7 < bw; k++) {
              const h = hsh(sd + r * 11 + k);
              const col = h < 0.38 ? '#B8322F' : h < 0.62 ? '#8E8A86' : h < 0.8 ? '#E9E3D6' : '#C96A5E';
              placeNorm(u0 + 0.15 + k * 0.6, u0 + 0.68 + k * 0.6, 1.18 + r * 0.32, 1.44 + r * 0.32, this.getMat(col));
            }
          }
        } else if (st === 'mtr') {
          for (let k = 0; k * 0.65 + 0.5 < bw; k++) {
            const col = ['#C8574B', '#E2B24A', '#5B7FA6', '#5E9B80', '#D05A9C'][k % 5];
            placeNorm(u0 + 0.4 + k * 0.65, u0 + 0.56 + k * 0.65, 1.15, backH - 0.05, this.getMat(col, { emissive: col, emissiveInt: 0.75 }));
          }
        } else if (st === 'dark') {
          const nm = this.getMat('#a974e8', { emissive: '#9452e0', emissiveInt: 0.85 });
          placeNorm(u0 + 0.3, u0 + bw - 0.3, 1.32, 1.4, nm);
          placeNorm(u0 + 0.3, u0 + bw - 0.3, 1.62, 1.7, nm);
        } else {
          placeNorm(u0 + 0.45, u0 + bw - 0.45, 1.25, backH - 0.08, this.getMat(S.g));
        }
      }
    }

    // Authentic Jakarta rooftop micro-details: Toren Air water tank & AC outdoor units
    if (!l.top && l.kind !== 'empty') {
      const yRoof = backH + 0.08;
      const tankCol = l.i % 3 === 0 ? '#d86d28' : '#2466ad';
      const tank = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.44, 8),
        this.getMat(tankCol, { rough: 0.45 }),
      );
      if (tallOnY0) tank.position.set(x0 + L * 0.82, yRoof + 0.22, y0 + 0.18);
      else tank.position.set(x0 + 0.18, yRoof + 0.22, y1 - L * 0.82);
      fg.add(tank);

      const acMat = this.getMat('#c4c1b8', { rough: 0.7 });
      [0.24, 0.56].forEach((frac) => {
        if (tallOnY0) fg.add(boxMesh(x0 + L * frac, y0 + 0.12, 0.34, 0.2, 0.24, 1.28, acMat));
        else fg.add(boxMesh(x0 + 0.12, y1 - L * frac, 0.2, 0.34, 0.24, 1.28, acMat));
      });
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

    // Player bar decorations, concept theme props & DJ booth
    let djCone = null;
    const clubLasers = [];
    if (l.kind === 'mine') {
      const concept = l.concept || 'bintang';
      if (concept === 'bintang') {
        // Golden beer kegs near the bar counter
        const kegMat = this.getMat('#d4a13e', { rough: 0.35, metal: 0.55 });
        [[l.L * 0.25, 1.3], [l.L * 0.25 + 0.35, 1.3]].forEach(([u, v]) => {
          const [kx, ky] = Lw(l, u, v);
          const keg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.42, 8), kegMat);
          keg.position.set(kx, 0.31, ky);
          grp.add(keg);
        });
      } else if (concept === 'ktv') {
        // Velvet gold-purple VIP entrance columns by the stairs
        const colMat = this.getMat('#d9a94b', { rough: 0.3, metal: 0.6, emissive: '#9d5cd6', emissiveInt: 0.25 });
        [[0.2, 2.0], [1.0, 2.0]].forEach(([u, v]) => {
          const [kx, ky] = Lw(l, u, v);
          const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.6, 8), colMat);
          pillar.position.set(kx, 0.88, ky);
          grp.add(pillar);
        });
      } else if (concept === 'club') {
        // Cyan/magenta criss-crossing laser beams
        const [cx2, cy2] = Lw(l, l.L / 2, l.D / 2);
        ['#3dd6ff', '#ff49c9'].forEach((col, li) => {
          const lGeo = new THREE.ConeGeometry(0.45, 2.6, 8, 1, true);
          const lMat = new THREE.MeshBasicMaterial({
            color: col,
            transparent: true,
            opacity: 0.22,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
          });
          const laser = new THREE.Mesh(lGeo, lMat);
          laser.position.set(cx2 + (li ? 0.6 : -0.6), 2.1, cy2);
          grp.add(laser);
          clubLasers.push(laser);
        });
      }

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
    return { djCone, clubLasers };
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

    // Night intensity for streetlights, interior lantern boost & wet rain road gloss
    const h = this.scene3d.lightMode === 'day' ? 14.5 : G.t / 60;
    const nightAmt = Math.max(0, Math.min(1, (h - 17) / 2.2));
    this.lampBulbMat.emissiveIntensity = nightAmt > 0.2 ? 1.8 * nightAmt : 0.12;
    this.roadMat.roughness = G.ev && G.ev.rain ? 0.22 : 0.85;
    this.roadMat.metalness = G.ev && G.ev.rain ? 0.25 : 0.08;

    // Selection border highlight & police raid rotating beacon cones
    const raidActive = !!(G.raidUntil && G.t < G.raidUntil);
    this.raidGroup.visible = raidActive;
    if (raidActive) {
      this.raidGroup.rotation.y += dtReal * 7.5;
    }

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

      const isOpen = lit(l);
      if (meta.floorMat && l.kind !== 'empty') {
        meta.floorMat.emissiveIntensity = isOpen ? 0.32 * Math.max(0.28, nightAmt) : 0;
      }

      if (meta.signMat && l.kind !== 'empty') {
        const sLv = l.kind === 'mine' ? l.sign || 0 : 2;
        meta.signMat.emissiveIntensity = isOpen ? (0.6 + 0.35 * sLv) * Math.max(0.35, nightAmt) : 0.06;
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

      if (meta.clubLasers && meta.clubLasers.length) {
        const active = barOpen() && !skillActive(l, 'lowProfile');
        for (let li = 0; li < meta.clubLasers.length; li++) {
          const lz = meta.clubLasers[li];
          lz.visible = active;
          if (active) {
            lz.rotation.z = Math.sin(now / 520 + li * 1.9) * 0.55;
            lz.rotation.x = Math.cos(now / 610 + li) * 0.4;
            lz.material.opacity = skillActive(l, 'showtime') ? 0.32 : 0.18;
          }
        }
      }
    }
  }
}
