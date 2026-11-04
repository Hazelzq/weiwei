// 第四页：三维书房（合上手账时可以拖动环顾）、台灯、手账本（打开、翻页、合上）、大图和人物说明。
import { PEOPLE, PHOTOS, CHART, PRINT } from './qianfu-data.js';
import { createStudy } from './study-gl.js';

const $ = (id) => document.getElementById(id);
const qf = $('qf');
const stage = $('stage'), cam = $('cam');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const LAST_SPREAD = 2;

const state = { lamp: true, open: false, spread: 0 };

/* ---------- 台灯开关的“咔哒”声 ---------- */
let audioCtx = null;
function click() {
  try {
    audioCtx ??= new AudioContext();
    const a = audioCtx, now = a.currentTime;
    const buf = a.createBuffer(1, Math.round(a.sampleRate * 0.05), a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 6);
    const src = a.createBufferSource(), band = a.createBiquadFilter(), gain = a.createGain();
    src.buffer = buf; band.type = 'bandpass'; band.frequency.value = 2400; band.Q.value = 1.4;
    gain.gain.value = 0.35;
    src.connect(band).connect(gain).connect(a.destination);
    src.start(now);
  } catch { /* 没有声音也不影响 */ }
}

/* ---------- 状态 ---------- */
function render() {
  qf.dataset.lamp = state.lamp ? 'on' : 'off';
  qf.dataset.book = state.open ? 'open' : 'closed';
  qf.dataset.spread = String(state.spread);

  $('tLamp').setAttribute('aria-pressed', String(state.lamp));
  study?.setLamp(state.lamp);
  study?.setBookOpen(state.open);
  $('tLampText').textContent = state.lamp ? '关掉台灯' : '打开台灯';
  $('tBookText').textContent = state.open ? '合上手账' : '打开手账';
  $('tPrev').hidden = $('tNext').hidden = !state.open;
  $('tPrev').disabled = state.spread === 0;
  $('tNext').disabled = state.spread === LAST_SPREAD;

  // 只有看得见的那两页能点、能用 Tab 选中
  const visible = !state.open ? ['faceCover']
    : [['faceKraft', 'faceBlank'], ['faceCollage', 'faceLyrics'], ['facePoster', 'chart']][state.spread];
  for (const id of ['faceCover', 'faceKraft', 'faceBlank', 'faceCollage', 'faceLyrics', 'facePoster', 'chart']) $(id).inert = !visible.includes(id);

  $('qfSub').textContent = !state.lamp ? '灯关了，只剩窗外一点月光。拉一下台灯的绳子就能再打开。'
    : !state.open ? '台灯下放着一本手账。点封面翻开它，按住拖动可以看看四周。'
    : state.spread === 0 ? '扉页上贴着剧组全家福，点它看大图。往后翻是剪报和歌词。'
    : state.spread === 1 ? '点剧照或歌词页，看大图和人物说明。'
    : printDone() ? '指纹完整了。点一下指纹，看看纹路里藏着的台词。'
    : `点海报、照片或人物关系上的名字。每看一个人的说明，背后的指纹就显出一块（${seen.size} / ${PEOPLE_ORDER.length}）。`;
  renderMeter();
}

function setLamp(on) {
  if (on === state.lamp) return;
  click();
  state.lamp = on;
  render();
}

/* ---------- 镜头：按住拖动环顾四周，滚轮拉近拉远 ---------- */
const CAM0 = { yaw: 0, pitch: 26, R: 2000 };   // 默认：正对书桌，往下看 26°
const P0 = 1150, LOOK_Y = 80;                    // 透视距离；看的点比桌面高一点（单位 u）
const camS = { ...CAM0 };

/* 书房画在画布上（js/study-gl.js）；不支持 WebGL2 的浏览器只显示深色背景，手账照常能用 */
let study = null;
try { study = createStudy($('gl')); } catch (e) { console.warn('书房没有画出来：', e); }
let u = 1;
function geometry() {
  u = $('probe').getBoundingClientRect().width / 500 || 1;
  qf.style.setProperty('--persp', `${P0 * u}px`);
  // 翻开时手账飘到镜头前、离镜头正好一个透视距离，这样显示出来就是原大
  const k = (CAM0.R - P0) * u, a = (CAM0.pitch * Math.PI) / 180;
  qf.style.setProperty('--open-y', `${-LOOK_Y * u - k * Math.sin(a)}px`);
  qf.style.setProperty('--open-z', `${k * Math.cos(a)}px`);
  qf.style.setProperty('--open-rx', `${CAM0.pitch}deg`);
  applyCam();
}
function applyCam() {
  cam.style.transform = `translateZ(${(P0 - camS.R) * u}px) rotateX(${-camS.pitch}deg) rotateY(${camS.yaw}deg) translate3d(0, ${LOOK_Y * u}px, 0)`;
  study?.setCamera({ yaw: camS.yaw, pitch: camS.pitch, R: camS.R, P: P0 * u, lookY: LOOK_Y });
  placeCake();
}

