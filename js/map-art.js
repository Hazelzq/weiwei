// 地图页的手绘底图：用 Canvas 画出一张“微缩沙盘”风格的地图。
// 颜色取自旋转木马本身（天蓝、奶油、砖红、草绿、芥黄），两页看起来是一套。
// 坐标统一用 0–1 的归一化值：u 向右，v 向下（v=0 是地图远端/北）。

export const MAP_W = 2400, MAP_H = 1600;
const INSET = 54;

const C = {
  paper: '#efe3c6', paperDeep: '#dcc9a2', ink: '#6b5440', inkSoft: '#8d7660',
  sea: '#a8c2d2', seaDeep: '#8fb0c4', coast: '#5f86a1',
  river: '#93b5c8', field1: '#e4d7a8', field2: '#d6dbaf', field3: '#e8cfa6',
  hill: '#c9c597', hillShade: '#a6a676', snow: '#f6efdf',
  tree: '#8ea067', treeDark: '#6c8150', roof: '#b35142', wall: '#f2e7c9',
  road: '#b0916c', red: '#b35142', sky: '#648dae', green: '#79914f', yellow: '#d3a846', gold: '#bc9446',
};

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COAST = [[0.56, 1.02], [0.6, 0.9], [0.68, 0.84], [0.72, 0.7], [0.81, 0.62], [0.88, 0.5], [0.95, 0.45], [1.02, 0.42]];
const RIVER = [[0.31, -0.02], [0.33, 0.12], [0.27, 0.27], [0.33, 0.42], [0.46, 0.5], [0.55, 0.62], [0.62, 0.76], [0.68, 0.86], [0.74, 0.92]];
const TOWNS = [
  { u: 0.2, v: 0.41, n: 4 }, { u: 0.43, v: 0.69, n: 5 }, { u: 0.56, v: 0.37, n: 3 }, { u: 0.11, v: 0.62, n: 3 },
];
const ROADS = [[0, 1], [0, 2], [0, 3], [1, 3]];
const FORESTS = [
  { u: 0.14, v: 0.53, r: 0.055 }, { u: 0.41, v: 0.19, r: 0.042 }, { u: 0.27, v: 0.72, r: 0.05 },
  { u: 0.68, v: 0.47, r: 0.045 }, { u: 0.08, v: 0.2, r: 0.04 },
];
const LAKE = { u: 0.15, v: 0.27, ru: 0.055, rv: 0.06 };

/** 地图上的立体小树、小房子（只在手绘底图上出现）。 */
export const MINIATURES = (() => {
  const r = rng(7);
  const trees = [];
  for (const f of FORESTS) {
    for (let i = 0; i < 4; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * f.r * 0.75;
      trees.push({ u: f.u + Math.cos(a) * d * 0.66, v: f.v + Math.sin(a) * d, s: 0.8 + r() * 0.45 });
    }
  }
  const houses = TOWNS.map((t, i) => ({ u: t.u + 0.012, v: t.v - 0.018, rot: r() * Math.PI, roof: i % 2 ? C.sky : C.roof }));
  return { trees, houses };
})();

const X = (u) => INSET + u * (MAP_W - INSET * 2);
const Y = (v) => INSET + v * (MAP_H - INSET * 2);

function smoothPath(ctx, pts, move = true) {
  const p = pts.map(([u, v]) => [X(u), Y(v)]);
  if (move) ctx.moveTo(p[0][0], p[0][1]); else ctx.lineTo(p[0][0], p[0][1]);
  for (let i = 1; i < p.length - 1; i++) {
    const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2;
    ctx.quadraticCurveTo(p[i][0], p[i][1], mx, my);
  }
  ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
}

function paper(ctx, r) {
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, MAP_W, MAP_H);
  const g = ctx.createRadialGradient(MAP_W / 2, MAP_H / 2, MAP_H * 0.3, MAP_W / 2, MAP_H / 2, MAP_W * 0.62);
  g.addColorStop(0, '#f4ead300');
  g.addColorStop(1, '#c9b38a55');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, MAP_W, MAP_H);
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = r() > 0.5 ? '#7a5f3f0c' : '#ffffff12';
    ctx.fillRect(r() * MAP_W, r() * MAP_H, 1 + r() * 2, 1 + r() * 2);
  }
}

function grid(ctx) {
  ctx.save();
  ctx.strokeStyle = '#8b7a5e1c';
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 9]);
  for (let u = 0.125; u < 1; u += 0.125) { ctx.beginPath(); ctx.moveTo(X(u), Y(0)); ctx.lineTo(X(u), Y(1)); ctx.stroke(); }
  for (let v = 1 / 6; v < 1; v += 1 / 6) { ctx.beginPath(); ctx.moveTo(X(0), Y(v)); ctx.lineTo(X(1), Y(v)); ctx.stroke(); }
  ctx.restore();
}

