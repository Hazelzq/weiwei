// 首页：旋转木马相片灯。原版 app/page.tsx（React）的纯 JS 版本。
// 教学版改动：固定为夜晚 + 旋转 + 起风；去掉对应按钮；新增地图入口；署名移到最后一页。
import { createCarousel } from './carousel-scene.js';
import { PHOTO_COUNT, initialCrop, loadPhoto, drawCrop } from './photos.js';
import { ChimeAudio } from './sounds.js';
import { readSavedPhotos, savePhotosLocally } from './photo-storage.js';
import { icon } from './icons.js';
import { loadShareCarousel, mountShareButton } from './share.js';

const $ = (id) => document.getElementById(id);
const pad = (n) => String(n + 1).padStart(2, '0');
const MAX_SIZE = 50 * 1024 * 1024;
const okType = (file) =>
  ['image/jpeg', 'image/png', 'image/webp'].includes(file.type.toLowerCase()) ||
  /\.(jpe?g|png|webp)$/i.test(file.name);
const isHeic = (file) => /\.(heic|heif)$/i.test(file.name) || /^image\/hei[cf]/i.test(file.type);
const HEIC_HINT = '这张 HEIC 相片当前浏览器无法直接读取，请在相册中导出为 JPG 后再试。';

const empty = () => ({ source: '', preview: '', crop: { ...initialCrop }, custom: false, empty: true });
let memories = Array.from({ length: PHOTO_COUNT }, empty);
let selected = -1, choosing = false, ready = false, busy = false;
let editorOpen = false, draft = null, fileRequest = 0;
let pendingSave = false, batchLock = false, exchanging = false;
let api = null;
// 这个浏览器里没有自己的相片时，显示仓库 share/ 里的那份；第一次改动时先把那份整个存进本机，再改。
let fromShare = false;
const shareButton = mountShareButton($('workshop'), notify);
const urls = new Set();
const audio = new ChimeAudio();
const play = (kind) => audio.play(kind);

/* ---------- 小部件 ---------- */
let toastTimer = 0;
function notify(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.toggle('show', Boolean(text));
  clearTimeout(toastTimer);
  if (text) toastTimer = setTimeout(() => t.classList.remove('show'), 4800);
}
function setSaveState(state) {
  const el = $('saveStatus');
  el.hidden = state === 'saved';
  el.dataset.state = state === 'saving' ? 'saving' : 'error';
  el.textContent = state === 'saving' ? '正在保存…' : '保存未完成，请重试';
}
function show(el, text) { el.hidden = !text; el.textContent = text || ''; }

/* ---------- 对话框 ---------- */
const dialogs = {
  upload: { root: $('uploadDialog'), canClose: () => !batchLock, onClose: () => {} },
  editor: { root: $('editorDialog'), canClose: () => !busy, onClose: () => closeEditor() },
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
  const d = dialogs[name];
  if (d.root.hidden) return;
  d.root.hidden = true;
  lastFocus?.focus?.();
}
for (const [name, d] of Object.entries(dialogs)) {
  d.root.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]') && d.canClose()) { d.onClose(); closeDialog(name); }
  });
}
// 先于 3D 场景注册：Esc 只关闭对话框，不触发场景的“回到整盏灯”。
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  for (const [name, d] of Object.entries(dialogs)) {
    if (!d.root.hidden) {
      e.preventDefault();
      if (d.canClose()) { d.onClose(); closeDialog(name); }
      return;
    }
  }
  if (choosing) { e.preventDefault(); setChoosing(false); }
});

