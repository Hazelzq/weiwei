// 地图页的“书”：一本摊开的册子。
// 左页“草木记”：每到一处夹一片植物标本；右页：水墨风格的江南示意地图。
// 全部用 Canvas 现画，颜色取江南水乡：宣纸、水墨、青绿、粉墙黛瓦、朱砂印。
//
// 说明：右页是“示意图”，只画江河、湖泊、海岸和山势，不画任何行政或国界线，
// 方便公开发布时避免“问题地图”的风险。坐标为大致位置，非精确测绘。

export const SPREAD_W = 3200, SPREAD_H = 2134;
const PAGE_W = SPREAD_W / 2;

/* ---------------- 投影：经纬度 ↔ 右页地图区域 ---------------- */
export const MAP_RECT = { x: PAGE_W + 110, y: 190, w: 1380, h: 1760 };
const LON0 = 101.2, LON1 = 124.3;
const PX_PER_LON = MAP_RECT.w / (LON1 - LON0);
const PX_PER_LAT = PX_PER_LON / Math.cos((31 * Math.PI) / 180);
const LAT1 = 43.3, LAT0 = LAT1 - MAP_RECT.h / PX_PER_LAT;

export const project = (lon, lat) => [MAP_RECT.x + (lon - LON0) * PX_PER_LON, MAP_RECT.y + (LAT1 - lat) * PX_PER_LAT];
export const unproject = (px, py) => [LON0 + (px - MAP_RECT.x) / PX_PER_LON, LAT1 - (py - MAP_RECT.y) / PX_PER_LAT];
export const inMap = (px, py) => px >= MAP_RECT.x && px <= MAP_RECT.x + MAP_RECT.w && py >= MAP_RECT.y && py <= MAP_RECT.y + MAP_RECT.h;
/** 经纬度 → 整张展开页上的比例（0–1） */
export const fracOf = (lon, lat) => { const [x, y] = project(lon, lat); return [x / SPREAD_W, y / SPREAD_H]; };

/* ---------------- 地理数据（约略） ---------------- */
const COAST = [
  [124.3, 39.85], [123.6, 39.75], [122.9, 39.5], [122.2, 39.25], [121.6, 38.85], [121.15, 39.05], [121.55, 39.55],
  [122.05, 40.25], [121.85, 40.85], [121.0, 40.85], [120.25, 40.35], [119.55, 39.85], [118.9, 39.35], [118.1, 39.15],
  [117.7, 38.95], [117.6, 38.5], [118.1, 38.1], [118.75, 37.65], [119.15, 37.15], [119.85, 37.3], [120.6, 37.75],
  [121.4, 37.55], [122.15, 37.42], [122.6, 37.2], [122.05, 36.9], [121.15, 36.6], [120.4, 36.1], [119.65, 35.6],
  [119.3, 35.1], [119.55, 34.5], [120.25, 33.95], [120.85, 32.75], [121.4, 32.3], [121.9, 31.75], [121.85, 31.42],
  [121.9, 31.0], [121.05, 30.62], [120.62, 30.4], [121.3, 30.22], [121.9, 29.95], [121.95, 29.4], [121.6, 28.7],
  [121.3, 28.1], [120.7, 27.6], [120.3, 27.1], [119.75, 26.45], [119.55, 25.8], [119.05, 25.2], [118.6, 24.6],
  [118.05, 24.45], [117.3, 23.8], [116.6, 23.3], [115.6, 22.8], [114.9, 22.62], [114.25, 22.35], [113.65, 22.6],
  [113.5, 22.2], [112.8, 21.95], [111.9, 21.65], [111.0, 21.45], [110.4, 21.2], [110.2, 20.6], [110.1, 20.25],
  [109.8, 20.6], [109.7, 21.4], [109.05, 21.6], [108.45, 21.7], [107.98, 21.55], [107.4, 21.3], [106.8, 20.9],
  [106.6, 20.3], [106.0, 19.9], [105.75, 19.0], [106.15, 18.3], [106.45, 17.6], [106.6, 16.9],
];
const ISLANDS = [
  // 海南岛
  [[108.65, 19.2], [108.85, 19.75], [109.25, 20.0], [110.2, 20.1], [110.7, 19.95], [111.05, 19.6], [110.6, 18.8],
    [110.0, 18.35], [109.5, 18.2], [108.75, 18.5]],
  // 台湾岛
  [[121.05, 25.3], [121.6, 25.25], [121.95, 25.0], [121.75, 24.4], [121.6, 23.8], [121.35, 22.9], [120.9, 21.95],
    [120.65, 22.35], [120.25, 22.85], [120.1, 23.4], [120.2, 24.0], [120.6, 24.7]],
  // 崇明岛
  [[121.15, 31.83], [121.55, 31.68], [121.95, 31.55], [121.85, 31.48], [121.4, 31.6], [121.1, 31.75]],
];
const ISLETS = [[122.15, 30.05], [122.3, 29.95], [122.05, 29.85], [121.8, 30.1], [123.47, 25.74], [119.8, 25.5], [118.4, 24.45]];
const RIVERS = [
  { w: 7, pts: [[102.7, 25.9], [103.1, 26.5], [103.4, 27.3], [104.0, 28.2], [104.6, 28.77], [105.4, 28.9], [106.55, 29.56],
    [107.4, 29.9], [108.4, 30.8], [109.6, 31.05], [110.4, 31.0], [111.3, 30.7], [112.2, 30.3], [113.1, 29.45], [113.8, 30.1],
    [114.3, 30.6], [115.2, 30.2], [116.0, 29.75], [117.0, 30.5], [117.8, 30.95], [118.4, 31.35], [118.8, 32.05],
    [119.45, 32.2], [120.3, 31.95], [121.0, 31.75], [121.75, 31.45]] }, // 长江
  { w: 5, pts: [[110.5, 39.4], [110.65, 37.6], [110.55, 36.2], [110.35, 35.1], [110.4, 34.62], [111.4, 34.78],
    [112.4, 34.8], [113.6, 34.92], [114.3, 34.9], [115.2, 35.35], [116.0, 35.9], [116.9, 36.65], [117.8, 37.15],
    [118.6, 37.6], [119.1, 37.75]] }, // 黄河
  { w: 3.2, pts: [[103.6, 31.05], [103.85, 30.5], [103.75, 29.55], [104.2, 29.1], [104.6, 28.77]] }, // 岷江
  { w: 3, pts: [[106.0, 32.6], [106.1, 31.6], [106.1, 30.8], [106.3, 30.0], [106.55, 29.56]] }, // 嘉陵江
  { w: 3, pts: [[106.0, 33.1], [107.5, 32.85], [109.0, 32.7], [110.8, 32.6], [111.6, 32.1], [112.6, 31.0], [113.6, 30.65], [114.3, 30.6]] }, // 汉江
  { w: 3, pts: [[112.0, 25.9], [112.6, 27.2], [112.95, 28.2], [112.9, 28.95]] }, // 湘江
  { w: 3, pts: [[115.0, 25.9], [115.0, 27.5], [115.9, 28.6], [116.1, 28.9]] }, // 赣江
  { w: 3.4, pts: [[118.3, 29.55], [119.2, 29.6], [119.8, 29.9], [120.15, 30.18], [120.62, 30.38]] }, // 钱塘江
  { w: 4, pts: [[107.0, 24.0], [108.3, 23.3], [110.0, 23.5], [111.3, 23.4], [112.5, 23.1], [113.3, 22.85], [113.65, 22.6]] }, // 西江—珠江
  { w: 3, pts: [[113.5, 32.4], [115.5, 32.5], [116.8, 32.8], [118.3, 33.15], [118.7, 33.3]] }, // 淮河
];
const CANAL = [[116.66, 39.9], [117.2, 39.12], [116.85, 38.3], [116.3, 37.45], [115.98, 36.45], [116.6, 35.4], [117.2, 34.26],
  [118.1, 33.85], [119.0, 33.6], [119.4, 32.4], [119.45, 32.2], [119.97, 31.8], [120.3, 31.57], [120.6, 31.3],
  [120.75, 30.75], [120.45, 30.45], [120.2, 30.3]];
