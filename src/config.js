// Kota Indah Night Street — Core configuration, map geometry, and gameplay tables

export const Z_SCALE = 0.22;
export const WH = 18;
export const SWH = 9;

export const XA = -21;
export const XB = 56;
export const YA = -1;
export const YB = 37;
export const SX = 47.5;
export const GX = 51.5;

export const T0 = 14 * 60;
export const T_OPEN = 17 * 60;
export const T_RIVAL = 18 * 60;
export const T_LAST = 26.5 * 60;
export const T_END = 27 * 60;
export const T_NEXT_OPEN = (24 + 17) * 60;
export const MIN_SEC = 0.35;
export const COGS = 15;

export const HOURFEE = 400;
export const COMM = 0.45;
export const ROOMS = [5, 7, 9, 12];
export const MAXH = 30;

export function makePkg(paid, maxHours = 99) {
  const p = Math.max(1, Math.round(paid));
  const free = p - 1;
  const nomH = p + free;
  const h = Math.max(1, Math.min(nomH, maxHours));
  return {
    k: p === 1 ? 'h1' : `p${p}`,
    paid: p,
    free,
    nomH,
    h,
    fee: p * HOURFEE,
    cn: p === 1 ? '1 小时' : `买${p}送${free}`,
  };
}

export const PKG = {
  h1: makePkg(1),
  h3: makePkg(2),
};

export const SHIRTS = ['#C8574B', '#5B7FA6', '#5E9B80', '#E2B24A', '#8A6FA8', '#D98F6B', '#6E7F8A', '#F0E8D6', '#3F4A5A', '#A8B88A'];
export const HAIRS = ['#2b211b', '#3a2a20', '#1f1a18', '#5a3e2b'];
export const SKINS = ['#E0B08A', '#C99670', '#D7A47C', '#B98562'];
export const ACCENTS = ['#C8574B', '#5B7FA6', '#8A6FA8', '#3F8F7B'];
export const DRESS = ['#C8574B', '#D05A9C', '#8A6FA8', '#3F8F7B', '#E2B24A', '#B5362F', '#5B7FA6', '#2F261E'];

export const HNAMES = ['Sari', 'Dewi', 'Putri', 'Ayu', 'Rina', 'Wulan', 'Indah', 'Citra', 'Maya', 'Lina', 'Nita', 'Tika', 'Yuni', 'Mega', 'Fitri', 'Ratna', 'Dian', 'Sinta', 'Laras', 'Kirana', 'Nadia', 'Bella', 'Vivi', 'Cici', 'Tasya', 'Anggi', 'Mira', 'Lusi'];
export const MNAMES = ['Budi', 'Agus', 'Joko', 'Andi', 'Rudi', 'Hendra', 'Eko', 'Dedi', 'Wawan', 'Bayu', 'Yanto', 'Rizal', 'Fajar', 'Iwan'];
export const BNAMES = ['Rama', 'Bima', 'Bagus', 'Tono', 'Hadi', 'Surya', 'Dimas', 'Arif', 'Feri', 'Yoga'];
export const BARNAMES = ['Bintang Bar', 'Bulan Biru', 'Kopi & Bir', 'Lampu Merah', 'Angin Malam', 'Tiga Roda', 'Kucing Hitam', 'Rumah Bir', 'Pelangi', 'Sinar Bulan', 'Bar 88'];
export const NEWBARS = ['Bar Melati', 'Diamond KTV', 'Paradise Bar', 'Golden Star', 'Bar Anggrek', 'Bintang Lima'];

export const STN = ['东街', '西街', '北街', '南横街', '停车场北边的路', '大路'];
export const WD = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
export const WMUL = [0.6, 0.6, 0.65, 0.7, 1.2, 1.5, 0.9];
export const TIER = ['新人', '红牌', '头牌'];
export const TIERB = [0, 0.4, 0.9];
export const BODY = { slim: '苗条', curvy: '丰满' };
export const PERS = { intro: '内向', extro: '外向' };

