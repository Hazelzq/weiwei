// 第五页：五线谱绕成的蛋糕（参照“蛋糕.mp4”）。不依赖任何库，用 WebGL2 直接画。
// 时间线：一缕音符从托盘上冒出来 → 蛋糕一层层长高（七层，每层是一圈五线谱，上面的音符全是 1 1 1 6）
//        → 转一会儿 → 从顶上开始化成光点 → 光点卷成一个旋转的菱形 → 收拢、熄灭 → 重新开始。
// 点画面可以从头再放一遍。系统开启“减少动态效果”时只显示一个静止的蛋糕。

const canvas = document.getElementById('cakeGl');
const words = document.getElementById('cakeWords');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

/* ---------- 尺寸与时间线（世界单位，y 朝上，托盘在 y = 0） ---------- */
const TIERS = 7;
const R = Array.from({ length: TIERS }, (_, k) => 1.52 - k * 0.185); // 每层半径
const H = 0.27;                                                      // 每层五线谱的高
const GAP = 0.43;                                                    // 层与层的间距
const YK = Array.from({ length: TIERS }, (_, k) => k * GAP);         // 每层底边的高度
const T = { build0: 0.5, step: 0.55, build: 1.0, dis0: 10.2, disStep: 0.32, disDur: 1.5, travel: 2.6, col: 18.2, end: 20.6 };
const DIAMOND = { cy: 1.45, h: 1.55, r: 1.02 };

/* ---------- WebGL ---------- */
const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, powerPreference: 'high-performance' });
if (!gl) {
  document.body.classList.add('no-gl');
  words.classList.add('show');
  throw new Error('WebGL2 不可用');
}
const halfFloat = gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float');
const aniso = gl.getExtension('EXT_texture_filter_anisotropic');

function program(vs, fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  for (let i = 0; i < gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i++) {
    const n = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, '');
    u[n] = gl.getUniformLocation(p, n);
  }
  return { p, u };
}

/* ---------- 画在 canvas 上的贴图 ---------- */
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
let seed = 1116;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const DIGIT_FONT = '"Avenir Next", "Helvetica Neue", Arial, "PingFang SC", sans-serif';

function star(c, x, y, r) { // 四角的小星芒
  c.beginPath();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, rr = i % 2 ? r * 0.28 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath(); c.fill();
}
function moon(c, x, y, r) {
  c.beginPath(); c.arc(x, y, r, 0.6, Math.PI * 2 - 0.6); c.arc(x + r * 0.55, y - r * 0.1, r * 0.82, Math.PI * 2 - 0.9, 0.9, true); c.closePath(); c.fill();
}

