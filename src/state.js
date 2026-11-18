import {
  ACCENTS, BARPAL, BNAMES, CONCEPTS, HAIRS, HNAMES, LAY, LOTDEF, MNAMES,
  DRESS, ROOMS, SKINS, TYPE, T0, T_END, T_OPEN, T_RIVAL, TRAIT_KEYS,
  Lw, R, clamp, hWage, onDuty, outPt, pick, pickC, playerEls, rnd, scaleEls, stOf, uid,
} from './config.js';

export let G = null;
export const DOORS_BY_STREET = [[], [], [], [], [], []];
export const GROUPS = new Map();

export function setG(next) {
  G = next;
  return G;
}

export const bars = () => (G ? Object.keys(G.mine).map((k) => G.mine[k]) : []);
export const allH = () => bars().flatMap((l) => l.hostesses);

export function registerGroupPed(p) {
  if (!p.gid) return;
  let arr = GROUPS.get(p.gid);
  if (!arr) {
    arr = [];
    GROUPS.set(p.gid, arr);
  }
  arr.push(p);
}

export function unregisterGroupPed(p) {
  if (!p.gid) return;
  const arr = GROUPS.get(p.gid);
  if (!arr) return;
  const idx = arr.indexOf(p);
  if (idx >= 0) {
    arr[idx] = arr[arr.length - 1];
    arr.pop();
  }
  if (!arr.length) GROUPS.delete(p.gid);
}

export function rebuildGroups() {
  GROUPS.clear();
  if (!G) return;
  for (let i = 0; i < G.peds.length; i++) {
    registerGroupPed(G.peds[i]);
  }
}

export function buildLots(state = G) {
  for (let s = 0; s < 6; s++) DOORS_BY_STREET[s].length = 0;
  const lots = LOTDEF.map((orig, i) => {
    let d = orig;
    const nr = state && state.newRivals && state.newRivals[i];
    if (nr) {
      d = Object.assign({}, d, { n: nr.n, t: 'bar', lay: nr.lay, sty: 'dark', cn: '新开的酒吧' });
    }
    const [x0, y0, x1, y1] = d.r;
    const f = d.f;
    const along = f[0] === 'y';
    const l = {
      i,
      name: d.n || '',
      cn: d.cn,
      type: d.t,
      style: d.sty,
      lay: d.lay || null,
      f,
      x0,
      y0,
      x1,
      y1,
      part: d.part || 3,
      top: !!d.part,
      signU: d.signU,
      L: along ? x1 - x0 : y1 - y0,
      D: along ? y1 - y0 : x1 - x0,
      kind: d.t === 'empty' ? 'empty' : d.t === 'bar' ? 'rival' : 'shop',
    };
    const T = TYPE[d.t];
    l.ac = l.lay ? BARPAL[l.lay].ac : T.ac;
    l.fl = T.fl;
    l.open = T.open;
    l.visit = T.visit;
    if (l.lay) {
      const Ld = LAY[l.lay];
      const su = Ld.abs ? 1 : l.L / 10;
      const sv = Ld.abs ? 1 : l.D / 6;
      l.els = scaleEls(Ld.els, su, sv);
      l.doorUs = d.doors || [Ld.door * su];
    } else {
      l.doorUs = d.doors || [l.L * 0.45];
    }
    l.doors = l.doorUs.map((u) => {
      const o = outPt(l, u);
      return { u, out: o, in: Lw(l, u, l.D - 0.7), st: stOf(o) };
    });
    l.xd = d.xd || [];
    l.xd.forEach((y) => {
      const o = [x0 - 0.45, y];
      l.doors.push({ out: o, in: [x0 + 0.7, y], st: stOf(o) });
    });
    l.st = l.doors[0].st;
    if (l.kind === 'rival') {
      l.price = BARPAL[l.lay].price;
      l.pull = BARPAL[l.lay].pull;
      if (nr) l.ac = nr.ac;
    }
    if (l.kind === 'empty') {
      const a = l.L * l.D;
      l.loc = +((l.st === 1 ? 1.08 : 1) + 0.12 * (x1 / 47.5)).toFixed(2);
      l.cost = Math.round((a * 350) / 100) * 100;
      l.rent = Math.round((a * 30) / 10) * 10;
    }
    return l;
  });

  // Index doors by street once per layout rebuild
  for (let i = 0; i < lots.length; i++) {
    const l = lots[i];
    for (let j = 0; j < l.doors.length; j++) {
      const dr = l.doors[j];
      if (dr.st >= 0 && dr.st < 6) {
        DOORS_BY_STREET[dr.st].push({ l, dr });
      }
    }
  }
  return lots;
}

