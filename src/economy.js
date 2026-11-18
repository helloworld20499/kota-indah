import {
  BARPAL, CONCEPTS, MAXH, SPECIAL_MENU, TRAIT_KEYS, TRAITS, clamp, fm, hWage, onDuty, pick,
} from './config.js';
import { AU } from './audio.js';
import { G, freeSpot, mkHostess, placeBouncer, placeH, resetBarDay } from './state.js';
import { barOpen, checkAchievements, checkGoals, leaveRival, trafMul } from './sim.js';

export function setBarConcept(l, conceptId, payFn, toastFn, rebuildFn) {
  const c = CONCEPTS[conceptId];
  if (!l || !c || l.concept === conceptId) return false;
  const switchCost = barOpen() || l.today?.guests > 0 ? 1500 : 0;
  if (switchCost > 0 && !payFn(switchCost)) return false;
  l.concept = conceptId;
  l.accent = c.accent;
  l.ac = c.accent;
  AU.sfx('confirm-unlock');
  rebuildFn?.(l);
  toastFn(`${l.name} 定位切换为「${c.cn}」${switchCost ? `（装修费 ${fm(switchCost)}）` : '（开店免费调整）'}`);
  return true;
}

export function buyMenuItem(l, menuId, payFn, toastFn) {
  const item = SPECIAL_MENU[menuId];
  if (!l || !item) return false;
  l.menu = l.menu || {};
  if (l.menu[menuId]) return false;
  if (!payFn(item.cost)) return false;
  l.menu[menuId] = true;
  AU.sfx('confirm-unlock');
  toastFn(`已解锁特色酒单：${item.cn}`);
  return true;
}

export function giveHongbao(l, hostessId, payFn, toastFn) {
  const h = l?.hostesses.find((x) => x.id === hostessId);
  if (!h || !payFn(500)) return false;
  h.mood = clamp(h.mood + 28, 0, 100);
  h.en = clamp(h.en + 10, 0, 100);
  h.loyalUntil = G.day + 7;
  AU.sfx('coin-collect');
  toastFn(`给 ${h.name} 发了红包，心情大涨，7 天内不会被挖角！`);
  return true;
}

export function trainHostess(l, hostessId, payFn, toastFn) {
  const h = l?.hostesses.find((x) => x.id === hostessId);
  if (!h) return false;
  if (l.trainedToday) {
    toastFn('这家店今天已经举办过特训了，明天再来');
    return false;
  }
  if (!payFn(1800)) return false;
  l.trainedToday = true;

  const msg = [];
  if (h.looks < 10 && (h.looks <= h.att || h.att >= 10)) {
    h.looks = Math.min(10, h.looks + 1);
    msg.push('样貌 +1');
  } else if (h.att < 10) {
    h.att = Math.min(10, h.att + 1);
    msg.push('态度 +1');
  } else {
    h.mood = 100;
    msg.push('气质拉满，心情 100');
  }

  h.traits = h.traits || [];
  if (h.traits.length < 2) {
    const avail = TRAIT_KEYS.filter((k) => !h.traits.includes(k));
    if (avail.length && (h.traits.length === 0 || Math.random() < 0.55)) {
      const gained = pick(avail);
      h.traits.push(gained);
      msg.push(`领悟特质【${TRAITS[gained].cn}】`);
    }
  }
  h.wage = hWage(h);
  AU.sfx('level-up');
  toastFn(`${h.name} 特训完成：${msg.join('、')}`);
  return true;
}

