// 地图页的三维书房：册子合上以后，可以按住拖动环顾四周。
// 江南的老书房：白粉墙、深色木梁、方砖地，一张木书桌；墙上有花格窗（窗外是水墨的水乡）、
// 一扇圆窗（窗外是竹子）和一幅墨梅立轴。所有贴图都用 canvas 现画，不需要额外的图片文件。
import * as THREE from 'three';

function canvasTex(w, h, draw, repeat) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const woodTex = () => canvasTex(1024, 1024, (c, w, h) => {
  c.fillStyle = '#6a4326'; c.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 128) { // 木板
    c.fillStyle = `hsl(26 ${38 + rnd() * 10}% ${22 + rnd() * 8}%)`; c.fillRect(x, 0, 128, h);
    for (let i = 0; i < 60; i++) { // 木纹
      c.strokeStyle = `rgba(${rnd() < 0.5 ? '30,15,5' : '150,100,60'},${0.08 + rnd() * 0.12})`;
      c.lineWidth = 0.6 + rnd() * 1.8;
      const x0 = x + rnd() * 128;
      c.beginPath(); c.moveTo(x0, 0);
      for (let y = 0; y <= h; y += 64) c.lineTo(x0 + Math.sin(y / 140 + i) * 3 + (rnd() - 0.5) * 2, y);
      c.stroke();
    }
    c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(x, 0, 2, h);
  }
});

const tileTex = () => canvasTex(512, 512, (c, w, h) => {
  c.fillStyle = '#3b3833'; c.fillRect(0, 0, w, h);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const l = 38 + rnd() * 8;
    c.fillStyle = `hsl(40 6% ${l}%)`; c.fillRect(x * 128 + 3, y * 128 + 3, 122, 122);
    for (let i = 0; i < 160; i++) { c.fillStyle = `rgba(0,0,0,${rnd() * 0.08})`; c.fillRect(x * 128 + rnd() * 128, y * 128 + rnd() * 128, 2, 2); }
  }
}, [10, 10]);

const wallTex = () => canvasTex(512, 512, (c, w, h) => {
  c.fillStyle = '#ebe6db'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) { // 粉墙上淡淡的水渍
    const g = c.createRadialGradient(rnd() * w, rnd() * h, 0, rnd() * w, rnd() * h, 40 + rnd() * 120);
    g.addColorStop(0, `rgba(120,110,90,${rnd() * 0.05})`); g.addColorStop(1, 'rgba(120,110,90,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }
  for (let i = 0; i < 2500; i++) { c.fillStyle = `rgba(90,80,60,${rnd() * 0.06})`; c.fillRect(rnd() * w, rnd() * h, 1.5, 1.5); }
}, [4, 2]);

// 花格窗：窗外是水墨的水乡，前面一层木格子
const windowTex = () => canvasTex(1024, 640, (c, w, h) => {
  const sky = c.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#e9ece8'); sky.addColorStop(1, '#d8dcd6');
  c.fillStyle = sky; c.fillRect(0, 0, w, h);
  for (const [base, amp, col] of [[300, 70, 'rgba(120,130,130,.35)'], [350, 50, 'rgba(80,95,95,.45)']]) { // 远山
    c.fillStyle = col; c.beginPath(); c.moveTo(0, h);
    for (let x = 0; x <= w; x += 16) c.lineTo(x, base - Math.abs(Math.sin(x / 170 + base)) * amp - Math.sin(x / 47) * 8);
    c.lineTo(w, h); c.fill();
  }
  c.fillStyle = '#c9d0cc'; c.fillRect(0, 430, w, h - 430); // 河
  for (let i = 0; i < 30; i++) { c.strokeStyle = 'rgba(90,100,100,.18)'; c.beginPath(); const y = 450 + rnd() * 180, x = rnd() * w; c.moveTo(x, y); c.lineTo(x + 40 + rnd() * 80, y); c.stroke(); }
  const house = (x, y, s) => { // 白墙黑瓦
    c.fillStyle = '#f4f3ee'; c.fillRect(x, y, 110 * s, 70 * s);
    c.fillStyle = '#2d2f30'; c.beginPath(); c.moveTo(x - 10 * s, y + 4 * s); c.lineTo(x + 20 * s, y - 22 * s); c.lineTo(x + 90 * s, y - 22 * s); c.lineTo(x + 120 * s, y + 4 * s); c.fill();
    c.fillRect(x + 20 * s, y + 25 * s, 16 * s, 22 * s); c.fillRect(x + 70 * s, y + 25 * s, 16 * s, 22 * s);
    c.fillStyle = 'rgba(40,40,40,.12)'; c.fillRect(x, y + 70 * s, 110 * s, 20 * s);
  };
  house(70, 360, 1); house(220, 375, 0.8); house(700, 355, 1.1); house(860, 372, 0.85);
  c.strokeStyle = '#4b4f4f'; c.lineWidth = 9; c.beginPath(); c.arc(520, 470, 110, Math.PI * 1.08, Math.PI * 1.92); c.stroke(); // 石桥
  c.lineWidth = 5; c.beginPath(); c.moveTo(390, 432); c.lineTo(650, 432); c.stroke();
  // 木格子
  c.strokeStyle = '#3a2416'; c.lineWidth = 9;
  for (let x = 0; x <= w; x += w / 8) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
  for (let y = 0; y <= h; y += h / 5) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  c.lineWidth = 26; c.strokeRect(0, 0, w, h);
});

// 圆窗外的竹子（圆形以外透明）
const moonTex = () => canvasTex(512, 512, (c, w, h) => {
  c.save(); c.beginPath(); c.arc(256, 256, 250, 0, Math.PI * 2); c.clip();
  c.fillStyle = '#e4e8e2'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 7; i++) {
    const x = 40 + i * 70 + rnd() * 30, tone = 60 + rnd() * 50;
    c.strokeStyle = `rgba(${tone - 20},${tone + 10},${tone - 10},.75)`; c.lineWidth = 9 + rnd() * 6;
    c.beginPath(); c.moveTo(x, h); c.lineTo(x + (rnd() - 0.5) * 30, 0); c.stroke();
    for (let y = 40; y < h; y += 70 + rnd() * 30) { c.fillStyle = 'rgba(40,60,45,.6)'; c.fillRect(x - 8, y, 16, 3); }
    for (let k = 0; k < 9; k++) { // 竹叶
      const lx = x + (rnd() - 0.5) * 60, ly = rnd() * h;
      c.fillStyle = `rgba(50,80,60,${0.45 + rnd() * 0.3})`;
      c.beginPath(); c.ellipse(lx, ly, 26, 5, (rnd() - 0.5) * 1.6, 0, Math.PI * 2); c.fill();
    }
  }
  c.restore();
});