export function mkHostess(q, forceTrait = false) {
  const r = () => clamp(Math.round(q + (R() + R() + R() - 1.5) * 2.2), 1, 10);
  const h = {
    id: uid(),
    name: pick(HNAMES),
    body: R() < 0.5 ? 'slim' : 'curvy',
    looks: r(),
    att: r(),
    pers: R() < 0.5 ? 'intro' : 'extro',
    ps: r(),
    hair: pick(HAIRS),
    skin: pick(SKINS),
    dress: pick(DRESS),
    reviews: [],
    en: 100,
    mood: 70,
    pop: 0,
    on: true,
    streak: 0,
    hs: (R() * 4) | 0,
    lt: 0,
    pr: 0,
    refused: 0,
    loyalUntil: 0,
    traits: [],
  };
  if (forceTrait || (q >= 5.5 && R() < 0.45) || R() < 0.16) {
    h.traits.push(pick(TRAIT_KEYS));
  }
  h.wage = hWage(h);
  return h;
}

export function applyReq(h, req, ab) {
  const p = 0.45 + 0.05 * ab;
  if (req.body !== 'any' && h.body !== req.body && R() < p) h.body = req.body;
  if (req.pers !== 'any' && h.pers !== req.pers && R() < p) h.pers = req.pers;
  for (let k = 0; k < 2; k++) {
    if (req.looks && h.looks < req.looks && R() < p) h.looks = clamp(h.looks + 1 + ((R() * 3) | 0), 1, 10);
    if (req.att && h.att < req.att && R() < p) h.att = clamp(h.att + 1 + ((R() * 3) | 0), 1, 10);
  }
  if (ab >= 7 && !h.traits.length && R() < 0.45) {
    h.traits.push(pick(TRAIT_KEYS));
  }
  h.wage = hWage(h);
  return h;
}

export function scoutDay(l) {
  const out = [];
  const req = l.req;
  const nreq = (req.body !== 'any') + (req.pers !== 'any') + (req.looks > 0) + (req.att > 0);
  if (!l.scouts.length) {
    const n = 2 + (R() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) out.push(mkHostess(3.8));
  }
  l.scouts.forEach((s) => {
    const base = s.kind === 'q' ? 1 + Math.floor(s.ab / 3) : 3 + Math.floor(s.ab / 2);
    const n = Math.max(1, Math.round(base * (1 - 0.12 * nreq)));
    const q = s.kind === 'q' ? 3 + 0.62 * s.ab : 2.6 + 0.36 * s.ab;
    for (let i = 0; i < n; i++) out.push(applyReq(mkHostess(q), req, s.ab));
  });
  return out.slice(0, 10);
}

export function mkScout() {
  const kind = R() < 0.5 ? 'q' : 'n';
  const ab = 2 + ((R() * 8) | 0);
  return {
    id: uid(),
    name: pick(MNAMES),
    kind,
    ab,
    wage: Math.round(((80 + 70 * ab) * (kind === 'q' ? 1.1 : 1)) / 10) * 10,
  };
}

