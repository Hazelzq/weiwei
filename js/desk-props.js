// 书桌上的几件小摆件（立体的，有真的阴影）：一盏青花茶杯（冒着一点热气）、一小盆多肉、
// 两卷纸胶带、一只 135 胶卷。它们站在书桌照片的桌面上，合上册子转动视角时能看出前后。
// 全部用程序生成，贴图用 canvas 现画。
import * as THREE from 'three';

function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
let seed = 23;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const V = (x, y) => new THREE.Vector2(x, y);

/** 贴在桌面上的一团软阴影，让摆件“落地”。 */
let blobTex = null;
function contactShadow(r, opacity = 0.42) {
  blobTex ??= canvasTex(128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(40,24,10,1)'); g.addColorStop(0.55, 'rgba(40,24,10,0.45)'); g.addColorStop(1, 'rgba(40,24,10,0)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2),
    new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.003;
  m.renderOrder = -1;
  return m;
}

function shade(mesh) { mesh.castShadow = true; mesh.receiveShadow = true; return mesh; }

/* ---------------- 青花茶杯 ---------------- */
// 杯子的轮廓：从外底往上到杯口，再沿内壁下到杯心。LatheGeometry 的 v 坐标按点的序号排，
// 所以花纹画在 v 对应外壁的那一段（第 3–8 个点）。
const CUP = [V(0.001, 0.05), V(0.3, 0.0), V(0.38, 0.0), V(0.41, 0.08), V(0.45, 0.11), V(0.58, 0.3), V(0.7, 0.6),
  V(0.77, 0.9), V(0.8, 1.02), V(0.78, 1.06), V(0.745, 1.02), V(0.72, 0.9), V(0.645, 0.6), V(0.52, 0.32), V(0.38, 0.17), V(0.001, 0.15)];
