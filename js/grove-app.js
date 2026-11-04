// 第三页：八只小象绕着大树走。
// 背景是那幅画去掉小象后的样子（assets/grove-bg.jpg），树干单独存了一张透明图（grove-trunk.png），
// 走到树后面的小象先画，再盖上树干，最后画走在前面的小象，这样就有前后遮挡。
import { ELEPHANTS } from './elephant-diaries.js';
import { paintScene } from './diary-scenes.js';

const $ = (id) => document.getElementById(id);
const canvas = $('groveCanvas');
const ctx = canvas.getContext('2d');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

/* ---------- 画面坐标（原画 1092 × 996 像素） ---------- */
const IW = 1092, IH = 996;
const TRUNK = { x: 270, y: 500, w: 470, h: 400 };
const RING = { cx: 566, cy: 842, rx: 388, ry: 128 };
const LAP_SECONDS = 84;

const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

/* ---------- 纸面颗粒（小象身上和背景都用） ---------- */
function grainTile(size, amount, seed = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  let s = seed;
  const R = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = R() < 0.5 ? 255 : 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = R() * amount;
  }
  g.putImageData(img, 0, 0);
  // 几点颜料斑
  for (let k = 0; k < size / 6; k++) {
    g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(10,30,70,0.10)';
    g.beginPath(); g.arc(R() * size, R() * size, 1 + R() * 5, 0, Math.PI * 2); g.fill();
  }
  return c;
}

/* ---------- 小象 ---------- */
const TINTS = ['#3d72b6', '#3b6fb0', '#4278ba', '#3e74b4', '#386cae', '#4479b6', '#3c70b2', '#467dbc'];
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

// 局部坐标：脚底中点为原点，面朝右，身长约 270。
const BOX = { x0: -128, x1: 168, y0: -178, y1: 14 };

function brush(g, pts, w0, w1, color) {
  g.fillStyle = color;
  for (let i = 0; i < pts.length; i++) {
    const t = i / (pts.length - 1);
    g.beginPath(); g.arc(pts[i][0], pts[i][1], (w0 + (w1 - w0) * t) / 2, 0, Math.PI * 2); g.fill();
  }
}
function quad(p0, p1, p2, n = 24) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]);
  }
  return out;
}
function leg(g, x, ang, color) {
  g.save();
  g.translate(x, -54);
  g.rotate(ang);
  g.fillStyle = color;
  g.beginPath();
  g.roundRect(-14, -8, 28, 62, [10, 10, 9, 9]);
  g.fill();
  g.fillStyle = 'rgba(235,240,250,0.28)';
  for (const dx of [-7, 0, 7]) { g.beginPath(); g.ellipse(dx, 51, 3, 2, 0, Math.PI, 0); g.fill(); }
  g.restore();
}
function crown(g, x, y, color, edge, size = 1) {
  g.save();
  g.translate(x, y); g.scale(size, size); g.rotate(-0.08);
  g.fillStyle = color; g.strokeStyle = edge; g.lineWidth = 1.4; g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(-10, 0); g.lineTo(-11, -12); g.lineTo(-5, -5); g.lineTo(0, -15); g.lineTo(5, -5); g.lineTo(11, -12); g.lineTo(10, 0);
  g.closePath(); g.fill(); g.stroke();
  g.restore();
}

