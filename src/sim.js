import {
  BARPAL, COGS, COMM, CONCEPTS, CT, FEE, GOALS, GX, HAIRS, HOURFEE, Lw, NEWBARS,
  PKG, ROOMS, SKINS, SX, T0, T_END, T_LAST, T_OPEN, T_RIVAL, TIER, TIERB, WD, WMUL,
  YA, YB, MIN_SEC, R, activeH, clamp, effAtt, esc, fm, onDuty, pick, rnd, tierOf, uid, wday, where,
} from './config.js';
import { AU, dayTrack } from './audio.js';
import {
  DOORS_BY_STREET, G, GROUPS, allH, bars, bouncerZone, cap, claimSeat, freeSpot,
  hGo, load, mkBouncer, mkHostess, mkMkt, mkScout, mZone, newGame, placeBouncer, placeH, placeM,
  registerGroupPed, restLift, runtime, save, scoutDay, seatList, stairFoot, stairTop, takeSpot,
  toutZone, unregisterGroupPed,
} from './state.js';

let hooks = {
  toast: () => {},
  onEndDay: () => {},
  onBrief: () => {},
  onPanel: () => {},
  onLiveEvent: () => {},
  onGoal: () => {},
  onChampagne: () => {},
  onAchievement: () => {},
};

export function setSimHooks(nextHooks) {
  hooks = Object.assign(hooks, nextHooks);
}

/* ---------- Zero-GC In-place Compaction ---------- */
export function compactInPlace(arr, keepFn, onRemove) {
  let w = 0;
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    if (keepFn(item)) {
      arr[w++] = item;
    } else if (onRemove) {
      onRemove(item);
    }
  }
  arr.length = w;
}

/* ---------- Economy & Probability Math ---------- */
export const hasTrait = (h, tid) => !!(h.traits && h.traits.includes(tid));
export const conceptOf = (l) => CONCEPTS[(l && l.concept) || 'bintang'] || CONCEPTS.bintang;

export function skillActive(l, id) {
  return !!(l && l.skills && l.skills[id] && G.t < l.skills[id].activeUntil);
}

export const barCogs = (l) => conceptOf(l).cogs;
export const fair = (l) => 30 + 8 * l.decor + (l.dj ? 5 : 0);

export function dimSum(arr, f) {
  if (!arr || !arr.length) return 0;
  const v = arr.map(f).sort((a, b) => b - a);
  const w = [1, 0.7, 0.5, 0.35, 0.25, 0.2];
  let sum = 0;
  for (let i = 0; i < v.length && i < w.length; i++) sum += v[i] * w[i];
  return sum;
}

export const mktPower = (l) => dimSum(l.mkts, (m) => m.ab);
export const priceF = (l) => clamp(1.6 - (0.8 * l.price) / fair(l), 0.08, 1.3);

export function enterProb(l, ct) {
  if (skillActive(l, 'lowProfile')) return 0;
  if (G.t < (l.lockUntil || 0)) return 0;
  const hs = l.hostesses.filter((h) => onDuty(h) && h.state !== 'gone');
  let match = 0;
  let aceBonus = 0;
  for (let i = 0; i < hs.length; i++) {
    if (hs[i].body === CT[ct].body) match++;
    if (hasTrait(hs[i], 'ace')) aceBonus += 0.06;
  }
  const appeal = hs.length ? 1 + 0.05 * Math.min(8, match) : 0.5;
  const cMul = conceptOf(l).enterMul[ct] || 1;
  const happyMul = skillActive(l, 'happyHour') ? 1.35 : 1;
  const achMul = G.achievements?.includes('first_star') ? 1.03 : 1;
  const base =
    0.05 +
    0.03 * l.decor +
    0.025 * l.sign +
    0.012 * mktPower(l) +
    (l.rep - 3) * 0.05 +
    (l.dj ? 0.06 : 0) +
    0.008 * Math.min(10, hs.length) +
    aceBonus;
  return clamp(
    base * appeal * l.loc * priceF(l) * (ct === 'local' ? 1.1 : 1) * (l.star ? 1.15 : 1) * cMul * happyMul * achMul,
    0,
    0.88,
  );
}

export const seated = (l) => l._g.filter((p) => p.st === 'sit').length;

export function buzz() {
  let b = 1;
  bars().forEach((l) => {
    const signMul = conceptOf(l).buzzMul || 1;
    b += 0.06 * l.sign * signMul + 0.03 * mktPower(l) + Math.max(0, l.rep - 3) * 0.05 + (l.dj ? 0.3 : 0);
  });
  if (G.flyers) b += 0.4;
  if (G.ev && G.ev.bloggerBoost) b += 0.35;
  return b;
}

export const barOpen = () => G.t >= T_OPEN && G.t < T_END;
export const lit = (l) => {
  if (l.kind === 'mine') return barOpen() && !skillActive(l, 'lowProfile');
  return (l.kind === 'shop' || l.kind === 'rival') && G.t >= l.open[0] && G.t < l.open[1];
};

export function trafMul() {
  const e = G.ev || {};
  const rainMul = e.rain ? (G.achievements?.includes('rain_survivor') ? 0.65 : 0.55) : 1;
  return WMUL[wday(G.day)] * rainMul * (e.holiday ? 1.25 : 1) * (e.ramadan ? 0.5 : 1) * (e.payday ? 1.2 : 1);
}

export function evList() {
  const e = G.ev || {};
  const o = [];
  if (e.rain) o.push(['下雨', '今晚客流减半左右', '#5B7FA6']);
  if (e.holiday) o.push(['节日', `台客中客翻倍，客流 ×1.25（还剩 ${e.holiday} 天）`, '#B0457F']);
  if (e.ramadan) o.push(['斋月', `客流大减，土著很少出来（还剩 ${e.ramadan} 天）`, '#3F8F7B']);
  if (e.payday) o.push(['工厂发薪', '土著更多、更舍得花', '#D9A441']);
  if (e.bloggerBoost) o.push(['探店爆火', '昨晚探店博主发帖，今晚全街人气 +35%', '#E8B959']);
  if (e.razia && e.rumor && !e.raziaDone) o.push(['有风声', '今晚可能有警察临检', '#B5362F']);
  return o;
}

export function checkGoals() {
  const got = [];
  const bs = bars();
  while (G.goal < GOALS.length && GOALS[G.goal].ok(G, bs)) {
    const g = GOALS[G.goal];
    G.money += g.r;
    got.push(g);
    G.goal++;
  }
  if (got.length) {
    AU.sfx('achievement');
    got.forEach((g) => {
      hooks.toast(`目标完成：${g.t}，奖励 ${fm(g.r)}`);
      hooks.onGoal(g);
    });
  }
  return got;
}

export function choiceScore(p, h) {
  const body = h.body === CT[p.ctype].body ? h.bs : h.bs * 0.45;
  const pers = h.pers === p.prefPers ? h.ps : h.ps * 0.5;
  const poly = hasTrait(h, 'polyglot') && (p.ctype === 'tai' || p.ctype === 'cn') ? 1.4 : 0;
  return 0.4 * body + 0.35 * h.looks + 0.25 * pers + (h.pop != null ? TIERB[tierOf(h)] : 0) + poly;
}

export function finalSat(p, h, l) {
  const platterB = l.menu && l.menu.platter ? 0.4 : 0;
  const singerB = p.act === 'room' && hasTrait(h, 'singer') ? 0.6 : 0;
  return clamp(
    0.75 * choiceScore(p, h) + 0.25 * effAtt(h) + 0.15 * l.decor + platterB + singerB + (p.act === 'room' && l.dj ? 0.4 : 0) - (p.waited ? 0.6 : 0) - (h.att < 4 ? 0.8 : 0),
    0,
    10,
  );
}

export function choosePkg(p, c, l) {
  const r = R();
  const late = T_END - G.t < 200;
  let k;
  const allBoost = conceptOf(l).allInMul || 1;
  if (p.ctype === 'local') k = c < 6 ? 'h1' : c < 7.5 ? (r < 0.3 ? 'h3' : 'h1') : r < 0.12 * allBoost ? 'all' : r < 0.55 ? 'h3' : 'h1';
  else if (p.ctype === 'tai') k = c < 5.8 ? (r < 0.5 ? 'h1' : 'h3') : c < 7.2 ? (r < 0.7 ? 'h3' : 'all') : r < 0.65 * allBoost ? 'all' : 'h3';
  else k = c < 6 ? (r < 0.5 ? 'h1' : 'h3') : c < 7.5 ? (r < 0.3 ? 'h1' : r < 0.75 ? 'h3' : 'all') : r < 0.15 ? 'h1' : r < 0.5 ? 'h3' : 'all';
  if (k === 'all' && late) k = 'h3';
  return PKG[k];
}

