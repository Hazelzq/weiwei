// 第四页的书房：用 WebGL 画出来（不依赖任何库），有真正的光照和阴影。
// 绿灯罩台灯是立体模型（车削出来的铜底座、弯杆、玻璃灯罩、拉链），台灯就是光源，桌上和墙上的光都是它照出来的；
// 书桌是带抽屉柜的老式写字台。手账本还是网页元素，叠在这层画布上面，镜头和这里的完全对齐。
//
// 坐标：单位 u（手账一页宽 500u），y 朝上，桌面在 y = 0。网页那层的坐标 y 朝下，所以换算时 y 取反。

/* ---------- 4×4 矩阵（列主序，和 WebGL 一致） ---------- */
const M = {
  id: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
  mul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
    return o;
  },
  t(x, y, z) { const m = M.id(); m[12] = x; m[13] = y; m[14] = z; return m; },
  s(x, y = x, z = x) { const m = M.id(); m[0] = x; m[5] = y; m[10] = z; return m; },
  rx(a) { const c = Math.cos(a), s = Math.sin(a), m = M.id(); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; },
  ry(a) { const c = Math.cos(a), s = Math.sin(a), m = M.id(); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; },
  rz(a) { const c = Math.cos(a), s = Math.sin(a), m = M.id(); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; },
  persp(fovy, asp, n, f) {
    const t = 1 / Math.tan(fovy / 2), m = new Float32Array(16);
    m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = (2 * f * n) / (n - f);
    return m;
  },
  lookAt(e, c, up) {
    const z = norm([e[0] - c[0], e[1] - c[1], e[2] - c[2]]), x = norm(cross(up, z)), y = cross(z, x);
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0,
      -dot(x, e), -dot(y, e), -dot(z, e), 1]);
  },
  chain(...ms) { return ms.reduce((a, b) => M.mul(a, b)); },
  apply(m, p) {
    const x = p[0], y = p[1], z = p[2];
    const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w, (m[2] * x + m[6] * y + m[10] * z + m[14]) / w, w];
  },
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/* ---------- 几何体 ---------- */
class Geo {
  constructor() { this.p = []; this.n = []; this.uv = []; this.i = []; }
  v(p, n, uv) { this.p.push(...p); this.n.push(...n); this.uv.push(...uv); return this.p.length / 3 - 1; }
  quad(a, b, c, d, n, uvs = [[0, 0], [1, 0], [1, 1], [0, 1]]) {
    const i0 = this.v(a, n, uvs[0]), i1 = this.v(b, n, uvs[1]), i2 = this.v(c, n, uvs[2]), i3 = this.v(d, n, uvs[3]);
    this.i.push(i0, i1, i2, i0, i2, i3);
    return this;
  }
  // 盒子：tile 不为 0 时，贴图按实际尺寸平铺（木纹不会被拉伸）
  box(cx, cy, cz, w, h, d, tile = 0) {
    const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    const U = (a, b) => (tile ? [[0, 0], [a / tile, 0], [a / tile, b / tile], [0, b / tile]] : undefined);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], U(w, h));
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], U(w, h));
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], U(d, h));
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], U(d, h));
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], U(w, d));
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], U(w, d));
    return this;
  }
  // 车削：profile 是 [半径, 高度]，从下往上；同一个点写两次就是一道硬边
  lathe(profile, seg = 96, c = [0, 0, 0]) {
    const base = this.p.length / 3, rows = profile.length;
    for (let k = 0; k < rows; k++) {
      const prev = profile[Math.max(0, k - 1)], next = profile[Math.min(rows - 1, k + 1)];
      let tr = next[0] - prev[0], ty = next[1] - prev[1];
      if (k > 0 && k < rows - 1 && profile[k][0] === prev[0] && profile[k][1] === prev[1]) { tr = next[0] - profile[k][0]; ty = next[1] - profile[k][1]; }
      if (k > 0 && k < rows - 1 && profile[k][0] === next[0] && profile[k][1] === next[1]) { tr = profile[k][0] - prev[0]; ty = profile[k][1] - prev[1]; }
      const nl = Math.hypot(tr, ty) || 1, nr = ty / nl, ny = -tr / nl;
      for (let s = 0; s <= seg; s++) {
        const a = (s / seg) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        this.v([c[0] + profile[k][0] * ca, c[1] + profile[k][1], c[2] + profile[k][0] * sa], [nr * ca, ny, nr * sa], [s / seg, k / (rows - 1)]);
      }
    }
    for (let k = 0; k < rows - 1; k++) for (let s = 0; s < seg; s++) {
      const a = base + k * (seg + 1) + s, b = a + seg + 1;
      this.i.push(a, b, a + 1, a + 1, b, b + 1);
    }
    return this;
  }
  sphere(c, r, seg = 32) {
    const prof = [];
    for (let k = 0; k <= seg / 2; k++) { const t = -Math.PI / 2 + (k / (seg / 2)) * Math.PI; prof.push([Math.cos(t) * r + 1e-4, Math.sin(t) * r]); }
    return this.lathe(prof, seg, c);
  }
  // 沿一条折线扫出一根管子（台灯的弯杆）
  tube(path, r, seg = 24) {
    const base = this.p.length / 3;
    for (let k = 0; k < path.length; k++) {
      const a = path[Math.max(0, k - 1)], b = path[Math.min(path.length - 1, k + 1)];
      const t = norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
      const helper = Math.abs(t[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1];
      const u = norm(cross(t, helper)), w = cross(t, u);
      for (let s = 0; s <= seg; s++) {
        const ang = (s / seg) * Math.PI * 2, n = [u[0] * Math.cos(ang) + w[0] * Math.sin(ang), u[1] * Math.cos(ang) + w[1] * Math.sin(ang), u[2] * Math.cos(ang) + w[2] * Math.sin(ang)];
        this.v([path[k][0] + n[0] * r, path[k][1] + n[1] * r, path[k][2] + n[2] * r], n, [s / seg, k / (path.length - 1)]);
      }
    }
    for (let k = 0; k < path.length - 1; k++) for (let s = 0; s < seg; s++) {
      const a = base + k * (seg + 1) + s, b = a + seg + 1;
      this.i.push(a, a + 1, b, a + 1, b + 1, b);
    }
    return this;
  }
  // 把二维轮廓（在 zy 平面里，开口的一条线）沿 x 拉长成一张曲面
  extrudeX(profile, x0, x1) {
    const base = this.p.length / 3, n = profile.length;
    for (let k = 0; k < n; k++) {
      const a = profile[Math.max(0, k - 1)], b = profile[Math.min(n - 1, k + 1)];
      const dz = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dz, dy) || 1;
      const nor = [0, -dz / l, dy / l];
      this.v([x0, profile[k][1], profile[k][0]], nor, [0, k / (n - 1)]);
      this.v([x1, profile[k][1], profile[k][0]], nor, [1, k / (n - 1)]);
    }
    for (let k = 0; k < n - 1; k++) { const a = base + k * 2; this.i.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    return this;
  }
  // 参数曲面：fn(u, v) → [x, y, z]，u、v 都在 0~1；法线用差分算（裱花、草莓这类不规则的小东西）
  param(fn, nu, nv) {
    const base = this.p.length / 3, e = 1e-3;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const u = i / nu, v = j / nv, p = fn(u, v);
      const pu = fn(Math.min(1, u + e), v), pu0 = fn(Math.max(0, u - e), v);
      const pv = fn(u, Math.min(1, v + e)), pv0 = fn(u, Math.max(0, v - e));
      const du = [pu[0] - pu0[0], pu[1] - pu0[1], pu[2] - pu0[2]], dv = [pv[0] - pv0[0], pv[1] - pv0[1], pv[2] - pv0[2]];
      let n = cross(dv, du);
      if (Math.hypot(...n) < 1e-9) n = [p[0], p[1] - (fn(u, 0.5)[1]), p[2]];
      this.v(p, norm(n), [u, v]);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = base + j * (nu + 1) + i, b = a + nu + 1;
      this.i.push(a, b, a + 1, a + 1, b, b + 1);
    }
    return this;
  }
  // 凸多边形的扇形面（x 固定）
  fanX(profile, x, nx) {
    const cz = profile.reduce((s, p) => s + p[0], 0) / profile.length, cy = profile.reduce((s, p) => s + p[1], 0) / profile.length;
    const c = this.v([x, cy, cz], [nx, 0, 0], [0.5, 0.5]);
    const ids = profile.map((p) => this.v([x, p[1], p[0]], [nx, 0, 0], [0.5, 0.5]));
    for (let k = 0; k < ids.length; k++) { const a = ids[k], b = ids[(k + 1) % ids.length]; if (nx > 0) this.i.push(c, b, a); else this.i.push(c, a, b); }
    return this;
  }
  // 拱形的盒子（收音机）：轮廓在 xy 平面，沿 z 拉出厚度
  extrudeZ(poly, z0, z1, tile = 0) {
    const n = poly.length;
    for (let k = 0; k < n; k++) {
      const a = poly[k], b = poly[(k + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      const nor = [dy / l, -dx / l, 0];
      const uv = tile ? [[0, 0], [l / tile, 0], [l / tile, (z1 - z0) / tile], [0, (z1 - z0) / tile]] : undefined;
      this.quad([a[0], a[1], z1], [b[0], b[1], z1], [b[0], b[1], z0], [a[0], a[1], z0], nor, uv);
    }
    for (const [z, nz] of [[z1, 1], [z0, -1]]) {
      const cx = poly.reduce((s, p) => s + p[0], 0) / n, cy = poly.reduce((s, p) => s + p[1], 0) / n;
      const minX = Math.min(...poly.map((p) => p[0])), maxX = Math.max(...poly.map((p) => p[0])), minY = Math.min(...poly.map((p) => p[1])), maxY = Math.max(...poly.map((p) => p[1]));
      const uvOf = (p) => [(p[0] - minX) / (maxX - minX), (p[1] - minY) / (maxY - minY)];
      const c = this.v([cx, cy, z], [0, 0, nz], uvOf([cx, cy]));
      const ids = poly.map((p) => this.v([p[0], p[1], z], [0, 0, nz], uvOf(p)));
      for (let k = 0; k < n; k++) { const a = ids[k], b = ids[(k + 1) % n]; if (nz > 0) this.i.push(c, b, a); else this.i.push(c, a, b); }
    }
    return this;
  }
}

/* ---------- 画在 canvas 上的贴图 ---------- */
function cv(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
function grain(c, w, h, n, a) { for (let i = 0; i < n; i++) { c.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${rnd() * a})`; c.fillRect(rnd() * w, rnd() * h, 1.5, 1.5); } }

const TEX = {
  wall: () => cv(512, 1024, (c, w, h) => {
    // 上面是深绿条纹墙纸，下面是木护墙板，中间一道腰线
    const g = c.createLinearGradient(0, 0, 0, h * 0.62);
    g.addColorStop(0, '#0d1411'); g.addColorStop(0.35, '#1b2a22'); g.addColorStop(1, '#22342a');
    c.fillStyle = g; c.fillRect(0, 0, w, h * 0.62);
    for (let x = 0; x < w; x += 32) { c.fillStyle = 'rgba(255,255,255,.035)'; c.fillRect(x, 0, 3, h * 0.62); c.fillStyle = 'rgba(0,0,0,.08)'; c.fillRect(x + 16, 0, 1, h * 0.62); }
    for (let y = 40; y < h * 0.6; y += 64) for (let x = 16; x < w; x += 64) { c.fillStyle = 'rgba(200,190,140,.05)'; c.beginPath(); c.arc(x + ((y / 64) % 2) * 32, y, 5, 0, 7); c.fill(); }
    grain(c, w, h * 0.62, 3000, 0.05);
    c.fillStyle = '#3c2616'; c.fillRect(0, h * 0.615, w, h * 0.03);
    c.fillStyle = '#5a3a22'; c.fillRect(0, h * 0.62, w, h * 0.008);
    const wg = c.createLinearGradient(0, h * 0.645, 0, h); wg.addColorStop(0, '#2e1d11'); wg.addColorStop(1, '#22150c');
    c.fillStyle = wg; c.fillRect(0, h * 0.645, w, h * 0.355);
    for (let x = 0; x < w; x += 256) { // 护墙板的方框
      c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 6; c.strokeRect(x + 24, h * 0.68, 208, h * 0.27);
      c.strokeStyle = 'rgba(120,80,45,.35)'; c.lineWidth = 2; c.strokeRect(x + 30, h * 0.686, 196, h * 0.258);
    }
    for (let i = 0; i < 400; i++) { c.strokeStyle = `rgba(0,0,0,${rnd() * 0.12})`; c.beginPath(); const y = h * 0.65 + rnd() * h * 0.35; c.moveTo(0, y); c.lineTo(w, y + (rnd() - 0.5) * 6); c.stroke(); }
    c.fillStyle = '#1a0f08'; c.fillRect(0, h * 0.97, w, h * 0.03);
  }),
  floor: () => cv(512, 512, (c, w, h) => {
    for (let y = 0; y < h; y += 64) {
      c.fillStyle = `hsl(24 ${35 + rnd() * 10}% ${13 + rnd() * 6}%)`; c.fillRect(0, y, w, 64);
      for (let i = 0; i < 26; i++) { c.strokeStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '160,110,70'},${0.06 + rnd() * 0.1})`; c.beginPath(); const yy = y + rnd() * 64; c.moveTo(0, yy); c.bezierCurveTo(w / 3, yy + 3, (2 * w) / 3, yy - 3, w, yy + (rnd() - 0.5) * 4); c.stroke(); }
      c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(0, y, w, 2);
      const x = rnd() * w; c.fillRect(x, y, 2, 64);
    }
  }),
  leather: () => cv(256, 256, (c, w, h) => {
    c.fillStyle = '#25412f'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) { const g = c.createRadialGradient(rnd() * w, rnd() * h, 0, rnd() * w, rnd() * h, 20 + rnd() * 50); g.addColorStop(0, `rgba(${rnd() < 0.5 ? '0,0,0' : '90,130,100'},.08)`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }
    grain(c, w, h, 4000, 0.08);
  }),
  brownLeather: () => cv(128, 128, (c, w, h) => { c.fillStyle = '#4a2d18'; c.fillRect(0, 0, w, h); grain(c, w, h, 1500, 0.12); }),
  windowNight: () => cv(512, 400, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#162238'); g.addColorStop(1, '#2c4466');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(255,255,240,${rnd() * 0.7})`; c.fillRect(rnd() * w, rnd() * h * 0.6, 1.5, 1.5); }
    const m = c.createRadialGradient(340, 90, 0, 340, 90, 120); m.addColorStop(0, 'rgba(255,253,235,1)'); m.addColorStop(0.18, 'rgba(240,240,220,1)'); m.addColorStop(0.22, 'rgba(200,215,240,.45)'); m.addColorStop(1, 'rgba(200,215,240,0)');
    c.fillStyle = m; c.fillRect(0, 0, w, h);
    c.fillStyle = '#0b111b'; // 远处的屋顶
    c.beginPath(); c.moveTo(0, h); c.lineTo(0, 300); c.lineTo(60, 290); c.lineTo(90, 260); c.lineTo(150, 262); c.lineTo(170, 300); c.lineTo(250, 296); c.lineTo(270, 240); c.lineTo(285, 240); c.lineTo(300, 290); c.lineTo(400, 286); c.lineTo(430, 270); c.lineTo(512, 272); c.lineTo(512, h); c.fill();
    for (let i = 0; i < 6; i++) { c.fillStyle = 'rgba(255,200,120,.6)'; c.fillRect(40 + rnd() * 440, 310 + rnd() * 60, 6, 8); }
  }),
  calendar: () => cv(256, 340, (c, w, h) => {
    c.fillStyle = '#e8dcc0'; c.fillRect(0, 0, w, h); grain(c, w, h, 800, 0.08);
    c.fillStyle = '#a8281c'; c.font = '700 22px serif'; c.textAlign = 'center'; c.fillText('民国三十五年', w / 2, 44);
    c.fillStyle = '#2a1f14'; c.font = '900 170px serif'; c.fillText('十', w / 2, 230);
    c.font = '30px serif'; c.fillText('月', w / 2, 300);
  }),
  clock: () => cv(256, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#20140b'; c.beginPath(); c.arc(128, 128, 126, 0, 7); c.fill();
    c.fillStyle = '#4a301c'; c.beginPath(); c.arc(128, 128, 112, 0, 7); c.fill();
    c.fillStyle = '#efe6cf'; c.beginPath(); c.arc(128, 128, 96, 0, 7); c.fill();
    c.fillStyle = '#2a1f14'; for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; c.fillRect(128 + Math.cos(a) * 82 - 3, 128 + Math.sin(a) * 82 - 3, 6, 6); }
    c.strokeStyle = '#1c120a'; c.lineCap = 'round'; c.lineWidth = 7; c.beginPath(); c.moveTo(128, 128); c.lineTo(128 + Math.cos(-2.6) * 46, 128 + Math.sin(-2.6) * 46); c.stroke();
    c.lineWidth = 4; c.beginPath(); c.moveTo(128, 128); c.lineTo(128 + Math.cos(1.0) * 72, 128 + Math.sin(1.0) * 72); c.stroke();
  }),
  photo: () => cv(320, 240, (c, w, h) => {
    c.fillStyle = '#3a2617'; c.fillRect(0, 0, w, h);
    const g = c.createLinearGradient(0, 20, 0, h - 20); g.addColorStop(0, '#9c9480'); g.addColorStop(1, '#5d5848'); c.fillStyle = g; c.fillRect(20, 20, w - 40, h - 40);
    c.fillStyle = 'rgba(40,36,28,.7)'; c.beginPath(); c.moveTo(20, 170); c.quadraticCurveTo(110, 110, 180, 150); c.quadraticCurveTo(240, 120, 300, 160); c.lineTo(300, 220); c.lineTo(20, 220); c.fill();
  }),
  books: () => cv(512, 512, (c, w, h) => {
    c.fillStyle = '#1e130b'; c.fillRect(0, 0, w, h);
    for (let row = 0; row < 3; row++) {
      const y0 = 14 + row * 166; let x = 12;
      while (x < w - 20) {
        const bw = 14 + rnd() * 22, bh = 110 + rnd() * 40;
        c.fillStyle = `hsl(${[0, 20, 200, 120, 35][Math.floor(rnd() * 5)]} ${30 + rnd() * 30}% ${16 + rnd() * 18}%)`;
        c.fillRect(x, y0 + 150 - bh, bw, bh);
        c.fillStyle = 'rgba(230,200,120,.35)'; c.fillRect(x + 2, y0 + 150 - bh + 14, bw - 4, 3); c.fillRect(x + 2, y0 + 150 - 22, bw - 4, 2);
        x += bw + 2;
      }
      c.fillStyle = '#3c2616'; c.fillRect(0, y0 + 150, w, 16);
    }
  }),
  door: () => cv(256, 512, (c, w, h) => {
    c.fillStyle = '#33200f'; c.fillRect(0, 0, w, h); grain(c, w, h, 1500, 0.06);
    for (const [y, hh] of [[40, 190], [270, 200]]) { c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(40, y, w - 80, hh); c.fillStyle = '#3a2513'; c.fillRect(48, y + 8, w - 96, hh - 16); }
  }),
  grille: () => cv(256, 320, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.save(); c.beginPath(); c.moveTo(30, h - 70); c.lineTo(30, 128); c.arc(128, 128, 98, Math.PI, 0); c.lineTo(226, h - 70); c.closePath(); c.clip();
    c.fillStyle = '#6e5b40'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) { c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, y, w, 1); }
    for (let x = 0; x < w; x += 3) { c.fillStyle = 'rgba(255,240,200,.06)'; c.fillRect(x, 0, 1, h); }
    c.fillStyle = '#3a1f10'; for (const x of [88, 124, 160]) c.fillRect(x, 0, 10, h);
    c.restore();
    c.fillStyle = '#d6a64a'; c.fillRect(64, h - 52, 128, 26); // 刻度窗
    c.fillStyle = '#5b3a14'; for (let x = 72; x < 186; x += 8) c.fillRect(x, h - 44, 1, 10);
  }),
  slip: () => cv(256, 128, (c, w, h) => {
    c.fillStyle = '#ece2c6'; c.fillRect(0, 0, w, h); grain(c, w, h, 600, 0.08);
    c.fillStyle = '#2f2a22'; c.font = '30px "Kaiti SC", KaiTi, serif'; c.fillText('27 03 46 18', 18, 52); c.fillText('09 51 33', 18, 100);
  }),
  // 蛋糕：粉色奶油，上沿挂着一圈白巧克力淋面（v 方向：画布第 0 行是蛋糕底边，往下是往上）
  frosting: (vTop, tint, drip) => cv(1024, 512, (c, w, h) => {
    c.fillStyle = tint; c.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 6) { c.fillStyle = `rgba(255,255,255,${0.05 + rnd() * 0.06})`; c.fillRect(x, 0, 2, h * vTop); } // 抹刀刮出的竖纹
    for (let i = 0; i < 1600; i++) { c.fillStyle = `rgba(${rnd() < 0.5 ? '120,40,60' : '255,255,255'},${rnd() * 0.06})`; c.fillRect(rnd() * w, rnd() * h, 2, 2); }
    // 淋面：从侧面顶上往下挂，长短不一，末端圆圆的
    c.fillStyle = drip;
    c.fillRect(0, h * (vTop - 0.06), w, h);
    let x = 0;
    while (x < w - 30) {
      const dw = 14 + rnd() * 18, len = h * (0.05 + rnd() * rnd() * 0.18);
      const y0 = h * (vTop - 0.06);
      c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y0 - len + dw / 2); c.arc(x + dw / 2, y0 - len + dw / 2, dw / 2, Math.PI, 0, false); c.lineTo(x + dw, y0); c.fill();
      x += dw + 4 + rnd() * 18;
    }
    const g = c.createLinearGradient(0, h * (vTop - 0.3), 0, h * vTop); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.18)');
    c.fillStyle = g; c.fillRect(0, h * (vTop - 0.3), w, h * 0.3);
  }),
  candle: () => cv(128, 256, (c, w, h) => {
    c.fillStyle = '#fbf3e4'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#7fb3e0';
    for (let k = -4; k < 8; k++) { c.beginPath(); c.moveTo(0, k * 48); c.lineTo(w, k * 48 + 64); c.lineTo(w, k * 48 + 82); c.lineTo(0, k * 48 + 18); c.fill(); }
  }),
  shadow: () => cv(256, 256, (c, w, h) => {
    c.filter = 'blur(18px)'; c.fillStyle = 'rgba(0,0,0,1)'; c.fillRect(46, 46, w - 92, h - 92);
  }),
};

