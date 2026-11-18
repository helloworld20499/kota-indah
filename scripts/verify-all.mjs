import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const ROOT = path.resolve(import.meta.dirname, '..');

/* ---------- 1. Verify Imports, CSS, Music, SFX ---------- */
const IMPORT_RE = /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const htmlPath = path.join(ROOT, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const mapMatch = html.match(/<script\s+type="importmap"[^>]*>([\s\S]*?)<\/script>/i);
assert(mapMatch, 'Missing importmap in index.html');
const importMap = JSON.parse(mapMatch[1]).imports || {};

function walkJs(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJs(full, out);
    else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) out.push(full);
  }
  return out;
}

function resolveImportMap(spec) {
  if (importMap[spec]) return path.resolve(ROOT, importMap[spec]);
  for (const [k, v] of Object.entries(importMap)) {
    if (k.endsWith('/') && spec.startsWith(k)) return path.resolve(ROOT, v + spec.slice(k.length));
  }
  return null;
}

const filesToScan = [...walkJs(path.join(ROOT, 'src')), ...walkJs(path.join(ROOT, 'vendor', 'three'))];
for (const file of filesToScan) {
  const code = fs.readFileSync(file, 'utf8');
  IMPORT_RE.lastIndex = 0;
  let m;
  while ((m = IMPORT_RE.exec(code)) !== null) {
    const spec = m[1] || m[2];
    if (!spec) continue;
    const resolved = spec.startsWith('./') || spec.startsWith('../')
      ? path.resolve(path.dirname(file), spec)
      : resolveImportMap(spec);
    assert(resolved && fs.existsSync(resolved), `Broken import "${spec}" in ${path.relative(ROOT, file)}`);
  }
}

['styles/main.css', 'music/main.mp3', 'music/weekend.mp3', 'music/rain.mp3', 'music/closing.mp3'].forEach((rel) => {
  assert(fs.existsSync(path.join(ROOT, rel)), `Missing asset: ${rel}`);
});
const sfxDir = path.join(ROOT, 'sfx');
assert(fs.readdirSync(sfxDir).filter((f) => f.endsWith('.wav')).length >= 15, 'Missing sfx files');
console.log(`[1/4] Static imports & assets OK (${filesToScan.length} JS files)`);

/* ---------- 2. Install Lightweight Node DOM / Canvas Mock ---------- */
const noop = () => {};
const mockCtx2D = () => ({
  clearRect: noop, fillRect: noop, strokeRect: noop, fillText: noop,
  beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
  arc: noop, arcTo: noop, ellipse: noop, quadraticCurveTo: noop, bezierCurveTo: noop, roundRect: noop,
  stroke: noop, fill: noop, clip: noop, save: noop, restore: noop,
  translate: noop, scale: noop, rotate: noop, setLineDash: noop,
  createRadialGradient: () => ({ addColorStop: noop }),
  createLinearGradient: () => ({ addColorStop: noop }),
  fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: 'center', textBaseline: 'middle', globalAlpha: 1,
});

function makeMockElement(id = '', tag = 'div') {
  const classes = new Set();
  const children = [];
  return {
    id,
    tagName: tag.toUpperCase(),
    style: {},
    dataset: {},
    className: '',
    textContent: '',
    innerHTML: '',
    value: '',
    width: 256,
    height: 128,
    clientWidth: 1024,
    clientHeight: 720,
    children,
    classList: {
      add: (...c) => c.forEach((x) => classes.add(x)),
      remove: (...c) => c.forEach((x) => classes.delete(x)),
      toggle: (c, force) => {
        if (force === undefined) classes.has(c) ? classes.delete(c) : classes.add(c);
        else if (force) classes.add(c);
        else classes.delete(c);
      },
      contains: (c) => classes.has(c),
    },
    appendChild(child) { children.push(child); return child; },
    getContext() { return mockCtx2D(); },
    addEventListener: noop,
    querySelector: () => makeMockElement(),
    querySelectorAll: () => [],
    closest: () => null,
  };
}

const domIds = ['panel', 'panelWrap', 'sheet', 'modal', 'toast', 'hDay', 'hEv', 'hMoney', 'hMoneyChip', 'tdot', 'speed', 'zall', 'ttl', 'subttl', 'hClock', 'auM', 'auS', 'btnSkipOpen', 'world-hud', 'barPills', 'skillDock', 'liveEventCard', 'btnQual', 'btnAch', 'achCnt', 'mobTabs', 'sheetGrabber', 'btnLight'];
const elements = new Map(domIds.map((id) => [id, makeMockElement(id)]));