function drawElephant(g, el, phase, still) {
  const body = el.color, far = shade(body, -0.2), dark = shade(body, -0.38), ear = shade(body, -0.3);
  const swing = still ? 0 : 0.3;
  const a = Math.sin(phase) * swing, b = Math.sin(phase + Math.PI) * swing;
  const bob = still ? 0 : -Math.abs(Math.sin(phase)) * 3;
  // 远侧的两条腿
  leg(g, -50, b, far);
  leg(g, 40, a, far);
  g.save();
  g.translate(0, bob);
  // 尾巴
  const tailSway = still ? 0 : Math.sin(phase * 0.5) * 6;
  brush(g, quad([-84, -98], [-104, -86], [-106 + tailSway * 0.3, -58 + tailSway]), 6, 3.5, far);
  g.fillStyle = dark;
  g.beginPath(); g.ellipse(-106 + tailSway * 0.3, -54 + tailSway, 4, 7, 0.2, 0, Math.PI * 2); g.fill();
  // 身体：圆滚滚的一团
  g.fillStyle = body;
  g.beginPath(); g.ellipse(-8, -86, 82, 54, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(-56, -84, 36, 46, 0, 0, Math.PI * 2); g.fill();
  // 头
  g.beginPath(); g.ellipse(64, -108, 44, 42, -0.1, 0, Math.PI * 2); g.fill();
  // 鼻子：向前伸，去够前面小象的尾巴
  const sway = still ? 0 : Math.sin(phase * 0.5 + 1) * 5;
  brush(g, quad([92, -104], [128, -84], [150 + sway * 0.4, -58 + sway]), 27, 11, body);
  brush(g, quad([150 + sway * 0.4, -58 + sway], [156, -50 + sway], [160, -54 + sway], 8), 11, 9, body);
  // 象牙（领头的阿团才有）
  if (el.tusk) brush(g, quad([94, -86], [108, -70], [122, -78], 18), 7, 2.5, '#f6f1e6');
  // 肚皮下的暗影
  g.fillStyle = 'rgba(20,45,95,0.14)';
  g.beginPath(); g.ellipse(-8, -46, 66, 10, 0, 0, Math.PI * 2); g.fill();
  // 近侧的两条腿
  g.restore();
  leg(g, -34, a, body);
  leg(g, 52, b, body);
  g.save();
  g.translate(0, bob);
  // 耳朵：一大片深色
  const flap = still ? 0 : Math.sin(phase * 0.5) * 0.05;
  g.fillStyle = ear;
  g.beginPath(); g.ellipse(46, -104, 24, 33, 0.14 + flap, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.08)';
  g.beginPath(); g.ellipse(42, -112, 12, 18, 0.14 + flap, 0, Math.PI * 2); g.fill();
  // 眼睛
  g.fillStyle = '#1b2a4a';
  g.beginPath(); g.ellipse(84, -116, 3.2, 3.8, 0, 0, Math.PI * 2); g.fill();
  // 王冠
  crown(g, 62, -147, el.crown === 'red' ? '#d9442f' : '#e3b145', el.crown === 'red' ? '#a52e1f' : '#b9852b', el.crown === 'red' ? 1.1 : 0.95);
  g.restore();
}

/* ---------- 布局 ---------- */
let W = 0, H = 0, dpr = 1, S = 1, OX = 0, OY = 0;
let bgCanvas = null, trunkImg = null, bgImg = null;
const work = document.createElement('canvas');
const wctx = work.getContext('2d');
let grain = null, grainPattern = null;

function layout() {
  const r = canvas.getBoundingClientRect();
  W = r.width; H = r.height;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  S = Math.min(W / (IW * (W < H ? 0.78 : 0.84)), H / (IH * 0.97));
  OX = (W - IW * S) / 2;
  OY = (H - IH * S) * (W < 700 ? 0.7 : 0.62);
  buildBackground();
  placeTag();
}

// “我和你一起爱左蓝”的小唱片机：放在小象队伍的右边，屏幕太窄时贴着右边缘。
function placeTag() {
  const tag = $('zuolanTag');
  const w = tag.offsetWidth, h = tag.offsetHeight;
  let x = OX + (RING.cx + RING.rx + 36) * S;
  let y = OY + (RING.cy - 260) * S - h / 2; // 抬到小象头顶的高度，不挡住走过的小象
  if (W < 700) { x = W - w - 14; y = Math.min(y, H - h - 84); }
  x = Math.max(12, Math.min(x, W - w - 14));
  y = Math.max(110, Math.min(y, H - h - 24));
  tag.style.setProperty('--tx', `${Math.round(x)}px`);
  tag.style.setProperty('--ty', `${Math.round(y)}px`);
  tag.classList.add('ready');
}

// 把画放在中间，四周用画边的颜色往外延伸，再铺一层纸纹，这样任何屏幕比例都填得满。
function buildBackground() {
  if (!bgImg) return;
  bgCanvas = document.createElement('canvas');
  bgCanvas.width = canvas.width; bgCanvas.height = canvas.height;
  const g = bgCanvas.getContext('2d');
  g.scale(dpr, dpr);
  g.imageSmoothingQuality = 'high';
  const w = IW * S, h = IH * S, e = 4;
  const right = OX + w, bottom = OY + h;
  // 画边先压成一行/一列（取平均，去掉噪点），再往外拉，避免出现一道道横纹。
  const edge = (sx, sy, sw, sh, cw, ch) => {
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const cg = c.getContext('2d'); cg.imageSmoothingQuality = 'high';
    cg.drawImage(bgImg, sx, sy, sw, sh, 0, 0, cw, ch);
    return c;
  };
  const top = edge(0, 0, IW, 6, 36, 1), bot = edge(0, IH - 30, IW, 30, 36, 1);
  const lef = edge(0, 0, 40, IH, 1, 160), rig = edge(IW - 40, 0, 40, IH, 1, 160);
  if (OY > 0) g.drawImage(top, OX, 0, w, OY + 1);
  if (bottom < H) g.drawImage(bot, OX, bottom - 1, w, H - bottom + 1);
  if (OX > 0) {
    g.drawImage(lef, 0, OY, OX + 1, h);
    g.drawImage(rig, right - 1, OY, W - right + 1, h);
    g.drawImage(lef, 0, 0, 1, 1, 0, 0, OX + 1, Math.max(OY, 0) + 1);
    g.drawImage(rig, 0, 0, 1, 1, right - 1, 0, W - right + 1, Math.max(OY, 0) + 1);
    g.drawImage(lef, 0, 159, 1, 1, 0, bottom - 1, OX + 1, H - bottom + 1);
    g.drawImage(rig, 0, 159, 1, 1, right - 1, bottom - 1, W - right + 1, H - bottom + 1);
  }
  g.drawImage(bgImg, OX, OY, w, h);
  if (OX > 0) {
    const fw = Math.min(60, OX);
    for (const [x0, from, to] of [[OX, 0, 1], [right - fw, 1, 0]]) {
      const src = from === 0 ? lef : rig;
      g.save();
      const m = g.createLinearGradient(x0, 0, x0 + fw, 0);
      m.addColorStop(0, `rgba(0,0,0,${1 - from})`); m.addColorStop(1, `rgba(0,0,0,${1 - to})`);
      g.beginPath(); g.rect(x0, OY, fw, h); g.clip();
      const tmp = document.createElement('canvas'); tmp.width = Math.ceil(fw); tmp.height = Math.ceil(h);
      const tg = tmp.getContext('2d');
      tg.drawImage(src, 0, 0, tmp.width, tmp.height);
      tg.globalCompositeOperation = 'destination-in';
      const m2 = tg.createLinearGradient(0, 0, tmp.width, 0);
      m2.addColorStop(0, `rgba(0,0,0,${from ? 0 : 1})`); m2.addColorStop(1, `rgba(0,0,0,${from ? 1 : 0})`);
      tg.fillStyle = m2; tg.fillRect(0, 0, tmp.width, tmp.height);
      g.drawImage(tmp, x0, OY);
      g.restore();
    }
  }
  // 画边和延伸处之间柔一点
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 0.07;
  g.fillStyle = g.createPattern(grain, 'repeat');
  g.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
  g.globalAlpha = 1;
  const v = g.createRadialGradient(bgCanvas.width / 2, bgCanvas.height * 0.55, Math.min(bgCanvas.width, bgCanvas.height) * 0.35, bgCanvas.width / 2, bgCanvas.height * 0.55, Math.max(bgCanvas.width, bgCanvas.height) * 0.75);
  v.addColorStop(0, 'rgba(10,30,60,0)'); v.addColorStop(1, 'rgba(10,30,60,0.22)');
  g.fillStyle = v;
  g.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
}

/* ---------- 小象们 ---------- */
const herd = ELEPHANTS.map((data, i) => ({
  data, i,
  color: TINTS[data.tint ?? i],
  crown: data.crown, tusk: data.tusk,
  size: data.small ? 0.84 : 1,
  facing: 1, x: 0, y: 0, sc: 1, depth: 0, phase: i * 1.7,
}));
const STEP = (Math.PI * 2) / herd.length;
let clock = 0, paused = false;

function place(el, t) {
  const th = 0.35 + el.i * STEP - (t / LAP_SECONDS) * Math.PI * 2;
  const s = Math.sin(th), c = Math.cos(th);
  el.x = RING.cx + RING.rx * c;
  el.y = RING.cy + RING.ry * s;
  el.depth = (s + 1) / 2;
  // 往前走时 θ 在减小，所以屏幕上的水平速度正比于 sin θ
  const vx = s * RING.rx, vy = -c * RING.ry;
  const target = Math.max(-1, Math.min(1, vx / (RING.rx * 0.35)));
  el.facing = Math.sign(target || 1) * Math.max(0.16, Math.abs(target));
  el.toward = vy; // 正值：朝观众走
  el.sc = (0.66 + 0.3 * el.depth) * el.size;
  el.phase = el.i * 1.7 + t * 4.6;
}

function drawShadow(el) {
  const x = OX + el.x * S, y = OY + el.y * S, k = el.sc * S;
  ctx.fillStyle = 'rgba(16,46,92,0.2)';
  ctx.beginPath(); ctx.ellipse(x, y + 2 * k, 96 * k, 14 * k, 0, 0, Math.PI * 2); ctx.fill();
}

function drawCalf(el, still) {
  const k = el.sc * S * dpr;
  const bw = Math.ceil((BOX.x1 - BOX.x0) * k), bh = Math.ceil((BOX.y1 - BOX.y0) * k);
  if (work.width < bw || work.height < bh) { work.width = Math.max(work.width, bw); work.height = Math.max(work.height, bh); }
  wctx.setTransform(1, 0, 0, 1, 0, 0);
  wctx.globalCompositeOperation = 'source-over';
  wctx.clearRect(0, 0, bw + 2, bh + 2);
  wctx.setTransform(k, 0, 0, k, -BOX.x0 * k, -BOX.y0 * k);
  drawElephant(wctx, el, el.phase, still);
  // 颜料的颗粒和一点从上往下的明暗
  wctx.setTransform(1, 0, 0, 1, 0, 0);
  wctx.globalCompositeOperation = 'source-atop';
  const lg = wctx.createLinearGradient(0, 0, 0, bh);
  lg.addColorStop(0, 'rgba(255,255,255,0.05)'); lg.addColorStop(0.6, 'rgba(255,255,255,0)'); lg.addColorStop(1, 'rgba(10,25,60,0.18)');
  wctx.fillStyle = lg; wctx.fillRect(0, 0, bw, bh);
  wctx.fillStyle = grainPattern; wctx.fillRect(0, 0, bw, bh);
  wctx.globalCompositeOperation = 'source-over';

  const x = (OX + el.x * S) * dpr, y = (OY + el.y * S) * dpr;
  ctx.save();
  ctx.setTransform(el.facing, 0, 0, 1, x, y);
  ctx.drawImage(work, 0, 0, bw, bh, BOX.x0 * k, BOX.y0 * k, bw, bh);
  ctx.restore();
}

function frame(now) {
  const still = reduceMotion.matches;
  if (!frame.last) frame.last = now;
  const dt = Math.min(0.05, (now - frame.last) / 1000);
  frame.last = now;
  if (!paused && !still) clock += dt;
  if (bgCanvas) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(bgCanvas, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const el of herd) place(el, clock);
    const order = [...herd].sort((p, q) => p.y - q.y);
    const back = order.filter((el) => el.y < RING.cy), front = order.filter((el) => el.y >= RING.cy);
    for (const el of back) drawShadow(el);
    for (const el of back) drawCalf(el, still || paused);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(trunkImg, OX + TRUNK.x * S, OY + TRUNK.y * S, TRUNK.w * S, TRUNK.h * S);
    for (const el of front) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); drawShadow(el); drawCalf(el, still || paused); }
    placeButtons();
  }
  requestAnimationFrame(frame);
}