/* ---------- 渲染 ---------- */
function render() {
  $('uploadBtn').disabled = !ready || busy;
  $('resetBtn').disabled = !ready;
  $('workshop').classList.toggle('focused', selected >= 0);

  $('focusBar').hidden = selected < 0;
  if (selected >= 0) $('focusLabel').textContent = `相片 ${pad(selected)} / ${PHOTO_COUNT}`;
  $('photoActions').hidden = selected < 0 || choosing;
  if (selected >= 0) {
    $('editPhotoLabel').textContent = memories[selected].empty ? '放入相片' : '更换 / 调整';
    $('removePhoto').disabled = memories[selected].empty;
  }

  $('picker').hidden = !choosing;
  if (choosing) renderSlots();
  $('chooseConfirm').disabled = selected < 0;
  $('chooseConfirmLabel').textContent = selected >= 0 ? `挂在 ${pad(selected)} 号位置` : '先选一个位置';

  const free = memories.filter((m) => m.empty).length;
  $('uploadDesc').textContent = `还有 ${free} 个空相框。批量上传会随机填入空位，已有照片保持原位。`;
  $('framesFull').hidden = free > 0;
  $('pickOne').disabled = busy;
  $('batchBtn').disabled = busy || free === 0;
  dialogs.upload.root.querySelector('.dialog-close').hidden = busy;

  renderEditor();
  releaseUrls();
}
function renderSlots() {
  const box = $('slots');
  box.textContent = '';
  memories.forEach((memory, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `slot ${selected === i ? 'chosen' : ''}`;
    b.setAttribute('aria-pressed', String(selected === i));
    b.setAttribute('aria-label', `选择 ${i + 1} 号相片位置${memory.custom ? '，已有你的相片' : memory.empty ? '，空位置' : ''}`);
    b.innerHTML = memory.preview
      ? `<img src="${memory.preview}" alt="" width="88" height="104">`
      : `<span class="empty-slot">${icon('plus')}</span>`;
    const label = document.createElement('span');
    label.textContent = pad(i) + (memory.custom ? ' · 已挂' : '');
    b.appendChild(label);
    b.addEventListener('click', () => choose(i));
    box.appendChild(b);
  });
}
function renderEditor() {
  if (!editorOpen) return;
  $('editorTitle').textContent = `挂在 ${pad(selected)} 号位置`;
  const canvas = $('cropCanvas');
  canvas.hidden = !draft;
  $('emptyPreview').hidden = Boolean(draft);
  $('emptyPreviewText').textContent = busy ? '正在读取相片…' : '选一张喜欢的相片';
  if (draft) drawCrop(canvas, draft.image, draft.crop);
  $('choosePhoto').disabled = busy;
  $('choosePhotoLabel').textContent = draft ? '选择另一张相片' : '选择相片';
  for (const input of document.querySelectorAll('[data-crop]')) {
    input.disabled = !draft || busy;
    input.value = String(draft?.crop[input.dataset.crop] ?? initialCrop[input.dataset.crop]);
  }
  $('resetCrop').disabled = !draft || busy;
  $('cancelEditor').disabled = busy;
  $('saveEditor').disabled = !draft || busy;
  $('saveEditorLabel').textContent = busy ? '正在准备…' : '确认挂上';
  dialogs.editor.root.querySelector('.dialog-close').hidden = busy;
}
function releaseUrls() {
  const used = new Set(memories.map((m) => m.source));
  if (draft) used.add(draft.source);
  for (const url of urls) if (!used.has(url)) { URL.revokeObjectURL(url); urls.delete(url); }
}
function setChoosing(on) {
  choosing = on;
  api?.selectMode(on);
  render();
}

/* ---------- 保存 ---------- */
async function commitPhotos(prepare) {
  if (pendingSave) throw new Error('正在保存，请稍候。');
  pendingSave = true;
  setSaveState('saving');
  try {
    let records = await prepare();
    if (fromShare) records = await withSharedPhotos(records);
    await savePhotosLocally(records);
    fromShare = false;
    setSaveState('saved');
    void shareButton.refresh();
  } catch (error) {
    setSaveState('error');
    throw error;
  } finally { pendingSave = false; }
}

