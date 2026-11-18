// Kota Indah Night Street — 5-Tier Rarity, Slot Machine, Dual Codex, Synergies & Customer Voices

import {
  CT, DRESS, HAIRS, HNAMES, SKINS, TRAITS, TRAIT_KEYS,
  R, clamp, fm, hWage, onDuty, pick, uid,
} from './config.js';
import { AU } from './audio.js';

/* ---------- 1. Five-Tier Rarity System ---------- */
export const RARITY_TIERS = {
  1: { r: 1, cn: '街坊新人', short: '1等·新人', badge: '1等', col: '#7D7265', bg: '#EFEAE0', feeMul: 1.0, stat: [2, 4], traits: 0 },
  2: { r: 2, cn: '驻场佳丽', short: '2等·佳丽', badge: '2等', col: '#1F6E5A', bg: '#E2F2EC', feeMul: 1.1, stat: [4, 6], traits: 1 },
  3: { r: 3, cn: '人气红牌', short: '3等·红牌', badge: '3等', col: '#265385', bg: '#E3EEF9', feeMul: 1.25, stat: [6, 7], traits: 1 },
  4: { r: 4, cn: '镇店头牌', short: '4等·头牌', badge: '4等', col: '#6B4280', bg: '#F1E6F7', feeMul: 1.45, stat: [7, 9], traits: 2 },
  5: { r: 5, cn: '传奇名花', short: '5等·名花', badge: '5等·名花', col: '#B87A14', bg: '#FBF0CE', feeMul: 2.0, stat: [9, 10], traits: 2, legend: true },
};

export function rarityOf(h) {
  const r = h?.rarity || (h?.legendId ? 5 : 2);
  return RARITY_TIERS[clamp(r, 1, 5)];
}

/* ---------- 2. 《雅加达女子图鉴》 — 12 Tier-5 Legendary Girls ---------- */
export const LEGEND_GIRLS = [
  {
    id: 'kartika', name: 'Kartika', title: '万隆落跑千金', body: 'prime',
    looks: 10, att: 9, traits: ['noble', 'polyglot'], acc: 'tiara',
    hair: '#1f1a18', skin: '#E0B08A', dress: '#8A6FA8',
    auraCn: '全店合理酒价 +25%，客人隔夜带走意愿 +30%',
    bio: '自万隆豪门出走，自带名媛气场，端杯威士忌就能让包厢瞬间升档。',
  },
  {
    id: 'ayu', name: 'Ayu', title: '巴厘火舞娘', body: 'curvy',
    looks: 9, att: 9, traits: ['drinker', 'rowdy'], acc: 'flower',
    hair: '#2b211b', skin: '#C99670', dress: '#C8574B',
    auraCn: '全店点酒节奏 +25%，客人整体满意度 +0.6',
    bio: '曾在乌布舞台领舞，笑声一响整条卡座都跟着多开两打冰啤酒。',
  },
  {
    id: 'meiling', name: 'Mei Ling', title: '棉兰华裔歌后', body: 'slim',
    looks: 10, att: 10, traits: ['singer', 'polyglot'], acc: 'pearl',
    hair: '#1f1a18', skin: '#E0B08A', dress: '#B5362F',
    auraCn: '包厢钟点费 +20%，台客与中客进店率 +15%',
    bio: '粤语闽南语金曲信手拈来，是台商与华商老板最爱点的包厢王牌。',
  },
  {
    id: 'sinta', name: 'Sinta', title: '前女团人气 C 位', body: 'slim',
    looks: 10, att: 9, traits: ['diva', 'sweet'], acc: 'star',
    hair: '#3a2a20', skin: '#D7A47C', dress: '#D05A9C',
    auraCn: '本店无视暴雨客流惩罚，且进店率额外 +12%',
    bio: '退团后在雅加达夜街依旧拥有铁杆拥趸，狂风暴雨也挡不住粉丝打卡。',
  },
  {
    id: 'nadia', name: 'Nadia', title: '北雅加达金融女郎', body: 'slim',
    looks: 9, att: 9, traits: ['noble', 'gossip'], acc: 'glasses',
    hair: '#2b211b', skin: '#E0B08A', dress: '#3F4A5A',
    auraCn: '精算进货渠道，本店每瓶酒进货成本直降 Rp 3k',
    bio: '白天看 K 线晚上品红酒，总能用最低的成本拿捏住最挑剔的大客户。',
  },
  {
    id: 'dewi', name: 'Dewi', title: '唐人街雀神西施', body: 'curvy',
    looks: 9, att: 10, traits: ['rowdy', 'drinker'], acc: 'jade',
    hair: '#1f1a18', skin: '#D7A47C', dress: '#3F8F7B',
    auraCn: '特色酒单触发率翻倍，每次点酒额外小费 +25k',
    bio: '划拳骰盅从无败绩，跟她拼酒输了的客人都会笑着再开一桶啤酒。',
  },
  {
    id: 'laras', name: 'Laras', title: '电音打碟女神', body: 'slim',
    looks: 9, att: 9, traits: ['diva', 'stamina'], acc: 'headset',
    hair: '#5a3e2b', skin: '#D7A47C', dress: '#5B7FA6',
    auraCn: '自带免费驻场 DJ 效果，全店公关体力消耗 -20%',
    bio: '混音台一推就能把冷清大厅炒成狂欢舞池，连带姐妹们越夜越精神。',
  },
  {
    id: 'putri', name: 'Putri', title: '日惹宫廷舞姬', body: 'curvy',
    looks: 10, att: 10, traits: ['singer', 'sweet'], acc: 'goldpin',
    hair: '#1f1a18', skin: '#C99670', dress: '#E2B24A',
    auraCn: '全店口碑涨幅 ×1.5，极易把散客留成每日熟客',
    bio: '举手投足皆是传统爪哇典雅仪态，见过她的客人都记挂着回头再来。',
  },
  {
    id: 'citra', name: 'Citra', title: '时尚周刊话题女王', body: 'slim',
    looks: 10, att: 9, traits: ['diva', 'ace'], acc: 'star',
    hair: '#3a2a20', skin: '#E0B08A', dress: '#C8574B',
    auraCn: '招牌吸引力 ×1.8，黄金香槟塔触发率额外 +15%',
    bio: '只要坐在靠窗卡座，整条 Kota Indah 的街拍镜头都会对准你家门面。',
  },
  {
    id: 'vivi', name: 'Vivi', title: '百变氛围甜心', body: 'curvy',
    looks: 9, att: 10, traits: ['sweet', 'stamina'], acc: 'ribbon',
    hair: '#5a3e2b', skin: '#E0B08A', dress: '#D05A9C',
    auraCn: '客人等位耐心 +50%，钟点结束加钟续费率 +20%',
    bio: '永远记得每一位熟客爱喝几分冰，连等位的大哥都被她哄得乐呵呵。',
  },
  {
    id: 'rina', name: 'Rina', title: '东南亚商务公关皇', body: 'prime',
    looks: 9, att: 10, traits: ['polyglot', 'ace'], acc: 'pearl',
    hair: '#2b211b', skin: '#C99670', dress: '#2F261E',
    auraCn: 'VIP 与金主小费 +35%，高净值客人带走买断率 +25%',
    bio: '精通三国商务酒桌礼仪，跨国大老板来雅加达谈生意指定找她撑场。',
  },
  {
    id: 'kirana', name: 'Kirana', title: '夜街神秘大姐头', body: 'curvy',
    looks: 9, att: 10, traits: ['ace', 'gossip'], acc: 'jade',
    hair: '#1f1a18', skin: '#B98562', dress: '#2F261E',
    auraCn: '本店警察临检罚款 -40%，有效震慑隔壁拉客仔',
    bio: 'Kota Indah 东街西街都卖她几分薄面，她在店里坐镇就能省去无数麻烦。',
  },
];

