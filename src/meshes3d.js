import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _c = new THREE.Color();

export function prepGeom(geom, hex = '#ffffff') {
  const g = geom.index ? geom.toNonIndexed() : geom.clone();
  if (!g.attributes.normal) g.computeVertexNormals();
  const count = g.attributes.position.count;
  if (!g.attributes.uv) {
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  const colors = new Float32Array(count * 3);
  _c.set(hex);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = _c.r;
    colors[i * 3 + 1] = _c.g;
    colors[i * 3 + 2] = _c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

/* ---------- 1. Chamfered Cozy Sedan (Dynamic + Static) ---------- */
export function buildSedanGeometries() {
  // Side profile along X (-0.94..+0.94, front is +X), extruded along Z (-0.36..+0.36)
  const s = new THREE.Shape();
  s.moveTo(-0.88, 0.16);
  s.lineTo(0.88, 0.16);
  s.quadraticCurveTo(0.95, 0.18, 0.94, 0.34);
  s.quadraticCurveTo(0.92, 0.45, 0.78, 0.48);
  s.lineTo(0.46, 0.51);
  s.lineTo(0.22, 0.81);
  s.quadraticCurveTo(0.14, 0.86, 0.0, 0.86);
  s.lineTo(-0.34, 0.85);
  s.quadraticCurveTo(-0.46, 0.84, -0.54, 0.76);
  s.lineTo(-0.74, 0.52);
  s.lineTo(-0.86, 0.48);
  s.quadraticCurveTo(-0.94, 0.44, -0.94, 0.28);
  s.closePath();

  const bodyRaw = new THREE.ExtrudeGeometry(s, {
    depth: 0.72,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.04,
    bevelSegments: 2,
    curveSegments: 8,
  });
  bodyRaw.translate(0, 0, -0.36);
  const bodyGeo = prepGeom(bodyRaw, '#ffffff');

  const trims = [];
  const addBox = (x, y, z, w, h, d, hex) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    trims.push(prepGeom(g, hex));
  };

  // 4 rounded wheels + hubcaps
  [[-0.54, -0.4], [-0.54, 0.4], [0.54, -0.4], [0.54, 0.4]].forEach(([wx, wz]) => {
    const tire = new THREE.CylinderGeometry(0.16, 0.16, 0.11, 12);
    tire.rotateX(Math.PI / 2);
    tire.translate(wx, 0.16, wz);
    trims.push(prepGeom(tire, '#242329'));

    const hub = new THREE.CylinderGeometry(0.085, 0.085, 0.125, 10);
    hub.rotateX(Math.PI / 2);
    hub.translate(wx, 0.16, wz);
    trims.push(prepGeom(hub, '#e8e4da'));
  });

  // Cabin glass strip (windshield + side windows + rear glass)
  addBox(-0.12, 0.66, 0, 0.74, 0.24, 0.83, '#9ec9e0');
  addBox(0.36, 0.63, 0, 0.16, 0.22, 0.74, '#b8dcf0');
  addBox(-0.56, 0.62, 0, 0.16, 0.22, 0.74, '#9ec9e0');

  // Silver bumpers
  addBox(0.95, 0.2, 0, 0.08, 0.09, 0.74, '#dedad0');
  addBox(-0.95, 0.2, 0, 0.08, 0.09, 0.74, '#dedad0');

  // Headlights (+X) & Taillights (-X)
  [[-0.25], [0.25]].forEach(([lz]) => {
    const hl = new THREE.CylinderGeometry(0.055, 0.055, 0.06, 8);
    hl.rotateZ(Math.PI / 2);
    hl.translate(0.95, 0.34, lz);
    trims.push(prepGeom(hl, '#fff8d4'));

    const tl = new THREE.CylinderGeometry(0.05, 0.05, 0.06, 8);
    tl.rotateZ(Math.PI / 2);
    tl.translate(-0.95, 0.34, lz);
    trims.push(prepGeom(tl, '#ff4842'));
  });

  const trimGeo = mergeGeometries(trims, false);
  return { bodyGeo, trimGeo };
}

export function buildStaticSedanGeom(colorHex, ax) {
  const { bodyGeo, trimGeo } = buildSedanGeometries();
  const b = prepGeom(bodyGeo, colorHex);
  const t = trimGeo.clone();
  if (ax) {
    b.rotateY(Math.PI / 2);
    t.rotateY(Math.PI / 2);
  }
  return mergeGeometries([b, t], false);
}

/* ---------- 2. Scooter + Helmeted Rider ---------- */
export function buildScooterGeometries(withRider = true) {
  const bodyParts = [];
  const detailParts = [];
  const addPart = (arr, g, x, y, z, rx = 0, ry = 0, rz = 0, hex = '#ffffff') => {
    if (rx) g.rotateX(rx);
    if (ry) g.rotateY(ry);
    if (rz) g.rotateZ(rz);
    g.translate(x, y, z);
    arr.push(prepGeom(g, hex));
  };

  // Scooter chassis (oriented along Z: +Z front, -Z rear)
  addPart(bodyParts, new THREE.BoxGeometry(0.24, 0.36, 0.12), 0, 0.36, 0.24, -0.2, 0, 0, '#ffffff');
  addPart(bodyParts, new THREE.BoxGeometry(0.24, 0.14, 0.42), 0, 0.22, -0.04, 0, 0, 0, '#ffffff');
  addPart(bodyParts, new THREE.BoxGeometry(0.26, 0.22, 0.28), 0, 0.3, -0.18, 0, 0, 0, '#ffffff');

  // Two wheels
  [-0.24, 0.25].forEach((wz) => {
    addPart(detailParts, new THREE.CylinderGeometry(0.11, 0.11, 0.08, 10), 0, 0.11, wz, 0, 0, Math.PI / 2, '#222126');
  });
  // Seat, handlebar & round headlight
  addPart(detailParts, new THREE.BoxGeometry(0.22, 0.07, 0.3), 0, 0.43, -0.14, 0, 0, 0, '#2a2422');
  addPart(detailParts, new THREE.CylinderGeometry(0.025, 0.025, 0.34, 6), 0, 0.56, 0.22, 0, 0, Math.PI / 2, '#d8d4cc');
  addPart(detailParts, new THREE.SphereGeometry(0.055, 8, 6), 0, 0.52, 0.29, 0, 0, 0, '#fff7cf');

  if (withRider) {
    // Seated rider with helmet
    addPart(detailParts, new THREE.CapsuleGeometry(0.06, 0.14, 4, 8), -0.09, 0.34, -0.02, 0.35, 0, 0, '#364354');
    addPart(detailParts, new THREE.CapsuleGeometry(0.06, 0.14, 4, 8), 0.09, 0.34, -0.02, 0.35, 0, 0, '#364354');
    addPart(detailParts, new THREE.CapsuleGeometry(0.12, 0.18, 4, 8), 0, 0.6, -0.1, 0.18, 0, 0, '#3F8F7B');
    addPart(detailParts, new THREE.SphereGeometry(0.13, 10, 8), 0, 0.87, -0.06, 0, 0, 0, '#f3efe6');
    addPart(detailParts, new THREE.BoxGeometry(0.18, 0.06, 0.08), 0, 0.86, 0.04, 0, 0, 0, '#2b2c36');
  }

  return {
    bodyGeo: mergeGeometries(bodyParts, false),
    detailGeo: mergeGeometries(detailParts, false),
  };
}

export function buildStaticBikeGeom(colorHex) {
  const { bodyGeo, detailGeo } = buildScooterGeometries(false);
  return mergeGeometries([prepGeom(bodyGeo, colorHex), detailGeo], false);
}

/* ---------- 3. Sculpted Pear Tree (Diorama) & Round Tree (Storybook) ---------- */
export function buildPearTreeGeom(mode = 'polyPear') {
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.1, 0.16, 1.35, 7);
  trunk.translate(0, 0.68, 0);
  parts.push(prepGeom(trunk, '#7D5233'));

  if (mode === 'polyPear') {
    const pts = [
      new THREE.Vector2(0.0, 1.05),
      new THREE.Vector2(0.55, 1.12),
      new THREE.Vector2(0.84, 1.55),
      new THREE.Vector2(0.76, 2.08),
      new THREE.Vector2(0.52, 2.52),
      new THREE.Vector2(0.24, 2.86),
      new THREE.Vector2(0.0, 3.0),
    ];
    const crown = new THREE.LatheGeometry(pts, 7);
    parts.push(prepGeom(crown, '#6EA838'));
    const tuft = new THREE.DodecahedronGeometry(0.46, 0);
    tuft.translate(-0.22, 2.35, 0.18);
    parts.push(prepGeom(tuft, '#87BF4C'));
  } else {
    const crown = new THREE.DodecahedronGeometry(0.82, 1);
    crown.scale(1, 0.92, 1);
    crown.translate(0, 1.95, 0);
    parts.push(prepGeom(crown, '#7FB08A'));
    const hi = new THREE.DodecahedronGeometry(0.48, 1);
    hi.translate(-0.22, 2.28, 0.14);
    parts.push(prepGeom(hi, '#96C59E'));
  }
  return mergeGeometries(parts, false);
}