export const UPG = {
  decor: { cn: '装修', desc: '客人更愿意进门，坐得更舒服，满意度更高', cost: [6000, 12000, 24000] },
  seats: { cn: '座位', desc: '加散桌，Lv.2 多一组沙发卡座，Lv.3 再加一排长沙发', cost: [4000, 8000, 14000] },
  rooms: { cn: '楼上包厢', desc: '包厢 5 → 7 → 9 → 12 间；满了客人就不能带公关上去跳舞，会直接走', cost: [6000, 12000, 20000] },
  sign: { cn: '霓虹招牌', desc: '路人更容易注意到；整条街人流也涨', cost: [3000, 7000, 12000] },
};

/* ---------- New Gameplay Depth Tables ---------- */

export const CONCEPTS = {
  bintang: {
    id: 'bintang',
    cn: '街坊欢唱吧',
    tag: '聚人气 · 爱喝啤酒',
    desc: '土著进店率 +25%，散桌点酒更快，进货成本降至 Rp 12k',
    accent: '#D99B38',
    cogs: 12,
    enterMul: { local: 1.25, tai: 0.95, cn: 0.95 },
    drinkSpeedMul: 1.2,
    roomPriceMul: 1.0,
    allInMul: 1.0,
    buzzMul: 1.0,
    vipMul: 1.0,
  },
  ktv: {
    id: 'ktv',
    cn: '商务 KTV 会所',
    tag: '重包厢 · 商务大客',
    desc: '台客进店率 +25%，包厢钟点费 +20%，VIP 团概率与小费 +30%',
    accent: '#9D5CD6',
    cogs: 15,
    enterMul: { local: 0.95, tai: 1.25, cn: 1.05 },
    drinkSpeedMul: 1.0,
    roomPriceMul: 1.2,
    allInMul: 1.0,
    buzzMul: 1.0,
    vipMul: 1.3,
  },
  club: {
    id: 'club',
    cn: '霓虹潮玩 Club',
    tag: '高单价 · 整晚买断',
    desc: '中客进店率 +30%，买断概率 +25%，霓虹招牌人气加成 +35%',
    accent: '#FF5C54',
    cogs: 15,
    enterMul: { local: 0.95, tai: 1.05, cn: 1.3 },
    drinkSpeedMul: 1.05,
    roomPriceMul: 1.05,
    allInMul: 1.25,
    buzzMul: 1.35,
    vipMul: 1.1,
  },
};

export const SPECIAL_MENU = {
  bucket: {
    id: 'bucket',
    cn: '冰镇啤酒桶',
    cost: 2000,
    profit: 45,
    desc: '土著点单 40% 概率升级啤酒桶，每桶额外净赚 Rp 45k',
  },
  platter: {
    id: 'platter',
    cn: '热带果盘小食',
    cost: 3500,
    profit: 60,
    desc: '等公关耐心 +35%、满意度 +0.4；入座客 50% 概率加点赚 Rp 60k',
  },
  whisky: {
    id: 'whisky',
    cn: '黑牌洋酒套餐',
    cost: 8000,
    profit: 280,
    desc: '包厢客 35% 概率开洋酒，额外净赚 Rp 280k，公关心情 +4',
  },
  champagne: {
    id: 'champagne',
    cn: '黄金香槟塔',
    cost: 15000,
    profit: 680,
    desc: '高满意度或买断客 25% 概率触发！净赚 Rp 680k + 口碑涨 + 3D 礼花',
  },
};

export const TRAITS = {
  drinker: { id: 'drinker', cn: '酒神', col: '#9E6214', desc: '陪酒时点酒频率 +30%' },
  singer: { id: 'singer', cn: '歌姬', col: '#6B4280', desc: '包厢转化 +30%，包厢满意度 +0.6' },
  sweet: { id: 'sweet', cn: '甜心', col: '#B5362F', desc: '回头客转化 +35%，加钟概率 +15%' },
  polyglot: { id: 'polyglot', cn: '多语通', col: '#1F6E5A', desc: '台客与中客选人好感 +1.4' },
  stamina: { id: 'stamina', cn: '耐力王', col: '#265385', desc: '体力消耗 -30%' },
  ace: { id: 'ace', cn: '镇店花', col: '#A82E26', desc: '上岗时本店进店率 +6%，稳住团队士气' },
  noble: { id: 'noble', cn: '高岭之花', col: '#5A4A8A', desc: '中客与台客好感 +1.2，酒水溢价容忍提升（忌与划拳王同店）' },
  rowdy: { id: 'rowdy', cn: '划拳王', col: '#B85D1E', desc: '散座点酒速度 +35%，土客进店率微增（忌与高岭之花同店）' },
  diva: { id: 'diva', cn: '话题C位', col: '#C4384B', desc: '独享聚光灯时人气涨速 ×1.5、进店 +5%（忌与名花或其他C位同店）' },
  gossip: { id: 'gossip', cn: '八面情报', col: '#2E6F7E', desc: '熟客转化 +25%（忌与甜心在小店扎堆内耗）' },
};
export const TRAIT_KEYS = Object.keys(TRAITS);