/* ---------- Pedestrian & Customer Simulation ---------- */
export function spawnRate() {
  const h = G.t / 60;
  return (h < 17 ? 0.25 : h < 19 ? 0.5 : h < 23 ? 0.85 : h < 25 ? 0.7 : 0.35) * trafMul();
}

export function pickType() {
  const e = G.ev || {};
  const w = {
    local: 0.62 * (e.ramadan ? 0.3 : 1) * (e.payday ? 1.5 : 1),
    tai: 0.23 * (e.holiday ? 2 : 1),
    cn: 0.15 * (e.holiday ? 2 : 1),
  };
  const t = w.local + w.tai + w.cn;
  const r = R() * t;
  return r < w.local ? 'local' : r < w.local + w.tai ? 'tai' : 'cn';
}

const maxVisits = (ct) => (ct === 'cn' ? (R() < 0.5 ? 2 : 1) : 1);

export function mkPed(route, ct, extra) {
  const t = CT[ct];
  return Object.assign(
    {
      x: route[0][0],
      y: route[0][1],
      route,
      ri: 1,
      sp: rnd(0.7, 1.05),
      st: 'walk',
      ph: R() * 6,
      ctype: ct,
      prefPers: R() < 0.5 ? 'intro' : 'extro',
      shirt: pick(t.shirts),
      hair: pick(HAIRS),
      skin: pick(SKINS),
      f: false,
      thirst: rnd(0.5, 1.5) * (G.t > 23 * 60 ? 1.15 : 1),
      seen: {},
      bub: 0,
      visits: 0,
      maxV: maxVisits(ct),
      pi: 0,
    },
    extra || {},
  );
}

export function uRoute(sx, ys, o, xn, st, ye2) {
  const j = rnd(-0.2, 0.2);
  const yw = (o ? 28.6 : 25.4) + j;
  const ye = (o ? 7.4 : 10.6) - j;
  return [[sx, ys], [sx, yw, 5], [xn + j, yw, 1], [xn + j, ye, st], [sx, ye, 0], [sx, ye2, 5]];
}

function chooseTargets(n) {
  const S = G.lots
    .filter((l) => l.kind === 'mine' || l.kind === 'rival')
    .map((l) => {
      let sc;
      if (l.kind === 'mine') {
        const hs = activeH(l);
        const sl = hs.filter((h) => h.body === 'slim').length;
        sc = 1.2 * (hs.length ? sl / hs.length : 0) * Math.min(1, hs.length / 8) + (l.rep - 1) / 4 + 0.15 * l.decor + (l.dj ? 0.3 : 0);
      } else {
        const sl = l.hs.filter((h) => h.body === 'slim').length;
        sc = 1.2 * (sl / Math.max(1, l.hs.length)) + (G.rival[l.i].q || 0.5) + (l.mode === 'agg' ? 0.25 : 0);
      }
      return { i: l.i, sc: sc + rnd(0, 0.6) };
    })
    .sort((a, b) => b.sc - a.sc);
  return S.slice(0, n).map((x) => x.i);
}

function lap2(trip, sx) {
  const T = trip.targets.map((i) => G.lots[i]);
  const j = trip.j;
  const yw = (trip.o ? 28.6 : 25.4) + j;
  const ye = (trip.o ? 7.4 : 10.6) - j;
  const s4 = T.some((l) => l.doors.some((d) => d.st === 4) && !l.doors.some((d) => d.st < 2));
  const xn = (s4 ? -9.4 : -0.4) + j;
  const r = [[sx, yw, 5], [xn, yw, 1], [xn, ye, s4 ? 4 : 2], [sx, ye, 0]];
  if (T.some((l) => l.doors[0].st === 3)) r.push([48.2, ye, 0], [48.2, yw, 3], [sx, yw, 1]);
  r.push([sx, trip.yEnd, 5]);
  return r;
}

function startLap2(p) {
  const t = p.trip;
  if (!t.targets) t.targets = chooseTargets(t.n);
  p.tl = t.targets.slice();
  p.route = p.route.concat(lap2(t, p.route[0][0]));
  p.lap2 = true;
  p.done = false;
}

export function spawnPed() {
  const fromW = R() < 0.5;
  const sx = GX + 0.45 + rnd(-0.2, 0.2);
  const ys = fromW ? YB + 0.5 : YA - 0.5;
  const ye2 = R() < 0.5 ? YA - 0.5 : YB + 0.5;
  const r = R();
  const ct = pickType();
  let route;
  let trip = null;
  const n = pick(CT[ct].grp);
  const gid = n > 1 ? uid() : null;
  const sp = rnd(0.7, 1.05);

  if (ct === 'tai') {
    trip = { n: R() < 0.5 ? 2 + (R() < 0.5 ? 1 : 0) : 5 + (R() < 0.5 ? 1 : 0), o: R() < 0.5, j: rnd(-0.2, 0.2), yEnd: ye2, targets: null };
    if (G.t < 22 * 60) {
      const yw = (trip.o ? 28.6 : 25.4) + trip.j;
      const ye = (trip.o ? 7.4 : 10.6) - trip.j;
      const xn = pick([-0.4, -3.6, -9.4]);
      route = [[sx, ys], [sx, yw, 5], [xn, yw, 1], [xn, ye, xn > -6 ? 2 : 4], [sx, ye, 0], [sx, yw, 5]];
    } else {
      route = [[sx, ys]];
    }
  } else if (r < 0.86) {
    const o = R() < 0.5;
    let xn;
    let st;
    if (r < 0.3) {
      xn = R() < 0.5 ? 47.9 : 51.1;
      st = 3;
    } else {
      xn = pick([-0.4, -3.6, -0.4, -3.6, -9.4, -12.6]);
      st = xn > -6 ? 2 : 4;
    }
    route = uRoute(sx, ys, o, xn, st, ye2);
  } else {
    route = [[sx, ys], [sx, fromW ? YA - 0.5 : YB + 0.5, 5]];
  }

  for (let i = 0; i < n; i++) {
    const rt = route.map((q) => q.slice());
    rt[0][1] += (fromW ? 1 : -1) * 0.7 * i;
    const p = mkPed(rt, ct, { gid, sp, trip });
    if (trip) {
      p.done = true;
      if (route.length === 1) startLap2(p);
    }
    G.peds.push(p);
    registerGroupPed(p);
  }
}

export function scheduleRegs() {
  if (G.defDay !== G.day) {
    G.defDay = G.day;
    G.defect = 0;
    G.regs = G.regs.filter((r) => {
      const b = G.lots[r.bar];
      if (!b || b.kind !== 'mine') return true;
      const o = b.doors[0].out;
      const n = G.lots.filter((x) => x.kind === 'rival' && x.mode === 'agg' && Math.hypot(x.doors[0].out[0] - o[0], x.doors[0].out[1] - o[1]) < 16).length;
      if (n && R() < Math.min(0.25, 0.06 * n)) {
        G.defect++;
        return false;
      }
      return true;
    });
  }
  G.regs.forEach((r) => {
    r._at = null;
    r._came = false;
    r._miss = false;
    if (!G.mine[r.bar]) return;
    if (r.daily && R() > r.pr) return;
    const a = r.type === 'local' ? rnd(17.5, 22.5) : r.type === 'tai' ? rnd(19, 23.5) : rnd(18.5, 23);
    r._at = a * 60;
  });
}