/* ---------- 着色器 ---------- */
const VS = `#version 300 es
in vec3 aP; in vec3 aN; in vec2 aUV;
uniform mat4 uModel, uView, uProj, uLightVP;
out vec3 vP; out vec3 vN; out vec2 vUV; out vec4 vL;
void main() {
  vec4 w = uModel * vec4(aP, 1.0);
  vP = w.xyz; vN = mat3(uModel) * aN; vUV = aUV; vL = uLightVP * w;
  gl_Position = uProj * uView * w;
}`;
const FS = `#version 300 es
precision highp float;
in vec3 vP; in vec3 vN; in vec2 vUV; in vec4 vL;
uniform vec3 uColor, uEmissive, uCam, uLampPos, uLampColor, uAmbient;
uniform float uRough, uMetal, uLamp, uUseTex, uEmTex, uAlpha, uAlphaTest, uUnlit, uGlass;
uniform sampler2D uTex; uniform highp sampler2D uShadow;
out vec4 frag;
vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }
float shadowAt() {
  vec3 p = vL.xyz / vL.w * 0.5 + 0.5;
  if (vL.w <= 0.0 || p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
  float s = 0.0; vec2 px = 1.0 / vec2(textureSize(uShadow, 0));
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) s += p.z - 0.0012 > texture(uShadow, p.xy + vec2(x, y) * px * 1.5).r ? 0.0 : 1.0;
  return s / 9.0;
}
void main() {
  vec4 t = uUseTex > 0.5 ? texture(uTex, vUV) : vec4(1.0);
  if (t.a < uAlphaTest) discard;
  vec3 albedo = uColor * lin(t.rgb);
  if (uUnlit > 0.5) { frag = vec4(pow(albedo, vec3(1.0 / 2.2)), t.a * uAlpha); return; }
  vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(uCam - vP);
  // 天光：屋里没开别的灯，只有一点冷冷的月光和墙面的反光
  vec3 amb = mix(vec3(0.060, 0.050, 0.042), vec3(0.090, 0.105, 0.140), N.y * 0.5 + 0.5) * uAmbient;
  vec3 moonDir = normalize(vec3(-0.35, 0.45, 1.0));
  vec3 col = albedo * (amb + vec3(0.07, 0.09, 0.15) * max(dot(N, moonDir), 0.0) * (1.0 - uMetal * 0.6));
  // 桌面被台灯照亮后反上来的一点暖光，让抽屉柜、墙面不至于全黑
  vec3 bounceP = vec3(-200.0, 60.0, 120.0); vec3 Bv = bounceP - vP; float bd = length(Bv);
  col += albedo * vec3(0.55, 0.38, 0.22) * max(dot(N, Bv / bd), 0.0) * uLamp * 0.22 / (1.0 + bd * bd / (900.0 * 900.0));
  col += albedo * vec3(0.30, 0.22, 0.15) * max(dot(N, normalize(vec3(0.15, 0.25, 1.0))), 0.0) * (0.05 + uLamp * 0.07);
  // 台灯：灯罩往下照，灯罩上面只漏一点绿光
  vec3 Lv = uLampPos - vP; float d = length(Lv); vec3 L = Lv / d;
  float down = dot(-L, vec3(0.0, -1.0, 0.0));
  float cone = smoothstep(0.05, 0.6, down);
  float att = 1.0 / (1.0 + (d * d) / (520.0 * 520.0));
  float sh = (cone > 0.0 && uLamp > 0.01) ? shadowAt() : 1.0; // 灯照不到的地方不用算阴影，省一点力气
  vec3 lc = uLampColor * (cone * sh) + vec3(0.25, 0.55, 0.22) * 0.07 * (1.0 - cone);
  float nl = max(dot(N, L), 0.0);
  vec3 H = normalize(L + V);
  float shin = mix(6.0, 260.0, pow(1.0 - uRough, 2.0));
  float spec = pow(max(dot(N, H), 0.0), shin) * (shin + 8.0) / 25.0;
  vec3 F0 = mix(vec3(0.04), albedo, uMetal);
  vec3 diff = albedo * (1.0 - uMetal);
  col += (diff * nl + F0 * spec * nl) * lc * att * uLamp * 3.2;
  // 反光：假装周围有一圈环境——上方暗、地平线一道亮带、窗口那边一点冷光（铜件和玻璃就有了光泽）
  vec3 R = reflect(-V, N);
  float lampK = 0.25 + uLamp * 0.75;
  vec3 env = mix(vec3(0.02, 0.016, 0.012), vec3(0.30, 0.22, 0.13) * lampK, smoothstep(-0.4, 0.2, R.y));
  env += vec3(1.0, 0.78, 0.48) * lampK * 0.9 * exp(-pow((R.y - 0.12) * 7.0, 2.0));
  env += vec3(0.25, 0.32, 0.45) * pow(max(dot(R, moonDir), 0.0), 12.0);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 F = F0 + (1.0 - F0) * fres * (1.0 - uRough);
  col += F * env * mix(0.35 + uGlass * 1.4, 1.2, uMetal) * (1.0 - uRough * 0.6);
  // 灯罩：开灯时光从玻璃里透出来，下沿最亮，顶上暗一些
  float glow = uGlass > 0.5 ? (1.15 - 0.75 * sin(clamp(vUV.y, 0.0, 1.0) * 3.14159)) : 1.0;
  col += uEmissive * glow * (uEmTex > 0.5 ? albedo * 4.0 : vec3(1.0));
  col = col * (2.51 * col + 0.03) / (col * (2.43 * col + 0.59) + 0.14); // 胶片一样的色调
  frag = vec4(pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2)), t.a * uAlpha);
}`;
const SVS = `#version 300 es
in vec3 aP; uniform mat4 uModel, uLightVP;
void main() { gl_Position = uLightVP * uModel * vec4(aP, 1.0); }`;
const SFS = `#version 300 es
precision mediump float; out vec4 o; void main() { o = vec4(1.0); }`;