export function mkMkt() {
  const ab = 2 + ((R() * 8) | 0);
  return {
    id: uid(),
    name: pick(MNAMES),
    ab,
    wage: Math.round((60 + 55 * ab) / 10) * 10,
    hair: pick(HAIRS),
    skin: pick(SKINS),
  };
}

export function mkBouncer() {
  const ab = 3 + ((R() * 7) | 0);
  return {
    id: uid(),
    name: pick(BNAMES),
    ab,
    wage: Math.round((110 + 45 * ab) / 10) * 10,
    hair: '#1f1a18',
    skin: pick(SKINS),
  };
}

/* ---------- Interior geometry & placement ---------- */
export const P5 = (l, u, v) => Lw(l, (u * l.L) / 5, (v * l.D) / 6);

export function curEls(l) {
  if (l.kind === 'mine') {
    if (!l._els) {
      if (l.customLay && LAY[l.customLay]) {
        const Ld = LAY[l.customLay];
        const su = Ld.abs ? 1 : l.L / 10;
        const sv = Ld.abs ? 1 : l.D / 6;
        l._els = scaleEls(Ld.els, su, sv);
      } else {
        l._els = scaleEls(playerEls(l), l.L / 5, l.D / 6);
      }
    }
    return l._els;
  }
  return l.els || [];
}

export function seatList(l) {
  if (l._seats) return l._seats;
  const S = [];
  const add = (u, v, k, lift) => {
    const [x, y] = Lw(l, u, v);
    S.push({ x, y, k, lift });
  };
  curEls(l).forEach((e) => {
    const [t, a, b, c, d] = e;
    if (t === 'sofa') {
      const w = c - a;
      const h = d - b;
      if (w >= h) {
        const n = Math.max(1, Math.round(w / 0.85));
        for (let i = 0; i < n; i++) add(a + (w * (i + 0.5)) / n, (b + d) / 2, 'sofa', 2.4);
      } else {
        const n = Math.max(1, Math.round(h / 0.85));
        for (let i = 0; i < n; i++) add((a + c) / 2, b + (h * (i + 0.5)) / n, 'sofa', 2.4);
      }
    } else if (t === 'rt') {
      add(a - 0.42, b, 'table', 0);
      add(a + 0.42, b, 'table', 0);
    } else if (t === 'bar' || t === 'cbar') {
      const n = Math.max(2, Math.round((c - a) / 0.75));
      for (let i = 0; i < n; i++) add(a + ((c - a) * (i + 0.5)) / n, d + 0.33, 'stool', 0);
    }
  });
  return (l._seats = S);
}

export const cap = (l) => seatList(l).length;

export function wsSpots(l) {
  if (l._spots) return l._spots;
  const els = curEls(l);
  const block = [];
  els.forEach((e) => {
    const [t, a, b, c, d] = e;
    if (t === 'rt') block.push([a - 0.75, b - 0.4, a + 0.75, b + 0.4]);
    else if (t !== 'work' || l.kind === 'mine') block.push([a - 0.12, b - 0.12, c + 0.12, d + 0.12]);
  });
  const S = [];
  const ok = (u, v) =>
    u > 0.2 &&
    u < l.L - 0.2 &&
    v > 0.2 &&
    v < l.D - 0.4 &&
    !block.some((q) => u > q[0] && u < q[2] && v > q[1] && v < q[3]) &&
    !S.some((s) => Math.hypot(s.u - u, s.v - v) < 0.36);

  [0.3, 0.66, 1.02].forEach((o, ri) =>
    els.forEach((e) => {
      if (e[0] !== 'ws') return;
      const u1 = e[1] - o;
      const v1 = e[2] - o;
      const u2 = e[3] + o;
      const v2 = e[4] + o;
      const w = u2 - u1;
      const h = v2 - v1;
      const per = 2 * (w + h);
      const n = Math.floor(per / 0.42);
      for (let k = 0; k < n; k++) {
        let t = (k * per) / n;
        let u;
        let v;
        if (t < w) { u = u1 + t; v = v1; }
        else if ((t -= w) < h) { u = u2; v = v1 + t; }
        else if ((t -= h) < w) { u = u2 - t; v = v2; }
        else { t -= w; u = u1; v = v2 - t; }
        if (ok(u, v)) S.push({ u, v, ring: ri });
      }
    }),
  );
  return (l._spots = S.map((q) => {
    const [x, y] = Lw(l, q.u, q.v);
    return { x, y, ring: q.ring };
  }));
}

