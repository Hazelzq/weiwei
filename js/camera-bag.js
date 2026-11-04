// 相机包：一只焦糖色的皮革方包，放在书桌上。翻盖从后沿掀开，相机从包口弹出来。
// 包口是一块深色内衬盖在包顶上，相机从下面升上来时，包身自然挡住还在包里的那一截，
// 看起来就像从包里钻出来一样。所有贴图都用 canvas 现画，不需要额外的图片文件。
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/** 包的外形尺寸（和相机同一套单位：相机宽 3.8）。原点在包底中心，包的正面朝 +z。 */
export const BAG = { W: 4.5, H: 2.9, D: 4.0 };
/** 相机放在包里时，机身中心离包中心往后挪的距离（镜头朝包的正面）。 */
export const BAG_CAM_Z = -1.04;

function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function leatherTexture(base0, base1) {
  return canvasTex(512, 512, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, base0); g.addColorStop(1, base1);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    // 皮面的细纹：许多深浅不一的小点
    for (let i = 0; i < 9000; i++) {
      c.fillStyle = rnd() > 0.5 ? 'rgba(255,226,190,0.05)' : 'rgba(40,18,6,0.09)';
      c.beginPath(); c.arc(rnd() * w, rnd() * h, 0.6 + rnd() * 1.6, 0, 7); c.fill();
    }
    // 几道用旧了的浅褶
    c.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      c.strokeStyle = `rgba(50,24,8,${0.06 + rnd() * 0.06})`;
      const x = rnd() * w, y = rnd() * h;
      c.beginPath(); c.moveTo(x, y);
      c.bezierCurveTo(x + 30, y + 12 * rnd(), x + 60, y - 10, x + 90 + rnd() * 60, y + rnd() * 20);
      c.stroke();
    }
  });
}

/** 一圈明线（缝线），贴在平面上，四周透明。 */
function stitchTexture(aspect) {
  const w = 512, h = Math.max(64, Math.round(512 / aspect));
  return canvasTex(w, h, (c) => {
    c.clearRect(0, 0, w, h);
    c.strokeStyle = '#ecd6aa';
    c.lineWidth = 4;
    c.lineCap = 'round';
    c.setLineDash([13, 10]);
    const m = 16, r = 22;
    c.beginPath();
    c.moveTo(m + r, m); c.lineTo(w - m - r, m); c.quadraticCurveTo(w - m, m, w - m, m + r);
    c.lineTo(w - m, h - m - r); c.quadraticCurveTo(w - m, h - m, w - m - r, h - m);
    c.lineTo(m + r, h - m); c.quadraticCurveTo(m, h - m, m, h - m - r);
    c.lineTo(m, m + r); c.quadraticCurveTo(m, m, m + r, m);
    c.stroke();
  });
}

function liningTexture() {
  return canvasTex(256, 256, (c, w, h) => {
    // 包里的深色绒布内衬，中间更暗，像看进包里
    const g = c.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.7);
    g.addColorStop(0, '#0b0c10'); g.addColorStop(0.7, '#1c1f27'); g.addColorStop(1, '#2b2f38');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) {
      c.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.12)';
      c.fillRect(rnd() * w, rnd() * h, 1.5, 1.5);
    }
  });
}

/**
 * @returns {{ group: THREE.Group, body: THREE.Group, flap: THREE.Group, meshes: THREE.Mesh[], setFlap(k: number): void }}
 */