const storeMap = new Map();
globalThis.window = {
  location: { href: 'http://localhost:8173/', search: '' },
  localStorage: {
    getItem: (k) => storeMap.get(k) ?? null,
    setItem: (k, v) => storeMap.set(k, String(v)),
    removeItem: (k) => storeMap.delete(k),
  },
};

globalThis.document = {
  hidden: false,
  documentElement: makeMockElement('html', 'html'),
  getElementById: (id) => {
    if (!elements.has(id)) elements.set(id, makeMockElement(id));
    return elements.get(id);
  },
  createElement: (tag) => makeMockElement('', tag),
  querySelectorAll: () => [],
  addEventListener: noop,
};

/* ---------- 3. Verify World3D, Themes, Ortho Picking & Actors3D ---------- */
const { STORYBOOK_THEME, LIGHT_MODES } = await import('../src/themes.js');
const { World3D } = await import('../src/world3d.js');
const { Actors3D } = await import('../src/actors3d.js');
const state = await import('../src/state.js');
const { initSim, simHeadlessDays } = await import('../src/sim.js');
const ui = await import('../src/ui.js');

assert.equal(STORYBOOK_THEME.id, 'storybook');
assert.equal(Object.keys(LIGHT_MODES).length, 3);

initSim();
const G = state.G;
for (const l of G.lots) {
  if (l.kind === 'rival') {
    assert(l.hn >= 3 && l.hn <= 5, `Expected rival ${l.name} initial hn in 3..5, got ${l.hn}`);
    assert.equal(l.hs.length, l.hn, `Expected rival ${l.name} hs.length === hn`);
  }
}

// Verify legacy save migration clamps inflated rival hn down to Day-appropriate 3..5
const firstRival = G.lots.find((l) => l.kind === 'rival');
assert(firstRival, 'Missing rival lot');
G.rival[firstRival.i].hn = 28;
state.save();
assert(state.load(() => {}));
assert(state.G.lots[firstRival.i].hn >= 3 && state.G.lots[firstRival.i].hn <= 5, 'Legacy save rival hn not clamped to 3..5');
storeMap.clear();
initSim();
const G0 = state.G;

const fakeScene3D = {
  scene: new THREE.Scene(),
  camera: new THREE.OrthographicCamera(-35, 35, 27, -27, -120, 320),
  controls: { target: new THREE.Vector3(17.5, 0.4, 18) },
  cutawayEnabled: true,
  lightMode: 'bright',
  getZoom() { return this.camera.zoom || 1; },
};
fakeScene3D.camera.zoom = 1.0;
fakeScene3D.camera.position.set(74, 52, 74);
fakeScene3D.camera.lookAt(fakeScene3D.controls.target);
fakeScene3D.camera.updateProjectionMatrix();
fakeScene3D.camera.updateMatrixWorld(true);

const world3d = new World3D(fakeScene3D);
world3d.buildAll(G0);

let inkLines = 0;
world3d.root.traverse((o) => { if (o.isLineSegments) inkLines++; });
assert(inkLines > 10, `Expected pen-ink LineSegments in storybook scene, found ${inkLines}`);

// Check every lot's floor mesh bounding box matches [x0..x1, y0..y1] within 0.05
const bbox = new THREE.Box3();
for (let i = 0; i < G0.lots.length; i++) {
  const l = G0.lots[i];
  const floorMesh = world3d.lotGroups[i].children[0];
  assert(floorMesh, `Missing floor mesh on lot ${i}`);
  bbox.setFromObject(floorMesh);
  assert(Math.abs(bbox.min.x - l.x0) < 0.05, `Lot ${i} min.x mismatch: ${bbox.min.x} vs ${l.x0}`);
  assert(Math.abs(bbox.max.x - l.x1) < 0.05, `Lot ${i} max.x mismatch: ${bbox.max.x} vs ${l.x1}`);
  assert(Math.abs(bbox.min.z - l.y0) < 0.05, `Lot ${i} min.z mismatch: ${bbox.min.z} vs ${l.y0}`);
  assert(Math.abs(bbox.max.z - l.y1) < 0.05, `Lot ${i} max.z mismatch: ${bbox.max.z} vs ${l.y1}`);
}

