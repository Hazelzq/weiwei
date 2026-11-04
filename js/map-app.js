// 地图页：一本摊开的册子。右页地图上放下“我们走过的地方”，每处配一张照片，
// 左页按顺序夹上植物标本；四川、河北两处出生地用红灯笼标出。
import { createMapScene, deskAnchor } from './map-scene.js';
import { createBookPainter, fracOf, unproject, MAP_RECT, PLANTS, SLOTS } from './book-art.js';
import { readPins, savePin, deletePin, readBase, saveBase } from './map-storage.js';
import { loadPhoto } from './photos.js';
import { ChimeAudio } from './sounds.js';
import { loadShareMap, mountShareButton } from './share.js';

const $ = (id) => document.getElementById(id);
const MAX_PINS = 40;
const MAX_SIZE = 50 * 1024 * 1024;
const okType = (f) => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type.toLowerCase()) || /\.(jpe?g|png|webp)$/i.test(f.name);
const isHeic = (f) => /\.(heic|heif)$/i.test(f.name) || /^image\/hei[cf]/i.test(f.type);
const audio = new ChimeAudio();
const play = (k) => audio.play(k);

/* ---------- 开场：相机从相机包里弹出来，咔嚓一声，收回包里，再翻开册子 ---------- */
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fromCarousel = (() => { try { return new URL(document.referrer).pathname.endsWith('carousel.html'); } catch { return false; } })();
const wantIntro = (fromCarousel || /[?&]intro\b/.test(location.search)) && !reducedMotion;
let sfx = null;
function sfxContext() {
  try { sfx ??= new AudioContext(); void sfx.resume(); return sfx; } catch { return null; }
}
function noiseBurst(a, at, dur, type, freq, q, gain) {
  const len = Math.ceil(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = buf; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start(at);
}
function shutterSound() {
  const a = sfxContext();
  if (!a) return;
  const t = a.currentTime + 0.01;
  noiseBurst(a, t, 0.035, 'bandpass', 3400, 1.4, 0.9);
  noiseBurst(a, t + 0.012, 0.07, 'lowpass', 900, 0.8, 0.7);
  noiseBurst(a, t + 0.095, 0.03, 'bandpass', 2600, 1.6, 0.55);
  noiseBurst(a, t + 0.105, 0.06, 'lowpass', 700, 0.8, 0.45);
}
function pageSound() {
  const a = sfxContext();
  if (!a) return;
  const t = a.currentTime + 0.02;
  for (let k = 0; k < 5; k++) noiseBurst(a, t + k * 0.11 + Math.random() * 0.05, 0.22, 'bandpass', 1800 + Math.random() * 1400, 0.7, 0.12);
  noiseBurst(a, t + 0.95, 0.12, 'lowpass', 420, 0.7, 0.35);
}
function flash() {
  const f = $('flash');
  f.classList.remove('on');
  void f.offsetWidth;
  f.classList.add('on');
}
function zoomToBook() { $('atlas').classList.add('reading'); }
/** 背景照片放大时，以桌垫中心为原点。 */
function placeDeskOrigin() {
  const a = $('atlas'), m = deskAnchor(a.clientWidth, a.clientHeight);
  a.style.setProperty('--mat-x', `${m.x}px`);
  a.style.setProperty('--mat-y', `${m.y}px`);
}
placeDeskOrigin();
new ResizeObserver(placeDeskOrigin).observe($('atlas'));
/* ---------- 合上 / 翻开册子 ---------- */
let bookClosed = false, bookMoving = false, closedHinted = false;
function closeBook() {
  if (!scene || scene.busy || bookClosed || busy) return;
  if (mode !== 'idle') setMode('idle');
  for (const name of Object.keys(dialogs)) if (!dialogs[name].root.hidden) return;
  selected = null;
  bookClosed = true; bookMoving = true;
  $('atlas').classList.add('closed');
  render();
  scene.closeBook({
    onFold: pageSound,
    onUnzoom: () => $('atlas').classList.remove('reading'),
    onDone: () => {
      bookMoving = false;
      render();
      if (!closedHinted) { closedHinted = true; notify('按住拖动可以看看书桌四周；点一下相机包，可以再拍一张。'); }
    },
  });
}
/** 合上册子时点相机包：相机再弹出来拍一张。 */
function snapAgain() {
  if (!scene || scene.busy || !bookClosed || bookMoving) return;
  scene.snap({ onFlash: () => { flash(); shutterSound(); } });
}
function openBook() {
  if (!scene || scene.busy || !bookClosed) return;
  bookMoving = true;
  render();
  scene.openBook({
    onUnfold: pageSound,
    onZoom: zoomToBook,
    onDone: () => { bookClosed = false; bookMoving = false; $('atlas').classList.remove('closed'); render(); },
  });
}
let introPending = false, skipWanted = false;
function skipIntro() {
  if (scene?.introPlaying) scene.skipIntro();
  else if (introPending) skipWanted = true; // 还在准备：准备好以后直接翻开
}
function endIntro() {
  $('atlas').classList.remove('opening');
  $('skipIntro').hidden = true;
  render();
}

/** 两个出生地的默认位置（成都、石家庄）。可在页面上用「移动位置」挪到具体的城市。 */
const BIRTH_DEFAULTS = [
  { id: 'birth-sichuan', kind: 'birth', seal: '川', title: '四川', note: '', lon: 104.07, lat: 30.67 },
  { id: 'birth-hebei', kind: 'birth', seal: '冀', title: '河北', note: '', lon: 114.51, lat: 38.04 },
];

let pins = [];   // 走过的地方（按顺序）
let births = []; // 出生地
let scene = null, ready = false, busy = false;
let mode = 'idle'; // idle | placing | moving
let movingId = null, pendingPoint = null, selected = null;
let editing = null;
let usingDefault = true;
// 这个浏览器里没有自己的地图时，显示仓库 share/ 里的那份；第一次改动时先把那份整个存进本机，再改。
let fromShare = false, shareBase = null;
const painter = createBookPainter();
const pageCanvas = document.createElement('canvas');

const all = () => [...pins, ...births];
const find = (id) => all().find((p) => p.id === id);
const isBirth = (p) => p?.kind === 'birth';

/* ---------- 小部件 ---------- */
let toastTimer = 0;
function notify(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.toggle('show', Boolean(text));
  clearTimeout(toastTimer);
  if (text) toastTimer = setTimeout(() => t.classList.remove('show'), 4200);
}
function show(el, text) { el.hidden = !text; el.textContent = text || ''; }
function setSaving(state) {
  const el = $('saveStatus');
  el.hidden = state === 'saved';
  el.dataset.state = state === 'saving' ? 'saving' : 'error';
  el.textContent = state === 'saving' ? '正在保存…' : '保存未完成，请重试';
}
async function persist(work) {
  setSaving('saving');
  try {
    if (fromShare) {
      for (const p of all()) await savePin(stored(p));
      if (shareBase) await saveBase(shareBase);
      fromShare = false;
    }
    await work();
    setSaving('saved');
    void shareButton.refresh();
  } catch (e) { setSaving('error'); throw e; }
}
async function shrink(image) {
  const iw = image.naturalWidth, ih = image.naturalHeight;
  const s = Math.min(1, 1600 / Math.max(iw, ih));
  const cv = document.createElement('canvas');
  cv.width = Math.round(iw * s); cv.height = Math.round(ih * s);
  cv.getContext('2d').drawImage(image, 0, 0, cv.width, cv.height);
  return new Promise((resolve, reject) => cv.toBlob((b) => (b ? resolve(b) : reject(new Error('照片处理失败，请换一张试试。'))), 'image/jpeg', 0.9));
}
async function readImage(file) {
  if (!okType(file) && !isHeic(file)) throw new Error('请选择 JPG、PNG 或 WebP 格式的图片。');
  if (file.size > MAX_SIZE) throw new Error('请选择 50 MB 以内的图片。');
  const url = URL.createObjectURL(file);
  try { return await loadPhoto(url); }
  catch (e) { throw isHeic(file) ? new Error('这张 HEIC 照片当前浏览器无法直接读取，请在相册中导出为 JPG 后再试。') : e; }
  finally { URL.revokeObjectURL(url); }
}
const stored = (p) => ({ id: p.id, kind: p.kind || 'stop', seal: p.seal, order: p.order, lon: p.lon, lat: p.lat,
  title: p.title, note: p.note, photo: p.photo ?? null, created: p.created });

/* ---------- 书页与 3D 同步 ---------- */
let pageJob = Promise.resolve();
function refreshPages() {
  pageJob = pageJob.then(async () => {
    await painter.compose(pageCanvas, pins, births);
    scene?.setPages(pageCanvas);
  }).catch(() => {});
  return pageJob;
}
function syncScene() {
  scene?.syncPins(pins.map((p) => {
    const [fx, fy] = fracOf(p.lon, p.lat);
    return { id: p.id, fx, fy, title: p.title, image: p.image, imageKey: p.url };
  }));
  scene?.syncBirths(births.map((b) => { const [fx, fy] = fracOf(b.lon, b.lat); return { id: b.id, fx, fy }; }));
  void refreshPages();
}

/* ---------- 对话框 ---------- */
const dialogs = {
  pin: { root: $('pinDialog'), onClose: () => closePinDialog() },
  base: { root: $('baseDialog'), onClose: () => {} },
};
let lastFocus = null;
function openDialog(name) {
  lastFocus = document.activeElement;
  dialogs[name].root.hidden = false;
  const popup = dialogs[name].root.querySelector('.dialog-popup');
  popup.tabIndex = -1;
  popup.focus();
}
function closeDialog(name) {
  dialogs[name].root.hidden = true;
  lastFocus?.focus?.();
}
for (const [name, d] of Object.entries(dialogs)) {
  d.root.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]') && !busy) { closeDialog(name); d.onClose(); }
  });
}
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  for (const [name, d] of Object.entries(dialogs)) {
    if (!d.root.hidden) { if (!busy) { closeDialog(name); d.onClose(); } return; }
  }
  if (mode !== 'idle') setMode('idle');
  else if (selected) selectPin(null);
});