export function applyShiftPreset(l, mode, toastFn) {
  if (!l) return;
  const n = l.hostesses.length;
  if (!n) return;
  let want = n;
  let minEn = 15;
  if (mode === 'smart') {
    want = Math.ceil(n * Math.min(1, trafMul() / 1.3));
    minEn = 30;
  } else if (mode === 'rush') {
    want = n;
    minEn = 15;
  } else if (mode === 'rest') {
    want = Math.max(1, Math.ceil(n * 0.65));
    minEn = 55;
  }

  const sorted = l.hostesses.slice().sort((a, b) => b.en - a.en);
  sorted.forEach((h, i) => {
    const shouldOn = i < want && h.en >= minEn && !h.sick;
    if (shouldOn === h.on) return;
    if (!shouldOn && h.state !== 'idle') return;
    h.on = shouldOn;
    if (shouldOn) {
      h.hidden = false;
      if (barOpen()) h.worked = true;
      placeH(l, h);
    } else {
      freeSpot(l, h);
      h.hidden = true;
    }
  });
  AU.sfx('toggle-switch-on');
  const label = mode === 'smart' ? '智能客流班' : mode === 'rush' ? '周末全员冲刺' : '疲劳轮休保护';
  toastFn(`${label}：已排 ${l.hostesses.filter(onDuty).length} 人上班`);
}

export function transferHostess(fromBar, hostessId, toBarIdx, toastFn) {
  const toBar = G.lots[toBarIdx];
  if (!fromBar || !toBar || toBar.kind !== 'mine' || fromBar.i === toBar.i) return false;
  const h = fromBar.hostesses.find((x) => x.id === hostessId);
  if (!h) return false;
  if (h.state !== 'idle') {
    toastFn(`${h.name} 正在陪客，等她下来后再调店`);
    return false;
  }
  if (toBar.hostesses.length >= MAXH) {
    toastFn(`${toBar.name} 公关人数已满`);
    return false;
  }
  freeSpot(fromBar, h);
  fromBar.hostesses = fromBar.hostesses.filter((x) => x !== h);
  h.hidden = !onDuty(h);
  if (barOpen() && onDuty(h)) h.worked = true;
  toBar.hostesses.push(h);
  if (onDuty(h)) placeH(toBar, h);
  AU.sfx('pop-bubble');
  toastFn(`已将 ${h.name} 调往 ${toBar.name}`);
  return true;
}

export function hireBouncer(l, idx, toastFn) {
  const b = G.mk?.bouncers?.[idx];
  if (!l || !b) return false;
  l.bouncers = l.bouncers || [];
  if (l.bouncers.length >= 2) {
    toastFn('每家店最多雇佣 2 名保安');
    return false;
  }
  G.mk.bouncers.splice(idx, 1);
  l.bouncers.push(b);
  placeBouncer(l, b, l.bouncers.length - 1);
  AU.sfx('confirm-unlock');
  toastFn(`保安 ${b.name} 上岗！大幅减少门口拉客截胡并可提前预警临检`);
  return true;
}

export function fireBouncer(l, id) {
  if (!l || !l.bouncers) return;
  l.bouncers = l.bouncers.filter((b) => b.id !== id);
  AU.sfx('trash-crumple');
}

export function rivalIntel(l) {
  const r = G.rival[l.i] || { mode: 'con', hn: 4, q: 0.5, wk: 0 };
  const pal = BARPAL[l.lay] || { price: 55 };
  return {
    modeCn: r.mode === 'agg' ? '激进派（门口派拉客仔截胡）' : '保守派（靠门店自然客流）',
    avgPrice: pal.price,
    quality: Math.round((r.q || 0.5) * 10),
    wkRev: r.wk || 0,
  };
}