export const SKILLS = {
  happyHour: {
    id: 'happyHour',
    cn: '狂欢买一送一',
    short: '买一送一',
    cost: 400,
    dur: 60,
    cd: 180,
    icon: '🍻',
    desc: '持续 60 分钟：进店率 +35%，客人点酒速度 ×1.8',
  },
  showtime: {
    id: 'showtime',
    cn: '舞台热舞秀',
    short: '热舞秀',
    cost: 700,
    dur: 45,
    cd: 240,
    icon: '💃',
    desc: '持续 45 分钟：包厢意愿 +50%，上岗公关心情 +8，3D 聚光灯亮起',
  },
  lowProfile: {
    id: 'lowProfile',
    cn: '拉闸避风头',
    short: '避风头',
    cost: 0,
    dur: 45,
    cd: 180,
    icon: '🚨',
    desc: '持续 45 分钟：暂关外招散客，遇临检免清场且罚款直降 85%',
  },
};

export const ACHIEVEMENTS = [
  { id: 'first_bar', cn: '夜街新店主', desc: '在 Kota Indah 租下第一家店铺', bonus: '全店回头客小幅提升', icon: '🏪' },
  { id: 'first_star', cn: '头牌诞生', desc: '培养出第一位人气 ≥ 100 的头牌公关', bonus: '全街进店吸引力 +3%', icon: '👑' },
  { id: 'champagne_pop', cn: '香槟之夜', desc: '首次在店内开出黄金香槟塔', bonus: '口碑传播加快', icon: '🍾' },
  { id: 'rain_survivor', cn: '风雨无阻', desc: '在暴雨夜单日净利润依然为正', bonus: '雨天客流损失减轻 10%', icon: '🌧️' },
  { id: 'raid_dodge', cn: '暗度陈仓', desc: '利用「拉闸避风头」成功躲过警察临检', bonus: '临检罚款永久 -15%', icon: '🕶️' },
  { id: 'bouncer_save', cn: '铜墙铁壁', desc: '保安累计驱赶 10 次门口拉客行为', bonus: '保安薪资性价比提升', icon: '🛡️' },
  { id: 'vip_king', cn: '大客收割机', desc: '完美接待 3 次 VIP 老板包场团', bonus: 'VIP 小费 +15%', icon: '💎' },
  { id: 'regs_20', cn: '熟客满堂', desc: '同时拥有至少 20 拨回头客', bonus: '老客带新概率提升', icon: '🤝' },
  { id: 'rank_1', cn: '一条街的老大', desc: '在周日街道周排行夺得第 1 名', bonus: '声望荣耀徽章', icon: '🏆' },
  { id: 'buyout_1', cn: '吞并扩张', desc: '成功收购一家竞争对手酒吧', bonus: '收购谈价能力提升', icon: '🦈' },
  { id: 'three_bars', cn: '连锁大亨', desc: '同时经营 3 家及以上酒吧', bonus: '每日固定费用略降', icon: '🏙️' },
  { id: 'cash_100k', cn: '印尼盾大亨', desc: '手头现金突破 Rp 100,000k', bonus: '街区金融信誉', icon: '💰' },
  { id: 'event_master', cn: '八面玲珑', desc: '妥善处理 10 次店内实时突发事件', bonus: '突发事件奖励提升', icon: '🎭' },
  { id: 'week_3', cn: '长青招牌', desc: '经营到达第 21 天以上', bonus: '全店初始口碑护盘', icon: '🕯️' },
  { id: 'first_legend', cn: '名花入驻', desc: '招募首位 5 等传奇名花并收录进《雅加达女子图鉴》', bonus: '图鉴荣耀起点', icon: '🌸' },
  { id: 'first_whale', cn: '金主捧场', desc: '成功诱捕并满星解锁 1 位传奇金主', bonus: '街区大佬赏识', icon: '🎩' },
  { id: 'synergy_3', cn: '排兵布阵', desc: '单店同晚同时激活 3 个正向羁绊', bonus: '阵容搭配大师', icon: '🧩' },
];