/* ---------- 4. Version A: Sculpted 3D Clay Toy Human Geometries ---------- */
export function makeClayFaceTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const c = canvas.getContext('2d');
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, 128, 128);
  // Front face centered around u = 0.5 (or mapped on sphere front)
  c.fillStyle = '#2F261E';
  c.beginPath();
  c.arc(52, 62, 4.5, 0, Math.PI * 2);
  c.arc(76, 62, 4.5, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = 'rgba(235, 130, 125, 0.55)';
  c.beginPath();
  c.arc(42, 72, 6, 0, Math.PI * 2);
  c.arc(86, 72, 6, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#7A3B33';
  c.lineWidth = 3;
  c.beginPath();
  c.arc(64, 72, 8, 0.2, Math.PI - 0.2);
  c.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildClayHumanGeometries() {
  // Dress torso (A-line flared skirt + soft shoulders)
  const dressPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.21, 0.02),
    new THREE.Vector2(0.18, 0.18),
    new THREE.Vector2(0.125, 0.30),
    new THREE.Vector2(0.14, 0.42),
    new THREE.Vector2(0.09, 0.47),
    new THREE.Vector2(0.0, 0.48),
  ];
  const dressGeo = prepGeom(new THREE.LatheGeometry(dressPts, 12));

  // Coat/shirt torso (rounded shoulders & soft waist)
  const coatPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.15, 0.02),
    new THREE.Vector2(0.145, 0.24),
    new THREE.Vector2(0.155, 0.40),
    new THREE.Vector2(0.10, 0.47),
    new THREE.Vector2(0.0, 0.48),
  ];
  const coatGeo = prepGeom(new THREE.LatheGeometry(coatPts, 12));

  const headGeo = prepGeom(new THREE.SphereGeometry(0.155, 14, 10));
  headGeo.rotateY(-Math.PI / 2);

  // Rounded hair cap + back bun
  const cap = new THREE.SphereGeometry(0.165, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58);
  const bun = new THREE.SphereGeometry(0.08, 8, 6);
  bun.translate(0, 0.02, -0.15);
  const hairGeo = mergeGeometries([prepGeom(cap), prepGeom(bun)], false);

  const legGeo = prepGeom(new THREE.CapsuleGeometry(0.048, 0.16, 4, 8));
  const armGeo = prepGeom(new THREE.CapsuleGeometry(0.04, 0.17, 4, 8));

  return { dressGeo, coatGeo, headGeo, hairGeo, legGeo, armGeo };
}