function blueWhiteTexture() {
  const n = CUP.length - 1;
  const y = (i) => (1 - i / n); // 第 i 个点在贴图里的高度（0 = 顶）
  return canvasTex(1024, 512, (c, w, h) => {
    c.fillStyle = '#f6f4ee'; c.fillRect(0, 0, w, h);
    const blue = '#24427e';
    c.strokeStyle = blue; c.fillStyle = blue;
    const yr = y(8) * h, yb = y(3) * h; // 杯口、杯底
    // 口沿两道线、底部一道线
    c.lineWidth = 5; c.beginPath(); c.moveTo(0, yr + 10); c.lineTo(w, yr + 10); c.stroke();
    c.lineWidth = 2; c.beginPath(); c.moveTo(0, yr + 20); c.lineTo(w, yr + 20); c.stroke();
    c.lineWidth = 4; c.beginPath(); c.moveTo(0, yb - 10); c.lineTo(w, yb - 10); c.stroke();
    // 缠枝花：一条起伏的枝，枝上开小花
    const mid = (yr + yb) / 2 + 4, amp = (yb - yr) * 0.2;
    c.lineWidth = 3;
    c.beginPath();
    for (let x = 0; x <= w; x += 4) { const yy = mid + Math.sin((x / w) * Math.PI * 8) * amp; if (x === 0) c.moveTo(x, yy); else c.lineTo(x, yy); }
    c.stroke();
    for (let k = 0; k < 8; k++) {
      const cx = (k + 0.25) * (w / 8), cy = mid + Math.sin(((cx / w) * Math.PI * 8)) * amp - amp * 0.9;
      c.globalAlpha = 0.9;
      for (let p = 0; p < 5; p++) { // 五瓣小花
        const a = (p / 5) * Math.PI * 2;
        c.beginPath(); c.ellipse(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9, 8, 5, a, 0, 7); c.fill();
      }
      c.globalAlpha = 1;
      c.fillStyle = '#f6f4ee'; c.beginPath(); c.arc(cx, cy, 3.5, 0, 7); c.fill(); c.fillStyle = blue;
      const lx = cx + w / 16, ly = mid + Math.sin(((lx / w) * Math.PI * 8)) * amp + amp * 0.7; // 叶子
      c.beginPath(); c.ellipse(lx, ly, 14, 5.5, -0.5, 0, 7); c.fill();
    }
    // 内壁：杯心一个小小的青花圈
    c.lineWidth = 3; c.beginPath(); c.moveTo(0, y(14) * h); c.lineTo(w, y(14) * h); c.stroke();
  });
}
function steamTexture() {
  return canvasTex(128, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.filter = 'blur(7px)';
    for (let k = 0; k < 3; k++) {
      c.strokeStyle = `rgba(255,255,255,${0.55 - k * 0.12})`;
      c.lineWidth = 16 - k * 4;
      c.beginPath();
      for (let y = h - 20; y > 20; y -= 6) {
        const x = w / 2 + Math.sin(y / 34 + k * 1.7) * (14 + (h - y) * 0.08);
        if (y === h - 20) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
    }
  });
}
function buildTeacup() {
  const g = new THREE.Group();
  const porcelain = new THREE.MeshPhysicalMaterial({ map: blueWhiteTexture(), roughness: 0.16, clearcoat: 0.7, clearcoatRoughness: 0.12, side: THREE.DoubleSide, envMapIntensity: 2.2 });
  const plate = new THREE.MeshPhysicalMaterial({ color: '#f3f1ea', roughness: 0.18, clearcoat: 0.6, side: THREE.DoubleSide, envMapIntensity: 2 });
  const saucer = shade(new THREE.Mesh(new THREE.LatheGeometry([V(0.001, 0.05), V(0.62, 0.04), V(0.66, 0.0), V(0.76, 0.0), V(1.04, 0.08),
    V(1.16, 0.15), V(1.14, 0.18), V(1.0, 0.13), V(0.72, 0.1), V(0.001, 0.1)], 56), plate));
  g.add(saucer);
  // 托盘边一圈青花线
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.012, 6, 64), new THREE.MeshBasicMaterial({ color: '#2a4a86' }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.135;
  g.add(ring);
  const cup = shade(new THREE.Mesh(new THREE.LatheGeometry(CUP, 96), porcelain));
  cup.position.y = 0.1;
  g.add(cup);
  const tea = new THREE.Mesh(new THREE.CircleGeometry(0.69, 40), new THREE.MeshPhysicalMaterial({ color: '#a8732c', roughness: 0.08, clearcoat: 1, envMapIntensity: 2.4 }));
  tea.rotation.x = -Math.PI / 2; tea.position.y = 0.1 + 0.82;
  tea.receiveShadow = true;
  g.add(tea);
  g.add(contactShadow(1.5, 0.5));
  // 热气：三缕慢慢升起又散开
  const tex = steamTexture();
  const wisps = [0, 1, 2].map((i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false }));
    s.position.set(0, 1.4, 0);
    g.add(s);
    return { s, phase: i / 3, sway: rnd() * 6 };
  });
  return {
    group: g,
    update(t) {
      for (const w of wisps) {
        const k = (t * 0.16 + w.phase) % 1;
        w.s.position.set(Math.sin(t * 0.7 + w.sway) * 0.12, 1.15 + k * 1.6, Math.cos(t * 0.5 + w.sway) * 0.08);
        w.s.scale.set(0.55 + k * 0.6, 1.1 + k * 0.7, 1);
        w.s.material.opacity = Math.sin(k * Math.PI) ** 1.5 * 0.34;
      }
    },
  };
}