export function spawnVip(v) {
  const l = G.lots[v.bar];
  if (!l || l.kind !== 'mine') return;
  AU.sfx('notification-ding');
  const fake = { bar: v.bar, id: 'vip' + G.day };
  const st = l.doors.map((d) => d.st).find((s) => s >= 2) ?? l.st;
  const o = R() < 0.5;
  const sx = GX + 0.45;
  const xn = st === 3 ? 47.9 : st === 4 ? -9.4 : -0.4;
  const route = uRoute(sx, 30.5, o, xn, st === 3 ? 3 : st === 4 ? 4 : 2, YA - 0.5);
  for (let i = 0; i < v.n; i++) {
    const rt = route.map((q) => q.slice());
    rt[0][1] += 0.7 * i;
    const p = mkPed(rt, v.type, { gid: fake.id, sp: 0.9, reg: fake, vip: v, thirst: 1.3, shirt: '#2F261E' });
    G.peds.push(p);
    registerGroupPed(p);
  }
  // Spawn visual VIP luxury car arriving at the gate
  G.cars.push({
    x: 54.6,
    y: 32,
    sp: 3.1,
    moto: false,
    vipCar: true,
    c: '#18151B',
    route: [[54.6, 26.8], [GX - 0.5, 26.8], [GX - 0.5, 18], [54.6, 9.4], [54.6, YA - 1.5]],
    ri: 0,
  });
}

export function spawnReg(r) {
  const l = G.lots[r.bar];
  if (!l || l.kind !== 'mine') return;
  const st = l.doors.map((d) => d.st).find((s) => s >= 2) ?? l.st;
  const o = R() < 0.5;
  const sx = GX + 0.45;
  const xn = st === 3 ? 47.9 : st === 4 ? -9.4 : -0.4;
  const route = uRoute(sx, 30.5, o, xn, st === 3 ? 3 : st === 4 ? 4 : 2, R() < 0.5 ? YA - 0.5 : YB + 0.5);
  const gid = r.n > 1 ? r.id : null;
  const sp = rnd(0.8, 1.05);
  for (let i = 0; i < r.n; i++) {
    const rt = route.map((q) => q.slice());
    rt[0][1] += 0.7 * i;
    const p = mkPed(rt, r.type, { gid, sp, reg: r, prefPers: r.pers, thirst: 1.2 });
    G.peds.push(p);
    registerGroupPed(p);
  }
}

export function bubble(p, t, c) {
  p.bub = 6;
  p.bt = t;
  p.bc = c;
}

function setPedPath(p, path, then) {
  p.path = path;
  p.pi = 0;
  p.then = then;
}

export function freeSeat(p, l) {
  if (p.seat != null) {
    delete l._taken[p.seat];
    p.seat = null;
  }
}

const afterVisit = (p) => {
  p.visits++;
  p.done = p.tl ? !p.tl.length || G.t > T_LAST : p.visits >= p.maxV;
};

export function leaveBar(p, fromRoom) {
  const l = G.lots[p.bar];
  freeSeat(p, l);
  const i = l._g.indexOf(p);
  if (i >= 0) l._g.splice(i, 1);
  p.st = 'path';
  setPedPath(p, [...(fromRoom ? [stairFoot(l)] : []), p.door.in, p.door.out, p.home], 'resume');
  p.bar = null;
  p.hidden = false;
  afterVisit(p);
}

export function leaveRival(p) {
  const l = G.lots[p.bar];
  if (p.rh) {
    const h = p.rh;
    h.state = 'idle';
    h.with = null;
    hGo(h, [takeSpot(l, h)], 'home');
    p.rh = null;
  }
  freeSeat(p, l);
  const idx = l._g.indexOf(p);
  if (idx >= 0) l._g.splice(idx, 1);
  p.st = 'path';
  setPedPath(p, [p.door.in, p.door.out, p.home], 'resume');
  p.bar = null;
  afterVisit(p);
}

const sideOf = (l, p) => {
  const S = seatList(l)[p.seat];
  return [S.x + 0.25, S.y - 0.25, S.lift];
};

function seatRival(q, l, d, free) {
  const S = seatList(l);
  const si = free.splice((R() * free.length) | 0, 1)[0];
  claimSeat(l, si, q);
  l._g.push(q);
  q.bar = l.i;
  q.seat = si;
  q.door = d;
  q.home = [q.x, q.y];
  q.done = true;
  q.st = 'path';
  setPedPath(q, [d.out, d.in, [S[si].x, S[si].y]], 'sit');
}

export function raid() {
  const e = G.ev;
  e.raziaDone = true;
  G.raidUntil = G.t + 60;
  let fine = 0;
  let dodgedCount = 0;
  const achReduce = G.achievements?.includes('raid_dodge') ? 0.85 : 1;

  G.lots.forEach((l) => {
    if (l.kind !== 'mine' && l.kind !== 'rival') return;
    if (l.kind === 'mine' && skillActive(l, 'lowProfile')) {
      // Dodged! Low fee only, no kickout
      const smallFine = Math.round((1500 + 100 * activeH(l).length) * 0.15 * achReduce);
      l.today.fine = (l.today.fine || 0) + smallFine;
      fine += smallFine;
      dodgedCount++;
      G.stats.totalRaidsDodged = (G.stats.totalRaidsDodged || 0) + 1;
      return;
    }
    l.lockUntil = G.t + 60;
    l._g.slice().forEach((p) => {
      if (l.kind === 'rival') {
        if (p.st === 'sit' || p.st === 'path') leaveRival(p);
        return;
      }
      const h = p.host;
      if (h && h.with === p) {
        h.state = 'idle';
        h.with = null;
        h.hidden = false;
        if (p.phase === 'room') {
          l.roomsUsed = Math.max(0, l.roomsUsed - 1);
          const t = stairTop(l);
          h.x = t[0];
          h.y = t[1];
        }
        hGo(h, [takeSpot(l, h)], 'home');
      }
      if (p.st === 'room' || p.phase === 'room') {
        const t = stairTop(l);
        p.x = t[0];
        p.y = t[1];
      }
      p.hidden = false;
      p.done = true;
      leaveBar(p, false);
      p.done = true;
    });
    if (l.kind === 'mine') {
      const f = Math.round((1500 + 100 * activeH(l).length) * achReduce);
      l.today.fine = (l.today.fine || 0) + f;
      fine += f;
    }
  });

  G.money -= fine;
  AU.sfx('warning-buzz');
  if (typeof setTimeout !== 'undefined') {
    setTimeout(() => AU.sfx('warning-buzz'), 420);
    setTimeout(() => AU.sfx('warning-buzz'), 840);
  }
  if (dodgedCount > 0) {
    hooks.toast(`拉闸避风头生效！成功躲过临检清场，仅罚 ${fm(fine)}`);
  } else {
    hooks.toast(`警察临检！店铺清场一小时${fine ? `，被罚 ${fm(fine)}` : ''}`);
  }
}

function getGroupWalkers(p, lotIdx) {
  if (!p.gid) return [p];
  const members = GROUPS.get(p.gid);
  if (!members) return [p];
  const out = [];
  for (let i = 0; i < members.length; i++) {
    const q = members[i];
    if (q.st === 'walk' && !q.done && (!q.tl || q.tl.includes(lotIdx))) {
      out.push(q);
    }
  }
  return out.length ? out : [p];
}

