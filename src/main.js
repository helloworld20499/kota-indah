import {
  ACCENTS, BARNAMES, MAXH, UPG, esc, fm, onDuty,
} from './config.js';
import { AU, audioUI, dayTrack } from './audio.js';
import {
  G, allH, bars, freeSpot, mkHostess, newGame, placeH, placeM,
} from './state.js';
import {
  applyShiftPreset, buyMenuItem, buyoutRival, fireBouncer, giveHongbao, hireBouncer,
  hireSlotPending, poachRivalHostess, setBarConcept, trainHostess, transferHostess,
} from './economy.js';
import {
  ALL_REEL_SYMBOLS, rarityOf, spinSlotMachine, toggleSlotLock, upgradeSlotMachine,
} from './codex.js';
import {
  activateSkill, resolveLiveEvent, tickLiveEvent, triggerLiveEvent,
} from './events.js';
import {
  barOpen, checkAchievements, checkGoals, initSim, nextDay, scheduleRegs, setSimHooks,
  simHeadlessDays, skipToOpen, update,
} from './sim.js';
import { Scene3D } from './scene3d.js';
import { World3D } from './world3d.js';
import { Actors3D } from './actors3d.js';
import { LIGHT_MODES } from './themes.js';
import {
  live, priceHint, renderLiveEvent, renderPanel, renderSlotCell, showAchievementsModal,
  showBriefModal, showCodexModal, showEndDayModal, toast,
} from './ui.js';

const $ = (id) => document.getElementById(id);

let scene3d = null;
let world3d = null;
let actors3d = null;
let slotSpinCtrl = null;

function cancelSlotSpin() {
  if (!slotSpinCtrl) {
    if (G) G._slotSpinning = false;
    return;
  }
  slotSpinCtrl.timers.forEach((t) => clearTimeout(t));
  if (slotSpinCtrl.tickTimer) clearTimeout(slotSpinCtrl.tickTimer);
  slotSpinCtrl.anims.forEach((an) => { try { an.cancel(); } catch (_) {} });
  slotSpinCtrl = null;
  if (G) G._slotSpinning = false;
}

function burstSlotParticles(tier) {
  const canvas = $('slotFxCanvas');
  if (!canvas || !canvas.parentElement) return;
  const w = canvas.parentElement.clientWidth || 340;
  const h = canvas.parentElement.clientHeight || 110;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);

  const count = tier >= 5 ? 58 : tier === 4 ? 38 : tier === 3 ? 24 : 12;
  const palette = tier >= 5
    ? ['#F6D55C', '#E8B959', '#B5362F', '#FFF6D6', '#D05A9C']
    : tier === 4
      ? ['#9D5CD6', '#E8B959', '#D05A9C', '#FFFDF8']
      : ['#265385', '#1F6E5A', '#E8B959', '#C8574B'];

  const parts = Array.from({ length: count }, (_, i) => {
    const colX = (w / 6) * (1 + (i % 3) * 2);
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
    const spd = 2.2 + Math.random() * (tier >= 4 ? 5.2 : 3.6);
    return {
      x: colX + (Math.random() - 0.5) * 32,
      y: h * 0.55 + (Math.random() - 0.5) * 16,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - 1.2,
      sz: (tier >= 5 ? 4.5 : 3.5) + Math.random() * 3.5,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.25,
      col: palette[i % palette.length],
      star: tier >= 4 && i % 2 === 0,
      life: 1.0,
      decay: 0.014 + Math.random() * 0.012,
    };
  });

  function stepFx() {
    ctx.clearRect(0, 0, w, h);
    let alive = 0;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p.life <= 0) continue;
      alive++;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.16;
      p.vx *= 0.985;
      p.rot += p.vr;
      p.life -= p.decay;
      if (p.life <= 0) continue;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.col;
      if (p.star) {
        ctx.beginPath();
        for (let k = 0; k < 5; k++) {
          const a1 = (k * Math.PI * 2) / 5 - Math.PI / 2;
          const a2 = a1 + Math.PI / 5;
          ctx.lineTo(Math.cos(a1) * p.sz, Math.sin(a1) * p.sz);
          ctx.lineTo(Math.cos(a2) * p.sz * 0.45, Math.sin(a2) * p.sz * 0.45);
        }
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(-p.sz * 0.65, -p.sz * 0.4, p.sz * 1.3, p.sz * 0.8);
      }
      ctx.restore();
    }
    if (alive > 0) requestAnimationFrame(stepFx);
    else ctx.clearRect(0, 0, w, h);
  }
  requestAnimationFrame(stepFx);
}