// 墨梅立轴
const scrollTex = () => canvasTex(256, 768, (c, w, h) => {
  c.fillStyle = '#8c7a5c'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#efe7d3'; c.fillRect(22, 70, w - 44, h - 150);
  c.strokeStyle = '#2b2622'; c.lineCap = 'round';
  const branch = (x, y, a, len, wd) => {
    if (wd < 1) return;
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    c.lineWidth = wd; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke();
    if (rnd() < 0.6) { c.fillStyle = `rgba(190,60,70,${0.6 + rnd() * 0.3})`; c.beginPath(); c.arc(x2, y2, 5 + rnd() * 3, 0, Math.PI * 2); c.fill(); }
    branch(x2, y2, a + (rnd() - 0.5) * 0.9, len * 0.78, wd * 0.68);
    if (rnd() < 0.55) branch(x2, y2, a + (rnd() < 0.5 ? -0.8 : 0.8), len * 0.6, wd * 0.55);
  };
  branch(60, 640, -1.25, 120, 9); branch(70, 560, -0.6, 80, 5);
  c.fillStyle = '#b23a2e'; c.fillRect(170, 600, 22, 22); // 小印章
});

/** 在 scene 里搭好书房。桌面在 y = 0，册子就放在桌面中间。 */
export function buildRoom(scene) {
  const room = new THREE.Group();
  scene.add(room);
  const std = (opt) => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...opt });
  const add = (geo, mat, x, y, z, shadow = true) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    m.receiveShadow = true; m.castShadow = shadow; room.add(m); return m;
  };
  const FLOOR = -14.4, CEIL = 22, BACK = -20, FRONT = 26, SIDE = 26;
  const dark = std({ color: '#2e1d12', roughness: 0.75 });

  // 书桌：桌面、牙板、四条腿
  const wood = woodTex();
  wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.repeat.set(2, 1);
  const deskMat = std({ map: wood, roughness: 0.62 });
  add(new THREE.BoxGeometry(36, 0.8, 18), deskMat, 0, -0.4, 0);
  add(new THREE.BoxGeometry(34.4, 1.6, 0.5), dark, 0, -1.6, 8.6);
  add(new THREE.BoxGeometry(34.4, 1.6, 0.5), dark, 0, -1.6, -8.6);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.BoxGeometry(0.9, -FLOOR - 0.8, 0.9), dark, sx * 17.2, (FLOOR - 0.8) / 2, sz * 8.3);

  // 地面、天花
  add(new THREE.PlaneGeometry(SIDE * 2, FRONT - BACK).rotateX(-Math.PI / 2), std({ map: tileTex() }), 0, FLOOR, (FRONT + BACK) / 2, false);
  add(new THREE.PlaneGeometry(SIDE * 2, FRONT - BACK).rotateX(Math.PI / 2), std({ color: '#5a4636' }), 0, CEIL, (FRONT + BACK) / 2, false);

  // 四面白粉墙，下面一圈深色木踢脚，上面一道木梁
  const wallMat = std({ map: wallTex() });
  const H = CEIL - FLOOR, midY = (CEIL + FLOOR) / 2;
  const walls = [
    { w: SIDE * 2, pos: [0, midY, BACK], ry: 0 },
    { w: SIDE * 2, pos: [0, midY, FRONT], ry: Math.PI },
    { w: FRONT - BACK, pos: [-SIDE, midY, (FRONT + BACK) / 2], ry: Math.PI / 2 },
    { w: FRONT - BACK, pos: [SIDE, midY, (FRONT + BACK) / 2], ry: -Math.PI / 2 },
  ];
  for (const wl of walls) {
    const m = add(new THREE.PlaneGeometry(wl.w, H), wallMat, ...wl.pos, false);
    m.rotation.y = wl.ry;
    const skirt = add(new THREE.BoxGeometry(wl.w, 1.6, 0.3), dark, 0, 0, 0, false);
    skirt.position.copy(m.position); skirt.position.y = FLOOR + 0.8; skirt.rotation.y = wl.ry;
    skirt.position.add(new THREE.Vector3(0, 0, 0.15).applyAxisAngle(new THREE.Vector3(0, 1, 0), wl.ry));
    const beam = add(new THREE.BoxGeometry(wl.w, 1.2, 0.8), dark, 0, 0, 0, false);
    beam.position.copy(m.position); beam.position.y = CEIL - 0.6; beam.rotation.y = wl.ry;
    beam.position.add(new THREE.Vector3(0, 0, 0.4).applyAxisAngle(new THREE.Vector3(0, 1, 0), wl.ry));
  }
  for (const x of [-SIDE + 0.5, SIDE - 0.5]) for (const z of [BACK + 0.5, FRONT - 0.5]) add(new THREE.BoxGeometry(1, H, 1), dark, x, midY, z, false);

  // 后墙和前墙的花格窗
  const winMat = std({ map: windowTex(), roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.22, emissiveMap: null });
  winMat.emissiveMap = winMat.map;
  for (const [x, z, ry] of [[3, BACK + 0.06, 0], [-4, FRONT - 0.06, Math.PI]]) {
    const win = add(new THREE.PlaneGeometry(16, 10), winMat, x, 7.5, z, false);
    win.rotation.y = ry;
    const sill = add(new THREE.BoxGeometry(17, 0.6, 1.2), dark, x, 2.2, z + (ry ? -0.6 : 0.6), false);
    sill.rotation.y = ry;
  }
  // 左墙圆窗
  const moonMat = std({ map: moonTex(), transparent: true, roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.2 });
  moonMat.emissiveMap = moonMat.map;
  const moon = add(new THREE.CircleGeometry(5.5, 64), moonMat, -SIDE + 0.06, 6.5, -2, false);
  moon.rotation.y = Math.PI / 2;
  const ring = add(new THREE.TorusGeometry(5.6, 0.35, 12, 64), dark, -SIDE + 0.2, 6.5, -2, false);
  ring.rotation.y = Math.PI / 2;
  // 右墙墨梅立轴
  const scroll = add(new THREE.PlaneGeometry(4.2, 12.6), std({ map: scrollTex(), roughness: 1 }), SIDE - 0.08, 7, 2, false);
  scroll.rotation.y = -Math.PI / 2;
  add(new THREE.CylinderGeometry(0.18, 0.18, 4.8, 12).rotateX(Math.PI / 2), dark, SIDE - 0.25, 0.6, 2, false);

  // 桌上一只青瓷小瓶
  const pts = [[0, 0], [0.7, 0.05], [0.95, 0.6], [0.8, 1.4], [0.35, 2.1], [0.32, 2.6], [0.5, 2.8]].map(([x, y]) => new THREE.Vector2(x, y));
  add(new THREE.LatheGeometry(pts, 64), new THREE.MeshStandardMaterial({ color: '#9fbfae', roughness: 0.25, metalness: 0.05 }), -14, 0, -5.5);

  return { room, bounds: { FLOOR, CEIL, BACK, FRONT, SIDE } };
}