/* ---------- 场景 ---------- */
export function createStudy(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
  if (!gl) return null;
  let view = M.id(), proj = M.id(), camPos = [0, 0, 0], dirty = true, shadowDirty = true;
  const prog = (vs, fs) => {
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.bindAttribLocation(p, 0, 'aP'); gl.bindAttribLocation(p, 1, 'aN'); gl.bindAttribLocation(p, 2, 'aUV');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    for (let i = 0; i < gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i++) { const n = gl.getActiveUniform(p, i).name; u[n] = gl.getUniformLocation(p, n); }
    return { p, u };
  };
  const main = prog(VS, FS), depth = prog(SVS, SFS);
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic');

  const texture = (src, repeat = true) => {
    const t = gl.createTexture();
    const upload = (img) => {
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
      if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8);
      dirty = true;
    };
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 100, 80, 255]));
    if (typeof src === 'string') { const img = new Image(); img.onload = () => upload(img); img.src = src; } else upload(src);
    return t;
  };
  const mesh = (geo) => {
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    [[geo.p, 3], [geo.n, 3], [geo.uv, 2]].forEach(([data, size], loc) => {
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    });
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(geo.i), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, count: geo.i.length };
  };
  const items = [];
  const add = (geo, mat, model = M.id(), opt = {}) => { const it = { ...mesh(geo), mat, model, cast: opt.cast ?? true, cull: opt.cull ?? 'back', blend: opt.blend ?? false, key: opt.key }; items.push(it); return it; };

  /* 材质 */
  const T = {
    wood: texture('assets/qianfu/desk-wood.jpg'), wall: texture(TEX.wall()), floor: texture(TEX.floor()), leather: texture(TEX.leather()),
    brownLeather: texture(TEX.brownLeather()), win: texture(TEX.windowNight(), false), cal: texture(TEX.calendar(), false), clock: texture(TEX.clock(), false),
    photo: texture(TEX.photo(), false), books: texture(TEX.books(), false), door: texture(TEX.door(), false), grille: texture(TEX.grille(), false),
    slip: texture(TEX.slip(), false), shadow: texture(TEX.shadow(), false),
  };
  const mat = (o) => ({ color: [1, 1, 1], rough: 0.7, metal: 0, emissive: [0, 0, 0], tex: null, emTex: 0, alpha: 1, alphaTest: 0, unlit: 0, glass: 0, ...o });
  const brass = mat({ color: [0.80, 0.56, 0.26], rough: 0.2, metal: 1 });
  const darkWood = mat({ tex: T.wood, color: [0.62, 0.5, 0.42], rough: 0.5 });
  const deskWood = mat({ tex: T.wood, color: [1.08, 0.92, 0.82], rough: 0.38 });

  /* ---------- 房间 ---------- */
  const HALF = 2100, FLOOR = -740, CEIL = 1560, H = CEIL - FLOOR;
  add(new Geo().quad([-HALF, FLOOR, HALF], [HALF, FLOOR, HALF], [HALF, FLOOR, -HALF], [-HALF, FLOOR, -HALF], [0, 1, 0], [[0, 0], [6, 0], [6, 6], [0, 6]]), mat({ tex: T.floor, rough: 0.55 }), M.id(), { cast: false });
  add(new Geo().quad([-HALF, CEIL, -HALF], [HALF, CEIL, -HALF], [HALF, CEIL, HALF], [-HALF, CEIL, HALF], [0, -1, 0]), mat({ color: [0.05, 0.04, 0.035], rough: 1 }), M.id(), { cast: false });
  const wallUV = [[0, 0], [5, 0], [5, 1], [0, 1]];
  const walls = new Geo()
    .quad([-HALF, FLOOR, -HALF], [HALF, FLOOR, -HALF], [HALF, CEIL, -HALF], [-HALF, CEIL, -HALF], [0, 0, 1], wallUV)
    .quad([HALF, FLOOR, HALF], [-HALF, FLOOR, HALF], [-HALF, CEIL, HALF], [HALF, CEIL, HALF], [0, 0, -1], wallUV)
    .quad([-HALF, FLOOR, HALF], [-HALF, FLOOR, -HALF], [-HALF, CEIL, -HALF], [-HALF, CEIL, HALF], [1, 0, 0], wallUV)
    .quad([HALF, FLOOR, -HALF], [HALF, FLOOR, HALF], [HALF, CEIL, HALF], [HALF, CEIL, -HALF], [-1, 0, 0], wallUV);
  add(walls, mat({ tex: T.wall, rough: 0.85 }), M.id(), { cast: false });
  // 后墙的窗：木窗框、十字窗棂、窗台；玻璃外是夜色和月亮（自己发光）
  const wz = -HALF + 2, wx = 620, wy = 440, ww = 760, wh = 600;
  add(new Geo().quad([wx - ww / 2, wy - wh / 2, wz], [wx + ww / 2, wy - wh / 2, wz], [wx + ww / 2, wy + wh / 2, wz], [wx - ww / 2, wy + wh / 2, wz], [0, 0, 1]), mat({ tex: T.win, unlit: 1 }), M.id(), { cast: false });
  const frame = new Geo()
    .box(wx, wy + wh / 2 + 18, wz + 14, ww + 72, 36, 28).box(wx, wy - wh / 2 - 18, wz + 14, ww + 72, 36, 28)
    .box(wx - ww / 2 - 18, wy, wz + 14, 36, wh, 28).box(wx + ww / 2 + 18, wy, wz + 14, 36, wh, 28)
    .box(wx, wy, wz + 10, 16, wh, 16).box(wx, wy, wz + 10, ww, 16, 16)
    .box(wx, wy - wh / 2 - 44, wz + 40, ww + 120, 22, 80);
  add(frame, darkWood, M.id(), { cast: false });
  // 日历、挂钟、相框、书架、门
  const unitQuad = (w, h) => new Geo().quad([-w / 2, -h / 2, 0], [w / 2, -h / 2, 0], [w / 2, h / 2, 0], [-w / 2, h / 2, 0], [0, 0, 1]);
  add(unitQuad(170, 230), mat({ tex: T.cal, rough: 0.9 }), M.t(-120, 460, -HALF + 3), { cast: false });
  add(unitQuad(250, 250), mat({ tex: T.clock, rough: 0.5, alphaTest: 0.5 }), M.mul(M.t(-HALF + 3, 700, -400), M.ry(Math.PI / 2)), { cast: false });
  add(unitQuad(420, 300), mat({ tex: T.photo, rough: 0.6 }), M.mul(M.t(-HALF + 3, 640, 500), M.ry(Math.PI / 2)), { cast: false });
  add(new Geo().box(0, 0, 0, 1000, 1200, 60), darkWood, M.mul(M.t(HALF - 30, -140, 200), M.ry(-Math.PI / 2)), { cast: false });
  add(unitQuad(960, 1160), mat({ tex: T.books, rough: 0.8 }), M.mul(M.t(HALF - 62, -140, 200), M.ry(-Math.PI / 2)), { cast: false });
  add(unitQuad(680, 1340), mat({ tex: T.door, rough: 0.6 }), M.mul(M.t(300, -70, HALF - 3), M.ry(Math.PI)), { cast: false });
  add(new Geo().sphere([0, 0, 0], 18), brass, M.t(80, -80, HALF - 20), { cast: false });

  /* ---------- 书桌：桌面、四周的线脚、两个抽屉柜、挡板、底座 ---------- */
  const desk = new Geo()
    .box(0, -24, 0, 1520, 48, 920, 760)                // 桌面
    .box(0, -58, 0, 1480, 20, 880, 760);               // 桌面下的一圈线脚
  add(desk, deskWood);
  const ped = new Geo();
  for (const sx of [-1, 1]) {
    const cx = sx * 505;
    ped.box(cx, -404, 0, 470, 652, 840, 600);          // 柜体
    ped.box(cx, -722, 0, 490, 36, 860, 600);           // 底座
  }
  ped.box(0, -300, -390, 560, 440, 24, 600);           // 中间的挡板
  add(ped, darkWood);
  const drawers = new Geo(), handles = new Geo();
  for (const sx of [-1, 1]) {
    const cx = sx * 505;
    [[-150, 170], [-350, 190], [-570, 210]].forEach(([y, h]) => {
      drawers.box(cx, y, 426, 420, h - 18, 14, 600);
      drawers.box(cx, y, 432, 380, h - 50, 4, 600);    // 抽屉面板上的一圈凸边
      handles.box(cx, y + 6, 446, 90, 10, 10).box(cx - 40, y + 6, 440, 10, 10, 14).box(cx + 40, y + 6, 440, 10, 10, 14);
    });
  }
  ped.box(0, -110, 410, 560, 80, 24, 600);             // 中间那只扁抽屉
  add(drawers, mat({ tex: T.wood, color: [0.78, 0.62, 0.52], rough: 0.42 }));
  handles.box(0, -104, 428, 90, 10, 10);
  add(handles, brass);
  // 桌垫：墨绿皮面，两头包棕色皮
  add(new Geo().box(0, 2, 20, 700, 4, 540), mat({ tex: T.leather, rough: 0.55 }), M.id(), { cast: false });
  add(new Geo().box(-385, 3, 20, 70, 6, 548).box(385, 3, 20, 70, 6, 548), mat({ tex: T.brownLeather, rough: 0.45 }), M.id(), { cast: false });

  /* ---------- 绿灯罩台灯 ---------- */
  const LX = -470, LZ = -280;
  const base = new Geo().lathe([
    [0, 0], [118, 0], [118, 0], [122, 4], [122, 14], [122, 14], [112, 18], [104, 24], [104, 32], [96, 34], [84, 42],
    [70, 50], [58, 58], [50, 66], [46, 74], [46, 74], [38, 78], [34, 86], [40, 96], [46, 108], [44, 120], [34, 130],
    [26, 136], [24, 142], [30, 150], [32, 162], [28, 176], [20, 186], [14, 192], [14, 198], [0, 200],
  ], 128);
  add(base, brass, M.t(LX, 0, LZ));
  // 灯杆：先直上，再朝前弯到灯罩下面的托架
  const stem = [];
  for (let k = 0; k <= 24; k++) { const t = k / 24; stem.push([0, 196 + t * 230, 0]); }
  for (let k = 1; k <= 12; k++) { const a = (k / 12) * (Math.PI / 2.6); stem.push([0, 426 + Math.sin(a) * 42, (1 - Math.cos(a)) * 42 + 0]); }
  add(new Geo().tube(stem, 7, 28), brass, M.t(LX, 0, LZ), { cast: false });
  // 灯罩：一道圆拱沿左右拉长，外面绿玻璃、里面白，开灯时里外都亮
  const SH = { y: 462, z: 46, len: 330, depth: 196, h: 96 };
  const prof = [];
  for (let k = 0; k <= 40; k++) {
    const t = (k / 40) * Math.PI, c = Math.cos(t), s = Math.sin(t);
    prof.push([SH.z + Math.sign(c) * Math.pow(Math.abs(c), 0.75) * SH.depth / 2, SH.y + Math.pow(s, 0.55) * SH.h]);
  }
  const shadeGeo = new Geo().extrudeX(prof, -SH.len / 2, SH.len / 2).fanX(prof, SH.len / 2, 1).fanX(prof, -SH.len / 2, -1);
  const shadeOut = add(shadeGeo, mat({ color: [0.04, 0.34, 0.11], rough: 0.06, metal: 0, glass: 1 }), M.t(LX, 0, LZ), { cull: 'back' });
  const shadeIn = add(shadeGeo, mat({ color: [0.95, 0.93, 0.86], rough: 0.6 }), M.t(LX, 0, LZ), { cull: 'front', cast: false });
  const rim = new Geo()
    .box(0, SH.y + 2, SH.z + SH.depth / 2, SH.len + 6, 8, 8).box(0, SH.y + 2, SH.z - SH.depth / 2, SH.len + 6, 8, 8)
    .box(0, SH.y - 6, SH.z, 40, 14, 60);                                     // 托架
  add(rim, brass, M.t(LX, 0, LZ), { cast: false });
  // 灯罩两头的铜帽
  const cap = new Geo().lathe([[0, 0], [14, 0], [16, 6], [12, 14], [16, 22], [8, 30], [0, 32]], 48);
  add(cap, brass, M.chain(M.t(LX + SH.len / 2 - 2, SH.y + 56, LZ + SH.z), M.rz(-Math.PI / 2)));
  add(cap, brass, M.chain(M.t(LX - SH.len / 2 + 2, SH.y + 56, LZ + SH.z), M.rz(Math.PI / 2)));
  // 灯泡
  const bulb = add(new Geo().sphere([0, 0, 0], 22), mat({ color: [1, 0.95, 0.8], rough: 0.3, emissive: [0, 0, 0] }), M.t(LX, SH.y + 14, LZ + SH.z + 30), { cast: false });
  // 拉链：一串小珠子，末端一颗大珠
  const chain = new Geo();
  for (let k = 0; k < 30; k++) chain.sphere([0, -k * 5.2, 0], 2.4, 12);
  chain.sphere([0, -30 * 5.2 - 6, 0], 7, 14);
  add(chain, brass, M.t(LX + 96, SH.y - 2, LZ + SH.z + 70), { cast: false });
  const LAMP_POS = [LX, SH.y + 12, LZ + SH.z]; // 灯泡挂在托架下面

  /* ---------- 收音机：拱形木壳、布面喇叭、刻度窗、两个旋钮 ---------- */
  const RX = 470, RZ = -300; // 往左挪了一点，给右后角的小蛋糕腾出位置
  const arch = [];
  arch.push([105, 0], [105, 140]);
  for (let k = 1; k < 24; k++) { const a = (k / 24) * Math.PI; arch.push([Math.cos(a) * 105, 140 + Math.sin(a) * 105]); }
  arch.push([-105, 140], [-105, 0]);
  add(new Geo().extrudeZ(arch, -62, 62, 300), mat({ tex: T.wood, color: [0.75, 0.48, 0.36], rough: 0.32 }), M.t(RX, 0, RZ));
  add(unitQuad(190, 238), mat({ tex: T.grille, rough: 0.9, alphaTest: 0.5 }), M.t(RX, 124, RZ + 63), { cast: false });
  const dial = add(unitQuad(96, 20), mat({ color: [0.9, 0.6, 0.25], rough: 0.4, emissive: [0, 0, 0] }), M.t(RX, 38, RZ + 64), { cast: false });
  const knob = new Geo().lathe([[0, 0], [14, 0], [14, 12], [10, 16], [0, 16]], 48);
  add(knob, mat({ color: [0.08, 0.05, 0.03], rough: 0.3 }), M.chain(M.t(RX - 68, 26, RZ + 62), M.rx(Math.PI / 2)));
  add(knob, mat({ color: [0.08, 0.05, 0.03], rough: 0.3 }), M.chain(M.t(RX + 68, 26, RZ + 62), M.rx(Math.PI / 2)));

  /* ---------- 钢笔和写着数字的纸条 ---------- */
  add(new Geo().box(0, 0, 0, 240, 1.5, 116), mat({ tex: T.slip, rough: 0.9 }), M.chain(M.t(540, 1.2, 190), M.ry(-0.32)));
  const pen = new Geo().lathe([[0, 0], [5, 6], [7, 30], [7.5, 160], [8, 170], [8, 300], [6.5, 312], [0, 314]], 48);
  add(pen, mat({ color: [0.03, 0.03, 0.035], rough: 0.15 }), M.chain(M.t(330, 8, 30), M.ry(0.55), M.rz(-Math.PI / 2)));
  add(new Geo().lathe([[8.6, 0], [8.6, 10], [0, 10]], 48), brass, M.chain(M.t(330, 8, 30), M.ry(0.55), M.rz(-Math.PI / 2), M.t(0, 165, 0)));

  /* ---------- 右后角的小蛋糕：白瓷高脚托盘、两层奶油蛋糕、裱花、草莓、珍珠糖和一支蜡烛 ---------- */
  // 点它就去下一页（蛋糕页）。火苗是网页那层画的（会跳动），这里只画实体。
  const CX = 665, CZ = -335;
  const CAKE = M.t(CX, 0, CZ);
  const porcelain = mat({ color: [0.95, 0.94, 0.9], rough: 0.18, glass: 0.4 });
  add(new Geo().lathe([
    [0, 0], [34, 0], [34, 0], [35.2, 1.4], [34.4, 3], [28, 4.6], [16, 6.8], [10.5, 9.5], [9, 13], [10, 16.5], [14, 18.6],
    [30, 19.8], [56, 20.6], [61, 21.3], [63.4, 22.6], [63, 24], [60.5, 24.4], [60.5, 24.4], [40, 24.4], [0, 24.4],
  ], 128), porcelain, CAKE);
  add(new Geo().lathe([[63.1, 21.7], [64.2, 22.7], [63.7, 23.9], [62.6, 24.5]], 128), brass, CAKE, { cast: false });
  const tier = (y0, R, Hh, e, tint, drip) => {
    const prof = [];
    for (let k = 0; k <= 8; k++) prof.push([R, y0 + ((Hh - e) * k) / 8]);
    for (let k = 1; k <= 6; k++) { const a = (k / 6) * (Math.PI / 2); prof.push([R - e + e * Math.cos(a), y0 + Hh - e + e * Math.sin(a)]); }
    for (let k = 1; k <= 6; k++) prof.push([Math.max(0.01, (R - e) * (1 - k / 6)), y0 + Hh]);
    const vTop = 8 / (prof.length - 1);
    add(new Geo().lathe(prof, 128), mat({ tex: texture(TEX.frosting(vTop + 0.12, tint, drip)), rough: 0.62 }), CAKE);
    // 底边一圈珍珠糖
    const pearls = new Geo(), n = Math.round((2 * Math.PI * (R + 1)) / 5);
    for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; pearls.sphere([Math.cos(a) * (R + 0.9), y0 + 2.1, Math.sin(a) * (R + 0.9)], 2.2, 12); }
    add(pearls, mat({ color: [0.98, 0.88, 0.72], rough: 0.22, metal: 0.55 }), CAKE, { cast: false });
  };
  const Y0 = 24.4, R1 = 46, H1 = 32, R2 = 30, H2 = 24;
  const Y1 = Y0 + H1, TOP = Y1 + H2;
  tier(Y0, R1, H1, 5, '#f1aebd', '#fbf5ec');
  tier(Y1, R2, H2, 4, '#fbf1e2', '#ee9cb0');
  // 裱花：六齿花嘴挤出来的一小团，带一点旋
  const rosette = (r0, hh) => new Geo().param((u, v) => {
    const th = u * Math.PI * 2;
    let r = r0 * Math.pow(Math.max(0, 1 - Math.pow(v, 1.6)), 0.8) * (0.9 + 0.5 * v * (1 - v));
    r *= 1 + 0.17 * Math.cos(6 * (th + v * 2.4)) * (1 - v * 0.7);
    return [Math.cos(th) * r, v * hh, Math.sin(th) * r];
  }, 48, 16);
  const cream = mat({ color: [1.0, 0.97, 0.92], rough: 0.55 });
  const r1 = rosette(6.2, 9), r2 = rosette(4.4, 7);
  const ros = (geo, n, rad, y, off) => { for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2 + off; add(geo, cream, M.chain(CAKE, M.t(Math.cos(a) * rad, y, Math.sin(a) * rad), M.ry(-a)), { cull: 'none', cast: false }); } };
  ros(r1, 12, R1 - 6.5, Y1 - 0.5, 0.13);
  ros(r2, 8, R2 - 5, TOP - 0.4, 0.4);
  // 草莓：尖朝上，绿萼片
  const berry = new Geo().param((u, v) => {
    const th = u * Math.PI * 2, t = v;          // t: 0 底（蒂）→ 1 尖
    const r = 5.6 * Math.pow(Math.sin(Math.PI * (0.18 + 0.82 * (1 - t)) * 0.62), 1.1) * (1 - 0.12 * Math.cos(th * 3) * t);
    return [Math.cos(th) * r, t * 12, Math.sin(th) * r];
  }, 40, 20);
  const calyx = new Geo().param((u, v) => {
    const th = u * Math.PI * 2, r = v * 5.2 * (0.5 + 0.5 * Math.pow(Math.abs(Math.cos(th * 2.5)), 0.6));
    return [Math.cos(th) * r, 0.6 - v * v * 1.6, Math.sin(th) * r];
  }, 60, 6);
  const red = mat({ color: [0.82, 0.07, 0.1], rough: 0.28 }), leaf = mat({ color: [0.24, 0.5, 0.18], rough: 0.5 });
  [[0.5, 0.2], [2.6, -0.25], [4.5, 0.15]].forEach(([a, tilt]) => {
    const m = M.chain(CAKE, M.t(Math.cos(a) * 13, TOP + 0.2, Math.sin(a) * 13), M.ry(-a), M.rz(tilt));
    add(berry, red, m, { cull: 'none' });
    add(calyx, leaf, m, { cull: 'none', cast: false });
  });
  // 蜡烛和烛芯
  const candleProf = [];
  for (let k = 0; k <= 12; k++) candleProf.push([2.6, (26 * k) / 12]);
  candleProf.push([2.3, 26.5], [0.01, 26.8]);
  add(new Geo().lathe(candleProf, 48), mat({ tex: texture(TEX.candle()), rough: 0.45 }), M.chain(CAKE, M.t(0, TOP, 0)));
  add(new Geo().tube([[0, 26.6, 0], [0, 28.6, 0], [0.4, 30.4, 0], [0.9, 31.6, 0]], 0.45, 10), mat({ color: [0.06, 0.05, 0.04], rough: 0.8 }), M.chain(CAKE, M.t(0, TOP, 0)), { cast: false });
  const CAKE_INFO = { flame: [CX + 0.9, TOP + 31.4, CZ], box: [] };
  for (const x of [CX - 64, CX + 64]) for (const y of [0, TOP + 40]) for (const z of [CZ - 64, CZ + 64]) CAKE_INFO.box.push([x, y, z]);

  /* ---------- 手账在桌上的影子（手账翻开时淡掉） ---------- */
  const bookShadow = add(unitQuad(380, 520), mat({ tex: T.shadow, color: [1, 1, 1], alpha: 0.6, unlit: 1 }), M.chain(M.t(0, 4.2, 4), M.ry(0.14), M.rx(-Math.PI / 2)), { cast: false, blend: true });

  /* ---------- 阴影贴图：从灯泡往下看 ---------- */
  const SM = 2048;
  const shadowTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, shadowTex);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, SM, SM);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shadowTex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  const lightVP = M.mul(M.persp((150 * Math.PI) / 180, 1, 20, 3000), M.lookAt([LAMP_POS[0], LAMP_POS[1] - 4, LAMP_POS[2]], [LAMP_POS[0], LAMP_POS[1] - 100, LAMP_POS[2] + 0.01], [0, 0, -1]));

  /* ---------- 状态 ---------- */
  let lamp = 1, lampTarget = 1, shadowAlpha = 0.6, shadowTarget = 0.6;
  let W = 1, Hpx = 1;

  function resize() {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    W = Math.max(1, r.width); Hpx = Math.max(1, r.height);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(Hpx * dpr);
    dirty = true;
  }

  function draw() {
    if (shadowDirty) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, SM, SM);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
      gl.useProgram(depth.p);
      gl.uniformMatrix4fv(depth.u.uLightVP, false, lightVP);
      for (const it of items) { if (!it.cast) continue; gl.uniformMatrix4fv(depth.u.uModel, false, it.model); gl.bindVertexArray(it.vao); gl.drawElements(gl.TRIANGLES, it.count, gl.UNSIGNED_INT, 0); }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      shadowDirty = false;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.02, 0.018, 0.015, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.useProgram(main.p);
    const u = main.u;
    gl.uniformMatrix4fv(u.uView, false, view); gl.uniformMatrix4fv(u.uProj, false, proj); gl.uniformMatrix4fv(u.uLightVP, false, lightVP);
    gl.uniform3fv(u.uCam, camPos); gl.uniform3fv(u.uLampPos, LAMP_POS);
    gl.uniform3fv(u.uLampColor, [1.0, 0.78, 0.48]); gl.uniform1f(u.uLamp, lamp);
    gl.uniform3fv(u.uAmbient, [1, 1, 1].map((v) => v * (0.9 + (1 - lamp) * 0.5)));
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, shadowTex); gl.uniform1i(u.uShadow, 1);
    gl.uniform1i(u.uTex, 0);
    // 开灯时：灯罩外面泛绿光、里面泛暖光，灯泡亮，收音机刻度窗在关灯时更显眼
    shadeOut.mat.emissive = [0.04 * lamp, 0.26 * lamp, 0.06 * lamp];
    shadeIn.mat.emissive = [1.1 * lamp, 0.9 * lamp, 0.6 * lamp];
    bulb.mat.emissive = [3 * lamp, 2.6 * lamp, 1.8 * lamp];
    dial.mat.emissive = [0.35, 0.2, 0.06];
    bookShadow.mat.alpha = shadowAlpha;
    const order = [...items.filter((i) => !i.blend), ...items.filter((i) => i.blend)];
    for (const it of order) {
      const m = it.mat;
      if (it.cull === 'none') gl.disable(gl.CULL_FACE); else { gl.enable(gl.CULL_FACE); gl.cullFace(it.cull === 'front' ? gl.FRONT : gl.BACK); }
      if (it.blend) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); } else { gl.disable(gl.BLEND); gl.depthMask(true); }
      gl.uniformMatrix4fv(u.uModel, false, it.model);
      gl.uniform3fv(u.uColor, m.color); gl.uniform3fv(u.uEmissive, m.emissive);
      gl.uniform1f(u.uRough, m.rough); gl.uniform1f(u.uMetal, m.metal); gl.uniform1f(u.uAlpha, m.alpha);
      gl.uniform1f(u.uAlphaTest, m.alphaTest); gl.uniform1f(u.uUnlit, m.unlit); gl.uniform1f(u.uEmTex, m.emTex); gl.uniform1f(u.uGlass, m.glass);
      gl.uniform1f(u.uUseTex, m.tex ? 1 : 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, m.tex || T.shadow);
      gl.bindVertexArray(it.vao);
      gl.drawElements(gl.TRIANGLES, it.count, gl.UNSIGNED_INT, 0);
    }
    gl.depthMask(true); gl.disable(gl.BLEND);
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const k = 1 - Math.exp(-dt * 14);
    if (Math.abs(lamp - lampTarget) > 0.002) { lamp += (lampTarget - lamp) * k; dirty = true; } else if (lamp !== lampTarget) { lamp = lampTarget; dirty = true; }
    const ks = 1 - Math.exp(-dt * 5);
    if (Math.abs(shadowAlpha - shadowTarget) > 0.002) { shadowAlpha += (shadowTarget - shadowAlpha) * ks; dirty = true; }
    if (dirty) { draw(); dirty = false; }
    requestAnimationFrame(loop);
  }
  resize();
  new ResizeObserver(resize).observe(canvas);
  requestAnimationFrame(loop);

  // 台灯在屏幕上占的范围，用来判断有没有点到它
  const lampBox = [];
  for (const x of [LX - 170, LX + 170]) for (const y of [0, SH.y + SH.h + 10]) for (const z of [LZ - 120, LZ + SH.z + 110]) lampBox.push([x, y, z]);

  return {
    /** 和网页那层完全一样的镜头：yaw、pitch（度），R、lookY（单位 u），P（透视距离，屏幕像素） */
    setCamera({ yaw, pitch, R, P, lookY }) {
      const S = M.s(1, -1, 1);
      const vCss = M.chain(M.t(0, 0, -R), M.rx((-pitch * Math.PI) / 180), M.ry((yaw * Math.PI) / 180), M.t(0, lookY, 0));
      view = M.chain(S, vCss, S);
      const fov = 2 * Math.atan((Hpx / 2) / P); // P 是屏幕像素，和网页那层的 perspective 一样
      proj = M.persp(fov, W / Hpx, 20, 9000);
      // 镜头在世界里的位置（给高光用）
      const a = (pitch * Math.PI) / 180, b = (yaw * Math.PI) / 180;
      const cy = Math.sin(a) * R + lookY, horiz = Math.cos(a) * R;
      camPos = [-Math.sin(b) * horiz, cy, Math.cos(b) * horiz];
      dirty = true;
    },
    setLamp(on) { lampTarget = on ? 1 : 0; dirty = true; },
    /** 把三维的点换算成画布上的像素坐标（看不见时返回 null） */
    project(p) {
      const q = M.apply(M.mul(proj, view), p);
      if (q[3] <= 0) return null;
      return [(q[0] * 0.5 + 0.5) * W, (1 - (q[1] * 0.5 + 0.5)) * Hpx];
    },
    /** 小蛋糕在屏幕上占的范围和火苗的位置 */
    cake() {
      const pts = CAKE_INFO.box.map((p) => this.project(p));
      if (pts.some((p) => !p)) return null;
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), flame: this.project(CAKE_INFO.flame), base: this.project([CAKE_INFO.flame[0], 0, CAKE_INFO.flame[2]]) };
    },
    setBookOpen(open) { shadowTarget = open ? 0 : 0.6; dirty = true; },
    pickLamp(x, y) {
      const vp = M.mul(proj, view);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of lampBox) {
        const q = M.apply(vp, p);
        if (q[3] <= 0) return false;
        const sx = (q[0] * 0.5 + 0.5) * W, sy = (1 - (q[1] * 0.5 + 0.5)) * Hpx;
        x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
      }
      return x >= x0 && x <= x1 && y >= y0 && y <= y1;
    },
  };
}