// 一小节五线谱：1 1 1 6。宽 1024，横向可以无缝重复；上面一道起伏的连线，中间点缀星星和月亮。
function staffTile() {
  const w = 1024, h = 512, cv = makeCanvas(w, h), c = cv.getContext('2d');
  const lines = [150, 205, 260, 315, 370];
  const glowPass = (blur, color, fn) => { c.save(); c.shadowBlur = blur; c.shadowColor = color; fn(); c.restore(); };
  c.strokeStyle = '#ffffff'; c.fillStyle = '#ffffff'; c.lineCap = 'round';
  // 五线
  for (const pass of [[26, 'rgba(150,200,255,.95)'], [8, 'rgba(255,255,255,.9)']]) glowPass(...pass, () => {
    c.lineWidth = 5;
    for (const y of lines) { c.beginPath(); c.moveTo(-60, y); c.lineTo(w + 60, y); c.stroke(); }
  });
  // 顶上起伏的连线（两个周期，左右接得上）
  glowPass(18, 'rgba(150,200,255,.9)', () => {
    c.lineWidth = 4; c.beginPath();
    for (let x = -40; x <= w + 40; x += 8) { const y = 78 + Math.sin((x / w) * Math.PI * 4) * 26 + Math.sin((x / w) * Math.PI * 8) * 6; x === -40 ? c.moveTo(x, y) : c.lineTo(x, y); }
    c.stroke();
  });
  // 小节线
  glowPass(14, 'rgba(150,200,255,.9)', () => { c.lineWidth = 6; c.beginPath(); c.moveTo(1010, lines[0]); c.lineTo(1010, lines[4]); c.stroke(); });
  // 简谱数字：1 1 1 6，位置一高一低，像在唱
  const notes = [['1', 128, 278], ['1', 372, 246], ['1', 616, 286], ['6', 860, 232]];
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `800 236px ${DIGIT_FONT}`;
  for (const pass of [[42, 'rgba(120,180,255,1)'], [12, 'rgba(255,255,255,1)']]) glowPass(...pass, () => {
    for (const [d, x, y] of notes) c.fillText(d, x, y);
  });
  // 前两个 1 下面一道减时线，6 上面一个高音点，后两个音符上面一道圆滑线
  glowPass(16, 'rgba(150,200,255,.95)', () => {
    c.lineWidth = 9;
    c.beginPath(); c.moveTo(78, 430); c.lineTo(424, 430); c.stroke();
    c.beginPath(); c.arc(860, 88, 13, 0, Math.PI * 2); c.fill();
    c.lineWidth = 6; c.beginPath(); c.moveTo(600, 128); c.quadraticCurveTo(740, 40, 880, 112); c.stroke();
  });
  // 星星和月亮
  glowPass(16, 'rgba(255,240,200,.95)', () => {
    c.fillStyle = '#fff8e6';
    for (const [x, y, r] of [[250, 175, 20], [495, 345, 16], [740, 190, 22], [985, 300, 14], [40, 360, 12], [560, 455, 13], [300, 470, 10]]) star(c, x, y, r);
    moon(c, 250, 400, 18); moon(c, 735, 395, 16); moon(c, 470, 150, 13);
  });
  return cv;
}

// 光点贴图：四格，依次是 1、6、星芒、圆点
function glyphAtlas() {
  const s = 128, cv = makeCanvas(s * 4, s), c = cv.getContext('2d');
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff';
  c.font = `800 92px ${DIGIT_FONT}`;
  for (const [i, d] of [[0, '1'], [1, '6']]) {
    c.save(); c.shadowBlur = 18; c.shadowColor = 'rgba(160,210,255,1)'; c.fillText(d, i * s + s / 2, s / 2 + 4); c.restore();
    c.fillText(d, i * s + s / 2, s / 2 + 4);
  }
  c.save(); c.shadowBlur = 14; c.shadowColor = 'rgba(255,245,220,1)'; star(c, 2 * s + s / 2, s / 2, 46); c.restore();
  const g = c.createRadialGradient(3 * s + s / 2, s / 2, 0, 3 * s + s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, 'rgba(255,255,255,.9)'); g.addColorStop(0.45, 'rgba(170,210,255,.25)'); g.addColorStop(1, 'rgba(170,210,255,0)');
  c.fillStyle = g; c.fillRect(3 * s, 0, s, s);
  return cv;
}

function uploadTexture(src, repeat) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  return t;
}
const staffTex = uploadTexture(staffTile(), true);
const glyphTex = uploadTexture(glyphAtlas(), false);

/* ---------- 着色器 ---------- */
// 两边共用的时间线函数（和上面的 T 一致）
const TIMELINE = `
const float B0 = ${T.build0.toFixed(3)}, BS = ${T.step.toFixed(3)}, BD = ${T.build.toFixed(3)};
const float D0 = ${T.dis0.toFixed(3)}, DS = ${T.disStep.toFixed(3)};
float buildE(float k, float t) { return clamp((t - (B0 + k * BS)) / BD, 0.0, 1.0); }
float backOut(float x) { float c = 1.9; return 1.0 + (c + 1.0) * pow(x - 1.0, 3.0) + c * pow(x - 1.0, 2.0); }
float disStart(float k) { return D0 + (6.0 - k) * DS; }
`;