export const LEGEND_MAP = Object.fromEntries(LEGEND_GIRLS.map((g) => [g.id, g]));

export const GIRL_MILESTONES = [
  { count: 3, cn: '3 名花', bonusCn: '全员每晚休整多回 +5 体力' },
  { count: 6, cn: '6 名花', bonusCn: '老虎机每日免费次数 +1' },
  { count: 9, cn: '9 名花', bonusCn: '全店进店率永久 +10%' },
  { count: 12, cn: '满图鉴', bonusCn: '全店钟点营收永久 +12%' },
];

export function girlMilestoneBonuses(codexGirls) {
  const n = Object.keys(codexGirls || {}).filter((k) => codexGirls[k]).length;
  return {
    count: n,
    restEnBonus: n >= 3 ? 5 : 0,
    extraFreeSpin: n >= 6 ? 1 : 0,
    enterMul: n >= 9 ? 1.1 : 1.0,
    feeMul: n >= 12 ? 1.12 : 1.0,
  };
}

export function activeLegendAuras(l) {
  const a = {
    fairMul: 1, outBonus: 0, drinkSpeedMul: 1, satBonus: 0, roomFeeMul: 1, taiCnMul: 1,
    ignoreRain: false, enterMul: 1, cogsSave: 0, specialMul: 1, drinkTip: 0,
    freeDj: false, enDrainMul: 1, repMul: 1, signBuzzMul: 1, champBonus: 0,
    waitMul: 1, extBonus: 0, vipTipMul: 1, raidFineMul: 1, activeLegends: [],
  };
  if (!l || !l.hostesses) return a;
  for (let i = 0; i < l.hostesses.length; i++) {
    const h = l.hostesses[i];
    if (!onDuty(h) || !h.legendId) continue;
    a.activeLegends.push(h.legendId);
    switch (h.legendId) {
      case 'kartika': a.fairMul *= 1.25; a.outBonus += 0.3; break;
      case 'ayu': a.drinkSpeedMul *= 1.25; a.satBonus += 0.6; break;
      case 'meiling': a.roomFeeMul *= 1.2; a.taiCnMul *= 1.15; break;
      case 'sinta': a.ignoreRain = true; a.enterMul *= 1.12; break;
      case 'nadia': a.cogsSave += 3; break;
      case 'dewi': a.specialMul *= 2; a.drinkTip += 25; break;
      case 'laras': a.freeDj = true; a.enDrainMul *= 0.8; break;
      case 'putri': a.repMul *= 1.5; break;
      case 'citra': a.signBuzzMul *= 1.8; a.champBonus += 0.15; break;
      case 'vivi': a.waitMul *= 1.5; a.extBonus += 0.2; break;
      case 'rina': a.vipTipMul *= 1.35; a.outBonus += 0.25; break;
      case 'kirana': a.raidFineMul *= 0.6; break;
    }
  }
  return a;
}

