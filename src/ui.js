import {
  ACHIEVEMENTS, BODY, COGS, CONCEPTS, CT, FEE, GOALS, MAXH, ROOMS, SKILLS, SKINS, SPECIAL_MENU,
  T0, T_END, T_OPEN, TIER, TRAITS, UPG, WD, WMUL, activeH, clamp, esc, fm, fmShort, onDuty, tierOf, wday, where,
} from './config.js';
import {
  ALL_REEL_SYMBOLS, GIRL_MILESTONES, LEGEND_GIRLS, LEGEND_MAP, RARITY_TIERS, REEL_LEFT,
  REEL_MID, REEL_RIGHT, SLOT_LEVELS, WHALES, barMatchedWhales, evalBarSynergy, formatReelItem,
  girlMilestoneBonuses, rarityOf, slotLockCost, spinCost, whalePerkBonuses,
} from './codex.js';
import { G, bars, cap } from './state.js';
import { buyoutCost, rivalIntel } from './economy.js';
import { barOpen, buzz, enterProb, evList, fair, lit, trafMul, wagesOf } from './sim.js';

const $ = (id) => document.getElementById(id);
let AVN = 0;

const UPG_TAG = { decor: '吸引 · 满意', seats: '卡座扩容', rooms: '5→7→9→12', sign: '全街聚客' };
const MENU_TAG = { bucket: '土客加桶', platter: '耐心 +35%', whisky: '包厢开酒', champagne: '口碑 · 礼花' };

const vbar = (pct, col = 'teal') =>
  `<span class="vbar"><i class="${col}" style="width:${clamp(Math.round(pct), 4, 100)}%"></i></span>`;