/* ---------- 渲染 ---------- */
function render() {
  const n = pins.length;
  $('count').textContent = n ? `已记下 ${n} 个地方` : '还没有记下地方';
  $('addBtn').disabled = !ready || busy;
  $('baseBtn').disabled = !ready || busy;
  $('resetBtn').disabled = !ready;
  $('closeBtn').disabled = !ready || busy;
  $('openBar').hidden = !bookClosed || bookMoving;
  $('emptyHint').hidden = !ready || n > 0 || mode !== 'idle' || Boolean(selected);
  $('placeBanner').hidden = mode === 'idle' || !$('pinDialog').hidden;
  $('placeText').textContent = mode === 'moving' ? '在右页地图上点一下新位置' : '在右页地图上点一下这个地方';
  $('baseDefault').disabled = usingDefault || busy;
  $('baseChoose').disabled = busy;
  $('atlas').classList.toggle('has-stop', Boolean(selected));
  document.body.classList.toggle('has-stop', Boolean(selected));
  renderStop();
}
function renderStop() {
  const pin = find(selected);
  $('stopCard').hidden = !pin;
  if (!pin) return;
  const birth = isBirth(pin);
  const index = pins.indexOf(pin);
  $('stopPhotoBox').hidden = !pin.url;
  if (pin.url) $('stopImg').src = pin.url;
  $('stopTitle').textContent = pin.title;
  show($('stopNote'), pin.note || (birth ? '我们之中有一个人在这里出生。可以点「编辑」放一张老照片。' : ''));
  $('stopMeta').textContent = birth
    ? `出生地 · ${pin.seal}`
    : `第 ${index + 1} 站 / 共 ${pins.length} 站${index < SLOTS.length ? ` · 夹着一片${PLANTS[index % PLANTS.length].name}` : ''}`;
  $('stopSeal').hidden = !birth;
  $('stopSeal').textContent = pin.seal || '';
  $('stopSteps').hidden = birth;
  $('prevStop').disabled = index <= 0;
  $('nextStop').disabled = index < 0 || index === pins.length - 1;
  $('deleteStop').hidden = birth;
}