/* ---------- 3. Slot Machine Recruitment (Replaces Scouts) ---------- */
export const SLOT_LEVELS = {
  1: { lv: 1, cn: '街边旧机台', upCost: 5000, free: 3, lockAllowed: false, weights: [42, 36, 16, 5, 1], pityMax: 20, desc: '基础 3 次免费 · 4/5 等概率较低' },
  2: { lv: 2, cn: '改装霓虹机', upCost: 14000, free: 3, lockAllowed: true, weights: [20, 36, 26, 14, 4], pityMax: 15, desc: '解锁【🔒锁轴重转】· 高等概率大涨' },
  3: { lv: 3, cn: '贵宾猎头机', upCost: 28000, free: 4, lockAllowed: true, weights: [8, 25, 34, 24, 9], pityMax: 12, desc: '每日免费 4 次 · 5 等名花概率 9%' },
  4: { lv: 4, cn: '黄金大亨机', upCost: 0, free: 4, lockAllowed: true, weights: [0, 0, 44, 40, 16], pityMax: 9, desc: '保底 3 等起步 · 9 抽必出 5 等传奇名花' },
};

export const REEL_LEFT = [
  { r: 1, icon: '🏠', cn: '街坊素颜', sub: '1等·新人' },
  { r: 2, icon: '🎓', cn: '校园兼职', sub: '2等·佳丽' },
  { r: 3, icon: '💃', cn: '模特经纪', sub: '3等·红牌' },
  { r: 4, icon: '👑', cn: '演艺会所', sub: '4等·头牌' },
  { r: 5, icon: '🌟', cn: '名花金印', sub: '5等·图鉴' },
];

export const REEL_MID = [
  { body: 'slim', icon: '✨', cn: '苗条身姿', sub: '台客偏爱' },
  { body: 'curvy', icon: '🔥', cn: '丰满风情', sub: '土客偏爱' },
  { body: 'prime', icon: '💎', cn: '黄金身段', sub: '全客通吃!' },
];

export const REEL_RIGHT = TRAIT_KEYS.map((id) => ({
  id,
  cn: TRAITS[id].cn,
  col: TRAITS[id].col,
  desc: TRAITS[id].desc,
}));

export const ALL_REEL_SYMBOLS = [REEL_LEFT, REEL_MID, REEL_RIGHT];

export function formatReelItem(colIdx, itemIdx) {
  if (colIdx === 0) {
    const it = REEL_LEFT[itemIdx] || REEL_LEFT[0];
    return { icon: it.icon, title: it.cn, sub: it.sub, cls: `r${it.r}`, color: '' };
  }
  if (colIdx === 1) {
    const it = REEL_MID[itemIdx] || REEL_MID[0];
    return {
      icon: it.icon,
      title: it.cn,
      sub: it.sub,
      cls: it.body === 'prime' ? 'r5' : '',
      color: it.body === 'prime' ? '#9E6214' : '',
    };
  }
  const it = REEL_RIGHT[itemIdx] || REEL_RIGHT[0];
  return { icon: '✨', title: it.cn, sub: '阵容羁绊', cls: '', color: it.col || '' };
}

export function createInitialSlot(codexGirls) {
  const extra = girlMilestoneBonuses(codexGirls).extraFreeSpin;
  return {
    lv: 1,
    freeLeft: SLOT_LEVELS[1].free + extra,
    paidSpinsToday: 0,
    pity: 0,
    locks: [false, false, false],
    reels: [0, 0, 0],
    pending: null,
    lastJackpot: false,
  };
}

export function slotLockCost(codexWhales) {
  return codexWhales?.bella_v?.unlocked ? 120 : 250;
}

export function spinCost(slot, codexWhales) {
  const s = slot || createInitialSlot({});
  const lockCount = (s.locks || []).filter(Boolean).length;
  const base = s.freeLeft > 0 ? 0 : Math.min(1200, 350 + (s.paidSpinsToday || 0) * 150);
  const lockFee = lockCount * slotLockCost(codexWhales);
  return { base, lockFee, total: base + lockFee, lockCount };
}

function pickWeightedTier(weights, boostHigh) {
  const w = weights.slice();
  if (boostHigh) {
    if (w[0] > 4) { w[0] -= 4; w[3] += 3; w[4] += 1; }
    else if (w[1] > 4) { w[1] -= 4; w[3] += 2; w[4] += 2; }
  }
  const sum = w.reduce((a, b) => a + b, 0);
  let r = R() * sum;
  for (let i = 0; i < w.length; i++) {
    r -= w[i];
    if (r <= 0) return i + 1;
  }
  return 1;
}

function employedLegendIds(G) {
  const set = new Set();
  Object.values(G?.mine || {}).forEach((b) => {
    (b.hostesses || []).forEach((h) => {
      if (h.legendId) set.add(h.legendId);
    });
  });
  if (G?.slot?.pending?.legendId) set.add(G.slot.pending.legendId);
  return set;
}

export function instantiateLegendGirl(lg) {
  const h = {
    id: uid(),
    legendId: lg.id,
    title: lg.title,
    acc: lg.acc,
    rarity: 5,
    name: lg.name,
    body: lg.body,
    looks: lg.looks,
    att: lg.att,
    hair: lg.hair,
    skin: lg.skin,
    dress: lg.dress,
    reviews: [],
    en: 100,
    mood: 85,
    pop: 30,
    on: true,
    streak: 0,
    hs: 0,
    lt: 1,
    pr: 30,
    refused: 0,
    loyalUntil: 0,
    traits: lg.traits.slice(),
  };
  h.wage = hWage(h);
  return h;
}