function fields(ctx, r) {
  for (const t of TOWNS) {
    for (let i = 0; i < 7; i++) {
      const x = X(t.u + (r() - 0.5) * 0.14), y = Y(t.v + (r() - 0.5) * 0.14);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((r() - 0.5) * 0.5);
      ctx.fillStyle = [C.field1, C.field2, C.field3][i % 3];
      ctx.globalAlpha = 0.75;
      const w = 50 + r() * 70, h = 34 + r() * 46;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = C.inkSoft;
      ctx.lineWidth = 1.5;
      for (let k = -w / 2 + 8; k < w / 2; k += 10) { ctx.beginPath(); ctx.moveTo(k, -h / 2 + 4); ctx.lineTo(k, h / 2 - 4); ctx.stroke(); }
      ctx.restore();
    }
  }
}

function sea(ctx, r) {
  ctx.save();
  ctx.beginPath();
  smoothPath(ctx, COAST);
  ctx.lineTo(X(1.05), Y(1.05));
  ctx.closePath();
  ctx.fillStyle = C.sea;
  ctx.fill();
  ctx.clip();
  // 近岸浅水带
  ctx.beginPath(); smoothPath(ctx, COAST);
  ctx.strokeStyle = '#c3d6e0'; ctx.lineWidth = 46; ctx.stroke();
  ctx.strokeStyle = '#b5ccd9'; ctx.lineWidth = 22; ctx.stroke();
  // 小浪花
  ctx.strokeStyle = '#ffffff8c'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  for (let i = 0; i < 70; i++) {
    const x = X(0.6 + r() * 0.42), y = Y(0.45 + r() * 0.58);
    ctx.beginPath();
    ctx.arc(x, y, 9, Math.PI * 1.15, Math.PI * 1.85);
    ctx.arc(x + 15, y, 9, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }
  // 小岛
  ctx.beginPath();
  ctx.ellipse(X(0.88), Y(0.8), 70, 44, -0.3, 0, Math.PI * 2);
  ctx.fillStyle = C.field2; ctx.fill();
  ctx.strokeStyle = C.coast; ctx.lineWidth = 3; ctx.stroke();
  drawTree(ctx, X(0.875), Y(0.79), 1.1);
  drawTree(ctx, X(0.893), Y(0.81), 0.9);
  // 小帆船
  boat(ctx, X(0.78), Y(0.92));
  ctx.restore();
  ctx.beginPath(); smoothPath(ctx, COAST);
  ctx.strokeStyle = C.coast; ctx.lineWidth = 4; ctx.stroke();
}

function boat(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = C.roof;
  ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(34, 0); ctx.lineTo(24, 14); ctx.lineTo(-24, 14); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.wall;
  ctx.beginPath(); ctx.moveTo(-2, -4); ctx.lineTo(-2, -58); ctx.lineTo(26, -6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e9d4a0';
  ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(-6, -44); ctx.lineTo(-26, -6); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-4, -62); ctx.stroke();
  ctx.restore();
}

function river(ctx) {
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); smoothPath(ctx, RIVER);
  ctx.strokeStyle = C.coast; ctx.lineWidth = 26; ctx.stroke();
  ctx.strokeStyle = C.river; ctx.lineWidth = 20; ctx.stroke();
  ctx.strokeStyle = '#c4d8e3'; ctx.lineWidth = 5; ctx.setLineDash([24, 30]); ctx.stroke();
  ctx.setLineDash([]);
  // 湖
  ctx.beginPath();
  ctx.ellipse(X(LAKE.u), Y(LAKE.v), LAKE.ru * (MAP_W - INSET * 2), LAKE.rv * (MAP_H - INSET * 2), 0.3, 0, Math.PI * 2);
  ctx.fillStyle = C.sea; ctx.fill();
  ctx.strokeStyle = C.coast; ctx.lineWidth = 4; ctx.stroke();
  ctx.strokeStyle = '#ffffff80'; ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.arc(X(LAKE.u) - 30 + i * 30, Y(LAKE.v) - 10 + i * 18, 10, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
  }
  ctx.restore();
}