const BAND_VS = `#version 300 es
in vec2 aUV;
uniform mat4 uVP; uniform float uR, uY, uH, uRot;
out vec2 vUV; out vec3 vN; out vec3 vW;
void main() {
  float th = aUV.x * 6.2831853 - uRot;
  vec3 n = vec3(sin(th), 0.0, cos(th));
  vec3 p = vec3(n.x * uR, uY + aUV.y * uH, n.z * uR);
  vUV = aUV; vN = n; vW = p;
  gl_Position = uVP * vec4(p, 1.0);
}`;
const BAND_FS = `#version 300 es
precision highp float;
in vec2 vUV; in vec3 vN; in vec3 vW;
uniform sampler2D uTex; uniform float uRepeat, uAlpha, uDissolve, uTime; uniform vec3 uCam;
out vec4 o;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  vec2 uv = vec2(vUV.x * uRepeat, vUV.y);
  vec4 t = texture(uTex, uv);
  float facing = dot(vN, normalize(uCam - vW));
  float k = mix(0.22, 1.0, smoothstep(-0.25, 0.3, facing));   // 背面那半圈透过来，暗一些
  float n = noise(uv * vec2(9.0, 7.0)) * 0.75 + noise(uv * vec2(31.0, 23.0)) * 0.25;
  float d = uDissolve * 1.25;
  float keep = smoothstep(d - 0.22, d, n);
  float edge = (1.0 - smoothstep(0.0, 0.12, abs(n - d + 0.08))) * step(0.001, uDissolve) * (1.0 - step(0.999, uDissolve));
  float sweep = pow(max(0.0, sin((uv.x * 0.5 - uTime * 0.32) * 6.2831853)), 24.0) * 0.55;  // 一道光沿着谱子走
  vec3 col = t.rgb * vec3(0.86, 0.94, 1.0) * (1.0 + sweep) * k * keep + vec3(0.7, 0.85, 1.0) * edge * 0.9 * t.a;
  o = vec4(col * uAlpha, 1.0);
}`;