const LAKES = [
  { lon: 120.2, lat: 31.2, rx: 0.36, ry: 0.32, r: 0.4 },  // 太湖
  { lon: 116.3, lat: 29.0, rx: 0.22, ry: 0.55, r: 0.25 }, // 鄱阳湖
  { lon: 112.9, lat: 29.25, rx: 0.42, ry: 0.24, r: -0.2 }, // 洞庭湖
  { lon: 118.7, lat: 33.3, rx: 0.25, ry: 0.24, r: 0 },    // 洪泽湖
  { lon: 117.55, lat: 31.58, rx: 0.2, ry: 0.11, r: 0.2 }, // 巢湖
  { lon: 120.14, lat: 30.25, rx: 0.06, ry: 0.06, r: 0 },  // 西湖
  { lon: 115.95, lat: 38.9, rx: 0.12, ry: 0.08, r: 0 },   // 白洋淀
];
const RANGES = [
  { lon: [113.2, 114.4], lat: [35.6, 40.2], n: 9 },   // 太行山
  { lon: [105.6, 111.3], lat: [33.7, 34.15], n: 10 }, // 秦岭
  { lon: [106.3, 109.8], lat: [31.9, 32.4], n: 6 },   // 大巴山
  { lon: [101.6, 102.9], lat: [26.8, 31.6], n: 9 },   // 横断山
  { lon: [116.6, 118.4], lat: [26.6, 27.9], n: 6 },   // 武夷山
  { lon: [110.2, 114.8], lat: [24.7, 25.5], n: 8 },   // 南岭
  { lon: [113.6, 117.9], lat: [40.4, 41.6], n: 6 },   // 燕山
];
const PEAKS = [
  { lon: 103.33, lat: 29.52, name: '峨眉山' }, { lon: 118.17, lat: 30.13, name: '黄山' }, { lon: 115.97, lat: 29.55, name: '' },
];
const CITIES = [
  ['北京', 116.4, 39.9], ['石家庄', 114.5, 38.04], ['成都', 104.07, 30.67], ['重庆', 106.55, 29.56], ['西安', 108.94, 34.34],
  ['武汉', 114.3, 30.6], ['南京', 118.8, 32.06], ['苏州', 120.62, 31.3], ['杭州', 120.16, 30.27], ['上海', 121.47, 31.23],
  ['广州', 113.26, 23.13], ['深圳', 114.06, 22.55],
];
const TOWNS = [[120.95, 31.08], [120.5, 30.72], [120.62, 29.98], [119.42, 32.48]];
const REGIONS = [['巴蜀', 103.0, 32.6, 92], ['燕赵', 115.4, 39.4, 84], ['江南', 119.3, 29.6, 104], ['岭南', 112.6, 24.0, 76], ['中原', 113.4, 34.0, 62]];
const SEAS = [['渤海', 119.9, 38.75], ['黄海', 122.6, 35.0], ['东海', 123.1, 28.5], ['南海', 113.6, 19.6]];

/* ---------------- 植物 ---------------- */
export const PLANTS = [
  { name: '银杏', latin: 'Ginkgo biloba' }, { name: '桂花', latin: 'Osmanthus fragrans' },
  { name: '荷叶', latin: 'Nelumbo nucifera' }, { name: '枫叶', latin: 'Acer palmatum' },
  { name: '竹叶', latin: 'Phyllostachys' }, { name: '梅花', latin: 'Prunus mume' },
  { name: '茶叶', latin: 'Camellia sinensis' }, { name: '芦苇', latin: 'Phragmites australis' },
];

