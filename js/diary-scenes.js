// 日记下面的景色图。没有放照片时，用画布画一张安静的风景，再做一点胶片的颗粒和暗角，
// 像夹在日记本里的一张旧相片。每篇日记用固定的种子，所以每次打开看到的都是同一张。

const rand = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const lerp = (a, b, t) => a + (b - a) * t;

function vgrad(ctx, h, stops) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}
function glow(ctx, x, y, r, color, alpha = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}
// 一条起伏的山脊线，往下填满。
function ridge(ctx, w, h, R, base, amp, color, rough = 3) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  const f = [R() * 6, R() * 6, R() * 6];
  for (let x = 0; x <= w; x += 4) {
    const t = x / w;
    const y = base - amp * (0.55 * Math.sin(t * 2.3 + f[0]) + 0.3 * Math.sin(t * 5.1 + f[1]) + 0.15 * Math.sin(t * 11 * rough / 3 + f[2]));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
}
// 一根逐渐变细的笔触。
function stroke(ctx, pts, w0, w1, color) {
  ctx.fillStyle = color;
  for (let i = 0; i < pts.length; i++) {
    const t = i / (pts.length - 1);
    ctx.beginPath();
    ctx.arc(pts[i][0], pts[i][1], Math.max(0.35, lerp(w0, w1, t) / 2), 0, Math.PI * 2);
    ctx.fill();
  }
}
function bez(p0, p1, p2, n) {
  if (!n) n = Math.max(14, Math.ceil((Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + Math.hypot(p2[0] - p1[0], p2[1] - p1[1])) / 1.2));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]);
  }
  return out;
}
function cloud(ctx, R, cx, cy, size, light, shade) {
  const n = 9 + Math.floor(R() * 6);
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI;
      const x = cx + Math.cos(a) * size * (0.9 + R() * 0.4) * (R() < 0.5 ? -1 : 1) * R();
      const y = cy - Math.sin(a) * size * 0.45 * R();
      const r = size * (0.28 + R() * 0.3);
      const g = ctx.createRadialGradient(x - r * 0.2, y - r * 0.35, r * 0.1, x, y, r);
      g.addColorStop(0, pass ? light : shade);
      g.addColorStop(0.7, pass ? light : shade);
      g.addColorStop(1, (pass ? light : shade).replace(/[\d.]+\)$/, '0)'));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y + (pass ? 0 : r * 0.18), r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/* ---------- 十种景色 ---------- */