export function toast(t) {
  const e = $('toast');
  if (!e) return;
  e.textContent = t;
  e.classList.add('on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => e.classList.remove('on'), 2400);
}

function accVector(acc) {
  switch (acc) {
    case 'tiara': return `<path d="M14 9.5 L17.5 4.5 L21 8 L24.5 4.5 L28 9.5Z" fill="#E2B24A" stroke="#2F261E" stroke-width=".7"/>`;
    case 'flower': return `<circle cx="29.5" cy="14" r="3.4" fill="#E85A4F"/><circle cx="29.5" cy="14" r="1.2" fill="#F6D55C"/>`;
    case 'pearl': return `<circle cx="13" cy="21" r="1.3" fill="#FAF5E8" stroke="#9E6214" stroke-width=".6"/><circle cx="29" cy="21" r="1.3" fill="#FAF5E8" stroke="#9E6214" stroke-width=".6"/><path d="M16.5 31 Q21 35.5 25.5 31" fill="none" stroke="#FAF5E8" stroke-width="1.8" stroke-dasharray="1.8 1.4"/>`;
    case 'star': return `<polygon points="28,9.5 29,12 31.5,12 29.5,13.5 30.2,16 28,14.5 25.8,16 26.5,13.5 24.5,12 27,12" fill="#F6D55C" stroke="#2F261E" stroke-width=".5"/>`;
    case 'glasses': return `<rect x="15.2" y="16.5" width="4.8" height="3.2" rx="1" fill="none" stroke="#2F261E" stroke-width=".9"/><rect x="22" y="16.5" width="4.8" height="3.2" rx="1" fill="none" stroke="#2F261E" stroke-width=".9"/><line x1="20" y1="18" x2="22" y2="18" stroke="#2F261E" stroke-width=".9"/>`;
    case 'jade': return `<circle cx="12.8" cy="21" r="1.3" fill="#2A9D8F"/><circle cx="29.2" cy="21" r="1.3" fill="#2A9D8F"/><circle cx="21" cy="33.5" r="1.6" fill="#2A9D8F"/>`;
    case 'headset': return `<path d="M12 18 Q12 7.5 21 7.5 Q30 7.5 30 18" fill="none" stroke="#2F261E" stroke-width="1.8"/><rect x="10.2" y="16" width="2.8" height="5" rx="1" fill="#5B7FA6"/><rect x="29" y="16" width="2.8" height="5" rx="1" fill="#5B7FA6"/>`;
    case 'goldpin': return `<line x1="25" y1="6" x2="31" y2="12" stroke="#E2B24A" stroke-width="1.5"/><circle cx="31" cy="12" r="1.4" fill="#E2B24A"/>`;
    case 'ribbon': return `<path d="M17 8.5 L21 10.5 L17 12.5Z M25 8.5 L21 10.5 L25 12.5Z" fill="#E76F8B" stroke="#2F261E" stroke-width=".5"/>`;
    default: return '';
  }
}

export function avatar(o, sz = 34) {
  const id = 'av' + AVN++;
  const sk = o.skin || '#D7A47C';
  const hr = o.hair || '#2b211b';
  const cl = o.dress || o.shirt || '#888';
  const t = o.pop != null ? tierOf(o) : 0;
  const rSpec = !o.male && (o.rarity != null || o.legendId) ? rarityOf(o) : null;
  const ring = o.ring || (o.male ? '#2F261E' : rSpec ? rSpec.col : t === 2 ? '#9E6214' : t === 1 ? '#B5362F' : '#2F261E');
  const strokeW = rSpec && rSpec.r >= 4 ? 2.4 : t ? 2.2 : 1.3;
  const hs = o.hs != null ? o.hs : (parseInt(String(o.id || '0').slice(-3), 36) || 0) % 4;
  const crown = (t === 2 || rSpec?.r === 5) && o.acc !== 'tiara' ? `<path d="M16 7 L18 3.5 L21 6 L24 3.5 L26 7Z" fill="#E2B24A"/>` : '';
  const capPath = `<path d="M12.5 17 Q13.5 7.5 21 7.5 Q28.5 7.5 29.5 17 Q26 11.5 21 12.2 Q15.5 11.5 12.5 17Z" fill="${hr}"/>${crown}`;
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
  const acc = !o.male && o.acc ? accVector(o.acc) : '';
  return `<svg class="av" width="${sz}" height="${sz}" viewBox="0 0 42 42" aria-hidden="true"><defs><clipPath id="${id}"><circle cx="21" cy="21" r="19.5"/></clipPath></defs>
    <circle cx="21" cy="21" r="19.5" fill="${rSpec?.r === 5 ? '#FBF0CE' : '#EFE6D4'}"/><g clip-path="url(#${id})">${back}<path d="M5 44 Q7 31.5 21 30.5 Q35 31.5 37 44Z" fill="${cl}"/>${extra}${face}${girl}${front}${acc}</g>
    <circle cx="21" cy="21" r="19.5" fill="none" stroke="${ring}" stroke-width="${strokeW}"/></svg>`;
}

const pips = (n, max, cls = '') =>
  `<span class="pips ${cls}">${Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
const stars = (r) => '★ ' + r.toFixed(1);
const dot = (c) => `<i style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${c};margin-right:4px"></i>`;

export function priceHint(l) {
  const cogs = CONCEPTS[l.concept]?.cogs || COGS;
  const r = l.price / fair(l);
  if (r < 0.8) return `实惠走量 · 赚${l.price - cogs}k`;
  if (r <= 1.15) return `价格公道 · 赚${l.price - cogs}k`;
  if (r <= 1.5) return '略微偏贵';
  return '定价过高';
}

function hStatus(h) {
  if (h.state === 'idle') return h.en < 10 ? '休整' : '待客';
  if (h.state === 'out' && h.until > 24 * 60) {
    const retH = Math.min(17, Math.round((h.until - 24 * 60) / 60));
    return `外出·明${retH}点回`;
  }
  const left = h.until ? Math.max(0, Math.round(h.until - G.t)) : 0;
  const dur = left >= 60 ? `${(left / 60).toFixed(1).replace(/\.0$/, '')}h` : `${left}m`;
  if (h.state === 'out') return left >= 120 ? `外出·${Math.floor((h.until || 0) / 60)}点回` : `外出·${dur}`;
  return h.state === 'with' ? `陪酒·${dur}` : `包厢·${dur}`;
}

const staffLook = (o) => {
  const n = parseInt(String(o.id).slice(-3), 36) || 0;
  return { male: true, skin: o.skin || SKINS[n % 4], hair: o.hair || '#2b211b' };
};

function traitBadges(h) {
  if (!h.traits || !h.traits.length) return '';
  return `<span class="traits">${h.traits
    .map((tid) => {
      const t = TRAITS[tid];
      return t ? `<span class="trait-pill" style="color:${t.col}" title="${t.desc}">${t.cn}</span>` : '';
    })
    .join('')}</span>`;
}

function hCard(h, cand, curBar) {
  const t = tierOf(h);
  const rSpec = rarityOf(h);
  const off = !cand && !onDuty(h);
  const on = h.on && !h.sick;
  const shielded = !cand && (h.loyalUntil || 0) >= G.day;
  const otherBars = !cand && curBar ? bars().filter((b) => b.i !== curBar.i) : [];
  const leg = h.legendId ? LEGEND_MAP[h.legendId] : null;
  const hireBtn = cand === 'slot'
    ? `<button class="btn pri mini" style="margin:0;padding:3px 10px" data-a="hirePending">✨ 签约入店</button>`
    : `<button class="btn pri mini" style="margin:0;padding:3px 10px" data-a="hireH" data-v="${cand}">签约聘用</button>`;

  const bodyLbl = h.body === 'prime' ? `💎 ${BODY[h.body]}` : BODY[h.body];
  return `<div class="card hc compact${off ? ' off' : ''}${rSpec.r === 5 ? ' legend' : ''}"><div class="hrow">${avatar(h, 34)}<div class="hmain">
    <h5><span>${esc(h.name)}<span class="r-badge r${rSpec.r}">${rSpec.short}</span><span class="type-pill${h.body === 'prime' ? ' prime' : ''}">${bodyLbl}</span>${t ? `<span class="badge b${t}">${TIER[t]}</span>` : ''}${h.sick ? '<span class="badge boff">病假</span>' : ''}${shielded ? '<span class="shield-badge" title="防挖角护盾">🛡️</span>' : ''}${traitBadges(h)}</span>
      <em${cand || off ? '' : ` data-live="h:${h.id}"`}>${cand ? `${fmShort(h.wage)}/晚` : off ? '休息中' : hStatus(h)}</em></h5>
    ${leg ? `<div class="legend-aura">👑 ${esc(leg.title)} · ${esc(leg.auraCn)}</div>` : ''}
    <div class="h-charm-row"><small>魅力</small>${vbar(h.looks * 10, 'purple')}</div>
    ${cand
      ? `<div class="hb">${hireBtn}</div>`
      : `<div class="h-bars-3">
          <div class="h-bar-cell"><small>体力</small>${vbar(h.en, h.en < 30 ? 'coral' : h.en < 60 ? 'gold' : 'teal')}</div>
          <div class="h-bar-cell"><small>心情</small>${vbar(h.mood, h.mood < 35 ? 'coral' : h.mood < 65 ? 'sky' : 'teal')}</div>
          <div class="h-bar-cell"><small>人气</small>${vbar(Math.min(100, h.pop), 'gold')}</div>
        </div>
        <div class="hb">
          <span class="num" style="font-size:10.5px;color:var(--mute)">${fmShort(h.wage)}</span>
          <button class="tog${on ? ' on' : ''}" data-a="tog" data-v="${h.id}">${on ? '上班' : h.sick ? '病假' : '休息'}</button>
          <button class="tog" data-a="hongbao" data-v="${h.id}" title="心情↑ 防挖角">🧧500k</button>
          <button class="tog" data-a="trainH" data-v="${h.id}" ${curBar?.trainedToday ? 'disabled' : ''} title="每日1次特训">✨特训</button>
          ${otherBars.length && h.state === 'idle' ? `<select class="xfer" data-xfer="${h.id}" aria-label="跨店调配"><option value="">调店</option>${otherBars.map((b) => `<option value="${b.i}">→ ${esc(b.name)}</option>`).join('')}</select>` : ''}
          <button class="link" data-a="fireH" data-v="${h.id}">解约</button>
        </div>`
    }</div></div></div>`;
}

function sCard(o, role, actBtn) {
  const shirt = role === 's' ? '#5B7FA6' : role === 'b' ? '#242329' : '#6B4E3D';
  const roleLabel = role === 's' ? (o.kind === 'q' ? '精选星探' : '扩招星探') : role === 'b' ? '保安' : '营销';
  return `<div class="s-row-card">
    <div class="s-row-left">${avatar(Object.assign(staffLook(o), { shirt }), 30)}
      <div class="s-row-info"><b>${esc(o.name)} · ${roleLabel}</b>
        <div class="s-bar-wrap">${vbar(o.ab * 10, 'sky')}<small>${fmShort(o.wage)}/天</small></div>
      </div>
    </div>
    ${actBtn}
  </div>`;
}

const seg = (k, cur, opts) =>
  `<div class="seg">${opts.map(([v, t]) => `<button class="${String(cur) === String(v) ? 'on' : ''}" data-a="req" data-v="${k}:${v}">${t}</button>`).join('')}</div>`;

function goalCard() {
  if (G.goal >= GOALS.length) return `<div class="goalc"><div><small>ALL CLEAR</small><b>你已是夜街传奇</b></div><span>🏆</span></div>`;
  const g = GOALS[G.goal];
  return `<div class="goalc"><div><small>目标 ${G.goal + 1}/${GOALS.length}</small><b>${g.t}</b></div><span>+${fmShort(g.r)}</span></div>`;
}

const weekStrip = () =>
  `<div class="wk">${WD.map((w, i) => `<div class="${i === wday(G.day) ? 'cur' : ''}"><span class="wk-track"><i style="height:${Math.max(4, Math.round(WMUL[i] * 14))}px"></i></span><span>${w.slice(1)}</span></div>`).join('')}</div>`;

export function renderEventCards() {
  const cards = evList().map(([t, d, c, ico]) => ({ t, d, c, ico }));
  const vip = G?.ev?.vip;
  if (vip && G.lots[vip.bar]) {
    const hh = Math.floor(vip.at / 60);
    const mm = String(Math.round(vip.at % 60)).padStart(2, '0');
    cards.push({
      t: `VIP · ${G.lots[vip.bar].name}`,
      d: `${hh}:${mm} · ${vip.n}人 · ${vip.body === 'any' ? '不限身材' : '要' + BODY[vip.body]}`,
      c: '#9E6214',
      ico: '💎',
    });
  }
  if (!cards.length) return '';
  return `<div class="ev-card-deck">${cards
    .map((x) => `<div class="ev-card" style="--evc:${x.c}"><span class="ev-card-ico">${x.ico}</span><div class="ev-card-body"><b>${esc(x.t)}</b><small>${esc(x.d)}</small></div></div>`)
    .join('')}</div>`;
}

export function renderHistoryChart() {
  const hist = (G?.history || []).slice(-7);
  if (!hist.length) return '';
  const maxAbs = Math.max(1000, ...hist.map((x) => Math.abs(x.opProfit ?? x.net ?? 0)));
  return `<div class="hist-chart">${hist
    .map((x) => {
      const val = x.opProfit ?? x.net ?? 0;
      const pct = Math.max(10, Math.round((Math.abs(val) / maxAbs) * 100));
      return `<div class="hist-col" title="第${x.day}天 ${fm(val)}"><span class="hist-val">${fmShort(val)}</span><div class="hist-bar${val < 0 ? ' neg' : ''}" style="height:${Math.round(pct * 0.56)}%"></div><small>${x.wd.slice(1)}</small></div>`;
    })
    .join('')}</div>`;
}

export function renderSlotCell(colIdx, itemIdx) {
  const it = formatReelItem(colIdx, itemIdx);
  const titleStyle = it.color ? ` style="color:${it.color}"` : '';
  return `<div class="slot-cell ${it.cls}"><i>${it.icon}</i><b${titleStyle}>${esc(it.title)}</b><span>${esc(it.sub)}</span></div>`;
}

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
    const cLabel = CONCEPTS[l.concept || 'bintang'].cn;
    const totToday = (l.today?.hfee || 0) + (l.today?.drink || 0);

    h += `<div class="deck-head">
      <div class="bar-head-row">
        <button class="btn-back" data-a="back">←</button>
        <input class="nm" id="nm" value="${esc(l.name)}" maxlength="16" aria-label="店名">
        <span class="concept-chip">${cLabel}</span>
      </div>
      <div class="kpi-4">
        <div><small>⭐ 口碑</small><b data-live="rep">${stars(l.rep)}</b></div>
        <div><small>👥 在店</small><b data-live="guests">${l._g.length}/${cap(l)}</b></div>
        <div><small>🚪 包厢</small><b data-live="rooms">${l.roomsUsed}/${ROOMS[l.rooms]}</b></div>
        <div><small>💰 营收</small><b data-live="incTot">${fmShort(totToday)}</b></div>
      </div>
      <div class="subtabs">${[
        ['run', '🎛️ 运营'],
        ['upg', '🛠️ 升级'],
        ['girls', `💃 公关(${l.hostesses.length})`],
        ['scout', '🎰 摇人'],
        ['mkt', `🛡️ 团队(${(l.bouncers || []).length + l.mkts.length})`],
      ].map(([k, t]) => `<button class="${tab === k ? 'on' : ''}" data-a="tab" data-v="${k}">${t}</button>`).join('')}</div>
    </div><div class="deck-body">`;

    if (tab === 'run') {
      const luredWhales = barMatchedWhales(l, G);
      h += `<div class="grid-3">${Object.values(CONCEPTS)
          .map((c) => `<button class="concept-btn${l.concept === c.id ? ' on' : ''}" data-a="concept" data-v="${c.id}"><b>${c.cn}</b><small>${c.tag.split('·')[0].trim()}</small></button>`)
          .join('')}</div>
        <div class="card">
          <div class="price-row">
            <div class="price"><span id="pv">${fm(l.price)}</span> <small>/ 瓶</small></div>
            <span id="ph" style="font-size:11px;font-weight:600;color:var(--ink-2)">${priceHint(l)}</span>
          </div>
          <input type="range" id="pr" min="20" max="120" step="5" value="${l.price}" aria-label="酒价">
          <div class="prob-bars">${['local', 'tai', 'cn'].map((ct, idx) => {
            const pct = Math.round(enterProb(l, ct) * 100);
            const col = idx === 0 ? 'gold' : idx === 1 ? 'teal' : 'coral';
            return `<div class="h-bar-cell"><small>${CT[ct].cn}进店</small><span class="vbar"><i class="${col}" data-live-bar="prob${idx}" style="width:${clamp(pct, 4, 100)}%"></i></span></div>`;
          }).join('')}</div>
        </div>
        <div class="grid-2">
          <button class="btn" data-a="dj" ${l.dj ? 'disabled' : ''}>${l.dj ? '🎧 DJ 就位' : `🎧 请 DJ · 600k`}</button>
          <button class="btn" data-a="flyers" ${G.flyers ? 'disabled' : ''}>${G.flyers ? '📣 传单已发' : `📣 发传单 · 300k`}</button>
        </div>
        <div class="grid-3">
          <div class="card" style="padding:6px 8px;text-align:center"><small style="font-size:10px;color:var(--mute)">日租</small><div class="num" style="font-size:12px">${fmShort(l.rent)}</div></div>
          <div class="card" style="padding:6px 8px;text-align:center"><small style="font-size:10px;color:var(--mute)">团队日薪</small><div class="num" style="font-size:12px">${fmShort(wagesOf(l).s)}</div></div>
          <div class="card" style="padding:6px 8px;text-align:center"><small style="font-size:10px;color:var(--mute)">熟客</small><div class="num" style="font-size:12px">${regs.length} 拨</div></div>
        </div>`;
      if (luredWhales.length) {
        h += `<div class="whale-lure-banner">🎣 <b>今夜阵容已设局吸引：</b>${luredWhales.map((w) => `${w.title}·${w.name}`).join('、')}</div>`;
      }
      if (G.lastVoices && G.lastVoices.length) {
        h += `<div class="lbl"><span>🗣️ 昨夜客群心声</span><span>真实经营反馈</span></div>` +
          G.lastVoices.slice(0, 2).map((vo) => `<div class="voice-card"><div class="voice-head"><b>${esc(vo.who)}</b><small>${esc(vo.barName)}</small></div><p>${esc(vo.text)}</p><span>💡 ${esc(vo.hint)}</span></div>`).join('');
      }
    } else if (tab === 'upg') {
      h += `<div class="lbl"><span>硬装设施</span><span>Lv.3 满级</span></div>
        <div class="grid-2">${Object.keys(UPG).map((k) => {
          const u = UPG[k];
          const lv = l[k];
          return `<div class="card">
            <h5><span>${u.cn}</span><em>Lv.${lv}</em></h5>
            <div style="margin-top:3px;display:flex;justify-content:space-between;align-items:center">${pips(lv, 3)}<span style="font-size:10.5px;color:var(--mute)">${UPG_TAG[k]}</span></div>
            ${lv < 3 ? `<button class="btn pri mini" data-a="up" data-v="${k}">${fmShort(u.cost[lv])}</button>` : `<button class="btn mini" disabled>✓ 满级</button>`}
          </div>`;
        }).join('')}</div>
        <div class="lbl"><span>特色酒单</span><span>${Object.values(SPECIAL_MENU).filter((m) => l.menu?.[m.id]).length}/4</span></div>
        <div class="grid-2">${Object.values(SPECIAL_MENU).map((m) => {
          const owned = !!(l.menu && l.menu[m.id]);
          return `<div class="card">
            <h5><span>${m.cn}</span><em style="color:var(--teal)">+${m.profit}k</em></h5>
            <p>${MENU_TAG[m.id]}</p>
            ${owned ? `<button class="btn mini" disabled>✓ 已上架</button>` : `<button class="btn mini" data-a="buyMenu" data-v="${m.id}">${fmShort(m.cost)}</button>`}
          </div>`;
        }).join('')}</div>`;
    } else if (tab === 'girls') {
      const base = act.reduce((a, x) => a + x.wage, 0);
      const m = trafMul();
      const syn = evalBarSynergy(l);
      const lured = barMatchedWhales(l, G);

      h += `<div class="hb" style="justify-content:space-between;margin:0">
          <span class="num" style="font-size:11px;color:var(--ink-2)">在岗 ${act.length}/${l.hostesses.length} · 薪 ${fmShort(base)} · 客流 ${m.toFixed(1)}×</span>
          <span style="display:flex;gap:4px">
            <button class="tog" data-a="tab" data-v="scout">🎰 摇人</button>
            <button class="tog on" data-a="preset" data-v="smart">智能</button>
            <button class="tog" data-a="preset" data-v="rush">全上</button>
            <button class="tog" data-a="preset" data-v="rest">轮休</button>
          </span>
        </div>
        <div class="syn-box">
          <div class="syn-head"><b>今夜阵容化学反应</b><button class="btn-x" data-a="openCodex">📖 图鉴线索</button></div>
          <div class="syn-pills">${
            syn.synergies.length
              ? syn.synergies.map((s) => `<span class="syn-pill" title="${esc(s.req)}：${esc(s.desc)}">${s.icon} ${esc(s.cn)}</span>`).join('')
              : `<span class="syn-empty">暂无激活羁绊（例如 歌姬+酒神、苗条≥2+丰满≥2）</span>`
          }</div>
          ${lured.length ? `<div class="syn-lure">🎩 可吸引金主：${lured.map((w) => `${w.title}·${w.name}`).join('、')}</div>` : ''}
          ${syn.clashes.map((c) => `<div class="clash-alert"><b>${c.icon} ${esc(c.cn)}</b>：${esc(c.desc)} · <i>${esc(c.fix)}</i></div>`).join('')}
        </div>`;
      if (!l.hostesses.length) {
        h += `<div class="card"><p>店内暂无公关，所有公关均须通过「🎰 摇人」抽取签约。</p><button class="btn pri mini" data-a="tab" data-v="scout">🎰 前往摇人招募 →</button></div>`;
      }
      l.hostesses.slice().sort((a, b) => onDuty(b) - onDuty(a) || rarityOf(b).r - rarityOf(a).r || b.pop - a.pop).forEach((x) => { h += hCard(x, null, l); });
    } else if (tab === 'scout') {
      const sl = G.slot;
      const sDef = SLOT_LEVELS[sl.lv] || SLOT_LEVELS[1];
      const cost = spinCost(sl, G.codexWhales);
      const spinning = !!G._slotSpinning;
      const lockCost = slotLockCost(G.codexWhales);
      const pityPct = clamp(Math.round((sl.pity / sDef.pityMax) * 100), 4, 100);
      const spinLabel = sl.freeLeft > 0
        ? `🎰 拉杆摇人 · 免费(${sl.freeLeft})${cost.lockFee ? ` + 锁轴${fmShort(cost.lockFee)}` : ''}`
        : `🎰 拉杆摇人 · ${fmShort(cost.total)}`;
      const colLabels = ['出身品级', '体态风情', '天生Buff'];
      const pTier = sl.pending ? rarityOf(sl.pending).r : ((sl.reels[0] || 0) + 1);
      const winMsg = pTier >= 5
        ? '🌟 JACKPOT！5等传奇名花降临！'
        : pTier === 4
          ? '👑 大奖！4等镇店头牌！'
          : pTier === 3
            ? '💃 喜获 3等人气红牌！'
            : `✨ 摇出 ${rarityOf(sl.pending).short} 候选`;

      h += `<div class="slot-cabinet tier-${pTier}${spinning ? ' is-spinning' : ''}${!spinning && sl.lastJackpot ? ' jackpot' : ''}">
        <div class="slot-bulbs" aria-hidden="true">${Array.from({ length: 10 }, () => '<i></i>').join('')}</div>
        <div class="slot-top">
          <div><b>🎰 Lv.${sl.lv} ${sDef.cn}</b><small>${sDef.desc}</small></div>
          <div class="slot-top-acts">
            <button class="btn-x" data-a="openCodex">📖 图鉴</button>
            ${sl.lv < 4 ? `<button class="tog on" data-a="slotUp" ${spinning ? 'disabled' : ''}>升级 ${fmShort(sDef.upCost)}</button>` : `<span class="badge b2">满级</span>`}
          </div>
        </div>
        <div class="slot-pity">
          <span>🌟 5等名花保底 <b>${sl.pity}/${sDef.pityMax}</b></span>
          <span class="vbar"><i class="gold" style="width:${pityPct}%"></i></span>
        </div>
        <div class="slot-stage">
          <div class="slot-payline" aria-hidden="true"><span>▶</span><span>◀</span></div>
          <canvas id="slotFxCanvas" class="slot-fx-canvas"></canvas>
          <div class="slot-reels">
            ${[0, 1, 2].map((idx) => `<div class="slot-col${sl.locks[idx] ? ' locked' : ''}" id="slotCol${idx}">
              <small class="slot-col-lbl">${colLabels[idx]}</small>
              <div class="slot-window">
                <div class="slot-strip" id="reelStrip${idx}">${renderSlotCell(idx, sl.reels[idx] || 0)}</div>
              </div>
              <button class="slot-lock${sl.locks[idx] ? ' on' : ''}" data-a="slotLock" data-v="${idx}" ${sDef.lockAllowed && !spinning ? '' : 'disabled'}>${sl.locks[idx] ? '🔒 已锁' : sDef.lockAllowed ? `🔓 锁(${fmShort(lockCost)})` : 'Lv.2解锁'}</button>
            </div>`).join('')}
          </div>
        </div>
        <div class="slot-lever-row">
          <button class="btn pri slot-lever-btn" data-a="slotSpin">${spinning ? '⏩ 点击跳过动画' : spinLabel}</button>
        </div>
      </div>`;

      h += `<div class="slot-chute">`;
      if (spinning) {
        h += `<div class="slot-rolling-hint">🎰 转轴飞速旋转中，祝你好运…</div>`;
      } else if (sl.pending) {
        h += `<div class="dispense-in">
          <div class="slot-win-banner r${pTier}">${winMsg}</div>
          ${hCard(sl.pending, 'slot', l)}
        </div>`;
      }
      h += `</div>`;
    } else {
      const bnc = l.bouncers || [];
      const shieldPct = bnc.length >= 2 ? 90 : bnc.length === 1 ? 55 : 0;
      h += `<div class="lbl"><span>🛡️ 保安 · 防截胡 ${shieldPct}%</span><span>${bnc.length}/2</span></div>`;
      bnc.forEach((o) => {
        h += sCard(o, 'b', `<button class="tog s-row-act" data-a="fireB" data-v="${o.id}">解雇</button>`);
      });
      (G.mk.bouncers || []).forEach((o, i) => {
        h += sCard(o, 'b', `<button class="btn s-row-act" style="width:auto" data-a="hireB" data-v="${i}">雇看场</button>`);
      });

      h += `<div class="lbl"><span>📣 营销</span><span>${l.mkts.length}/3</span></div>`;
      l.mkts.forEach((o) => {
        h += sCard(o, 'm', `<button class="tog s-row-act" data-a="fireM" data-v="${o.id}">解雇</button>`);
      });
      G.mk.mkts.forEach((o, i) => {
        h += sCard(o, 'm', `<button class="btn s-row-act" style="width:auto" data-a="hireM" data-v="${i}">聘营销</button>`);
      });
    }
    h += `</div>`;
  } else {
    const bs = bars();
    const empties = G.lots.filter((l) => l.kind === 'empty');
    const rivals = G.lots.filter((l) => l.kind === 'rival');
    const stTab = G.streetTab || (bs.length ? 'mine' : 'empty');

    h += `<div class="deck-head">
      ${goalCard()}
      ${weekStrip()}
      ${renderEventCards()}`;

    if (v) {
      if (v.kind === 'empty') {
        const starter = bs.length === 0 && v.cost <= 16000;
        h += `<div class="sel-card">
          <div class="sel-head"><b>${where(v)}${starter ? ' <span class="starter-badge">🔥推荐</span>' : ''}</b><button class="btn-x" data-a="back">收起</button></div>
          <div class="grid-2">
            <div class="kv"><span>面积</span><span>${v.L.toFixed(0)}×${v.D.toFixed(0)}</span></div>
            <div class="kv"><span>人流</span><span>×${v.loc.toFixed(2)}</span></div>
            <div class="kv"><span>押金</span><span>${fmShort(v.cost)}</span></div>
            <div class="kv"><span>日租</span><span>${fmShort(v.rent)}</span></div>
          </div>
          <button class="btn pri mini" style="margin-top:6px" data-a="rent" data-v="${v.i}">租下开店 · ${fmShort(v.cost)}</button>
        </div>`;
      } else if (v.kind === 'rival') {
        const intel = rivalIntel(v);
        const bCost = buyoutCost(v);
        const canBuy = !!(G.bestRank && G.bestRank <= 3);
        h += `<div class="sel-card">
          <div class="sel-head"><b>${esc(v.name)}</b><button class="btn-x" data-a="back">收起</button></div>
          <div class="grid-2" style="align-items:center">
            <div class="kv"><span>风格</span><span>${G.rival[v.i]?.mode === 'agg' ? '激进' : '自然'}</span></div>
            <div class="kv"><span>公关</span><span>${v.hn}人</span></div>
            <div class="h-bar-cell"><small>颜值</small>${vbar(intel.quality * 10, 'purple')}</div>
            <div class="kv"><span>周流</span><span>${fmShort(intel.wkRev)}</span></div>
          </div>
          <div class="grid-2" style="margin-top:6px">
            <button class="btn mini" style="margin:0" data-a="poach" data-v="${v.i}" ${G.poachedToday || !bs.length ? 'disabled' : ''}>${G.poachedToday ? '今日已挖' : `🕵️ 挖渠道 ${fmShort(2500)}`}</button>
            <button class="btn pri mini" style="margin:0" data-a="buyout" data-v="${v.i}" ${canBuy ? '' : 'disabled'}>${canBuy ? `🦈 收购 ${fmShort(bCost)}` : `🔒 前3收购`}</button>
          </div>
        </div>`;
      } else {
        h += `<div class="sel-card">
          <div class="sel-head"><b>${esc(v.name)} · ${lit(v) ? '营业中' : '打烊'}</b><button class="btn-x" data-a="back">收起</button></div>
        </div>`;
      }
    }

    h += `<div class="subtabs">
        <button class="${stTab === 'mine' ? 'on' : ''}" data-a="streetTab" data-v="mine">🏪 门店 (${bs.length})</button>
        <button class="${stTab === 'empty' ? 'on' : ''}" data-a="streetTab" data-v="empty">🔑 招租 (${empties.length})</button>
        <button class="${stTab === 'rival' ? 'on' : ''}" data-a="streetTab" data-v="rival">🥂 同行 (${rivals.length})</button>
      </div>
    </div><div class="deck-body">`;

    if (stTab === 'mine') {
      if (!bs.length) {
        h += `<div class="card"><h5>暂无门店</h5><p>挑选一间空铺开启夜市生意</p><button class="btn pri mini" data-a="streetTab" data-v="empty">去看空铺 →</button></div>`;
      }
      bs.forEach((l) => {
        const rev = (l.today?.hfee || 0) + (l.today?.drink || 0);
        h += `<div class="card">
          <h5><span>${esc(l.name)} <small style="color:var(--gold);font-weight:600">${CONCEPTS[l.concept || 'bintang'].cn}</small></span><em data-live="b${l.i}">${stars(l.rep)} · 客 ${l._g.length}/${cap(l)}</em></h5>
          <p>${where(l)} · 上班 ${activeH(l).length}/${l.hostesses.length} · 营收 ${fmShort(rev)}</p>
          <button class="btn pri mini" data-a="enter" data-v="${l.i}">进店 →</button>
        </div>`;
      });
      if (G.history && G.history.length > 0) {
        h += `<div class="lbl"><span>近 7 日利润</span><span>${G.history.length}天</span></div>${renderHistoryChart()}`;
      }
      h += `<div style="display:flex;justify-content:flex-end;margin-top:2px">${G._ask ? `<button class="link" data-a="restart" style="color:var(--coral)">确认重开</button>` : `<button class="link" data-a="ask-restart">重新开始</button>`}</div>`;
    } else if (stTab === 'empty') {
      h += `<div class="grid-2">${empties.map((l) => {
        const starter = bs.length === 0 && l.cost <= 16000;
        const isSel = v && v.i === l.i;
        return `<button class="lot-card${isSel ? ' sel' : ''}" data-a="enter" data-v="${l.i}">
          <div class="lot-card-top"><span>${where(l)}</span>${starter ? '<span class="starter-badge">🔥推荐</span>' : `<span class="num" style="font-size:10px;color:var(--mute)">×${l.loc.toFixed(2)}</span>`}</div>
          <div class="lot-card-nums"><span>押 ${fmShort(l.cost)}</span><span>租 ${fmShort(l.rent)}</span></div>
        </button>`;
      }).join('')}</div>`;
    } else {
      h += rivals.map((l) => {
        const r = G.rival[l.i] || { mode: 'con', hn: l.hn || 4, wk: 0 };
        const isSel = v && v.i === l.i;
        return `<button class="rival-row${isSel ? ' sel' : ''}" data-a="enter" data-v="${l.i}">
          <span><b>${esc(l.name)}</b><small>${r.mode === 'agg' ? '激进' : '保守'}</small></span>
          <span class="rival-nums">公关${l.hn} · <em data-live="b${l.i}" style="font-style:normal">客${l._g.length}/${cap(l)}</em> · ${fmShort(r.wk || 0)}</span>
        </button>`;
      }).join('');
    }
    h += `</div>`;
    G._ask = false;
  }

  P.innerHTML = h;
  if (v && v.kind === 'mine' && $('ph')) $('ph').textContent = priceHint(v);
  live();
}