// Verify 360° Orthographic Zero-Occlusion Lot Picking from all 4 isometric quadrants
const pickRay = new THREE.Raycaster();
const pickPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.5);
const pickHit = new THREE.Vector3();
const pickNdc = new THREE.Vector3();
for (const [ox, oy, oz] of [[58, 52, 58], [-58, 52, 58], [-58, 52, -58], [58, 52, -58]]) {
  fakeScene3D.camera.position.set(17.5 + ox, oy, 18 + oz);
  fakeScene3D.camera.lookAt(fakeScene3D.controls.target);
  fakeScene3D.camera.updateMatrixWorld(true);
  for (let i = 0; i < G0.lots.length; i++) {
    const l = G0.lots[i];
    const lcx = (l.x0 + l.x1) / 2;
    const lcz = (l.y0 + l.y1) / 2;
    pickNdc.set(lcx, 0.5, lcz).project(fakeScene3D.camera);
    pickRay.setFromCamera(new THREE.Vector2(pickNdc.x, pickNdc.y), fakeScene3D.camera);
    const ok = pickRay.ray.intersectPlane(pickPlane, pickHit);
    assert(ok, `Ortho raycast missed lot ${i} from (${ox},${oy},${oz})`);
    assert(Math.hypot(pickHit.x - lcx, pickHit.z - lcz) < 0.05, `Ortho pick drift on lot ${i}`);
  }
}
fakeScene3D.camera.position.set(74, 52, 74);
fakeScene3D.camera.lookAt(fakeScene3D.controls.target);
fakeScene3D.camera.updateMatrixWorld(true);
console.log(`[2/4] World3D lot footprints, storybook outlines & 360° ortho lot picking verified for all ${G0.lots.length} lots`);

function assertNoInstancedNaNs(a3d, label) {
  const meshes = [
    a3d.shadowMesh, a3d.paperBodyMesh, a3d.paperHeadMesh, a3d.paperHairMesh,
    a3d.badgeMesh, a3d.carBodyMesh, a3d.carTrimMesh, a3d.motoMesh, a3d.motoDetailMesh, a3d.glowMesh,
  ];
  for (const m of meshes) {
    for (let k = 0; k < m.count * 16; k++) {
      assert(!Number.isNaN(m.instanceMatrix.array[k]), `NaN found in instanceMatrix (${label})!`);
    }
  }
}

const actors3d = new Actors3D(fakeScene3D, elements.get('world-hud'));
[
  actors3d.paperBodyMesh, actors3d.paperHeadMesh, actors3d.paperHairMesh,
  actors3d.badgeMesh, actors3d.carBodyMesh, actors3d.motoMesh, actors3d.glowMesh,
].forEach((m, idx) => {
  assert(m.instanceColor !== null, `InstancedMesh #${idx} missing instanceColor attribute!`);
});
assert(actors3d.carTrimMesh.geometry.attributes.color != null, 'carTrimMesh missing vertex color');
assert(actors3d.motoDetailMesh.geometry.attributes.color != null, 'motoDetailMesh missing vertex color');

// Run 7-day sim & verify Actors3D across Afternoon, Night, Rain, and Raid
const simSummary = simHeadlessDays(7);
const G2 = state.G;
assert(Number.isFinite(G2.money), 'G.money became non-finite!');

for (const tc of [
  { t: 14.5 * 60, rain: false, raid: 0, view: 1 },
  { t: 22.0 * 60, rain: true, raid: 22.5 * 60, view: null },
]) {
  G2.t = tc.t;
  G2.ev.rain = tc.rain;
  G2.raidUntil = tc.raid;
  G2.view = tc.view;
  world3d.updateDynamic(G2, 0.016);
  actors3d.update(G2, 0.016);
  assertNoInstancedNaNs(actors3d, `t=${tc.t}`);
  assert(actors3d.paperBodyMesh.count > 0, 'Expected 2.5D paper-doll actors');
}
console.log(`[3/4] Actors3D 2.5D paper dolls, rival balance (3-5), instanceColor & NaN checks OK (sim: ${simSummary.length} days)`);

/* ---------- 4. Verify UI Rendering, Numeric Readouts & Gameplay Economy/Events ---------- */
const econ = await import('../src/economy.js');
const evMod = await import('../src/events.js');
const { mkHostess, placeH } = state;

const panelEl = elements.get('panel');
const assertPanelValid = (label) => {
  assert(panelEl.innerHTML.length > 80, `Panel HTML too short in ${label}`);
  assert(!panelEl.innerHTML.includes('NaN'), `Found NaN in panel HTML (${label})`);
  assert(!panelEl.innerHTML.includes('undefined'), `Found undefined in panel HTML (${label})`);
};