/** 把正在显示的分享相片补进这次要保存的记录里（这次改动的位置以改动为准）。 */
async function withSharedPhotos(records) {
  const changed = new Set(records.map((r) => r.slot));
  const kept = await Promise.all(memories.map(async (m, slot) => {
    if (m.empty || changed.has(slot)) return null;
    const response = await fetch(m.source);
    if (!response.ok) throw new Error('分享的相片读取失败，请检查网络后重试。');
    return { slot, source: await response.blob(), preview: m.preview, crop: { ...m.crop }, empty: false };
  }));
  return [...kept.filter(Boolean), ...records];
}

/* ---------- 操作 ---------- */
function choose(index) {
  api?.focus(index);
  play('select');
}
function closeEditor() {
  fileRequest++;
  editorOpen = false;
  draft = null;
  busy = false;
  show($('editorError'), '');
  closeDialog('editor');
  render();
}
async function openEditor() {
  if (selected < 0) return;
  show($('editorError'), '');
  draft = null;
  editorOpen = true;
  openDialog('editor');
  render();
  const memory = memories[selected];
  if (memory.empty) return;
  const token = ++fileRequest;
  busy = true; render();
  try {
    const image = await loadPhoto(memory.source);
    if (token === fileRequest) draft = { source: memory.source, image, crop: { ...memory.crop } };
  } catch (err) {
    if (token === fileRequest) show($('editorError'), err.message);
  } finally {
    if (token === fileRequest) { busy = false; render(); }
  }
}
async function readFile(file) {
  if (!file) return;
  show($('editorError'), '');
  const heic = isHeic(file);
  if (!heic && !okType(file)) { show($('editorError'), '请选择 JPG、PNG 或 WebP 格式的相片。'); return; }
  if (file.size > MAX_SIZE) { show($('editorError'), '请选择 50 MB 以内的相片。'); return; }
  const token = ++fileRequest;
  busy = true; render();
  const source = URL.createObjectURL(file);
  urls.add(source);
  try {
    const image = await loadPhoto(source);
    if (token === fileRequest) draft = { source, image, crop: { ...initialCrop } };
    else { URL.revokeObjectURL(source); urls.delete(source); }
  } catch (err) {
    if (token === fileRequest) show($('editorError'), heic ? HEIC_HINT : err.message);
    URL.revokeObjectURL(source); urls.delete(source);
  } finally {
    if (token === fileRequest) { busy = false; render(); }
  }
}
async function uploadBatch(files) {
  if (!files.length || batchLock || pendingSave || busy || !api) return;
  const slots = memories.map((m, i) => (m.empty ? i : -1)).filter((i) => i >= 0);
  show($('batchError'), '');
  if (files.length > slots.length) {
    show($('batchError'), `还有 ${slots.length} 个空相框，请最多选择 ${slots.length} 张照片。`);
    return;
  }
  const invalid = files.find((f) => f.size > MAX_SIZE || !(okType(f) || isHeic(f)));
  if (invalid) {
    show($('batchError'), `“${invalid.name}”不符合要求：请选择单张不超过 50 MB 的 JPG、PNG 或 WebP。`);
    return;
  }
  // 只在空位之间随机，已有相片不动。
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  batchLock = true; busy = true; render();
  const prepared = [];
  let committed = false;
  try {
    for (let i = 0; i < files.length; i++) {
      show($('batchProgress'), `正在准备 ${i + 1} / ${files.length} 张…`);
      const file = files[i];
      const source = URL.createObjectURL(file);
      try {
        const image = await loadPhoto(source).catch((e) => { throw isHeic(file) ? new Error(`“${file.name}”：${HEIC_HINT}`) : e; });
        const canvas = document.createElement('canvas');
        drawCrop(canvas, image, initialCrop);
        prepared.push({ slot: slots[i], blob: file, memory: {
          source, preview: canvas.toDataURL('image/jpeg', 0.92), crop: { ...initialCrop }, custom: true, empty: false,
        } });
      } catch (error) { URL.revokeObjectURL(source); throw error; }
    }
    show($('batchProgress'), '正在保存相片…');
    await commitPhotos(async () => prepared.map(({ slot, memory, blob }) => ({
      slot, source: blob, preview: memory.preview, crop: memory.crop, empty: false,
    })));
    for (const { memory } of prepared) urls.add(memory.source);
    committed = true;
    memories = memories.map((m, i) => prepared.find((p) => p.slot === i)?.memory ?? m);
    for (const { slot, memory } of prepared) await api?.setPhoto(slot, memory.preview);
    api?.reset();
    closeDialog('upload');
    notify(`已将 ${prepared.length} 张照片随机挂入空相框，并保存到本机。`);
    play('hang');
  } catch (error) {
    show($('batchError'), committed ? '照片已保存，但画面更新未完成，请刷新页面。' : `${error.message} 本次批量照片均未挂上。`);
  } finally {
    if (!committed) for (const p of prepared) URL.revokeObjectURL(p.memory.source);
    batchLock = false; busy = false;
    show($('batchProgress'), '');
    render();
  }
}
async function save() {
  if (!draft || selected < 0 || !api || pendingSave) return;
  busy = true; show($('editorError'), ''); render();
  try {
    const canvas = document.createElement('canvas');
    drawCrop(canvas, draft.image, draft.crop);
    const cropped = canvas.toDataURL('image/jpeg', 0.92);
    const current = draft, slot = selected;
    await commitPhotos(async () => {
      const response = await fetch(current.source);
      if (!response.ok) throw new Error('原相片无法读取，请重新选择。');
      const original = await response.blob();
      return [{ slot, source: original, preview: cropped, crop: { ...current.crop }, empty: false }];
    });
    await api.setPhoto(slot, cropped);
    memories = memories.map((m, i) => (i === slot
      ? { source: current.source, preview: cropped, crop: { ...current.crop }, custom: true, empty: false }
      : m));
    play('hang');
    notify(`相片已挂在 ${pad(slot)} 号位置，已自动保存到本机。`);
    closeEditor();
    setChoosing(false);
  } catch (err) {
    show($('editorError'), err.message);
  } finally {
    busy = false; render();
  }
}
async function exchangePhotos(from, to) {
  if (!ready || busy || pendingSave || exchanging || selected >= 0 || !api) throw new Error('请稍后再交换相片。');
  const carousel = api;
  const first = memories[from], second = memories[to];
  if (from === to || first.empty) return;
  exchanging = true;
  try {
    await commitPhotos(() => Promise.all([second, first].map(async (photo, i) => {
      let source = null;
      if (!photo.empty) {
        const response = await fetch(photo.source);
        if (!response.ok) throw new Error('相片读取失败，位置没有改变。');
        source = await response.blob();
      }
      return { slot: i === 0 ? from : to, source, preview: photo.preview, crop: { ...photo.crop }, empty: photo.empty };
    })));
    if (api !== carousel) return;
    carousel.swapPhotos(from, to);
    memories = memories.map((p, i) => (i === from ? second : i === to ? first : p));
    play('hang');
    notify(`${pad(from)} 与 ${pad(to)} 号相片已交换，已自动保存。`);
    render();
  } finally { exchanging = false; }
}
async function remove() {
  if (selected < 0 || !api || pendingSave) return;
  const slot = selected;
  try {
    await commitPhotos(async () => [{ slot, source: null, preview: '', crop: { ...initialCrop }, empty: true }]);
    await api.setPhoto(slot, null);
  } catch (err) {
    notify(err.message);
    return;
  }
  memories = memories.map((m, i) => (i === slot ? empty() : m));
  play('hang');
  notify('相片已取下，这个位置可以重新挂相片。');
  render();
}