function renderSkillDock(l) {
  const dock = $('skillDock');
  if (!dock) return;
  if (!l || l.kind !== 'mine' || !barOpen()) {
    dock.style.display = 'none';
    return;
  }
  dock.style.display = 'flex';
  dock.innerHTML = Object.values(SKILLS)
    .map((s) => {
      const sk = l.skills?.[s.id] || { activeUntil: 0, cdUntil: 0 };
      const active = G.t < sk.activeUntil;
      const cd = !active && G.t < sk.cdUntil;
      const rem = active ? Math.ceil(sk.activeUntil - G.t) : cd ? Math.ceil(sk.cdUntil - G.t) : 0;
      const cls = active ? 'skill-btn active' : cd ? 'skill-btn cd' : 'skill-btn';
      const sub = active ? `${rem}m` : cd ? `${rem}m` : s.cost ? fmShort(s.cost) : '免费';
      return `<button class="${cls}" data-skill="${s.id}" title="${s.desc}">${s.icon} <span>${s.short}</span> <small>${sub}</small></button>`;
    })
    .join('');
}

export function renderLiveEvent() {
  const card = $('liveEventCard');
  if (!card) return;
  const ev = G?.liveEvent;
  if (!ev || G.modal) {
    card.style.display = 'none';
    return;
  }
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const pct = clamp(((ev.expiresAt - now) / ev.durMs) * 100, 0, 100);
  card.style.display = 'block';
  card.innerHTML = `<div class="le-stamp"><span>⚡ 突发事件</span><small>${esc(ev.barName)}</small></div>
    <div class="le-hero"><i>${ev.icon}</i><div><b>${esc(ev.title)}</b><small>${esc(ev.desc)}</small></div></div>
    <div class="le-bar"><i style="width:${pct.toFixed(1)}%"></i></div>
    <div class="ev-choice-grid">
      <button class="le-opt pri" data-ev="A"><b>A. ${ev.optA.label}</b><small>${ev.optA.hint}</small></button>
      <button class="le-opt" data-ev="B"><b>B. ${ev.optB.label}</b><small>${ev.optB.hint}</small></button>
    </div>`;
}