/* ---------- 模式与选择 ---------- */
function setMode(next, id = null) {
  mode = next;
  movingId = next === 'moving' ? id : null;
  scene?.setPlacing(next !== 'idle');
  if (next !== 'idle') { selected = null; scene?.select(null); }
  render();
}
function selectPin(id) {
  selected = id;
  resetDelete();
  if (id) { scene?.focus(id); play('select'); } else scene?.reset();
  render();
}

/* ---------- 添加 / 编辑 ---------- */
function openPinDialog(pin) {
  editing = pin
    ? { id: pin.id, birth: isBirth(pin), file: null, url: pin.url || '', image: pin.image || null }
    : { id: null, birth: false, file: null, url: '', image: null };
  $('pinTitle').textContent = !pin ? '记下这个地方' : editing.birth ? '编辑出生地' : '编辑地点';
  $('pinSaveLabel').textContent = pin ? '保存修改' : '夹进书里';
  $('pinNameLabel').textContent = editing.birth ? '名称（如：成都、乐山）' : '地点名称';
  $('pinEmptyText').textContent = editing.birth ? '可选：放一张老照片' : '选一张这里的照片';
  $('pinName').value = pin?.title ?? '';
  $('pinNote').value = pin?.note ?? '';
  show($('pinError'), '');
  renderPinPreview();
  openDialog('pin');
  render();
}
function renderPinPreview() {
  const has = Boolean(editing?.url);
  $('pinPreview').hidden = !has;
  if (has) $('pinPreview').src = editing.url;
  $('pinEmpty').hidden = has;
  $('pinPhotoLabel').textContent = has ? '换一张照片' : '选择照片';
  $('pinPhotoBtn').disabled = busy;
  $('pinSave').disabled = busy;
  $('pinCancel').disabled = busy;
}
function closePinDialog() {
  if (editing?.file && editing.url) URL.revokeObjectURL(editing.url);
  editing = null;
  pendingPoint = null;
  scene?.setGhost(null);
  if (mode === 'placing') setMode('idle');
  render();
}
async function choosePinPhoto(file) {
  if (!file || !editing) return;
  show($('pinError'), '');
  busy = true; renderPinPreview();
  try {
    const image = await readImage(file);
    const blob = await shrink(image);
    const url = URL.createObjectURL(blob);
    const img = await loadPhoto(url);
    if (!editing) { URL.revokeObjectURL(url); return; }
    if (editing.file && editing.url) URL.revokeObjectURL(editing.url);
    Object.assign(editing, { file: blob, url, image: img });
    if (!$('pinName').value.trim()) $('pinName').focus();
  } catch (e) {
    show($('pinError'), e.message);
  } finally { busy = false; renderPinPreview(); }
}
async function savePinDialog() {
  if (!editing || busy) return;
  const title = $('pinName').value.trim();
  const note = $('pinNote').value.trim();
  if (!editing.url && !editing.birth) { show($('pinError'), '请先选一张照片。'); return; }
  if (!title) { show($('pinError'), '请写下名称。'); $('pinName').focus(); return; }
  busy = true; renderPinPreview();
  try {
    let focusId;
    if (editing.id) {
      const pin = find(editing.id);
      const photo = editing.file ?? pin.photo ?? null;
      await persist(() => savePin({ ...stored(pin), title, note, photo }));
      if (editing.file && pin.url) URL.revokeObjectURL(pin.url);
      Object.assign(pin, { title, note, photo, url: editing.url, image: editing.image });
      editing.file = null;
      focusId = pin.id;
      notify(isBirth(pin) ? '出生地已更新。' : '地点已更新，已自动保存到本机。');
    } else {
      const point = pendingPoint;
      const pin = {
        id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, kind: 'stop',
        order: (pins.at(-1)?.order ?? 0) + 1, lon: point.lon, lat: point.lat,
        title, note, photo: editing.file, created: Date.now(),
      };
      await persist(() => savePin(pin));
      pins.push({ ...pin, url: editing.url, image: editing.image });
      editing.file = null;
      focusId = pin.id;
      const i = pins.length - 1;
      notify(i < SLOTS.length
        ? `“${title}”是第 ${pins.length} 站，左页夹上了一片${PLANTS[i % PLANTS.length].name}。`
        : `“${title}”已放到地图上，是第 ${pins.length} 站。`);
    }
    play('hang');
    busy = false;
    closeDialog('pin');
    closePinDialog();
    setMode('idle');
    syncScene();
    selected = focusId;
    scene?.focus(focusId);
    render();
  } catch (e) {
    show($('pinError'), e.message);
  } finally { busy = false; if (editing) renderPinPreview(); render(); }
}