export const LOTDEF = [
  { n: 'GRAND MTR', cn: 'Bar & Massage · 停车场北边', t: 'bar', sty: 'mtr', lay: 'mtr', f: 'xMax', r: [-19.5, 10, -13, 26] },
  { n: null, cn: '东街东侧 · 北端', t: 'empty', sty: 'oldgrey', f: 'yMax', r: [2.5, 0, 7.5, 7] },
  { n: 'ROYAL', cn: 'Bar · KTV', t: 'bar', sty: 'louver', lay: 'royal', f: 'yMax', r: [8.5, 0, 15, 7] },
  { n: 'GRAND LA', cn: 'Bar & Massage（Laras Ayu）', t: 'bar', sty: 'mosaic', lay: 'la', f: 'yMax', r: [16, 0, 23, 7] },
  { n: null, cn: '东街东侧 · 南段', t: 'empty', sty: 'oldgrey', f: 'yMax', r: [28, 0, 36, 7] },
  { n: 'NEW SARI AYU', cn: 'Bar Massage & KTV · 北门朝停车场，东门朝东街', t: 'bar', sty: 'fins', lay: 'sari', f: 'yMin', r: [0, 11, 13, 17.5], doors: [7], xd: [15.6], signU: 9 },
  { n: "S'MART", cn: '便利店 · 夹在 New Sari Ayu 两个门中间，门朝停车场', t: 'mart', sty: 'smart', f: 'xMin', r: [0, 11, 4.5, 14.4], doors: [0.8], part: 8 },
  { n: null, cn: '东街西侧 · 中段', t: 'empty', sty: 'cream', f: 'yMin', r: [24, 11, 31, 17.5] },
  { n: null, cn: '东街西侧 · 南段', t: 'empty', sty: 'oldgrey', f: 'yMin', r: [32, 11, 40, 17.5] },
  { n: 'MEGA AYU', cn: 'Massage, Bar & KTV', t: 'bar', sty: 'mega', lay: 'mega', f: 'yMax', r: [15, 18.5, 21.5, 25] },
  { n: null, cn: '西街东侧 · 中段', t: 'empty', sty: 'whitegreen', f: 'yMax', r: [23.5, 18.5, 31.5, 25] },
  { n: null, cn: '西街东侧 · 南段', t: 'empty', sty: 'oldgrey', f: 'yMax', r: [32.5, 18.5, 39.5, 25] },
  { n: 'SeCup Coffee', cn: '咖啡店 · 入口旁', t: 'food', sty: 'cream', f: 'yMax', r: [40.5, 21, 46.5, 25] },
  { n: 'V-FOUR', cn: 'Massage Bar & KTV · 进门就是，门朝南横街', t: 'bar', sty: 'dark', lay: 'vfour', f: 'xMax', r: [41, 11.5, 47.5, 20.5] },
  { n: null, cn: '西街西侧 · 北端', t: 'empty', sty: 'whitegreen', f: 'yMin', r: [1, 29, 8, 35.5] },
  { n: 'ROYAL VIP', cn: 'Bar · 旅馆', t: 'bar', sty: 'cream', lay: 'vip', f: 'yMin', r: [12.5, 29, 18.5, 36] },
  { n: null, cn: '西街西侧 · 中段', t: 'empty', sty: 'oldgrey', f: 'yMin', r: [21, 29, 28.5, 35.5] },
  { n: null, cn: '西街西侧 · 南段', t: 'empty', sty: 'cream', f: 'yMin', r: [31, 29, 38.5, 35.5] },
];

export const STY = {
  oldgrey: { up: '#BDB7AA', g: '#8E897E' },
  cream: { up: '#E3D6B8', g: '#A99F86' },
  whitegreen: { up: '#E6E3D8', g: '#4F9A78' },
  fins: { up: '#EFECE4', g: '#8E897E' },
  mosaic: { up: '#D9D4CC', g: '#8E897E' },
  louver: { up: '#B8322F', g: '#A9A9A5' },
  mtr: { up: '#2B2A33', g: '#1F1C24' },
  mega: { up: '#F2F0EA', g: '#C8322F' },
  smart: { up: '#BDB7AA', g: '#8E897E' },
  dark: { up: '#3A3540', g: '#1F1C24' },
};

