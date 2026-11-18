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

const domIds = ['panel', 'panelWrap', 'sheet', 'modal', 'toast', 'hDay', 'hMoney', 'hMoneyChip', 'tdot', 'speed', 'zall', 'ttl', 'hClock', 'auM', 'auS', 'btnSkipOpen', 'world-hud', 'barPills', 'skillDock', 'liveEventCard', 'btnQual', 'btnCodex', 'codexCnt', 'btnAch', 'achCnt', 'mobTabs', 'sheetGrabber', 'btnLight'];
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

// Verify every bar counter has visible bartenders even at 14:30 before street traffic spawns
actors3d.update(G0, 0.016);
const rivalCount = G0.lots.filter((l) => l.kind === 'rival').length;
assert(actors3d.paperBodyMesh.count >= rivalCount + 4, `Expected >= ${rivalCount + 4} bartenders/staff at opening, got ${actors3d.paperBodyMesh.count}`);

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
G2.ev.rain = true;
for (const st of ['mine', 'empty', 'rival']) {
  G2.streetTab = st;
  ui.renderPanel();
  assertPanelValid(`street:${st}`);
  assert(panelEl.innerHTML.includes('ev-card'), `Missing event card in street:${st}`);
}
assert(panelEl.innerHTML.includes('公关'), 'Missing rival hostess count in street rival panel');

// Verify hidden attitude drives pop gain via review(), categorical body preference & uncapped vouchers
const codexMod = await import('../src/codex.js');
const { review, choiceScore, choosePkg, startSession, skipToOpen, update, nextDay, scheduleRegs, whaleDecide } = await import('../src/sim.js');
const { CT, makePkg, T_OPEN } = await import('../src/config.js');
assert.equal(CT.local.body, 'curvy');
assert.equal(CT.tai.body, 'slim');
assert.equal(CT.cn.body, 'any');
assert.equal(makePkg(1).h, 1);
assert.equal(makePkg(2).h, 3);
assert.equal(makePkg(6).h, 11);
assert.equal(makePkg(6).fee, 2400);
assert.equal(makePkg(9).h, 17);

const hProbe = mkHostess(5);
assert.equal(hProbe.bs, undefined, 'body must be categorical without numeric bs');
assert(hProbe.body === 'slim' || hProbe.body === 'curvy');