/* ---------------- 一小盆多肉 ---------------- */
function buildSucculent() {
  const g = new THREE.Group();
  const clay = new THREE.MeshStandardMaterial({ color: '#b5653f', roughness: 0.88, envMapIntensity: 1.2 });
  const pot = shade(new THREE.Mesh(new THREE.LatheGeometry([V(0.001, 0.02), V(0.46, 0.0), V(0.52, 0.03), V(0.62, 0.78),
    V(0.71, 0.8), V(0.72, 0.98), V(0.66, 1.0), V(0.62, 0.94), V(0.001, 0.9)], 48), clay));
  g.add(pot);
  const soil = new THREE.Mesh(new THREE.CircleGeometry(0.6, 32), new THREE.MeshStandardMaterial({ color: '#3a281b', roughness: 1 }));
  soil.rotation.x = -Math.PI / 2; soil.position.y = 0.92; soil.receiveShadow = true;
  g.add(soil);
  // 叶子：椭球，叶尖带一点粉
  const leafGeo = new THREE.SphereGeometry(0.5, 16, 10);
  leafGeo.scale(0.32, 0.14, 0.78);
  leafGeo.translate(0, 0, 0.33);
  const pos = leafGeo.attributes.position, colors = [];
  const green = new THREE.Color('#7fae8f'), blush = new THREE.Color('#d98f8f'), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const k = THREE.MathUtils.smoothstep(pos.getZ(i), 0.45, 0.72);
    tmp.copy(green).lerp(blush, k * 0.85);
    if (pos.getY(i) > 0.02) tmp.offsetHSL(0, 0, 0.05); // 叶面朝上的一侧亮一点
    colors.push(tmp.r, tmp.g, tmp.b);
  }
  leafGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const leafMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, envMapIntensity: 1.4 });
  const rosette = new THREE.Group();
  rosette.position.y = 0.94;
  g.add(rosette);
  const rings = [{ n: 9, tilt: 0.28, s: 1.0, off: 0 }, { n: 7, tilt: 0.72, s: 0.78, off: 0.4 }, { n: 5, tilt: 1.12, s: 0.56, off: 0.9 }];
  for (const r of rings) {
    for (let i = 0; i < r.n; i++) {
      const leaf = shade(new THREE.Mesh(leafGeo, leafMat));
      leaf.rotation.order = 'YXZ';
      leaf.rotation.y = r.off + (i / r.n) * Math.PI * 2;
      leaf.rotation.x = -r.tilt;
      leaf.scale.setScalar(r.s);
      rosette.add(leaf);
    }
  }
  g.add(contactShadow(1.0, 0.5));
  return { group: g };
}

/* ---------------- 两卷纸胶带 ---------------- */
// 轮廓是一个长方形：底面 → 外圈 → 顶面 → 内圈（纸芯）。v 坐标依次占四段。
function tapeTexture(paint) {
  return canvasTex(512, 256, (c, w, h) => {
    const q = h / 4; // 四段，从下往上：底面、外圈、顶面、纸芯（贴图的 y 是倒过来的）
    const band = (i) => [h - (i + 1) * q, q];
    // 底面和顶面：一层层半透明的胶带边
    for (const i of [0, 2]) {
      const [y0, hh] = band(i);
      c.fillStyle = paint.edge; c.fillRect(0, y0, w, hh);
      for (let k = 0; k < 14; k++) { c.fillStyle = `rgba(255,255,255,${0.08 + rnd() * 0.1})`; c.fillRect(0, y0 + (k / 14) * hh, w, 1.4); }
    }
    // 外圈：花纹
    const [yo, ho] = band(1);
    c.save(); c.beginPath(); c.rect(0, yo, w, ho); c.clip();
    paint.pattern(c, w, yo, ho);
    c.restore();
    // 纸芯
    const [yc, hc] = band(3);
    c.fillStyle = '#d8c39b'; c.fillRect(0, yc, w, hc);
  });
}
function buildTapes() {
  const g = new THREE.Group();
  const profile = [V(0.42, 0), V(0.76, 0), V(0.76, 0.4), V(0.42, 0.4), V(0.42, 0)];
  const pink = tapeTexture({
    edge: '#e9b7ae',
    pattern(c, w, y, h) {
      c.fillStyle = '#efc4ba'; c.fillRect(0, y, w, h);
      c.fillStyle = '#b23a2e';
      for (let x = 10; x < w; x += 32) for (let r = 0; r < 2; r++) { c.beginPath(); c.arc(x + r * 16, y + h * (0.3 + r * 0.4), 4, 0, 7); c.fill(); }
    },
  });
  const celadon = tapeTexture({
    edge: '#a9c6b8',
    pattern(c, w, y, h) {
      c.fillStyle = '#b9d3c6'; c.fillRect(0, y, w, h);
      c.strokeStyle = '#f4f1e6'; c.lineWidth = 3;
      for (let row = 0; row < 3; row++) { // 水波纹
        c.beginPath();
        for (let x = 0; x <= w; x += 4) { const yy = y + h * (0.22 + row * 0.28) + Math.sin(x / 9) * 3; if (x === 0) c.moveTo(x, yy); else c.lineTo(x, yy); }
        c.stroke();
      }
    },
  });
  const a = shade(new THREE.Mesh(new THREE.LatheGeometry(profile, 48), new THREE.MeshStandardMaterial({ map: pink, roughness: 0.62, side: THREE.DoubleSide })));
  const b = shade(new THREE.Mesh(new THREE.LatheGeometry(profile, 48), new THREE.MeshStandardMaterial({ map: celadon, roughness: 0.62, side: THREE.DoubleSide })));
  b.position.set(0.28, 0.4, -0.12);
  b.rotation.y = 0.7;
  g.add(a, b, contactShadow(1.1, 0.4));
  return { group: g };
}