export const TYPE = {
  food: { ac: '#C8574B', fl: '#DCD2BA', open: [480, 1380], visit: 0.07 },
  mart: { ac: '#2F6FB5', fl: '#E6E1D4', open: [0, 9999], visit: 0.06 },
  bar: { ac: '#B8322F', fl: '#B9A49C', open: [T_RIVAL, T_END], visit: 0.07 },
  empty: { ac: '#BDB3A0', fl: '#DCD3C0', open: [0, 0], visit: 0 },
};

export const BARPAL = {
  royal: { ac: '#B8322F', sofa: '#A8403A', price: 65, pull: 0.075 },
  la: { ac: '#C8574B', sofa: '#7A5A8C', price: 60, pull: 0.08 },
  sari: { ac: '#D9A441', sofa: '#C8574B', price: 55, pull: 0.08 },
  mega: { ac: '#C8322F', sofa: '#B5362F', price: 55, pull: 0.07 },
  mtr: { ac: '#3E5F96', sofa: '#4F5FA8', price: 60, pull: 0.08 },
  vfour: { ac: '#5A3F7A', sofa: '#5A3F7A', price: 50, pull: 0.09 },
  vip: { ac: '#B0457F', sofa: '#8A3F6E', price: 60, pull: 0.08 },
};

export const LAY = {
  vfour: {
    door: 5,
    els: [
      ['room', 0, 0.7, 2, 4.2], ['room', 0, 4.5, 1.9, 6], ['bar', 2.7, 0.8, 4.6, 1.5, 1],
      ['rt', 3.6, 2.4], ['rt', 4.7, 2.2], ['rt', 3.5, 3.4], ['rt', 4.7, 3.3],
      ['ws', 6.3, 1.9, 6.6, 2.6], ['ws', 6.3, 3, 6.6, 3.7],
      ['sofa', 5.4, 0.2, 9.8, 0.75], ['sofa', 8.1, 1.3, 9.1, 1.75],
      ['sofa', 9.2, 1.3, 9.8, 3.2], ['sofa', 8.1, 3.2, 9.1, 3.65], ['sofa', 6.1, 4.1, 9.8, 4.65],
    ],
  },
  la: {
    door: 2.3,
    els: [
      ['sofa', 0.2, 0.2, 1.3, 0.75], ['ws', 2.3, 0.1, 2.9, 1.4], ['ws', 3.9, 0.1, 4.5, 1.4],
      ['room', 6.8, 0, 9.9, 1.6], ['bar', 3, 2.2, 5.7, 4],
      ['sofa', 9, 1.9, 9.7, 2.6], ['sofa', 9, 2.9, 9.7, 3.6], ['sofa', 9, 3.9, 9.7, 4.5],
      ['room', 7.9, 4.9, 9.9, 6], ['tb', 0.3, 1.6, 0.9, 1.9], ['sofa', 0.4, 2.6, 1, 3.2], ['sofa', 0.5, 4.2, 1.2, 5.4],
    ],
  },
  royal: {
    door: 1.1,
    els: [
      ['sofa', 0.1, 0.1, 1.2, 0.65], ['bar', 2.3, 1.2, 5.9, 3.9],
      ['sofa', 0.1, 1.5, 0.7, 2.6], ['sofa', 0.1, 2.9, 0.7, 4], ['sofa', 0.1, 4.3, 0.7, 5.5],
      ['ws', 6.9, 0.5, 8.7, 1.1], ['ws', 6.9, 1.9, 8.7, 2.5], ['sofa', 7, 2.8, 8.9, 3.25],
      ['wall', 6.4, 3.6, 6.5, 6], ['sofa', 6.8, 3.8, 7.9, 4.25], ['sofa', 6.8, 4.6, 7.9, 5.05],
      ['sofa', 6.8, 5.3, 7.6, 5.75], ['sofa', 8.8, 3.6, 9.6, 4.1], ['sofa', 8.9, 4.5, 9.6, 4.95], ['sofa', 8.9, 5.2, 9.6, 5.7],
    ],
  },
  mega: {
    door: 1.5,
    els: [
      ['sofa', 0.3, 0.3, 1.1, 0.8], ['ws', 2.4, 0.1, 3.5, 1.2], ['ws', 4.3, 0.1, 5.3, 1.2],
      ['sofa', 7.3, 0.5, 9.7, 1.1], ['sofa', 7.7, 1.5, 9.4, 1.95], ['sofa', 0.1, 1.6, 0.9, 4.8],
      ['bar', 2.7, 1.8, 5.9, 4.4], ['sofa', 9.1, 2.7, 9.8, 5.7], ['sofa', 6.3, 5.1, 8.9, 5.7],
    ],
  },
  mtr: {
    door: 2.6,
    els: [
      ['sofa', 0.3, 0.3, 1.2, 0.8], ['ws', 2.5, 0.1, 3.5, 1.2], ['ws', 4.5, 0.1, 5.5, 1.2],
      ['sofa', 7, 0.4, 9.6, 1], ['sofa', 0.1, 1.5, 0.8, 4.6], ['bar', 3, 1.8, 6, 4.2],
      ['sofa', 9.1, 1.6, 9.8, 4.8], ['sofa', 6.2, 5.1, 8.8, 5.7], ['rt', 1.8, 5.1], ['rt', 4.6, 5.2],
    ],
  },
  vip: {
    door: 6.5,
    els: [
      ['sofa', 0.3, 0.3, 1.2, 0.8], ['ws', 2.5, 0.1, 3.5, 1.2], ['ws', 4.5, 0.1, 5.5, 1.2],
      ['sofa', 7, 0.4, 9.6, 1], ['sofa', 0.1, 1.5, 0.8, 4.6], ['bar', 3, 1.8, 6, 4.2],
      ['sofa', 9.1, 1.6, 9.8, 4.8], ['sofa', 1.5, 5.1, 4.5, 5.7], ['rt', 7.6, 2.6], ['rt', 7.7, 4.1],
    ],
  },
  sari: {
    abs: true,
    door: 7,
    els: [
      ['sofa', 1.6, 0.05, 4.6, 0.6], ['sofa', 1.4, 2.45, 4.2, 2.95], ['rt', 2.8, 1.5],
      ['bar', 6, 0.9, 9.6, 2.5], ['ws', 10.2, 0.1, 10.8, 1.5], ['ws', 5.1, 0.1, 5.6, 0.8],
      ['room', 11.6, 0, 13, 1.2], ['sofa', 11, 1.6, 12.85, 2.1], ['sofa', 12.3, 2.4, 12.9, 5.2],
      ['sofa', 8.6, 5.6, 11.6, 6.1], ['rt', 5.6, 4.6], ['rt', 10.2, 4],
    ],
  },
};