/* ---------- 事件绑定 ---------- */
$('prevPhoto').addEventListener('click', () => choose((selected + PHOTO_COUNT - 1) % PHOTO_COUNT));
$('nextPhoto').addEventListener('click', () => choose((selected + 1) % PHOTO_COUNT));
$('backToLamp').addEventListener('click', () => { api?.reset(); play('select'); });
$('editPhoto').addEventListener('click', () => void openEditor());
$('removePhoto').addEventListener('click', () => void remove());
$('uploadBtn').addEventListener('click', () => {
  if (choosing) setChoosing(false);
  show($('batchError'), '');
  openDialog('upload');
  play('select');
});
$('resetBtn').addEventListener('click', () => { api?.reset(); play('select'); });
$('pickOne').addEventListener('click', () => {
  closeDialog('upload');
  api?.reset();
  setChoosing(true);
});
$('batchBtn').addEventListener('click', () => $('batchInput').click());
$('batchInput').addEventListener('change', (e) => {
  const files = Array.from(e.target.files ?? []);
  e.target.value = '';
  void uploadBatch(files);
});
$('closePicker').addEventListener('click', () => setChoosing(false));
$('chooseConfirm').addEventListener('click', () => void openEditor());
$('choosePhoto').addEventListener('click', () => $('fileInput').click());
$('fileInput').addEventListener('change', (e) => {
  void readFile(e.target.files?.[0]);
  e.target.value = '';
});
for (const input of document.querySelectorAll('[data-crop]')) {
  input.addEventListener('input', () => {
    if (!draft) return;
    draft = { ...draft, crop: { ...draft.crop, [input.dataset.crop]: Number(input.value) } };
    drawCrop($('cropCanvas'), draft.image, draft.crop);
  });
}
$('resetCrop').addEventListener('click', () => {
  if (draft) { draft = { ...draft, crop: { ...initialCrop } }; render(); }
});
$('cancelEditor').addEventListener('click', () => { if (!busy) closeEditor(); });
$('saveEditor').addEventListener('click', () => void save());
window.addEventListener('beforeunload', (event) => {
  if (pendingSave) { event.preventDefault(); event.returnValue = ''; }
});