/* ---------- 书桌右后角的小蛋糕：点它去下一页 ---------- */
// 模型画在画布上；火苗、字条和点击区域是网页元素，每次镜头动了就重新对齐一次。
function placeCake() {
  const layer = $('cakeLayer');
  const box = study?.cake();
  if (!box || !box.flame) { layer.hidden = true; return; }
  layer.hidden = false;
  const hit = $('cakeHit'), tag = $('cakeTag');
  const w = box.x1 - box.x0, h = box.y1 - box.y0;
  hit.style.cssText = `left:${box.x0}px;top:${box.y0}px;width:${w}px;height:${h}px;--fx:${box.flame[0] - box.x0}px;--fy:${box.flame[1] - box.y0}px;--cs:${(h / 150).toFixed(3)}`;
  const tw = tag.offsetWidth || 110, th = tag.offsetHeight || 24, W = qf.clientWidth;
  const tx = Math.min(W - tw - 10, Math.max(10, box.flame[0] - tw / 2));
  tag.style.left = `${tx}px`;
  tag.style.top = `${box.flame[1] - th - Math.max(18, h * 0.16)}px`;
  tag.style.setProperty('--arrow', `${box.flame[0] - tx}px`);
}
$('cakeHit').addEventListener('click', (e) => {
  e.preventDefault();
  if (qf.classList.contains('blowing')) return;
  const go = () => { location.href = $('cakeHit').getAttribute('href'); };
  if (reduceMotion.matches) { go(); return; }
  qf.classList.add('blowing');      // 吹灭蜡烛：火苗一缩，冒一缕烟，再去下一页
  setTimeout(go, 900);
});
// 从下一页按“返回”回来时，页面可能是从缓存里恢复的，把蜡烛重新点上
window.addEventListener('pageshow', () => qf.classList.remove('blowing'));
new ResizeObserver(geometry).observe(qf);
geometry();

let camAnim = 0;
function camHome(done) {
  cancelAnimationFrame(camAnim);
  camS.yaw = ((camS.yaw % 360) + 540) % 360 - 180; // 走最近的那条路转回来
  const from = { ...camS };
  const far = Math.abs(from.yaw) + Math.abs(from.pitch - CAM0.pitch) + Math.abs(from.R - CAM0.R) / 20;
  if (far < 0.5 || reduceMotion.matches) { Object.assign(camS, CAM0); applyCam(); done?.(); return; }
  const dur = Math.min(900, 300 + far * 4), t0 = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - t0) / dur), e = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
    for (const key of ['yaw', 'pitch', 'R']) camS[key] = from[key] + (CAM0[key] - from[key]) * e;
    applyCam();
    if (t < 1) camAnim = requestAnimationFrame(step); else done?.();
  };
  camAnim = requestAnimationFrame(step);
}

let drag = null, swallowClick = false;
stage.addEventListener('pointerdown', (e) => {
  if (state.open || !e.isPrimary) return;
  cancelAnimationFrame(camAnim);
  drag = { x: e.clientX, y: e.clientY, yaw: camS.yaw, pitch: camS.pitch, moved: false, id: e.pointerId };
});
window.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 5) return;
  if (!drag.moved) { drag.moved = true; stage.classList.add('dragging'); try { stage.setPointerCapture(e.pointerId); } catch { /* 忽略 */ } }
  camS.yaw = Math.min(70, Math.max(-70, drag.yaw + dx * 0.3)); // 转太多台灯会挡在手账前面
  camS.pitch = Math.min(55, Math.max(8, drag.pitch + dy * 0.2));
  applyCam();
});
window.addEventListener('pointerup', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  if (drag.moved) { swallowClick = true; setTimeout(() => { swallowClick = false; }, 0); }
  drag = null;
  stage.classList.remove('dragging');
});
qf.addEventListener('click', (e) => { if (swallowClick) { e.stopPropagation(); e.preventDefault(); } }, true);
stage.addEventListener('wheel', (e) => {
  if (state.open) return;
  e.preventDefault();
  camS.R = Math.min(2000, Math.max(1450, camS.R + e.deltaY * 1.2));
  applyCam();
}, { passive: false });

