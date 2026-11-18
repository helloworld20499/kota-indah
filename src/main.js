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
  spinSlotMachine, toggleSlotLock, upgradeSlotMachine,
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
  live, priceHint, renderLiveEvent, renderPanel, showAchievementsModal, showBriefModal,
  showCodexModal, showEndDayModal, toast,
} from './ui.js';

const $ = (id) => document.getElementById(id);

let scene3d = null;
let world3d = null;
let actors3d = null;

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
  G.view = i;
  if (scene3d && G.lots[i]) scene3d.focusLot(G.lots[i]);
  renderPanel();
}

export function act(a, v) {
  const l = G.view != null && G.lots[G.view]?.kind === 'mine' ? G.lots[G.view] : null;
  if (a === 'back') {
    G.view = null;
    if (scene3d) scene3d.overview();
  } else if (a === 'enter') {
    focusLot(+v);
    return;
  } else if (a === 'tab') {
    G.tab = v;
  } else if (a === 'streetTab') {
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
      req: { body: 'any', pers: 'any', looks: 0, att: 0 },
      cands: [0, 1, 2, 3, 4].map(() => mkHostess(4.6)),
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
    G.streetTab = 'mine';
    G.tab = 'girls';
    G.girlSub = 'cands';
    G._girlSubAuto = e.i;
    world3d?.rebuildLot(e, G);
    focusLot(e.i);
    toast('开张了！先签几个公关，再点击「跳至 17:00 开门」！');
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
    const res = spinSlotMachine(G, l, pay, toast, (x, y, z) => actors3d?.spawnConfettiBurst(x, y, z));
    if (res) {
      checkAchievements();
      renderPanel();
      const reelsEl = document.querySelector('.slot-reels');
      if (reelsEl) {
        reelsEl.classList.add('spinning');
        setTimeout(() => reelsEl.classList.remove('spinning'), 340);
      }
      return;
    }
  } else if (a === 'slotLock') {
    toggleSlotLock(G, +v, toast);
  } else if (a === 'slotUp') {
    upgradeSlotMachine(G, pay, toast);
  } else if (a === 'hirePending') {
    hireSlotPending(l, toast);
  } else if (a === 'openCodex') {
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
