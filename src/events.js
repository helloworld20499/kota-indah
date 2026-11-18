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
    title: '豪客斗酒',
    desc: '卡座阔少正比拼排面',
    optA: { label: '推香槟塔', hint: '72% +600k · 口碑↑' },
    optB: { label: '稳妥上酒', hint: '+120k · 稳妥增收' },
    resolve(choice, l, toastFn, confettiFn) {
      if (choice === 'A') {
        if (Math.random() < 0.72) {
          G.money += 600;
          l.today.drink += 600;
          l.rep = Math.min(5, l.rep + 0.08);
          G.fx.push({ x: (l.x0 + l.x1) / 2, y: (l.y0 + l.y1) / 2, z: 16, t: '+600k 🍾', life: 6, col: '#E8B959' });
          confettiFn?.((l.x0 + l.x1) / 2, (l.y0 + l.y1) / 2, 2.2);
          AU.sfx('coin-double');
          toastFn(`${l.name}：豪客爽快开了香槟塔，+Rp 600k！`);
        } else {
          G.money += 80;
          l.today.drink += 80;
          l.hostesses.forEach((h) => { if (h.on) h.mood = clamp(h.mood - 2, 0, 100); });
          AU.sfx('pop-bubble');
          toastFn(`${l.name}：客人嫌贵改点啤酒 (+Rp 80k)`);
        }
      } else {
        G.money += 120;
        l.today.drink += 120;
        l.rep = Math.min(5, l.rep + 0.03);
        AU.sfx('coin-collect');
        toastFn(`${l.name}：稳妥上招牌啤酒 (+Rp 120k)`);
      }
    },
  },
  {
    id: 'drunk_harass',
    icon: '💢',
    title: '醉汉闹事',
    desc: '醉客纠缠公关引围观',
    optA: { label: '保安清场', hint: '有保安 心情↑ / 无 口碑↓' },
    optB: { label: '礼貌劝离', hint: '+0k · 平安无损' },
    resolve(choice, l, toastFn) {
      if (choice === 'A') {
        if ((l.bouncers || []).length > 0) {
          l.hostesses.forEach((h) => { if (h.on) h.mood = clamp(h.mood + 10, 0, 100); });
          l.rep = Math.min(5, l.rep + 0.06);
          l.today.bounced = (l.today.bounced || 0) + 1;
          G.stats.totalBounced = (G.stats.totalBounced || 0) + 1;
          AU.sfx('confirm-unlock');
          toastFn(`🛡️ ${l.name} 保安清场成功，全员心情上升`);
        } else {
          l.rep = Math.max(1, l.rep - 0.12);
          l.hostesses.forEach((h) => { if (h.on) h.mood = clamp(h.mood - 8, 0, 100); });
          AU.sfx('error-soft-thud');
          toastFn(`${l.name} 无保安镇场，公关受委屈`);
        }
      } else {
        AU.sfx('pop-bubble');
        toastFn(`${l.name}：店员礼貌劝离醉客，现场平安无事`);
      }
    },
  },
  {
    id: 'jakarta_blogger',
    icon: '📱',
    title: '博主探店',
    desc: '夜生活博主进店打卡',
    optA: { label: '免单招待', hint: '-500k · 明日人气+35%' },
    optB: { label: '正常接待', hint: '+140k 酒水' },
    resolve(choice, l, toastFn) {
      if (choice === 'A') {
        G.money -= 500;
        G.spent += 500;
        l.rep = Math.min(5, l.rep + 0.25);
        G.ev.nextBloggerBoost = true;
        AU.sfx('achievement');
        toastFn(`📱 博主点赞 ${l.name}，明日全街人气 +35%！`);
      } else {
        G.money += 140;
        l.today.drink += 140;
        AU.sfx('coin-collect');
        toastFn(`${l.name} 正常接待，+Rp 140k`);
      }
    },
  },
  {
    id: 'vip_regular_favor',
    icon: '💎',
    title: '熟客求包厢',
    desc: '常客带朋友想插队包厢',
    optA: { label: '腾出包厢', hint: '有空房 +450k · 熟客+1' },
    optB: { label: '迎宾婉拒', hint: '+60k · 稳妥' },
    resolve(choice, l, toastFn) {
      if (choice === 'A') {
        if (l.roomsUsed < ROOMS[l.rooms || 0]) {
          G.money += 450;
          l.today.hfee += 450;
          l.rep = Math.min(5, l.rep + 0.08);
          G.regs.push({ id: 'rf' + Date.now(), type: 'tai', bar: l.i, n: 2, days: 3 });
          l.today.newRegs++;
          G.fx.push({ x: (l.x0 + l.x1) / 2, y: (l.y0 + l.y1) / 2, z: 15, t: '+450k 💎', life: 6, col: '#E8B959' });
          AU.sfx('coin-double');
          toastFn(`💎 熟客打赏 ${fm(450)}，带来新熟客！`);
        } else {
          l.rep = Math.max(1, l.rep - 0.06);
          AU.sfx('error-soft-thud');
          toastFn(`${l.name} 包厢已满，熟客扫兴离开`);
        }
      } else {
        G.money += 60;
        l.today.drink += 60;
        AU.sfx('pop-bubble');
        toastFn(`熟客入座大厅 (+Rp 60k)`);
      }
    },
  },
  {
    id: 'wandering_singer',
    icon: '🎤',
    title: '驻唱歌手试音',
    desc: '街头歌者想借麦献唱热场',
    optA: { label: '签约助唱一小时', hint: '-220k · 心情+12 · 口碑↑' },
    optB: { label: '请喝两杯交朋友', hint: '+40k · 和气生财' },
    resolve(choice, l, toastFn) {
      if (choice === 'A') {
        G.money -= 220;
        G.spent += 220;
        l.rep = Math.min(5, l.rep + 0.12);
        l.hostesses.forEach((h) => { if (h.on) h.mood = clamp(h.mood + 12, 0, 100); });
        AU.sfx('level-up');
        toastFn(`🎤 ${l.name} 现场 Live 炸裂，全员心情与口碑齐升！`);
      } else {
        G.money += 40;
        l.today.drink += 40;
        AU.sfx('pop-bubble');
        toastFn(`${l.name} 礼貌致意 (+Rp 40k)`);
      }
    },
  },
  {
    id: 'bachelor_party',
    icon: '🥳',
    title: '兄弟团庆生',
    desc: '整桌台客突发奇想搞派对',
    optA: { label: '加码布置派对', hint: '净赚 +360k · 礼花助兴' },
    optB: { label: '送上生日特调', hint: '+150k · 稳妥加单' },
    resolve(choice, l, toastFn, confettiFn) {
      if (choice === 'A') {
        G.money += 360;
        l.today.drink += 480;
        l.today.cogs += 120;
        l.rep = Math.min(5, l.rep + 0.08);
        G.fx.push({ x: (l.x0 + l.x1) / 2, y: (l.y0 + l.y1) / 2, z: 15, t: '+360k 🥳', life: 6, col: '#E8B959' });
        confettiFn?.((l.x0 + l.x1) / 2, (l.y0 + l.y1) / 2, 2.0);
        AU.sfx('coin-double');
        toastFn(`🥳 ${l.name} 派对大赚 Rp 360k，客人超满意！`);
      } else {
        G.money += 150;
        l.today.drink += 150;
        AU.sfx('coin-collect');
        toastFn(`🎂 赠送生日特调，客人加单 +Rp 150k`);
      }
    },
  },
  {
    id: 'rainy_taxi_drop',
    icon: '🚕',
    title: '夜班商旅路过',
    desc: '门口停下两辆网约车散客',
    optA: { label: '保安热情迎宾', hint: '有保安 +360k / 无 +120k' },
    optB: { label: '亮灯自然迎客', hint: '+90k · 零操心顺手单' },
    resolve(choice, l, toastFn) {
      if (choice === 'A') {
        const bonus = (l.bouncers || []).length > 0 ? 360 : 120;
        G.money += bonus;
        l.today.drink += bonus;
        l.rep = Math.min(5, l.rep + 0.05);
        AU.sfx('coin-collect');
        toastFn(`🚕 ${l.name} 迎进商旅团，顺手创收 ${fm(bonus)}！`);
      } else {
        G.money += 90;
        l.today.drink += 90;
        AU.sfx('pop-bubble');
        toastFn(`${l.name} 顺手接单 +Rp 90k`);
      }
    },
  },
  {
    id: 'luxury_watch_lost',
    icon: '⌚',
    title: '卡座失物招领',
    desc: '保洁在沙发缝捡到一块名表',
    optA: { label: '专人寻回还老板', hint: '+200k 谢礼 · 口碑大涨 · 熟客+1' },
    optB: { label: '吧台妥善代管', hint: '+50k · 稳妥留好评' },
    resolve(choice, l, toastFn) {
      if (choice === 'A') {
        G.money += 200;
        l.today.hfee += 200;
        l.rep = Math.min(5, l.rep + 0.25);
        G.regs.push({ id: 'wt' + Date.now(), type: 'cn', bar: l.i, n: 1, days: 5 });
        l.today.newRegs++;
        AU.sfx('achievement');
        toastFn(`⌚ 老板重赏 Rp 200k 并记下 ${l.name} 人情，新增熟客！`);
      } else {
        G.money += 50;
        l.today.drink += 50;
        l.rep = Math.min(5, l.rep + 0.05);
        AU.sfx('pop-bubble');
        toastFn(`吧台登记失物，收获好评 (+Rp 50k)`);
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