/* ---------- 启动 3D 场景 ---------- */
try {
  api = createCarousel(
    $('scene'),
    (index) => {
      selected = index;
      if (index >= 0) choosing = false;
      api?.selectMode(choosing);
      render();
    },
    notify,
    (from, to) => exchangePhotos(from, to),
    (saved) => { if (!saved) setSaveState('error'); },
  );
  const carousel = api;
  carousel.ready.then(async () => {
    try {
      const stored = await readSavedPhotos();
      const restored = new Map();
      // 本机还没有存过相片：用仓库 share/ 里的分享内容
      const shared = stored.length ? null : await loadShareCarousel();
      for (const p of shared ?? []) {
        if (!Number.isInteger(p.slot) || p.slot < 0 || p.slot >= PHOTO_COUNT) continue;
        restored.set(p.slot, { source: p.source, preview: p.preview, crop: p.crop, custom: true, empty: false });
      }
      fromShare = restored.size > 0;
      for (const photo of stored) {
        if (!Number.isInteger(photo.slot) || photo.slot < 0 || photo.slot >= PHOTO_COUNT) continue;
        if (!photo.empty && !(photo.source instanceof Blob)) continue;
        const source = photo.source ? URL.createObjectURL(photo.source) : '';
        if (source) urls.add(source);
        restored.set(photo.slot, { source, preview: photo.preview, crop: photo.crop, custom: !photo.empty, empty: photo.empty });
      }
      await Promise.all([...restored].map(([slot, p]) => carousel.setPhoto(slot, p.empty ? null : p.preview)));
      memories = memories.map((p, slot) => restored.get(slot) ?? p);
    } catch (err) {
      notify(err.message);
      setSaveState('error');
    }
    ready = true;
    $('loading').hidden = true;
    render();
  }).catch(() => { $('loading').textContent = '画面暂时没加载成功，请刷新重试。'; });
} catch {
  $('loading').textContent = '这个浏览器暂时无法显示 3D 场景，请开启硬件加速或换一个浏览器。';
}
render();