export const hGo = (h, path, then) => {
  h._path = path;
  h._pi = 0;
  h.then = then || null;
  h.sit = false;
  h.lift = 0;
};

export function freeSpot(l, h) {
  if (h.spot != null && l._spotT && l._spotT[h.spot] === h) delete l._spotT[h.spot];
  h.spot = null;
  if (h.sofa != null && l._sofaH && l._sofaH[h.sofa] === h) delete l._sofaH[h.sofa];
  h.sofa = null;
}

export function takeSpot(l, h) {
  const S = wsSpots(l);
  const seats = seatList(l);
  l._spotT = l._spotT || {};
  l._sofaH = l._sofaH || {};
  freeSpot(l, h);
  const f0 = [];
  S.forEach((q, i) => { if (q.ring === 0 && !l._spotT[i]) f0.push(i); });
  const fs = [];
  seats.forEach((q, i) => { if (q.k === 'sofa' && !l._taken[i] && !l._sofaH[i]) fs.push(i); });
  if (fs.length && (R() < 0.4 || !f0.length)) {
    const i = pick(fs);
    l._sofaH[i] = h;
    h.sofa = i;
    return [seats[i].x, seats[i].y];
  }
  for (let r = 0; r < 3; r++) {
    const f = [];
    S.forEach((q, i) => { if (q.ring === r && !l._spotT[i]) f.push(i); });
    if (f.length) {
      const i = pick(f);
      l._spotT[i] = h;
      h.spot = i;
      return [S[i].x, S[i].y];
    }
  }
  const q = S.length ? pick(S) : { x: Lw(l, l.L / 2, 1)[0], y: Lw(l, l.L / 2, 1)[1] };
  return [q.x + rnd(-0.35, 0.35), q.y + rnd(-0.35, 0.35)];
}

export function claimSeat(l, si, q) {
  l._taken[si] = q;
  const h = l._sofaH && l._sofaH[si];
  if (h) {
    delete l._sofaH[si];
    h.sofa = null;
    h.sit = false;
    h.lift = 0;
    hGo(h, [takeSpot(l, h)], 'home');
  }
}

export const restLift = (l, h) => (h.sofa != null ? 2.4 : h.spot != null && wsSpots(l)[h.spot]?.ring === 0 ? 1.6 : 0);
export const stairFoot = (l) => P5(l, 0.45, 1.95);
export const stairTop = (l) => P5(l, 0.45, 0.3);

export function placeH(l, h) {
  h.spot = null;
  h.sofa = null;
  const z = takeSpot(l, h);
  h.x = z[0];
  h.y = z[1];
  h._path = [];
  h._pi = 0;
  h._wait = rnd(0, 4);
  h._ph = 0;
  h.lift = restLift(l, h);
  h.sit = h.lift > 0;
}

export function toutZone(l) {
  const d = l.doors[0];
  return l.f[0] === 'x'
    ? [d.out[0] + rnd(-0.2, 0.2), d.out[1] + rnd(-6.5, 6.5)]
    : [d.out[0] + rnd(-6.5, 6.5), d.out[1] + rnd(-0.2, 0.2)];
}

export function mZone(l) {
  const d = l.doors[0];
  return l.f[0] === 'x'
    ? [d.out[0] + rnd(-0.2, 0.2), d.out[1] + rnd(-1.2, 1.2)]
    : [d.out[0] + rnd(-1.2, 1.2), d.out[1] + rnd(-0.2, 0.2)];
}