export function consider(p, l, d) {
  const far = Math.hypot(p.x - d.out[0], p.y - d.out[1]) > 2 ? 0.6 : 1;
  if (l.kind === 'shop') {
    if (lit(l) && !p.reg && !p.gid && R() < l.visit * far) {
      p.home = [p.x, p.y];
      p.shop = l.i;
      p.door = d;
      p.st = 'path';
      setPedPath(p, [d.out, d.in, Lw(l, rnd(0.6, l.L - 0.8), rnd(0.8, l.D - 1))], 'browse');
      p.tm = rnd(6, 18);
    }
    return;
  }
  if (l.kind !== 'mine' && l.kind !== 'rival') return;
  if (G.t < (l.kind === 'mine' ? T_OPEN : T_RIVAL) || G.t > T_LAST) return;

  const grp = getGroupWalkers(p, l.i);
  for (let i = 0; i < grp.length; i++) grp[i].seen[l.i] = 1;

  const forced = p.reg && p.reg.bar === l.i && G.t >= (l.lockUntil || 0);
  let go;
  if (p.reg) go = forced;
  else if (p.tl) go = p.tl.includes(l.i);
  else {
    go =
      R() <
      (l.kind === 'mine'
        ? enterProb(l, p.ctype)
        : G.t < (l.lockUntil || 0)
          ? 0
          : l.pull * 1.3 * (G.rival[l.i].pm || 1) * (l.mode === 'agg' ? 1.5 : 0.7)) *
        p.thirst *
        far;
  }
  if (!go) return;

  for (let i = 0; i < grp.length; i++) {
    if (grp[i].tl) grp[i].tl = grp[i].tl.filter((idx) => idx !== l.i);
  }

  const S = seatList(l);
  const free = [];
  for (let i = 0; i < S.length; i++) if (!l._taken[i]) free.push(i);

  if (l.kind === 'rival') {
    if (free.length >= grp.length) {
      for (let i = 0; i < grp.length; i++) seatRival(grp[i], l, d, free);
    }
    return;
  }

  // Aggressive rival touts attempt to poach walk-in guests; bouncers defend the door!
  if (!forced && !p.tl) {
    const bCount = (l.bouncers || []).length;
    const defMul = bCount >= 2 ? 0.1 : bCount === 1 ? 0.45 : 1;
    for (const r of G.lots) {
      if (r.kind !== 'rival' || r.mode !== 'agg' || G.t < T_RIVAL) continue;
      if (!r.touts.some((t) => Math.hypot(t.x - d.out[0], t.y - d.out[1]) < 6)) continue;
      if (R() >= 0.22) continue;
      if (R() >= defMul) {
        l.today.bounced++;
        G.stats.totalBounced = (G.stats.totalBounced || 0) + 1;
        if (l.bouncers[0]) {
          l.bouncers[0]._chase = 5;
        }
        AU.sfx('pop-bubble', 2200);
        bubble(p, '保安赶走拉客仔', '#3DD6A5');
        break;
      }
      const rf = [];
      seatList(r).forEach((_, i) => { if (!r._taken[i]) rf.push(i); });
      if (rf.length < grp.length) continue;
      for (let i = 0; i < grp.length; i++) seatRival(grp[i], r, r.doors[0], rf);
      bubble(p, `被 ${r.name} 拉走`, '#FF5C54');
      l.today.stolen += grp.length;
      return;
    }
  }

  if (free.length < grp.length) {
    l.today.turned += grp.length;
    l.rep = Math.max(1, l.rep - 0.004);
    bubble(p, '满座', '#A79B8C');
    if (forced) p.reg._miss = true;
    return;
  }

  if (forced) p.reg._came = true;
  for (let i = 0; i < grp.length; i++) {
    const q = grp[i];
    const si = free.splice((R() * free.length) | 0, 1)[0];
    claimSeat(l, si, q);
    l._g.push(q);
    q.bar = l.i;
    q.seat = si;
    q.door = d;
    q.home = [q.x, q.y];
    q.drinks = 0;
    q.done = true;
    q.st = 'path';
    setPedPath(q, [d.out, d.in, [S[si].x, S[si].y]], 'sit');
    l.today.guests++;
    l.today.by[q.ctype]++;
  }
}

export function startSession(p, l, best, pk, act) {
  const hours = pk.h === 99 ? Math.max(1, (T_END - G.t) / 60) : pk.h;
  const feeMul = act === 'room' ? conceptOf(l).roomPriceMul : 1;
  const fee = Math.round(pk.fee * feeMul);
  G.money += fee;
  AU.sfx(pk.h === 99 ? 'coin-double' : 'coin-collect', 500);
  l.today.hfee += fee;
  l.today.hours += hours;
  best.todayH += hours;
  best.todayFee = (best.todayFee || 0) + fee;
  const enCost = hours * (act === 'with' ? 9 : 13) * (hasTrait(best, 'stamina') ? 0.7 : 1);
  best.en = Math.max(0, best.en - Math.min(60, enCost));
  best.pop += Math.round(hours) + (pk.h === 99 ? 3 : 0);
  freeSpot(l, best);
  best.state = act;
  best.with = p;
  best.until = G.t + hours * 60;
  p.host = best;
  p.pkg = pk;
  p.act = act;
  p.tm = hours * 60;
  G.fx.push({ x: p.x, y: p.y, z: 14, t: `+${fee}k`, life: 6, col: '#E8B959' });
  bubble(p, pk.h === 99 ? '买断!' : pk.h === 3 ? '买2送1' : '1 小时', '#E8B959');
  if (act === 'with') {
    p.phase = 'with';
    const s = sideOf(l, p);
    hGo(best, [[s[0], s[1]]], 'sit');
    best.lift = 0;
  } else if (act === 'room') {
    l.roomsUsed++;
    p.phase = 'room';
    freeSeat(p, l);
    p.st = 'path';
    setPedPath(p, [stairFoot(l), stairTop(l)], 'room');
    hGo(best, [stairFoot(l), stairTop(l)], 'hide');
  } else {
    p.phase = 'out';
    const s = finalSat(p, best, l);
    review(p, best, l, s);
    leaveBar(p);
    p.done = true;
    p.tl = null;
    p.withH = best;
    hGo(best, [p.door.in, p.door.out], 'hideOut');
  }
}

function pickHostess(p, l) {
  const idle = l.hostesses.filter((h) => h.state === 'idle' && onDuty(h) && !h.hidden && h.en >= 10);
  if (!idle.length) {
    if (p.phase !== 'wait') {
      p.phase = 'wait';
      p.patience = rnd(25, 40) * (l.menu?.platter ? 1.35 : 1);
      p.waited = true;
      bubble(p, '等公关…', '#A79B8C');
    }
    p.ct = 4;
    return;
  }
  let best = null;
  let bc = -1;
  idle.forEach((h) => {
    const c = choiceScore(p, h) + (p.reg && p.reg.hid === h.id ? 1 : 0);
    if (c > bc) {
      bc = c;
      best = h;
    }
  });
  if (bc < CT[p.ctype].th) {
    p.phase = 'solo';
    p.tm = p.ctype === 'local' ? rnd(30, 60) : rnd(15, 30);
    l.today.nolike++;
    bubble(p, '没合眼缘', '#A79B8C');
    return;
  }
  const pk = choosePkg(p, bc, l);
  const c = CT[p.ctype];
  let act = 'with';
  const showMul = skillActive(l, 'showtime') ? 1.5 : 1;
  const singerMul = hasTrait(best, 'singer') ? 1.3 : 1;
  if (R() < c.room * (l.dj ? 1.35 : 1) * showMul * singerMul) act = 'room';
  else if (pk.h >= 3 && R() < c.out) act = 'out';
  if (act === 'room' && l.roomsUsed >= ROOMS[l.rooms]) {
    bubble(p, '包厢满了', '#FF5C54');
    l.today.roomfull++;
    l.rep = Math.max(1, l.rep - 0.01);
    leaveBar(p);
    return;
  }
  startSession(p, l, best, pk, act);
}

function vipDecide(p, l) {
  const v = p.vip;
  if (v.done) return;
  const mem = G.peds.filter((q) => q.vip === v && q.bar === l.i);
  if (mem.length < v.n || mem.some((q) => q.st !== 'sit')) {
    p.ct = 2;
    return;
  }
  v.done = true;
  const ok = l.hostesses
    .filter((h) => h.state === 'idle' && onDuty(h) && !h.hidden && h.en >= 10 && h.body === v.body && (v.pers === 'any' || h.pers === v.pers))
    .sort((a, b) => choiceScore(p, b) - choiceScore(p, a));
  if (ok.length >= v.n) {
    mem.forEach((q, i) => startSession(q, l, ok[i], PKG.all, 'with'));
    const ktvBonus = conceptOf(l).vipMul || 1;
    const achBonus = G.achievements?.includes('vip_king') ? 1.15 : 1;
    const tip = Math.round(3000 * ktvBonus * achBonus);
    G.money += tip;
    l.today.hfee += tip;
    l.rep = Math.min(5, l.rep + 0.25);
    v.result = 'ok';
    G.stats.totalVipsOk = (G.stats.totalVipsOk || 0) + 1;
    bubble(p, `老板满意！小费 ${fm(tip)}`, '#E8B959');
    hooks.toast(`${v.who} 很满意，额外小费 ${fm(tip)}`);
  } else {
    mem.forEach((q) => {
      q.phase = 'solo';
      q.tm = rnd(5, 12);
    });
    l.rep = Math.max(1, l.rep - 0.3);
    v.result = 'fail';
    bubble(p, '人不够！', '#FF5C54');
    AU.sfx('error-soft-thud');
    hooks.toast(`${v.who} 嫌人不够，没坐多久就走了`);
  }
}