/* ---------- 跟着小象走的按钮 ---------- */
const buttons = herd.map((el) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'calf';
  b.setAttribute('aria-label', `打开${el.data.name}的日记`);
  b.innerHTML = `<span class="calf-tag">${el.data.name}</span>`;
  b.addEventListener('click', () => openDiary(el.i, 0));
  $('herd').append(b);
  return b;
});
function placeButtons() {
  for (const el of herd) {
    const k = el.sc * S;
    const w = 230 * k, h = 160 * k;
    const b = buttons[el.i];
    b.style.width = `${w}px`; b.style.height = `${h}px`;
    b.style.transform = `translate(${OX + el.x * S - w / 2 + 14 * k * Math.sign(el.facing)}px, ${OY + el.y * S - h}px)`;
    b.style.zIndex = String(Math.round(el.y));
  }
}

/* ---------- 日记 ---------- */
let current = { who: 0, page: 0 };
let writeTimer = 0;
let lastFocus = null;
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function handwrite(text) {
  // 每个字有一点点高低、歪斜和深浅，像真的用笔写的。
  return [...text].map((ch) => {
    const y = (Math.random() - 0.5) * 2.4, r = (Math.random() - 0.5) * 5, o = 0.82 + Math.random() * 0.18;
    return `<span class="ch" style="--y:${y.toFixed(1)}px;--r:${r.toFixed(1)}deg;--o:${o.toFixed(2)}">${esc(ch)}</span>`;
  }).join('');
}