export function toggleSlotLock(G, reelIdx, toastFn) {
  if (!G?.slot) return false;
  const def = SLOT_LEVELS[G.slot.lv] || SLOT_LEVELS[1];
  if (!def.lockAllowed) {
    toastFn?.('请先将机台升到 Lv.2「改装霓虹机」才能解锁锁轴重转！');
    return false;
  }
  if (reelIdx < 0 || reelIdx > 2) return false;
  G.slot.locks = G.slot.locks || [false, false, false];
  if (!G.slot.locks[reelIdx] && G.slot.locks.filter(Boolean).length >= 2) {
    toastFn?.('最多只能同时锁定 2 根转轴，至少保留 1 根转轴旋转');
    return false;
  }
  G.slot.locks[reelIdx] = !G.slot.locks[reelIdx];
  AU.sfx(G.slot.locks[reelIdx] ? 'toggle-switch-on' : 'toggle-switch-off');
  return true;
}

export function upgradeSlotMachine(G, payFn, toastFn) {
  if (!G?.slot) return false;
  const cur = G.slot.lv || 1;
  const def = SLOT_LEVELS[cur];
  if (!def || !def.upCost || cur >= 4) {
    toastFn?.('霓虹招募机已升至满级 Lv.4 黄金大亨机！');
    return false;
  }
  if (!payFn(def.upCost)) return false;
  G.slot.lv = cur + 1;
  if (G.slot.lv === 3) G.slot.freeLeft = (G.slot.freeLeft || 0) + 1;
  AU.sfx('confirm-unlock');
  const nextDef = SLOT_LEVELS[G.slot.lv];
  toastFn?.(`🎰 招募机升级为 Lv.${nextDef.lv}「${nextDef.cn}」！${nextDef.desc}`);
  return true;
}

export function spinSlotMachine(G, targetBar, payFn, toastFn, confettiFn) {
  if (!G) return null;
  if (!G.slot) G.slot = createInitialSlot(G.codexGirls);
  const s = G.slot;
  const def = SLOT_LEVELS[s.lv] || SLOT_LEVELS[1];
  const cost = spinCost(s, G.codexWhales);
  if (cost.total > 0 && !payFn(cost.total)) return null;

  if (s.freeLeft > 0) s.freeLeft--;
  else s.paidSpinsToday = (s.paidSpinsToday || 0) + 1;

  s.locks = s.locks || [false, false, false];
  s.reels = s.reels || [0, 0, 0];

  const boostHigh = !!G.codexWhales?.bella_v?.unlocked;
  const pityHit = (s.pity || 0) >= def.pityMax - 1;

  if (pityHit) {
    s.reels[0] = 4;
  } else if (!s.locks[0]) {
    s.reels[0] = pickWeightedTier(def.weights, boostHigh) - 1;
  }
  if (!s.locks[1]) {
    const rMid = R() * 100;
    s.reels[1] = rMid < 43 ? 0 : rMid < 86 ? 1 : 2;
  }
  if (!s.locks[2]) s.reels[2] = (R() * REEL_RIGHT.length) | 0;

  let tier = clamp((s.reels[0] || 0) + 1, 1, 5);
  const mid = REEL_MID[s.reels[1]] || REEL_MID[0];
  const right = REEL_RIGHT[s.reels[2]] || REEL_RIGHT[0];

  let h = null;
  if (tier === 5) {
    const used = employedLegendIds(G);
    const uncollected = LEGEND_GIRLS.filter((lg) => !used.has(lg.id) && !G.codexGirls?.[lg.id]);
    const avail = uncollected.length ? uncollected : LEGEND_GIRLS.filter((lg) => !used.has(lg.id));
    if (avail.length) {
      const lg = pick(avail);
      h = instantiateLegendGirl(lg);
      G.codexGirls = G.codexGirls || {};
      const isNew = !G.codexGirls[lg.id];
      G.codexGirls[lg.id] = true;
      s.pity = 0;
      s.lastJackpot = true;
      AU.sfx('achievement');
      const cx = targetBar ? (targetBar.x0 + targetBar.x1) / 2 : 17.5;
      const cy = targetBar ? (targetBar.y0 + targetBar.y1) / 2 : 18;
      confettiFn?.(cx, cy, 2.4);
      toastFn?.(`🌟 JACKPOT！摇出 5 等传奇名花【${lg.name} · ${lg.title}】${isNew ? '（已收录女子图鉴！）' : '！'}`);
    } else {
      // All 12 legendaries already on roster — award top Tier-4 star + cash bonus
      tier = 4;
      s.reels[0] = 3;
      s.pity = 0;
      s.lastJackpot = false;
      G.money += 800;
      toastFn?.('🌟 12 位传奇名花已全员在岗，机台转化为 4 等满配头牌 + Rp 800k 礼金！');
    }
  }

  if (!h) {
    const spec = RARITY_TIERS[tier];
    const [lo, hi] = spec.stat;
    const rollStat = () => clamp(Math.round(lo + R() * (hi - lo)), 1, 10);
    const traits = [];
    if (spec.traits >= 1) traits.push(right.id);
    if (spec.traits >= 2 || (tier === 3 && R() < 0.35)) {
      const extraPool = TRAIT_KEYS.filter((k) => !traits.includes(k));
      if (extraPool.length) traits.push(pick(extraPool));
    }
    const existingNames = new Set(Object.values(G.mine || {}).flatMap((b) => (b.hostesses || []).map((x) => x.name)));
    const namePool = HNAMES.filter((n) => !existingNames.has(n));
    h = {
      id: uid(),
      rarity: tier,
      name: pick(namePool.length ? namePool : HNAMES),
      body: mid.body,
      looks: rollStat(),
      att: rollStat(),
      hair: pick(HAIRS),
      skin: pick(SKINS),
      dress: pick(DRESS),
      reviews: [],
      en: 100,
      mood: 75,
      pop: tier >= 4 ? 12 : tier === 3 ? 4 : 0,
      on: true,
      streak: 0,
      hs: (R() * 4) | 0,
      lt: 0,
      pr: 0,
      refused: 0,
      loyalUntil: 0,
      traits,
    };
    h.wage = hWage(h);
    s.pity = (s.pity || 0) + 1;
    s.lastJackpot = false;
    AU.sfx(tier >= 4 ? 'level-up' : 'pop-bubble');
  }

  s.pending = h;
  return h;
}