export function review(p, h, l, s) {
  const ea = effAtt(h);
  const t = ea >= 8 ? '服务很贴心' : ea >= 6 ? '挺会聊天' : ea >= 4 ? '一般般' : '态度有点冷';
  h.mood = clamp(h.mood + (s >= 7 ? 2 : s < 4.5 ? -3 : 0), 0, 100);
  h.reviews.unshift(`${CT[p.ctype].cn}：${t}`);
  h.reviews.length = Math.min(3, h.reviews.length);
  const repRate = G.achievements?.includes('champagne_pop') ? 0.075 : 0.06;
  l.rep = clamp(l.rep + (clamp(s * 0.55, 1, 5) - l.rep) * repRate, 1, 5);
  if (s >= 7.5) bubble(p, '♥', '#FF5C54');
  else if (s < 4.5) bubble(p, '不太满意', '#A79B8C');
  const mp = mktPower(l);
  const sweetB = hasTrait(h, 'sweet') ? 0.45 : 0;
  const achB = G.achievements?.includes('first_bar') ? 0.15 : 0;
  if (p.ctype === 'local') {
    if (p.reg && s < 4.8) G.regs = G.regs.filter((r) => r !== p.reg);
    else if (!p.reg && s >= 5.3 - 0.05 * mp - sweetB - achB) {
      G.regs.push({ id: uid(), type: 'local', bar: l.i, n: 1, pers: p.prefPers, daily: true, pr: Math.min(0.85, 0.45 + 0.03 * mp), hid: h.id });
      l.today.newRegs++;
    } else if (p.reg) p.reg.hid = h.id;
  } else if (!p.reg && s >= 5.8 - 0.08 * mp - sweetB - achB) {
    const key = p.gid || uid();
    if (!G.regs.some((r) => r.id === key)) {
      const n = p.gid ? (GROUPS.get(p.gid)?.length || 2) : 1;
      G.regs.push({ id: key, type: p.ctype, bar: l.i, n, pers: p.prefPers, days: p.ctype === 'tai' ? 2 + (R() < 0.5 ? 1 : 0) : 6 + (R() < 0.5 ? 1 : 0), hid: h.id });
      l.today.newRegs++;
    }
  } else if (p.reg) p.reg.hid = h.id;

  // Special menu: champagne tower & whisky upgrades
  if (l.menu?.champagne && (s >= 7.8 || p.pkg?.h === 99) && R() < 0.25) {
    const bonus = 680;
    G.money += bonus;
    l.today.drink += bonus;
    l.today.champagnes++;
    G.stats.totalChampagne = (G.stats.totalChampagne || 0) + 1;
    l.rep = Math.min(5, l.rep + 0.08);
    bubble(p, '🍾 香槟塔!', '#E8B959');
    G.fx.push({ x: p.x, y: p.y, z: 16, t: '+680k 🍾', life: 7, col: '#E8B959' });
    AU.sfx('coin-double');
    hooks.onChampagne(l, p);
  }
}

function endSession(p, l, fromRoom) {
  const h = p.host;
  const s = finalSat(p, h, l);
  const sweetExt = hasTrait(h, 'sweet') ? 0.15 : 0;
  if (p.pkg.h !== 99 && s >= 7.3 && R() < 0.35 + sweetExt && G.t < T_LAST - 60) {
    const fee = Math.round(HOURFEE * (fromRoom ? conceptOf(l).roomPriceMul : 1));
    G.money += fee;
    l.today.hfee += fee;
    l.today.hours++;
    h.todayH++;
    h.todayFee = (h.todayFee || 0) + fee;
    h.until += 60;
    h.en = Math.max(0, h.en - (hasTrait(h, 'stamina') ? 6 : 9));
    h.pop++;
    p.tm = 60;
    p.pkg = PKG.h1;
    bubble(p, '加钟!', '#E8B959');
    AU.sfx('coin-collect', 500);
    G.fx.push({ x: p.x, y: p.y, z: 14, t: `+${fee}k`, life: 6, col: '#E8B959' });
    return;
  }
  if (fromRoom && l.menu?.whisky && R() < 0.35) {
    G.money += 280;
    l.today.drink += 280;
    h.mood = Math.min(100, h.mood + 4);
    G.fx.push({ x: p.x, y: p.y, z: 15, t: '+280k 洋酒', life: 6, col: '#A87CE8' });
  }
  review(p, h, l, s);
  h.state = 'idle';
  h.with = null;
  if (fromRoom) {
    l.roomsUsed = Math.max(0, l.roomsUsed - 1);
    h.hidden = false;
    const t = stairTop(l);
    h.x = t[0];
    h.y = t[1];
    hGo(h, [stairFoot(l), takeSpot(l, h)], 'home');
    p.hidden = false;
    const t2 = stairTop(l);
    p.x = t2[0] + 0.2;
    p.y = t2[1];
  } else {
    hGo(h, [takeSpot(l, h)], 'home');
  }
  leaveBar(p, fromRoom);
}

function mineTick(p, l, dt) {
  if (p.phase !== 'room') {
    p.nd -= dt;
    if (p.nd <= 0) {
      if (p.drinks > 0 && l.price > p.budget && R() < 0.5) {
        p.nd = 30;
        if (p.phase === 'solo') p.tm = 0;
      } else {
        const cogs = barCogs(l);
        let gain = l.price - cogs;
        let rev = l.price;
        let label = `+${l.price}k`;
        if (l.menu?.bucket && p.ctype === 'local' && R() < 0.4) {
          gain += 45;
          rev += 45;
          label = `+${rev}k 🍺`;
        } else if (l.menu?.platter && p.drinks === 0 && R() < 0.5) {
          gain += 60;
          rev += 60;
          label = `+${rev}k 🍍`;
        }
        G.money += gain;
        l.today.drink += rev;
        l.today.cogs += cogs;
        p.drinks++;
        G.fx.push({ x: p.x, y: p.y, z: 12, t: label, life: 4 });
        const drinkMul =
          (p.phase === 'with' ? 0.7 : 1) /
          (conceptOf(l).drinkSpeedMul || 1) /
          (skillActive(l, 'happyHour') ? 1.8 : 1) /
          (p.host && hasTrait(p.host, 'drinker') ? 1.3 : 1);
        p.nd = CT[p.ctype].drink * drinkMul * rnd(0.8, 1.2);
      }
    }
  }
  if (G.t >= T_END - 8) {
    if (p.host && p.host.with === p) {
      if (p.phase === 'room') endSession(p, l, true);
      else {
        p.pkg = PKG.all;
        endSession(p, l, false);
      }
    } else {
      leaveBar(p, p.phase === 'room');
    }
    return;
  }
  if (p.phase === 'choose') {
    p.ct -= dt;
    if (p.ct <= 0) {
      if (p.vip && !p.vip.done) vipDecide(p, l);
      else pickHostess(p, l);
    }
  } else if (p.phase === 'wait') {
    p.patience -= dt;
    p.ct -= dt;
    if (p.ct <= 0) pickHostess(p, l);
    if (p.phase === 'wait' && p.patience <= 0) {
      l.today.nohost++;
      l.rep = Math.max(1, l.rep - 0.01);
      bubble(p, '没人陪', '#A79B8C');
      AU.sfx('error-soft-thud', 2500);
      leaveBar(p);
    }
  } else if (p.phase === 'solo') {
    p.tm -= dt;
    if (p.tm <= 0) leaveBar(p);
  } else if (p.phase === 'with') {
    p.tm -= dt;
    if (p.tm <= 0) endSession(p, l, false);
  }
}

