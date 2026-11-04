// 分享包：把这个浏览器里的旋转木马相片、地图地点（含照片和说明）、自定义底图打成一个 zip。
// 解压后是一个 share 文件夹，上传到仓库根目录；没有本机数据的浏览器（也就是别人）打开网页时，
// 会自动读取 share/manifest.json 显示这份内容。本机有数据的浏览器照旧用本机的，照常能改。
import { readSavedPhotos } from './photo-storage.js';
import { readPins, readBase } from './map-storage.js';
import { loadPhoto, drawCrop } from './photos.js';

const DIR = 'share/';
const FORMAT = 'carousel-lamp-share';
const pad = (n) => String(n + 1).padStart(2, '0');

/* ---------- 读取仓库里的分享内容 ---------- */
let manifestJob = null;
/** share/manifest.json；没有、读不到或格式不对时为 null。 */
export function readShare() {
  manifestJob ??= fetch(`${DIR}manifest.json`, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((m) => (m?.format === FORMAT ? m : null))
    .catch(() => null);
  return manifestJob;
}
/** 每次导出的文件名不变，所以地址后面带上导出时间，换了照片别人不会看到旧的缓存。 */
const shareUrl = (m, path) => `${DIR}${path}?v=${m.stamp}`;
async function shareBlob(m, path) {
  const r = await fetch(shareUrl(m, path));
  if (!r.ok) throw new Error(`分享包里缺少文件：${path}`);
  return r.blob();
}
const toDataUrl = (blob) => new Promise((resolve, reject) => {
  const fr = new FileReader();
  fr.onload = () => resolve(fr.result);
  fr.onerror = () => reject(new Error('照片读取失败。'));
  fr.readAsDataURL(blob);
});

/** 旋转木马：[{ slot, source（原图地址）, preview（data URL）, crop }]；仓库里没有这部分时为 null。 */
export async function loadShareCarousel() {
  const m = await readShare();
  if (!Array.isArray(m?.carousel)) return null;
  const list = await Promise.all(m.carousel.map(async (p) => {
    try {
      return { slot: p.slot, source: shareUrl(m, p.original || p.image), preview: await toDataUrl(await shareBlob(m, p.image)),
        crop: { zoom: 1, x: 0, y: 0, ...p.crop } };
    } catch { return null; }
  }));
  return list.filter(Boolean);
}

/** 地图：{ pins（和本机存储同样的格式，照片是 Blob）, base（Blob 或 null） }；仓库里没有这部分时为 null。 */
export async function loadShareMap() {
  const m = await readShare();
  if (!m?.map) return null;
  const pins = await Promise.all((m.map.pins || []).map(async ({ photo, ...p }) => {
    try { return { ...p, photo: photo ? await shareBlob(m, photo) : null }; } catch { return { ...p, photo: null }; }
  }));
  let base = null;
  if (m.map.base) { try { base = await shareBlob(m, m.map.base); } catch { /* 用水墨地图 */ } }
  return { pins, base };
}

/* ---------- 导出 ---------- */
/** 缩到最长边 maxSide，转成 JPEG；本来就够小的 JPEG 原样保留。 */
async function compress(blob, maxSide, quality = 0.85) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadPhoto(url);
    const s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(img.naturalWidth * s));
    cv.height = Math.max(1, Math.round(img.naturalHeight * s));
    const c = cv.getContext('2d');
    c.fillStyle = '#fff'; // 透明的 PNG 转 JPEG 时垫白底，不然是黑的
    c.fillRect(0, 0, cv.width, cv.height);
    c.drawImage(img, 0, 0, cv.width, cv.height);
    const out = await new Promise((r) => cv.toBlob(r, 'image/jpeg', quality));
    if (!out) throw new Error('照片压缩失败。');
    return s === 1 && blob.type === 'image/jpeg' && blob.size <= out.size ? blob : out;
  } finally { URL.revokeObjectURL(url); }
}