const PART_VS = `#version 300 es
in vec4 aA;   // 层、绕圈的位置 u、在谱子里的高度 v、贴图格
in vec4 aB;   // 四个随机数
uniform mat4 uVP; uniform float uT, uRot, uPx;
uniform float uR[7], uY[7], uH;
out float vAlpha; out float vGlyph; out float vWarm;
${TIMELINE}
void main() {
  float k = aA.x, u = aA.y, v = aA.z, t = uT;
  int ki = int(k + 0.5);
  float e = buildE(k, t);
  float sc = 0.12 + 0.88 * backOut(e);
  float yk = mix(ki > 0 ? uY[ki - 1] : 0.0, uY[ki], 1.0 - pow(1.0 - e, 3.0));
  float rc = uR[ki] * sc * (1.0 + (aB.w - 0.5) * 0.05);
  float yc = yk + v * uH + (aB.z - 0.5) * 0.05;
  float thc = u * 6.2831853;

  // 开头：一缕音符从当前的最高处冒上去
  float s = fract(aB.x + t * 0.55);
  float origin = mix(0.02, ${(YK[TIERS - 1] + H).toFixed(3)}, clamp((t - 0.3) / 4.4, 0.0, 1.0));
  vec3 stream = vec3(sin(s * 11.0 + t * 2.2 + aB.z * 2.0) * 0.14 * s * (1.0 + s), origin + s * 2.2, cos(s * 7.0 + t * 1.7) * 0.1 * s);
  float streamA = (aB.y < 0.16 ? 1.0 : 0.0) * sin(s * 3.14159) * (1.0 - smoothstep(4.6, 5.6, t)) * 0.9;

  // 在谱子上一闪一闪
  float tw = pow(0.5 + 0.5 * sin(t * (1.6 + aB.z * 3.0) + aB.x * 40.0), 5.0);
  float bandA = 0.05 + 0.38 * tw;

  // 化开：从顶层开始，卷着飞成一个菱形
  float rel = disStart(k) + aB.x * 0.9;
  float p = clamp((t - rel) / ${T.travel.toFixed(2)}, 0.0, 1.0);
  float ep = p * p * (3.0 - 2.0 * p);
  float ah = 1.0 - pow(max(aB.y, 1e-4), 0.42);
  float hd = (fract(aB.z * 7.31) < 0.5 ? -1.0 : 1.0) * ah;
  float rd = ${DIAMOND.r.toFixed(3)} * (1.0 - ah) * pow(aB.w, 0.35);
  float yd = ${DIAMOND.cy.toFixed(3)} + hd * ${DIAMOND.h.toFixed(3)};
  float thd = thc + aB.x * 3.0;
  float spin = max(0.0, t - rel) * 0.9 * ep;
  float swirl = sin(p * 3.14159);
  float r = mix(rc, rd, ep) + swirl * 0.45 * (0.4 + aB.w);
  float y = mix(yc, yd, ep) + swirl * 0.35 * (aB.z - 0.35);
  float th = mix(thc, thd, ep) - uRot - spin - swirl * 1.2;

  // 收尾：卷回中心，熄灭
  float c = smoothstep(${T.col.toFixed(2)}, ${(T.col + 1.5).toFixed(2)}, t + aB.x * 0.4);
  r *= 1.0 - c * 0.96;
  y = mix(y, ${DIAMOND.cy.toFixed(3)}, c * c);
  th -= c * 4.0;

  vec3 cake = vec3(sin(th) * r, y, cos(th) * r);
  float onBand = smoothstep(0.0, 0.7, e);
  vec3 pos = mix(stream, cake, onBand);
  float diamondA = 0.16 + 0.5 * pow(0.5 + 0.5 * sin(t * (2.0 + aB.w * 3.0) + aB.y * 50.0), 3.0);
  float a = mix(streamA, mix(bandA, diamondA, ep), smoothstep(0.0, 0.5, e));
  a *= 1.0 - c * c;
  a *= 1.0 - smoothstep(${(T.end - 0.7).toFixed(2)}, ${T.end.toFixed(2)}, t);

  vec4 clip = uVP * vec4(pos, 1.0);
  gl_Position = clip;
  float digit = aA.w < 1.5 ? 1.0 : 0.0;
  float size = mix(0.028, 0.05, aB.w) * (digit > 0.5 ? mix(1.3, 2.6, ep) : (aA.w < 2.5 ? 1.6 : 0.9)) * (1.0 + swirl * 0.5 + c * 0.6);
  gl_PointSize = clamp(size * uPx / clip.w, 1.0, 64.0);
  vAlpha = a * (digit > 0.5 ? mix(0.55, 1.0, ep) : 1.0);
  vGlyph = aA.w;
  vWarm = fract(aB.y * 13.7) < 0.12 ? 1.0 : 0.0;
}`;
const PART_FS = `#version 300 es
precision highp float;
in float vAlpha; in float vGlyph; in float vWarm;
uniform sampler2D uTex;
out vec4 o;
void main() {
  vec2 uv = vec2((gl_PointCoord.x + floor(vGlyph + 0.5)) / 4.0, 1.0 - gl_PointCoord.y);
  vec4 t = texture(uTex, uv);
  vec3 tint = mix(vec3(0.82, 0.92, 1.0), vec3(1.0, 0.92, 0.75), vWarm);
  o = vec4(t.rgb * tint * vAlpha, 1.0);
}`;