function stepPed(p, dt) {
  if (p.bub > 0) p.bub -= dt;
  if (p.st === 'walk') {
    const g = p.route[p.ri];
    const ox = p.x;
    const oy = p.y;
    const dx = g[0] - p.x;
    const dy = g[1] - p.y;
    const d = Math.hypot(dx, dy);
    const s = p.sp * dt;
    if (d <= s) {
      p.x = g[0];
      p.y = g[1];
      p.ri++;
      if (p.ri >= p.route.length) {
        if (p.trip && !p.lap2) startLap2(p);
        else p.dead = true;
      }
    } else {
      p.x += (dx / d) * s;
      p.y += (dy / d) * s;
    }
    p.ph += s * 7;
    if (!p.done && !p.dead) {
      const st = g[2];
      const candidates = st >= 0 && st < 6 ? DOORS_BY_STREET[st] : null;
      if (candidates) {
        const ax = st >= 2 ? 1 : 0;
        const a = ax ? oy : ox;
        const b = ax ? p.y : p.x;
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        for (let k = 0; k < candidates.length; k++) {
          const { l, dr } = candidates[k];
          if (p.seen[l.i]) continue;
          const v = dr.out[ax];
          if (v >= lo && v <= hi) {
            p.seen[l.i] = 1;
            consider(p, l, dr);
            if (p.st !== 'walk') break;
          }
        }
      }
    }
  } else if (p.st === 'path') {
    const g = p.path[p.pi];
    const dx = g[0] - p.x;
    const dy = g[1] - p.y;
    const d = Math.hypot(dx, dy);
    const s = p.sp * 1.15 * dt;
    if (d <= s) {
      p.x = g[0];
      p.y = g[1];
      p.pi++;
      if (p.pi >= p.path.length) {
        if (p.then === 'sit') {
          p.st = 'sit';
          const l = G.lots[p.bar];
          if (l.kind === 'mine') {
            AU.sfx('message-incoming-pop', 900);
            p.phase = 'choose';
            p.ct = p.vip ? 2 : rnd(10, 22) / (1 + 0.12 * mktPower(l));
            p.nd = rnd(1, 3);
            p.budget = fair(l) * rnd(0.75, 1.6);
          } else {
            p.tm = p.ctype === 'local' ? rnd(30, 60) : p.ctype === 'tai' ? (p.trip && p.trip.n > 3 ? rnd(30, 50) : rnd(45, 75)) : rnd(40, 90);
            G.rival[l.i].wk = (G.rival[l.i].wk || 0) + Math.round((p.tm / 60) * 400 + 60);
            const idle = l.hs.filter((h) => h.state === 'idle');
            if (idle.length && R() < 0.85) {
              const h = pick(idle);
              freeSpot(l, h);
              h.state = 'with';
              h.with = p;
              p.rh = h;
              const sd = sideOf(l, p);
              hGo(h, [[sd[0], sd[1]]], 'sit');
            }
          }
        } else if (p.then === 'room') {
          p.st = 'room';
          p.hidden = true;
        } else if (p.then === 'browse') {
          p.st = 'browse';
        } else {
          p.st = 'walk';
        }
      }
    } else {
      p.x += (dx / d) * s;
      p.y += (dy / d) * s;
      p.ph += s * 7;
    }
    if (p.bar != null && G.lots[p.bar].kind === 'mine' && p.phase === 'room') {
      p.tm -= dt;
    }
  } else if (p.st === 'sit') {
    const l = G.lots[p.bar];
    if (l.kind === 'mine') mineTick(p, l, dt);
    else {
      p.tm -= dt;
      if (p.tm <= 0 || G.t >= T_END - 8) leaveRival(p);
    }
  } else if (p.st === 'room') {
    const l = G.lots[p.bar];
    p.tm -= dt;
    if (p.tm <= 0 || G.t >= T_END - 8) endSession(p, l, true);
  } else if (p.st === 'browse') {
    p.tm -= dt;
    const l = G.lots[p.shop];
    if (p.tm <= 0 || !lit(l)) {
      p.st = 'path';
      setPedPath(p, [p.door.in, p.door.out, p.home], 'resume');
      p.done = true;
    }
  }
}

function stepHostess(l, h, dt) {
  if (!h._path) {
    h._path = [];
    h._pi = 0;
    h._ph = 0;
  }
  if (!onDuty(h) && l.kind === 'mine') return;
  if (h.state === 'out' && h.hidden && G.t >= h.until && h.until < T_END - 10) {
    const d = l.doors[0];
    h.hidden = false;
    h.state = 'idle';
    h.x = d.out[0];
    h.y = d.out[1];
    hGo(h, [d.in, takeSpot(l, h)], 'home');
  }
  if (h._pi < h._path.length) {
    const g = h._path[h._pi];
    const dx = g[0] - h.x;
    const dy = g[1] - h.y;
    const d = Math.hypot(dx, dy);
    const v = 0.85 * dt;
    if (d <= v) {
      h.x = g[0];
      h.y = g[1];
      h._pi++;
      h._wait = rnd(3, 8);
      if (h._pi >= h._path.length) {
        h._path = [];
        h._pi = 0;
        if (h.then === 'sit' && h.with && h.with.seat != null) {
          h.sit = true;
          h.lift = sideOf(l, h.with)[2];
        } else if (h.then === 'home' && restLift(l, h) > 0) {
          h.sit = true;
          h.lift = restLift(l, h);
        } else if (h.then === 'hide') {
          h.hidden = true;
        } else if (h.then === 'hideOut') {
          h.hidden = true;
          h.state = h.until >= T_END - 10 ? 'gone' : 'out';
        }
        h.then = null;
      }
    } else {
      h.x += (dx / d) * v;
      h.y += (dy / d) * v;
      h._ph += v * 7;
    }
  }
}

function stepOneWalker(t, zoneFn, speed, waitMin, waitMax, dt) {
  if (t._chase > 0) t._chase = Math.max(0, t._chase - dt);
  if (t._path.length && t._pi < t._path.length) {
    const g = t._path[t._pi];
    const dx = g[0] - t.x;
    const dy = g[1] - t.y;
    const d = Math.hypot(dx, dy);
    const v = speed * dt;
    if (d <= v) {
      t.x = g[0];
      t.y = g[1];
      t._pi++;
      if (t._pi >= t._path.length) {
        t._path.length = 0;
        t._pi = 0;
        t._wait = rnd(waitMin, waitMax);
      }
    } else {
      t.x += (dx / d) * v;
      t.y += (dy / d) * v;
      t._ph += v * 7;
    }
  } else {
    t._wait -= dt;
    if (t._wait <= 0) {
      t._path = [zoneFn()];
      t._pi = 0;
    }
  }
}

function stepWalker(arr, zoneFn, speed, waitMin, waitMax, dt) {
  for (let i = 0; i < arr.length; i++) {
    stepOneWalker(arr[i], zoneFn, speed, waitMin, waitMax, dt);
  }
}

export function wagesOf(l) {
  return {
    h: l.hostesses.reduce((a, h) => a + (h.worked || h.todayH > 0 ? h.wage : 0), 0),
    c: Math.round(l.hostesses.reduce((a, h) => a + (h.todayFee || 0), 0) * COMM),
    s: l.scouts.reduce((a, s) => a + s.wage, 0) + l.mkts.reduce((a, m) => a + m.wage, 0) + (l.bouncers || []).reduce((a, b) => a + b.wage, 0),
  };
}

export function checkAchievements() {
  if (!G) return [];
  const bs = bars();
  const hs = allH();
  const unlock = [];
  const tryUnlock = (id, cond) => {
    if (!G.achievements.includes(id) && cond()) {
      G.achievements.push(id);
      unlock.push(id);
    }
  };
  tryUnlock('first_bar', () => bs.length >= 1);
  tryUnlock('first_star', () => hs.some((h) => h.pop >= 100));
  tryUnlock('champagne_pop', () => (G.stats.totalChampagne || 0) >= 1);
  tryUnlock('bouncer_save', () => (G.stats.totalBounced || 0) >= 10);
  tryUnlock('vip_king', () => (G.stats.totalVipsOk || 0) >= 3);
  tryUnlock('regs_20', () => G.regs.length >= 20);
  tryUnlock('rank_1', () => G.bestRank === 1);
  tryUnlock('buyout_1', () => (G.stats.totalBuyouts || 0) >= 1);
  tryUnlock('three_bars', () => bs.length >= 3);
  tryUnlock('cash_100k', () => G.money >= 100000);
  tryUnlock('event_master', () => (G.stats.totalEventsOk || 0) >= 10);
  tryUnlock('week_3', () => G.day >= 21);
  tryUnlock('raid_dodge', () => (G.stats.totalRaidsDodged || 0) >= 1);

  if (unlock.length) {
    AU.sfx('achievement');
    unlock.forEach((id) => hooks.onAchievement(id));
  }
  return unlock;
}