const hSlim = { body: 'slim', looks: 7, att: 7, pop: 10 };
const hCurvy = { body: 'curvy', looks: 7, att: 7, pop: 10 };
const hPrime = { body: 'prime', looks: 7, att: 7, pop: 10 };
assert(choiceScore({ ctype: 'local' }, hCurvy) > choiceScore({ ctype: 'local' }, hSlim), 'local must prefer curvy');
assert(choiceScore({ ctype: 'tai' }, hSlim) > choiceScore({ ctype: 'tai' }, hCurvy), 'tai must prefer slim');
assert.equal(choiceScore({ ctype: 'cn' }, hSlim), choiceScore({ ctype: 'cn' }, hCurvy), 'cn accepts both equally');
assert(choiceScore({ ctype: 'local' }, hPrime) > choiceScore({ ctype: 'local' }, hCurvy), 'prime matches local top tier');
assert(choiceScore({ ctype: 'tai' }, hPrime) > choiceScore({ ctype: 'tai' }, hSlim), 'prime matches tai top tier');

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
  const hHi = Object.assign(mkHostess(5), { att: 9, en: 90, mood: 80, pop: 0 });
  const hLo = Object.assign(mkHostess(5), { att: 2, en: 90, mood: 80, pop: 0 });
  const mockGuest = { ctype: 'local', x: b.x0 + 1, y: b.y0 + 1, ph: 0 };
  review(mockGuest, hHi, b, 8.2);
  review(mockGuest, hLo, b, 4.0);
  assert(hHi.pop > hLo.pop, `Expected high-attitude hostess pop (${hHi.pop}) > low-attitude (${hLo.pop})`);

  // Verify wish fulfillment drives uncapped paid hours (> 5 possible)
  const hDream = { body: 'slim', looks: 10, att: 10, pop: 120, traits: ['polyglot'] };
  const hAvg = { body: 'curvy', looks: 4, att: 3, pop: 0, traits: [] };
  const pDream = { ctype: 'tai' };
  let sumDream = 0;
  let sumAvg = 0;
  let maxDreamPaid = 0;
  for (let i = 0; i < 40; i++) {
    const pkD = choosePkg(pDream, choiceScore(pDream, hDream), b, hDream);
    const pkA = choosePkg(pDream, choiceScore(pDream, hAvg), b, hAvg);
    sumDream += pkD.paid;
    sumAvg += pkA.paid;
    if (pkD.paid > maxDreamPaid) maxDreamPaid = pkD.paid;
  }
  assert(sumDream > sumAvg * 1.5, `Expected high-wish duration sum (${sumDream}) >> average (${sumAvg})`);
  assert(maxDreamPaid > 5, `Expected uncapped booking > 5 paid hours, got max=${maxDreamPaid}`);

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
  const le = evMod.triggerLiveEvent(ui.renderLiveEvent);
  assert(le && elements.get('liveEventCard').innerHTML.includes('ev-choice-grid'), 'Expected live event card choice grid');
  assert(evMod.resolveLiveEvent('A', noop, noop, noop));
  bAfterLoad._g.pop();

  state.G.view = bAfterLoad.i;
  for (const tab of ['run', 'upg', 'girls', 'scout', 'mkt']) {
    state.G.tab = tab;
    if (tab === 'girls') {
      ui.renderPanel();
      assertPanelValid('bar:girls:roster');
      assert(panelEl.innerHTML.includes('class="vbar"'), 'Expected visual attribute bars on roster');
      assert(panelEl.innerHTML.includes('type-pill'), 'Expected categorical body type pill on roster');
      assert(panelEl.innerHTML.includes('h-charm-row') && !panelEl.innerHTML.includes('<small>苗条</small>') && !panelEl.innerHTML.includes('<small>丰满</small>'), 'Expected single charm bar and no bar for body type on roster');
      assert(!panelEl.innerHTML.includes('内向') && !panelEl.innerHTML.includes('外向'), 'Personality traits must be removed from roster');
      assert(!panelEl.innerHTML.includes('态 '), 'Hidden attitude leaked on roster');
      assert(!panelEl.innerHTML.includes('data-a="girlSub"'), 'Passive cands subtab must be removed');
    } else if (tab === 'scout') {
      codexMod.spinSlotMachine(state.G, bAfterLoad, pay, noop, noop);
      ui.renderPanel();
      assertPanelValid('bar:scout');
      assert(panelEl.innerHTML.includes('slot-cabinet') && panelEl.innerHTML.includes('slot-window'), 'Expected slot cabinet reel windows');
      assert(panelEl.innerHTML.includes('class="vbar"') && panelEl.innerHTML.includes('type-pill'), 'Expected visual bars & body pill on dispensed candidate');
      assert(panelEl.innerHTML.includes('h-charm-row') && !panelEl.innerHTML.includes('h-bars-3'), 'Expected single charm bar only on slot candidate');
      assert(!panelEl.innerHTML.includes('内向') && !panelEl.innerHTML.includes('外向'), 'Personality traits must be removed from slot candidate');
      assert(!panelEl.innerHTML.includes('态 ') && !panelEl.innerHTML.includes('态度'), 'Hidden attitude leaked in scout tab');
      state.G.slot.pending = null;
    } else {
      ui.renderPanel();
      assertPanelValid(`bar:${tab}`);
    }
  }

  // Test pre-closing overnight takeout booking -> returns before 17:00 (5 PM) next day
  const hOver = bAfterLoad.hostesses[0];
  hOver.state = 'idle';
  hOver.on = true;
  hOver.sick = false;
  hOver.en = 95;
  hOver.mood = 85;
  state.G.t = 26.5 * 60;
  const mockNightGuest = {
    ctype: 'cn',
    x: bAfterLoad.x0 + 1,
    y: bAfterLoad.y0 + 1,
    home: [bAfterLoad.x0 + 1, bAfterLoad.y0 + 1],
    bar: bAfterLoad.i,
    door: bAfterLoad.doors[0],
    st: 'sit',
    seat: 0,
    visits: 0,
    maxV: 1,
    ph: 0,
  };
  startSession(mockNightGuest, bAfterLoad, hOver, makePkg(8, 14.5), 'out');
  assert(hOver.until > 27 * 60 && hOver.until <= (24 + 17) * 60, `Expected overnight until in (27h..41h], got ${hOver.until}`);
  nextDay();
  const hNext = state.G.lots[bAfterLoad.i].hostesses.find((x) => x.id === hOver.id);
  assert(hNext && hNext.state === 'out' && hNext.until <= T_OPEN, `Expected overnight hostess still out during afternoon until <= 17:00, got state=${hNext?.state} until=${hNext?.until}`);
  assert(skipToOpen());
  assert.equal(hNext.state, 'idle', 'Expected overnight hostess to return by 17:00 opening');

  // Verify v5.0: 5-tier rarity, Slot Machine, Dual Codex, Synergies/Clashes, Whale Lure, Customer Voices & non-punishing optB
  const curG5 = state.G;
  const bar5 = curG5.lots[bAfterLoad.i];
  curG5.money = 120000;
  const pay5 = (n) => { curG5.money -= n; return true; };

  // 1) 5-tier rarity + Tier-5 2.0x fee multiplier
  const hR2 = mkHostess(5, false, 2);
  const hR5 = codexMod.instantiateLegendGirl(codexMod.LEGEND_GIRLS[0]); // kartika
  assert.equal(codexMod.rarityOf(hR2).r, 2);
  assert.equal(codexMod.rarityOf(hR5).r, 5);
  assert.equal(codexMod.rarityOf(hR5).feeMul, 2.0);

  // 2) Slot Machine: free spin, lock blocked on Lv.1, upgrade to Lv.2..4, lock allowed, pity Jackpot -> codexGirls + hireSlotPending
  assert(!codexMod.toggleSlotLock(curG5, 0, noop), 'Slot lock should be blocked at Lv.1');
  const firstSpin = codexMod.spinSlotMachine(curG5, bar5, pay5, noop, noop);
  assert(firstSpin && firstSpin.rarity >= 1 && firstSpin.rarity <= 5);
  assert(codexMod.upgradeSlotMachine(curG5, pay5, noop) && curG5.slot.lv === 2);
  assert(codexMod.toggleSlotLock(curG5, 2, noop) && curG5.slot.locks[2] === true);
  assert(codexMod.upgradeSlotMachine(curG5, pay5, noop) && curG5.slot.lv === 3);
  assert(codexMod.upgradeSlotMachine(curG5, pay5, noop) && curG5.slot.lv === 4);
  curG5.slot.pity = codexMod.SLOT_LEVELS[4].pityMax;
  const legSpin = codexMod.spinSlotMachine(curG5, bar5, pay5, noop, noop);
  assert(legSpin && legSpin.rarity === 5 && legSpin.legendId, 'Expected pity Jackpot to yield Tier-5 Legendary hostess');
  assert(curG5.codexGirls[legSpin.legendId] === true, 'Expected Jackpot to unlock girl in codexGirls');
  const prevLen = bar5.hostesses.length;
  bar5.hostesses = bar5.hostesses.slice(0, 4);
  assert(econ.hireSlotPending(bar5, noop), 'Expected hireSlotPending to sign pending girl');
  assert(bar5.hostesses.length === Math.min(prevLen, 4) + 1 && curG5.slot.pending === null);

  // 3) Roster Synergies & Clashes
  bar5.hostesses = [
    Object.assign(mkHostess(6, false, 3), { body: 'slim', traits: ['singer'], on: true, sick: false }),
    Object.assign(mkHostess(6, false, 3), { body: 'curvy', traits: ['drinker'], on: true, sick: false }),
    Object.assign(mkHostess(6, false, 2), { body: 'slim', traits: ['polyglot'], on: true, sick: false }),
    Object.assign(mkHostess(6, false, 2), { body: 'curvy', traits: ['sweet'], on: true, sick: false }),
    Object.assign(codexMod.instantiateLegendGirl(codexMod.LEGEND_GIRLS[2]), { on: true, sick: false }), // meiling
  ];
  const synOk = codexMod.evalBarSynergy(bar5);
  assert(synOk.ids.includes('box_gold') && synOk.ids.includes('balance_body') && synOk.ids.includes('star_moon'), 'Expected box_gold, balance_body, star_moon synergies');
  assert.equal(synOk.clashes.length, 0, 'Expected zero clashes on balanced roster');

  bar5.hostesses.push(Object.assign(codexMod.instantiateLegendGirl(codexMod.LEGEND_GIRLS[0]), { on: true, sick: false })); // kartika -> two_queens + noble_rowdy if rowdy added
  bar5.hostesses.push(Object.assign(mkHostess(5, false, 2), { traits: ['rowdy'], on: true, sick: false }));
  const synClash = codexMod.evalBarSynergy(bar5);
  assert(synClash.clashIds.includes('two_queens') && synClash.clashIds.includes('noble_rowdy'), 'Expected two_queens and noble_rowdy clashes');

  // 4) Whale Lure + 3 visits -> permanent perk
  bar5.concept = 'ktv';
  bar5.menu.whisky = true;
  bar5.hostesses.pop();
  bar5.hostesses.pop();
  assert(codexMod.barMatchedWhales(bar5, curG5).some((w) => w.id === 'hendra'), 'Expected bar to lure Pak Hendra');
  const hendraDef = codexMod.WHALE_MAP.hendra;
  for (let v = 0; v < 3; v++) {
    bar5.hostesses.forEach((h) => { h.state = 'idle'; h.hidden = false; h.en = 90; });
    const wObj = { id: 'hendra', bar: bar5.i, done: false };
    const mPeds = Array.from({ length: hendraDef.n }, (_, idx) => ({
      whale: wObj, bar: bar5.i, st: 'sit', seat: idx, ctype: hendraDef.ctype, x: bar5.x0 + 1, y: bar5.y0 + 1, home: [bar5.x0 + 1, bar5.y0 + 1], door: bar5.doors[0],
    }));
    curG5.peds.push(...mPeds);
    whaleDecide(mPeds[0], bar5);
  }
  assert(curG5.codexWhales.hendra?.unlocked === true, 'Expected 3 visits to unlock Pak Hendra permanent perk');
  assert.equal(codexMod.whalePerkBonuses(curG5.codexWhales).protectionMul, 0.75);

  // 5) Customer Voices compilation & Codex/Brief/Slot HTML sanity
  bar5.today.voices.noSlim = 3;
  bar5.today.voices.roomFull = 2;
  curG5.lastVoices = codexMod.compileCustomerVoices([bar5], curG5);
  assert(curG5.lastVoices.length >= 2 && curG5.lastVoices[0].text.includes(bar5.name));
  ui.showCodexModal('girls');
  assert(!elements.get('sheet').innerHTML.includes('NaN') && !elements.get('sheet').innerHTML.includes('undefined') && elements.get('sheet').innerHTML.includes('雅加达女子图鉴'));
  ui.showCodexModal('whales');
  assert(!elements.get('sheet').innerHTML.includes('NaN') && !elements.get('sheet').innerHTML.includes('undefined') && elements.get('sheet').innerHTML.includes('Pak Hendra'));

  // 6) Non-punishing Live Event optB fallback
  for (let k = 0; k < 6; k++) {
    bar5._g.push({ id: 'evg' });
    curG5.liveEvent = null;
    evMod.triggerLiveEvent(ui.renderLiveEvent);
    const beforeM = curG5.money;
    evMod.resolveLiveEvent('B', noop, noop, noop);
    assert(curG5.money >= beforeM, 'Expected live event optB timeout fallback to never lose cash');
    bar5._g.pop();
  }

  // 7) Strict slot-only recruitment: scoutDay & nextDay produce 0 passive candidates
  assert.equal(state.scoutDay(bar5).length, 0, 'scoutDay must return empty array');
  nextDay();
  assert.equal(state.G.lots[bAfterLoad.i].cands.length, 0, 'nextDay must never generate passive walk-in candidates');
}
state.G.ev.rain = true;
ui.showBriefModal(['测试简报']);
assert(elements.get('sheet').innerHTML.includes('ev-card'), 'Expected event card in daily brief modal');
assert(elements.get('sheet').innerHTML.includes('昨夜客群真实心声'), 'Expected customer voices in daily brief modal');
ui.showAchievementsModal();
ui.showEndDayModal({
  hf: 1200, dr: 800, cogs: 200, hw: 500, hc: 540, sw: 200, rent: 400,
  fines: 0, fee: 0, net: 160, nh: 0, rf: 0, tu: 0, nl: 0, nr: 1, sto: 0, bnc: 0,
  barSummaries: [], extra: [], got: [], sunday: false, bust: false,
});
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
    req: { body: 'any', looks: 0, att: 0 },
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