function startSlotSpinAnimation(prevReels, prevLocks, res, deferredMsg, deferredConfetti) {
  cancelSlotSpin();
  const CELL_H = 82;
  const finalReels = G.slot.reels.slice();
  const finalTier = rarityOf(res).r;
  const suspense = finalTier >= 4 && !prevLocks[0];
  const stopTimes = [
    prevLocks[0] ? 160 : 620,
    prevLocks[1] ? 240 : (suspense ? 1180 : 1040),
    prevLocks[2] ? 320 : (suspense ? 1740 : 1440),
  ];

  G._slotSpinning = true;
  renderPanel();

  const ctrl = { timers: [], tickTimer: null, anims: [], finished: false, finish: null };
  slotSpinCtrl = ctrl;

  const finish = () => {
    if (ctrl.finished) return;
    ctrl.finished = true;
    cancelSlotSpin();
    checkAchievements();
    renderPanel();
    AU.slotWin(finalTier);
    if (deferredMsg) toast(deferredMsg);
    if (deferredConfetti) actors3d?.spawnConfettiBurst(deferredConfetti.x, deferredConfetti.y, deferredConfetti.z);
    burstSlotParticles(finalTier);
  };
  ctrl.finish = finish;

  const reelCounts = [
    14,
    suspense ? 24 : 20,
    suspense ? 32 : 26,
  ];

  for (let col = 0; col < 3; col++) {
    const strip = $('reelStrip' + col);
    if (!strip) continue;
    if (prevLocks[col]) {
      ctrl.timers.push(setTimeout(() => {
        $('slotCol' + col)?.classList.add('stopped');
        AU.reelStop(col, finalTier);
      }, stopTimes[col]));
      continue;
    }
    const poolLen = ALL_REEL_SYMBOLS[col].length;
    const nCells = reelCounts[col];
    const seq = [prevReels[col] || 0];
    let cur = prevReels[col] || 0;
    for (let k = 1; k < nCells - 1; k++) {
      cur = (cur + 1 + ((Math.random() * Math.max(1, poolLen - 1)) | 0)) % poolLen;
      seq.push(cur);
    }
    seq.push(finalReels[col] || 0);
    strip.innerHTML = seq.map((idx) => renderSlotCell(col, idx)).join('');
    const targetY = -((nCells - 1) * CELL_H);
    if (typeof strip.animate === 'function') {
      const anim = strip.animate(
        [
          { transform: 'translate3d(0, 0px, 0)' },
          { transform: `translate3d(0, ${targetY}px, 0)` },
        ],
        {
          duration: stopTimes[col],
          easing: 'cubic-bezier(0.12, 0.88, 0.24, 1.03)',
          fill: 'forwards',
        },
      );
      ctrl.anims.push(anim);
    } else {
      strip.style.transform = `translate3d(0, ${targetY}px, 0)`;
    }

    ctrl.timers.push(setTimeout(() => {
      const colEl = $('slotCol' + col);
      colEl?.classList.add('stopped');
      AU.reelStop(col, finalTier);
      if (col === 0 && suspense) {
        document.querySelector('.slot-cabinet')?.classList.add('anticipation');
      }
    }, stopTimes[col]));
  }

  let tickStep = 0;
  const maxStop = Math.max(...stopTimes);
  const tStart = performance.now();
  const scheduleTick = () => {
    if (ctrl.finished || slotSpinCtrl !== ctrl) return;
    const elapsed = performance.now() - tStart;
    if (elapsed >= maxStop - 60) return;
    AU.slotTick(tickStep++);
    const gap = Math.round(58 + (elapsed / maxStop) * 75);
    ctrl.tickTimer = setTimeout(scheduleTick, gap);
  };
  scheduleTick();

  ctrl.timers.push(setTimeout(finish, maxStop + 130));
}

function pay(n) {
  if (G.money < n) {
    AU.sfx('error-soft-thud');
    toast('现金不够，还差 ' + fm(n - G.money));
    return false;
  }
  G.money -= n;
  G.spent += n;
  return true;
}