const QUAD_VS = `#version 300 es
in vec2 aP; out vec2 vUV;
void main() { vUV = aP * 0.5 + 0.5; gl_Position = vec4(aP, 0.0, 1.0); }`;
const DOWN_FS = `#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uTex; uniform vec2 uTexel; out vec4 o;
void main() {
  vec3 c = texture(uTex, vUV + uTexel * vec2(-1, -1)).rgb + texture(uTex, vUV + uTexel * vec2(1, -1)).rgb
         + texture(uTex, vUV + uTexel * vec2(-1, 1)).rgb + texture(uTex, vUV + uTexel * vec2(1, 1)).rgb;
  o = vec4(c * 0.25, 1.0);
}`;
const BLUR_FS = `#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uTex; uniform vec2 uDir; out vec4 o;
void main() {
  // 9 个采样合成 5 次取样（线性插值）
  vec3 c = texture(uTex, vUV).rgb * 0.2270270270;
  c += (texture(uTex, vUV + uDir * 1.3846153846).rgb + texture(uTex, vUV - uDir * 1.3846153846).rgb) * 0.3162162162;
  c += (texture(uTex, vUV + uDir * 3.2307692308).rgb + texture(uTex, vUV - uDir * 3.2307692308).rgb) * 0.0702702703;
  o = vec4(c, 1.0);
}`;
const FINAL_FS = `#version 300 es
precision highp float; in vec2 vUV;
uniform sampler2D uScene, uBloom; uniform vec2 uAspect; uniform float uFade;
out vec4 o;
void main() {
  vec2 q = (vUV - vec2(0.5, 0.56)) * uAspect;
  float d = length(q);
  vec3 bg = mix(vec3(0.10, 0.33, 0.98), vec3(0.035, 0.17, 0.78), smoothstep(0.0, 0.95, d));
  bg = mix(bg, vec3(0.02, 0.09, 0.45), smoothstep(0.75, 1.5, d));
  vec3 light = texture(uScene, vUV).rgb + texture(uBloom, vUV).rgb * 0.95;
  vec3 col = bg + (1.0 - bg) * (1.0 - exp(-light * 1.25 * uFade));
  // 一点点噪点，避免渐变出现色带
  col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  o = vec4(col, 1.0);
}`;

const band = program(BAND_VS, BAND_FS);
const part = program(PART_VS, PART_FS);
const down = program(QUAD_VS, DOWN_FS);
const blur = program(QUAD_VS, BLUR_FS);
const final = program(QUAD_VS, FINAL_FS);

/* ---------- 几何 ---------- */
// 一圈谱子：u 绕一圈，v 从下到上
const SEG = 256;
const bandVao = gl.createVertexArray();
gl.bindVertexArray(bandVao);
{
  const uv = [], idx = [];
  for (let j = 0; j <= 1; j++) for (let i = 0; i <= SEG; i++) uv.push(i / SEG, j);
  for (let i = 0; i < SEG; i++) idx.push(i, i + 1, i + SEG + 1, i + 1, i + SEG + 2, i + SEG + 1);
  const loc = gl.getAttribLocation(band.p, 'aUV');
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uv), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
}
const BAND_COUNT = SEG * 6;

// 光点：按每层周长分配数量
const smallScreen = Math.min(screen.width, screen.height) < 700;
const NP = smallScreen ? 7000 : 12000;
const partVao = gl.createVertexArray();
gl.bindVertexArray(partVao);
{
  const A = new Float32Array(NP * 4), Bv = new Float32Array(NP * 4);
  const total = R.reduce((s, r) => s + r, 0);
  let i = 0;
  for (let k = 0; k < TIERS; k++) {
    const n = k === TIERS - 1 ? NP - i : Math.round((NP * R[k]) / total);
    for (let j = 0; j < n && i < NP; j++, i++) {
      const g = rnd();
      A.set([k, rnd(), rnd(), g < 0.22 ? 0 : g < 0.3 ? 1 : g < 0.52 ? 2 : 3], i * 4);
      Bv.set([rnd(), rnd(), rnd(), rnd()], i * 4);
    }
  }
  for (const [name, data] of [['aA', A], ['aB', Bv]]) {
    const loc = gl.getAttribLocation(part.p, name);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 0, 0);
  }
}

const quadVao = gl.createVertexArray();
gl.bindVertexArray(quadVao);
{
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  for (const pr of [down, blur, final]) { const loc = gl.getAttribLocation(pr.p, 'aP'); if (loc >= 0) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0); } }
}
gl.bindVertexArray(null);

/* ---------- 离屏画布（泛光） ---------- */
function target(w, h) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  if (halfFloat) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return { tex, fb, w, h };
}
let scene = null, bloomA = null, bloomB = null;
function freeTarget(t) { if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); } }