function mountains(ctx, r) {
  const peaks = [];
  for (let i = 0; i < 15; i++) peaks.push([0.5 + r() * 0.3, 0.08 + r() * 0.2, 0.8 + r() * 0.6]);
  peaks.sort((a, b) => a[1] - b[1]);
  for (const [u, v, s] of peaks) {
    const x = X(u), y = Y(v), w = 74 * s, h = 70 * s;
    ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x, y - h); ctx.lineTo(x + w, y); ctx.closePath();
    ctx.fillStyle = C.hill; ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + w, y); ctx.lineTo(x + w * 0.15, y); ctx.closePath();
    ctx.fillStyle = C.hillShade; ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - w * 0.3, y - h * 0.7); ctx.lineTo(x, y - h); ctx.lineTo(x + w * 0.3, y - h * 0.7);
    ctx.lineTo(x + w * 0.12, y - h * 0.62); ctx.lineTo(x - w * 0.05, y - h * 0.72); ctx.lineTo(x - w * 0.18, y - h * 0.62); ctx.closePath();
    ctx.fillStyle = C.snow; ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x, y - h); ctx.lineTo(x + w, y);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke();
  }
}

function drawTree(ctx, x, y, s = 1) {
  ctx.beginPath(); ctx.arc(x, y, 15 * s, 0, Math.PI * 2);
  ctx.fillStyle = C.tree; ctx.fill();
  ctx.beginPath(); ctx.arc(x + 4 * s, y + 4 * s, 10 * s, 0, Math.PI * 2);
  ctx.fillStyle = C.treeDark; ctx.globalAlpha = 0.45; ctx.fill(); ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.arc(x, y, 15 * s, 0, Math.PI * 2);
  ctx.strokeStyle = '#55663e'; ctx.lineWidth = 2; ctx.stroke();
}

function forests(ctx, r) {
  for (const f of FORESTS) {
    const n = Math.round(f.r * 520);
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * f.r;
      pts.push([f.u + Math.cos(a) * d * 0.66, f.v + Math.sin(a) * d]);
    }
    pts.sort((a, b) => a[1] - b[1]);
    for (const [u, v] of pts) drawTree(ctx, X(u), Y(v), 0.75 + r() * 0.5);
  }
}

function roads(ctx) {
  ctx.save();
  ctx.strokeStyle = C.road; ctx.lineWidth = 5; ctx.setLineDash([16, 12]); ctx.lineCap = 'round';
  for (const [a, b] of ROADS) {
    const p = TOWNS[a], q = TOWNS[b];
    const mx = (p.u + q.u) / 2 + (q.v - p.v) * 0.18, my = (p.v + q.v) / 2 - (q.u - p.u) * 0.18;
    ctx.beginPath(); ctx.moveTo(X(p.u), Y(p.v)); ctx.quadraticCurveTo(X(mx), Y(my), X(q.u), Y(q.v)); ctx.stroke();
  }
  ctx.restore();
}

function towns(ctx, r) {
  for (const t of TOWNS) {
    for (let i = 0; i < t.n; i++) {
      const x = X(t.u) + (r() - 0.5) * 90, y = Y(t.v) + (r() - 0.5) * 60;
      ctx.fillStyle = C.wall; ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5;
      ctx.fillRect(x - 16, y - 10, 32, 24); ctx.strokeRect(x - 16, y - 10, 32, 24);
      ctx.beginPath(); ctx.moveTo(x - 21, y - 9); ctx.lineTo(x, y - 30); ctx.lineTo(x + 21, y - 9); ctx.closePath();
      ctx.fillStyle = i % 3 === 1 ? C.sky : C.roof; ctx.fill(); ctx.stroke();
    }
  }
}

function compass(ctx) {
  const x = X(0.915), y = Y(0.17), R = 82;
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fillStyle = '#f6ecd5'; ctx.fill();
  ctx.strokeStyle = C.gold; ctx.lineWidth = 4; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, R - 12, 0, Math.PI * 2);
  ctx.strokeStyle = C.inkSoft; ctx.lineWidth = 1.5; ctx.stroke();
  const colors = [C.red, C.sky, C.green, C.yellow];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4, long = i % 2 === 0, len = long ? R - 6 : R * 0.55;
    ctx.save(); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(0, -len); ctx.lineTo(long ? 13 : 9, 0); ctx.lineTo(0, long ? 13 : 9); ctx.lineTo(long ? -13 : -9, 0); ctx.closePath();
    ctx.fillStyle = long ? colors[i / 2] : '#e7d8b6'; ctx.fill();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fillStyle = C.gold; ctx.fill();
  ctx.fillStyle = C.ink; ctx.font = '600 30px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('N', 0, -R - 24);
  ctx.restore();
}