/** 左页的 6 个标本格（画布像素） */
export const SLOTS = (() => {
  const out = [], x0 = 120, y0 = 380, cw = 680, ch = 470, gx = 40, gy = 34;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) out.push({ x: x0 + c * (cw + gx), y: y0 + r * (ch + gy), w: cw, h: ch });
  return out;
})();

const INK = '#34322e', INK_SOFT = '#6d675d', SEAL = '#b23a2e', PAPER = '#f3ecdb';
const KAI = 'WenKai, "Kaiti SC", "STKaiti", "KaiTi", "Songti SC", "Noto Serif CJK SC", serif';
const SANS = '"PingFang SC", "Microsoft YaHei", sans-serif';

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function smooth(ctx, pts, close = false) {
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  const last = pts[pts.length - 1];
  if (close) { ctx.quadraticCurveTo(last[0], last[1], (last[0] + pts[0][0]) / 2, (last[1] + pts[0][1]) / 2); ctx.closePath(); }
  else ctx.lineTo(last[0], last[1]);
}
const P = (list) => list.map(([lon, lat]) => project(lon, lat));

/* ---------------- 纸 ---------------- */
function paper(ctx, r) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, SPREAD_W, SPREAD_H);
  // 宣纸纤维
  ctx.lineCap = 'round';
  for (let i = 0; i < 2600; i++) {
    const x = r() * SPREAD_W, y = r() * SPREAD_H, a = r() * Math.PI, l = 8 + r() * 34;
    ctx.strokeStyle = r() > 0.5 ? '#8a775414' : '#ffffff26';
    ctx.lineWidth = 0.8 + r();
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 8, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  for (let i = 0; i < 7000; i++) {
    ctx.fillStyle = r() > 0.6 ? '#6b55300d' : '#ffffff18';
    ctx.fillRect(r() * SPREAD_W, r() * SPREAD_H, 1.5 + r() * 2, 1.5 + r() * 2);
  }
  // 中缝阴影与页边旧色
  const g = ctx.createLinearGradient(PAGE_W - 170, 0, PAGE_W + 170, 0);
  g.addColorStop(0, '#5a462800'); g.addColorStop(0.42, '#5a46281c'); g.addColorStop(0.5, '#5a462840');
  g.addColorStop(0.58, '#5a46281c'); g.addColorStop(1, '#5a462800');
  ctx.fillStyle = g; ctx.fillRect(PAGE_W - 170, 0, 340, SPREAD_H);
  for (const [x0, x1] of [[0, 60], [SPREAD_W - 60, SPREAD_W]]) {
    const e = ctx.createLinearGradient(x0, 0, x1, 0);
    const outer = x0 === 0;
    e.addColorStop(outer ? 0 : 1, '#b39a6a30'); e.addColorStop(outer ? 1 : 0, '#b39a6a00');
    ctx.fillStyle = e; ctx.fillRect(x0, 0, 60, SPREAD_H);
  }
}

function seal(ctx, x, y, size, text, round = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.04);
  ctx.fillStyle = SEAL;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  if (round) ctx.arc(0, 0, size / 2, 0, Math.PI * 2); else ctx.roundRect(-size / 2, -size / 2, size, size, size * 0.08);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fbefe2';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const chars = [...text];
  if (chars.length === 1) {
    ctx.font = `${size * 0.66}px ${KAI}`;
    ctx.fillText(text, 0, size * 0.03);
  } else {
    ctx.font = `${size * 0.4}px ${KAI}`;
    ctx.fillText(chars[0], 0, -size * 0.2);
    ctx.fillText(chars[1], 0, size * 0.24);
  }
  // 斑驳
  const r = rng(text.charCodeAt(0));
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc((r() - 0.5) * size, (r() - 0.5) * size, r() * 2.4, 0, 7); ctx.fill(); }
  ctx.restore();
}

function verticalText(ctx, text, x, y, size, gap = 1.12) {
  [...text].forEach((ch, i) => ctx.fillText(ch, x, y + i * size * gap));
}