function renderBarPills() {
  const wrap = $('barPills');
  if (!wrap || !G) return;
  const bs = bars();
  if (!bs.length) {
    wrap.innerHTML = '';
    return;
  }
  const pills = [
    `<button class="bar-pill${G.view == null ? ' on' : ''}" data-jump="-1">全景</button>`,
    ...bs.map((b) => `<button class="bar-pill${G.view === b.i ? ' on' : ''}" data-jump="${b.i}">★ ${esc(b.name)}</button>`),
  ];
  const html = pills.join('');
  if (wrap._last !== html) {
    wrap._last = html;
    wrap.innerHTML = html;
  }
}

function updateMobileTabs() {
  const nav = $('mobTabs');
  if (!nav || !G) return;
  const l = G.view != null ? G.lots[G.view] : null;
  let active = 'overview';
  if (l && l.kind === 'mine') {
    active = G.tab === 'upg' ? 'upg' : G.tab === 'girls' ? 'girls' : G.tab === 'scout' || G.tab === 'mkt' ? 'staff' : 'run';
  }
  nav.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.mtab === active));
}

export function showCodexModal(codexTab = G?._codexTab || 'girls') {
  if (!G) return;
  G._codexTab = codexTab;
  const gMap = G.codexGirls || {};
  const wMap = G.codexWhales || {};
  const gCnt = LEGEND_GIRLS.filter((g) => gMap[g.id]).length;
  const wCnt = WHALES.filter((w) => wMap[w.id]?.unlocked).length;
  const gMile = girlMilestoneBonuses(gMap);

  let body = '';
  if (codexTab === 'girls') {
    body += `<div class="codex-miles">${GIRL_MILESTONES.map((m) => {
      const ok = gCnt >= m.count;
      return `<div class="cmile${ok ? ' ok' : ''}"><b>${m.cn}</b><small>${m.bonusCn}</small></div>`;
    }).join('')}</div>`;
    body += `<div class="codex-grid">${LEGEND_GIRLS.map((lg) => {
      const ok = !!gMap[lg.id];
      if (!ok) {
        return `<div class="codex-card locked">
          <div class="cc-top">${avatar({ male: false, skin: '#CFC4AD', hair: '#8E897E', dress: '#B5B0A6', hs: 0 }, 36)}<div><b>??? · ${esc(lg.title)}</b><small>5等传奇名花 · 暂未收录</small></div></div>
          <p class="cc-bio">通过「🎰 摇人」高阶招募机或保底 Jackpot 抽取解锁并点亮图鉴。</p>
        </div>`;
      }
      return `<div class="codex-card ok">
        <div class="cc-top">${avatar(Object.assign({}, lg, { rarity: 5, pop: 100 }), 36)}<div><b>${esc(lg.name)} <span class="r-badge r5">5等·名花</span></b><small>${esc(lg.title)} · ${BODY[lg.body]}</small></div></div>
        <div class="cc-traits">${lg.traits.map((tid) => `<span class="trait-pill" style="color:${TRAITS[tid].col}">${TRAITS[tid].cn}</span>`).join('')}</div>
        <div class="cc-aura">✨ ${esc(lg.auraCn)}</div>
        <p class="cc-bio">${esc(lg.bio)}</p>
      </div>`;
    }).join('')}</div>`;
  } else {
    body += `<div class="codex-grid">${WHALES.map((w) => {
      const rec = wMap[w.id] || { visits: 0, unlocked: false };
      const starsStr = '★'.repeat(Math.min(3, rec.visits || 0)) + '☆'.repeat(Math.max(0, 3 - (rec.visits || 0)));
      return `<div class="codex-card${rec.unlocked ? ' ok' : ''}">
        <div class="cc-top">${avatar({ male: true, skin: w.skin, hair: w.hair, shirt: w.shirt, ring: rec.unlocked ? '#9E6214' : '#6E5F50' }, 36)}<div><b>${esc(w.name)}</b><small>${esc(w.title)} · <span style="color:var(--gold)">${starsStr}</span> (${Math.min(3, rec.visits || 0)}/3)</small></div></div>
        <div class="cc-aura">🎣 线索：${esc(w.clueCn)}</div>
        <p class="cc-bio" style="color:${rec.unlocked ? 'var(--teal)' : 'var(--ink-2)'}"><b>${rec.unlocked ? '✓ ' : '🔒 '}</b>${esc(w.perkCn)}</p>
      </div>`;
    }).join('')}</div>`;
  }

  $('sheet').innerHTML = `<h2>📖 雅加达双图鉴馆</h2>
    <p class="hand">名花已收集 ${gMile.count}/${LEGEND_GIRLS.length} 位 · 金主已满星 ${wCnt}/${WHALES.length} 位</p>
    <div class="subtabs" style="margin:8px 0">
      <button class="${codexTab === 'girls' ? 'on' : ''}" data-a="codexTab" data-v="girls">🌸 雅加达女子图鉴 (${gCnt}/${LEGEND_GIRLS.length})</button>
      <button class="${codexTab === 'whales' ? 'on' : ''}" data-a="codexTab" data-v="whales">🎩 夜街金主图鉴 (${wCnt}/${WHALES.length})</button>
    </div>
    ${body}
    <br><button class="btn pri" data-a="closeModal">关闭</button>`;
  $('modal').classList.add('on');
}