export function bouncerZone(l, idx = 0) {
  const d = l.doors[0];
  const off = idx === 0 ? -0.9 : 0.9;
  return l.f[0] === 'x'
    ? [d.out[0] + (l.f === 'xMax' ? 0.35 : -0.35), d.out[1] + off]
    : [d.out[0] + off, d.out[1] + (l.f === 'yMax' ? 0.35 : -0.35)];
}

export function placeM(l, m) {
  const z = mZone(l);
  m.x = z[0];
  m.y = z[1];
  m._path = [];
  m._pi = 0;
  m._wait = rnd(0, 3);
  m._ph = 0;
}

export function placeBouncer(l, b, idx = 0) {
  const z = bouncerZone(l, idx);
  b.x = z[0];
  b.y = z[1];
  b._path = [];
  b._pi = 0;
  b._wait = rnd(0, 4);
  b._ph = 0;
  b._chase = 0;
}

export function buildRivalStaff(l) {
  l.hs = [];
  for (let i = 0; i < l.hn; i++) {
    const h = mkHostess(5);
    h.state = 'idle';
    h.with = null;
    l.hs.push(h);
    placeH(l, h);
  }
  l.touts = [];
  if (l.mode === 'agg') {
    const count = clamp(G.rival[l.i]?.touts || 1, 1, 2);
    for (let i = 0; i < count; i++) {
      const t = { hair: pick(HAIRS), skin: pick(SKINS), _path: [], _pi: 0, _wait: rnd(0, 3), _ph: 0 };
      const z = toutZone(l);
      t.x = z[0];
      t.y = z[1];
      l.touts.push(t);
    }
  }
}

export function resetBarDay(l) {
  l.today = {
    stolen: 0,
    bounced: 0,
    drink: 0,
    hfee: 0,
    cogs: 0,
    guests: 0,
    turned: 0,
    nohost: 0,
    roomfull: 0,
    nolike: 0,
    hours: 0,
    newRegs: 0,
    champagnes: 0,
    fine: 0,
    by: { local: 0, tai: 0, cn: 0 },
  };
  l.roomsUsed = 0;
  l.dj = false;
  l.trainedToday = false;
  l.skills = l.skills || {
    happyHour: { activeUntil: 0, cdUntil: 0 },
    showtime: { activeUntil: 0, cdUntil: 0 },
    lowProfile: { activeUntil: 0, cdUntil: 0 },
  };
  Object.values(l.skills).forEach((s) => {
    s.activeUntil = 0;
    s.cdUntil = 0;
  });
  l.hostesses.forEach((h) => {
    h.with = null;
    h.todayH = 0;
    h.todayFee = 0;
    h.worked = false;
    h.traits = h.traits || [];
    h.loyalUntil = h.loyalUntil || 0;
    if (h.returnUntil && h.returnUntil > T0 && onDuty(h)) {
      h.state = 'out';
      h.until = Math.min(T_OPEN, h.returnUntil);
      h.hidden = true;
    } else {
      h.state = 'idle';
      h.until = 0;
      h.returnUntil = 0;
      h.hidden = !onDuty(h);
    }
  });
}

export function createInitialState() {
  return {
    goal: 0,
    ev: {},
    newRivals: {},
    rival: {},
    defDay: 0,
    day: 1,
    t: T0,
    money: 30000,
    speed: 1,
    flyers: false,
    spent: 0,
    best: 0,
    mine: {},
    regs: [],
    tab: 'run',
    streetTab: 'empty',
    girlSub: 'roster',
    history: [],
    achievements: [],
    stats: {
      totalChampagne: 0,
      totalBounced: 0,
      totalVipsOk: 0,
      totalBuyouts: 0,
      totalEventsOk: 0,
      totalRaidsDodged: 0,
    },
    poachedToday: false,
    liveEvent: null,
    nextLiveAt: T_RIVAL + 55,
    liveEventsToday: 0,
    mk: {
      scouts: [mkScout(), mkScout(), mkScout()],
      mkts: [mkMkt(), mkMkt(), mkMkt()],
      bouncers: [mkBouncer(), mkBouncer()],
    },
  };
}