const SCENES = {
  // 冬天的枝桠和电线，背后是很深的青色天空（像日记本里那张）。
  branches(ctx, w, h, R, o) {
    ctx.fillStyle = vgrad(ctx, h, [[0, '#1f5466'], [0.55, '#2f6d7c'], [1, '#5b8f95']]);
    ctx.fillRect(0, 0, w, h);
    glow(ctx, w * 0.85, h * 0.1, w * 0.5, 'rgba(160,200,200,0.35)');
    // 电线
    ctx.strokeStyle = 'rgba(18,30,34,0.75)';
    for (let i = 0; i < 4; i++) {
      const y0 = h * (0.58 + i * 0.045 + R() * 0.02), sag = h * (0.015 + R() * 0.02);
      ctx.lineWidth = 1 + R() * 0.8;
      ctx.beginPath();
      ctx.moveTo(-10, y0 - sag * R());
      ctx.quadraticCurveTo(w / 2, y0 + sag, w + 10, y0 - sag * R());
      ctx.stroke();
    }
    // 树：从底部中央往上分枝
    const bark = '#5a4636', lit = '#8a6b52';
    const branch = (x, y, ang, len, wid, depth) => {
      const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
      const bend = (R() - 0.5) * len * 0.35;
      const cx = (x + x2) / 2 + Math.cos(ang + Math.PI / 2) * bend, cy = (y + y2) / 2 + Math.sin(ang + Math.PI / 2) * bend;
      const pts = bez([x, y], [cx, cy], [x2, y2], Math.max(8, Math.floor(len / 2)));
      stroke(ctx, pts, wid, wid * 0.62, bark);
      stroke(ctx, pts.map(([a, b]) => [a + wid * 0.18, b]), wid * 0.3, wid * 0.15, lit);
      if (depth <= 0 || wid < 0.9) return;
      const kids = depth > 4 ? 3 : 2 + (R() < 0.4 ? 1 : 0);
      for (let k = 0; k < kids; k++) {
        const spread = (k - (kids - 1) / 2) * (depth > 4 ? 0.62 : 0.45 + R() * 0.25);
        branch(x2, y2, ang + spread + (R() - 0.5) * 0.2, len * (0.68 + R() * 0.2), wid * 0.64, depth - 1);
      }
    };
    branch(w * 0.5, h + 10, -Math.PI / 2 + (R() - 0.5) * 0.1, h * 0.42, w * 0.045, 6);
    if (o.leaf) {
      // 一片正在落下的金色叶子
      ctx.save();
      ctx.translate(w * 0.7, h * 0.36);
      ctx.rotate(-0.6);
      ctx.fillStyle = '#e2b24c';
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.018, w * 0.009, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      glow(ctx, w * 0.7, h * 0.36, w * 0.03, 'rgba(255,220,140,0.5)');
    }
  },
  // 起雾的湖：远山一层比一层淡，水面有倒影。
  mist(ctx, w, h, R, o) {
    const warm = o.morning;
    ctx.fillStyle = vgrad(ctx, h, warm
      ? [[0, '#c9d3d2'], [0.55, '#e3e4dc'], [1, '#cfd8d6']]
      : [[0, '#9fb3b8'], [0.55, '#cbd5d3'], [1, '#aebfc1']]);
    ctx.fillRect(0, 0, w, h);
    if (warm) glow(ctx, w * 0.32, h * 0.42, w * 0.32, 'rgba(255,240,215,0.6)');
    const layers = [['rgba(120,145,150,0.35)', 0.5, 0.08], ['rgba(95,120,128,0.5)', 0.56, 0.06], ['rgba(70,95,104,0.7)', 0.6, 0.04]];
    for (const [c, b, a] of layers) ridge(ctx, w, h, R, h * b, h * a, c, 4);
    // 一小排树
    ctx.fillStyle = 'rgba(52,72,80,0.75)';
    for (let x = w * 0.05; x < w * 0.45; x += 6 + R() * 10) {
      const th = h * (0.03 + R() * 0.05);
      ctx.beginPath();
      ctx.moveTo(x - th * 0.25, h * 0.62);
      ctx.lineTo(x, h * 0.62 - th);
      ctx.lineTo(x + th * 0.25, h * 0.62);
      ctx.fill();
    }
    // 水面
    ctx.fillStyle = vgrad(ctx, h, [[0.62, 'rgba(150,170,174,0.95)'], [1, 'rgba(110,135,142,1)']]);
    ctx.fillRect(0, h * 0.62, w, h * 0.38);
    ctx.strokeStyle = 'rgba(230,236,232,0.35)';
    for (let i = 0; i < 26; i++) {
      const y = h * (0.64 + R() * 0.34), x = R() * w, len = w * (0.04 + R() * 0.16);
      ctx.lineWidth = 0.6 + R();
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
    }
    // 雾带
    for (let i = 0; i < 5; i++) {
      const y = h * (0.45 + R() * 0.25);
      const g = ctx.createLinearGradient(0, y - h * 0.08, 0, y + h * 0.08);
      g.addColorStop(0, 'rgba(240,242,238,0)'); g.addColorStop(0.5, 'rgba(240,242,238,0.45)'); g.addColorStop(1, 'rgba(240,242,238,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, y - h * 0.08, w, h * 0.16);
    }
    // 一只小船
    const bx = w * (0.6 + R() * 0.2), by = h * 0.74;
    ctx.fillStyle = 'rgba(40,52,58,0.8)';
    ctx.beginPath(); ctx.moveTo(bx - 16, by); ctx.quadraticCurveTo(bx, by + 6, bx + 16, by); ctx.closePath(); ctx.fill();
    ctx.fillRect(bx - 1, by - 14, 1.6, 14);
  },
  // 躺在树下往上看：树叶、阳光、光斑。
  canopy(ctx, w, h, R) {
    ctx.fillStyle = vgrad(ctx, h, [[0, '#cfe3d6'], [1, '#9fc3b4']]);
    ctx.fillRect(0, 0, w, h);
    glow(ctx, w * 0.62, h * 0.38, w * 0.45, 'rgba(255,250,225,0.9)');
    const greens = ['rgba(34,74,58,0.55)', 'rgba(52,98,72,0.5)', 'rgba(86,130,88,0.45)', 'rgba(24,58,48,0.6)'];
    for (let i = 0; i < 900; i++) {
      const a = R() * Math.PI * 2;
      const d = Math.pow(R(), 0.45);
      const x = w * 0.62 + Math.cos(a) * d * w * 0.75, y = h * 0.38 + Math.sin(a) * d * h * 0.95;
      if (d < 0.32) continue;
      ctx.fillStyle = greens[(R() * greens.length) | 0];
      ctx.save(); ctx.translate(x, y); ctx.rotate(R() * Math.PI);
      ctx.beginPath(); ctx.ellipse(0, 0, 4 + R() * 9, 2 + R() * 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // 树枝
    stroke(ctx, bez([-10, h * 0.9], [w * 0.25, h * 0.6], [w * 0.42, h * 0.08]), 10, 3, 'rgba(40,46,38,0.8)');
    stroke(ctx, bez([w * 0.25, h * 0.58], [w * 0.15, h * 0.3], [w * 0.05, h * 0.1]), 4, 1.5, 'rgba(40,46,38,0.75)');
    // 光斑
    for (let i = 0; i < 16; i++) {
      const x = w * 0.62 + (R() - 0.5) * w * 0.6, y = h * 0.38 + (R() - 0.5) * h * 0.7;
      glow(ctx, x, y, 6 + R() * 18, 'rgba(255,248,215,0.55)');
    }
  },
  // 雨天的水面：涟漪和斜斜的雨丝。
  rain(ctx, w, h, R, o) {
    const storm = o.storm;
    ctx.fillStyle = vgrad(ctx, h, storm
      ? [[0, '#46555e'], [0.5, '#6d7c82'], [1, '#55656c']]
      : [[0, '#7f9497'], [0.5, '#a9b8b7'], [1, '#7f9396']]);
    ctx.fillRect(0, 0, w, h);
    if (storm) glow(ctx, w * 0.75, h * 0.15, w * 0.35, 'rgba(230,236,240,0.35)');
    ridge(ctx, w, h, R, h * 0.42, h * 0.05, storm ? 'rgba(50,62,66,0.75)' : 'rgba(80,98,100,0.6)', 6);
    // 树丛
    ctx.fillStyle = storm ? 'rgba(38,50,52,0.85)' : 'rgba(60,78,78,0.75)';
    for (let i = 0; i < 40; i++) {
      const x = R() * w, r = 6 + R() * 16;
      ctx.beginPath(); ctx.arc(x, h * 0.46 - r * 0.4, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillRect(0, h * 0.44, w, h * 0.06);
    // 水面
    ctx.fillStyle = vgrad(ctx, h, [[0.5, storm ? '#5b6b71' : '#8fa2a3'], [1, storm ? '#3f4e55' : '#6f8487']]);
    ctx.fillRect(0, h * 0.5, w, h * 0.5);
    for (let i = 0; i < (o.soft ? 14 : 24); i++) {
      const x = R() * w, y = h * (0.53 + R() * 0.45), s = 0.5 + (y / h - 0.5) * 2.4;
      ctx.strokeStyle = `rgba(225,232,232,${0.18 + R() * 0.2})`;
      ctx.lineWidth = 0.8;
      for (let k = 1; k <= 3; k++) {
        ctx.beginPath(); ctx.ellipse(x, y, k * 6 * s, k * 1.8 * s, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }
    // 雨丝
    ctx.strokeStyle = 'rgba(232,238,240,0.32)';
    ctx.lineWidth = 0.8;
    const n = storm ? 260 : o.soft ? 90 : 160, slant = storm ? 0.28 : 0.12;
    for (let i = 0; i < n; i++) {
      const x = R() * w * 1.2, y = R() * h, len = 8 + R() * (storm ? 22 : 14);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - len * slant, y + len); ctx.stroke();
    }
  },
  // 草坡：可以是平静的白天、起风的黄昏、或者低低的太阳。
  grass(ctx, w, h, R, o) {
    const dusk = o.dusk, sun = o.sun;
    ctx.fillStyle = vgrad(ctx, h, dusk
      ? [[0, '#6d7f99'], [0.45, '#c9b5a6'], [0.62, '#e8cba8']]
      : sun ? [[0, '#8fb4c4'], [0.5, '#d9dfcf'], [0.62, '#efe3c4']]
        : [[0, '#a9c6cc'], [0.6, '#dfe6dc']]);
    ctx.fillRect(0, 0, w, h);
    if (sun || dusk) {
      glow(ctx, w * 0.72, h * 0.5, w * 0.4, dusk ? 'rgba(255,214,170,0.75)' : 'rgba(255,244,214,0.85)');
      ctx.fillStyle = dusk ? 'rgba(255,226,190,0.95)' : 'rgba(255,250,232,0.95)';
      ctx.beginPath(); ctx.arc(w * 0.72, h * 0.5, w * 0.03, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 3; i++) cloud(ctx, R, w * (0.15 + R() * 0.7), h * (0.12 + R() * 0.2), w * (0.08 + R() * 0.06), 'rgba(250,248,244,0.55)', 'rgba(190,196,204,0.35)');
    ridge(ctx, w, h, R, h * 0.6, h * 0.04, dusk ? 'rgba(96,104,98,0.75)' : 'rgba(118,146,128,0.7)', 2);
    ctx.fillStyle = vgrad(ctx, h, dusk
      ? [[0.58, '#6f7462'], [1, '#3f4a3c']]
      : [[0.58, '#8fae8a'], [1, '#56785a']]);
    ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 6) ctx.lineTo(x, h * 0.66 - Math.sin(x / w * Math.PI) * h * 0.04);
    ctx.lineTo(w, h); ctx.fill();
    // 草叶
    const lean = o.wind ? 0.55 : 0.12;
    for (let i = 0; i < 520; i++) {
      const x = R() * w * 1.1 - w * 0.05, y = h * (0.66 + Math.pow(R(), 0.6) * 0.36);
      const len = (h * 0.05 + R() * h * 0.12) * (0.4 + (y / h - 0.6) * 1.6);
      const lw = lean * (0.7 + R() * 0.6);
      const c = dusk ? `rgba(${40 + R() * 40},${48 + R() * 40},${36 + R() * 24},0.8)` : `rgba(${50 + R() * 50},${92 + R() * 50},${60 + R() * 30},0.75)`;
      stroke(ctx, bez([x, y], [x + len * lw * 0.3, y - len * 0.6], [x + len * lw, y - len]), 2.2, 0.4, c);
    }
    if (o.wind) {
      ctx.fillStyle = dusk ? 'rgba(210,170,120,0.8)' : 'rgba(120,150,90,0.8)';
      for (let i = 0; i < 9; i++) {
        ctx.save(); ctx.translate(R() * w, h * (0.15 + R() * 0.45)); ctx.rotate(R() * 3);
        ctx.beginPath(); ctx.ellipse(0, 0, 4, 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
    }
    if (o.calm) for (let i = 0; i < 18; i++) {
      ctx.fillStyle = R() < 0.5 ? 'rgba(250,248,236,0.9)' : 'rgba(240,214,120,0.9)';
      ctx.beginPath(); ctx.arc(R() * w, h * (0.72 + R() * 0.26), 1.4 + R() * 1.6, 0, Math.PI * 2); ctx.fill();
    }
  },
  // 夏夜的树林和萤火虫。
  fireflies(ctx, w, h, R) {
    ctx.fillStyle = vgrad(ctx, h, [[0, '#0e2430'], [0.6, '#1d3d45'], [1, '#132a2c']]);
    ctx.fillRect(0, 0, w, h);
    glow(ctx, w * 0.5, h * 0.75, w * 0.6, 'rgba(70,110,100,0.35)');
    for (let i = 0; i < 9; i++) {
      const x = R() * w, tw = 6 + R() * 14;
      ctx.fillStyle = `rgba(8,20,22,${0.6 + R() * 0.35})`;
      ctx.fillRect(x, 0, tw, h);
      for (let k = 0; k < 14; k++) {
        ctx.beginPath(); ctx.arc(x + (R() - 0.5) * 90, R() * h * 0.45, 12 + R() * 30, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.fillStyle = 'rgba(10,26,24,0.9)';
    ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 5) ctx.lineTo(x, h * 0.84 + Math.sin(x * 0.05) * 3 - R() * 9);
    ctx.lineTo(w, h); ctx.fill();
    for (let i = 0; i < 46; i++) {
      const x = R() * w, y = h * (0.25 + R() * 0.65), r = 1 + R() * 1.6;
      glow(ctx, x, y, r * 9, 'rgba(214,240,140,0.4)');
      ctx.fillStyle = 'rgba(244,255,200,0.95)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  },
  // 雨后彩虹，淡淡的。
  rainbow(ctx, w, h, R) {
    ctx.fillStyle = vgrad(ctx, h, [[0, '#8fa9b6'], [0.6, '#d7dfda'], [1, '#c4d2c6']]);
    ctx.fillRect(0, 0, w, h);
    glow(ctx, w * 0.25, h * 0.2, w * 0.45, 'rgba(255,250,236,0.6)');
    const cols = ['rgba(214,96,96,', 'rgba(226,160,90,', 'rgba(226,212,110,', 'rgba(120,180,120,', 'rgba(100,140,200,', 'rgba(140,110,180,'];
    const cx = w * 0.62, cy = h * 0.95, r0 = w * 0.42;
    cols.forEach((c, i) => {
      ctx.strokeStyle = c + '0.22)';
      ctx.lineWidth = w * 0.012;
      ctx.beginPath(); ctx.arc(cx, cy, r0 - i * w * 0.011, Math.PI * 1.05, Math.PI * 1.85); ctx.stroke();
    });
    cloud(ctx, R, w * 0.2, h * 0.3, w * 0.14, 'rgba(246,246,242,0.7)', 'rgba(170,182,190,0.4)');
    ridge(ctx, w, h, R, h * 0.68, h * 0.05, 'rgba(110,140,128,0.7)', 2);
    ridge(ctx, w, h, R, h * 0.78, h * 0.06, 'rgba(84,120,96,0.85)', 2);
    ctx.fillStyle = 'rgba(60,90,70,0.9)';
    ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 6) ctx.lineTo(x, h * 0.88 + Math.sin(x / w * 4) * h * 0.02);
    ctx.lineTo(w, h); ctx.fill();
    // 一棵孤零零的树
    const tx = w * 0.14, ty = h * 0.78;
    stroke(ctx, bez([tx, ty], [tx + 2, ty - 18], [tx, ty - 34]), 4, 2, 'rgba(50,60,52,0.9)');
    ctx.fillStyle = 'rgba(56,86,66,0.95)';
    for (let k = 0; k < 10; k++) { ctx.beginPath(); ctx.arc(tx + (R() - 0.5) * 30, ty - 38 + (R() - 0.5) * 20, 8 + R() * 8, 0, Math.PI * 2); ctx.fill(); }
  },
  // 大朵大朵的云，地平线很低。
  clouds(ctx, w, h, R, o) {
    const bright = o.bright;
    ctx.fillStyle = vgrad(ctx, h, bright ? [[0, '#4f8fb6'], [0.75, '#bcd6df']] : [[0, '#7d93a3'], [0.75, '#c9d1d2']]);
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) {
      cloud(ctx, R, w * (0.1 + i * 0.27 + R() * 0.08), h * (0.35 + R() * 0.25), w * (0.14 + R() * 0.08),
        bright ? 'rgba(255,255,252,0.85)' : 'rgba(236,238,236,0.75)', bright ? 'rgba(160,184,204,0.5)' : 'rgba(140,152,160,0.5)');
    }
    ctx.fillStyle = bright ? 'rgba(72,110,90,0.95)' : 'rgba(80,96,96,0.95)';
    ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 3) ctx.lineTo(x, h * 0.88 - (R() < 0.12 ? R() * h * 0.05 : R() * 4));
    ctx.lineTo(w, h); ctx.fill();
    if (bright) glow(ctx, w * 0.85, h * 0.1, w * 0.25, 'rgba(255,252,236,0.6)');
  },
  // 星空和山坡上的一棵树。
  stars(ctx, w, h, R) {
    ctx.fillStyle = vgrad(ctx, h, [[0, '#0b1630'], [0.7, '#1c2f4f'], [1, '#2c3f58']]);
    ctx.fillRect(0, 0, w, h);
    // 银河
    ctx.save(); ctx.translate(w * 0.5, h * 0.45); ctx.rotate(-0.5);
    for (let i = 0; i < 260; i++) {
      const x = (R() - 0.5) * w * 1.3, y = (R() + R() + R() - 1.5) * h * 0.14;
      glow(ctx, x, y, 8 + R() * 22, 'rgba(170,190,230,0.06)');
    }
    ctx.restore();
    for (let i = 0; i < 420; i++) {
      const x = R() * w, y = R() * h * 0.85, r = R() < 0.95 ? 0.4 + R() * 0.8 : 1.2 + R();
      ctx.fillStyle = `rgba(240,244,255,${0.35 + R() * 0.6})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      if (r > 1.3) glow(ctx, x, y, r * 6, 'rgba(220,230,255,0.35)');
    }
    // 小象星座
    const star = [[0.22, 0.2], [0.27, 0.17], [0.31, 0.2], [0.33, 0.27], [0.36, 0.31], [0.27, 0.27], [0.21, 0.27]];
    ctx.strokeStyle = 'rgba(220,230,255,0.22)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); star.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h))); ctx.closePath(); ctx.stroke();
    for (const [x, y] of star) { glow(ctx, x * w, y * h, 7, 'rgba(255,245,215,0.7)'); ctx.fillStyle = '#fffbe8'; ctx.beginPath(); ctx.arc(x * w, y * h, 1.4, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#0a1222';
    ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 4) ctx.lineTo(x, h * 0.86 - Math.sin(x / w * Math.PI) * h * 0.1);
    ctx.lineTo(w, h); ctx.fill();
    const tx = w * 0.62, ty = h * 0.77;
    stroke(ctx, bez([tx, ty + 4], [tx + 2, ty - 20], [tx - 1, ty - 40]), 5, 2, '#0a1222');
    for (let k = 0; k < 12; k++) { ctx.beginPath(); ctx.arc(tx + (R() - 0.5) * 36, ty - 46 + (R() - 0.5) * 22, 7 + R() * 8, 0, Math.PI * 2); ctx.fill(); }
  },
  // 弯月、薄云和水面上的月光。
  moon(ctx, w, h, R) {
    ctx.fillStyle = vgrad(ctx, h, [[0, '#14294a'], [0.6, '#2c4a6c'], [1, '#1b3049']]);
    ctx.fillRect(0, 0, w, h);
    const mx = w * 0.3, my = h * 0.3, mr = w * 0.05;
    ctx.fillStyle = '#f6efd6';
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = vgrad(ctx, h, [[0, '#14294a'], [0.6, '#2c4a6c'], [1, '#1b3049']]);
    ctx.beginPath(); ctx.arc(mx + mr * 0.45, my - mr * 0.25, mr * 0.9, 0, Math.PI * 2); ctx.fill();
    glow(ctx, mx, my, mr * 7, 'rgba(210,225,245,0.22)');
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = `rgba(235,240,255,${0.3 + R() * 0.5})`;
      ctx.beginPath(); ctx.arc(R() * w, R() * h * 0.6, 0.4 + R() * 0.7, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 3; i++) {
      const y = h * (0.18 + R() * 0.3);
      ctx.fillStyle = 'rgba(160,180,210,0.12)';
      ctx.beginPath(); ctx.ellipse(w * (0.3 + R() * 0.6), y, w * (0.18 + R() * 0.15), h * 0.025, 0, 0, Math.PI * 2); ctx.fill();
    }
    ridge(ctx, w, h, R, h * 0.62, h * 0.05, '#13233a', 3);
    ctx.fillStyle = vgrad(ctx, h, [[0.64, '#223a58'], [1, '#14243a']]);
    ctx.fillRect(0, h * 0.64, w, h * 0.36);
    for (let i = 0; i < 22; i++) {
      const y = h * (0.66 + i * 0.015), len = w * (0.02 + R() * 0.05) * (1 + i * 0.05);
      ctx.fillStyle = `rgba(246,239,214,${0.5 - i * 0.018})`;
      ctx.fillRect(mx - len / 2 + (R() - 0.5) * 10, y, len, 1.2);
    }
    // 右边的树影
    ctx.fillStyle = '#0d182a';
    stroke(ctx, bez([w * 0.9, h * 0.66], [w * 0.88, h * 0.4], [w * 0.92, h * 0.1]), 9, 3, '#0d182a');
    for (let k = 0; k < 26; k++) { ctx.beginPath(); ctx.arc(w * 0.9 + (R() - 0.3) * 80, h * (0.08 + R() * 0.32), 10 + R() * 14, 0, Math.PI * 2); ctx.fill(); }
  },
};

// 胶片感：轻微褪色、颗粒、暗角。
function finish(ctx, w, h, R) {
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = 'rgba(40,110,120,0.22)';
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(230,236,230,0.06)';
  ctx.fillRect(0, 0, w, h);
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,20,24,0.38)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  const img = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (R() - 0.5) * 22;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

export function paintScene(canvas, scene, seed, opts = {}) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const R = rand(seed);
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  (SCENES[scene] || SCENES.clouds)(ctx, w, h, R, opts);
  ctx.restore();
  finish(ctx, w, h, rand(seed * 7 + 3));
}