G2.view = null;
for (const st of ['mine', 'empty', 'rival']) {
  G2.streetTab = st;
  ui.renderPanel();
  assertPanelValid(`street:${st}`);
}
assert(panelEl.innerHTML.includes('公关'), 'Missing rival hostess count in street rival panel');

const myBars = G2.lots.filter((l) => l.kind === 'mine');
if (myBars.length) {
  const b = myBars[0];
  G2.money = 100000;
  G2.t = 20 * 60;
  const pay = (n) => { G2.money -= n; return true; };
  assert(econ.setBarConcept(b, 'ktv', pay, noop, noop));
  assert.equal(b.concept, 'ktv');
  assert(econ.buyMenuItem(b, 'champagne', pay, noop));
  assert(b.menu.champagne);
  const h0 = b.hostesses[0] || mkHostess(5);
  if (!b.hostesses.length) { b.hostesses.push(h0); placeH(b, h0); }
  assert(econ.giveHongbao(b, h0.id, pay, noop));
  assert(h0.loyalUntil > G2.day);
  assert(econ.trainHostess(b, h0.id, pay, noop));
  econ.applyShiftPreset(b, 'rest', noop);
  const prevB = b.bouncers.length;
  assert(econ.hireBouncer(b, 0, noop));
  assert.equal(b.bouncers.length, prevB + 1);

  const rival = G2.lots.find((l) => l.kind === 'rival');
  assert(rival && econ.rivalIntel(rival).modeCn.length > 0);
  assert(econ.poachRivalHostess(rival, b, pay, noop));

  // Test rival buyout & save/load roundtrip with zero NaNs
  G2.bestRank = 1;
  G2.money = 200000;
  assert(econ.buyoutRival(rival, pay, noop, (lot) => world3d.rebuildLot(lot, G2)));
  assert.equal(rival.kind, 'mine');
  assert(rival.hostesses.length >= 3, 'Expected >= 3 hostesses after rival buyout');
  assert(Number.isFinite(rival.rent) && Number.isFinite(rival.loc));
  state.save();
  assert(state.load(() => {}));
  const reloadedRival = state.G.lots[rival.i];
  assert.equal(reloadedRival.kind, 'mine');
  assert(Number.isFinite(reloadedRival.rent) && Number.isFinite(reloadedRival.loc));
  const bAfterLoad = state.G.lots[b.i];
  state.G.t = 20 * 60;
  state.G.money = 150000;

  assert(evMod.activateSkill(bAfterLoad, 'happyHour', pay, noop));
  assert(evMod.activateSkill(bAfterLoad, 'lowProfile', pay, noop));
  bAfterLoad._g.push({ id: 'mockg' });
  const le = evMod.triggerLiveEvent(noop);
  assert(le && evMod.resolveLiveEvent('A', noop, noop, noop));
  bAfterLoad._g.pop();

  state.G.view = bAfterLoad.i;
  for (const tab of ['run', 'upg', 'girls', 'scout', 'mkt']) {
    state.G.tab = tab;
    if (tab === 'girls') {
      state.G.girlSub = 'roster';
      ui.renderPanel();
      assertPanelValid('bar:girls:roster');
      state.G.girlSub = 'cands';
      ui.renderPanel();
      assertPanelValid('bar:girls:cands');
    } else {
      ui.renderPanel();
      assertPanelValid(`bar:${tab}`);
    }
  }
}
ui.showBriefModal(['测试简报']);
ui.showAchievementsModal();
ui.showEndDayModal({
  hf: 1200, dr: 800, cogs: 200, hw: 500, hc: 540, sw: 200, rent: 400,
  fines: 0, fee: 0, net: 160, nh: 0, rf: 0, tu: 0, nl: 0, nr: 1, sto: 0, bnc: 0,
  barSummaries: [], extra: [], got: [], sunday: false, bust: false,
});
const { update, nextDay, scheduleRegs } = await import('../src/sim.js');
const { newGame, mkScout, mkMkt, mkBouncer, resetBarDay, placeM, placeBouncer, bars } = state;

console.log('[4/4] UI, economy & live event systems verified with 0 errors');

/* ---------- 5. 14-Day 3-Bar High-Load Stress Benchmark ---------- */
const tBench0 = performance.now();
newGame(scheduleRegs);
const SG = state.G;
SG.money = 350000;
SG.bestRank = 1;
const payBench = (n) => { SG.money -= n; return true; };

