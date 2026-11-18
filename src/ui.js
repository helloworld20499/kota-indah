import {
  ACHIEVEMENTS, BODY, COGS, CONCEPTS, CT, FEE, GOALS, MAXH, PERS, ROOMS, SKILLS, SKINS, SPECIAL_MENU,
  T0, T_END, T_OPEN, TIER, TRAITS, UPG, WD, WMUL, activeH, clamp, esc, fm, fmShort, moodTx, onDuty, tierOf, wday, where,
} from './config.js';
import { G, bars, cap } from './state.js';
import { buyoutCost, rivalIntel } from './economy.js';
import { barOpen, buzz, enterProb, evList, fair, lit, trafMul, wagesOf } from './sim.js';

const $ = (id) => document.getElementById(id);
let AVN = 0;

export function toast(t) {
  const e = $('toast');
  if (!e) return;
  e.textContent = t;
  e.classList.add('on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => e.classList.remove('on'), 2400);
}

export function avatar(o, sz = 36) {
  const id = 'av' + AVN++;
  const sk = o.skin || '#D7A47C';
  const hr = o.hair || '#2b211b';
  const cl = o.dress || o.shirt || '#888';
  const t = o.pop != null ? tierOf(o) : 0;
  const ring = o.ring || (t === 2 ? '#9E6214' : t === 1 ? '#B5362F' : '#2F261E');
  const hs = o.hs != null ? o.hs : (parseInt(String(o.id || '0').slice(-3), 36) || 0) % 4;
  const crown = t === 2 ? `<path d="M16 7 L18 3.5 L21 6 L24 3.5 L26 7Z" fill="#E2B24A"/>` : '';
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
  return `<svg class="av" width="${sz}" height="${sz}" viewBox="0 0 42 42" aria-hidden="true"><defs><clipPath id="${id}"><circle cx="21" cy="21" r="19.5"/></clipPath></defs>
    <circle cx="21" cy="21" r="19.5" fill="#EFE6D4"/><g clip-path="url(#${id})">${back}<path d="M5 44 Q7 31.5 21 30.5 Q35 31.5 37 44Z" fill="${cl}"/>${extra}${face}${girl}${front}</g>
    <circle cx="21" cy="21" r="19.5" fill="none" stroke="${ring}" stroke-width="${t ? 2.2 : 1.3}"/></svg>`;
}

const pips = (n, max, cls = '') =>
  `<span class="pips ${cls}">${Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
const stars = (r) => '★ ' + r.toFixed(1);
const dot = (c) => `<i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:4px"></i>`;

export function priceHint(l) {
  const cogs = CONCEPTS[l.concept]?.cogs || COGS;
  const r = l.price / fair(l);
  return r < 0.8
    ? `酒很便宜，进店人数增加，但每瓶仅净赚 ${fm(l.price - cogs)}。`
    : r <= 1.15
      ? `酒价公道（每瓶净赚 ${fm(l.price - cogs)}）。`
      : r <= 1.5
        ? '酒价偏贵，路人进店意愿下降。'
        : '酒价太贵了，客人会明显减少点单与进店。';
}

function hStatus(h) {
  const left = h.until ? Math.max(0, Math.round(h.until - G.t)) : 0;
  return h.state === 'idle'
    ? h.en < 10 ? '乏力休整' : '待客'
    : h.state === 'with'
      ? '陪酒 · ' + (h.with && h.with.pkg.h === 99 ? '买断' : `${left}分`)
      : h.state === 'room'
        ? `包厢 · ${left}分`
        : h.state === 'out'
          ? `外出 · ${left}分`
          : '买断外出';
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
  const mt = moodTx(h.mood);
  const off = !cand && !onDuty(h);
  const on = h.on && !h.sick;
  const shielded = !cand && (h.loyalUntil || 0) >= G.day;
  const otherBars = !cand && curBar ? bars().filter((b) => b.i !== curBar.i) : [];

  return `<div class="card hc compact${off ? ' off' : ''}"><div class="hrow">${avatar(h, 34)}<div class="hmain">
    <h5><span>${esc(h.name)}${t ? `<span class="badge b${t}">${TIER[t]}</span>` : ''}${h.sick ? '<span class="badge boff">病假</span>' : ''}${shielded ? '<span class="shield-badge" title="7天防挖角">🛡️护盾</span>' : ''}${traitBadges(h)}</span>
      <em${cand || off ? '' : ` data-live="h:${h.id}"`}>${cand ? `底薪 ${fm(h.wage)}/晚` : off ? '休整中' : hStatus(h)}</em></h5>
    <div class="attr-line">${BODY[h.body]} ${h.bs} · 颜 ${h.looks} · ${PERS[h.pers]} ${h.ps} · 态 ${h.att} · 人气 ${h.pop}</div>
    ${cand
      ? `<div class="hb"><button class="btn pri mini" style="margin:0;padding:3px 10px" data-a="hireH" data-v="${cand}">签约聘用 · ${fm(h.wage)}/晚</button></div>`
      : `<div class="stat-mini">
          <span>体 ${Math.round(h.en)}%</span>
          <span class="ebar"><i style="width:${Math.round(h.en)}%;background:${h.en < 30 ? '#B5362F' : h.en < 60 ? '#9E6214' : '#1F6E5A'}"></i></span>
          <span style="color:${mt[1]}">心 ${Math.round(h.mood)} (${mt[0]})</span>
          <span>今 ${Math.round(h.todayH || 0)}钟</span>
          <span>${fmShort(h.wage)}</span>
        </div>
        <div class="hb">
          <button class="tog${on ? ' on' : ''}" data-a="tog" data-v="${h.id}">${on ? '上班中' : h.sick ? '病假' : '休息中'}</button>
          <button class="tog" data-a="hongbao" data-v="${h.id}" title="心情+28 · 体力+10 · 7天防挖角">🧧 500k</button>
          <button class="tog" data-a="trainH" data-v="${h.id}" ${curBar?.trainedToday ? 'disabled' : ''} title="每店每日1次：提升样貌/态度并领悟特质">✨ 特训</button>
          ${otherBars.length && h.state === 'idle' ? `<select class="xfer" data-xfer="${h.id}" aria-label="跨店调配"><option value="">调店…</option>${otherBars.map((b) => `<option value="${b.i}">→ ${esc(b.name)}</option>`).join('')}</select>` : ''}
          <button class="link" data-a="fireH" data-v="${h.id}">解约</button>
        </div>`
    }</div></div></div>`;
}

function sCard(o, role, actBtn) {
  const shirt = role === 's' ? '#5B7FA6' : role === 'b' ? '#242329' : '#6B4E3D';
  const roleLabel = role === 's' ? (o.kind === 'q' ? '质量星探' : '数量星探') : role === 'b' ? '看场保安' : '门口营销';
  return `<div class="s-row-card">
    <div class="s-row-left">${avatar(Object.assign(staffLook(o), { shirt }), 30)}
      <div class="s-row-info"><b>${esc(o.name)} · ${roleLabel}</b><small>能力 ${o.ab}/10 · 日薪 ${fm(o.wage)}</small></div>
    </div>
    ${actBtn}
  </div>`;
}

const seg = (k, cur, opts) =>
  `<div class="seg">${opts.map(([v, t]) => `<button class="${String(cur) === String(v) ? 'on' : ''}" data-a="req" data-v="${k}:${v}">${t}</button>`).join('')}</div>`;

function goalCard() {
  if (G.goal >= GOALS.length) return `<div class="goalc"><div><small>全部目标完成</small><b>你已经是这条街的老大了</b></div><span>🏆 传奇</span></div>`;
  const g = GOALS[G.goal];
  return `<div class="goalc"><div><small>目标 ${G.goal + 1} / ${GOALS.length}</small><b>${g.t}</b></div><span>+${fm(g.r)}</span></div>`;
}

const weekStrip = () =>
  `<div class="wk">${WD.map((w, i) => `<div class="${i === wday(G.day) ? 'cur' : ''}"><span class="wk-track"><i style="height:${Math.max(4, Math.round(WMUL[i] * 14))}px"></i></span><span>${w.slice(1)}</span><span class="wk-mul">${WMUL[i].toFixed(1)}×</span></div>`).join('')}</div>`;

export function renderHistoryChart() {
  const hist = (G?.history || []).slice(-7);
  if (!hist.length) return '';
  const maxAbs = Math.max(1000, ...hist.map((x) => Math.abs(x.opProfit ?? x.net ?? 0)));
  return `<div class="hist-chart">${hist
    .map((x) => {
      const val = x.opProfit ?? x.net ?? 0;
      const pct = Math.max(10, Math.round((Math.abs(val) / maxAbs) * 100));
      return `<div class="hist-col" title="第${x.day}天 营业利润 ${fm(val)}"><span class="hist-val">${fmShort(val)}</span><div class="hist-bar${val < 0 ? ' neg' : ''}" style="height:${Math.round(pct * 0.56)}%"></div><small>${x.wd.slice(1)}</small></div>`;
    })
    .join('')}</div>`;
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
        <button class="btn-back" data-a="back">← 全景</button>
        <input class="nm" id="nm" value="${esc(l.name)}" maxlength="16" aria-label="店名">
        <span class="concept-chip">${cLabel}</span>
      </div>
      <div class="kpi-5">
        <div><small>口碑</small><b data-live="rep">${stars(l.rep)}</b></div>
        <div><small>在店客</small><b data-live="guests">${l._g.length}/${cap(l)}</b></div>
        <div><small>包厢</small><b data-live="rooms">${l.roomsUsed}/${ROOMS[l.rooms]}</b></div>
        <div><small>上岗</small><b>${act.length}/${l.hostesses.length}</b></div>
        <div><small>今晚营收</small><b data-live="incTot">${fmShort(totToday)}</b></div>
      </div>
      <div class="subtabs">${[
        ['run', '🎛️ 运营'],
        ['upg', '🛠️ 升级'],
        ['girls', `💃 公关(${l.hostesses.length})`],
        ['scout', `🔍 星探(${l.scouts.length})`],
        ['mkt', `🛡️ 团队(${(l.bouncers || []).length + l.mkts.length})`],
      ].map(([k, t]) => `<button class="${tab === k ? 'on' : ''}" data-a="tab" data-v="${k}">${t}</button>`).join('')}</div>
    </div><div class="deck-body">`;

    if (tab === 'run') {
      const curConcept = CONCEPTS[l.concept || 'bintang'];
      h += `<div class="lbl"><span>酒吧主题定位</span><span class="num">${barOpen() || l.today?.guests > 0 ? '切换 Rp 1,500k' : '开店免费'}</span></div>
        <div class="grid-3">${Object.values(CONCEPTS)
          .map((c) => `<button class="concept-btn${l.concept === c.id ? ' on' : ''}" data-a="concept" data-v="${c.id}" title="${c.desc}"><b>${c.cn}</b><small>${c.tag}</small></button>`)
          .join('')}</div>
        <div class="card">
          <div class="price-row">
            <div class="price"><span id="pv">${fm(l.price)}</span> <small>/ 瓶 · 进价 ${curConcept.cogs}k · 净 +${l.price - curConcept.cogs}k</small></div>
            <span class="num" style="font-size:11px;color:var(--ink-2)" data-live="prob">${['local', 'tai', 'cn'].map((c) => Math.round(enterProb(l, c) * 100) + '%').join('/')}</span>
          </div>
          <input type="range" id="pr" min="20" max="120" step="5" value="${l.price}" aria-label="酒价">
          <div class="kv"><span id="ph" style="font-size:11.5px;color:var(--mute)">${priceHint(l)}</span><span style="font-size:11px;color:var(--mute)">土/台/中进店</span></div>
        </div>
        <div class="grid-2">
          <button class="btn" data-a="dj" ${l.dj ? 'disabled' : ''}>${l.dj ? '🎧 DJ 已就位' : `🎧 请 DJ · ${fm(600)}`}</button>
          <button class="btn" data-a="flyers" ${G.flyers ? 'disabled' : ''}>${G.flyers ? '📣 传单已派发' : `📣 发传单 · ${fm(300)}`}</button>
        </div>
        <div class="grid-2">
          <div class="card"><h5>铺面日租<em>${fm(l.rent)}</em></h5><p>周日保护费 ${fm(FEE(l))}</p></div>
          <div class="card"><h5>员工日薪<em>${fm(wagesOf(l).s)}</em></h5><p>今晚 <span data-live="inc" class="num">${fm(l.today.hfee)} / ${fm(l.today.drink)}</span></p></div>
        </div>
        <div class="card"><h5>熟客回头 (${regs.length} 拨)<em>${curConcept.cn}</em></h5>
          ${regs.length
            ? regs.slice(0, 4).map((r) => {
                const fav = l.hostesses.find((x) => x.id === r.hid);
                return `<div class="kv"><span>${dot(CT[r.type].col)}${CT[r.type].cn}${r.n > 1 ? ` ${r.n}人` : ''}${fav ? ` · ${esc(fav.name)}` : ''}</span><span>${r.daily ? '常来' : `剩${r.days}天`}</span></div>`;
              }).join('')
            : `<p>客人满意即可转化为回头客。目前 ${curConcept.desc}</p>`}
        </div>`;
    } else if (tab === 'upg') {
      h += `<div class="lbl"><span>硬装升级</span><span>满级 Lv.3</span></div>
        <div class="grid-2">${Object.keys(UPG).map((k) => {
          const u = UPG[k];
          const lv = l[k];
          return `<div class="card">
            <h5><span>${u.cn}</span><em>Lv.${lv}/3</em></h5>
            <div style="margin-top:2px">${pips(lv, 3)} <span class="num" style="font-size:11px;color:var(--gold);margin-left:4px">${lv >= 3 ? '已满级' : fm(u.cost[lv])}</span></div>
            <p>${u.desc}</p>
            ${lv < 3 ? `<button class="btn pri mini" data-a="up" data-v="${k}">升级至 Lv.${lv + 1}</button>` : ''}
          </div>`;
        }).join('')}</div>
        <div class="lbl"><span>特色酒单（高毛利副销）</span><span>${Object.values(SPECIAL_MENU).filter((m) => l.menu?.[m.id]).length}/4</span></div>
        <div class="grid-2">${Object.values(SPECIAL_MENU).map((m) => {
          const owned = !!(l.menu && l.menu[m.id]);
          return `<div class="card">
            <h5><span>${m.cn}</span><em>${owned ? '已上架' : fm(m.cost)}</em></h5>
            <p>+${m.profit}k/单 · ${m.desc}</p>
            ${owned ? '' : `<button class="btn mini" data-a="buyMenu" data-v="${m.id}">解锁上架</button>`}
          </div>`;
        }).join('')}</div>`;
    } else if (tab === 'girls') {
      if (!l.hostesses.length && l.cands.length && G._girlSubAuto !== l.i) {
        G.girlSub = 'cands';
        G._girlSubAuto = l.i;
      }
      const gSub = G.girlSub || 'roster';
      const avg = act.length ? Math.round(act.reduce((a, x) => a + x.en, 0) / act.length) : 0;
      const base = act.reduce((a, x) => a + x.wage, 0);
      const m = trafMul();

      h += `<div class="subtabs compact">
          <button class="${gSub === 'roster' ? 'on' : ''}" data-a="girlSub" data-v="roster">在岗团队 (${l.hostesses.length}/${MAXH})</button>
          <button class="${gSub === 'cands' ? 'on' : ''}" data-a="girlSub" data-v="cands">今日应聘 (${l.cands.length})</button>
        </div>
        <div class="card" style="padding:6px 8px">
          <h5><span>今晚上班 ${act.length}/${l.hostesses.length} · 均体 ${avg}%</span><em>底薪 ${fm(base)}</em></h5>
          <div class="hb" style="margin-top:4px">
            <span class="num" style="font-size:11px;color:var(--mute)">客流 ×${m.toFixed(2)}</span>
            <button class="tog on" data-a="preset" data-v="smart">智能排班</button>
            <button class="tog" data-a="preset" data-v="rush">全员冲刺</button>
            <button class="tog" data-a="preset" data-v="rest">疲劳轮休</button>
          </div>
        </div>`;

      if (gSub === 'roster') {
        if (!l.hostesses.length) h += `<p class="hand">还没有公关，请切换到「今日应聘」签下首批公关！</p>`;
        l.hostesses.slice().sort((a, b) => onDuty(b) - onDuty(a) || b.pop - a.pop).forEach((x) => { h += hCard(x, null, l); });
      } else {
        if (!l.cands.length) h += `<p class="hand">今日暂无应聘者。可聘请星探或去「同行」页面挖角！</p>`;
        l.cands.forEach((c, i) => { h += hCard(c, String(i), l); });
      }
    } else if (tab === 'scout') {
      h += `<div class="lbl"><span>找人标准（次日应聘生效）</span><span>带稀有特质</span></div>
        <div class="grid-2">
          <div><small style="font-size:10.5px;color:var(--mute)">身材</small>${seg('body', l.req.body, [['any', '不限'], ['slim', '苗条'], ['curvy', '丰满']])}</div>
          <div><small style="font-size:10.5px;color:var(--mute)">性格</small>${seg('pers', l.req.pers, [['any', '不限'], ['intro', '内向'], ['extro', '外向']])}</div>
          <div><small style="font-size:10.5px;color:var(--mute)">样貌</small>${seg('looks', l.req.looks, [[0, '不限'], [5, '≥5分'], [7, '≥7分']])}</div>
          <div><small style="font-size:10.5px;color:var(--mute)">态度</small>${seg('att', l.req.att, [[0, '不限'], [6, '≥6分']])}</div>
        </div>
        <div class="lbl"><span>在职星探</span><span>${l.scouts.length}/2</span></div>`;
      if (!l.scouts.length) h += `<p class="hand">无星探时每日仅 2-3 人自荐，能力高更容易找到带特质人才。</p>`;
      l.scouts.forEach((o) => {
        h += sCard(o, 's', `<button class="tog s-row-act" data-a="fireS" data-v="${o.id}">解雇</button>`);
      });
      h += `<div class="lbl"><span>今日可聘星探</span><span>${G.mk.scouts.length} 人</span></div>`;
      G.mk.scouts.forEach((o, i) => {
        h += sCard(o, 's', `<button class="btn pri s-row-act" style="width:auto" data-a="hireS" data-v="${i}">聘用</button>`);
      });
    } else {
      const bnc = l.bouncers || [];
      const shieldPct = bnc.length >= 2 ? 90 : bnc.length === 1 ? 55 : 0;
      h += `<div class="lbl"><span>看场保安 · 防截胡 ${shieldPct}%</span><span>${bnc.length}/2</span></div>`;
      if (!bnc.length) h += `<p class="hand">保安可驱赶门口拉客仔，并提前 25 分钟预警警察临检。</p>`;
      bnc.forEach((o) => {
        h += sCard(o, 'b', `<button class="tog s-row-act" data-a="fireB" data-v="${o.id}">解雇</button>`);
      });
      (G.mk.bouncers || []).forEach((o, i) => {
        h += sCard(o, 'b', `<button class="btn s-row-act" style="width:auto" data-a="hireB" data-v="${i}">雇看场</button>`);
      });

      h += `<div class="lbl"><span>门口营销 · 拉客与熟客转化</span><span>${l.mkts.length}/3</span></div>`;
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
    const ev = evList();

    h += `<div class="deck-head">
      ${goalCard()}
      ${weekStrip()}
      ${ev.length ? `<div class="ev-strip">${ev.map(([t, d, c]) => `<span class="ev-tag" style="background:${c}" title="${d}">${t}：${d}</span>`).join('')}</div>` : ''}`;

    if (v) {
      if (v.kind === 'empty') {
        const starter = bs.length === 0 && v.cost <= 16000;
        h += `<div class="sel-card">
          <div class="sel-head"><b>空铺 · ${where(v)}${starter ? ' <span class="starter-badge">🔥 推荐新手</span>' : ''}</b><button class="btn-x" data-a="back">收起</button></div>
          <div class="grid-2">
            <div class="kv"><span>面积</span><span>${v.L.toFixed(1)}×${v.D.toFixed(1)}</span></div>
            <div class="kv"><span>人流</span><span>×${v.loc.toFixed(2)}</span></div>
            <div class="kv"><span>押金装修</span><span>${fm(v.cost)}</span></div>
            <div class="kv"><span>日租</span><span>${fm(v.rent)}</span></div>
          </div>
          <button class="btn pri mini" style="margin-top:6px" data-a="rent" data-v="${v.i}">租下来开酒吧 · ${fm(v.cost)}</button>
        </div>`;
      } else if (v.kind === 'rival') {
        const intel = rivalIntel(v);
        const bCost = buyoutCost(v);
        const canBuy = !!(G.bestRank && G.bestRank <= 3);
        h += `<div class="sel-card">
          <div class="sel-head"><b>${esc(v.name)} · 对手情报</b><button class="btn-x" data-a="back">收起</button></div>
          <div class="grid-2">
            <div class="kv"><span>风格</span><span>${G.rival[v.i]?.mode === 'agg' ? '激进截胡' : '自然客流'}</span></div>
            <div class="kv"><span>在岗公关</span><span>${v.hn} 人 · 颜${intel.quality}</span></div>
            <div class="kv"><span>酒价</span><span>${fm(intel.avgPrice)}</span></div>
            <div class="kv"><span>在店/周流</span><span><em data-live="rg" style="font-style:normal">${v._g.length}/${cap(v)}</em> · ${fmShort(intel.wkRev)}</span></div>
          </div>
          <div class="grid-2" style="margin-top:6px">
            <button class="btn mini" style="margin:0" data-a="poach" data-v="${v.i}" ${G.poachedToday || !bs.length ? 'disabled' : ''}>${G.poachedToday ? '今日已挖角' : `🕵️ 挖角 ${fm(2500)}`}</button>
            <button class="btn pri mini" style="margin:0" data-a="buyout" data-v="${v.i}" ${canBuy ? '' : 'disabled'}>${canBuy ? `🦈 收购 ${fmShort(bCost)}` : `🔒 前3解锁收购`}</button>
          </div>
        </div>`;
      } else {
        h += `<div class="sel-card">
          <div class="sel-head"><b>${esc(v.name)} · ${lit(v) ? '营业中' : '打烊'}</b><button class="btn-x" data-a="back">收起</button></div>
          <p style="margin:0;font-size:11.5px;color:var(--mute)">${v.cn}</p>
        </div>`;
      }
    }

    h += `<div class="subtabs">
        <button class="${stTab === 'mine' ? 'on' : ''}" data-a="streetTab" data-v="mine">🏪 我的店 (${bs.length})</button>
        <button class="${stTab === 'empty' ? 'on' : ''}" data-a="streetTab" data-v="empty">🔑 招租 (${empties.length})</button>
        <button class="${stTab === 'rival' ? 'on' : ''}" data-a="streetTab" data-v="rival">🥂 同行 (${rivals.length})</button>
      </div>
    </div><div class="deck-body">`;

    if (stTab === 'mine') {
      if (!bs.length) {
        h += `<div class="card"><h5>还没有开张的门店</h5><p>切换到「🔑 招租」选一间标有「🔥推荐」的铺面（约 Rp 11k–15k），留足现金签下首批公关即可开业！</p></div>`;
      }
      bs.forEach((l) => {
        const rev = (l.today?.hfee || 0) + (l.today?.drink || 0);
        h += `<div class="card">
          <h5><span>${esc(l.name)} <small style="color:var(--gold);font-weight:600">${CONCEPTS[l.concept || 'bintang'].cn}</small></span><em data-live="b${l.i}">${stars(l.rep)} · 客 ${l._g.length}/${cap(l)}</em></h5>
          <p>${where(l)} · 上班 ${activeH(l).length}/${l.hostesses.length} · 保安 ${(l.bouncers || []).length}/2 · 营收 ${fm(rev)}</p>
          <button class="btn pri mini" data-a="enter" data-v="${l.i}">进入店内管理 →</button>
        </div>`;
      });
      if (G.history && G.history.length > 0) {
        h += `<div class="lbl"><span>近 7 日营业利润</span><span>${G.history.length} 天</span></div>${renderHistoryChart()}`;
      }
      h += `<div class="card" style="padding:6px 9px"><p style="margin:0">左键拖拽平移 · 滚轮缩放 · 右键 360° 旋转 · 点击地图建筑直接进店</p></div>`;
      h += `<div style="display:flex;justify-content:flex-end;margin-top:2px">${G._ask ? `<button class="link" data-a="restart" style="color:var(--coral)">确认清空存档重来</button>` : `<button class="link" data-a="ask-restart">清空存档重来</button>`}</div>`;
    } else if (stTab === 'empty') {
      h += `<div class="grid-2">${empties.map((l) => {
        const starter = bs.length === 0 && l.cost <= 16000;
        const isSel = v && v.i === l.i;
        return `<button class="lot-card${isSel ? ' sel' : ''}" data-a="enter" data-v="${l.i}">
          <div class="lot-card-top"><span>${where(l)}</span>${starter ? '<span class="starter-badge">🔥推荐</span>' : `<span class="num" style="font-size:10px;color:var(--mute)">×${l.loc.toFixed(2)}</span>`}</div>
          <div class="lot-card-nums"><span>押 ${fmShort(l.cost)}</span><span>租 ${fm(l.rent).replace('Rp ', '')}/天</span></div>
        </button>`;
      }).join('')}</div>`;
    } else {
      h += rivals.map((l) => {
        const r = G.rival[l.i] || { mode: 'con', hn: l.hn || 4, wk: 0 };
        const isSel = v && v.i === l.i;
        return `<button class="rival-row${isSel ? ' sel' : ''}" data-a="enter" data-v="${l.i}">
          <span><b>${esc(l.name)}</b><small>${r.mode === 'agg' ? '激进' : '保守'}</small></span>
          <span class="rival-nums">公关 ${l.hn} · <em data-live="b${l.i}" style="font-style:normal">客 ${l._g.length}/${cap(l)}</em> · 周 ${fmShort(r.wk || 0)}</span>
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
      const sub = active ? `生效 ${rem}m` : cd ? `冷却 ${rem}m` : s.cost ? fm(s.cost) : '免费';
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
  card.innerHTML = `<h4><span>${ev.icon} ${esc(ev.title)}</span><small style="color:var(--mute);font-weight:500">${esc(ev.barName)}</small></h4>
    <p>${esc(ev.desc)}</p>
    <div class="le-bar"><i style="width:${pct.toFixed(1)}%"></i></div>
    <button class="le-opt pri" data-ev="A"><b>A. ${ev.optA.label}</b><small>${ev.optA.hint}</small></button>
    <button class="le-opt" data-ev="B"><b>B. ${ev.optB.label}</b><small>${ev.optB.hint}</small></button>`;
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

export function showAchievementsModal() {
  const got = G?.achievements || [];
  $('sheet').innerHTML = `<h2>夜街传奇成就（${got.length}/${ACHIEVEMENTS.length}）</h2>
    <p class="hand">解锁成就可获得永久街头经营增益。</p>
    ${ACHIEVEMENTS.map((a) => {
      const ok = got.includes(a.id);
      return `<div class="card" style="opacity:${ok ? 1 : 0.6};border-color:${ok ? 'var(--gold)' : 'var(--line)'}">
        <h5><span>${a.icon} ${a.cn}</span><em style="color:${ok ? 'var(--teal)' : 'var(--mute)'}">${ok ? '已解锁' : '未达成'}</em></h5>
        <p>${a.desc}</p>
        <p style="color:var(--gold);font-size:11.5px;margin-top:3px">增益：${a.bonus}</p>
      </div>`;
    }).join('')}
    <br><button class="btn pri" data-a="closeModal">关闭</button>`;
  $('modal').classList.add('on');
}

export function live() {
  if (!G) return;
  if ($('hDay')) $('hDay').textContent = `第 ${G.day} 天 · ${WD[wday(G.day)]}`;
  if ($('achCnt')) $('achCnt').textContent = String((G.achievements || []).length);
  renderBarPills();
  updateMobileTabs();
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
  if ($('ttl')) $('ttl').textContent = l && l.name ? l.name : l && l.kind === 'empty' ? '空铺 · 招租' : 'Kota Indah 手绘夜街';
  if ($('subttl')) $('subttl').textContent = l ? (l.kind === 'mine' ? `${CONCEPTS[l.concept || 'bintang'].cn} · ${barOpen() ? '营业中' : '还没开门，5 点开'}` : l.cn) : 'U 形夜街沙盘 · 西口进，北绕停车场，东口出';

  if ($('hClock')) {
    const h = Math.floor(G.t / 60) % 24;
    const mi = Math.floor(G.t % 60);
    const part = G.t < 17 * 60 ? '下午' : G.t < 19 * 60 ? '傍晚' : G.t < 24 * 60 ? '晚上' : '凌晨';
    const open = G.lots.filter(lit).length;
    const street = G.peds.filter((p) => p.st === 'walk' || p.st === 'path').length;
    $('hClock').textContent = `${part} ${h % 12 || 12}:${String(mi).padStart(2, '0')} · ${open} 家亮灯 · 街上 ${street} 人 · 人气 ×${buzz().toFixed(2)}`;
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
      t = b.kind === 'rival' ? `客 ${b._g.length}/${cap(b)}` : `${stars(b.rep)} · 客 ${b._g.length}/${cap(b)}`;
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
                : k === 'prob'
                  ? ['local', 'tai', 'cn'].map((c) => Math.round(enterProb(l, c) * 100) + '%').join('/')
                  : '';
    }
    if (e.textContent !== t) e.textContent = t;
  });
}