async function collect(onProgress) {
  const files = new Map(); // 路径 → Blob
  const add = (path, blob) => files.set(path, blob);
  const share = await readShare();
  const manifest = { format: FORMAT, version: 1, stamp: Date.now(), exported: new Date().toISOString(), carousel: null, map: null };
  const counts = { photos: 0, places: 0 };

  // 和页面读取的规则一样：这个浏览器里有自己的数据就用自己的，没有就沿用仓库里现有的那份
  const photos = await readSavedPhotos();
  if (photos.length) {
    const hung = photos
      .filter((p) => Number.isInteger(p.slot) && !p.empty && p.source instanceof Blob)
      .sort((a, b) => a.slot - b.slot);
    manifest.carousel = [];
    for (const [i, p] of hung.entries()) {
      onProgress(`正在压缩相片 ${i + 1} / ${hung.length}…`);
      const n = pad(p.slot);
      let preview;
      if (p.preview) preview = await (await fetch(p.preview)).blob();
      let original;
      try { original = await compress(p.source, 1600); } catch { original = null; }
      if (!preview && original) {
        const url = URL.createObjectURL(original);
        try {
          const cv = document.createElement('canvas');
          drawCrop(cv, await loadPhoto(url), p.crop || { zoom: 1, x: 0, y: 0 });
          preview = await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.9));
        } finally { URL.revokeObjectURL(url); }
      }
      if (!preview) continue;
      add(`carousel/${n}.jpg`, preview);
      const entry = { slot: p.slot, image: `carousel/${n}.jpg`, crop: p.crop };
      if (original) { add(`carousel/${n}-original.jpg`, original); entry.original = `carousel/${n}-original.jpg`; }
      manifest.carousel.push(entry);
    }
    counts.photos = manifest.carousel.length;
  } else if (Array.isArray(share?.carousel)) {
    onProgress('正在沿用仓库里的旋转木马相片…');
    manifest.carousel = share.carousel;
    for (const p of share.carousel) for (const path of [p.image, p.original]) if (path) add(path, await shareBlob(share, path));
    counts.photos = share.carousel.length;
  }

  const [pins, base] = await Promise.all([readPins(), readBase()]);
  if (pins.length || base instanceof Blob) {
    const stops = pins.filter((p) => p.kind !== 'birth' && p.photo instanceof Blob).sort((a, b) => a.order - b.order);
    const births = pins.filter((p) => p.kind === 'birth');
    manifest.map = { base: null, pins: [] };
    const keep = ['id', 'kind', 'seal', 'order', 'lon', 'lat', 'u', 'v', 'title', 'note', 'created'];
    const all = [...stops, ...births];
    for (const [i, p] of all.entries()) {
      onProgress(`正在压缩地点照片 ${i + 1} / ${all.length}…`);
      const entry = Object.fromEntries(keep.filter((k) => p[k] !== undefined).map((k) => [k, p[k]]));
      entry.photo = null;
      if (p.photo instanceof Blob) {
        const path = p.kind === 'birth' ? `map/${String(p.id).replace(/[^\w-]/g, '')}.jpg` : `map/${pad(i)}.jpg`;
        add(path, await compress(p.photo, 1600));
        entry.photo = path;
      }
      manifest.map.pins.push(entry);
    }
    if (base instanceof Blob) {
      onProgress('正在压缩右页地图…');
      add('map/base.jpg', await compress(base, 3000));
      manifest.map.base = 'map/base.jpg';
    }
    counts.places = stops.length;
  } else if (share?.map) {
    onProgress('正在沿用仓库里的地图…');
    manifest.map = share.map;
    for (const path of [share.map.base, ...(share.map.pins || []).map((p) => p.photo)]) if (path) add(path, await shareBlob(share, path));
    counts.places = (share.map.pins || []).filter((p) => p.kind !== 'birth').length;
  }

  add('manifest.json', new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' }));
  return { files, counts, empty: !manifest.carousel && !manifest.map };
}

/* ---------- 最简单的 zip（只存不压：JPEG 本来就压缩过了） ---------- */
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(u8) {
  let c = 0xffffffff;
  for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
async function makeZip(files, folder) {
  const enc = new TextEncoder();
  const d = new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const parts = [], central = [];
  let offset = 0;
  for (const [path, blob] of files) {
    const name = enc.encode(`${folder}/${path}`);
    const data = new Uint8Array(await blob.arrayBuffer());
    const crc = crc32(data);
    const head = new DataView(new ArrayBuffer(30));
    head.setUint32(0, 0x04034b50, true); head.setUint16(4, 20, true); head.setUint16(6, 0x0800, true);
    head.setUint16(8, 0, true); head.setUint16(10, time, true); head.setUint16(12, date, true);
    head.setUint32(14, crc, true); head.setUint32(18, data.length, true); head.setUint32(22, data.length, true);
    head.setUint16(26, name.length, true); head.setUint16(28, 0, true);
    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true); dir.setUint16(4, 20, true); dir.setUint16(6, 20, true); dir.setUint16(8, 0x0800, true);
    dir.setUint16(10, 0, true); dir.setUint16(12, time, true); dir.setUint16(14, date, true);
    dir.setUint32(16, crc, true); dir.setUint32(20, data.length, true); dir.setUint32(24, data.length, true);
    dir.setUint16(28, name.length, true); dir.setUint32(42, offset, true);
    parts.push(head, name, data);
    central.push(dir, name);
    offset += 30 + name.length + data.length;
  }
  const size = central.reduce((s, x) => s + x.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.size, true); end.setUint16(10, files.size, true);
  end.setUint32(12, size, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}

export async function exportSharePack(onProgress = () => {}) {
  const { files, counts, empty } = await collect(onProgress);
  if (empty) throw new Error('这个浏览器里还没有相片或地点，没有可以导出的内容。');
  onProgress('正在打包…');
  const zip = await makeZip(files, 'share');
  const d = new Date(), two = (n) => String(n).padStart(2, '0');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(zip);
  a.download = `分享包-${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
  return { ...counts, bytes: zip.size };
}

/* ---------- 角落里的小按钮 ---------- */
/** 这个浏览器里有没有自己的数据（相片或地图）。只有这时才显示导出按钮，别人打开网页看不到它。 */
async function hasLocalData() {
  const [photos, pins, base] = await Promise.all([
    readSavedPhotos().catch(() => []), readPins().catch(() => []), readBase().catch(() => null),
  ]);
  return photos.length > 0 || pins.length > 0 || base instanceof Blob;
}

/** 在 parent 里放一个很小的导出按钮。返回 { refresh }：本机数据有变化时调用，决定按钮显不显示。 */
export function mountShareButton(parent, notify) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'share-export';
  btn.title = '导出分享包';
  btn.setAttribute('aria-label', '导出分享包');
  btn.hidden = true;
  btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>';
  parent.appendChild(btn);
  let working = false;
  btn.addEventListener('click', async () => {
    if (working) return;
    working = true;
    btn.setAttribute('aria-busy', 'true');
    try {
      const r = await exportSharePack(notify);
      const mb = (r.bytes / 1048576).toFixed(1);
      notify(`分享包已下载（${r.photos} 张相片、${r.places} 个地点，${mb} MB）。解压后把 share 文件夹上传到仓库根目录即可。`);
    } catch (e) {
      notify(e.message || '导出没有成功，请重试。');
    } finally {
      working = false;
      btn.removeAttribute('aria-busy');
    }
  });
  const refresh = () => hasLocalData().then((has) => { btn.hidden = !has; }, () => {});
  void refresh();
  return { refresh };
}