// Open 2 empty lots (bintang + club) + buy out 1 rival (ktv) = 3 player bars
const empties = SG.lots.filter((l) => l.kind === 'empty').slice(0, 2);
['bintang', 'club'].forEach((cId, idx) => {
  const e = empties[idx];
  Object.assign(e, {
    kind: 'mine',
    name: idx === 0 ? 'Bintang Stress' : 'Club Stress',
    accent: cId === 'bintang' ? '#D99B38' : '#FF5C54',
    concept: cId,
    menu: { bucket: true, platter: true, whisky: true, champagne: true },
    price: 45,
    decor: 2,
    seats: 2,
    rooms: 2,
    sign: 2,
    rep: 3.6,
    baseRent: e.rent,
    fl: '#D8CDB8',
    hostesses: Array.from({ length: 8 }, () => Object.assign(mkHostess(6, true), { state: 'idle', todayH: 0, hidden: false, on: true })),
    scouts: [mkScout()],
    mkts: [mkMkt()],
    bouncers: [mkBouncer()],
    req: { body: 'any', pers: 'any', looks: 0, att: 0 },
    cands: [],
  });
  e.ac = e.accent;
  resetBarDay(e);
  e.hostesses.forEach((h) => placeH(e, h));
  e.mkts.forEach((m) => placeM(e, m));
  e.bouncers.forEach((b2, bi) => placeBouncer(e, b2, bi));
  SG.mine[e.i] = e;
});

const rivalTarget = SG.lots.find((l) => l.kind === 'rival');
assert(econ.buyoutRival(rivalTarget, payBench, noop, noop));
assert.equal(bars().length, 3);
world3d.buildAll(SG);

for (let d = 0; d < 14; d++) {
  const curG = state.G;
  curG.modal = false;
  curG.speed = 4;
  curG.ev.rain = d % 4 === 1;
  if (d % 5 === 2) curG.ev.razia = 21.5 * 60;
  let steps = 0;
  let didSkill = false;
  while (!curG.modal && steps < 4500) {
    update(0.1);
    steps++;
    if (!didSkill && curG.t >= 20 * 60) {
      didSkill = true;
      const myB = bars();
      if (myB[0]) evMod.activateSkill(myB[0], 'happyHour', payBench, noop);
      if (myB[1]) evMod.activateSkill(myB[1], 'showtime', payBench, noop);
      if (myB[2]) evMod.activateSkill(myB[2], 'lowProfile', payBench, noop);
      if (curG.liveEvent) evMod.resolveLiveEvent('A', noop, noop, noop);
    }
    if (steps % 400 === 0) {
      world3d.updateDynamic(curG, 0.016);
      actors3d.update(curG, 0.016);
    }
  }
  assert(Number.isFinite(curG.money), `Non-finite money on day ${curG.day}`);
  bars().forEach((b3) => {
    assert(Number.isFinite(b3.rep) && Number.isFinite(b3.rent) && Number.isFinite(b3.loc), `Non-finite bar stat on ${b3.name}`);
    assert(b3.roomsUsed >= 0, `Negative roomsUsed on ${b3.name}`);
    b3.hostesses.forEach((h) => {
      assert(Number.isFinite(h.en) && Number.isFinite(h.mood) && Number.isFinite(h.wage), `Non-finite hostess stat on ${h.name}`);
    });
  });
  assertNoInstancedNaNs(actors3d, `14-day stress day ${d + 1}`);
  curG.lots.filter((l) => l.kind === 'rival').forEach((rv) => {
    assert(rv.hn >= 3 && rv.hn <= 12, `Rival ${rv.name} hn out of balanced range 3..12: ${rv.hn}`);
  });
  if (d < 13) {
    nextDay();
    world3d.buildAll(state.G);
  }
}

state.save();
assert(state.load(scheduleRegs));
assert.equal(bars().length, 3, 'Expected all 3 bars (incl. bought-out rival) to survive save/load');
const benchMs = (performance.now() - tBench0).toFixed(1);
console.log(`[5/5] 14-day 3-bar stress benchmark + save/load OK in ${benchMs}ms (final day=${state.G.day}, history=${state.G.history.length}, achievements=${state.G.achievements.length}, sceneChildren=${fakeScene3D.scene.children.length})`);
console.log('ALL VERIFICATIONS PASSED!');