export function update(dtReal) {
  if (!G || G.modal || !G.speed) return;
  const dt = (dtReal / MIN_SEC) * G.speed;
  G.t += dt;

  G._acc += spawnRate() * buzz() * dt;
  while (G._acc > 1) {
    G._acc--;
    if (G.peds.length < 260 && G.t < T_END - 25) spawnPed();
  }

  for (let i = 0; i < G.regs.length; i++) {
    const r = G.regs[i];
    if (r._at != null && G.t >= r._at) {
      r._at = null;
      spawnReg(r);
    }
  }

  const ev = G.ev || {};
  if (ev.vip && !ev.vip.spawned && G.t >= ev.vip.at) {
    ev.vip.spawned = true;
    spawnVip(ev.vip);
  }
  if (ev.razia && !ev.raziaDone) {
    // Bouncer early warning 25 mins before raid
    if (!ev.raziaWarned && G.t >= ev.razia - 25 && bars().some((l) => (l.bouncers || []).length > 0)) {
      ev.raziaWarned = true;
      AU.sfx('warning-buzz');
      hooks.toast('🛡️ 保安急报：线人传信警察车队 25 分钟后可能临检！快用「避风头」技能！');
    }
    if (G.t >= ev.razia) raid();
  }

  if (!G._opened && G.t >= T_OPEN) {
    G._opened = true;
    allH().forEach((h) => {
      if (onDuty(h)) h.worked = true;
    });
  }

  // Live random floor event trigger during open hours
  if (!G.liveEvent && G.liveEventsToday < 2 && G.t >= G.nextLiveAt && G.t < T_LAST - 30 && bars().some((l) => l._g.length > 0)) {
    hooks.onLiveEvent();
  }

  G._cacc += (G.t < 19 * 60 ? 0.12 : 0.17) * dt;
  while (G._cacc > 1) {
    G._cacc--;
    const c = pick(['#3F4A5A', '#C8574B', '#E9E3D6', '#6E7F8A', '#B5B0A6', '#2F261E']);
    const moto = R() < 0.55;
    if (R() < 0.5) {
      const xr = pick([-2.4, -2.4, -11.3, 49.5]);
      G.cars.push({ x: 54.6, y: YB + 1, sp: rnd(2, 2.8), moto, c, route: [[54.6, 26.6], [xr, 26.6], [xr, 9.4], [54.6, 9.4], [54.6, YA - 1.5]], ri: 0 });
    } else {
      const up = R() < 0.5;
      G.cars.push({ x: up ? 53.2 : 54.6, y: up ? YA - 1 : YB + 1, sp: rnd(2.6, 3.4), moto, c, route: [[up ? 53.2 : 54.6, up ? YB + 1.5 : YA - 1.5]], ri: 0 });
    }
  }

  for (let i = 0; i < G.peds.length; i++) stepPed(G.peds[i], dt);
  compactInPlace(G.peds, (p) => !p.dead, unregisterGroupPed);

  for (let i = 0; i < G.cars.length; i++) {
    const c = G.cars[i];
    const g = c.route[c.ri];
    const dx = g[0] - c.x;
    const dy = g[1] - c.y;
    const d = Math.hypot(dx, dy);
    const s = c.sp * dt;
    c.ax = Math.abs(dy) > Math.abs(dx) ? 1 : 0;
    c.dir = (c.ax ? dy : dx) > 0 ? 1 : -1;
    if (d <= s) {
      c.x = g[0];
      c.y = g[1];
      c.ri++;
      if (c.ri >= c.route.length) c.gone = true;
    } else {
      c.x += (dx / d) * s;
      c.y += (dy / d) * s;
    }
  }
  compactInPlace(G.cars, (c) => !c.gone);

  const bs = bars();
  for (let i = 0; i < bs.length; i++) {
    const l = bs[i];
    for (let j = 0; j < l.hostesses.length; j++) stepHostess(l, l.hostesses[j], dt);
    stepWalker(l.mkts, () => mZone(l), 0.8, 2, 7, dt);
    if (l.bouncers && l.bouncers.length) {
      for (let j = 0; j < l.bouncers.length; j++) {
        stepOneWalker(l.bouncers[j], () => bouncerZone(l, j), 0.75, 3, 8, dt);
      }
    }
  }

  for (let i = 0; i < G.lots.length; i++) {
    const l = G.lots[i];
    if (l.kind !== 'rival') continue;
    for (let j = 0; j < l.hs.length; j++) stepHostess(l, l.hs[j], dt);
    stepWalker(l.touts, () => toutZone(l), 0.9, 2, 6, dt);
  }

  for (let i = 0; i < G.fx.length; i++) {
    const f = G.fx[i];
    f.life -= dt;
    f.z += dt * 2.2;
  }
  compactInPlace(G.fx, (f) => f.life > 0);

  if (G.t >= T_END) endDay();
}

export function endDay() {
  let hf = 0, dr = 0, cogs = 0, hw = 0, hc = 0, sw = 0, rent = 0, fines = 0;
  let nh = 0, rf = 0, tu = 0, nl = 0, nr = 0, sto = 0, bnc = 0;
  const barSummaries = [];

  bars().forEach((l) => {
    const w = wagesOf(l);
    const t = l.today;
    hf += t.hfee;
    dr += t.drink;
    cogs += t.cogs;
    hw += w.h;
    hc += w.c;
    sw += w.s;
    rent += l.rent;
    fines += t.fine || 0;
    nh += t.nohost;
    rf += t.roomfull;
    tu += t.turned;
    nl += t.nolike;
    nr += t.newRegs;
    sto += t.stolen;
    bnc += t.bounced || 0;
    l.wk = (l.wk || 0) + t.hfee + t.drink;
    barSummaries.push({
      name: l.name,
      guests: t.guests,
      by: Object.assign({}, t.by),
      hours: Math.round(t.hours),
      staff: l.hostesses.filter((h) => h.worked || h.todayH > 0).length,
      rev: t.hfee + t.drink,
    });
  });

  allH().forEach((h) => {
    if (h.raiseAsk) {
      h.raiseAsk = null;
      h.mood = clamp(h.mood - 25, 0, 100);
      h.refused = 3;
    }
  });

  const sunday = wday(G.day) === 6;
  let fee = 0;
  let extra = [];
  if (sunday) {
    bars().forEach((l) => {
      const baseFee = FEE(l);
      fee += G.achievements?.includes('three_bars') ? Math.round(baseFee * 0.9) : baseFee;
    });
    const list = G.lots
      .filter((l) => l.kind === 'mine' || l.kind === 'rival')
      .map((l) => ({ l, v: l.kind === 'mine' ? l.wk || 0 : G.rival[l.i].wk || 0 }))
      .sort((a, b) => b.v - a.v);
    G.lastRank = list.map((x) => ({ name: x.l.name, mine: x.l.kind === 'mine', v: x.v }));
    const mineR = list.findIndex((x) => x.l.kind === 'mine');
    G.bestRank = mineR >= 0 ? Math.min(G.bestRank || 99, mineR + 1) : G.bestRank || null;
    bars().forEach((l) => {
      l.star = list[0] && list[0].l === l;
    });
    const avg = list.reduce((a, x) => a + x.v, 0) / Math.max(1, list.length);
    G.lots.forEach((l) => {
      if (l.kind !== 'rival') return;
      const r = G.rival[l.i];
      if ((r.wk || 0) > avg) {
        r.hn = Math.min(40, r.hn + 1 + ((R() * 3) | 0));
        r.q = Math.min(1, (r.q || 0.5) + 0.03);
        r.pm = Math.min(1.6, (r.pm || 1) + 0.05);
      } else {
        r.hn = Math.max(15, r.hn - 1);
      }
      if (r.mode === 'agg' && G.bestRank && G.bestRank <= 3) r.touts = Math.min(5, (r.touts || 3) + 1);
      r.wk = 0;
    });
    bars().forEach((l) => { l.wk = 0; });
    const empt = G.lots.filter((l) => l.kind === 'empty');
    if (empt.length >= 5 && R() < 0.25) {
      const e = pick(empt);
      const used = G.lots.map((l) => l.name);
      const nm = NEWBARS.find((n) => !used.includes(n));
      if (nm) {
        G.newRivals = G.newRivals || {};
        G.newRivals[e.i] = { n: nm, lay: pick(['mega', 'mtr', 'la']), ac: pick(['#B0457F', '#3E5F96', '#C8574B', '#5A3F7A']) };
        G.rival[e.i] = { mode: R() < 0.5 ? 'agg' : 'con', hn: 18 + ((R() * 6) | 0), q: 0.4, pm: 1 };
        extra.push(`下周 ${where(e)} 会新开一家对手：${nm}。`);
      }
    }
  }

  if (G.day % 28 === 0) {
    bars().forEach((l) => {
      l.rentMul = clamp(1 + 0.1 * (l.rep - 3), 0.85, 1.4);
      extra.push(`${esc(l.name)} 的房东按口碑调了房租（× ${l.rentMul.toFixed(2)}）。`);
    });
  }

  const net = hf + dr - cogs - hw - hc - sw - rent - fee - fines - G.spent;
  G.money -= hw + hc + sw + rent + fee;
  const opProfit = hf + dr - cogs - hw - hc - sw - rent;
  G.best = Math.max(G.best || 0, opProfit);

  if (G.ev?.rain && opProfit > 0 && !G.achievements.includes('rain_survivor')) {
    G.achievements.push('rain_survivor');
    hooks.onAchievement('rain_survivor');
  }

  G.history = G.history || [];
  G.history.push({ day: G.day, wd: WD[wday(G.day)], rev: hf + dr, net, opProfit });
  if (G.history.length > 14) G.history.shift();

  const got = checkGoals();
  checkAchievements();
  G.liveEvent = null;
  G.modal = true;
  AU.music('closing');

  hooks.onEndDay({
    hf, dr, cogs, hw, hc, sw, rent, fines, fee, net, nh, rf, tu, nl, nr, sto, bnc,
    barSummaries, extra, got, sunday, bust: G.money < -5000,
  });
}