export function runtime(scheduleRegsFn) {
  G.lots = buildLots(G);
  Object.keys(G.mine).forEach((k) => {
    const l = G.lots[+k];
    if (!l || l.kind !== 'empty') {
      // Check if bought-out rival
      if (!l || !G.mine[k].boughtOut) {
        delete G.mine[k];
        return;
      }
    }
    const saved = G.mine[k];
    const baseRent = saved.baseRent || l.rent || Math.round((l.L * l.D * 26) / 10) * 10;
    Object.assign(l, saved);
    l.kind = 'mine';
    l.concept = l.concept || 'bintang';
    l.menu = l.menu || {};
    l.bouncers = l.bouncers || [];
    l.ac = l.accent || CONCEPTS[l.concept]?.accent || ACCENTS[0];
    l.fl = '#D8CDB8';
    l.loc = saved.loc || l.loc || 1.15;
    l.baseRent = baseRent;
    l.rent = Math.round((baseRent * (l.rentMul || 1)) / 10) * 10;
    G.mine[k] = l;
    resetBarDay(l);
  });

  G.rival = G.rival || {};
  G.lots.forEach((l) => {
    if (l.kind !== 'rival') return;
    const r = G.rival[l.i] || (G.rival[l.i] = { mode: R() < 0.5 ? 'agg' : 'con', hn: 3 + ((R() * 3) | 0), touts: 1, q: rnd(0.3, 0.8), pm: 1 });
    const maxHn = Math.min(12, 5 + Math.floor(((G.day || 1) - 1) / 4));
    r.hn = clamp(r.hn || 4, 3, maxHn);
    l.mode = r.mode;
    l.hn = r.hn;
  });

  G.lots.forEach((l) => {
    l._g = [];
    l._taken = {};
    l._seats = null;
    l._els = null;
    l._spots = null;
    l._spotT = {};
    l._sofaH = {};
  });

  bars().forEach((l) => {
    l.hostesses.forEach((h) => {
      if (h.state === 'out' && onDuty(h)) {
        h.hidden = true;
        const o = l.doors[0]?.out || [l.x0, l.y0];
        h.x = o[0];
        h.y = o[1];
      } else if (onDuty(h)) {
        placeH(l, h);
      }
    });
    l.mkts.forEach((m) => placeM(l, m));
    l.bouncers.forEach((b, idx) => placeBouncer(l, b, idx));
  });

  G.lots.forEach((l) => {
    if (l.kind === 'rival') buildRivalStaff(l);
  });

  G.peds = [];
  G.cars = [];
  G.fx = [];
  G.particles = [];
  GROUPS.clear();
  G._acc = 0;
  G._cacc = 0;
  G.modal = false;
  G.view = G.view ?? null;
  G.liveEvent = null;
  G.liveEventsToday = 0;
  G.nextLiveAt = T_RIVAL + rnd(45, 95);

  const cc = ['#E9E3D6', '#3F4A5A', '#C8574B', '#6E7F8A', '#B5B0A6', '#2F261E', '#8A2F2F', '#9EC06A'];
  G.park = [];
  [-7.9, -5.1].forEach((x) => {
    for (let k = 0; k < 11; k++) {
      const y = 11.6 + k * 1.25;
      const r = R();
      if (r < 0.62) G.park.push({ t: 'car', x, y, c: pick(cc) });
      else if (r < 0.8) {
        for (let b = 0; b < 3; b++) G.park.push({ t: 'bike', x: x - 0.6 + b * 0.6, y, c: pickC(b + k) });
      }
    }
  });

  if (scheduleRegsFn) scheduleRegsFn();
}

export function newGame(scheduleRegsFn) {
  G = createInitialState();
  runtime(scheduleRegsFn);
  return G;
}