export function focusLot(i) {
  cancelSlotSpin();
  G.view = i;
  if (scene3d && G.lots[i]) scene3d.focusLot(G.lots[i]);
  renderPanel();
}

export function act(a, v) {
  const l = G.view != null && G.lots[G.view]?.kind === 'mine' ? G.lots[G.view] : null;
  if (a === 'back') {
    cancelSlotSpin();
    G.view = null;
    if (scene3d) scene3d.overview();
  } else if (a === 'enter') {
    focusLot(+v);
    return;
  } else if (a === 'tab') {
    cancelSlotSpin();
    G.tab = v;
  } else if (a === 'streetTab') {
    cancelSlotSpin();
    G.streetTab = v;
  } else if (a === 'girlSub') {
    G.girlSub = v;
    G._girlSubAuto = -1;
  } else if (a === 'rent') {
    const e = G.lots[+v];
    if (!e || e.kind !== 'empty' || !pay(e.cost)) return;
    const n = bars().length;
    Object.assign(e, {
      kind: 'mine',
      name: BARNAMES[n % BARNAMES.length],
      accent: ACCENTS[n % 4],
      concept: 'bintang',
      menu: {},
      price: 35,
      decor: 0,
      seats: 0,
      rooms: 0,
      sign: 0,
      rep: 3,
      fl: '#D8CDB8',
      hostesses: [],
      scouts: [],
      mkts: [],
      bouncers: [],
      req: { body: 'any', looks: 0, att: 0 },
      cands: [],
    });
    AU.sfx('level-up');
    e.ac = e.accent;
    e._seats = null;
    e._els = null;
    e._spots = null;
    e._spotT = {};
    e._sofaH = {};
    e.today = {
      stolen: 0, bounced: 0, drink: 0, hfee: 0, cogs: 0, guests: 0, turned: 0,
      nohost: 0, roomfull: 0, nolike: 0, hours: 0, newRegs: 0, champagnes: 0, fine: 0,
      by: { local: 0, tai: 0, cn: 0 },
    };
    e.roomsUsed = 0;
    e.dj = false;
    e.trainedToday = false;
    e.skills = {
      happyHour: { activeUntil: 0, cdUntil: 0 },
      showtime: { activeUntil: 0, cdUntil: 0 },
      lowProfile: { activeUntil: 0, cdUntil: 0 },
    };
    G.mine[e.i] = e;
    if (n === 0 && G.slot) G.slot.freeLeft = (G.slot.freeLeft || 0) + 1;
    G.streetTab = 'mine';
    G.tab = 'scout';
    world3d?.rebuildLot(e, G);
    focusLot(e.i);
    toast('开张了！快拉动「🎰 摇人」招募机组建公关班底，签好人再点 17:00 开门！');
    checkGoals();
    checkAchievements();
    return;
  } else if (a === 'concept' && l) {
    setBarConcept(l, v, pay, toast, (lot) => world3d?.rebuildLot(lot, G));
  } else if (a === 'buyMenu' && l) {
    buyMenuItem(l, v, pay, toast);
  } else if (a === 'hongbao' && l) {
    giveHongbao(l, v, pay, toast);
  } else if (a === 'trainH' && l) {
    trainHostess(l, v, pay, toast);
  } else if (a === 'preset' && l) {
    applyShiftPreset(l, v, toast);
  } else if (a === 'hireB' && l) {
    hireBouncer(l, +v, toast);
  } else if (a === 'fireB' && l) {
    fireBouncer(l, v);
  } else if (a === 'poach') {
    const rival = G.lots[+v];
    const targetBar = bars()[0];
    if (rival) poachRivalHostess(rival, targetBar, pay, toast);
  } else if (a === 'buyout') {
    const rival = G.lots[+v];
    if (rival && buyoutRival(rival, pay, toast, (lot) => world3d?.rebuildLot(lot, G))) {
      G.tab = 'run';
      focusLot(rival.i);
      return;
    }
  } else if (a === 'flyers') {
    if (G.flyers || !pay(300)) return;
    G.flyers = true;
    toast('传单发出去了，今晚人流 +40%');
  } else if (a === 'dj' && l) {
    if (l.dj || !pay(600)) return;
    l.dj = true;
    world3d?.rebuildLot(l, G);
    toast('DJ 到位：今晚人更多，更多人想去包厢');
  } else if (a === 'hireH' && l) {
    const c = l.cands[+v];
    if (!c) return;
    if (l.hostesses.length >= MAXH) {
      toast('一家店最多 ' + MAXH + ' 个公关');
      return;
    }
    AU.sfx('pop-bubble');
    l.cands.splice(+v, 1);
    c.state = 'idle';
    c.todayH = 0;
    c.hidden = false;
    c.on = true;
    if (barOpen()) c.worked = true;
    l.hostesses.push(c);
    placeH(l, c);
    checkGoals();
  } else if (a === 'fireH' && l) {
    const h = l.hostesses.find((x) => x.id === v);
    if (!h) return;
    if (h.state !== 'idle') {
      toast(h.name + ' 正在陪客，等她回来再说');
      return;
    }
    freeSpot(l, h);
    l.hostesses = l.hostesses.filter((x) => x !== h);
    AU.sfx('trash-crumple');
  } else if (a === 'hireS' && l) {
    const s = G.mk.scouts[+v];
    if (!s) return;
    if (l.scouts.length >= 2) {
      toast('一家店最多 2 个星探');
      return;
    }
    AU.sfx('pop-bubble');
    G.mk.scouts.splice(+v, 1);
    l.scouts.push(s);
    toast(s.name + ' 明天开始带人来');
  } else if (a === 'fireS' && l) {
    l.scouts = l.scouts.filter((s) => s.id !== v);
  } else if (a === 'hireM' && l) {
    const m = G.mk.mkts[+v];
    if (!m) return;
    if (l.mkts.length >= 3) {
      toast('一家店最多 3 个营销');
      return;
    }
    AU.sfx('pop-bubble');
    G.mk.mkts.splice(+v, 1);
    l.mkts.push(m);
    placeM(l, m);
  } else if (a === 'fireM' && l) {
    l.mkts = l.mkts.filter((m) => m.id !== v);
  } else if (a === 'req' && l) {
    const [k, val] = v.split(':');
    l.req[k] = k === 'looks' || k === 'att' ? +val : val;
  } else if (a === 'up' && l) {
    const u = UPG[v];
    const lv = l[v];
    if (lv >= 3) return;
    if (v === 'seats' && l._g.length) {
      toast('店里还有客人，等空了再动桌椅');
      return;
    }
    if (!pay(u.cost[lv])) return;
    l[v]++;
    l._seats = null;
    l._els = null;
    if (v === 'seats') {
      l._spots = null;
      l._spotT = {};
      l._sofaH = {};
      l.hostesses.forEach((h) => {
        if (h.state === 'idle' && onDuty(h)) placeH(l, h);
      });
    }
    world3d?.rebuildLot(l, G);
    AU.sfx('confirm-unlock');
    toast(u.cn + ' 升到 Lv.' + l[v]);
  } else if (a === 'restart') {
    $('modal').classList.remove('on');
    try {
      localStorage.removeItem('kotaindah_v2');
      localStorage.removeItem('kotaindah7');
    } catch (_) {}
    newGame(scheduleRegs);
    world3d?.buildAll(G);
    scene3d?.overview();
  } else if (a === 'ask-restart') {
    G._ask = true;
  } else if (a === 'next') {
    nextDay();
    world3d?.buildAll(G);
    return;
  } else if (a === 'start' || a === 'schedule') {
    $('modal').classList.remove('on');
    G.modal = false;
    if (a === 'schedule' && bars().length) {
      G.tab = 'girls';
      focusLot(bars()[0].i);
      return;
    }
  } else if (a === 'closeModal') {
    $('modal').classList.remove('on');
    G.modal = false;
    return;
  } else if (a === 'raiseY' || a === 'raiseN') {
    const h = allH().find((x) => x.id === v);
    if (h && h.raiseAsk) {
      if (a === 'raiseY') {
        h.wage = h.raiseAsk;
        h.mood = Math.min(100, h.mood + 20);
      } else {
        h.mood = Math.max(0, h.mood - 25);
        h.refused = 3;
      }
      h.raiseAsk = null;
    }
    if (G.modal) {
      const b = $('sheet').querySelector(`[data-v="${v}"]`);
      if (b) b.closest('.kv').innerHTML = `<span>${esc(h.name)}：${a === 'raiseY' ? '已加薪' : '已拒绝'}</span>`;
    }
  } else if (a === 'tog' && l) {
    const h = l.hostesses.find((x) => x.id === v);
    if (!h) return;
    if (h.sick) {
      toast(h.name + ' 今晚病假');
      return;
    }
    if (h.on) {
      if (h.state !== 'idle') {
        toast(h.name + ' 正在陪客');
        return;
      }
      AU.sfx('toggle-switch-off');
      h.on = false;
      freeSpot(l, h);
      h.hidden = true;
    } else {
      AU.sfx('toggle-switch-on');
      h.on = true;
      h.hidden = false;
      if (barOpen()) h.worked = true;
      placeH(l, h);
    }
  } else if (a === 'allOn' && l) {
    applyShiftPreset(l, 'rush', toast);
  } else if (a === 'auto' && l) {
    applyShiftPreset(l, 'smart', toast);
  } else if (a === 'slotSpin') {
    if (G._slotSpinning && slotSpinCtrl?.finish) {
      slotSpinCtrl.finish();
      return;
    }
    const prevReels = (G.slot?.reels || [0, 0, 0]).slice();
    const prevLocks = (G.slot?.locks || [false, false, false]).slice();
    let deferredMsg = '';
    let deferredConfetti = null;
    const res = spinSlotMachine(
      G,
      l,
      pay,
      (msg) => { deferredMsg = msg; },
      (x, y, z) => { deferredConfetti = { x, y, z }; },
    );
    if (res) {
      startSlotSpinAnimation(prevReels, prevLocks, res, deferredMsg, deferredConfetti);
      return;
    }
  } else if (a === 'slotLock') {
    cancelSlotSpin();
    toggleSlotLock(G, +v, toast);
  } else if (a === 'slotUp') {
    cancelSlotSpin();
    upgradeSlotMachine(G, pay, toast);
  } else if (a === 'hirePending') {
    cancelSlotSpin();
    hireSlotPending(l, toast);
  } else if (a === 'openCodex') {
    cancelSlotSpin();
    AU.sfx('modal-open-rise');
    showCodexModal(G?._codexTab || 'girls');
    return;
  } else if (a === 'codexTab') {
    showCodexModal(v);
    return;
  }
  renderPanel();
}