function renderDiary(turn) {
  const el = herd[current.who], d = el.data.diaries[current.page];
  $('diaryName').textContent = `${el.data.name}的日记`;
  $('tabCrown').classList.toggle('red', el.crown === 'red');
  const lines = [
    ['d-date', d.date], ['d-no', `${d.no}.`],
    ['', `天气：${d.weather}`], ['', `心情：${d.mood}`],
    ['d-text', d.text],
    ['', `今天的快乐：${d.happy}`], ['', `今天的烦恼：${d.worry}`],
    ['d-sign', `${el.data.name} 记`],
  ];
  $('diaryPaper').innerHTML = lines.map(([cls, t]) => `<p class="${cls}">${handwrite(t)}</p>`).join('');
  $('diaryPaper').setAttribute('aria-label', lines.map(([, t]) => t).join('。'));
  // 景色图
  const fig = $('diaryPhoto');
  fig.innerHTML = '';
  const painted = () => {
    const c = document.createElement('canvas');
    const w = Math.min(880, Math.round((fig.clientWidth || 440) * Math.min(devicePixelRatio || 1, 2)));
    c.width = w; c.height = Math.round(w * 0.625);
    c.setAttribute('role', 'img');
    c.setAttribute('aria-label', '日记里夹着的一张风景照');
    fig.append(c);
    paintScene(c, d.scene, (current.who + 1) * 97 + current.page * 13, d.opts);
  };
  if (d.photo) {
    const img = new Image();
    img.alt = '日记里夹着的一张风景照';
    img.onload = () => fig.append(img);
    img.onerror = painted;
    img.src = d.photo;
  } else painted();
  $('diaryPrev').disabled = current.page === 0;
  $('diaryNext').disabled = current.page === el.data.diaries.length - 1;
  $('diaryCount').textContent = `${current.page + 1} / ${el.data.diaries.length}`;
  $('diaryPage').scrollTop = 0;
  const diary = $('diary');
  if (turn) { diary.classList.remove('turn'); void diary.offsetWidth; diary.classList.add('turn'); }
  // 一个字一个字写出来
  clearInterval(writeTimer);
  const chars = [...$('diaryPaper').querySelectorAll('.ch')];
  if (reduceMotion.matches) { chars.forEach((c) => c.classList.add('on')); return; }
  let i = 0;
  const per = Math.max(1, Math.round(chars.length / 120));
  writeTimer = setInterval(() => {
    for (let k = 0; k < per && i < chars.length; k++) chars[i++].classList.add('on');
    if (i >= chars.length) clearInterval(writeTimer);
  }, 22);
}
function finishWriting() {
  clearInterval(writeTimer);
  $('diaryPaper').querySelectorAll('.ch').forEach((c) => c.classList.add('on'));
}