export function diagnoseDay(d) {
  if (!bars().length) return '还没有自己的门店，在右侧「🔑 招租」中挑一间「推荐」铺面开张吧！';
  const tips = [];
  if (d.rf >= 2) tips.push(`今晚有 ${d.rf} 批客人因包厢满走掉，建议尽快在「升级」页提升「楼上包厢」！`);
  if (d.nh >= 2) tips.push(`有 ${d.nh} 批客人等不到公关流失，建议多签约公关或使用「疲劳轮休」。`);
  if (d.tu >= 3) tips.push(`门口满座挡掉 ${d.tu} 批客人，可以升级「座位」增加沙发卡座与散桌！`);
  if (d.sto >= 2) tips.push(`今晚被对手拉客仔截胡 ${d.sto} 位客人，请 1–2 名保安看场可防住 90% 截胡！`);
  if (d.nl >= 3) tips.push(`有 ${d.nl} 位客人没合眼缘，调整星探找人要求或特训提升样貌/态度。`);
  if (!tips.length) {
    if (d.net < 0 && G.spent === 0) tips.push('今晚营业出现亏损，平日淡季可只派一半公关上班省下底薪，或调低酒价吸引进店。');
    else tips.push('今晚运营整体稳健！解锁特色酒单与善用「买一送一 / 热舞秀」技能可再放大单晚毛利。');
  }
  return tips.slice(0, 2).join(' ');
}

