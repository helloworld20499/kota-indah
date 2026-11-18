// Hand-Inked Storybook Diorama & Lighting Configuration

export const STORYBOOK_THEME = {
  id: 'storybook',
  label: '手绘绘本',
  sub: '钢笔淡彩半剖风',
  dayBg: '#FAF5E8',
  duskBg: '#EBDCCB',
  nightBg: '#7884A3',
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
  inkColor: '#2F261E',
};

export const LIGHT_MODES = {
  bright: { id: 'bright', label: '明亮夜场', nightAmb: 1.25, nightHemi: 1.05, nightDir: 1.05 },
  cozy: { id: 'cozy', label: '氛围夜场', nightAmb: 0.92, nightHemi: 0.82, nightDir: 0.85 },
  day: { id: 'day', label: '白昼常亮', nightAmb: 1.55, nightHemi: 1.25, nightDir: 1.45 },
};
