import { wday } from './config.js';

const hasDom = typeof window !== 'undefined' && typeof document !== 'undefined';

function createAudioEngine() {
  const st = { m: true, s: true };
  if (hasDom) {
    try {
      Object.assign(st, JSON.parse(window.localStorage.getItem('kotaindah_audio') || '{}'));
    } catch (_) {}
  }

  if (!hasDom || typeof Audio === 'undefined') {
    return {
      sfx() {},
      music() {},
      slotTick() {},
      reelStop() {},
      slotWin() {},
      setM(v) { st.m = v; },
      setS(v) { st.s = v; },
      get m() { return st.m; },
      get s() { return st.s; },
    };
  }

  const SV = {
    'click-soft-tap': 0.35,
    'toggle-switch-on': 0.4,
    'toggle-switch-off': 0.38,
    'pop-bubble': 0.38,
    'trash-crumple': 0.4,
    'coin-collect': 0.42,
    'coin-double': 0.42,
    'notification-ding': 0.42,
    'message-incoming-pop': 0.3,
    'error-soft-thud': 0.4,
    'warning-buzz': 0.42,
    'achievement': 0.5,
    'level-up': 0.5,
    'confirm-unlock': 0.45,
    'modal-open-rise': 0.34,
  };

  const MV = 0.32;
  const SM = 0.6;
  const FADE = 2.5;
  const XF = 3.5;
  const pool = {};
  const last = {};
  let unlocked = false;
  let want = null;
  let cur = null;
  let fades = [];

  const save = () => {
    try {
      localStorage.setItem('kotaindah_audio', JSON.stringify(st));
    } catch (_) {}
  };

  function sfx(id, gap) {
    if (!st.s || !unlocked || document.hidden) return;
    const now = performance.now();
    if (gap && last[id] && now - last[id] < gap) return;
    last[id] = now;
    const p = pool[id] || (pool[id] = []);
    let a = p.find((x) => x.paused || x.ended);
    if (!a) {
      if (p.length >= 4) return;
      a = new Audio(`sfx/${id}.wav`);
      a.preload = 'auto';
      p.push(a);
    }
    a.volume = (SV[id] || 0.4) * SM;
    try { a.currentTime = 0; } catch (_) {}
    a.play().catch(() => {});
  }

  function fade(a, to, sec, end) {
    const from = a.volume;
    const t0 = performance.now();
    const f = { a };
    fades = fades.filter((x) => x.a !== a);
    fades.push(f);
    f.tick = (now) => {
      const k = Math.min(1, (now - t0) / (sec * 1000));
      a.volume = Math.max(0, Math.min(1, from + (to - from) * k));
      if (k >= 1) {
        fades = fades.filter((x) => x !== f);
        if (end) end();
      }
    };
  }

  function newTrack(name) {
    const a = new Audio(`music/${name}.mp3`);
    a.preload = 'auto';
    a.volume = 0;
    a._n = name;
    a.loop = false;
    return a;
  }

  function start(name) {
    if (!unlocked || !st.m) return;
    const a = newTrack(name);
    a.play().catch(() => {});
    fade(a, MV, cur ? FADE : 1.2);
    if (cur) {
      const old = cur;
      fade(old, 0, FADE, () => {
        old.pause();
        old.src = '';
      });
    }
    cur = a;
  }

  function music(name) {
    want = name;
    if (!unlocked || !st.m) return;
    if (cur && cur._n === name) return;
    start(name);
  }

  setInterval(() => {
    const now = performance.now();
    fades.slice().forEach((f) => f.tick(now));
    if (cur && st.m && cur._n !== 'closing' && cur.duration && cur.currentTime > cur.duration - XF) {
      const old = cur;
      const a = newTrack(old._n);
      a.play().catch(() => {});
      fade(a, MV, XF);
      fade(old, 0, XF, () => {
        old.pause();
        old.src = '';
      });
      cur = a;
    }
  }, 50);

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    if (want) music(want);
  }

  let actx = null;
  function getCtx() {
    if (!st.s || !unlocked || document.hidden) return null;
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { actx = new AC(); } catch (_) { return null; }
    }
    if (actx.state === 'suspended') actx.resume().catch(() => {});
    return actx;
  }

  function tone(freq0, freq1, durSec, gainVal = 0.08, type = 'triangle', delay = 0) {
    const c = getCtx();
    if (!c) return;
    const t = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq0, t);
    if (freq1 && freq1 !== freq0) osc.frequency.exponentialRampToValueAtTime(freq1, t + durSec);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gainVal, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + durSec);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t);
    osc.stop(t + durSec + 0.01);
  }

  function slotTick(step = 0) {
    const f = 520 + (step % 5) * 45;
    tone(f, 220, 0.028, 0.055, 'triangle');
  }

  function reelStop(reelIdx = 0, rarity = 2) {
    const base = rarity >= 4 ? [440, 554.37, 659.25] : [329.63, 415.3, 523.25];
    const f = base[reelIdx % 3];
    tone(140, 62, 0.06, 0.11, 'sine');
    tone(f, f * 1.02, 0.12, rarity >= 4 ? 0.1 : 0.075, 'triangle', 0.015);
  }

  function slotWin(rarity = 2) {
    if (rarity >= 5) {
      [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98].forEach((n, i) => {
        tone(n, n, 0.18, 0.1, 'triangle', i * 0.065);
      });
      sfx('achievement');
      setTimeout(() => sfx('coin-double'), 220);
    } else if (rarity === 4) {
      [523.25, 659.25, 783.99, 1046.5].forEach((n, i) => {
        tone(n, n, 0.14, 0.085, 'triangle', i * 0.06);
      });
      sfx('level-up');
    } else if (rarity === 3) {
      tone(587.33, 587.33, 0.12, 0.07, 'triangle', 0);
      tone(880, 880, 0.16, 0.08, 'triangle', 0.07);
      sfx('coin-collect');
    }
  }

  ['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, unlock, { once: false, capture: true }));
  document.addEventListener('visibilitychange', () => {
    if (!cur) return;
    if (document.hidden) cur.pause();
    else if (st.m) cur.play().catch(() => {});
  });

  function setM(v) {
    st.m = v;
    save();
    if (!v && cur) {
      const o = cur;
      cur = null;
      fade(o, 0, 0.6, () => {
        o.pause();
        o.src = '';
      });
    } else if (v && want) {
      cur = null;
      music(want);
    }
  }

  function setS(v) {
    st.s = v;
    save();
  }

  return {
    sfx,
    music,
    slotTick,
    reelStop,
    slotWin,
    setM,
    setS,
    get m() { return st.m; },
    get s() { return st.s; },
  };
}

export const AU = createAudioEngine();

export function dayTrack(G) {
  return G?.ev?.rain ? 'rain' : (wday(G.day) === 4 || wday(G.day) === 5) ? 'weekend' : 'main';
}

export function audioUI() {
  if (!hasDom) return;
  const m = document.getElementById('auM');
  const s = document.getElementById('auS');
  if (!m || !s) return;
  m.classList.toggle('off', !AU.m);
  s.classList.toggle('off', !AU.s);
  m.title = AU.m ? '关掉音乐' : '打开音乐';
  s.title = AU.s ? '关掉音效' : '打开音效';
}