function openDiary(who, page) {
  lastFocus = document.activeElement;
  current = { who, page };
  paused = true;
  $('diaryRoot').hidden = false;
  renderDiary(false);
  $('diary').querySelector('.diary-close').focus({ preventScroll: true });
}
function closeDiary() {
  clearInterval(writeTimer);
  $('diaryRoot').hidden = true;
  paused = false;
  if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
}
$('diaryRoot').addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeDiary(); });
$('diaryPaper').addEventListener('click', finishWriting);
$('diaryPrev').addEventListener('click', () => { if (current.page > 0) { current.page--; renderDiary(true); } });
$('diaryNext').addEventListener('click', () => {
  if (current.page < herd[current.who].data.diaries.length - 1) { current.page++; renderDiary(true); }
});
document.addEventListener('keydown', (e) => {
  if ($('diaryRoot').hidden) return;
  if (e.key === 'Escape') closeDiary();
  else if (e.key === 'ArrowLeft') $('diaryPrev').click();
  else if (e.key === 'ArrowRight') $('diaryNext').click();
  else if (e.key === 'Tab') {
    const f = [...$('diaryRoot').querySelectorAll('button:not(:disabled)')];
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
  }
});

/* ---------- 雪：一直飘着 ---------- */
const snow = $('snowCanvas'), sctx = snow.getContext('2d');
let flakes = [], snowLast = 0;
function sizeSnow() {
  const r = snow.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
  snow.width = Math.round(r.width * d); snow.height = Math.round(r.height * d);
  sctx.setTransform(d, 0, 0, d, 0, 0);
  const want = Math.min(260, Math.round((r.width * r.height) / 7000));
  while (flakes.length < want) flakes.push(newFlake(r.width, r.height, true));
  flakes.length = want;
}
function newFlake(w, h, anywhere) {
  const z = Math.random(); // 远近：越近越大、越快、越亮
  return { x: Math.random() * w, y: anywhere ? Math.random() * h : -10, r: 0.8 + z * 2.6, v: 18 + z * 46, a: 0.45 + z * 0.5, s: Math.random() * 6.28, sw: 8 + Math.random() * 22 };
}
function drawSnow(now) {
  const w = snow.clientWidth, h = snow.clientHeight;
  const dt = snowLast ? Math.min(0.05, (now - snowLast) / 1000) : 0;
  snowLast = now;
  sctx.clearRect(0, 0, w, h);
  // 按亮度分成 5 档，每档只填一次（以前是每片雪花单独填一次，260 片就是 260 次）
  const paths = Array.from({ length: 5 }, () => new Path2D());
  for (const f of flakes) {
    if (!reduceMotion.matches) {
      f.y += f.v * dt; f.s += dt * 0.9;
      if (f.y > h + 6) Object.assign(f, newFlake(w, h, false));
    }
    const x = f.x + Math.sin(f.s) * f.sw;
    const p = paths[Math.min(4, Math.floor(((f.a - 0.45) / 0.5) * 5))];
    p.moveTo(x + f.r, f.y); p.arc(x, f.y, f.r, 0, Math.PI * 2);
  }
  sctx.fillStyle = '#ffffff';
  paths.forEach((p, i) => { sctx.globalAlpha = 0.5 + i * 0.1; sctx.fill(p); });
  sctx.globalAlpha = 1;
  requestAnimationFrame(drawSnow);
}
sizeSnow();
new ResizeObserver(sizeSnow).observe(snow);
requestAnimationFrame(drawSnow);

/* ---------- 开始 ---------- */
(async () => {
  try {
    [bgImg, trunkImg] = await Promise.all([load('assets/grove-bg.jpg'), load('assets/grove-trunk.png')]);
  } catch {
    $('groveLoading').textContent = '图片没有加载出来，请刷新页面再试。';
    return;
  }
  grain = grainTile(160, 40, 11);
  grainPattern = wctx.createPattern(grainTile(96, 16, 5), 'repeat');
  layout();
  new ResizeObserver(layout).observe(canvas);
  $('groveLoading').textContent = '';
  requestAnimationFrame(frame);
})();