const HF = [
  'id', 'name', 'body', 'looks', 'att', 'pers', 'ps', 'hair', 'skin', 'dress',
  'reviews', 'wage', 'en', 'mood', 'pop', 'on', 'streak', 'hs', 'lt', 'pr', 'refused',
  'raiseAsk', 'sick', 'traits', 'loyalUntil', 'returnUntil',
];

const pickF = (o, f) => {
  const r = {};
  f.forEach((k) => { if (o[k] !== undefined) r[k] = o[k]; });
  return r;
};

function getStorage() {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage; } catch (_) { return null; }
}

export function save() {
  const ls = getStorage();
  if (!ls || !G) return;
  try {
    const mine = {};
    Object.keys(G.mine).forEach((k) => {
      const l = G.mine[k];
      mine[k] = {
        name: l.name,
        accent: l.accent,
        concept: l.concept || 'bintang',
        menu: l.menu || {},
        boughtOut: !!l.boughtOut,
        customLay: l.customLay || null,
        cost: l.cost,
        baseRent: l.baseRent || l.rent,
        rent: l.rent,
        loc: l.loc,
        price: l.price,
        decor: l.decor,
        seats: l.seats,
        rooms: l.rooms,
        sign: l.sign,
        rep: l.rep,
        req: l.req,
        wk: l.wk || 0,
        rentMul: l.rentMul || 1,
        star: !!l.star,
        hostesses: l.hostesses.map((h) => pickF(h, HF)),
        cands: (l.cands || []).map((h) => pickF(h, HF)),
        scouts: l.scouts,
        mkts: l.mkts.map((m) => pickF(m, ['id', 'name', 'ab', 'wage', 'hair', 'skin'])),
        bouncers: (l.bouncers || []).map((b) => pickF(b, ['id', 'name', 'ab', 'wage', 'hair', 'skin'])),
      };
    });
    ls.setItem(
      'kotaindah_v2',
      JSON.stringify({
        day: G.day,
        money: G.money,
        best: G.best,
        mine,
        regs: G.regs.map((r) => pickF(r, ['id', 'type', 'bar', 'n', 'pers', 'days', 'daily', 'pr', 'hid'])),
        mk: G.mk,
        tab: G.tab,
        rival: G.rival,
        defDay: G.defDay,
        goal: G.goal,
        ev: G.ev,
        newRivals: G.newRivals,
        lastRank: G.lastRank,
        bestRank: G.bestRank,
        ramadanDone: G.ramadanDone,
        history: G.history || [],
        achievements: G.achievements || [],
        stats: G.stats || {},
      }),
    );
  } catch (_) {}
}

export function load(scheduleRegsFn) {
  const ls = getStorage();
  if (!ls) return false;
  try {
    let raw = ls.getItem('kotaindah_v2');
    if (!raw) raw = ls.getItem('kotaindah7'); // Seamless legacy save migration
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!s || !s.mine) return false;
    const mk = s.mk || {};
    if (!mk.bouncers) mk.bouncers = [mkBouncer(), mkBouncer()];
    G = Object.assign(createInitialState(), {
      goal: s.goal || 0,
      ev: s.ev || {},
      newRivals: s.newRivals || {},
      lastRank: s.lastRank,
      bestRank: s.bestRank,
      ramadanDone: s.ramadanDone,
      rival: s.rival || {},
      defDay: s.defDay || 0,
      day: s.day,
      t: T0,
      money: s.money,
      speed: 1,
      flyers: false,
      spent: 0,
      best: s.best || 0,
      mine: s.mine,
      regs: s.regs || [],
      mk,
      tab: s.tab || 'run',
      history: s.history || [],
      achievements: s.achievements || [],
      stats: Object.assign(createInitialState().stats, s.stats || {}),
    });
    runtime(scheduleRegsFn);
    return true;
  } catch (_) {
    return false;
  }
}