export function showAchievementsModal() {
  const got = G?.achievements || [];
  $('sheet').innerHTML = `<h2>传奇成就（${got.length}/${ACHIEVEMENTS.length}）</h2>
    ${ACHIEVEMENTS.map((a) => {
      const ok = got.includes(a.id);
      return `<div class="card" style="opacity:${ok ? 1 : 0.6};border-color:${ok ? 'var(--gold)' : 'var(--line)'}">
        <h5><span>${a.icon} ${a.cn}</span><em style="color:${ok ? 'var(--teal)' : 'var(--mute)'}">${ok ? '已解锁' : '未达成'}</em></h5>
        <p>${a.desc} · <b style="color:var(--gold)">${a.bonus}</b></p>
      </div>`;
    }).join('')}
    <br><button class="btn pri" data-a="closeModal">关闭</button>`;
  $('modal').classList.add('on');
}

export function live() {
  if (!G) return;
  if ($('hDay')) $('hDay').textContent = `D${G.day} · ${WD[wday(G.day)]}`;
  if ($('achCnt')) $('achCnt').textContent = String((G.achievements || []).length);
  if ($('codexCnt')) {
    const gc = LEGEND_GIRLS.filter((g) => G.codexGirls?.[g.id]).length;
    const wc = WHALES.filter((w) => G.codexWhales?.[w.id]?.unlocked).length;
    $('codexCnt').textContent = `${gc + wc}/${LEGEND_GIRLS.length + WHALES.length}`;
  }
  renderBarPills();
  updateMobileTabs();
  if ($('hMoney')) $('hMoney').textContent = fm(G.money);
  if ($('hMoneyChip')) $('hMoneyChip').classList.toggle('neg', G.money < 0);
  if ($('tdot')) $('tdot').style.left = clamp((G.t - T0) / (T_END - T0), 0, 1) * 100 + '%';
  document.querySelectorAll('#speed button').forEach((b) => b.classList.toggle('on', +b.dataset.s === G.speed));
  if ($('btnSkipOpen')) $('btnSkipOpen').style.display = G.t < T_OPEN && bars().length > 0 ? '' : 'none';

  const l = G.view != null ? G.lots[G.view] : null;
  if ($('zall')) $('zall').style.display = l ? 'block' : 'none';
  if ($('ttl')) $('ttl').textContent = l && l.name ? l.name : l && l.kind === 'empty' ? '空铺 · 招租' : 'Kota Indah 手绘夜街';

  if ($('hClock')) {
    const h = Math.floor(G.t / 60) % 24;
    const mi = Math.floor(G.t % 60);
    const open = G.lots.filter(lit).length;
    const street = G.peds.filter((p) => p.st === 'walk' || p.st === 'path').length;
    $('hClock').textContent = `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')} · 💡${open} · 🚶${street} · 🔥${buzz().toFixed(1)}×`;
  }

  renderSkillDock(l);
  renderLiveEvent();

  document.querySelectorAll('[data-live]').forEach((e) => {
    const k = e.dataset.live;
    let t = '';
    if (k === 'buzz') t = '× ' + buzz().toFixed(2);
    else if (k === 'rg') t = l ? l._g.length + '/' + cap(l) : '';
    else if (k[0] === 'b') {
      const b = G.lots[+k.slice(1)];
      t = b.kind === 'rival' ? `客${b._g.length}/${cap(b)}` : `${stars(b.rep)} · 客 ${b._g.length}/${cap(b)}`;
    } else if (k.startsWith('h:') && l && l.kind === 'mine') {
      const h = l.hostesses.find((x) => x.id === k.slice(2));
      t = h ? hStatus(h) : '';
    } else if (l && l.kind === 'mine') {
      t = k === 'rep'
        ? stars(l.rep)
        : k === 'guests'
          ? `${l._g.length}/${cap(l)}`
          : k === 'rooms'
            ? `${l.roomsUsed}/${ROOMS[l.rooms]}`
            : k === 'incTot'
              ? fmShort((l.today?.hfee || 0) + (l.today?.drink || 0))
              : k === 'inc'
                ? `${fm(l.today.hfee)} / ${fm(l.today.drink)}`
                : '';
    }
    if (e.textContent !== t) e.textContent = t;
  });

  if (l && l.kind === 'mine') {
    const cts = ['local', 'tai', 'cn'];
    document.querySelectorAll('[data-live-bar]').forEach((el) => {
      const idx = +el.dataset.liveBar.slice(4);
      if (cts[idx]) {
        const w = clamp(Math.round(enterProb(l, cts[idx]) * 100), 4, 100) + '%';
        if (el.style.width !== w) el.style.width = w;
      }
    });
  }
}