/* ---------- 4. Roster Buff Synergies & Clashes ---------- */
export const SYNERGIES = [
  { id: 'box_gold', icon: '🎶', cn: '销金包厢', req: '歌姬 + 酒神', desc: '包厢转化 +25%，洋酒与加钟率 +20%' },
  { id: 'hometown', icon: '🌏', cn: '异乡温柔乡', req: '2 多语通 + 1 甜心', desc: '台/中客进店 +18%，熟客转化大涨' },
  { id: 'party_crew', icon: '🍻', cn: '不夜狂欢', req: '酒神/划拳王 ≥ 3', desc: '点酒频率 +28%，啤酒桶概率 +20%' },
  { id: 'balance_body', icon: '🌸', cn: '环肥燕瘦', req: '苗条≥2 且 丰满≥2', desc: '全店选人好感 +0.9，大幅减少没合眼缘流失' },
  { id: 'high_society', icon: '💎', cn: '名媛排面', req: '2 高岭之花（无划拳王）', desc: '合理酒价上限 +20%，香槟塔概率 +10%' },
  { id: 'star_moon', icon: '👑', cn: '众星捧月', req: '恰好 1 名花/C位 + ≥3 常规', desc: '核心王牌钟点费 +25%，全员每日心情 +5' },
];

export const CLASHES = [
  { id: 'two_queens', icon: '⚡', cn: '一山不容二虎', desc: '同店上阵多名 5 等名花或话题C位争宠，客评下降且次日心情 -12', fix: '建议开分店并将名花/C位分流至不同门店各自镇场' },
  { id: 'noble_rowdy', icon: '🧊', cn: '雅俗相冲', desc: '高岭之花与划拳王同场互相嫌弃，两者特质暂失效且满意度 -0.5', fix: '错开排班或分别调去定位不同的门店' },
  { id: 'gossip_drama', icon: '💢', cn: '八卦内耗', desc: '小团队扎堆【八面情报】传闲话，体力消耗 +22% 且次日心情 -7', fix: '增补上岗人数或将情报公关错峰轮休' },
];

export function evalBarSynergy(l) {
  const mods = {
    roomProbMul: 1, whiskyBonus: 0, extBonus: 0,
    taiCnEnterMul: 1, regBonus: 0,
    drinkSpeedMul: 1, bucketBonus: 0,
    choiceBonus: 0,
    fairMul: 1, champBonus: 0,
    centerFeeMul: 1, dailyMoodBonus: 0,
    attPenalty: 0, satPenalty: 0, enDrainMul: 1, morningMoodPenalty: 0,
    disableNobleRowdy: false, twoQueensClash: false,
  };
  const empty = { synergies: [], clashes: [], ids: [], clashIds: [], mods };
  if (!l || !l.hostesses) return empty;

  const active = l.hostesses.filter(onDuty);
  if (!active.length) return empty;

  const cnt = {};
  TRAIT_KEYS.forEach((k) => { cnt[k] = 0; });
  let slim = 0;
  let curvy = 0;
  let legendCount = 0;
  let nonLegendDiva = 0;
  let centerCount = 0;
  let supportCount = 0;

  for (let i = 0; i < active.length; i++) {
    const h = active[i];
    if (h.body === 'prime') { slim++; curvy++; }
    else if (h.body === 'slim') slim++;
    else curvy++;
    const ts = h.traits || [];
    for (let j = 0; j < ts.length; j++) {
      cnt[ts[j]] = (cnt[ts[j]] || 0) + 1;
    }
    const isLeg = (h.rarity || (h.legendId ? 5 : 2)) === 5;
    const isDiva = ts.includes('diva');
    if (isLeg) legendCount++;
    else if (isDiva) nonLegendDiva++;
    if (isLeg || isDiva) centerCount++;
    else if ((h.rarity || 2) <= 3) supportCount++;
  }

  const synergies = [];
  const clashes = [];

  // Clashes first (so noble_rowdy can disable noble/rowdy traits cleanly)
  if (legendCount >= 2 || (cnt.diva || 0) >= 2 || (legendCount >= 1 && nonLegendDiva >= 1)) {
    clashes.push(CLASHES[0]);
    mods.twoQueensClash = true;
    mods.attPenalty += 1.8;
    mods.morningMoodPenalty += 12;
  }
  if ((cnt.noble || 0) >= 1 && (cnt.rowdy || 0) >= 1) {
    clashes.push(CLASHES[1]);
    mods.disableNobleRowdy = true;
    mods.satPenalty += 0.5;
  }
  if ((cnt.gossip || 0) >= 2 || ((cnt.gossip || 0) >= 1 && (cnt.sweet || 0) >= 1 && active.length >= 2 && active.length <= 5)) {
    clashes.push(CLASHES[2]);
    mods.enDrainMul *= 1.22;
    mods.morningMoodPenalty += 7;
  }

  // Positive Synergies
  if ((cnt.singer || 0) >= 1 && (cnt.drinker || 0) >= 1) {
    synergies.push(SYNERGIES[0]);
    mods.roomProbMul *= 1.25;
    mods.whiskyBonus += 0.25;
    mods.extBonus += 0.2;
  }
  if ((cnt.polyglot || 0) >= 2 && (cnt.sweet || 0) >= 1) {
    synergies.push(SYNERGIES[1]);
    mods.taiCnEnterMul *= 1.18;
    mods.regBonus += 0.5;
  }
  if ((cnt.drinker || 0) + (cnt.rowdy || 0) >= 3) {
    synergies.push(SYNERGIES[2]);
    mods.drinkSpeedMul *= 1.28;
    mods.bucketBonus += 0.2;
  }
  if (slim >= 2 && curvy >= 2) {
    synergies.push(SYNERGIES[3]);
    mods.choiceBonus += 0.9;
  }
  if ((cnt.noble || 0) >= 2 && !mods.disableNobleRowdy) {
    synergies.push(SYNERGIES[4]);
    mods.fairMul *= 1.2;
    mods.champBonus += 0.1;
  }
  if (centerCount === 1 && supportCount >= 3 && !mods.twoQueensClash) {
    synergies.push(SYNERGIES[5]);
    mods.centerFeeMul *= 1.25;
    mods.dailyMoodBonus += 5;
  }

  return {
    synergies,
    clashes,
    ids: synergies.map((s) => s.id),
    clashIds: clashes.map((c) => c.id),
    mods,
  };
}