/* ---------- 5. Version B: 2.5D Hand-Inked Storybook Paper-Doll Textures ---------- */
export function makePaperBodyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const c = canvas.getContext('2d');
  c.clearRect(0, 0, 256, 256);

  // Legs + cute little shoes at bottom
  c.fillStyle = '#3B342D';
  c.strokeStyle = '#2F261E';
  c.lineWidth = 6;
  [[102, 206], [154, 206]].forEach(([x, y]) => {
    c.beginPath();
    c.ellipse(x, y + 26, 15, 11, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  });

  // White coat/dress silhouette (multiplied by instanceColor)
  c.fillStyle = '#FFFFFF';
  c.beginPath();
  c.moveTo(92, 66);
  c.quadraticCurveTo(128, 52, 164, 66);
  c.quadraticCurveTo(192, 118, 198, 208);
  c.quadraticCurveTo(128, 224, 58, 208);
  c.quadraticCurveTo(64, 118, 92, 66);
  c.closePath();
  c.fill();
  c.strokeStyle = '#2F261E';
  c.lineWidth = 8;
  c.stroke();

  // Delicate pen-ink inner fold & collar lines
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(106, 64);
  c.lineTo(128, 96);
  c.lineTo(150, 64);
  c.moveTo(128, 96);
  c.lineTo(128, 206);
  c.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makePaperHeadTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const c = canvas.getContext('2d');
  c.clearRect(0, 0, 256, 256);

  // Round head with pen-ink border
  c.fillStyle = '#FFFFFF';
  c.strokeStyle = '#2F261E';
  c.lineWidth = 9;
  c.beginPath();
  c.arc(128, 134, 72, 0, Math.PI * 2);
  c.fill();
  c.stroke();

  // Eyes, blush, tiny smile
  c.fillStyle = '#2F261E';
  c.beginPath();
  c.arc(104, 138, 6.5, 0, Math.PI * 2);
  c.arc(152, 138, 6.5, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = 'rgba(230, 125, 118, 0.55)';
  c.beginPath();
  c.arc(88, 152, 10, 0, Math.PI * 2);
  c.arc(168, 152, 10, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#6E352D';
  c.lineWidth = 4.5;
  c.beginPath();
  c.arc(128, 154, 12, 0.2, Math.PI - 0.2);
  c.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makePaperHairTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const c = canvas.getContext('2d');
  c.clearRect(0, 0, 256, 256);

  c.fillStyle = '#FFFFFF';
  c.strokeStyle = '#2F261E';
  c.lineWidth = 8;
  c.beginPath();
  c.moveTo(54, 152);
  c.quadraticCurveTo(48, 56, 128, 48);
  c.quadraticCurveTo(208, 56, 202, 152);
  c.quadraticCurveTo(176, 102, 128, 96);
  c.quadraticCurveTo(80, 102, 54, 152);
  c.closePath();
  c.fill();
  c.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ---------- 6. Storybook Plinth, Grid Paper & Interior Wall Murals ---------- */
export function makeGridPaperTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const c = canvas.getContext('2d');
  c.fillStyle = '#FAF5E8';
  c.fillRect(0, 0, 256, 256);
  c.strokeStyle = '#E6DEC8';
  c.lineWidth = 2;
  for (let i = 0; i <= 256; i += 64) {
    c.beginPath();
    c.moveTo(i, 0);
    c.lineTo(i, 256);
    c.moveTo(0, i);
    c.lineTo(256, i);
    c.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(18, 12);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makePebblePlinthTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const c = canvas.getContext('2d');
  c.fillStyle = '#B89E74';
  c.fillRect(0, 0, 512, 96);
  // Top grass/concrete rim strip
  c.fillStyle = '#CFC4AD';
  c.fillRect(0, 0, 512, 18);
  c.strokeStyle = '#2F261E';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(0, 18);
  c.lineTo(512, 18);
  c.stroke();

  // Scattered pebbles
  for (let i = 0; i < 65; i++) {
    const px = ((Math.sin(i * 91.7) * 0.5 + 0.5) * 490) + 10;
    const py = 26 + ((Math.sin(i * 47.3) * 0.5 + 0.5) * 60);
    const r = 2 + (i % 4);
    c.fillStyle = i % 3 === 0 ? '#927954' : i % 3 === 1 ? '#D3BE97' : '#7C6545';
    c.beginPath();
    c.ellipse(px, py, r * 1.4, r, 0, 0, Math.PI * 2);
    c.fill();
  }

  // Drainage culvert pipe cross-section
  c.fillStyle = '#756C5E';
  c.beginPath();
  c.arc(430, 54, 14, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#2F261E';
  c.lineWidth = 2.5;
  c.stroke();
  c.fillStyle = '#332D26';
  c.beginPath();
  c.arc(430, 54, 8, 0, Math.PI * 2);
  c.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(3, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeInteriorMuralTexture(kind = 'bar') {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const c = canvas.getContext('2d');
  c.fillStyle = '#F3EEE1';
  c.fillRect(0, 0, 256, 96);

  if (kind === 'food') {
    // Cafe chalkboard & espresso cups
    c.fillStyle = '#384B47';
    c.fillRect(36, 12, 110, 44);
    c.strokeStyle = '#8C5E3C';
    c.lineWidth = 4;
    c.strokeRect(36, 12, 110, 44);
    c.fillStyle = '#E9E3D6';
    c.font = 'bold 14px sans-serif';
    c.fillText('KOPI · MENU', 48, 38);
    c.fillStyle = '#A67A53';
    c.fillRect(160, 42, 72, 8);
    for (let i = 0; i < 4; i++) {
      c.fillStyle = '#E8E0D0';
      c.fillRect(168 + i * 16, 26, 10, 14);
    }
  } else if (kind === 'mart') {
    // Stocked convenience store shelves
    [24, 52, 78].forEach((y, ri) => {
      c.fillStyle = '#B89B74';
      c.fillRect(14, y, 228, 6);
      for (let i = 0; i < 12; i++) {
        c.fillStyle = ['#C8574B', '#2F6FB5', '#E2B24A', '#5E9B80'][((i + ri) % 4)];
        c.fillRect(20 + i * 18, y - 14, 12, 14);
      }
    });
  } else {
    // Bar bottle shelves & warm framed picture
    [28, 56].forEach((y) => {
      c.fillStyle = '#8C5E3C';
      c.fillRect(22, y, 160, 6);
      for (let i = 0; i < 10; i++) {
        c.fillStyle = ['#5E9B80', '#E2B24A', '#C8574B', '#5B7FA6', '#D05A9C'][i % 5];
        c.fillRect(28 + i * 15, y - 16, 8, 16);
      }
    });
    c.fillStyle = '#E8C97E';
    c.fillRect(198, 18, 36, 30);
    c.strokeStyle = '#2F261E';
    c.lineWidth = 3;
    c.strokeRect(198, 18, 36, 30);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
