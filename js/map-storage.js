// 地图页的本机存储：地点（含照片）和自定义底图都存在浏览器 IndexedDB 中，不上传服务器。
const DB_NAME = 'carousel-lamp-map';

function openStore() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('pins')) db.createObjectStore('pins', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('无法打开本机存储，请检查浏览器的网站存储设置。'));
    request.onblocked = () => reject(new Error('本机存储暂时被其他页面占用，请关闭其他页面后重试。'));
  });
}

async function run(mode, work) {
  const db = await openStore();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(['pins', 'meta'], mode);
      let result;
      try { result = work(tx); } catch (e) { tx.abort(); reject(e); return; }
      tx.oncomplete = () => resolve(result instanceof IDBRequest ? result.result : result);
      tx.onerror = tx.onabort = () => reject(new Error(mode === 'readonly'
        ? '未能读取本机保存的地图，请刷新重试。'
        : '没有保存成功，可能是存储空间不足。请释放空间后重试。'));
    });
  } finally { db.close(); }
}

/** 地点：{ id, order, u, v, title, note, photo: Blob, created } */
export const readPins = () => run('readonly', (tx) => tx.objectStore('pins').getAll());
export const savePin = (pin) => run('readwrite', (tx) => { tx.objectStore('pins').put(pin); });
export const deletePin = (id) => run('readwrite', (tx) => { tx.objectStore('pins').delete(id); });
export const readBase = () => run('readonly', (tx) => tx.objectStore('meta').get('base'));
export const saveBase = (blob) => run('readwrite', (tx) => {
  if (blob) tx.objectStore('meta').put(blob, 'base');
  else tx.objectStore('meta').delete('base');
});
