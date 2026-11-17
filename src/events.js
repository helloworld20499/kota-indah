import { ROOMS, SKILLS, clamp, fm, pick, rnd } from './config.js';
import { AU } from './audio.js';
import { G, bars } from './state.js';
import { barOpen, checkAchievements } from './sim.js';

export function activateSkill(l, skillId, payFn, toastFn) {
  const def = SKILLS[skillId];
  if (!l || !def) return false;
  if (!barOpen()) {
    toastFn('还没到 17:00 开门营业时间，开门后才能释放夜场技能');
    return false;
  }
  l.skills = l.skills || {
    happyHour: { activeUntil: 0, cdUntil: 0 },
    showtime: { activeUntil: 0, cdUntil: 0 },
    lowProfile: { activeUntil: 0, cdUntil: 0 },
  };
  const sk = l.skills[skillId];
  if (G.t < sk.activeUntil) {
    toastFn(`${def.cn} 正在生效中！`);
    return false;
  }
  if (G.t < sk.cdUntil) {
    toastFn(`${def.cn} 冷却中，还需 ${Math.ceil(sk.cdUntil - G.t)} 分钟`);
    return false;
  }
  if (def.cost > 0 && !payFn(def.cost)) return false;

  sk.activeUntil = G.t + def.dur;
  sk.cdUntil = G.t + def.cd;

  if (skillId === 'showtime') {
    l.hostesses.forEach((h) => {
      if (h.on && !h.sick) h.mood = clamp(h.mood + 8, 0, 100);
    });
    AU.sfx('level-up');
  } else if (skillId === 'lowProfile') {
    AU.sfx('toggle-switch-off');
  } else {
    AU.sfx('confirm-unlock');
  }

  toastFn(`${def.icon} ${l.name} 开启【${def.cn}】！（持续 ${def.dur} 分钟）`);
  return true;
}