/* ---------- 5. 《夜街金主图鉴》 — 8 Named Whales & Lure Conditions ---------- */
export const WHALES = [
  {
    id: 'hendra', name: 'Pak Hendra', title: '棕榈油大亨', ctype: 'local', n: 3, tip: 3600,
    skin: '#B98562', hair: '#2b211b', shirt: '#3F4A5A',
    clueCn: '商务 KTV 定位 + 激活【🎶销金包厢】+ 上架【黑牌洋酒】',
    perkCn: '满 3 次永久解锁：每周街道保护费 -25%',
    matches: (l, syn) => l.concept === 'ktv' && syn.ids.includes('box_gold') && !!l.menu?.whisky,
  },
  {
    id: 'zhang', name: '张厂长', title: '工业园台商领队', ctype: 'tai', n: 4, tip: 4200,
    skin: '#E0B08A', hair: '#1f1a18', shirt: '#F0E8D6',
    clueCn: '包厢 ≥ Lv.1 + 激活【🌏异乡温柔乡】+ 在岗有 Mei Ling 或 4 等以上头牌',
    perkCn: '满 3 次永久解锁：台客进店率 +15%，VIP/金主小费 +15%',
    matches: (l, syn) => (l.rooms || 0) >= 1 && syn.ids.includes('hometown') && activeH_r(l).some((h) => h.legendId === 'meiling' || (h.rarity || 2) >= 4),
  },
  {
    id: 'chen', name: '陈大鳄', title: '雅加达地产金主', ctype: 'cn', n: 2, tip: 4600,
    skin: '#E0B08A', hair: '#2b211b', shirt: '#2F261E',
    clueCn: '装修 ≥ Lv.2 + 激活【💎名媛排面】+ 酒价 ≥ Rp 55k',
    perkCn: '满 3 次永久解锁：全店日租 -15%，收购同行费用 -10%',
    matches: (l, syn) => (l.decor || 0) >= 2 && syn.ids.includes('high_society') && (l.price || 0) >= 55,
  },
  {
    id: 'joko', name: 'Komandan Joko', title: '休班高阶警司', ctype: 'local', n: 2, tip: 3200,
    skin: '#C99670', hair: '#1f1a18', shirt: '#265385',
    clueCn: '配备 ≥ 1 名保安 + 零阵容冲突 + 在岗有 Kirana / Nadia 或 ≥ 3 等高素养公关',
    perkCn: '满 3 次永久解锁：临检当日晨会精准预告具体时分',
    matches: (l, syn) => (l.bouncers || []).length >= 1 && syn.clashes.length === 0 && activeH_r(l).some((h) => h.legendId === 'kirana' || h.legendId === 'nadia' || ((h.rarity || 2) >= 3 && h.att >= 7)),
  },
  {
    id: 'kevin', name: 'Kevin 吴少', title: '潮玩夜店玩家', ctype: 'cn', n: 3, tip: 4800,
    skin: '#E0B08A', hair: '#3a2a20', shirt: '#C8574B',
    clueCn: '潮玩 Club 定位（或请 DJ）+ 上架【黄金香槟塔】+ 在岗有 Citra 或【话题C位】',
    perkCn: '满 3 次永久解锁：全店黄金香槟塔触发率 +12%',
    matches: (l) => (l.concept === 'club' || l.dj) && !!l.menu?.champagne && activeH_r(l).some((h) => h.legendId === 'citra' || (h.traits || []).includes('diva')),
  },
  {
    id: 'lim', name: 'Pak Lim', title: '班芝兰批发商老大', ctype: 'local', n: 3, tip: 3400,
    skin: '#C99670', hair: '#2b211b', shirt: '#8A5A3B',
    clueCn: '激活【🍻不夜狂欢】+ 上架【冰镇啤酒桶】+ 在岗有 3 等以上丰满公关',
    perkCn: '满 3 次永久解锁：熟客流失率减半，新台/中熟客多来 2 天',
    matches: (l, syn) => syn.ids.includes('party_crew') && !!l.menu?.bucket && activeH_r(l).some((h) => h.body === 'curvy' && (h.rarity || 2) >= 3),
  },
  {
    id: 'bella_v', name: 'Ibu Maya', title: '东南亚娱乐教母', ctype: 'tai', n: 2, tip: 4500,
    skin: '#D7A47C', hair: '#3a2a20', shirt: '#8A6FA8',
    clueCn: '激活【👑众星捧月】（或 5 等名花带 ≥ 3 姐妹无冲突同台）',
    perkCn: '满 3 次永久解锁：老虎机锁轴费用降至 120k，4/5 等概率上升',
    matches: (l, syn) => syn.ids.includes('star_moon') || (syn.clashes.length === 0 && activeH_r(l).length >= 4 && activeH_r(l).some((h) => (h.rarity || 2) === 5)),
  },
  {
    id: 'sultan', name: 'Sultan Arif', title: '加里曼丹矿业船王', ctype: 'cn', n: 4, tip: 6500,
    skin: '#C99670', hair: '#1f1a18', shirt: '#E2B24A',
    clueCn: '包厢 ≥ Lv.2 + 激活【🌸环肥燕瘦】+ 在岗至少 1 位 5 等传奇名花',
    perkCn: '满 3 次永久解锁：全店所有公关钟点费永久 +15%',
    matches: (l, syn) => (l.rooms || 0) >= 2 && syn.ids.includes('balance_body') && activeH_r(l).some((h) => (h.rarity || 2) === 5),
  },
];