export function diagnoseDay(d) {
  if (!bars().length) return '先在「招租」选一间推荐铺位开张。';
  const tips = [];
  if (d.rf >= 2) tips.push(`包厢满流失 ${d.rf} 批，可升级包厢`);
  if (d.nh >= 2) tips.push(`公关紧缺流失 ${d.nh} 批，建议多签约`);
  if (d.tu >= 3) tips.push(`满座流失 ${d.tu} 批，可升级座位`);
  if (d.sto >= 2) tips.push(`被拉走 ${d.sto} 客，请保安防截胡`);
  if (d.nl >= 3) tips.push(`未合眼缘 ${d.nl} 位，调整招人偏好`);
  if (!tips.length) {
    if (d.net < 0 && G.spent === 0) tips.push('平日客少可用智能排班省底薪，或适当降酒价。');
    else tips.push('运营稳健！可解锁特色酒单与夜场技能冲高毛利。');
  }
  return tips.slice(0, 2).join(' · ');
}

export function showEndDayModal(d) {
  const rows = d.barSummaries
    .map((b) => `<div class="kv"><span>${esc(b.name)} · ${b.guests}客 · ${b.hours}钟</span><span>${fm(b.rev)}</span></div>`)
    .join('');
  const rank = G.lastRank
    ? `<div class="lbl">本周街道排行</div>` +
      G.lastRank.slice(0, 8).map((x, i) => `<div class="kv" style="${x.mine ? 'color:var(--coral);font-weight:700' : ''}"><span>${i + 1}. ${esc(x.name)}</span><span>${fm(x.v)}</span></div>`).join('')
    : '';
  const coach = diagnoseDay(d);
  $('sheet').innerHTML = `<h2>D${G.day} · ${WD[wday(G.day)]} · 结账</h2>
    ${rows || '<p class="hand" style="color:var(--mute)">今日未开店</p>'}<hr>
    <div class="kv"><span>公关钟点费</span><span>${fm(d.hf)}</span></div>
    <div class="kv"><span>酒水收入</span><span>${fm(d.dr)}</span></div>
    <div class="kv"><span>进货成本</span><span>${fm(-d.cogs)}</span></div>
    <div class="kv"><span>底薪 + 提成</span><span>${fm(-(d.hw + d.hc))}</span></div>
    <div class="kv"><span>团队日薪</span><span>${fm(-d.sw)}</span></div>
    <div class="kv"><span>铺面日租</span><span>${fm(-d.rent)}</span></div>
    ${d.fines ? `<div class="kv"><span>临检罚款</span><span>${fm(-d.fines)}</span></div>` : ''}
    ${d.fee ? `<div class="kv"><span>每周保护费</span><span>${fm(-d.fee)}</span></div>` : ''}
    ${G.spent ? `<div class="kv"><span>今日投资</span><span>${fm(-G.spent)}</span></div>` : ''}
    <hr><div class="kv tot"><span>今日净额</span><span style="color:${d.net < 0 ? 'var(--coral)' : 'var(--teal)'}">${fm(d.net)}</span></div>
    <div class="kv"><span>手头现金</span><span>${fm(G.money)}</span></div>
    ${renderHistoryChart()}
    <div class="coach-box"><b>📊 复盘建议</b>${coach}</div>
    ${d.got.map((g) => `<p class="hand" style="color:var(--teal)">🏆 ${g.t} (+${fmShort(g.r)})</p>`).join('')}
    ${rank}${d.extra.map((t) => `<p class="hand">${t}</p>`).join('')}<br>
    ${d.bust
      ? `<p class="hand" style="color:var(--coral)">欠债超限，房东收回钥匙。</p><button class="btn pri" data-a="restart">重新开始</button>`
      : `<button class="btn pri" data-a="next">D${G.day + 1} · ${WD[wday(G.day + 1)]} →</button>`}`;
  $('modal').classList.add('on');
}

