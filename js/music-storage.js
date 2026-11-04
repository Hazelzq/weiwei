// 音乐与歌词保存在浏览器本地（IndexedDB），不会上传，也不会进入 GitHub 仓库。
function openStore() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('carousel-lamp-music', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('song');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error('无法打开本机存储，请检查浏览器的网站存储设置。'));
  });
}
async function run(mode, work) {
  const db = await openStore();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('song', mode);
      const req = work(tx.objectStore('song'));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = tx.onabort = () => reject(new Error(mode === 'readonly' ? '没能读取保存的音乐。' : '音乐没有保存成功，可能是存储空间不足。'));
    });
  } finally { db.close(); }
}
/** { title, artist, lyrics, audio: Blob, audioName } */
export const readSong = () => run('readonly', (s) => s.get('current'));
export const saveSong = (song) => run('readwrite', (s) => s.put(song, 'current'));
export const clearSong = () => run('readwrite', (s) => s.delete('current'));