/* ---------- 放置（新地点 / 移动） ---------- */
async function onPick(point) {
  if (mode === 'placing') {
    if (pins.length >= MAX_PINS) { notify(`地图上最多放 ${MAX_PINS} 个地方。`); setMode('idle'); return; }
    pendingPoint = point;
    scene.setGhost([point.fx, point.fy]);
    openPinDialog(null);
  } else if (mode === 'moving') {
    const pin = find(movingId);
    if (!pin) { setMode('idle'); return; }
    try {
      await persist(() => savePin({ ...stored(pin), lon: point.lon, lat: point.lat }));
      Object.assign(pin, { lon: point.lon, lat: point.lat });
      setMode('idle');
      syncScene();
      selectPin(pin.id);
      play('hang');
      notify(`“${pin.title}”已移到新位置。`);
    } catch (e) { notify(e.message); }
  }
}

/* ---------- 删除（再点一次确认） ---------- */
let deleteArmed = false, deleteTimer = 0;
function resetDelete() {
  deleteArmed = false;
  clearTimeout(deleteTimer);
  $('deleteLabel').textContent = '删除';
  $('deleteStop').classList.remove('armed');
}
async function deleteSelected() {
  const pin = pins.find((p) => p.id === selected);
  if (!pin) return;
  if (!deleteArmed) {
    deleteArmed = true;
    $('deleteLabel').textContent = '再点一次删除';
    $('deleteStop').classList.add('armed');
    deleteTimer = setTimeout(resetDelete, 3500);
    return;
  }
  resetDelete();
  try {
    await persist(() => deletePin(pin.id));
    if (pin.url) URL.revokeObjectURL(pin.url);
    pins = pins.filter((p) => p.id !== pin.id);
    syncScene();
    selectPin(null);
    notify(`已删除“${pin.title}”。`);
  } catch (e) { notify(e.message); }
}