function activeH_r(l) {
  return (l?.hostesses || []).filter(onDuty);
}

export const WHALE_MAP = Object.fromEntries(WHALES.map((w) => [w.id, w]));

export function whalePerkBonuses(codexWhales) {
  const cw = codexWhales || {};
  const has = (id) => !!(cw[id]?.unlocked || (cw[id]?.visits || 0) >= 3);
  return {
    unlockedCount: WHALES.filter((w) => has(w.id)).length,
    feeMul: has('sultan') ? 1.15 : 1.0,
    protectionMul: has('hendra') ? 0.75 : 1.0,
    taiEnterMul: has('zhang') ? 1.15 : 1.0,
    vipTipMul: has('zhang') ? 1.15 : 1.0,
    rentMul: has('chen') ? 0.85 : 1.0,
    buyoutMul: has('chen') ? 0.9 : 1.0,
    raidForewarn: has('joko'),
    champBonus: has('kevin') ? 0.12 : 0,
    regDefectMul: has('lim') ? 0.5 : 1.0,
    regExtraDays: has('lim') ? 2 : 0,
    slotLockCost: has('bella_v') ? 120 : 250,
    slotBoostHigh: has('bella_v'),
  };
}

export function barMatchedWhales(l, G) {
  if (!l || l.kind !== 'mine') return [];
  const syn = evalBarSynergy(l);
  return WHALES.filter((w) => w.matches(l, syn, G));
}

export function findLuredWhale(G) {
  const mineBars = Object.values(G?.mine || {}).filter((b) => b.kind === 'mine');
  if (!mineBars.length) return null;
  const cw = G.codexWhales || {};
  const candidates = [];
  for (let i = 0; i < mineBars.length; i++) {
    const l = mineBars[i];
    const matched = barMatchedWhales(l, G);
    for (let j = 0; j < matched.length; j++) {
      const w = matched[j];
      const unlocked = !!(cw[w.id]?.unlocked);
      candidates.push({ whale: w, bar: l, weight: unlocked ? 1 : 4 });
    }
  }
  if (!candidates.length) return null;
  // Prefer uncollected whales so daytime luring pays off immediately
  const uncollected = candidates.filter((c) => !cw[c.whale.id]?.unlocked);
  const pool = uncollected.length ? uncollected : candidates;
  const chosen = pick(pool);
  return { whale: chosen.whale, bar: chosen.bar };
}

/* ---------- 6. Morning Brief Real Customer Voices ---------- */
export function createEmptyVoices() {
  return {
    priceSkipLocal: 0,
    priceSkipTai: 0,
    priceSkipCn: 0,
    noSlim: 0,
    noCurvy: 0,
    roomFull: 0,
    waitLeft: 0,
    seatFull: 0,
    stolen: 0,
    missedWhisky: 0,
    clashMood: 0,
    happyPraise: 0,
  };
}