/* ---------- 镜头 ---------- */
const mat = {
  mul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; }
    return o;
  },
  persp(fovy, asp, n, f) {
    const t = 1 / Math.tan(fovy / 2), m = new Float32Array(16);
    m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = (2 * f * n) / (n - f);
    return m;
  },
  lookAt(e, c) {
    const nz = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
    const z = nz([e[0] - c[0], e[1] - c[1], e[2] - c[2]]);
    const x = nz([z[2], 0, -z[0]]); // up = (0,1,0)
    const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
    const d = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -d(x, e), -d(y, e), -d(z, e), 1]);
  },
};
let VP = null, camPos = [0, 0, 10], pxPerUnit = 100, W = 1, Hh = 1, dpr = 1;

function resize() {
  const r = canvas.getBoundingClientRect();
  W = Math.max(1, r.width); Hh = Math.max(1, r.height);
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (W * Hh * dpr * dpr > 4.2e6) dpr = Math.sqrt(4.2e6 / (W * Hh)); // 超大屏降一点分辨率，保证流畅
  const pw = Math.round(W * dpr), ph = Math.round(Hh * dpr);
  canvas.width = pw; canvas.height = ph;
  freeTarget(scene); freeTarget(bloomA); freeTarget(bloomB);
  scene = target(pw, ph);
  const bw = Math.max(1, Math.round(pw / 4)), bh = Math.max(1, Math.round(ph / 4));
  bloomA = target(bw, bh); bloomB = target(bw, bh);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  // 让蛋糕（含菱形）落在画面中上部，下面留出写字的地方
  const aspect = W / Hh;
  const span = Math.max(5.1, 3.7 / aspect);               // 画面竖直方向能看到的世界高度
  const focus = aspect < 0.8 ? 0.38 : 0.4;                 // 蛋糕中心在屏幕上的位置（从上往下）
  const D = 11, fov = 2 * Math.atan(span / 2 / D), pitch = (11 * Math.PI) / 180;
  const tgt = [0, 1.5 - (0.5 - focus) * span, 0];
  camPos = [0, tgt[1] + Math.sin(pitch) * D, Math.cos(pitch) * D];
  VP = mat.mul(mat.persp(fov, aspect, 0.5, 60), mat.lookAt(camPos, tgt));
  pxPerUnit = ph / (2 * Math.tan(fov / 2));
  const bottom = focus + 1.9 / span + 0.035;                      // 托盘下沿在屏幕上的位置
  words.style.setProperty('--words-top', `${Math.min(0.9, bottom) * 100}%`);
  if (still) draw(still);
}

/* ---------- 每层谱子的状态（和着色器里的时间线一致） ---------- */
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const backOut = (x) => 1 + 2.9 * (x - 1) ** 3 + 1.9 * (x - 1) ** 2;
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
function tierState(k, t) {
  const e = clamp01((t - (T.build0 + k * T.step)) / T.build);
  const sc = 0.12 + 0.88 * backOut(e);
  const y = (k > 0 ? YK[k - 1] : 0) + (YK[k] - (k > 0 ? YK[k - 1] : 0)) * (1 - (1 - e) ** 3);
  const ds = T.dis0 + (6 - k) * T.disStep;
  const dissolve = smooth(ds - 0.1, ds + T.disDur, t);
  const alpha = Math.sqrt(e) * (1 - smooth(ds + T.disDur * 0.6, ds + T.disDur + 0.3, t));
  return { r: R[k] * sc, y, dissolve, alpha };
}
const rotation = (t) => t * 0.42;
const repeatFor = (k) => Math.max(3, Math.round((2 * Math.PI * R[k]) / (H * 2 * 1.02)));