/* ---------------- 右页：水墨江南示意图 ---------------- */
function drawMap(ctx, r) {
  const R = MAP_RECT;
  ctx.save();
  ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();

  // 海：青绿淡彩 + 鱼鳞海水纹
  const coast = P(COAST);
  ctx.beginPath();
  smooth(ctx, coast);
  ctx.lineTo(R.x + R.w + 20, R.y + R.h + 20);
  ctx.lineTo(R.x + R.w + 20, coast[0][1]);
  ctx.closePath();
  ctx.fillStyle = '#cfdcd4';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = '#7f9d9455'; ctx.lineWidth = 2;
  for (let y = R.y; y < R.y + R.h + 30; y += 26) {
    for (let x = R.x + ((y / 26) % 2) * 22; x < R.x + R.w + 30; x += 44) {
      ctx.beginPath(); ctx.arc(x, y, 20, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    }
  }
  ctx.restore();
  // 近岸淡墨晕
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath(); smooth(ctx, coast);
  ctx.strokeStyle = '#9fb8ae66'; ctx.lineWidth = 26; ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = 3.2; ctx.stroke();
  ctx.restore();
  for (const island of ISLANDS) {
    ctx.beginPath(); smooth(ctx, P(island), true);
    ctx.fillStyle = PAPER; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.stroke();
  }
  for (const [lon, lat] of ISLETS) {
    const [x, y] = project(lon, lat);
    ctx.beginPath(); ctx.ellipse(x, y, 5, 3.5, 0.4, 0, Math.PI * 2);
    ctx.fillStyle = PAPER; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
  }

  // 山：淡墨晕染的山峦
  const peaks = [];
  for (const range of RANGES) {
    for (let i = 0; i < range.n; i++) {
      const t = (i + r() * 0.8) / range.n;
      const lon = range.lon[0] + (range.lon[1] - range.lon[0]) * (range.lat[1] - range.lat[0] > 2 ? 0.5 + (r() - 0.5) * 0.8 : t);
      const lat = range.lat[0] + (range.lat[1] - range.lat[0]) * (range.lat[1] - range.lat[0] > 2 ? t : 0.5 + (r() - 0.5));
      peaks.push({ lon, lat, s: 0.75 + r() * 0.55 });
    }
  }
  for (const p of PEAKS) peaks.push({ ...p, s: 1.25 });
  peaks.sort((a, b) => b.lat - a.lat);
  for (const p of peaks) {
    const [x, y] = project(p.lon, p.lat);
    const w = 34 * p.s, h = 40 * p.s;
    const g = ctx.createLinearGradient(0, y - h, 0, y + 4);
    g.addColorStop(0, '#5f6b62b0'); g.addColorStop(0.6, '#93a09755'); g.addColorStop(1, '#b8c2b300');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - w * 1.3, y + 4);
    ctx.quadraticCurveTo(x - w * 0.5, y - h * 0.55, x - w * 0.12, y - h);
    ctx.quadraticCurveTo(x + w * 0.1, y - h * 0.95, x + w * 0.2, y - h * 0.82);
    ctx.quadraticCurveTo(x + w * 0.7, y - h * 0.4, x + w * 1.3, y + 4);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#3f453fcc'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.9, y - h * 0.15);
    ctx.quadraticCurveTo(x - w * 0.45, y - h * 0.62, x - w * 0.12, y - h);
    ctx.quadraticCurveTo(x + w * 0.1, y - h * 0.95, x + w * 0.2, y - h * 0.82);
    ctx.quadraticCurveTo(x + w * 0.55, y - h * 0.45, x + w * 0.85, y - h * 0.2);
    ctx.stroke();
    if (p.name) {
      ctx.fillStyle = INK_SOFT; ctx.font = `26px ${KAI}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(p.name, x - w * 1.1, y - h * 0.3);
    }
  }

  // 江河
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const river of RIVERS) {
    ctx.beginPath(); smooth(ctx, P(river.pts));
    ctx.strokeStyle = '#a9c1bc'; ctx.lineWidth = river.w + 5; ctx.stroke();
    ctx.strokeStyle = '#4f6e6e'; ctx.lineWidth = river.w * 0.55; ctx.stroke();
  }
  for (const lake of LAKES) {
    const [x, y] = project(lake.lon, lake.lat);
    ctx.beginPath();
    ctx.ellipse(x, y, lake.rx * PX_PER_LON, lake.ry * PX_PER_LAT, lake.r, 0, Math.PI * 2);
    ctx.fillStyle = '#c3d6cf'; ctx.fill();
    ctx.strokeStyle = '#4f6e6e'; ctx.lineWidth = 2.4; ctx.stroke();
  }
  // 京杭大运河：青绿双线
  ctx.beginPath(); smooth(ctx, P(CANAL));
  ctx.strokeStyle = '#7fb0a2'; ctx.lineWidth = 9; ctx.stroke();
  ctx.strokeStyle = '#f3ecdb'; ctx.lineWidth = 3; ctx.setLineDash([14, 10]); ctx.stroke();
  ctx.setLineDash([]);

  // 水乡：粉墙黛瓦 + 石拱桥 + 乌篷船
  for (const [lon, lat] of TOWNS) {
    const [x, y] = project(lon, lat);
    for (let k = 0; k < 3; k++) house(ctx, x - 16 + k * 15 + (r() - 0.5) * 4, y + (k % 2) * 6 - 6, 0.55 + r() * 0.15);
  }
  bridge(ctx, ...project(120.72, 31.0));
  bridge(ctx, ...project(120.38, 31.6));
  boat(ctx, ...project(120.9, 30.55));
  boat(ctx, ...project(119.8, 31.35));

  // 地名
  ctx.textBaseline = 'middle';
  for (const [name, lon, lat, size] of REGIONS) {
    const [x, y] = project(lon, lat);
    ctx.fillStyle = '#34322e2a'; ctx.font = `${size}px ${KAI}`; ctx.textAlign = 'center';
    ctx.save(); ctx.translate(x, y); ctx.fillText(name, 0, 0); ctx.restore();
  }
  for (const [name, lon, lat] of SEAS) {
    const [x, y] = project(lon, lat);
    ctx.fillStyle = '#4f6e6e99'; ctx.font = `40px ${KAI}`; ctx.textAlign = 'center';
    ctx.fillText(name, x, y);
  }
  ctx.font = `30px ${KAI}`; ctx.fillStyle = '#4f6e6ecc'; ctx.textAlign = 'center';
  ctx.save(); ctx.translate(...project(111.6, 30.15)); ctx.rotate(-0.08); ctx.fillText('长  江', 0, 0); ctx.restore();
  ctx.save(); ctx.translate(...project(115.4, 35.95)); ctx.rotate(0.25); ctx.fillText('黄  河', 0, 0); ctx.restore();
  ctx.save(); ctx.translate(...project(117.35, 36.1)); ctx.rotate(1.25); ctx.fillStyle = '#4f8a7c'; ctx.font = `28px ${KAI}`;
  ctx.fillText('京杭大运河', 0, 0); ctx.restore();
  for (const [name, lon, lat] of CITIES) {
    const [x, y] = project(lon, lat);
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = PAPER; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();
    ctx.fillStyle = INK; ctx.font = `28px ${KAI}`; ctx.textAlign = 'left';
    const right = !['上海', '苏州', '深圳'].includes(name);
    ctx.textAlign = right ? 'left' : 'right';
    ctx.fillText(name, x + (right ? 12 : -12), y - (name === '苏州' ? 14 : 0));
  }
  ctx.restore();

  // 图框
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.strokeRect(R.x - 14, R.y - 14, R.w + 28, R.h + 28);
  ctx.lineWidth = 1.4;
  ctx.strokeRect(R.x - 4, R.y - 4, R.w + 8, R.h + 8);
  // 指北
  const nx = R.x + 80, ny = R.y + 100;
  ctx.fillStyle = INK; ctx.font = `44px ${KAI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('北', nx, ny - 62);
  ctx.beginPath(); ctx.moveTo(nx, ny - 34); ctx.lineTo(nx + 15, ny + 22); ctx.lineTo(nx, ny + 10); ctx.lineTo(nx - 15, ny + 22); ctx.closePath();
  ctx.fill();
  // 题款与印
  ctx.fillStyle = INK; ctx.font = `64px ${KAI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const ty = R.y + R.h - 600;
  verticalText(ctx, '我们走过的地方', R.x + 70, ty, 64);
  ctx.font = `30px ${KAI}`; ctx.fillStyle = INK_SOFT;
  verticalText(ctx, '烟雨江南一路行', R.x + 140, ty + 60, 30, 1.25);
  seal(ctx, R.x + 70, ty + 64 * 1.12 * 7 + 46, 66, '行迹');
  ctx.font = `24px ${SANS}`; ctx.fillStyle = INK_SOFT; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('示意图 · 仅示大致方位，未按比例绘制', R.x + R.w, R.y + R.h + 60);
}

function house(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#fbf7ee'; ctx.strokeStyle = INK; ctx.lineWidth = 2.4;
  ctx.fillRect(-14, -12, 28, 22); ctx.strokeRect(-14, -12, 28, 22);
  ctx.fillStyle = '#3d3f3d';
  ctx.beginPath(); // 马头墙
  ctx.moveTo(-18, -12); ctx.lineTo(-18, -18); ctx.lineTo(-10, -18); ctx.lineTo(-10, -24); ctx.lineTo(10, -24); ctx.lineTo(10, -18);
  ctx.lineTo(18, -18); ctx.lineTo(18, -12); ctx.closePath(); ctx.fill();
  ctx.fillRect(-4, -2, 8, 12);
  ctx.restore();
}
function bridge(ctx, x, y) {
  ctx.save(); ctx.translate(x, y);
  ctx.strokeStyle = INK; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(-26, 4); ctx.quadraticCurveTo(0, -22, 26, 4); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 4, 11, Math.PI, 0); ctx.stroke();
  ctx.restore();
}
function boat(ctx, x, y) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#3d3f3d';
  ctx.beginPath(); ctx.moveTo(-22, 0); ctx.quadraticCurveTo(0, 9, 22, 0); ctx.lineTo(18, -2); ctx.lineTo(-18, -2); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-2, -4, 10, 7, 0, Math.PI, 0); ctx.fill();
  ctx.restore();
}

/* ---------------- 植物标本 ---------------- */
function leafShape(ctx, len, w) {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(w, -len * 0.22, w * 0.85, -len * 0.72, 0, -len);
  ctx.bezierCurveTo(-w * 0.85, -len * 0.72, -w, -len * 0.22, 0, 0);
  ctx.closePath();
}
function leaf(ctx, x, y, angle, len, w, color, vein, serrate = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  leafShape(ctx, len, w);
  const g = ctx.createLinearGradient(-w, 0, w, 0);
  g.addColorStop(0, color[0]); g.addColorStop(0.5, color[1]); g.addColorStop(1, color[0]);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = vein; ctx.lineWidth = 1.4; ctx.stroke();
  if (serrate) {
    ctx.strokeStyle = vein; ctx.lineWidth = 1;
    for (let k = 1; k < 9; k++) {
      const t = k / 9, yy = -len * t, ww = w * Math.sin(Math.PI * Math.min(1, t * 1.05)) * 0.8;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * ww, yy); ctx.lineTo(s * (ww + 3), yy - 4); ctx.stroke(); }
    }
  }
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(w * 0.08, -len * 0.5, 0, -len * 0.96);
  ctx.strokeStyle = vein; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.lineWidth = 0.9;
  for (let k = 1; k < 6; k++) {
    const t = k / 6.5, yy = -len * t, ww = w * 0.62 * Math.sin(Math.PI * t);
    ctx.beginPath(); ctx.moveTo(0, yy); ctx.quadraticCurveTo(ww * 0.5, yy - len * 0.04, ww, yy - len * 0.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, yy); ctx.quadraticCurveTo(-ww * 0.5, yy - len * 0.04, -ww, yy - len * 0.1); ctx.stroke();
  }
  ctx.restore();
}
function stem(ctx, pts, color, width) {
  ctx.beginPath(); smooth(ctx, pts);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.stroke();
}
function flower(ctx, x, y, r, petal, center, n = 5, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  for (let k = 0; k < n; k++) {
    ctx.rotate((Math.PI * 2) / n);
    ctx.beginPath(); ctx.ellipse(0, -r * 0.62, r * 0.42, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fillStyle = petal; ctx.fill();
    ctx.strokeStyle = '#00000018'; ctx.lineWidth = 1; ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(0, 0, r * 0.26, 0, Math.PI * 2); ctx.fillStyle = center; ctx.fill();
  ctx.restore();
}

const PLANT_DRAW = [
  // 银杏
  (ctx, s, r) => {
    const fan = (x, y, a, R) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, R * 0.9); ctx.strokeStyle = '#9b7a3a'; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 0);
      const a0 = -Math.PI / 2 - 0.95, a1 = -Math.PI / 2 + 0.95;
      ctx.lineTo(Math.cos(a0) * R, Math.sin(a0) * R);
      for (let k = 0; k <= 20; k++) {
        const t = k / 20, ang = a0 + (a1 - a0) * t, notch = Math.abs(t - 0.5) < 0.05 ? 0.78 : 1 - 0.04 * Math.sin(t * 40);
        ctx.lineTo(Math.cos(ang) * R * notch, Math.sin(ang) * R * notch);
      }
      ctx.closePath();
      const g = ctx.createRadialGradient(0, 0, R * 0.1, 0, 0, R);
      g.addColorStop(0, '#c99a3c'); g.addColorStop(1, '#e3bd5e');
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#a07b33'; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.strokeStyle = '#a07b3366'; ctx.lineWidth = 0.9;
      for (let k = 0; k < 26; k++) {
        const ang = a0 + (a1 - a0) * (k / 25);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ang) * R * 0.95, Math.sin(ang) * R * 0.95); ctx.stroke();
      }
      ctx.restore();
    };
    fan(-40 * s, 40 * s, -0.35, 120 * s);
    fan(70 * s, 70 * s, 0.4, 92 * s);
    fan(10 * s, 120 * s, 0.05, 70 * s);
  },
  // 桂花
  (ctx, s, r) => {
    stem(ctx, [[-120 * s, 150 * s], [-40 * s, 60 * s], [30 * s, -10 * s], [110 * s, -120 * s]], '#6e5a40', 5 * s);
    const nodes = [[-80, 105, -2.2], [-40, 60, 0.9], [0, 22, -2.1], [40, -20, 1.0], [80, -80, -2.0], [105, -115, 0.2]];
    nodes.forEach(([x, y, a], i) => leaf(ctx, x * s, y * s, a, (88 - i * 6) * s, 26 * s, ['#617a4c', '#7f9763'], '#4d6340', 1));
    for (const [x, y] of [[-40, 60], [0, 22], [40, -20], [80, -80]]) {
      for (let k = 0; k < 6; k++) flower(ctx, (x + (r() - 0.5) * 30) * s, (y + (r() - 0.5) * 24) * s, 8 * s, '#e3a442', '#c97d22', 4, r() * 3);
    }
  },
  // 荷叶
  (ctx, s, r) => {
    const R = 125 * s;
    stem(ctx, [[0, 0], [10 * s, 110 * s], [-6 * s, 190 * s]], '#7f8f62', 6 * s);
    ctx.beginPath();
    for (let k = 0; k <= 60; k++) {
      const a = (k / 60) * Math.PI * 2, rr = R * (1 + 0.04 * Math.sin(a * 9) + 0.02 * Math.sin(a * 23));
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr * 0.92;
      k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, R);
    g.addColorStop(0, '#9fae84'); g.addColorStop(1, '#7c9068');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#5f7350'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.strokeStyle = '#5f735088'; ctx.lineWidth = 1.2;
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(Math.cos(a + 0.1) * R * 0.5, Math.sin(a + 0.1) * R * 0.46, Math.cos(a) * R * 0.95, Math.sin(a) * R * 0.88);
      ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0, 0, 9 * s, 0, 7); ctx.fillStyle = '#c9cfa8'; ctx.fill();
    // 一片莲瓣
    ctx.save(); ctx.translate(120 * s, 90 * s); ctx.rotate(0.6);
    leafShape(ctx, 80 * s, 30 * s); ctx.fillStyle = '#ecc7c3'; ctx.fill(); ctx.strokeStyle = '#c99a99'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
  },
  // 枫叶
  (ctx, s, r) => {
    const maple = (x, y, a, R, col) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, R * 0.8); ctx.strokeStyle = '#7b3b2c'; ctx.lineWidth = 2.6; ctx.stroke();
      const lobes = [[-90, 1], [-35, 0.88], [-145, 0.88], [15, 0.62], [-195, 0.62]];
      ctx.beginPath();
      lobes.sort((p, q) => p[0] - q[0]);
      const order = [[-195, 0.62], [-145, 0.88], [-90, 1], [-35, 0.88], [15, 0.62]];
      ctx.moveTo(0, R * 0.08);
      for (const [deg, l] of order) {
        const t = (deg * Math.PI) / 180, w = 0.32;
        ctx.lineTo(Math.cos(t - w) * R * l * 0.42, Math.sin(t - w) * R * l * 0.42);
        ctx.lineTo(Math.cos(t - w * 0.4) * R * l * 0.75, Math.sin(t - w * 0.4) * R * l * 0.75);
        ctx.lineTo(Math.cos(t) * R * l, Math.sin(t) * R * l);
        ctx.lineTo(Math.cos(t + w * 0.4) * R * l * 0.75, Math.sin(t + w * 0.4) * R * l * 0.75);
        ctx.lineTo(Math.cos(t + w) * R * l * 0.42, Math.sin(t + w) * R * l * 0.42);
      }
      ctx.closePath();
      const g = ctx.createRadialGradient(0, 0, 4, 0, 0, R);
      g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#7b3b2c'; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.strokeStyle = '#7b3b2c88'; ctx.lineWidth = 1.2;
      for (const [deg, l] of order) {
        const t = (deg * Math.PI) / 180;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(t) * R * l * 0.92, Math.sin(t) * R * l * 0.92); ctx.stroke();
      }
      ctx.restore();
    };
    maple(-40 * s, 30 * s, -0.25, 120 * s, ['#c86a3f', '#a7442f']);
    maple(85 * s, 85 * s, 0.5, 80 * s, ['#d99a4a', '#b9653a']);
  },
  // 竹叶
  (ctx, s, r) => {
    stem(ctx, [[-140 * s, 160 * s], [-30 * s, 40 * s], [60 * s, -60 * s], [130 * s, -140 * s]], '#8a9a5e', 4 * s);
    for (const [x, y] of [[-85, 100], [15, -12]]) {
      ctx.fillStyle = '#6f7d4a'; ctx.fillRect((x - 4) * s, (y - 2) * s, 8 * s, 4 * s);
    }
    const leaves = [[-30, 40, -1.0, 150], [-30, 40, -0.4, 130], [-30, 40, 0.5, 120], [60, -60, -1.3, 140], [60, -60, -0.6, 160], [60, -60, 0.4, 110]];
    for (const [x, y, a, l] of leaves) leaf(ctx, x * s, y * s, a, l * s, 15 * s, ['#7f965f', '#9fb37c'], '#5f7448');
  },
  // 梅花
  (ctx, s, r) => {
    stem(ctx, [[-150 * s, 140 * s], [-70 * s, 70 * s], [-40 * s, 10 * s], [40 * s, -40 * s], [120 * s, -130 * s]], '#4a3a2e', 7 * s);
    stem(ctx, [[-40 * s, 10 * s], [-90 * s, -70 * s], [-110 * s, -130 * s]], '#4a3a2e', 4.5 * s);
    stem(ctx, [[40 * s, -40 * s], [100 * s, -10 * s], [150 * s, 30 * s]], '#4a3a2e', 4 * s);
    const fl = [[-70, 70, 22], [-95, -80, 20], [-112, -128, 15], [10, -22, 23], [100, -10, 19], [120, -128, 17], [-35, 12, 14], [148, 30, 13]];
    for (const [x, y, rr] of fl) {
      flower(ctx, x * s, y * s, rr * s, '#f1dcd8', '#c4707c', 5, r() * 3);
      ctx.fillStyle = '#b35a5a';
      for (let k = 0; k < 6; k++) { const a = k * 1.05; ctx.beginPath(); ctx.arc((x + Math.cos(a) * rr * 0.35) * s, (y + Math.sin(a) * rr * 0.35) * s, 1.6 * s, 0, 7); ctx.fill(); }
    }
  },
  // 茶叶
  (ctx, s, r) => {
    stem(ctx, [[-20 * s, 170 * s], [-5 * s, 60 * s], [5 * s, -60 * s]], '#7d8a55', 4.5 * s);
    leaf(ctx, -5 * s, 60 * s, -0.75, 120 * s, 38 * s, ['#6d8a4c', '#8aa565'], '#4f6a3c', 1);
    leaf(ctx, 0, 10 * s, 0.7, 112 * s, 36 * s, ['#6d8a4c', '#8aa565'], '#4f6a3c', 1);
    leaf(ctx, 5 * s, -55 * s, 0.05, 78 * s, 16 * s, ['#a2b878', '#bccb92'], '#6f8650');
    leaf(ctx, -20 * s, 160 * s, 2.6, 70 * s, 26 * s, ['#7a8d58', '#93a46d'], '#596c42', 1);
  },
  // 芦苇
  (ctx, s, r) => {
    stem(ctx, [[-120 * s, 180 * s], [-20 * s, 40 * s], [70 * s, -90 * s]], '#a8956a', 4 * s);
    leaf(ctx, -60 * s, 100 * s, 0.25, 210 * s, 12 * s, ['#a3a879', '#bcbf92'], '#7f845c');
    leaf(ctx, -10 * s, 30 * s, -1.25, 190 * s, 10 * s, ['#a3a879', '#bcbf92'], '#7f845c');
    ctx.strokeStyle = '#c8b28a'; ctx.lineWidth = 1.6 * s;
    for (let k = 0; k < 70; k++) {
      const t = r(), x = 70 * s + (t * 70 - 10) * s, y = -90 * s - t * 90 * s;
      ctx.beginPath(); ctx.moveTo(x - 4 * s, y + 6 * s);
      ctx.quadraticCurveTo(x + (r() * 20) * s, y - (10 + r() * 12) * s, x + (12 + r() * 28) * s, y - (r() * 30) * s);
      ctx.stroke();
    }
  },
];

function tape(ctx, x, y, w, h, angle, color) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h / 2);
  for (let k = 0; k <= 6; k++) ctx.lineTo(-w / 2 + (w * k) / 6, -h / 2 + (k % 2) * 2.5);
  ctx.lineTo(w / 2 + 3, 0);
  for (let k = 6; k >= 0; k--) ctx.lineTo(-w / 2 + (w * k) / 6, h / 2 - (k % 2) * 2.5);
  ctx.lineTo(-w / 2 - 3, 0);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function specimen(ctx, slot, index, stop, r) {
  const plant = PLANTS[index % PLANTS.length];
  const cx = slot.x + slot.w * 0.36, cy = slot.y + slot.h * 0.5;
  // 轻微投影，像压干后夹在纸上
  ctx.save();
  ctx.shadowColor = '#4a3a2240'; ctx.shadowBlur = 8; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 3;
  ctx.translate(cx, cy);
  ctx.rotate((r() - 0.5) * 0.25);
  PLANT_DRAW[index % PLANT_DRAW.length](ctx, 1.05, r);
  ctx.restore();
  tape(ctx, cx - 70, cy + 120, 120, 30, -0.5 + (r() - 0.5) * 0.2, '#b9d3c7a6');
  tape(ctx, cx + 80, cy - 110, 110, 30, 0.6 + (r() - 0.5) * 0.2, '#e7c3bca6');

  // 标签：撕下来的便笺
  const lw = 250, lh = 158, lx = slot.x + slot.w - lw - 10, ly = slot.y + slot.h - lh - 18;
  ctx.save();
  ctx.translate(lx + lw / 2, ly + lh / 2);
  ctx.rotate((r() - 0.5) * 0.08);
  ctx.shadowColor = '#4a3a2230'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
  ctx.fillStyle = '#fbf6e8';
  ctx.beginPath();
  ctx.moveTo(-lw / 2, -lh / 2);
  for (let k = 0; k <= 18; k++) ctx.lineTo(-lw / 2 + (lw * k) / 18, -lh / 2 + (k % 2 ? 4 : 0) + r() * 2);
  ctx.lineTo(lw / 2, lh / 2); ctx.lineTo(-lw / 2, lh / 2); ctx.closePath(); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#9cb6c033'; ctx.lineWidth = 1.2;
  for (let yy = -lh / 2 + 34; yy < lh / 2; yy += 30) { ctx.beginPath(); ctx.moveTo(-lw / 2 + 8, yy); ctx.lineTo(lw / 2 - 8, yy); ctx.stroke(); }
  ctx.strokeStyle = '#d98b8155'; ctx.beginPath(); ctx.moveTo(-lw / 2 + 30, -lh / 2 + 6); ctx.lineTo(-lw / 2 + 30, lh / 2); ctx.stroke();
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = INK_SOFT; ctx.font = `22px ${SANS}`;
  ctx.fillText(`No.${String(index + 1).padStart(2, '0')}  ${plant.name}`, -lw / 2 + 40, -lh / 2 + 30);
  ctx.font = `italic 17px Georgia, serif`; ctx.fillStyle = '#9a917f';
  ctx.fillText(plant.latin, -lw / 2 + 40, -lh / 2 + 54);
  if (stop) {
    let size = 38;
    ctx.font = `${size}px ${KAI}`;
    while (ctx.measureText(stop.title).width > lw - 56 && size > 22) { size -= 2; ctx.font = `${size}px ${KAI}`; }
    ctx.fillStyle = INK; ctx.fillText(stop.title, -lw / 2 + 40, -lh / 2 + 104);
    const d = new Date(stop.created || Date.now());
    ctx.font = `20px ${SANS}`; ctx.fillStyle = INK_SOFT;
    ctx.fillText(`采于 ${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`, -lw / 2 + 40, -lh / 2 + 140);
  } else {
    ctx.font = `22px ${KAI}`; ctx.fillStyle = '#a49b88';
    ctx.fillText('采于 ____________', -lw / 2 + 40, -lh / 2 + 104);
  }
  ctx.restore();
}

function leftPage(ctx) {
  ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = `110px ${KAI}`;
  ctx.fillText('草木记', 130, 250);
  seal(ctx, 500, 205, 70, '江南');
  ctx.font = `34px ${KAI}`; ctx.fillStyle = INK_SOFT;
  ctx.fillText('每到一处，夹一片叶子。', 132, 320);
  ctx.strokeStyle = '#34322e55'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(130, 350); ctx.lineTo(PAGE_W - 130, 350); ctx.stroke();
  // 图例
  const y = SPREAD_H - 150;
  ctx.beginPath(); ctx.moveTo(130, y - 40); ctx.lineTo(PAGE_W - 130, y - 40); ctx.stroke();
  lanternIcon(ctx, 160, y + 6);
  ctx.fillStyle = INK; ctx.font = `30px ${KAI}`; ctx.textBaseline = 'middle';
  ctx.fillText('红灯笼：我们出生的地方', 200, y + 6);
  ctx.fillStyle = '#a8463c';
  for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(860 + k * 20, y + 6, 6, 0, 7); ctx.fill(); }
  ctx.fillStyle = INK; ctx.fillText('小圆点：我们走过的路', 975, y + 6);
  ctx.textAlign = 'center'; ctx.font = `28px ${KAI}`; ctx.fillStyle = INK_SOFT;
  ctx.fillText('— 壹 —', PAGE_W / 2, SPREAD_H - 60);
  ctx.fillText('— 贰 —', PAGE_W + PAGE_W / 2, SPREAD_H - 60);
}
function lanternIcon(ctx, x, y) {
  ctx.fillStyle = '#c0392b';
  ctx.beginPath(); ctx.ellipse(x, y, 20, 24, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c9a050'; ctx.fillRect(x - 11, y - 30, 22, 7); ctx.fillRect(x - 11, y + 23, 22, 7);
  ctx.strokeStyle = '#8e2a20'; ctx.lineWidth = 1.5;
  for (const dx of [-9, 0, 9]) { ctx.beginPath(); ctx.ellipse(x, y, Math.abs(dx) + 1, 23, 0, 0, Math.PI * 2); ctx.stroke(); }
}

function birthMarks(ctx, births) {
  for (const b of births) {
    const [x, y] = project(b.lon, b.lat);
    ctx.save();
    ctx.strokeStyle = '#b23a2ecc'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(x, y, 46, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y, 56, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    seal(ctx, x + 84, y + 54, 50, b.seal || '生');
  }
}

/* ---------------- 合成 ---------------- */
async function fontsReady() {
  try { await Promise.all([document.fonts.load(`64px ${KAI}`, '草木记我们走过的地方江南巴蜀燕赵'), document.fonts.ready]); } catch { /* 用备用字体 */ }
}

export function createBookPainter() {
  const base = document.createElement('canvas');
  base.width = SPREAD_W; base.height = SPREAD_H;
  let baseReady = null;

  async function paintBase(customMap) {
    await fontsReady();
    const ctx = base.getContext('2d');
    const r = rng(20261101);
    paper(ctx, r);
    if (customMap) {
      const R = MAP_RECT;
      const iw = customMap.naturalWidth, ih = customMap.naturalHeight, s = Math.max(R.w / iw, R.h / ih);
      ctx.save(); ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
      ctx.drawImage(customMap, R.x + (R.w - iw * s) / 2, R.y + (R.h - ih * s) / 2, iw * s, ih * s);
      ctx.fillStyle = '#f3ecdb26'; ctx.fillRect(R.x, R.y, R.w, R.h);
      ctx.restore();
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(R.x - 14, R.y - 14, R.w + 28, R.h + 28);
      ctx.lineWidth = 1.4; ctx.strokeRect(R.x - 4, R.y - 4, R.w + 8, R.h + 8);
    } else drawMap(ctx, r);
    leftPage(ctx);
  }

  return {
    /** customMap：用户上传的地图图片（HTMLImageElement），null 表示用水墨示意图 */
    async setBase(customMap) { baseReady = paintBase(customMap); await baseReady; },
    /** 画出整张展开页：stops 是按顺序的地点（前 6 个做成标本），births 是出生地 */
    async compose(target, stops, births) {
      await baseReady;
      target.width = SPREAD_W; target.height = SPREAD_H;
      const ctx = target.getContext('2d');
      ctx.drawImage(base, 0, 0);
      birthMarks(ctx, births);
      const r = rng(77);
      SLOTS.forEach((slot, i) => specimen(ctx, slot, i, stops[i] || null, r));
      if (stops.length > SLOTS.length) {
        ctx.fillStyle = INK_SOFT; ctx.font = `26px ${KAI}`; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(`另有 ${stops.length - SLOTS.length} 处，夹在后面几页`, PAGE_W - 130, SLOTS[5].y + SLOTS[5].h + 26);
      }
      return target;
    },
  };
}
