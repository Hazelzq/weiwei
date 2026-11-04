// 外壳页：把五页放进同一个画框里，这样翻页时音乐不会中断。
// 播放器、歌词浮层和沉浸式歌词都在这一层。
import { parseLyrics, spreadUntimed, createLyricView, createDust } from './lyrics.js';
import { readSong, saveSong, clearSong } from './music-storage.js';
import { icon } from './icons.js';

const $ = (id) => document.getElementById(id);
const audio = $('audio');
const frame = $('stage');

/* ---------- 页面路由 ---------- */
const PAGES = { carousel: 'carousel.html', map: 'map.html', elephants: 'elephants.html', qianfu: 'qianfu.html', credits: 'credits.html' };
const THEMES = { carousel: 'night', map: 'jiangnan', elephants: 'grove', qianfu: 'study', credits: 'cake' };
const pageFromHash = () => (location.hash.slice(1) in PAGES ? location.hash.slice(1) : 'carousel');
let page = pageFromHash();
frame.src = PAGES[page];
frame.addEventListener('load', () => {
  let name = 'carousel';
  try {
    const path = frame.contentWindow.location.pathname;
    name = Object.keys(PAGES).find((k) => path.endsWith(PAGES[k])) || 'carousel';
    document.title = frame.contentDocument.title || document.title;
    frame.contentWindow.addEventListener('keydown', (e) => { if (e.key === 'Escape' && immersive) closeImmersive(); });
  } catch { /* 跨域时忽略 */ }
  armFrameGestures();
  page = name;
  history.replaceState(null, '', name === 'carousel' ? location.pathname : `#${name}`);
  document.body.dataset.theme = THEMES[name];
  document.body.dataset.page = name;
  showSongCredit();
});
function showSongCredit() {
  try {
    const row = frame.contentDocument?.getElementById('songCredit');
    if (!row) return;
    row.hidden = !song;
    if (song) row.querySelector('dd').textContent = song.artist ? `${song.title}（${song.artist}）` : song.title;
  } catch { /* 忽略 */ }
}
window.addEventListener('hashchange', () => {
  const next = pageFromHash();
  if (next !== page) frame.src = PAGES[next];
});