/* ---------- 底图 ---------- */
async function applyBase(blob) {
  if (blob) {
    const url = URL.createObjectURL(blob);
    try { await painter.setBase(await loadPhoto(url)); } finally { URL.revokeObjectURL(url); }
  } else await painter.setBase(null);
  usingDefault = !blob;
  await refreshPages();
}
async function chooseBase(file) {
  if (!file) return;
  show($('baseError'), '');
  busy = true; render();
  try {
    const image = await readImage(file);
    const s = Math.min(1, 3000 / Math.max(image.naturalWidth, image.naturalHeight));
    const cv = document.createElement('canvas');
    cv.width = Math.round(image.naturalWidth * s); cv.height = Math.round(image.naturalHeight * s);
    cv.getContext('2d').drawImage(image, 0, 0, cv.width, cv.height);
    const blob = await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.9));
    await persist(() => saveBase(blob));
    await applyBase(blob);
    closeDialog('base');
    notify('右页的地图已更换，已自动保存到本机。');
  } catch (e) {
    show($('baseError'), e.message);
  } finally { busy = false; render(); }
}

/* ---------- 事件 ---------- */
$('addBtn').addEventListener('click', () => {
  if (pins.length >= MAX_PINS) { notify(`地图上最多放 ${MAX_PINS} 个地方。`); return; }
  setMode(mode === 'placing' ? 'idle' : 'placing');
  play('select');
});
$('cancelPlace').addEventListener('click', () => setMode('idle'));
$('baseBtn').addEventListener('click', () => { show($('baseError'), ''); openDialog('base'); play('select'); });
$('resetBtn').addEventListener('click', () => selectPin(null));
$('baseChoose').addEventListener('click', () => $('baseFile').click());
$('baseFile').addEventListener('change', (e) => { void chooseBase(e.target.files?.[0]); e.target.value = ''; });
$('baseDefault').addEventListener('click', async () => {
  busy = true; render();
  try {
    await persist(() => saveBase(null));
    await applyBase(null);
    closeDialog('base');
    notify('已换回水墨地图。');
  } catch (e) { show($('baseError'), e.message); } finally { busy = false; render(); }
});
$('pinPhotoBtn').addEventListener('click', () => $('pinFile').click());
$('pinFile').addEventListener('change', (e) => { void choosePinPhoto(e.target.files?.[0]); e.target.value = ''; });
$('pinCancel').addEventListener('click', () => { if (!busy) { closeDialog('pin'); closePinDialog(); } });
$('pinSave').addEventListener('click', () => void savePinDialog());
$('pinName').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); void savePinDialog(); } });
$('closeStop').addEventListener('click', () => selectPin(null));
$('prevStop').addEventListener('click', () => {
  const i = pins.findIndex((p) => p.id === selected);
  if (i > 0) selectPin(pins[i - 1].id);
});
$('nextStop').addEventListener('click', () => {
  const i = pins.findIndex((p) => p.id === selected);
  if (i >= 0 && i < pins.length - 1) selectPin(pins[i + 1].id);
});
$('editStop').addEventListener('click', () => { const pin = find(selected); if (pin) openPinDialog(pin); });
$('moveStop').addEventListener('click', () => { if (selected) setMode('moving', selected); });
$('deleteStop').addEventListener('click', () => void deleteSelected());
$('skipIntro').addEventListener('click', skipIntro);
$('closeBtn').addEventListener('click', closeBook);
$('openBtn').addEventListener('click', openBook);
$('scene').addEventListener('pointerup', () => { if (scene?.introPlaying || introPending) skipIntro(); });