export function playerEls(l) {
  const e = [
    ['stairs', 0, 0, 0.9, 1.7],
    ['work', 1.3, 0, 3.4, 0.6],
    ['cbar', 1.3, 0.6, 3.4, 1.1],
    ['ws', 3.7, 0.35, 4.3, 1.95],
    ['sofa', 4.35, 2.7, 4.9, 4.3],
    ['rt', 1.3, 3],
    ['rt', 2.9, 3.2],
  ];
  if (l.seats >= 1) e.push(['rt', 1.5, 4.7]);
  if (l.seats >= 2) e.push(['sofa', 4.35, 4.6, 4.9, 5.6], ['rt', 3.1, 4.9]);
  if (l.seats >= 3) e.push(['sofa', 0.1, 2.1, 0.55, 5.4]);
  return e;
}

export const CT = {
  local: {
    cn: '土著',
    col: '#B98654',
    body: 'curvy',
    drink: 14,
    room: 0.18,
    out: 0.08,
    th: 3.7,
    grp: [1, 1, 1, 2],
    shirts: ['#8A5A3B', '#5E7F4A', '#B98654', '#7A4E3A', '#A8763E'],
    note: '喜欢丰满，钟点短，爱喝酒，几乎天天来',
  },
  tai: {
    cn: '台客',
    col: '#3F8F7B',
    body: 'slim',
    drink: 40,
    room: 0.45,
    out: 0.15,
    th: 4.1,
    grp: [2, 3, 3, 4],
    shirts: ['#8FB4DC', '#F0E8D6', '#A8B88A', '#E9C77A', '#6E7F8A'],
    note: '一群人来，喜欢苗条，钟点长，不太喝酒；满意会连来 3–4 天',
  },
  cn: {
    cn: '中客',
    col: '#C8322F',
    body: 'any',
    drink: 24,
    room: 0.33,
    out: 0.28,
    th: 4.3,
    grp: [1],
    shirts: ['#F3F3F0', '#2F261E', '#3F4A5A', '#E9E3D6'],
    note: '苗条丰满皆可，出手阔绰；满意会连来 7–8 天',
  },
};