/* ---------- 歌曲 ---------- */
let song = null; // { title, artist, lines, timed, url }
let objectUrl = '';
const fmt = (s) => (Number.isFinite(s) ? `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '00:00');
const inlineView = createLyricView($('inlineLyrics'), { scale: 0.17 });
const immView = createLyricView($('immStage'), { scale: 0.2 });
const dust = createDust($('dust'));

function useSong(data) {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = '';
  if (!data) {
    song = null;
    audio.removeAttribute('src');
    audio.load();
    inlineView.clear(); immView.clear();
    renderPlayer();
    showSongCredit();
    return;
  }
  const parsed = parseLyrics(data.lyrics || '');
  const url = data.audio instanceof Blob ? (objectUrl = URL.createObjectURL(data.audio)) : data.audioUrl;
  song = {
    title: data.title || parsed.title || (data.audioName || '').replace(/\.[^.]+$/, '') || '未命名',
    artist: data.artist || parsed.artist || '',
    lines: parsed.lines, timed: parsed.timed,
  };
  audio.src = url;
  audio.loop = true;
  const meta = { title: song.title, artist: song.artist };
  inlineView.setSong(meta, song.lines);
  immView.setSong(meta, song.lines);
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({ title: song.title, artist: song.artist });
    navigator.mediaSession.setActionHandler('play', () => { userPaused = false; audio.play(); });
    navigator.mediaSession.setActionHandler('pause', () => { userPaused = true; audio.pause(); });
  }
  renderPlayer();
  showSongCredit();
}
audio.addEventListener('loadedmetadata', () => {
  if (song && !song.timed && song.lines.length) spreadUntimed(song.lines, audio.duration || 180);
  renderPlayer();
});
for (const ev of ['play', 'pause', 'ended']) audio.addEventListener(ev, renderPlayer);
let jumped = true;
audio.addEventListener('seeked', () => { jumped = true; });
audio.addEventListener('error', () => { if (song) notify('这个音乐文件无法播放，请换成 MP3 或 M4A 再试。'); });

/* ---------- 自动播放 ---------- */
// 每次打开网页都自动播放。浏览器一般不允许没点过页面就出声：先直接试一次，
// 被拦下的话，就等第一次点击、按键或触摸（画框里的页面也算）时立刻开始。
let userPaused = false, waitingGesture = false, gestureHint = false;
function autoStart() {
  if (!song || userPaused || !audio.paused) return;
  audio.play().then(() => { waitingGesture = false; document.body.classList.remove('await-play'); }).catch(() => {
    waitingGesture = true;
    document.body.classList.add('await-play');
    if (!gestureHint) { gestureHint = true; notify('轻点页面任意处，音乐就会响起。'); }
  });
}
const GESTURES = ['pointerdown', 'keydown', 'touchend'];
function onGesture(e) { if (waitingGesture && !e.target?.closest?.('#plPlay, #immPlay')) autoStart(); } // 点的就是播放键时交给按钮自己处理
for (const ev of GESTURES) window.addEventListener(ev, onGesture, { capture: true, passive: true });
function armFrameGestures() {
  try { for (const ev of GESTURES) frame.contentWindow.addEventListener(ev, onGesture, { capture: true, passive: true }); } catch { /* 忽略 */ }
}

/* ---------- 播放器 ---------- */
let inlineOn = localStorage.getItem('lamp-lyrics-inline') !== 'off';
function renderPlayer() {
  const has = Boolean(song);
  $('plAdd').hidden = has;
  $('plMain').hidden = !has;
  if (!has) return;
  const playing = !audio.paused;
  for (const id of ['plPlay', 'immPlay']) {
    $(id).innerHTML = icon(playing ? 'pause' : 'play');
    $(id).setAttribute('aria-label', playing ? '暂停' : '播放');
  }
  $('plTitle').textContent = song.artist ? `${song.title} · ${song.artist}` : song.title;
  $('plTitle').title = $('plTitle').textContent;
  $('plLyric').setAttribute('aria-pressed', String(inlineOn));
  for (const id of ['plDur', 'immDur']) $(id).textContent = fmt(audio.duration);
}
const toggle = () => {
  if (!song) return;
  if (audio.paused) { userPaused = false; audio.play().catch(() => notify('浏览器阻止了播放，请再点一次播放。')); }
  else { userPaused = true; audio.pause(); }   // 手动暂停：这次打开网页期间不再自动播放，下次打开照样自动播放
};
$('plPlay').addEventListener('click', toggle);
$('immPlay').addEventListener('click', toggle);
$('plAdd').addEventListener('click', openMusicDialog);
$('plSettings').addEventListener('click', openMusicDialog);
$('plLyric').addEventListener('click', () => {
  inlineOn = !inlineOn; jumped = true;
  localStorage.setItem('lamp-lyrics-inline', inlineOn ? 'on' : 'off');
  renderPlayer();
});
$('plImmerse').addEventListener('click', openImmersive);

function bindBar(bar) {
  const seek = (e) => {
    if (!song || !Number.isFinite(audio.duration)) return;
    const r = bar.getBoundingClientRect();
    audio.currentTime = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * audio.duration;
  };
  bar.addEventListener('pointerdown', (e) => { bar.setPointerCapture(e.pointerId); seek(e); });
  bar.addEventListener('pointermove', (e) => { if (bar.hasPointerCapture(e.pointerId)) seek(e); });
  bar.addEventListener('keydown', (e) => {
    if (!song) return;
    if (e.key === 'ArrowRight') audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
    if (e.key === 'ArrowLeft') audio.currentTime = Math.max(0, audio.currentTime - 5);
  });
}
bindBar($('plBar'));
bindBar($('immBar'));

/* ---------- 沉浸式歌词 ---------- */
let immersive = false;
function openImmersive() {
  if (!song) return;
  immersive = true;
  $('immersive').hidden = false;
  $('immTitle').textContent = song.artist ? `${song.title} — ${song.artist}` : song.title;
  dust.start();
  jumped = true;
  $('immClose').focus();
}
function closeImmersive() {
  immersive = false;
  $('immersive').hidden = true;
  dust.stop();
  jumped = true;
}
$('immClose').addEventListener('click', closeImmersive);
$('immFull').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else $('immersive').requestFullscreen?.().catch(() => {});
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!$('musicDialog').hidden) { closeMusicDialog(); return; }
    if (immersive && !document.fullscreenElement) closeImmersive();
  }
  if (e.key === ' ' && immersive) { e.preventDefault(); toggle(); }
});

/* ---------- 每帧更新 ---------- */
function panelOpen() {
  try {
    return Boolean(frame.contentDocument?.querySelector('.position-picker:not([hidden]), .stop-card:not([hidden]), .dialog-root:not([hidden]), .qf-lightbox:not([hidden]), .qf[data-book="open"]'));
  } catch { return false; }
}
// 只在数值真的变了的时候才改网页元素，免得每一帧都让浏览器重新排版
let lastPanelCheck = 0, muted = false, lastPct = -1, lastCur = '', lastShow = null, lastMuted = null;
const els = { fill: $('plFill'), immFill: $('immFill'), cur: $('plCur'), immCur: $('immCur'), inline: $('inlineLyrics') };
function tick(now) {
  requestAnimationFrame(tick);
  if (!song) { if (lastShow !== false) { els.inline.hidden = true; lastShow = false; } return; }
  if (audio.paused && !jumped && !immersive && lastShow !== null && now - lastPanelCheck < 400) return;
  const t = audio.currentTime || 0, d = audio.duration || 0;
  const pct = d ? Math.round((t / d) * 1000) / 10 : 0;
  if (pct !== lastPct) { lastPct = pct; els.fill.style.width = `${pct}%`; els.immFill.style.width = `${pct}%`; }
  const cur = fmt(t);
  if (cur !== lastCur) { lastCur = cur; els.cur.textContent = cur; els.immCur.textContent = cur; }
  if (now - lastPanelCheck > 400) { muted = panelOpen(); lastPanelCheck = now; }
  const showInline = inlineOn && !immersive && (!audio.paused || t > 0) && song.lines.length > 0;
  if (showInline !== lastShow) { els.inline.hidden = !showInline; lastShow = showInline; }
  if (muted !== lastMuted) { els.inline.classList.toggle('muted', muted); lastMuted = muted; }
  if (showInline) inlineView.update(t, jumped);
  if (immersive) immView.update(t, jumped);
  jumped = false;
}
requestAnimationFrame(tick);

/* ---------- 添加音乐对话框 ---------- */
let pickedAudio = null;
let autoTitle = '';
let lastFocus = null;
async function openMusicDialog() {
  lastFocus = document.activeElement;
  pickedAudio = null;
  autoTitle = '';
  $('mdError').hidden = true;
  const saved = await readSong().catch(() => null);
  $('mdAudioName').textContent = saved?.audioName || '还没有选择';
  $('mdLyrics').value = saved?.lyrics || '';
  $('mdTitle').value = saved?.title || '';
  $('mdArtist').value = saved?.artist || '';
  $('mdRemove').hidden = !saved;
  $('musicDialog').hidden = false;
  const popup = $('musicDialog').querySelector('.dialog-popup');
  popup.tabIndex = -1;
  popup.focus();
}
function closeMusicDialog() {
  $('musicDialog').hidden = true;
  lastFocus?.focus?.();
}
$('musicDialog').addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeMusicDialog(); });
$('mdAudioBtn').addEventListener('click', () => $('mdAudioFile').click());
$('mdAudioFile').addEventListener('change', (e) => {
  const f = e.target.files?.[0];
  e.target.value = '';
  if (!f) return;
  if (f.size > 80 * 1024 * 1024) { showError('音乐文件请小于 80 MB。'); return; }
  pickedAudio = f;
  $('mdAudioName').textContent = f.name;
  if (!$('mdTitle').value) { autoTitle = f.name.replace(/\.[^.]+$/, ''); $('mdTitle').value = autoTitle; }
});
$('mdLrcBtn').addEventListener('click', () => $('mdLrcFile').click());
$('mdLrcFile').addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  e.target.value = '';
  if (!f) return;
  const text = await f.text();
  $('mdLyrics').value = text;
  const p = parseLyrics(text);
  if (p.title && (!$('mdTitle').value || $('mdTitle').value === autoTitle)) $('mdTitle').value = p.title;
  if (p.artist && !$('mdArtist').value) $('mdArtist').value = p.artist;
});
function showError(text) { $('mdError').hidden = false; $('mdError').textContent = text; }
$('mdSave').addEventListener('click', async () => {
  const saved = await readSong().catch(() => null);
  const audioBlob = pickedAudio || saved?.audio;
  if (!audioBlob) { showError('请先选择一个音乐文件。'); return; }
  const data = {
    title: $('mdTitle').value.trim(), artist: $('mdArtist').value.trim(), lyrics: $('mdLyrics').value,
    audio: audioBlob, audioName: pickedAudio?.name || saved?.audioName || '',
  };
  try {
    $('mdSave').disabled = true;
    await saveSong(data);
    const wasPlaying = !audio.paused, keep = pickedAudio ? 0 : audio.currentTime;
    useSong(data);
    audio.currentTime = keep;
    closeMusicDialog();
    if (wasPlaying || pickedAudio) { userPaused = false; audio.play().catch(() => {}); }
    notify(data.lyrics.trim() ? '音乐和歌词已保存到本机。' : '音乐已保存。没有填写歌词，只会显示歌名。');
  } catch (e) { showError(e.message); } finally { $('mdSave').disabled = false; }
});
$('mdRemove').addEventListener('click', async () => {
  await clearSong().catch(() => {});
  useSong(null);
  closeMusicDialog();
  notify('已移除音乐。');
});

/* ---------- 提示 ---------- */
let toastTimer = 0;
function notify(text) {
  const t = $('shellToast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 4200);
}

/* ---------- 启动：先读本机保存的歌，再看仓库里有没有 music/song.json ---------- */
(async () => {
  let data = await readSong().catch(() => null);
  if (!data) {
    try {
      const res = await fetch('music/song.json', { cache: 'no-cache' });
      if (res.ok) {
        const cfg = await res.json();
        const lyrics = cfg.lyrics ? await fetch(`music/${cfg.lyrics}`).then((r) => (r.ok ? r.text() : '')) : '';
        data = { title: cfg.title, artist: cfg.artist, lyrics, audioUrl: `music/${cfg.audio}` };
      }
    } catch { /* 仓库里没有放音乐 */ }
  }
  useSong(data);
  autoStart();
})();