const shareButton = mountShareButton($('atlas'), notify);

/* ---------- 启动 ---------- */
async function hydrate(p) {
  if (!(p.photo instanceof Blob)) return { ...p, url: '', image: null };
  const url = URL.createObjectURL(p.photo);
  try { return { ...p, url, image: await loadPhoto(url) }; } catch { URL.revokeObjectURL(url); return { ...p, url: '', image: null }; }
}
async function start() {
  try {
    scene = createMapScene($('scene'), {
      onPick: (p) => void onPick(p),
      onPickMiss: () => notify('请点在右页的地图上。'),
      onSelect: (id) => { if (mode === 'idle') selectPin(id); },
      onSlot: (slot, hoverOnly) => {
        const pin = pins[slot];
        if (pin && !hoverOnly && mode === 'idle') selectPin(pin.id);
        return Boolean(pin);
      },
      onError: notify,
      onBookTap: openBook,
      onBagTap: snapAgain,
      intro: wantIntro,
    });
    if (wantIntro) {
      // 先不动：书桌上只有合着的册子和相机包。等下面把书页画好、贴图和着色器准备好，再开始开场动画
      introPending = true;
      $('atlas').classList.add('opening');
      $('skipIntro').hidden = false;
      $('loading').hidden = true;
    } else {
      zoomToBook();
    }
  } catch {
    $('loading').textContent = '这个浏览器暂时无法显示 3D 场景，请开启硬件加速或换一个浏览器。';
    return;
  }
  let base = null;
  try {
    base = await readBase();
    let saved = await readPins();
    // 本机还没有存过地图：用仓库 share/ 里的分享内容
    if (!saved.length && !(base instanceof Blob)) {
      const shared = await loadShareMap();
      if (shared) { saved = shared.pins; base = shared.base; shareBase = base; fromShare = true; }
    }
    // 旧版沙盘地图存的是 u/v 比例，这里换算成经纬度。
    for (const p of saved) {
      if (!Number.isFinite(p.lon) && Number.isFinite(p.u)) {
        [p.lon, p.lat] = unproject(MAP_RECT.x + p.u * MAP_RECT.w, MAP_RECT.y + p.v * MAP_RECT.h);
      }
    }
    const stops = saved.filter((p) => p.kind !== 'birth' && p.photo instanceof Blob).sort((a, b) => a.order - b.order);
    pins = (await Promise.all(stops.map(hydrate))).filter((p) => p.url);
    births = await Promise.all(BIRTH_DEFAULTS.map((d) => hydrate({ ...d, ...(saved.find((p) => p.id === d.id) || {}) })));
  } catch (e) {
    births = BIRTH_DEFAULTS.map((d) => ({ ...d, url: '', image: null }));
    notify(e.message);
    setSaving('error');
  }
  try { await applyBase(base instanceof Blob ? base : null); } catch { await applyBase(null); }
  syncScene();
  await pageJob;
  if (wantIntro) {
    const slow = setTimeout(() => { if (introPending) { $('loading').textContent = '正在布置书桌…'; $('loading').hidden = false; } }, 1500);
    sfxContext(); // 提前建好声音，按快门的那一下就不用再等
    try { await scene.prepare(); } catch { /* 预热不成功也照常播放 */ } finally { scene.reveal(); }
    clearTimeout(slow);
    $('loading').hidden = true;
    introPending = false;
    scene.startIntro({ onFlash: () => { flash(); shutterSound(); }, onOpen: pageSound, onZoom: zoomToBook, onDone: endIntro });
    if (skipWanted) scene.skipIntro();
  }
  ready = true;
  $('loading').hidden = true;
  render();
}
void start();