export function compileCustomerVoices(barList, G) {
  const candidates = [];
  for (let i = 0; i < barList.length; i++) {
    const l = barList[i];
    const v = l.today?.voices || createEmptyVoices();
    const syn = evalBarSynergy(l);

    if (v.priceSkipLocal + v.priceSkipTai + v.priceSkipCn >= 4) {
      const total = v.priceSkipLocal + v.priceSkipTai + v.priceSkipCn;
      const isLocalMain = v.priceSkipLocal >= v.priceSkipTai && v.priceSkipLocal >= v.priceSkipCn;
      const ct = isLocalMain ? 'local' : v.priceSkipTai >= v.priceSkipCn ? 'tai' : 'cn';
      candidates.push({
        severity: total * 2,
        ctype: ct,
        who: isLocalMain ? '路过土客 Budi' : ct === 'tai' ? '路过台客林兄' : '路过中客赵总',
        skin: CT[ct].shirts ? '#D7A47C' : '#C99670',
        hair: '#2b211b',
        shirt: CT[ct].shirts[0],
        barName: l.name,
        text: `「${l.name} 啤酒标到 ${fm(l.price)}，看一眼装修就转身去隔壁喝了（昨夜劝退 ${total} 人）。」`,
        hint: '建议：适当下调酒价或升级店铺装修',
      });
    }
    if (v.noSlim >= 2) {
      candidates.push({
        severity: v.noSlim * 4,
        ctype: 'tai',
        who: '台客阿哲一行',
        skin: '#E0B08A',
        hair: '#1f1a18',
        shirt: CT.tai.shirts[0],
        barName: l.name,
        text: `「带兄弟冲 ${l.name} 找苗条妹妹，结果一轮没挑到合眼缘的（流失 ${v.noSlim} 位）。」`,
        hint: '建议：用老虎机锁中轴【苗条】多补几名妹妹',
      });
    }
    if (v.noCurvy >= 2) {
      candidates.push({
        severity: v.noCurvy * 3.5,
        ctype: 'local',
        who: '常客 Agus',
        skin: '#B98562',
        hair: '#2b211b',
        shirt: CT.local.shirts[0],
        barName: l.name,
        text: `「${l.name} 丰满型公关太少了，点完两瓶啤酒就早早走了（流失 ${v.noCurvy} 位）。」`,
        hint: '建议：用老虎机锁中轴【丰满】补招班底',
      });
    }
    if (v.roomFull >= 2) {
      candidates.push({
        severity: v.roomFull * 5,
        ctype: 'cn',
        who: '中客陈先生',
        skin: '#E0B08A',
        hair: '#2b211b',
        shirt: CT.cn.shirts[0],
        barName: l.name,
        text: `「本来想开包厢多留几个钟点，结果包厢全满只能直接结账走人（损失 ${v.roomFull} 单）。」`,
        hint: '建议：升级「楼上包厢」扩容，接住高客单',
      });
    }
    if (v.waitLeft >= 2) {
      candidates.push({
        severity: v.waitLeft * 4.5,
        ctype: 'tai',
        who: '散台候场客人',
        skin: '#D7A47C',
        hair: '#3a2a20',
        shirt: CT.tai.shirts[1],
        barName: l.name,
        text: `「在 ${l.name} 干等了半小时都没闲着的小妹过来陪酒，只好买单撤了（走掉 ${v.waitLeft} 位）。」`,
        hint: '建议：多签公关或排班时避免过度减员',
      });
    }
    if (v.seatFull >= 3) {
      candidates.push({
        severity: v.seatFull * 3,
        ctype: 'local',
        who: '门前排队的客人',
        skin: '#C99670',
        hair: '#1f1a18',
        shirt: CT.local.shirts[2],
        barName: l.name,
        text: `「${l.name} 门口路过想进来喝一杯，里面卡座全坐满了进不去（满座 ${v.seatFull} 人）。」`,
        hint: '建议：升级「座位」增加散桌与沙发卡座',
      });
    }
    if (v.stolen >= 2) {
      candidates.push({
        severity: v.stolen * 4,
        ctype: 'tai',
        who: '差点进门的散客',
        skin: '#E0B08A',
        hair: '#2b211b',
        shirt: CT.tai.shirts[3],
        barName: l.name,
        text: `「本来都走到 ${l.name} 门口了，结果被隔壁拉客仔强行拉走（被截 ${v.stolen} 人）。」`,
        hint: '建议：去团队页雇佣保安看场防截胡',
      });
    }
    if (v.clashMood > 0 || syn.clashes.length > 0) {
      const firstClash = syn.clashes[0];
      candidates.push({
        severity: 12,
        ctype: 'cn',
        who: '包厢老熟客',
        skin: '#E0B08A',
        hair: '#2b211b',
        shirt: CT.cn.shirts[1],
        barName: l.name,
        text: `「昨晚 ${l.name} 姐妹们之间气氛有点僵（${firstClash ? firstClash.cn : '阵容冲突'}），服务明显受影响了。」`,
        hint: firstClash ? firstClash.fix : '建议：调整排班错开互斥特质或分流到分店',
      });
    }
    if (v.missedWhisky >= 2) {
      candidates.push({
        severity: v.missedWhisky * 2.5,
        ctype: 'cn',
        who: '包厢大客',
        skin: '#E0B08A',
        hair: '#1f1a18',
        shirt: CT.cn.shirts[2],
        barName: l.name,
        text: `「进包厢想点瓶黑牌洋酒助兴，酒单上还没上架（错失 ${v.missedWhisky} 笔高毛利大酒）。」`,
        hint: '建议：升级页解锁「黑牌洋酒套餐」或「黄金香槟塔」',
      });
    }
    if (v.happyPraise >= 2) {
      candidates.push({
        severity: 2,
        ctype: 'cn',
        who: '满意离店的熟客',
        skin: '#E0B08A',
        hair: '#2b211b',
        shirt: CT.cn.shirts[0],
        barName: l.name,
        text: `「${l.name} 昨晚氛围和妹妹服务都到位（收获 ${v.happyPraise} 次好评），今晚还带朋友捧场！」`,
        hint: '经营节奏顺畅：可尝试配阵容设局诱捕未解锁金主',
      });
    }
  }

  candidates.sort((a, b) => b.severity - a.severity);
  const picked = candidates.slice(0, 3);
  if (!picked.length && barList.length) {
    const b = barList[0];
    picked.push({
      severity: 1,
      ctype: 'local',
      who: '夜市巡街老客',
      skin: '#C99670',
      hair: '#2b211b',
      shirt: CT.local.shirts[0],
      barName: b.name,
      text: `「${b.name} 昨晚运转平稳，暂未收到明显投诉。多留意金主线索图鉴，今晚会有意外惊喜。」`,
      hint: '白天可用招募机摇奖攒班底、搭配双羁绊！',
    });
  }
  return picked;
}