/* ---------------- 135 胶卷 ---------------- */
function buildFilm() {
  const g = new THREE.Group();
  const label = canvasTex(512, 128, (c, w, h) => {
    c.fillStyle = '#efe6cf'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#b23a2e'; c.fillRect(0, h * 0.62, w, h * 0.16);
    c.fillStyle = '#2b2a28'; c.fillRect(0, h * 0.84, w, h * 0.16);
    c.fillStyle = '#2b2a28';
    c.font = `700 ${h * 0.34}px "PingFang SC", "Microsoft YaHei", sans-serif`;
    c.textBaseline = 'middle';
    for (let x = 18; x < w; x += 250) c.fillText('135 · 36', x, h * 0.34);
  });
  const body = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 1.0, 40, 1, true),
    new THREE.MeshStandardMaterial({ map: label, roughness: 0.45, side: THREE.DoubleSide, envMapIntensity: 1.6 })));
  const metal = new THREE.MeshStandardMaterial({ color: '#8d9093', roughness: 0.3, metalness: 0.85, envMapIntensity: 2.4 });
  const caps = [-1, 1].map((s) => { const m = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.07, 40), metal)); m.position.y = s * 0.53; return m; });
  const nub = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 20), metal));
  nub.position.y = 0.62;
  // 片头：一小段带齿孔的胶片
  const leaderTex = canvasTex(256, 128, (c, w, h) => {
    c.fillStyle = '#4a2410'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#000';
    for (let x = 8; x < w; x += 22) { c.fillRect(x, 8, 12, 14); c.fillRect(x, h - 22, 12, 14); }
  });
  const leader = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.36),
    new THREE.MeshStandardMaterial({ map: leaderTex, roughness: 0.3, side: THREE.DoubleSide, envMapIntensity: 1.8 }));
  leader.castShadow = true;
  leader.rotation.set(0, Math.PI / 2 - 0.35, 0); // 横躺以后，片头的外端微微往下耷拉
  leader.position.set(0, 0, 0.27 + 0.29);
  const roll = new THREE.Group();
  roll.add(body, ...caps, nub, leader);
  roll.rotation.z = Math.PI / 2; // 横躺在桌上
  roll.position.y = 0.29;
  g.add(roll, contactShadow(0.85, 0.45));
  return { group: g };
}

/**
 * 书桌摆件。left 放在册子左边（茶杯、多肉），right 放在相机包旁边（胶卷、纸胶带）。
 * @returns {{ group: THREE.Group, left: THREE.Group, right: THREE.Group, film: THREE.Group, tapes: THREE.Group, update(t: number): void }}
 */
export function buildDeskProps() {
  const group = new THREE.Group();
  const left = new THREE.Group(), right = new THREE.Group();
  group.add(left, right);
  // 位置对着书桌照片算过：照片左边木托盘和桌垫之间的那一条空桌面（x 约 -10.6 到 -7.4），
  // 也躲开了册子翻开后左半本的范围（x > -6.9）
  const cup = buildTeacup();
  cup.group.position.set(-8.95, 0, 2.0);
  const plant = buildSucculent();
  plant.group.position.set(-9.0, 0, -2.8);
  plant.group.rotation.y = 0.6;
  left.add(cup.group, plant.group);
  const film = buildFilm();
  const tapes = buildTapes();
  right.add(film.group, tapes.group);
  return { group, left, right, film: film.group, tapes: tapes.group, update: (t) => cup.update(t) };
}