export function showEndDayModal(d) {
  const rows = d.barSummaries
    .map((b) => `<div class="kv"><span>${esc(b.name)} · ${b.guests} 人（土 ${b.by.local}/台 ${b.by.tai}/中 ${b.by.cn}）· ${b.hours} 钟</span><span>${fm(b.rev)}</span></div>`)
    .join('');
  const rank = G.lastRank
    ? `<div class="lbl">本周街道排行</div>` +
      G.lastRank.slice(0, 8).map((x, i) => `<div class="kv" style="${x.mine ? 'color:var(--coral);font-weight:700' : ''}"><span>${i + 1}. ${esc(x.name)}</span><span>${fm(x.v)}</span></div>`).join('')
    : '';
  const coach = diagnoseDay(d);
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
    ${renderHistoryChart()}
    <div class="coach-box"><b>📊 经营复盘教练</b>${coach}</div>
    ${d.got.map((g) => `<p class="hand" style="color:var(--teal)">目标完成：${g.t}（+${fm(g.r)}）</p>`).join('')}
    ${bars().length ? `<p class="hand" style="color:var(--mute);margin-top:8px">新回头客 ${d.nr} · 保安赶走 ${d.bnc || 0} · 没人陪 ${d.nh} · 包厢满 ${d.rf} · 满座 ${d.tu} · 被拉走 ${d.sto}</p>` : ''}
    ${rank}${d.extra.map((t) => `<p class="hand">${t}</p>`).join('')}<br>
    ${d.bust
      ? `<p class="hand" style="color:var(--coral)">欠债超过 Rp 5,000k，房东把钥匙收走了。</p><button class="btn pri" data-a="restart">重新开始</button>`
      : `<button class="btn pri" data-a="next">第 ${G.day + 1} 天（${WD[wday(G.day + 1)]}）→</button>`}`;
  $('modal').classList.add('on');
}

export function showBriefModal(news) {
  const m = trafMul();
  const lvl = m < 0.75 ? ['淡', '#6E5F50'] : m < 1.1 ? ['平', '#1F6E5A'] : ['旺', '#B5362F'];
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
