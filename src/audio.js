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