export function morning() {
  const news = [];
  G.lots.forEach((l) => {
    if (l.kind !== 'mine') return;
    l.hostesses.slice().forEach((h) => {
      const w = h.worked || h.todayH > 0;
      if (w) {
        h.en = Math.min(100, h.en + 13);
        h.streak = (h.streak || 0) + 1;
      } else {
        h.en = Math.min(100, h.en + 45);
        h.streak = 0;
        h.mood = Math.min(100, h.mood + 6);
      }
      if (h.en < 30) h.mood -= 10;
      if (h.streak >= 6) h.mood -= 8;
      h.mood = clamp(h.mood, 0, 100);
      if (h.refused > 0) h.refused--;
      h.sick = h.en < 15;
      if (h.sick) {
        news.push(`${h.name}（${esc(l.name)}）累病了，今晚请假。`);
        h.en = Math.min(100, h.en + 20);
      }
      if (h.mood < 15) {
        l.hostesses = l.hostesses.filter((x) => x !== h);
        news.push(`<b>${h.name}</b>（${esc(l.name)}）心情太差，辞职了。`);
        return;
      }
      const t = tierOf(h);
      if (t > (h.lt || 0)) {
        h.lt = t;
        h.raiseAsk = Math.round((h.wage * 1.3) / 10) * 10;
        news.push(`${h.name} 升为<b>${TIER[t]}</b>，要求底薪加到 ${fm(h.raiseAsk)}。`);
      } else if (h.pop - (h.pr || 0) >= 30 && R() < 0.5) {
        h.pr = h.pop;
        h.raiseAsk = Math.round((h.wage * 1.15) / 10) * 10;
        news.push(`${h.name} 人气越来越高，想把底薪加到 ${fm(h.raiseAsk)}。`);
      }
      const agg = G.lots.filter((x) => x.kind === 'rival' && x.mode === 'agg');
      const protectedByHongbao = (h.loyalUntil || 0) >= G.day;
      const pp = agg.length && !protectedByHongbao ? (t ? 0.03 * t : 0) + (h.mood < 40 ? 0.06 : 0) + (h.refused > 0 ? 0.08 : 0) : 0;
      if (pp && R() < pp) {
        const r = pick(agg);
        l.hostesses = l.hostesses.filter((x) => x !== h);
        G.rival[r.i].hn++;
        news.push(`<b>${h.name}</b> 被 ${r.name} 挖走了。`);
      }
    });
  });

  const e = G.ev || {};
  const n = {};
  n.rain = R() < 0.18;
  if (e.holiday > 1) n.holiday = e.holiday - 1;
  else if (R() < 0.06) n.holiday = 3;
  if (e.ramadan > 1) n.ramadan = e.ramadan - 1;
  else if (!G.ramadanDone && G.day >= 22 && R() < 0.12) {
    n.ramadan = 7;
    G.ramadanDone = true;
  }
  n.payday = G.day % 14 === 0;
  if (e.nextBloggerBoost) n.bloggerBoost = true;
  if (R() < 0.07) {
    n.razia = rnd(20.5, 25) * 60;
    n.rumor = R() < 0.5;
  }
  const big = bars().filter((l) => activeH(l).length >= 6);
  const ktvBonus = big.some((l) => l.concept === 'ktv') ? 0.05 : 0;
  if (G.day >= 3 && big.length && R() < 0.14 + ktvBonus) {
    const l = pick(big);
    const tp = R() < 0.7 ? 'tai' : 'cn';
    n.vip = {
      bar: l.i,
      n: 3 + ((R() * 4) | 0),
      body: R() < 0.6 ? 'slim' : 'curvy',
      pers: R() < 0.4 ? pick(['intro', 'extro']) : 'any',
      type: tp,
      at: rnd(21, 22.5) * 60,
      who: tp === 'tai' ? '台湾老板一行' : '中国老板一行',
    };
  }
  G.ev = n;
  return news;
}

export function nextDay() {
  G.day++;
  G.t = T0;
  G.flyers = false;
  G.spent = 0;
  G._opened = false;
  G.poachedToday = false;
  G.regs.forEach((r) => {
    if (r.daily) {
      if (R() < 0.2) r.days = 0;
      else r.days = 1;
    } else {
      r.days--;
    }
  });
  G.regs = G.regs.filter((r) => r.days > 0 && G.mine[r.bar]);
  const news = morning();
  G.mk = {
    scouts: [mkScout(), mkScout(), mkScout()],
    mkts: [mkMkt(), mkMkt(), mkMkt()],
    bouncers: [mkBouncer(), mkBouncer()],
  };
  bars().forEach((l) => {
    l.cands = scoutDay(l);
  });
  const v = G.view;
  save();
  load(scheduleRegs);
  G.view = v;
  AU.music(dayTrack(G));
  hooks.onBrief(news);
  hooks.onPanel();
}

export function initSim() {
  if (!load(scheduleRegs)) {
    newGame(scheduleRegs);
  }
}

export function skipToOpen() {
  if (!G || G.t >= T_OPEN) return false;
  G.t = T_OPEN;
  G._opened = true;
  allH().forEach((h) => {
    if (onDuty(h)) h.worked = true;
  });
  // Spawn an immediate wave of early evening strollers so street isn't empty
  for (let i = 0; i < 8; i++) spawnPed();
  AU.sfx('notification-ding');
  return true;
}

export function simHeadlessDays(days = 7) {
  initSim();
  // Ensure at least 1 bar is open for headless test if empty
  if (!bars().length) {
    const empty = G.lots.find((l) => l.kind === 'empty');
    if (empty) {
      Object.assign(empty, {
        kind: 'mine',
        name: 'Test Bar',
        accent: '#C8574B',
        concept: 'bintang',
        menu: {},
        price: 40,
        decor: 1,
        seats: 1,
        rooms: 1,
        sign: 1,
        rep: 3.2,
        fl: '#D8CDB8',
        hostesses: Array.from({ length: 6 }, () => ({ ...mkHostess(5), state: 'idle', todayH: 0, hidden: false, on: true })),
        scouts: [mkScout()],
        mkts: [mkMkt()],
        bouncers: [mkBouncer()],
        req: { body: 'any', pers: 'any', looks: 0, att: 0 },
        cands: [],
      });
      G.mine[empty.i] = empty;
      runtime(scheduleRegs);
    }
  }
  const results = [];
  for (let d = 0; d < days; d++) {
    let steps = 0;
    G.modal = false;
    G.speed = 4;
    while (!G.modal && steps < 4000) {
      update(0.1);
      steps++;
    }
    results.push({ day: G.day, money: G.money, peds: G.peds.length, regs: G.regs.length });
    if (d < days - 1) nextDay();
  }
  return results;
}