const LIVE_TEMPLATES = [
  {
    id: 'rich_champagne',
    icon: '🍾',
    title: '阔少摆阔斗酒',
    desc: '卡座上一桌豪客喝嗨了，正跟朋友比谁更有排面！',
    optA: { label: '推销黄金香槟塔', hint: '72% 大赚 Rp 600k + 口碑，小概率嫌贵' },
    optB: { label: '赠送果盘助兴 (-Rp 80k)', hint: '稳妥拉满好感，必增回头客' },
    resolve(choice, l, toastFn, confettiFn) {
      if (choice === 'A') {
        if (Math.random() < 0.72) {
          G.money += 600;
          l.today.drink += 600;
          l.rep = Math.min(5, l.rep + 0.08);
          G.fx.push({ x: (l.x0 + l.x1) / 2, y: (l.y0 + l.y1) / 2, z: 16, t: '+600k 🍾', life: 6, col: '#E8B959' });
          confettiFn?.((l.x0 + l.x1) / 2, (l.y0 + l.y1) / 2, 2.2);
          AU.sfx('coin-double');
          toastFn(`${l.name}：豪客爽快开了黄金香槟塔，净赚 +Rp 600k！`);
        } else {
          G.money += 80;
          l.today.drink += 80;
          l.hostesses.forEach((h) => { if (h.on) h.mood = clamp(h.mood - 2, 0, 100); });
          AU.sfx('pop-bubble');
          toastFn(`${l.name}：客人觉得香槟太贵，改点了两瓶啤酒 (+Rp 80k)`);
        }
      } else {
        G.money -= 80;
        G.spent += 80;
        l.rep = Math.min(5, l.rep + 0.1);
        G.regs.push({ id: 'ev' + Date.now(), type: 'local', bar: l.i, n: 1, pers: 'extro', daily: true, pr: 0.75 });
        l.today.newRegs++;
        AU.sfx('confirm-unlock');
        toastFn(`${l.name}：赠送果盘赢得好评，这桌客人成了回头客！`);
      }
    },
  },
  {
    id: 'drunk_harass',
    icon: '💢',
    title: '醉客纠缠公关',
    desc: '门口附近有个喝多的大汉对公关动手动脚，周围客人在围观！',
    optA: { label: '派保安请出场外', hint: '有保安则完美解围(+心情+口碑)；无保安会丢口碑' },
    optB: { label: '老板亲自敬酒赔礼 (-Rp 150k)', hint: '稳妥花钱息事宁人' },
    resolve(choice, l, toastFn) {
      if (choice === 'A') {
        if ((l.bouncers || []).length > 0) {
          l.hostesses.forEach((h) => { if (h.on) h.mood = clamp(h.mood + 10, 0, 100); });
          l.rep = Math.min(5, l.rep + 0.06);
          l.today.bounced = (l.today.bounced || 0) + 1;
          G.stats.totalBounced = (G.stats.totalBounced || 0) + 1;
          AU.sfx('confirm-unlock');
          toastFn(`🛡️ ${l.name} 的保安果断请出闹事醉汉，公关们安全感拉满 (+10 心情)！`);
        } else {
          l.rep = Math.max(1, l.rep - 0.12);
          l.hostesses.forEach((h) => { if (h.on) h.mood = clamp(h.mood - 8, 0, 100); });
          AU.sfx('error-soft-thud');
          toastFn(`${l.name} 没有保安镇场，好不容易才劝走醉汉，公关受了委屈 (-8 心情)`);
        }
      } else {
        G.money -= 150;
        G.spent += 150;
        l.rep = Math.min(5, l.rep + 0.03);
        l.hostesses.forEach((h) => { if (h.on) h.mood = clamp(h.mood - 4, 0, 100); });
        AU.sfx('pop-bubble');
        toastFn(`${l.name}：老板出面送酒赔礼，花 Rp 150k 平息风波`);
      }
    },
  },
  {
    id: 'jakarta_blogger',
    icon: '📱',
    title: '雅加达探店博主进店',
    desc: '本地热门夜生活 IG 博主带摄影师进店打卡，询问有没有老板招待！',
    optA: { label: '免单 VIP 招待 (-Rp 500k)', hint: '本店口碑 +0.25，明日全街人气 +35%！' },
    optB: { label: '按普通客人正常接待', hint: '稳收正常酒水钱 (+Rp 140k)' },
    resolve(choice, l, toastFn) {
      if (choice === 'A') {
        G.money -= 500;
        G.spent += 500;
        l.rep = Math.min(5, l.rep + 0.25);
        G.ev.nextBloggerBoost = true;
        AU.sfx('achievement');
        toastFn(`📱 探店博主疯狂点赞 ${l.name}！明天全街人气将暴涨 +35%！`);
      } else {
        G.money += 140;
        l.today.drink += 140;
        AU.sfx('coin-collect');
        toastFn(`${l.name} 正常接待了博主一行，收入酒水 +Rp 140k`);
      }
    },
  },
  {
    id: 'vip_regular_favor',
    icon: '💎',
    title: '老熟客求插队包厢',
    desc: '常客带了几个商务朋友来，想马上安排一间包厢和一位红牌公关！',
    optA: { label: '优先协调包厢接待', hint: '若有空包厢获 +Rp 450k 小费 + 回头客' },
    optB: { label: '抱歉请按先来后到', hint: '送两杯迎宾酒 (+Rp 60k)，礼貌婉拒' },
    resolve(choice, l, toastFn) {
      if (choice === 'A') {
        if (l.roomsUsed < ROOMS[l.rooms || 0]) {
          G.money += 450;
          l.today.hfee += 450;
          l.rep = Math.min(5, l.rep + 0.08);
          G.regs.push({ id: 'rf' + Date.now(), type: 'tai', bar: l.i, n: 2, pers: 'extro', days: 3 });
          l.today.newRegs++;
          G.fx.push({ x: (l.x0 + l.x1) / 2, y: (l.y0 + l.y1) / 2, z: 15, t: '+450k 💎', life: 6, col: '#E8B959' });
          AU.sfx('coin-double');
          toastFn(`💎 熟客很给面子！额外打赏 ${fm(450)} 并带来新回头客！`);
        } else {
          l.rep = Math.max(1, l.rep - 0.06);
          AU.sfx('error-soft-thud');
          toastFn(`${l.name} 楼上包厢全满了，熟客有点扫兴地走了`);
        }
      } else {
        G.money += 60;
        l.today.drink += 60;
        AU.sfx('pop-bubble');
        toastFn(`熟客理解店里规矩，喝了两杯就先去大厅了 (+Rp 60k)`);
      }
    },
  },
];

export function triggerLiveEvent(onChanged) {
  const activeBars = bars().filter((l) => l._g.length > 0);
  if (!activeBars.length || G.liveEvent) return null;
  const bar = pick(activeBars);
  const tpl = pick(LIVE_TEMPLATES);
  G.liveEventsToday = (G.liveEventsToday || 0) + 1;
  G.liveEvent = {
    tplId: tpl.id,
    barIdx: bar.i,
    barName: bar.name,
    icon: tpl.icon,
    title: tpl.title,
    desc: tpl.desc,
    optA: tpl.optA,
    optB: tpl.optB,
    expiresAt: typeof performance !== 'undefined' ? performance.now() + 25000 : Date.now() + 25000,
    durMs: 25000,
  };
  AU.sfx('notification-ding');
  onChanged?.();
  return G.liveEvent;
}

export function resolveLiveEvent(choice, toastFn, confettiFn, onChanged) {
  if (!G || !G.liveEvent) return false;
  const ev = G.liveEvent;
  const tpl = LIVE_TEMPLATES.find((t) => t.id === ev.tplId);
  const l = G.lots[ev.barIdx];
  G.liveEvent = null;
  G.nextLiveAt = G.t + rnd(70, 125);
  if (tpl && l && l.kind === 'mine') {
    tpl.resolve(choice === 'A' ? 'A' : 'B', l, toastFn, confettiFn);
    G.stats.totalEventsOk = (G.stats.totalEventsOk || 0) + 1;
    checkAchievements();
  }
  onChanged?.();
  return true;
}

export function tickLiveEvent(toastFn, confettiFn, onChanged) {
  if (!G || !G.liveEvent) return;
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (now >= G.liveEvent.expiresAt) {
    resolveLiveEvent('B', toastFn, confettiFn, onChanged);
  }
}