function border(ctx) {
  // 外框：像木马顶棚的彩色饰边，四色轮换。
  const colors = [C.red, C.sky, C.green, C.yellow];
  const band = 16, o = 20;
  ctx.save();
  ctx.fillStyle = C.paperDeep;
  ctx.fillRect(0, 0, MAP_W, o); ctx.fillRect(0, MAP_H - o, MAP_W, o);
  ctx.fillRect(0, 0, o, MAP_H); ctx.fillRect(MAP_W - o, 0, o, MAP_H);
  const seg = 60;
  for (let x = o, i = 0; x < MAP_W - o; x += seg, i++) {
    ctx.fillStyle = colors[i % 4];
    ctx.fillRect(x, o, Math.min(seg, MAP_W - o - x), band);
    ctx.fillRect(x, MAP_H - o - band, Math.min(seg, MAP_W - o - x), band);
  }
  for (let y = o, i = 0; y < MAP_H - o; y += seg, i++) {
    ctx.fillStyle = colors[(i + 2) % 4];
    ctx.fillRect(o, y, band, Math.min(seg, MAP_H - o - y));
    ctx.fillRect(MAP_W - o - band, y, band, Math.min(seg, MAP_H - o - y));
  }
  ctx.strokeStyle = C.gold; ctx.lineWidth = 4;
  ctx.strokeRect(o, o, MAP_W - o * 2, MAP_H - o * 2);
  ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5;
  ctx.strokeRect(o + band + 2, o + band + 2, MAP_W - (o + band + 2) * 2, MAP_H - (o + band + 2) * 2);
  ctx.restore();
}

function cartouche(ctx, title, compact) {
  const w = compact ? 520 : 640, h = compact ? 130 : 160, x = X(0.02), y = Y(1) - h - 18;
  ctx.save();
  ctx.shadowColor = '#5a40281f'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 18);
  ctx.fillStyle = '#f8f0dc'; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = C.red; ctx.lineWidth = 4; ctx.stroke();
  ctx.beginPath(); ctx.roundRect(x + 10, y + 10, w - 20, h - 20, 12);
  ctx.strokeStyle = C.gold; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#5b4636'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${compact ? 54 : 66}px WenKai, "Songti SC", "Noto Serif CJK SC", serif`;
  ctx.fillText(title, x + w / 2, y + h * 0.44);
  ctx.font = `italic ${compact ? 22 : 26}px Georgia, serif`;
  ctx.fillStyle = C.inkSoft;
  ctx.fillText('the little map of where we have been', x + w / 2, y + h * 0.78);
  ctx.restore();
}

export const MAP_TITLE = '我们走过的地方';

async function fontsReady() {
  try { await document.fonts.load('66px WenKai', MAP_TITLE); } catch { /* 用备用字体 */ }
}

/** 画手绘默认底图。 */
export async function drawDefaultMap(canvas) {
  await fontsReady();
  canvas.width = MAP_W; canvas.height = MAP_H;
  const ctx = canvas.getContext('2d');
  const r = rng(20261101);
  paper(ctx, r);
  grid(ctx);
  fields(ctx, r);
  river(ctx);
  sea(ctx, r);
  roads(ctx);
  mountains(ctx, r);
  forests(ctx, r);
  towns(ctx, r);
  compass(ctx);
  border(ctx);
  cartouche(ctx, MAP_TITLE, false);
  return canvas;
}

/** 用户上传的地图图片：铺满（居中裁切），保留彩色饰边和标题，仍是“沙盘”的样子。 */
export async function drawCustomMap(canvas, image) {
  await fontsReady();
  canvas.width = MAP_W; canvas.height = MAP_H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, MAP_W, MAP_H);
  const iw = image.naturalWidth || image.width, ih = image.naturalHeight || image.height;
  const s = Math.max(MAP_W / iw, MAP_H / ih);
  ctx.drawImage(image, (MAP_W - iw * s) / 2, (MAP_H - ih * s) / 2, iw * s, ih * s);
  // 一层很淡的纸色，让照片地图和木马的色调更接近。
  ctx.fillStyle = '#efe3c61f';
  ctx.fillRect(0, 0, MAP_W, MAP_H);
  border(ctx);
  cartouche(ctx, MAP_TITLE, true);
  return canvas;
}

export const BOARD_INSET = INSET / MAP_W;

/** 归一化地图坐标 → 整张画布上的比例（0–1）。 */
export const toPlane = (u, v) => [(INSET + u * (MAP_W - INSET * 2)) / MAP_W, (INSET + v * (MAP_H - INSET * 2)) / MAP_H];