function initUIEvents() {
  const QUIET = ['tog', 'hireH', 'fireH', 'hireS', 'hireM', 'hireB', 'up', 'rent', 'hongbao', 'trainH', 'slotSpin', 'slotLock', 'slotUp', 'hirePending'];
  $('panel')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]');
    if (b) {
      if (!QUIET.includes(b.dataset.a)) AU.sfx('click-soft-tap');
      act(b.dataset.a, b.dataset.v);
    }
  });
  $('panel')?.addEventListener('change', (e) => {
    const sel = e.target.closest('[data-xfer]');
    if (sel && sel.value !== '') {
      const l = G.view != null ? G.lots[G.view] : null;
      if (l && l.kind === 'mine') {
        transferHostess(l, sel.dataset.xfer, +sel.value, toast);
        renderPanel();
      }
    }
  });
  $('panel')?.addEventListener('input', (e) => {
    const l = G.view != null ? G.lots[G.view] : null;
    if (!l || l.kind !== 'mine') return;
    if (e.target.id === 'pr') {
      l.price = +e.target.value;
      if ($('pv')) $('pv').textContent = fm(l.price);
      if ($('ph')) $('ph').textContent = priceHint(l);
      live();
    }
    if (e.target.id === 'nm') {
      l.name = e.target.value.trim() || 'Bar';
      world3d?.rebuildLot(l, G);
      live();
    }
  });

  $('skillDock')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-skill]');
    const l = G.view != null ? G.lots[G.view] : null;
    if (b && l && l.kind === 'mine') {
      activateSkill(l, b.dataset.skill, pay, toast);
      renderPanel();
    }
  });

  $('liveEventCard')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ev]');
    if (b) {
      resolveLiveEvent(
        b.dataset.ev,
        toast,
        (x, y, z) => actors3d?.spawnConfettiBurst(x, y, z),
        () => renderPanel(),
      );
    }
  });

  $('modal')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]');
    if (b) {
      AU.sfx('click-soft-tap');
      act(b.dataset.a, b.dataset.v);
    }
  });
  $('auM')?.addEventListener('click', () => { AU.setM(!AU.m); audioUI(); });
  $('auS')?.addEventListener('click', () => { AU.setS(!AU.s); if (AU.s) AU.sfx('click-soft-tap'); audioUI(); });
  audioUI();

  $('barPills')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-jump]');
    if (!b) return;
    AU.sfx('click-soft-tap');
    const idx = +b.dataset.jump;
    if (idx < 0) act('back');
    else focusLot(idx);
  });

  $('btnCodex')?.addEventListener('click', () => {
    AU.sfx('modal-open-rise');
    showCodexModal(G?._codexTab || 'girls');
  });

  $('btnAch')?.addEventListener('click', () => {
    AU.sfx('modal-open-rise');
    showAchievementsModal();
  });

  const QMODES = ['auto', 'high', 'medium', 'low'];
  const QLABELS = { auto: '✨Auto', high: '✨高', medium: '✨中', low: '✨省' };
  $('btnQual')?.addEventListener('click', (e) => {
    AU.sfx('click-soft-tap');
    const nextIdx = (QMODES.indexOf(scene3d.qualityMode) + 1) % QMODES.length;
    const mode = QMODES[nextIdx];
    scene3d.setQualityMode(mode);
    e.currentTarget.textContent = QLABELS[mode];
    toast(`画质：${QLABELS[mode].replace('✨', '')}`);
  });

  const LMODES = Object.keys(LIGHT_MODES);
  const LLABELS = { bright: '💡 明亮', cozy: '💡 氛围', day: '☀️ 白昼' };
  const btnLight = $('btnLight');
  if (btnLight) {
    btnLight.textContent = LLABELS[scene3d.lightMode] || LLABELS.bright;
    btnLight.addEventListener('click', (e) => {
      AU.sfx('click-soft-tap');
      const idx = (LMODES.indexOf(scene3d.lightMode) + 1) % LMODES.length;
      const mode = LMODES[idx];
      scene3d.setLightMode(mode);
      e.currentTarget.textContent = LLABELS[mode];
      toast(`光照：${LLABELS[mode].replace(/^[^\s]+\s*/, '')}`);
    });
  }

  // Mobile 3-snap-point draggable bottom sheet
  const panelWrap = $('panelWrap');
  const grabber = $('sheetGrabber');
  let curSnap = 'half';
  function setSnap(snap) {
    curSnap = snap;
    if (!panelWrap) return;
    panelWrap.style.height = '';
    panelWrap.classList.remove('snap-mini', 'snap-half', 'snap-full');
    panelWrap.classList.add('snap-' + snap);
    grabber?.querySelectorAll('[data-snap]').forEach((b) => b.classList.toggle('on', b.dataset.snap === snap));
  }
  setSnap('half');

  grabber?.addEventListener('click', (e) => {
    const sb = e.target.closest('[data-snap]');
    if (sb) {
      AU.sfx('click-soft-tap');
      setSnap(sb.dataset.snap);
    }
  });

  if (grabber && panelWrap) {
    let dragStartY = 0;
    let startH = 0;
    let dragging = false;
    grabber.addEventListener('pointerdown', (e) => {
      if (e.target.closest('[data-snap]')) return;
      dragging = true;
      dragStartY = e.clientY;
      startH = panelWrap.getBoundingClientRect().height;
      panelWrap.classList.add('dragging');
      grabber.setPointerCapture?.(e.pointerId);
    });
    grabber.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const vh = window.innerHeight || 800;
      const nextH = Math.max(78, Math.min(vh * 0.86, startH + (dragStartY - e.clientY)));
      panelWrap.style.height = nextH + 'px';
    });
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      panelWrap.classList.remove('dragging');
      const vh = window.innerHeight || 800;
      const ratio = panelWrap.getBoundingClientRect().height / vh;
      setSnap(ratio < 0.25 ? 'mini' : ratio > 0.66 ? 'full' : 'half');
    };
    grabber.addEventListener('pointerup', endDrag);
    grabber.addEventListener('pointercancel', endDrag);
  }

  $('mobTabs')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mtab]');
    if (!b) return;
    AU.sfx('click-soft-tap');
    const tab = b.dataset.mtab;
    const bs = bars();
    if (tab === 'overview') {
      G.view = null;
      scene3d?.overview();
      renderPanel();
    } else {
      if (!bs.length) {
        G.view = null;
        G.streetTab = 'empty';
        renderPanel();
        toast('请先在招租列表或 3D 地图上租下第一家铺位开店！');
      } else {
        const targetBar = G.view != null && G.lots[G.view]?.kind === 'mine' ? G.lots[G.view] : bs[0];
        G.tab = tab === 'staff' ? 'mkt' : tab;
        focusLot(targetBar.i);
      }
    }
    if (curSnap === 'mini') setSnap('half');
  });

  $('speed')?.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) {
      AU.sfx('click-soft-tap');
      G.speed = +b.dataset.s;
      live();
    }
  });
  $('btnSkipOpen')?.addEventListener('click', () => {
    if (skipToOpen()) {
      toast('傍晚 5 点，准时开灯开门迎客！');
      live();
    }
  });
  $('zall')?.addEventListener('click', () => act('back'));
  $('btnRot')?.addEventListener('click', () => { AU.sfx('click-soft-tap'); scene3d?.rotate90(); });
  $('btnCut')?.addEventListener('click', (e) => {
    AU.sfx('click-soft-tap');
    scene3d.cutawayEnabled = !scene3d.cutawayEnabled;
    e.currentTarget.classList.toggle('on', scene3d.cutawayEnabled);
  });

  const dom = scene3d.renderer.domElement;
  let downX = 0;
  let downY = 0;
  let downTime = 0;
  dom.addEventListener('pointerdown', (ev) => {
    downX = ev.clientX;
    downY = ev.clientY;
    downTime = performance.now();
  });
  dom.addEventListener('pointerup', (ev) => {
    if (G.modal) return;
    const dist = Math.hypot(ev.clientX - downX, ev.clientY - downY);
    if (dist > 8 || performance.now() - downTime > 450) return;
    const idx = scene3d.pickLotAtClient(ev.clientX, ev.clientY, G.lots);
    if (idx < 0) {
      if (G.view != null) {
        G.view = null;
        scene3d.overview();
        renderPanel();
      }
      return;
    }
    focusLot(idx);
  });

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') { e.preventDefault(); G.speed = G.speed ? 0 : 1; live(); }
    else if (e.key === '1') { G.speed = 1; live(); }
    else if (e.key === '2') { G.speed = 2; live(); }
    else if (e.key === '3') { G.speed = 4; live(); }
    else if (e.key === '4') { G.speed = 8; live(); }
    else if (e.key === 'Escape' && G.view != null) act('back');
    else if (e.key === 'r' || e.key === 'R') scene3d?.rotate90();
    else if (e.key === 'q' || e.key === 'Q') scene3d?.rotateBy(-Math.PI / 6);
    else if (e.key === 'e' || e.key === 'E') scene3d?.rotateBy(Math.PI / 6);
  });

  window.addEventListener('resize', () => scene3d?.resize());
}