export function showBriefModal(news) {
  const m = trafMul();
  const lvl = m < 0.75 ? ['淡', '#6E5F50'] : m < 1.1 ? ['平', '#1F6E5A'] : ['旺', '#B5362F'];
  const asks = bars().flatMap((l) => l.hostesses).filter((h) => h.raiseAsk);
  const cards = renderEventCards();
  const voices = G?.lastVoices || [];
  const nextWhale = WHALES.find((w) => !(G?.codexWhales?.[w.id]?.unlocked));
  $('sheet').innerHTML = `<h2>D${G.day} · ${WD[wday(G.day)]}</h2>
    <p class="hand">客流预期：<b style="color:${lvl[1]}">${lvl[0]}</b>（${m.toFixed(2)}×）</p>
    ${cards}
    ${wday(G.day) === 6 && bars().length ? `<p class="hand" style="color:var(--coral)">今晚需交保护费 ${fm(Math.round(bars().reduce((a, l) => a + FEE(l), 0) * whalePerkBonuses(G?.codexWhales).protectionMul))}</p>` : ''}
    ${voices.length ? `<div class="lbl">🗣️ 昨夜客群真实心声</div>` + voices.map((vo) => `<div class="voice-card">
      <div class="voice-head">${avatar({ male: true, skin: vo.skin, hair: vo.hair, shirt: vo.shirt }, 26)}<div><b>${esc(vo.who)}</b><small>${esc(vo.barName)}</small></div></div>
      <p>${esc(vo.text)}</p><span>💡 ${esc(vo.hint)}</span>
    </div>`).join('') : ''}
    ${nextWhale ? `<div class="whale-clue-box">🎩 <b>金主悬赏线索 · ${esc(nextWhale.title)} ${esc(nextWhale.name)}</b><small>${esc(nextWhale.clueCn)}</small></div>` : ''}
    ${news.length ? `<div class="lbl">昨夜动态</div>` + news.map((t) => `<p style="margin:3px 0;font-size:12.5px">${t}</p>`).join('') : ''}
    ${asks.length ? `<div class="lbl">加薪申请</div>` + asks.map((h) => `<div class="kv" style="align-items:center"><span>${avatar(h, 28)} ${esc(h.name)} · ${fm(h.wage)}→${fm(h.raiseAsk)}</span><span><button class="tog on" data-a="raiseY" data-v="${h.id}">同意</button> <button class="tog" data-a="raiseN" data-v="${h.id}">拒绝</button></span></div>`).join('') : ''}
    ${G.goal < GOALS.length ? `<p class="hand" style="margin-top:8px">🎯 ${GOALS[G.goal].t} (+${fmShort(GOALS[G.goal].r)})</p>` : ''}
    <br><button class="btn pri" data-a="start">开始营业</button>${bars().length ? `<button class="btn" data-a="schedule">先去排班</button>` : ''}`;
  $('modal').classList.add('on');
}
