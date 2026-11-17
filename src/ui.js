import {
  BODY, COGS, CONCEPTS, CT, FEE, GOALS, HOURFEE, MAXH, PERS, ROOMS, SKINS, T0, T_END, T_OPEN,
  TIER, UPG, WD, WMUL, activeH, clamp, esc, fm, moodTx, onDuty, tierOf, wday, where,
} from './config.js';
import { G, bars, cap } from './state.js';
import { barOpen, buzz, enterProb, evList, fair, lit, trafMul, wagesOf } from './sim.js';

const $ = (id) => document.getElementById(id);
let AVN = 0;

export function toast(t) {
  const e = $('toast');
  if (!e) return;
  e.textContent = t;
  e.classList.add('on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => e.classList.remove('on'), 2200);
}

export function avatar(o, sz = 42) {
  const id = 'av' + AVN++;
  const sk = o.skin || '#D7A47C';
  const hr = o.hair || '#2b211b';
  const cl = o.dress || o.shirt || '#888';
  const t = o.pop != null ? tierOf(o) : 0;
  const ring = o.ring || (t === 2 ? '#e8b959' : t === 1 ? '#ff5c54' : 'rgba(255,255,255,0.22)');
  const hs = o.hs != null ? o.hs : (parseInt(String(o.id || '0').slice(-3), 36) || 0) % 4;
  const capPath = `<path d="M12.5 17 Q13.5 7.5 21 7.5 Q28.5 7.5 29.5 17 Q26 11.5 21 12.2 Q15.5 11.5 12.5 17Z" fill="${hr}"/>`;
  let back = '';
  let front = capPath;
  let extra = '';
  if (o.male) {
    front = `<path d="M12.5 16 Q12.5 7 21 7 Q29.5 7 29.5 16 L29.5 13.5 Q26 10.5 21 10.8 Q16 10.5 12.5 13.5Z" fill="${hr}"/>`;
    extra = `<path d="M16 31 L21 36 L26 31" fill="none" stroke="#F3ECDC" stroke-width="1.6"/>`;
  } else if (hs === 0) back = `<path d="M10.5 19 Q10 6 21 6 Q32 6 31.5 19 L33 34 L9 34Z" fill="${hr}"/>`;
  else if (hs === 1) back = `<path d="M11 19 Q11 6 21 6 Q31 6 31 19 L31.5 25.5 L10.5 25.5Z" fill="${hr}"/>`;
  else if (hs === 2) back = `<path d="M29 12 Q37 14 34 30" fill="none" stroke="${hr}" stroke-width="4.2" stroke-linecap="round"/>`;
  else back = `<circle cx="21" cy="6" r="4.6" fill="${hr}"/>`;

  const face = `<rect x="18.2" y="23" width="5.6" height="8" fill="${sk}"/><circle cx="21" cy="18" r="8.3" fill="${sk}"/>
    <circle cx="18" cy="18.3" r="1" fill="#2F261E"/><circle cx="24" cy="18.3" r="1" fill="#2F261E"/><path d="M19 21.6 Q21 23.2 23 21.6" fill="none" stroke="#7A3B33" stroke-width="1"/>`;
  const girl = o.male
    ? ''
    : `<circle cx="15.8" cy="20.6" r="1.5" fill="#E79A92" opacity=".55"/><circle cx="26.2" cy="20.6" r="1.5" fill="#E79A92" opacity=".55"/>` +
      (t ? `<circle cx="12.8" cy="21" r="1" fill="#E2B24A"/><circle cx="29.2" cy="21" r="1" fill="#E2B24A"/>` : '');
  return `<svg class="av" width="${sz}" height="${sz}" viewBox="0 0 42 42" aria-hidden="true"><defs><clipPath id="${id}"><circle cx="21" cy="21" r="19.5"/></clipPath></defs>
    <circle cx="21" cy="21" r="19.5" fill="#2b2434"/><g clip-path="url(#${id})">${back}<path d="M5 44 Q7 31.5 21 30.5 Q35 31.5 37 44Z" fill="${cl}"/>${extra}${face}${girl}${front}</g>
    <circle cx="21" cy="21" r="19.5" fill="none" stroke="${ring}" stroke-width="${t ? 2.4 : 1.4}"/></svg>`;
}

const pips = (n, max, cls = '') =>
  `<span class="pips ${cls}">${Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
const stars = (r) => '★ ' + r.toFixed(1);
const dot = (c) => `<i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:4px"></i>`;

export function priceHint(l) {
  const r = l.price / fair(l);
  return r < 0.8
    ? `酒很便宜，人会多一点，但每瓶只赚 ${fm(l.price - (CONCEPTS[l.concept]?.cogs || COGS))}。`
    : r <= 1.15
      ? '酒价公道。'
      : r <= 1.5
        ? '酒偏贵，进店的人少了。'
        : '酒太贵了，客人会少喝、少来。';
}

function hStatus(h) {
  const left = h.until ? Math.max(0, Math.round(h.until - G.t)) : 0;
  return h.state === 'idle'
    ? h.en < 10 ? '太累，歇着' : '待客'
    : h.state === 'with'
      ? '陪酒中 · ' + (h.with && h.with.pkg.h === 99 ? '买断' : '剩 ' + left + ' 分')
      : h.state === 'room'
        ? '包厢跳舞 · 剩 ' + left + ' 分'
        : h.state === 'out'
          ? '外出陪同 · 剩 ' + left + ' 分'
          : '被买断外出';
}

const staffLook = (o) => {
  const n = parseInt(String(o.id).slice(-3), 36) || 0;
  return { male: true, skin: o.skin || SKINS[n % 4], hair: o.hair || '#2b211b' };
};

function hCard(h, cand) {
  const t = tierOf(h);
  const mt = moodTx(h.mood);
  const off = !cand && !onDuty(h);
  const on = h.on && !h.sick;
  return `<div class="card hc${off ? ' off' : ''}"><div class="hrow">${avatar(h, 44)}<div class="hmain">
    <h5><span>${esc(h.name)}${t ? `<span class="badge b${t}">${TIER[t]}</span>` : ''}${h.sick ? '<span class="badge boff">病假</span>' : ''}</span>
      <em${cand || off ? '' : ` data-live="h:${h.id}"`}>${cand ? '底薪 ' + fm(h.wage) + '/晚' : off ? '' : hStatus(h)}</em></h5>
    <div class="st"><span>身材 <b>${BODY[h.body]}</b></span><span>${pips(h.bs, 10)}</span><span>样貌</span><span>${pips(h.looks, 10)}</span><span>性格 <b>${PERS[h.pers]}</b></span><span>${pips(h.ps, 10, 'b')}</span></div>
    ${cand
      ? `<button class="btn mini" data-a="hireH" data-v="${cand}">签约</button>`
      : `<div class="meta"><span>体力</span><span class="ebar"><i style="width:${Math.round(h.en)}%;background:${h.en < 30 ? '#ff5c54' : h.en < 60 ? '#e8b959' : '#3dd6a5'}"></i></span><span style="color:${mt[1]}">${mt[0]}</span><span>人气 ${h.pop}</span></div>
        <p class="rv">底薪 ${fm(h.wage)} · 今天 ${Math.round(h.todayH || 0)} 钟${h.reviews.length ? ' · ' + esc(h.reviews[0]) : ''}</p>
        <div class="hb"><button class="tog${on ? ' on' : ''}" data-a="tog" data-v="${h.id}">${on ? '今晚上班' : h.sick ? '病假' : '今晚休息'}</button><button class="link" data-a="fireH" data-v="${h.id}">解约</button></div>`
    }</div></div></div>`;
}

function sCard(o, role, btn) {
  return `<div class="card"><div class="hrow">${avatar(Object.assign(staffLook(o), { shirt: role === 's' ? '#5B7FA6' : '#2F261E' }), 40)}<div class="hmain">
    <h5><span>${esc(o.name)}${role === 's' ? ` · ${o.kind === 'q' ? '质量型' : '数量型'}` : ''}</span><em>日薪 ${fm(o.wage)}</em></h5><p>能力${pips(o.ab, 10)}</p>${btn}</div></div></div>`;
}

const seg = (k, cur, opts) =>
  `<div class="seg">${opts.map(([v, t]) => `<button class="${String(cur) === String(v) ? 'on' : ''}" data-a="req" data-v="${k}:${v}">${t}</button>`).join('')}</div>`;

function goalCard() {
  if (G.goal >= GOALS.length) return `<div class="goalc"><small>全部目标完成</small><b>你已经是这条街的老大了</b></div>`;
  const g = GOALS[G.goal];
  return `<div class="goalc"><small>目标 ${G.goal + 1} / ${GOALS.length}</small><b>${g.t}</b><span>奖励 ${fm(g.r)}</span></div>`;
}

const weekStrip = () =>
  `<div class="wk">${WD.map((w, i) => `<div class="${i === wday(G.day) ? 'cur' : ''}"><i style="height:${Math.round(WMUL[i] * 20)}px"></i>${w.slice(1)}</div>`).join('')}</div>`;

export function renderPanel() {
  AVN = 0;
  const P = $('panel');
  if (!P || !G) return;
  let h = '';
  const v = G.view != null ? G.lots[G.view] : null;

  if (v && v.kind === 'mine') {
    const l = v;
    const tab = G.tab || 'run';
    const regs = G.regs.filter((r) => r.bar === l.i);
    const act = activeH(l);
    h += `<button class="btn" data-a="back">← 回到全景</button>
      <input class="nm" id="nm" value="${esc(l.name)}" maxlength="16" aria-label="店名">
      <div class="stats"><div><small>口碑</small><b data-live="rep"></b></div><div><small>客人</small><b data-live="guests"></b></div><div><small>包厢</small><b data-live="rooms"></b></div><div><small>上班公关</small><b>${act.length}/${l.hostesses.length}</b></div></div>
      <div class="kv"><span>今晚 公关 / 酒水</span><span data-live="inc"></span></div>
      <div class="seg" style="margin-top:10px">${[['run', '经营'], ['girls', '公关'], ['scout', '星探'], ['mkt', '营销']].map(([k, t]) => `<button class="${tab === k ? 'on' : ''}" data-a="tab" data-v="${k}">${t}</button>`).join('')}</div>`;

    if (tab === 'run') {
      h += `<div class="lbl">今晚运营</div>
        <button class="btn" data-a="dj" ${l.dj ? 'disabled' : ''}>${l.dj ? 'DJ 已就位' : `请 DJ · ${fm(600)}（人流↑，更多人去包厢）`}</button>
        <button class="btn" data-a="flyers" ${G.flyers ? 'disabled' : ''}>${G.flyers ? '今晚的传单已发' : `发传单 · ${fm(300)}（整条街人流 +40%）`}</button>
        <div class="lbl">酒水定价</div>
        <div class="price"><span id="pv">${fm(l.price)}</span> <small>/ 瓶 · 进价 ${fm(CONCEPTS[l.concept]?.cogs || COGS)}</small></div>
        <input type="range" id="pr" min="20" max="120" step="5" value="${l.price}" aria-label="酒价">
        <p class="hand" id="ph"></p>
        <div class="kv"><span>路人进店率（土 / 台 / 中）</span><span data-live="prob"></span></div>
        <div class="lbl">店内升级</div>`;
      Object.keys(UPG).forEach((k) => {
        const u = UPG[k];
        const lv = l[k];
        h += `<div class="card"><h5>${u.cn}${pips(lv, 3)}<em>${lv >= 3 ? '已满级' : fm(u.cost[lv])}</em></h5><p>${u.desc}</p>
          ${lv < 3 ? `<button class="btn mini" data-a="up" data-v="${k}">升级</button>` : ''}</div>`;
      });
      h += `<div class="lbl">回头客 ${regs.length}</div>`;
      h += regs.length
        ? regs.map((r) => {
            const fav = l.hostesses.find((x) => x.id === r.hid);
            return `<div class="kv"><span>${dot(CT[r.type].col)}${CT[r.type].cn}${r.n > 1 ? ` · ${r.n} 人` : ''}${fav ? ` · 常找 ${esc(fav.name)}` : ''}</span><span>${r.daily ? '常来' : `还会来 ${r.days} 天`}</span></div>`;
          }).join('')
        : `<p class="hand" style="color:var(--mute)">客人满意才会回来。营销越强，回头客越多。</p>`;
      h += `<div class="lbl">固定支出</div>
        <div class="kv"><span>铺面日租</span><span>${fm(l.rent)}</span></div>
        <div class="kv"><span>每周日保护费</span><span>${fm(FEE(l))}</span></div>
        <div class="kv"><span>星探 + 营销日薪</span><span>${fm(wagesOf(l).s)}</span></div>`;
    } else if (tab === 'girls') {
      const avg = act.length ? Math.round(act.reduce((a, x) => a + x.en, 0) / act.length) : 0;
      const base = act.reduce((a, x) => a + x.wage, 0);
      const m = trafMul();
      h += `<div class="card" style="margin-top:10px"><h5>今晚上班 ${act.length} / ${l.hostesses.length}<em>底薪合计 ${fm(base)}</em></h5>
        <p>今晚客流 ${m < 0.75 ? '淡' : m < 1.1 ? '平' : '旺'}（× ${m.toFixed(2)}）· 平均体力 ${avg}。休息一天体力恢复更快。</p>
        <div class="hb" style="margin-top:8px"><button class="tog on" data-a="auto">按客流自动排</button><button class="tog" data-a="allOn">全部上班</button></div></div>
        <div class="lbl">我的公关 ${l.hostesses.length}/${MAXH}</div>`;
      if (!l.hostesses.length) h += `<p class="hand">还没有公关，赶紧在下方签约！</p>`;
      l.hostesses.slice().sort((a, b) => onDuty(b) - onDuty(a) || b.pop - a.pop).forEach((x) => { h += hCard(x); });
      h += `<div class="lbl">今日应聘 ${l.cands.length}</div>`;
      if (!l.cands.length) h += `<p class="hand">今天没人来应聘。请星探，每天都会有人。</p>`;
      l.cands.forEach((c, i) => { h += hCard(c, String(i)); });
    } else if (tab === 'scout') {
      h += `<p class="hand" style="margin-top:8px">星探每天带人来应聘。质量型找的人好，数量型找的人多。</p>
        <div class="lbl">找人要求（明天起生效）</div>
        <p style="margin:4px 0 0;color:var(--mute);font-size:12px">身材</p>${seg('body', l.req.body, [['any', '不限'], ['slim', '苗条'], ['curvy', '丰满']])}
        <p style="margin:6px 0 0;color:var(--mute);font-size:12px">性格</p>${seg('pers', l.req.pers, [['any', '不限'], ['intro', '内向'], ['extro', '外向']])}
        <p style="margin:6px 0 0;color:var(--mute);font-size:12px">样貌</p>${seg('looks', l.req.looks, [[0, '不限'], [5, '5 分以上'], [7, '7 分以上']])}
        <p style="margin:6px 0 0;color:var(--mute);font-size:12px">服务态度</p>${seg('att', l.req.att, [[0, '不限'], [6, '要态度好']])}
        <div class="lbl">我的星探 ${l.scouts.length}/2</div>`;
      if (!l.scouts.length) h += `<p class="hand" style="color:var(--mute)">没有星探时每天只有少数自荐。</p>`;
      l.scouts.forEach((o) => { h += sCard(o, 's', `<p style="text-align:right;margin:0"><button class="link" data-a="fireS" data-v="${o.id}">解雇</button></p>`); });
      h += `<div class="lbl">今天能请的星探</div>`;
      G.mk.scouts.forEach((o, i) => { h += sCard(o, 's', `<button class="btn mini" data-a="hireS" data-v="${i}">请他</button>`); });
    } else {
      h += `<p class="hand" style="margin-top:8px">营销站在门口拉街上的客人，也让客人更快选好公关、更愿意再回来。</p>
        <div class="lbl">我的营销 ${l.mkts.length}/3</div>`;
      l.mkts.forEach((o) => { h += sCard(o, 'm', `<p style="text-align:right;margin:0"><button class="link" data-a="fireM" data-v="${o.id}">解雇</button></p>`); });
      h += `<div class="lbl">今天能请的营销</div>`;
      G.mk.mkts.forEach((o, i) => { h += sCard(o, 'm', `<button class="btn mini" data-a="hireM" data-v="${i}">请他</button>`); });
    }
  } else {
    h += goalCard();
    h += `<div class="lbl">本周客流</div>${weekStrip()}`;
    const ev = evList();
    if (ev.length) h += ev.map(([t, d, c]) => `<p style="margin:6px 0 0;font-size:12.5px"><span class="badge" style="background:${c};color:#fff;margin:0 6px 0 0">${t}</span>${d}</p>`).join('');
    if (v) {
      h += `<button class="btn" data-a="back" style="margin-top:12px">← 回到全景</button><div class="lbl">${where(v)}</div>`;
      if (v.kind === 'empty') {
        h += `<div class="card"><h5>空铺 · 招租<em>日租 ${fm(v.rent)}</em></h5><p>${v.cn}</p>
          <div class="kv" style="margin-top:6px"><span>面积</span><span>${v.L.toFixed(1)} × ${v.D.toFixed(1)} 格</span></div>
          <div class="kv"><span>押金 + 装修</span><span>${fm(v.cost)}</span></div>
          <div class="kv"><span>人流指数</span><span>× ${v.loc.toFixed(2)}</span></div>
          <button class="btn pri mini" data-a="rent" data-v="${v.i}">租下来开酒吧</button></div>`;
      } else if (v.kind === 'rival') {
        h += `<div class="card"><h5>${esc(v.name)}<em>对手 · ${v.mode === 'agg' ? '激进拉客' : '保守经营'}</em></h5><p>${v.cn}</p>
          <div class="kv" style="margin-top:6px"><span>公关</span><span>${v.hn} 人</span></div>
          <div class="kv"><span>店里客人</span><span data-live="rg"></span></div>
          <div class="kv"><span>营业</span><span>晚 6 点 – 凌晨 3 点</span></div></div>`;
      } else {
        h += `<div class="card"><h5>${esc(v.name)}<em>${lit(v) ? '营业中' : '打烊'}</em></h5><p>${v.cn}</p></div>`;
      }
    } else {
      h += `<div class="lbl">3D 沙盘操作</div><p class="hand">左键/单指拖拽平移街景，滚轮/双指缩放，右键/双指旋转 360° 视角；轻点任意 3D 店铺直接切入透视室内！</p>`;
    }

    const bs = bars();
    h += `<div class="lbl">我的酒吧</div>`;
    if (!bs.length) h += `<p class="hand" style="color:var(--mute)">还没有店，在 3D 地图上点击红色「招租」空铺，或点下方列表开店！</p>`;
    bs.forEach((l) => {
      h += `<div class="card"><h5>${esc(l.name)}<em data-live="b${l.i}"></em></h5>
        <p>${where(l)} · 上班 ${activeH(l).length}/${l.hostesses.length} · 回头客 ${G.regs.filter((r) => r.bar === l.i).length}</p>
        <button class="btn mini" data-a="enter" data-v="${l.i}">进店 →</button></div>`;
    });

    h += `<div class="lbl">空铺招租</div>`;
    G.lots.filter((l) => l.kind === 'empty').forEach((l) => {
      h += `<button class="rowbtn" data-a="enter" data-v="${l.i}"><span>${where(l)}</span><em>${fm(l.cost)} · 日租 ${fm(l.rent)}</em></button>`;
    });

    h += `<div class="lbl">街区对手</div>`;
    G.lots.filter((l) => l.kind === 'rival').forEach((l) => {
      h += `<button class="rowbtn" data-a="enter" data-v="${l.i}"><span>${esc(l.name)}</span><em data-live="b${l.i}"></em></button>`;
    });

    h += `<p style="margin-top:16px">${G._ask ? `<button class="link" data-a="restart" style="color:var(--coral)">确定清空存档重来</button>` : `<button class="link" data-a="ask-restart">重新开始</button>`}</p>`;
    G._ask = false;
  }

  P.innerHTML = h;
  if (v && v.kind === 'mine' && $('ph')) $('ph').textContent = priceHint(v);
  live();
}

export function live() {
  if (!G) return;
  if ($('hDay')) $('hDay').textContent = `第 ${G.day} 天 · ${WD[wday(G.day)]}`;
  const evs = evList();
  if ($('hEv')) {
    $('hEv').style.display = evs.length ? '' : 'none';
    $('hEv').textContent = evs.map((x) => x[0]).join(' · ');
  }
  if ($('hMoney')) $('hMoney').textContent = fm(G.money);
  if ($('hMoneyChip')) $('hMoneyChip').classList.toggle('neg', G.money < 0);
  if ($('tdot')) $('tdot').style.left = clamp((G.t - T0) / (T_END - T0), 0, 1) * 100 + '%';
  document.querySelectorAll('#speed button').forEach((b) => b.classList.toggle('on', +b.dataset.s === G.speed));
  if ($('btnSkipOpen')) $('btnSkipOpen').style.display = G.t < T_OPEN && bars().length > 0 ? '' : 'none';

  const l = G.view != null ? G.lots[G.view] : null;
  if ($('zall')) $('zall').style.display = l ? 'block' : 'none';
  if ($('ttl')) $('ttl').textContent = l && l.name ? l.name : l && l.kind === 'empty' ? '空铺 · 招租' : 'Kota Indah 3D';
  if ($('subttl')) $('subttl').textContent = l ? (l.kind === 'mine' ? '你的店 · ' + (barOpen() ? '营业中' : '还没开门，5 点开') : l.cn) : 'U 形夜街沙盘 · 西口进，北绕停车场，东口出';

  if ($('hClock')) {
    const h = Math.floor(G.t / 60) % 24;
    const mi = Math.floor(G.t % 60);
    const part = G.t < 17 * 60 ? '下午' : G.t < 19 * 60 ? '傍晚' : G.t < 24 * 60 ? '晚上' : '凌晨';
    const open = G.lots.filter(lit).length;
    const street = G.peds.filter((p) => p.st === 'walk' || p.st === 'path').length;
    $('hClock').textContent = `${part} ${h % 12 || 12}:${String(mi).padStart(2, '0')} · ${open} 家亮灯 · 街上 ${street} 人 · 人气 ×${buzz().toFixed(2)}`;
  }

  document.querySelectorAll('[data-live]').forEach((e) => {
    const k = e.dataset.live;
    let t = '';
    if (k === 'buzz') t = '× ' + buzz().toFixed(2);
    else if (k === 'rg') t = l ? l._g.length + ' / ' + cap(l) : '';
    else if (k[0] === 'b') {
      const b = G.lots[+k.slice(1)];
      t = b.kind === 'rival' ? `客 ${b._g.length}/${cap(b)}` : `${stars(b.rep)} · 客 ${b._g.length}/${cap(b)}`;
    } else if (k.startsWith('h:') && l && l.kind === 'mine') {
      const h = l.hostesses.find((x) => x.id === k.slice(2));
      t = h ? hStatus(h) : '';
    } else if (l && l.kind === 'mine') {
      t = k === 'rep'
        ? stars(l.rep)
        : k === 'guests'
          ? `${l._g.length} / ${cap(l)}`
          : k === 'rooms'
            ? `${l.roomsUsed} / ${ROOMS[l.rooms]}`
            : k === 'inc'
              ? `${fm(l.today.hfee)} / ${fm(l.today.drink)}`
              : k === 'prob'
                ? ['local', 'tai', 'cn'].map((c) => Math.round(enterProb(l, c) * 100) + '%').join(' / ')
                : '';
    }
    if (e.textContent !== t) e.textContent = t;
  });
}

export function showEndDayModal(d) {
  const rows = d.barSummaries
    .map((b) => `<div class="kv"><span>${esc(b.name)} · ${b.guests} 人（土 ${b.by.local}/台 ${b.by.tai}/中 ${b.by.cn}）· ${b.hours} 钟</span><span>${fm(b.rev)}</span></div>`)
    .join('');
  const rank = G.lastRank
    ? `<div class="lbl">本周街道排行</div>` +
      G.lastRank.slice(0, 8).map((x, i) => `<div class="kv" style="${x.mine ? 'color:var(--gold);font-weight:700' : ''}"><span>${i + 1}. ${esc(x.name)}</span><span>${fm(x.v)}</span></div>`).join('')
    : '';
  $('sheet').innerHTML = `<h2>第 ${G.day} 天 · ${WD[wday(G.day)]} · 收摊</h2>
    <p class="hand">凌晨三点，门禁落杆，卷帘门拉下来了。</p>
    ${rows || '<p class="hand" style="color:var(--mute)">今天还没开店。</p>'}<hr>
    <div class="kv"><span>公关钟点费</span><span>${fm(d.hf)}</span></div>
    <div class="kv"><span>酒水收入</span><span>${fm(d.dr)}</span></div>
    <div class="kv"><span>进货成本</span><span>${fm(-d.cogs)}</span></div>
    <div class="kv"><span>公关底薪 + 提成</span><span>${fm(-(d.hw + d.hc))}</span></div>
    <div class="kv"><span>星探 / 营销 / 保安日薪</span><span>${fm(-d.sw)}</span></div>
    <div class="kv"><span>铺面日租</span><span>${fm(-d.rent)}</span></div>
    ${d.fines ? `<div class="kv"><span>临检罚款</span><span>${fm(-d.fines)}</span></div>` : ''}
    ${d.fee ? `<div class="kv"><span>每周保护费</span><span>${fm(-d.fee)}</span></div>` : ''}
    ${G.spent ? `<div class="kv"><span>今日投资</span><span>${fm(-G.spent)}</span></div>` : ''}
    <hr><div class="kv tot"><span>今日净额</span><span style="color:${d.net < 0 ? 'var(--coral)' : 'var(--teal)'}">${fm(d.net)}</span></div>
    <div class="kv"><span>手头现金</span><span>${fm(G.money)}</span></div>
    ${d.got.map((g) => `<p class="hand" style="color:var(--teal)">目标完成：${g.t}（+${fm(g.r)}）</p>`).join('')}
    ${bars().length ? `<p class="hand" style="color:var(--mute);margin-top:8px">新回头客 ${d.nr} · 没人陪 ${d.nh} · 没合眼缘 ${d.nl} · 包厢满 ${d.rf} · 满座 ${d.tu} · 被拉走 ${d.sto}</p>` : ''}
    ${rank}${d.extra.map((t) => `<p class="hand">${t}</p>`).join('')}<br>
    ${d.bust
      ? `<p class="hand" style="color:var(--coral)">欠债超过 Rp 5,000k，房东把钥匙收走了。</p><button class="btn pri" data-a="restart">重新开始</button>`
      : `<button class="btn pri" data-a="next">第 ${G.day + 1} 天（${WD[wday(G.day + 1)]}）→</button>`}`;
  $('modal').classList.add('on');
}

export function showBriefModal(news) {
  const m = trafMul();
  const lvl = m < 0.75 ? ['淡', '#aba092'] : m < 1.1 ? ['平', '#3dd6a5'] : ['旺', '#ff5c54'];
  const e = G.ev || {};
  const asks = bars().flatMap((l) => l.hostesses).filter((h) => h.raiseAsk);
  $('sheet').innerHTML = `<h2>第 ${G.day} 天 · ${WD[wday(G.day)]}</h2>
    <p class="hand">今晚客流：<b style="color:${lvl[1]}">${lvl[0]}</b>（× ${m.toFixed(2)}）。${m < 0.75 ? '平日人少，别让太多公关上班。' : m >= 1.1 ? '人多，把能上的公关都排上。' : ''}</p>
    ${evList().map(([t, d, c]) => `<p style="margin:4px 0"><span class="badge" style="background:${c};color:#fff;margin:0 6px 0 0">${t}</span>${d}</p>`).join('')}
    ${e.vip ? `<div class="card" style="margin-top:8px"><p>${e.vip.who} ${e.vip.n} 人今晚约 ${Math.floor(e.vip.at / 60)}:${String(Math.round(e.vip.at % 60)).padStart(2, '0')} 到 <b>${esc(G.lots[e.vip.bar].name)}</b>，要 ${e.vip.n} 个<b>${BODY[e.vip.body]}${e.vip.pers !== 'any' ? '、' + PERS[e.vip.pers] : ''}</b>的公关。</p></div>` : ''}
    ${wday(G.day) === 6 && bars().length ? `<p class="hand" style="color:var(--coral)">今晚收摊后要交每周保护费，共 ${fm(bars().reduce((a, l) => a + FEE(l), 0))}。</p>` : ''}
    ${news.length ? `<div class="lbl">昨晚到今早</div>` + news.map((t) => `<p style="margin:3px 0;font-size:13px">${t}</p>`).join('') : ''}
    ${asks.length ? `<div class="lbl">加薪申请</div>` + asks.map((h) => `<div class="kv" style="align-items:center"><span>${avatar(h, 28)} ${esc(h.name)} · ${fm(h.wage)} → ${fm(h.raiseAsk)}</span><span><button class="tog on" data-a="raiseY" data-v="${h.id}">同意</button> <button class="tog" data-a="raiseN" data-v="${h.id}">拒绝</button></span></div>`).join('') : ''}
    ${G.goal < GOALS.length ? `<p class="hand" style="margin-top:10px">当前目标：${GOALS[G.goal].t}（奖励 ${fm(GOALS[G.goal].r)}）</p>` : ''}
    <br><button class="btn pri" data-a="start">开始这一天</button>${bars().length ? `<button class="btn" data-a="schedule">先去排班</button>` : ''}`;
  $('modal').classList.add('on');
}
