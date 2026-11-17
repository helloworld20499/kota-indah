// Dual Art Style & Lighting Configuration (Version A: Diorama | Version B: Storybook)

export const ART_STYLES = {
  diorama: {
    id: 'diorama',
    label: '玩具沙盘',
    sub: '立体微缩积木风',
    dayBg: '#C8AF93',
    duskBg: '#8A768C',
    nightBg: '#36426B',
    slabTop: '#7FA84B',
    slabEdge: '#567832',
    earthRim: '#4E3629',
    blockPad: '#E99B4E',
    sidewalk: '#D9CDBE',
    road: '#4B4E58',
    parking: '#444852',
    wallColor: '#EFE4CE',
    floorMine: ['#E8D6B8', '#DEB98A', '#CE9E6E', '#B37E54'],
    floorEmpty: '#D6CCBA',
    floorRival: '#DFC7BF',
    roofColors: ['#345B96', '#D97C3A', '#3B7D5D', '#C94B43', '#7A549E'],
    inkEdges: false,
    treeMode: 'polyPear',
    actorMode: 'clay3d',
  },
  storybook: {
    id: 'storybook',
    label: '手绘绘本',
    sub: '钢笔淡彩半剖风',
    dayBg: '#FAF5E8',
    duskBg: '#EBDCCB',
    nightBg: '#3E4B72',
    slabTop: '#EAE3D0',
    slabEdge: '#CFC4AD',
    earthRim: '#A88E68',
    blockPad: '#E6DEC8',
    sidewalk: '#E5DEC9',
    road: '#ABA9A1',
    parking: '#9C9990',
    wallColor: '#F3EEE1',
    floorMine: ['#E8DEC9', '#DEC6A2', '#CBA97E', '#B28B67'],
    floorEmpty: '#ECE5D3',
    floorRival: '#DFD2CC',
    roofColors: ['#6E849C', '#C47765', '#6E9A84', '#B89B5E', '#8C769C'],
    inkEdges: true,
    inkColor: '#2F261E',
    treeMode: 'storybookRound',
    actorMode: 'paper25d',
  },
};

export const LIGHT_MODES = {
  bright: { id: 'bright', label: '明亮夜场', nightAmb: 1.25, nightHemi: 1.05, nightDir: 1.05 },
  cozy: { id: 'cozy', label: '氛围夜场', nightAmb: 0.92, nightHemi: 0.82, nightDir: 0.85 },
  day: { id: 'day', label: '白昼常亮', nightAmb: 1.55, nightHemi: 1.25, nightDir: 1.45 },
};

export function getInitialArtStyle() {
  if (typeof window === 'undefined') return 'diorama';
  try {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('style');
    if (q === 'diorama' || q === 'storybook') {
      window.localStorage?.setItem('kotaindah_art', q);
      return q;
    }
    const saved = window.localStorage?.getItem('kotaindah_art');
    if (saved === 'diorama' || saved === 'storybook') return saved;
  } catch (_) {}
  return 'diorama';
}

export function saveArtStyle(styleId) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage?.setItem('kotaindah_art', styleId);
  } catch (_) {}
}

export function applyDomTheme(styleId) {
  if (typeof document === 'undefined' || !document.documentElement) return;
  document.documentElement.dataset.theme = styleId;
}