function boot() {
  initSim();
  setSimHooks({
    toast,
    onEndDay: showEndDayModal,
    onBrief: showBriefModal,
    onPanel: renderPanel,
    onChampagne: (l, p) => actors3d?.spawnConfettiBurst(p.x, p.y, 2.2),
    onLiveEvent: () => triggerLiveEvent(renderLiveEvent),
    onGoal: () => {},
    onAchievement: () => {},
  });

  const vp = $('viewport3d');
  scene3d = new Scene3D(vp);
  world3d = new World3D(scene3d);
  actors3d = new Actors3D(scene3d, $('world-hud'));
  world3d.buildAll(G);

  initUIEvents();
  renderPanel();
  AU.music(dayTrack(G));

  window.__G = () => G;
  window.__AU = AU;
  window.__act = act;
  window.__simDays = simHeadlessDays;
  window.__perf = () => ({
    fps: Math.round(scene3d.fpsAvg),
    quality: scene3d.effectiveQuality,
    drawCalls: scene3d.getDrawCalls(),
    peds: G.peds.length,
    cars: G.cars.length,
  });

  let last = performance.now();
  let lastLive = 0;

  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    update(dt);
    tickLiveEvent(toast, (x, y, z) => actors3d?.spawnConfettiBurst(x, y, z), renderPanel);
    scene3d.step(dt, G);
    world3d.updateDynamic(G, dt);
    actors3d.update(G, dt, (idx) => focusLot(idx));
    scene3d.render();
    if (now - lastLive > 250) {
      lastLive = now;
      live();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot();