let hintTimer = 0;
function openBook() {
  if (state.open) return;
  if (camS.yaw !== CAM0.yaw || camS.pitch !== CAM0.pitch || camS.R !== CAM0.R) { camHome(() => { if (!state.open) openBook(); }); return; }
  state.open = true;
  state.spread = 0;
  render();
  // 刚翻开时，让照片上的放大镜小圆标亮一下，提示可以点
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => {
    qf.classList.add('hint');
    hintTimer = setTimeout(() => qf.classList.remove('hint'), 2200);
  }, reduceMotion.matches ? 0 : 1300);
  setTimeout(() => $('tBook').focus({ preventScroll: true }), 0);
}
function closeBook() {
  if (!state.open) return;
  qf.classList.remove('hint');
  state.open = false;
  state.spread = 0;
  render();
}
function flip(dir) {
  if (!state.open) return;
  const next = Math.min(LAST_SPREAD, Math.max(0, state.spread + dir));
  if (next === state.spread) return;
  state.spread = next;
  render();
  if (next === LAST_SPREAD) setTimeout(playReveals, reduceMotion.matches ? 0 : 900); // 等书页翻过来
}

// 点画面上的台灯开关；鼠标移到台灯上变成小手
stage.addEventListener('click', (e) => {
  if (state.open || e.target.closest('.cam .face, .cam button')) return;
  const r = stage.getBoundingClientRect();
  if (study?.pickLamp(e.clientX - r.left, e.clientY - r.top)) setLamp(!state.lamp);
});
stage.addEventListener('pointermove', (e) => {
  if (drag?.moved || state.open) return;
  const r = stage.getBoundingClientRect();
  stage.classList.toggle('over-lamp', Boolean(study?.pickLamp(e.clientX - r.left, e.clientY - r.top)) && !e.target.closest('.cam .face'));
});
$('tLamp').addEventListener('click', () => setLamp(!state.lamp));
$('tBook').addEventListener('click', () => (state.open ? closeBook() : openBook()));
$('coverHit').addEventListener('click', openBook);
$('tPrev').addEventListener('click', () => flip(-1));
$('tNext').addEventListener('click', () => flip(1));

// 在打开的本子上左右滑动也能翻页
let swipe = null;
$('book').addEventListener('pointerdown', (e) => { if (state.open) swipe = { x: e.clientX, y: e.clientY }; });
window.addEventListener('pointerup', (e) => {
  if (!swipe) return;
  const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
  swipe = null;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { flip(dx < 0 ? 1 : -1); suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); }
});
let suppressClick = false;

/* ---------- 螺旋线圈 ---------- */
$('coil').innerHTML = Array.from({ length: 17 }, (_, i) => `<i style="top:${((i + 0.5) / 17) * 100}%"></i>`).join('');

/* ---------- 人物关系页 ---------- */
function buildChart() {
  const { center, links } = CHART;
  const lines = [], labels = [];
  for (const l of links) {
    // 每条线微微弯一点，像手画的
    const mx = (center.x + l.x) / 2, my = (center.y + l.y) / 2;
    const nx = -(l.y - center.y), ny = l.x - center.x, len = Math.hypot(nx, ny) || 1;
    const bow = 2.2;
    const cx = mx + (nx / len) * bow, cy = my + (ny / len) * bow;
    lines.push(`<path d="M${center.x} ${center.y} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${l.x} ${l.y}"/>`);
    const t = 0.56; // 字写在线的中段稍靠外，避开中间的名字
    labels.push(`<span class="chart-label" style="left:${(center.x + (l.x - center.x) * t + (nx / len) * bow).toFixed(1)}%;top:${(center.y + (l.y - center.y) * t + (ny / len) * bow).toFixed(1)}%">${l.label}</span>`);
  }
  $('chartLines').innerHTML = lines.join('');
  const node = (id, x, y, cls, r) => {
    const p = PEOPLE[id];
    return `<button type="button" class="strip chart-node ${cls}" data-person="${id}" style="left:${x}%;top:${y}%;--r:${r}deg" aria-label="${p.name}的人物说明">${p.name}</button>`;
  };
  const tilt = [-2.5, 2, -1.5, 3, -2];
  $('chartNodes').innerHTML = labels.join('')
    + links.map((l, i) => node(l.id, l.x, l.y, '', tilt[i % tilt.length])).join('')
    + node(center.id, center.x, center.y, 'center', -1);
}
buildChart();