/* ---------- 绘制 ---------- */
function bindQuad(pr, tex, texel) {
  gl.useProgram(pr.p);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(pr.u.uTex, 0);
  if (texel) gl.uniform2fv(pr.u.uTexel, texel);
  gl.bindVertexArray(quadVao);
}
function draw(t) {
  // 1. 场景（全部用加法混合：发光的线条和光点叠在一起）
  gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fb);
  gl.viewport(0, 0, scene.w, scene.h);
  gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
  const rot = rotation(t);

  gl.useProgram(band.p);
  gl.uniformMatrix4fv(band.u.uVP, false, VP);
  gl.uniform3fv(band.u.uCam, camPos);
  gl.uniform1f(band.u.uRot, rot); gl.uniform1f(band.u.uH, H); gl.uniform1f(band.u.uTime, t);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, staffTex); gl.uniform1i(band.u.uTex, 0);
  gl.bindVertexArray(bandVao);
  for (let k = 0; k < TIERS; k++) {
    const s = tierState(k, t);
    if (s.alpha <= 0.002) continue;
    gl.uniform1f(band.u.uR, s.r); gl.uniform1f(band.u.uY, s.y);
    gl.uniform1f(band.u.uRepeat, repeatFor(k)); gl.uniform1f(band.u.uAlpha, s.alpha); gl.uniform1f(band.u.uDissolve, s.dissolve);
    gl.drawElements(gl.TRIANGLES, BAND_COUNT, gl.UNSIGNED_SHORT, 0);
  }

  gl.useProgram(part.p);
  gl.uniformMatrix4fv(part.u.uVP, false, VP);
  gl.uniform1f(part.u.uT, t); gl.uniform1f(part.u.uRot, rot); gl.uniform1f(part.u.uPx, pxPerUnit); gl.uniform1f(part.u.uH, H);
  gl.uniform1fv(part.u.uR, R); gl.uniform1fv(part.u.uY, YK);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, glyphTex); gl.uniform1i(part.u.uTex, 0);
  gl.bindVertexArray(partVao);
  gl.drawArrays(gl.POINTS, 0, NP);
  gl.disable(gl.BLEND);

  // 2. 泛光：缩小到四分之一，横竖各模糊两遍
  gl.bindFramebuffer(gl.FRAMEBUFFER, bloomA.fb); gl.viewport(0, 0, bloomA.w, bloomA.h);
  bindQuad(down, scene.tex, [1 / scene.w, 1 / scene.h]);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  for (const spread of [1, 2.2]) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, bloomB.fb);
    bindQuad(blur, bloomA.tex); gl.uniform2f(blur.u.uDir, spread / bloomA.w, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, bloomA.fb);
    bindQuad(blur, bloomB.tex); gl.uniform2f(blur.u.uDir, 0, spread / bloomA.h);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // 3. 合成到屏幕：蓝色的底 + 场景 + 泛光
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.useProgram(final.p);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, scene.tex); gl.uniform1i(final.u.uScene, 0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, bloomA.tex); gl.uniform1i(final.u.uBloom, 1);
  const a = W / Hh;
  gl.uniform2f(final.u.uAspect, a > 1 ? a : 1, a > 1 ? 1 : 1 / a);
  gl.uniform1f(final.u.uFade, 1);
  gl.bindVertexArray(quadVao);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

/* ---------- 播放 ---------- */
let start = performance.now(), raf = 0, still = 0;
function frame(now) {
  raf = requestAnimationFrame(frame);
  const t = ((now - start) / 1000) % T.end;
  draw(t);
  if (t > 4.4) words.classList.add('show');
}
const freezeAt = Number(new URLSearchParams(location.search).get('t'));
function play() {
  cancelAnimationFrame(raf);
  if (freezeAt) { still = freezeAt; draw(still); words.classList.add('show'); return; }
  if (reduceMotion.matches) { still = 7; draw(still); words.classList.add('show'); return; }
  still = 0;
  raf = requestAnimationFrame(frame);
}
resize();
new ResizeObserver(resize).observe(canvas);
play();
reduceMotion.addEventListener?.('change', play);
// 切到别的标签页时不画，回来接着画
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { cancelAnimationFrame(raf); raf = 0; hiddenAt = performance.now(); }
  else if (!still) { start += performance.now() - hiddenAt; raf = requestAnimationFrame(frame); }
});
let hiddenAt = 0;
// 点画面：从头再放一遍
canvas.addEventListener('click', () => { if (still) return; start = performance.now(); });
canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); cancelAnimationFrame(raf); });