export const GOALS = [
  { t: '开第一家酒吧', ok: (G, bars) => bars.length >= 1, r: 3000 },
  { t: '一家店签到 10 个公关', ok: (G, bars) => bars.some((l) => l.hostesses.length >= 10), r: 3000 },
  { t: '撑过第一周（第 7 天收摊后现金不为负）', ok: (G) => G.day >= 7 && G.t >= T_END - 1 && G.money >= 0, r: 5000 },
  { t: '攒到 5 拨回头客', ok: (G) => G.regs.length >= 5, r: 5000 },
  { t: '培养一个红牌（人气 40）', ok: (G, bars) => bars.some((l) => l.hostesses.some((h) => h.pop >= 40)), r: 6000 },
  { t: '开第二家店', ok: (G, bars) => bars.length >= 2, r: 8000 },
  { t: '周排名进前三', ok: (G) => Boolean(G.bestRank && G.bestRank <= 3), r: 8000 },
  { t: '培养一个头牌（人气 100）', ok: (G, bars) => bars.some((l) => l.hostesses.some((h) => h.pop >= 100)), r: 12000 },
  { t: '周排名第一', ok: (G) => G.bestRank === 1, r: 15000 },
  { t: '开到 3 家店', ok: (G, bars) => bars.length >= 3, r: 20000 },
];

export const POLES = [];
export const DECOR = [];
export const pickC = (i) => ['#D98F6B', '#F0E8D6', '#E2B24A', '#C8574B', '#5E9B80'][i % 5];

(function initStreetProps() {
  [4, 13, 22, 31, 40].forEach((x) => POLES.push({ x, y: 7.1, lx: x, ly: 8.5, s: 0 }));
  [7, 16, 25, 34, 43].forEach((x) => POLES.push({ x, y: 28.9, lx: x, ly: 27.5, s: 1 }));
  [13, 21].forEach((y) => POLES.push({ x: -0.1, y, lx: -1.5, ly: y, s: 2 }));
  [13, 21].forEach((y) => POLES.push({ x: -12.9, y, lx: -11.5, ly: y, s: 4 }));
  [14, 21].forEach((y) => POLES.push({ x: 51.35, y, lx: 50, ly: y, s: 3 }));
  const cc = (i) => ['#E9E3D6', '#3F4A5A', '#C8574B', '#6E7F8A', '#B5B0A6', '#2F261E'][i % 6];
  [2, 6.2, 19.5, 26, 33.5, 38, 44.5].forEach((x, i) => DECOR.push({ t: 'car', x, y: 8.25, c: cc(i) }));
  [3.5, 10.5, 22.2, 30, 36.5, 42].forEach((x, i) => DECOR.push({ t: 'car', x, y: 27.75, c: cc(i + 2) }));
  [20, 24].forEach((y, i) => DECOR.push({ t: 'car', x: -1.25, y, ax: 1, c: cc(i + 4) }));
  [14, 22.5].forEach((y, i) => DECOR.push({ t: 'car', x: -10.15, y, ax: 1, c: cc(i + 1) }));
  [
    [11.4, 8], [12, 8], [12.6, 8], [17.4, 25.9], [18, 25.9], [18.6, 25.9],
    [24.6, 8], [25.2, 8], [48.6, 12.2], [48.6, 12.8], [48.6, 19.6], [48.6, 20.2],
  ].forEach(([x, y], i) => DECOR.push({ t: 'bike', x, y, c: pickC(i) }));
  [[1, 7.15], [50.6, 10.85], [50.6, 25.2], [29, 28.8], [-0.6, 11.1]].forEach(([x, y]) => DECOR.push({ t: 'cone', x, y }));
  [[25.5, 3.5], [41.5, 3.5], [18.5, 14], [10, 33], [43.5, 33], [49.5, 3], [49.5, 33], [-16, 7.5], [-16, 28.5]].forEach(([x, y]) => DECOR.push({ t: 'tree', x, y }));
  DECOR.push({ t: 'cart', x: 52, y: 33.5 }, { t: 'fruit', x: 52, y: 4 });
})();