/* ---------- 人物关系页背后的指纹：每看一个人，显出一块 ----------
   指纹中心对准中间的名字。周围的人各管一块扇形（朝着这个人的方向，扇形的分界在相邻两人中间），
   中间的人管指纹中心那一圈。看过说明、关掉大图回到这一页时，那一块像撒了显影粉一样从中心往外慢慢显出来。 */
const PEOPLE_ORDER = [CHART.center.id, ...CHART.links.map((l) => l.id)];
const seen = new Set();            // 看过说明的人
let pendingReveal = [];            // 看过、但还没在页面上显出来的人
const printDone = () => seen.size === PEOPLE_ORDER.length;
const PAGE_ASPECT = 0.726;         // 一页的宽高比（和 css 里的 --ph 一致）
const printEl = $('print'), printCanvas = $('printInk'), printCtx = printCanvas.getContext('2d');
const maskCanvas = document.createElement('canvas'), inkCanvas = document.createElement('canvas');
const ink = new Image();
let inkReady = false;
const parts = new Map();           // id -> { a0, a1 }（扇形的起止角，弧度，画布坐标：0 = 向右，顺时针）；中间的人没有角度
const progress = new Map();        // id -> { p, start }（0~1，显出来多少）

function computeSectors() {
  // 页面上的方向：横向按页宽、纵向按页高算，才和真正看到的角度一致
  const angle = (l) => Math.atan2((l.y - CHART.center.y) / PAGE_ASPECT, l.x - CHART.center.x);
  const list = CHART.links.map((l) => ({ id: l.id, a: angle(l) })).sort((p, q) => p.a - q.a);
  list.forEach((cur, i) => {
    const prev = list[(i - 1 + list.length) % list.length], next = list[(i + 1) % list.length];
    let a0 = (prev.a + cur.a) / 2, a1 = (cur.a + next.a) / 2;
    if (i === 0) a0 = (prev.a - Math.PI * 2 + cur.a) / 2;              // 跨过 ±180° 的那一段
    if (i === list.length - 1) a1 = (cur.a + next.a + Math.PI * 2) / 2;
    parts.set(cur.id, { a0, a1 });
  });
  parts.set(CHART.center.id, null);
}
computeSectors();