export function buildCameraBag() {
  const { W, H, D } = BAG;
  const group = new THREE.Group(); // 放在桌上的整只包
  const body = new THREE.Group();  // 包身：开场时鼓一下、晃一晃
  group.add(body);
  const meshes = [];
  const add = (geo, mat, parent, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    meshes.push(m);
    return m;
  };

  const leather = new THREE.MeshStandardMaterial({ map: leatherTexture('#9b6436', '#7a4824'), roughness: 0.56, metalness: 0, envMapIntensity: 1.6 });
  const strapMat = new THREE.MeshStandardMaterial({ map: leatherTexture('#5e341a', '#4a2812'), roughness: 0.5, envMapIntensity: 1.6 });
  const lining = new THREE.MeshStandardMaterial({ map: liningTexture(), roughness: 0.98 });
  const brass = new THREE.MeshStandardMaterial({ color: '#cfa65a', roughness: 0.26, metalness: 0.92, envMapIntensity: 3 });
  const decal = (w, h) => new THREE.MeshStandardMaterial({
    map: stitchTexture(w / h), transparent: true, alphaTest: 0.35, roughness: 0.8, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const stitched = (w, h, parent, x, y, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), decal(w, h));
    m.position.set(x, y, z);
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  /* 包身和包口 */
  add(new RoundedBoxGeometry(W, H, D, 4, 0.16), leather, body, 0, H / 2, 0);
  const mouth = add(new THREE.PlaneGeometry(W - 0.5, D - 0.5), lining, body, 0, H + 0.004, 0);
  mouth.rotation.x = -Math.PI / 2;
  mouth.castShadow = false;
  // 两侧的明线
  for (const side of [-1, 1]) {
    const s = stitched(D - 0.36, H - 0.36, body, side * (W / 2 + 0.004), H / 2, 0);
    s.rotation.y = side * Math.PI / 2;
  }

  /* 前面的小口袋、皮标和扣环 */
  const pw = W * 0.7, ph = H * 0.42, pd = 0.34;
  add(new RoundedBoxGeometry(pw, ph, pd, 3, 0.1), leather, body, 0, H * 0.29, D / 2 + 0.12);
  stitched(pw - 0.12, ph - 0.12, body, 0, H * 0.29, D / 2 + 0.12 + pd / 2 + 0.004);
  add(new RoundedBoxGeometry(0.95, 0.3, 0.05, 2, 0.02), strapMat, body, 0, H * 0.22, D / 2 + 0.12 + pd / 2 + 0.02);
  const buckle = new THREE.Group();
  buckle.position.set(0, H * 0.64, D / 2 + 0.05);
  body.add(buckle);
  const bw = 0.66, bh = 0.46, bt = 0.07;
  add(new THREE.BoxGeometry(bw, bt, bt), brass, buckle, 0, bh / 2);
  add(new THREE.BoxGeometry(bw, bt, bt), brass, buckle, 0, -bh / 2);
  add(new THREE.BoxGeometry(bt, bh + bt, bt), brass, buckle, -bw / 2);
  add(new THREE.BoxGeometry(bt, bh + bt, bt), brass, buckle, bw / 2);
  add(new THREE.CylinderGeometry(0.025, 0.025, bh, 8), brass, buckle, 0.0, 0, 0.02);

  /* 两侧的铜 D 环（背带扣） */
  for (const side of [-1, 1]) {
    const ring = add(new THREE.TorusGeometry(0.17, 0.035, 8, 24), brass, body, side * (W / 2 + 0.09), H - 0.42, 0);
    ring.rotation.y = Math.PI / 2;
    add(new RoundedBoxGeometry(0.1, 0.3, 0.32, 2, 0.03), strapMat, body, side * (W / 2 + 0.02), H - 0.24, 0);
  }

  /* 翻盖：绕包身后上沿转动；顶上一只提手，前沿垂下一条带扣的皮带 */
  const flap = new THREE.Group();
  flap.position.set(0, H, -D / 2);
  body.add(flap);
  const FT = 0.13, LH = 1.15;
  add(new RoundedBoxGeometry(W + 0.12, FT, D + 0.12, 3, 0.06), leather, flap, 0, FT / 2, D / 2);
  const top = stitched(W - 0.1, D - 0.1, flap, 0, FT + 0.004, D / 2);
  top.rotation.x = -Math.PI / 2;
  add(new RoundedBoxGeometry(W + 0.12, LH, FT, 3, 0.06), leather, flap, 0, -LH / 2 + FT, D + 0.06 + FT / 2);
  stitched(W - 0.1, LH - 0.14, flap, 0, -LH / 2 + FT, D + 0.06 + FT + 0.004);
  // 带扣的皮带：从翻盖前沿垂下来，压在铜扣上
  const tabLen = 0.95;
  add(new RoundedBoxGeometry(0.44, tabLen, 0.05, 2, 0.02), strapMat, flap, 0, -LH + FT - tabLen / 2 + 0.55, D + 0.06 + FT + 0.03);
  // 提手
  const handle = add(new THREE.TorusGeometry(0.62, 0.075, 10, 32, Math.PI), strapMat, flap, 0, FT, D / 2);
  handle.scale.set(1, 0.6, 1);
  for (const side of [-1, 1]) add(new RoundedBoxGeometry(0.34, 0.1, 0.3, 2, 0.03), strapMat, flap, side * 0.62, FT + 0.04, D / 2);

  return {
    group, body, flap, meshes,
    /** 0 = 合上，1 = 掀开（往后翻过竖直一点，靠自身重量立住） */
    setFlap(k) { flap.rotation.x = -k * 1.98; },
  };
}