/* ---------- Pure Helpers ---------- */
export const R = () => Math.random();
export const rnd = (a, b) => a + R() * (b - a);
export const pick = (a) => a[(R() * a.length) | 0];
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const hsh = (n) => {
  const s = Math.sin(n * 127.1 + 3.7) * 43758.5453;
  return s - Math.floor(s);
};
export const uid = () => Math.random().toString(36).slice(2, 8);
export const fm = (n) => (n < 0 ? '-' : '') + 'Rp ' + Math.abs(Math.round(n)).toLocaleString('en-US') + 'k';
export const fmShort = (n) => {
  const s = n < 0 ? '-' : '';
  const a = Math.abs(n);
  return a >= 1000 ? `${s}${(a / 1000).toFixed(1).replace(/\.0$/, '')}M` : `${s}${Math.round(a)}k`;
};
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const wday = (d) => (d - 1) % 7;
export const tierOf = (h) => (h.pop >= 100 ? 2 : h.pop >= 40 ? 1 : 0);
export const FEE = (l) => 8000 + 1500 * l.rooms;

export const onDuty = (h) => h.on && !h.sick;
export const activeH = (l) => l.hostesses.filter(onDuty);
export const effAtt = (h) => clamp(h.att - (h.en < 20 ? 4 : h.en < 40 ? 2 : 0) + (h.mood >= 75 ? 1 : h.mood < 30 ? -1 : 0), 1, 10);
export const moodTx = (m) => (m >= 70 ? ['开心', '#1F6E5A'] : m >= 40 ? ['一般', '#6E5F50'] : ['不爽', '#B5362F']);
export const hWage = (h) => {
  const rMul = [1, 0.85, 1.0, 1.12, 1.28, 1.5][clamp(h.rarity || 2, 1, 5)];
  return Math.round(((110 + 26 * h.looks + 10 * h.ps + 12 * h.att) * rMul) / 10) * 10;
};

export const Lw = (l, u, v) =>
  l.f === 'yMax' ? [l.x0 + u, l.y0 + v]
    : l.f === 'yMin' ? [l.x0 + u, l.y1 - v]
      : l.f === 'xMax' ? [l.x0 + v, l.y1 - u]
        : [l.x1 - v, l.y1 - u];

export const LB = (l, u1, v1, u2, v2) =>
  l.f === 'yMax' ? [l.x0 + u1, l.y0 + v1, u2 - u1, v2 - v1]
    : l.f === 'yMin' ? [l.x0 + u1, l.y1 - v2, u2 - u1, v2 - v1]
      : l.f === 'xMax' ? [l.x0 + v1, l.y1 - u2, v2 - v1, u2 - u1]
        : [l.x1 - v2, l.y1 - u2, v2 - v1, u2 - u1];

export const outPt = (l, u) =>
  l.f === 'yMax' ? [l.x0 + u, l.y1 + 0.45]
    : l.f === 'yMin' ? [l.x0 + u, l.y0 - 0.45]
      : l.f === 'xMax' ? [l.x1 + 0.45, l.y1 - u]
        : [l.x0 - 0.45, l.y1 - u];

export const stOf = (o) => (o[0] < -6 ? 4 : o[0] < 0 ? 2 : o[0] > GX ? 5 : o[0] > SX ? 3 : o[1] < 20 ? 0 : 1);

export const scaleEls = (els, su, sv) =>
  els.map((e) => (e[0] === 'rt' ? [e[0], e[1] * su, e[2] * sv] : [e[0], e[1] * su, e[2] * sv, e[3] * su, e[4] * sv, e[5]]));

export const where = (l) => STN[l.st] + (l.st < 2 ? ' · ' + (l.x0 < 16 ? '北段' : l.x0 < 32 ? '中段' : '南段') : '');