function sizePrint() {
  printEl.style.width = `${PRINT.width}%`;
  printEl.style.aspectRatio = `${PRINT.w} / ${PRINT.h}`;
  printEl.style.transform = `translate(${-PRINT.core[0] * 100}%, ${-PRINT.core[1] * 100}%)`;
  const hit = $('printHit');
  hit.style.width = printEl.style.width; hit.style.aspectRatio = printEl.style.aspectRatio; hit.style.transform = printEl.style.transform;
  // offsetWidth 是排版尺寸，不受三维变换影响
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(2, Math.round(printEl.offsetWidth * dpr)), h = Math.max(2, Math.round(printEl.offsetHeight * dpr));
  if (printCanvas.width !== w || printCanvas.height !== h) {
    for (const c of [printCanvas, maskCanvas, inkCanvas]) { c.width = w; c.height = h; }
    drawPrint(performance.now());
  }
}
function regionPath(ctx, id, w, h) {
  const cx = PRINT.core[0] * w, cy = PRINT.core[1] * h, rIn = PRINT.coreRadius * w, rOut = Math.hypot(w, h);
  const sec = parts.get(id);
  ctx.beginPath();
  if (!sec) { ctx.arc(cx, cy, rIn, 0, Math.PI * 2); return; }
  ctx.arc(cx, cy, rOut, sec.a0, sec.a1);
  ctx.arc(cx, cy, rIn, sec.a1, sec.a0, true);
  ctx.closePath();
}
const easeOut = (x) => 1 - (1 - x) ** 3;
let printAnim = 0;
function drawPrint(now) {
  const w = printCanvas.width, h = printCanvas.height;
  const ctx = printCtx;
  ctx.clearRect(0, 0, w, h);
  if (!inkReady) return false;
  const cx = PRINT.core[0] * w, cy = PRINT.core[1] * h, rIn = PRINT.coreRadius * w, rOut = Math.hypot(w, h) * 0.62;
  // 1. 若有若无的潜伏指纹
  ctx.globalAlpha = 0.085;
  ctx.drawImage(ink, 0, 0, w, h);
  ctx.globalAlpha = 1;
  // 2. 显出来的部分：先画一张遮罩（每一块按显影进度，从中心往外，边缘是软的），再用遮罩抠出指纹
  const m = maskCanvas.getContext('2d');
  m.clearRect(0, 0, w, h);
  let moving = false;
  const fronts = [];
  for (const [id, st] of progress) {
    const p = reduceMotion.matches ? 1 : easeOut(Math.min(1, Math.max(0, (now - st.start) / 1300)));
    st.p = p;
    if (p <= 0) { moving = true; continue; }
    const inner = parts.get(id) ? rIn : 0, outer = parts.get(id) ? rOut : rIn;
    const front = inner + (outer - inner) * p, soft = Math.max(2, w * 0.06) * (1 - p) + 1;
    if (p >= 1) m.fillStyle = '#000';
    else {
      const g = m.createRadialGradient(cx, cy, Math.max(0, front - soft), cx, cy, front + 0.01);
      g.addColorStop(0, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
      m.fillStyle = g;
      moving = true;
      fronts.push({ id, front });
    }
    regionPath(m, id, w, h);
    m.fill();
  }
  const k = inkCanvas.getContext('2d');
  k.globalCompositeOperation = 'source-over';
  k.clearRect(0, 0, w, h);
  k.drawImage(ink, 0, 0, w, h);
  k.globalCompositeOperation = 'destination-in';
  k.drawImage(maskCanvas, 0, 0);
  k.globalCompositeOperation = 'source-over';
  ctx.drawImage(inkCanvas, 0, 0);
  // 3. 正在显影的那一圈前沿，带一点暖色的“粉”
  for (const f of fronts) {
    ctx.save();
    regionPath(ctx, f.id, w, h);
    ctx.clip();
    ctx.strokeStyle = 'rgba(176, 92, 40, 0.28)';
    ctx.lineWidth = Math.max(2, w * 0.018);
    ctx.shadowColor = 'rgba(176, 92, 40, 0.5)';
    ctx.shadowBlur = w * 0.02;
    ctx.beginPath(); ctx.arc(cx, cy, f.front, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  return moving;
}
function tickPrint(now) {
  if (drawPrint(now)) printAnim = requestAnimationFrame(tickPrint);
  else printAnim = 0;
}
function animatePrint() {
  cancelAnimationFrame(printAnim);
  printAnim = requestAnimationFrame(tickPrint);
}
ink.onload = () => { inkReady = true; sizePrint(); drawPrint(performance.now()); };
ink.src = PRINT.ink;
new ResizeObserver(sizePrint).observe(printEl);

function renderMeter() {
  const n = seen.size, all = PEOPLE_ORDER.length;
  $('printMeter').innerHTML = printDone() ? '指纹完整 · 点它看大图' : `指纹比对 <b>${n}</b> / ${all}`;
  $('chart').classList.toggle('done', printDone());
  $('printHit').setAttribute('aria-label', printDone() ? '看大图：由台词拼成的指纹' : `指纹：还差 ${all - n} 个人的说明没看`);
  for (const el of document.querySelectorAll('.chart-node')) el.classList.toggle('seen', seen.has(el.dataset.person));
}
/** 看了一个人的说明 */
function markSeen(id) {
  if (!PEOPLE_ORDER.includes(id) || seen.has(id)) return;
  seen.add(id);
  pendingReveal.push(id);
}
/** 回到人物关系页时，把新看过的人一块块显出来 */
function playReveals() {
  if (!pendingReveal.length) return;
  const now = performance.now();
  pendingReveal.forEach((id, i) => progress.set(id, { p: 0, start: now + 250 + i * 420 }));
  pendingReveal = [];
  render();
  animatePrint();
}
$('printHit').addEventListener('click', (e) => {
  if (printDone()) { openLightbox('photo', photoList().findIndex((p) => p.id === 'print'), e.currentTarget); return; }
  const meter = $('printMeter');
  meter.classList.remove('nudge');
  void meter.offsetWidth;
  meter.classList.add('nudge');
});

/* ---------- 大图和人物说明 ---------- */
const PERSON_PHOTO = { zuolan: 'zuolan-photo', wanqiu: 'note' }; // 人物卡上配的图（有的话）
/** 大图里能翻到的图片：指纹要等人物关系全部看完才出现 */
const photoList = () => PHOTOS.filter((p) => !p.locked || printDone());
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let lb = { mode: 'photo', index: 0, opener: null };

function personHTML(id) {
  const p = PEOPLE[id];
  if (!p) return '';
  const facts = p.facts?.length
    ? `<dl class="person-facts">${p.facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : '';
  return `<section class="person"><h3 class="person-name">${esc(p.name)}${p.actor ? `<span class="person-actor">${esc(p.actor)} 饰</span>` : ''}</h3>${facts}<p class="person-bio">${esc(p.bio)}</p></section>`;
}

function renderLightbox() {
  const body = document.querySelector('.lb-body');
  const img = $('lbImg');
  let photo = null, title = '', caption = '', people = [], count = 0;
  if (lb.mode === 'photo') {
    const list = photoList();
    photo = list[lb.index];
    ({ title, caption, people } = photo);
    count = list.length;
  } else {
    const id = PEOPLE_ORDER[lb.index];
    photo = PERSON_PHOTO[id] ? PHOTOS.find((p) => p.id === PERSON_PHOTO[id]) : null;
    title = `人物说明：${PEOPLE[id].name}`;
    caption = '';
    people = [id];
    count = PEOPLE_ORDER.length;
    markSeen(id);
  }
  body.classList.toggle('text-only', !photo);
  body.classList.toggle('wide', Boolean(photo) && photo.w / photo.h > 1.3);
  if (photo) {
    img.src = photo.src;
    img.width = photo.w; img.height = photo.h;
    img.alt = photo.title;
  } else img.removeAttribute('src');
  $('lbTitle').textContent = title;
  $('lbCaption').textContent = caption;
  $('lbCaption').hidden = !caption;
  $('lbPeople').innerHTML = people.map(personHTML).join('');
  $('lbNotes').scrollTop = 0;
  $('lbCount').textContent = `${lb.index + 1} / ${count}`;
  $('lbPrev').disabled = lb.index === 0;
  $('lbNext').disabled = lb.index === count - 1;
  $('lbPrevText').textContent = lb.mode === 'photo' ? '上一张' : '上一位';
  $('lbNextText').textContent = lb.mode === 'photo' ? '下一张' : '下一位';
}

function openLightbox(mode, index, opener) {
  lb = { mode, index, opener };
  renderLightbox();
  $('lb').hidden = false;
  document.querySelector('.lb-close').focus({ preventScroll: true });
}
function closeLightbox() {
  $('lb').hidden = true;
  lb.opener?.focus?.({ preventScroll: true });
  if (state.open && state.spread === LAST_SPREAD) playReveals();
  else render();
}
function stepLightbox(d) {
  const count = lb.mode === 'photo' ? photoList().length : PEOPLE_ORDER.length;
  const i = lb.index + d;
  if (i < 0 || i >= count) return;
  lb.index = i;
  renderLightbox();
}

$('book').addEventListener('click', (e) => {
  if (suppressClick) return;
  const ph = e.target.closest('[data-photo]');
  if (ph) { openLightbox('photo', photoList().findIndex((p) => p.id === ph.dataset.photo), ph); return; }
  const pe = e.target.closest('[data-person]');
  if (pe) openLightbox('person', PEOPLE_ORDER.indexOf(pe.dataset.person), pe);
});
$('lb').addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeLightbox(); });
$('lbPrev').addEventListener('click', () => stepLightbox(-1));
$('lbNext').addEventListener('click', () => stepLightbox(1));

/* ---------- 键盘 ---------- */
document.addEventListener('keydown', (e) => {
  if (!$('lb').hidden) {
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft') stepLightbox(-1);
    else if (e.key === 'ArrowRight') stepLightbox(1);
    else if (e.key === 'Tab') {
      const f = [...$('lb').querySelectorAll('button:not(:disabled)')];
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
    return;
  }
  if (e.key === 'Escape' && state.open) closeBook();
  else if (e.key === 'ArrowLeft' && state.open) flip(-1);
  else if (e.key === 'ArrowRight' && state.open) flip(1);
});

render();