export function poachRivalHostess(rivalLot, targetBar, payFn, toastFn) {
  if (G.poachedToday) {
    toastFn('今天已经派星探去对手店挖过人了，明天再来');
    return false;
  }
  if (!targetBar || targetBar.kind !== 'mine') {
    toastFn('请先至少开一家自己的酒吧，才能接收挖角人才');
    return false;
  }
  if (!payFn(2500)) return false;
  G.poachedToday = true;

  const r = G.rival[rivalLot.i];
  if (Math.random() < 0.72) {
    const star = mkHostess(6.8, true);
    star.pop = 15 + ((Math.random() * 20) | 0);
    targetBar.cands.unshift(star);
    if (r && r.hn > 3) {
      r.hn--;
      rivalLot.hn = r.hn;
      if (rivalLot.hs && rivalLot.hs.length > r.hn) {
        const idleIdx = rivalLot.hs.findIndex((x) => x.state === 'idle');
        if (idleIdx >= 0) {
          freeSpot(rivalLot, rivalLot.hs[idleIdx]);
          rivalLot.hs.splice(idleIdx, 1);
        }
      }
    }
    AU.sfx('achievement');
    toastFn(`挖角成功！${rivalLot.name} 的红牌候选「${star.name}」已到 ${targetBar.name} 应聘！`);
  } else {
    AU.sfx('error-soft-thud');
    toastFn(`${rivalLot.name} 的店长盯得很紧，这次挖角没能联系上目标`);
  }
  return true;
}

export function buyoutCost(l) {
  const wk = G?.rival?.[l.i]?.wk || 0;
  const raw = 42000 + l.L * l.D * 320 + wk * 0.35;
  const disc = G?.achievements?.includes('buyout_1') ? 0.9 : 1;
  return Math.round((raw * disc) / 500) * 500;
}

export function buyoutRival(l, payFn, toastFn, rebuildFn) {
  if (!l || l.kind !== 'rival') return false;
  if (!G.bestRank || G.bestRank > 3) {
    toastFn('需要先在周日街道排行冲进前 3 名，才具备收购对手的街区威望！');
    return false;
  }
  const cost = buyoutCost(l);
  if (!payFn(cost)) return false;

  // Cleanly clear active rival customers & touts
  l._g.slice().forEach((p) => leaveRival(p));
  l.touts = [];

  const rentBase = Math.round((l.L * l.D * 26) / 10) * 10;
  const oldHs = (l.hs || []).slice();
  const keepCount = Math.max(2, Math.min(oldHs.length, Math.ceil(oldHs.length * 0.75)));
  const inherited = oldHs.slice(0, keepCount).map((h) => Object.assign(h, {
    on: true,
    sick: false,
    state: 'idle',
    with: null,
    hidden: false,
    todayH: 0,
    todayFee: 0,
    traits: h.traits || [],
    loyalUntil: G.day + 5,
  }));
  while (inherited.length < 3) {
    inherited.push(Object.assign(mkHostess(5.2), {
      on: true,
      sick: false,
      state: 'idle',
      with: null,
      hidden: false,
      todayH: 0,
      todayFee: 0,
      loyalUntil: G.day + 5,
    }));
  }

  Object.assign(l, {
    kind: 'mine',
    boughtOut: true,
    customLay: l.lay,
    loc: 1.15,
    cost,
    baseRent: rentBase,
    rent: rentBase,
    rentMul: 1,
    decor: 2,
    seats: 2,
    rooms: 2,
    sign: 2,
    rep: 3.8,
    price: l.price || 55,
    concept: 'ktv',
    accent: l.ac,
    menu: { bucket: true, platter: true },
    fl: '#D8CDB8',
    hostesses: inherited,
    hs: [],
    scouts: [],
    mkts: [],
    bouncers: [],
    req: { body: 'any', pers: 'any', looks: 0, att: 0 },
    cands: [0, 1, 2].map(() => mkHostess(5.8, true)),
    _seats: null,
    _els: null,
    _spots: null,
    _spotT: {},
    _sofaH: {},
  });

  resetBarDay(l);
  l.hostesses.forEach((h) => placeH(l, h));
  G.mine[l.i] = l;
  delete G.rival[l.i];

  G.stats.totalBuyouts = (G.stats.totalBuyouts || 0) + 1;
  checkAchievements();
  checkGoals();
  AU.sfx('achievement');
  rebuildFn?.(l);
  toastFn(`🦈 商业收购成功！${l.name} 现已归入你的夜街帝国（保留 ${inherited.length} 名熟练公关）！`);
  return true;
}
