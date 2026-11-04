// 歌词：解析 LRC / 纯文本，并以“动态排字”的方式逐字显示。
// 样式参考：大号粗体字沿之字形错落排开，正在唱的字发蓝光，唱过的字沉为深色，
// 下方一条细线和十字标，配一行译文。

/* ================= 解析 ================= */
const STAMP = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/y;
const WORD = /<(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?>/g;
const toSec = (m, s, f = '0') => Number(m) * 60 + Number(s) + Number(`0.${f}`);

function splitTrans(text) {
  const i = text.indexOf('//');
  if (i < 0) return [text.trim(), ''];
  return [text.slice(0, i).trim(), text.slice(i + 2).trim()];
}
function parseWords(text, lineT) {
  if (!WORD.test(text)) return null;
  WORD.lastIndex = 0;
  const words = [];
  let last = 0, t = lineT, m;
  while ((m = WORD.exec(text))) {
    const seg = text.slice(last, m.index);
    if (seg) words.push({ t, text: seg });
    t = toSec(m[1], m[2], m[3]);
    last = WORD.lastIndex;
  }
  const tail = text.slice(last);
  if (tail) words.push({ t, text: tail });
  return words;
}

/** 返回 { title, artist, timed, lines: [{ t, text, trans, words }] } */
export function parseLyrics(raw) {
  const out = { title: '', artist: '', timed: false, lines: [] };
  if (!raw) return out;
  let offset = 0;
  const timed = [], plain = [];
  for (const line of raw.replace(/\r/g, '').split('\n')) {
    const meta = line.match(/^\s*\[(ti|ar|offset|al|by|length):(.*)\]\s*$/i);
    if (meta) {
      const k = meta[1].toLowerCase(), v = meta[2].trim();
      if (k === 'ti') out.title = v;
      else if (k === 'ar') out.artist = v;
      else if (k === 'offset') offset = Number(v) / 1000 || 0;
      continue;
    }
    const stamps = [];
    let pos = 0, m;
    const s = line.trimStart();
    STAMP.lastIndex = 0;
    while ((m = STAMP.exec(s))) { stamps.push(toSec(m[1], m[2], m[3])); pos = STAMP.lastIndex; }
    const text = s.slice(pos);
    if (stamps.length) for (const t of stamps) timed.push({ t, text });
    else if (line.trim()) plain.push(line.trim());
  }
  if (timed.length) {
    out.timed = true;
    timed.sort((a, b) => a.t - b.t);
    // 同一时间戳的第二行视为译文（常见的双语 LRC 写法）。
    for (const e of timed) {
      const prev = out.lines[out.lines.length - 1];
      const clean = e.text.replace(WORD, '').trim();
      if (prev && Math.abs(prev.t - e.t) < 0.06 && prev.text && !prev.trans && clean) { prev.trans = clean; continue; }
      const [text, trans] = splitTrans(clean);
      out.lines.push({ t: Math.max(0, e.t - offset), text, trans, words: parseWords(e.text, e.t - offset) });
    }
  } else {
    for (const p of plain) { const [text, trans] = splitTrans(p); out.lines.push({ t: 0, text, trans, words: null }); }
  }
  return out;
}

/** 没有时间轴的纯文本歌词：按歌曲时长平均分配。 */
export function spreadUntimed(lines, duration) {
  const intro = Math.min(duration * 0.08, 15), outro = Math.min(duration * 0.06, 12);
  const span = Math.max(1, duration - intro - outro) / Math.max(1, lines.length);
  lines.forEach((l, i) => { l.t = intro + i * span; });
}

/* ================= 分块与排版 ================= */
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SMALL = /[ゃゅょャュョっッぁぃぅぇぉァィゥェォゎーｰ゛゜]/;
const DROP = /[、。，．,.·・「」『』（）()【】\[\]"“”'‘’]/;
const HAN = /\p{Script=Han}/u;
const LATIN = /^[\p{Script=Latin}0-9'’\-&]+$/u;

function chunkText(text, r) {
  const tokens = [];
  for (const piece of text.match(/[\p{Script=Latin}0-9'’\-&]+|\s+|./gu) || []) {
    if (/^\s+$/.test(piece)) { tokens.push({ brk: true }); continue; }
    if (DROP.test(piece)) { tokens.push({ brk: true }); continue; }
    if (LATIN.test(piece)) { tokens.push({ text: piece, latin: true }); continue; }
    const last = tokens[tokens.length - 1];
    if (SMALL.test(piece) && last && !last.brk && !last.latin) { last.text += piece; continue; }
    tokens.push({ text: piece, han: HAN.test(piece) });
  }
  const chunks = [];
  let cur = null, want = 1;
  const flush = () => { if (cur) chunks.push(cur); cur = null; };
  for (const tk of tokens) {
    if (tk.brk) { flush(); continue; }
    if (tk.latin) { flush(); chunks.push({ text: tk.text, latin: true, han: false }); continue; }
    if (!cur) { cur = { text: tk.text, latin: false, han: tk.han, n: 1 }; want = tk.han ? (r() < 0.65 ? 1 : 2) : (r() < 0.35 ? 1 : 2); }
    else { cur.text += tk.text; cur.n++; }
    if (cur.n >= want) flush();
  }
  flush();
  return chunks;
}

function layoutChunks(chunks, W, H, base, r) {
  // 先给每块定字号，再沿之字形往下排；放不下就整体缩小重排。
  chunks.forEach((c, i) => {
    c.k = c.latin ? 0.62 : i === 0 ? 1 : c.han && [...c.text].length === 1 ? 0.82 + r() * 0.18 : 0.58 + r() * 0.36;
    c.rot = (r() - 0.5) * (i === 0 ? 6 : 16);
    c.jit = [...c.text].map(() => ({ rot: (r() - 0.5) * 14, dy: (r() - 0.5) * 0.12 }));
    c.dirFlip = r() < 0.28;
  });
  let s = 1, placed;
  for (let attempt = 0; attempt < 8; attempt++) {
    placed = [];
    let x = W * (0.24 + r() * 0.12), y = 0, dir = 1, prev = null;
    for (const c of chunks) {
      const size = base * s * c.k;
      const w = c.latin ? size * 0.6 * c.text.length : size * [...c.text].length * 1.02;
      const h = size * 1.08;
      if (prev) {
        if (c.dirFlip) dir = -dir;
        y += prev.h * 0.74 + size * 0.1;
        x += dir * (prev.w * 0.55 + size * 0.25);
        if (x + w > W * 0.96) { dir = -1; x = Math.max(W * 0.04, W * 0.96 - w - size * 0.3); }
        if (x < W * 0.04) { dir = 1; x = W * 0.06; }
      }
      const p = { c, x, y, w, h, size };
      placed.push(p);
      prev = p;
    }
    const total = prev ? prev.y + prev.h : 0;
    const wide = placed.some((p) => p.w > W * 0.94);
    if (total <= H * 0.78 && !wide) break;
    s *= 0.86;
  }
  const bottom = placed.length ? Math.max(...placed.map((p) => p.y + p.h)) : 0;
  const dy = Math.max(0, (H * 0.8 - bottom) / 2);
  placed.forEach((p) => { p.y += dy; });
  return { placed, bottom: bottom + dy };
}

/* ================= 显示 ================= */
const GLOW = 0.95; // 一个字“发光”的时长（秒）

export function createLyricView(root, { scale = 0.2 } = {}) {
  root.classList.add('lyric-stage');
  let lines = [], meta = { title: '', artist: '' };
  let index = -2, current = null, lastW = 0, lastH = 0;

  function charTimes(line, next, n) {
    if (line.words && line.words.length) {
      const times = [];
      line.words.forEach((w, wi) => {
        const end = line.words[wi + 1]?.t ?? (next ? next.t : w.t + 1);
        const chars = [...w.text.replace(/\s/g, '')];
        chars.forEach((_, i) => times.push(w.t + ((end - w.t) * i) / Math.max(1, chars.length)));
      });
      while (times.length < n) times.push(times[times.length - 1] ?? line.t);
      return times;
    }
    const gap = next ? next.t - line.t : 4;
    const d = Math.min(7, Math.max(0.6, gap * 0.78));
    return Array.from({ length: n }, (_, i) => line.t + (d * i) / Math.max(1, n));
  }

  function build(i, instant) {
    if (current) {
      const old = current.el;
      old.classList.add('leaving');
      setTimeout(() => old.remove(), 800);
    }
    current = null;
    const isTitle = i === -1;
    const line = isTitle ? { t: -1, text: meta.title || '', trans: meta.artist || '' } : lines[i];
    if (!line || !line.text) return;
    const W = root.clientWidth, H = root.clientHeight;
    lastW = W; lastH = H;
    const r = rng((i + 7) * 7919 + line.text.length);
    const chunks = chunkText(line.text, r);
    if (!chunks.length) return;
    const base = Math.min(W * 0.36, H * scale * 1.0);
    const { placed, bottom } = layoutChunks(chunks, W, H, base, r);
    const el = document.createElement('div');
    el.className = 'lyric-line';
    const chars = [];
    for (const p of placed) {
      const span = document.createElement('span');
      span.className = 'chunk' + (p.c.latin ? ' latin' : '');
      span.style.cssText = `left:${p.x}px;top:${p.y}px;font-size:${p.size}px;transform:rotate(${p.c.rot}deg)`;
      [...p.c.text].forEach((ch, k) => {
        const c = document.createElement('span');
        c.className = 'ch';
        c.textContent = ch;
        const j = p.c.jit[k];
        if (!p.c.latin) c.style.setProperty('--r', `${j.rot}deg`), c.style.setProperty('--dy', `${j.dy}em`);
        if (SMALL.test(ch)) c.classList.add('small');
        span.appendChild(c);
        chars.push({ el: c, state: '' });
      });
      el.appendChild(span);
    }
    const minX = Math.min(...placed.map((p) => p.x)), maxX = Math.max(...placed.map((p) => p.x + p.w));
    const rule = document.createElement('div');
    rule.className = 'lyric-rule';
    rule.style.cssText = `left:${Math.max(4, minX - 12)}px;top:${bottom + 8}px;width:${Math.min(W - 8, maxX + 12) - Math.max(4, minX - 12)}px`;
    el.appendChild(rule);
    const trans = document.createElement('div');
    trans.className = 'lyric-trans';
    trans.textContent = line.trans || '';
    trans.style.cssText = `right:${Math.max(4, W - Math.min(W - 4, maxX + 12))}px;top:${bottom + 26}px;max-width:${W - 8}px`;
    el.appendChild(trans);
    if (instant) el.classList.add('instant');
    root.appendChild(el);
    if (instant) requestAnimationFrame(() => el.classList.remove('instant'));
    const next = isTitle ? lines[0] : lines[i + 1];
    current = { el, chars, trans, rule, times: isTitle ? chars.map(() => -Infinity) : charTimes(line, next, chars.length), start: line.t, isTitle };
  }

  function lineAt(time) {
    if (!lines.length) return meta.title ? -1 : -2;
    if (time < lines[0].t - 0.15) return meta.title ? -1 : -2;
    let lo = 0, hi = lines.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lines[mid].t <= time + 0.15) lo = mid; else hi = mid - 1; }
    return lo;
  }

  return {
    setSong(m, ls) {
      meta = m || { title: '', artist: '' };
      lines = ls || [];
      index = -3;
      root.querySelectorAll('.lyric-line').forEach((n) => n.remove());
      current = null;
    },
    update(time, jumped = false) {
      const i = lineAt(time);
      if (i !== index || root.clientWidth !== lastW || root.clientHeight !== lastH) {
        const resized = i === index;
        index = i;
        if (i <= -2) { if (current) build(-99, false); current = null; }
        else build(i, jumped || resized);
      }
      if (!current) return;
      const t = time;
      current.chars.forEach((c, k) => {
        const ct = current.times[k];
        const state = current.isTitle ? 'past' : t < ct ? 'wait' : t < ct + GLOW ? 'now' : 'past';
        if (state !== c.state) {
          c.el.classList.toggle('on', state !== 'wait');
          c.el.classList.toggle('now', state === 'now');
          c.state = state;
        }
      });
      const showTrans = current.isTitle || t >= current.start + 0.25;
      current.el.classList.toggle('with-trans', showTrans);
    },
    clear() { this.setSong(null, []); },
  };
}

/* ================= 漂浮的小粒子（沉浸模式背景） ================= */
export function createDust(canvas) {
  const ctx = canvas.getContext('2d');
  const r = rng(42);
  const dots = Array.from({ length: 90 }, (_, i) => ({
    x: r(), y: r(), z: r(), blue: i % 11 === 0, ph: r() * 6.28, sp: 0.2 + r() * 0.6,
  }));
  let raf = 0, running = false;
  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const t = now / 1000;
    for (const d of dots) {
      const x = ((d.x + Math.sin(t * 0.05 * d.sp + d.ph) * 0.02 + t * 0.002 * d.sp) % 1) * w;
      const y = ((d.y - t * 0.006 * d.sp + 10) % 1) * h;
      if (d.blue) {
        ctx.fillStyle = '#4a6fe0';
        ctx.shadowColor = '#4a6fe0'; ctx.shadowBlur = 8;
        ctx.globalAlpha = 0.75;
        ctx.beginPath(); ctx.arc(x, y, 2.6 + d.z * 1.6, 0, 7); ctx.fill();
      } else {
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#20232b';
        ctx.globalAlpha = 0.25 + d.z * 0.6 * (0.6 + 0.4 * Math.sin(t * d.sp + d.ph));
        ctx.beginPath(); ctx.arc(x, y, 0.6 + d.z * 1.5, 0, 7); ctx.fill();
      }
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
  return {
    start() { if (!running) { running = true; raf = requestAnimationFrame(frame); } },
    stop() { running = false; cancelAnimationFrame(raf); },
  };
}
