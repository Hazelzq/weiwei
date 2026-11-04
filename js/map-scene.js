// 地图页的 3D 场景：一本摊开在桌上的册子（蓝印花布封面），
// 左页夹着植物标本，右页是水墨地图。地点仍是立在纸上的小相片卡，
// 两个出生地用会发光的红灯笼标出，按顺序用小圆点连成“走过的路”。
// 书桌上还有一只相机包和几件立体的小摆件；开场时相机从包里弹出来，拍一张，再收回包里，册子翻开。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SPREAD_W, SPREAD_H, SLOTS, inMap, unproject } from './book-art.js';
import { buildCameraModel } from './camera-model.js';
import { buildCameraBag, BAG, BAG_CAM_Z } from './camera-bag.js';
import { buildDeskProps } from './desk-props.js';
const SW = 13.2, SD = (SW * SPREAD_H) / SPREAD_W;
const PAGE_BASE = 0.3, COVER = 0.08;
const CARD_Y = 0.95, CARD_SCALE = 0.56;

/** 书页表面高度：中缝下凹，向外缓缓拱起。 */
export function surfaceY(x) {
  const t = Math.min(1, Math.abs(x) / (SW / 2));
  return PAGE_BASE + 0.22 * (1 - (1 - t) ** 3) * (1 - 0.4 * t);
}
const world = (fx, fy) => { const x = (fx - 0.5) * SW; return new THREE.Vector3(x, surfaceY(x), (fy - 0.5) * SD); };

function fabricTexture() {
  // 书套内侧：米白棉布上的浅蓝小圆点，和封面照片的布料呼应。
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const c = cv.getContext('2d');
  c.fillStyle = '#efebe4'; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3000; i++) { c.fillStyle = Math.random() > 0.5 ? '#ffffff14' : '#7a6a5010'; c.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  c.fillStyle = '#a9b7c8';
  for (let y = 8; y < 256; y += 16) for (let x = (y / 16) % 2 ? 16 : 8; x < 256; x += 16) { c.beginPath(); c.arc(x, y, 1.3, 0, 7); c.fill(); }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 3.5);
  return t;
}
const texLoader = new THREE.TextureLoader();
/** 所有图片贴图读完的信号：开场前要等它们都到齐，一次性传给显卡，动画里就不会卡一下。 */
const texJobs = [];
function loadTracked(url) {
  let done;
  texJobs.push(new Promise((resolve) => { done = resolve; }));
  return texLoader.load(url, () => done(), undefined, () => done());
}
function photoTexture(url) {
  const t = loadTracked(url);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
/** 书桌照片（assets/desk.jpg）里桌垫的位置，用来把开场镜头对齐到照片上。 */
export const DESK = { w: 1920, h: 1080, matX: 1067, matY: 937, matW: 805, posX: 0.556, posY: 1 };
/** 照片按 object-fit: cover 铺满 W×H 时，桌垫中心在屏幕上的位置和宽度。 */
export function deskAnchor(W, H) {
  const s = Math.max(W / DESK.w, H / DESK.h);
  const ox = (W - DESK.w * s) * DESK.posX, oy = (H - DESK.h * s) * DESK.posY;
  return { x: ox + DESK.matX * s, y: oy + DESK.matY * s, w: DESK.matW * s };
}

function glowTexture(color) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, color + 'cc'); g.addColorStop(0.35, color + '44'); g.addColorStop(1, color + '00');
  c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
}

export function createMapScene(el, { onPick, onPickMiss, onSelect, onSlot, onError, onBookTap, onBagTap, intro: introWanted = false }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 300);
  const home = new THREE.Vector3(0, 15.6, 6.4), homeTarget = new THREE.Vector3(0, 0.2, 0.3);
  camera.position.copy(home);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(homeTarget);
  controls.enableDamping = true;
  controls.screenSpacePanning = false;
  controls.minDistance = 2.6;
  controls.maxDistance = 28;
  controls.minPolarAngle = 0;
  controls.maxPolarAngle = Math.PI * 0.4;
  controls.update();

  const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.04);
  scene.environment = env.texture;
  scene.environmentIntensity = 0.16;
  room.dispose();
  scene.add(new THREE.HemisphereLight('#ffffff', '#a9b6ae', 0.48));
  const key = new THREE.DirectionalLight('#fff3e0', 0.82);
  key.position.set(-6, 14, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  // 阴影范围要盖住册子两边的摆件和相机包
  Object.assign(key.shadow.camera, { left: -20, right: 20, top: 13, bottom: -13, near: 1, far: 50 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight('#dfe9ff', 0.22);
  fill.position.set(7, 6, -7);
  scene.add(fill);

  function mesh(geometry, material, parent = scene, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  /* ---------- 桌面：用页面背后的照片，这里只接住阴影 ---------- */
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.3 }));
  catcher.rotation.x = -Math.PI / 2;
  catcher.position.y = -0.001;
  catcher.receiveShadow = true;
  scene.add(catcher);

  /* ---------- 书：右半本固定，左半本（封面 + 左页）沿书脊翻开 ---------- */
  const HINGE = 0.47;
  const leaf = new THREE.Group();
  leaf.position.set(0, HINGE, 0);
  scene.add(leaf);
  const leafInner = new THREE.Group();
  leafInner.position.y = -HINGE;
  leaf.add(leafInner);
  const calico = new THREE.MeshStandardMaterial({ map: fabricTexture(), roughness: 0.95 });
  const coverW = SW / 2 + 0.28;
  const backCover = mesh(new THREE.BoxGeometry(coverW, COVER, SD + 0.5), calico, scene, coverW / 2, COVER / 2);
  const frontBoard = mesh(new THREE.BoxGeometry(coverW, COVER, SD + 0.5), calico, leafInner, -coverW / 2, COVER / 2);
  const edgeMat = new THREE.MeshStandardMaterial({ color: '#e8dfc8', roughness: 1 });
  const stackW = (SW / 2) * 0.75, stackH = PAGE_BASE + 0.1 - COVER;
  const gutterW = (SW / 2) * 0.26, gutterH = PAGE_BASE - COVER - 0.01;
  for (const side of [-1, 1]) {
    const parent = side < 0 ? leafInner : scene;
    mesh(new THREE.BoxGeometry(stackW, stackH, SD - 0.02), edgeMat, parent, side * (SW / 2) * 0.625, COVER + stackH / 2);
    mesh(new THREE.BoxGeometry(gutterW, gutterH, SD - 0.02), edgeMat, parent, side * gutterW / 2, COVER + gutterH / 2);
  }
  const pageMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.96, metalness: 0 });
  function halfPage(side) {
    const geo = new THREE.PlaneGeometry(SW / 2, SD, 110, 1);
    geo.rotateX(-Math.PI / 2);
    geo.translate((side * SW) / 4, 0, 0);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, surfaceY(pos.getX(i)));
      uv.setX(i, (side < 0 ? 0 : 0.5) + uv.getX(i) * 0.5);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, pageMat);
    m.receiveShadow = true;
    (side < 0 ? leafInner : scene).add(m);
    return m;
  }
  const pageTargets = [halfPage(-1), halfPage(1)];

  // 封面照片（assets/book-cover.jpg）：书合上时朝上
  const frontCover = new THREE.Mesh(new THREE.PlaneGeometry(coverW, SD + 0.5),
    new THREE.MeshStandardMaterial({ map: photoTexture('assets/book-cover.jpg'), roughness: 0.92 }));
  frontCover.rotation.set(Math.PI / 2, 0, Math.PI);
  frontCover.position.set(-coverW / 2, -0.003, 0);
  leafInner.add(frontCover);
  const bookTargets = [frontCover, frontBoard, backCover];

  // 红色书签丝带
  const ribbon = new THREE.MeshStandardMaterial({ color: '#a8322a', roughness: 0.55, side: THREE.DoubleSide });
  const rx = 0.16, ry = surfaceY(rx) + 0.006;
  const r1 = mesh(new THREE.PlaneGeometry(0.13, SD / 2 - 0.9), ribbon, scene, rx, ry, (SD / 2 + 0.9) / 2);
  r1.rotation.x = -Math.PI / 2;
  const drop = ry - COVER, run = 0.3;
  const r2 = mesh(new THREE.PlaneGeometry(0.13, Math.hypot(drop, run)), ribbon, scene, rx, COVER + drop / 2 + 0.004, SD / 2 + run / 2);
  r2.rotation.x = -Math.PI / 2 + Math.atan2(drop, run);
  const r3 = mesh(new THREE.PlaneGeometry(0.13, 0.55), ribbon, scene, rx + 0.03, COVER + 0.005, SD / 2 + run + 0.26);
  r3.rotation.x = -Math.PI / 2; r3.rotation.z = -0.12;

  // 长尾夹，夹住左页上缘
  const clip = new THREE.Group();
  const clipX = -SW * 0.25;
  clip.position.set(clipX, surfaceY(clipX), -SD / 2 + 0.16);
  scene.add(clip);
  const black = new THREE.MeshStandardMaterial({ color: '#1f2124', roughness: 0.35, metalness: 0.6 });
  const steel = new THREE.MeshStandardMaterial({ color: '#c9ccd0', roughness: 0.22, metalness: 0.95 });
  mesh(new THREE.BoxGeometry(0.95, 0.05, 0.42), black, clip, 0, 0.03, 0).rotation.x = 0.06;
  mesh(new THREE.BoxGeometry(0.95, 0.16, 0.05), black, clip, 0, 0.0, -0.24);
  for (const side of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.36, 0.06, -0.18), new THREE.Vector3(side * 0.38, 0.22, -0.32),
      new THREE.Vector3(side * 0.36, 0.12, -0.75), new THREE.Vector3(side * 0.2, 0.1, -0.86),
    ]);
    mesh(new THREE.TubeGeometry(curve, 24, 0.018, 8, false), steel, clip);
  }
  mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.42, 8), steel, clip, 0, 0.1, -0.86).rotation.z = Math.PI / 2;

  // 地点、出生地、路线都放在这里，书打开之前先藏起来。
  const markers = new THREE.Group();
  scene.add(markers);

  /* ---------- 走过的路 ---------- */
  const MAX_DOTS = 1600;
  const dots = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.028, 0.028, 0.01, 12),
    new THREE.MeshStandardMaterial({ color: '#a8463c', roughness: 0.6 }), MAX_DOTS);
  dots.count = 0;
  markers.add(dots);
  let dotPoints = [];
  const dummy = new THREE.Object3D();

  /* ---------- 地点相片卡 ---------- */
  const pins = new Map();
  const hits = [];
  const red = new THREE.MeshStandardMaterial({ color: '#b23a2e', roughness: 0.55 });
  const brass = new THREE.MeshStandardMaterial({ color: '#b08d4a', roughness: 0.35, metalness: 0.7 });
  const markerGeo = new THREE.CylinderGeometry(0.075, 0.085, 0.022, 40);
  const postGeo = new THREE.CylinderGeometry(0.011, 0.011, 1, 8);
  postGeo.translate(0, 0.5, 0);
  const frameGeo = new THREE.BoxGeometry(0.82, 1.0, 0.03);
  const faceGeo = new THREE.PlaneGeometry(0.8, 0.98);
  const clipGeo = new THREE.BoxGeometry(0.06, 0.14, 0.07);

  function cardTexture(image, title, index) {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 640;
    const c = cv.getContext('2d');
    c.fillStyle = '#fbf6ea'; c.fillRect(0, 0, 512, 640);
    c.fillStyle = '#e4ddcf'; c.fillRect(30, 28, 452, 470);
    if (image) {
      const iw = image.naturalWidth || image.width, ih = image.naturalHeight || image.height, s = Math.max(452 / iw, 470 / ih);
      c.save(); c.beginPath(); c.rect(30, 28, 452, 470); c.clip();
      c.drawImage(image, 30 + (452 - iw * s) / 2, 28 + (470 - ih * s) / 2, iw * s, ih * s);
      c.restore();
    }
    c.textAlign = 'center'; c.fillStyle = '#34322e';
    const font = (n) => `${n}px WenKai, "Kaiti SC", "KaiTi", "PingFang SC", serif`;
    let size = 44;
    c.font = font(size);
    while (c.measureText(title).width > 440 && size > 22) { size -= 2; c.font = font(size); }
    c.fillText(title, 256, 564);
    c.fillStyle = '#b23a2e'; c.font = '24px "PingFang SC", "Microsoft YaHei", sans-serif';
    c.fillText(`第 ${index + 1} 站`, 256, 610);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  }

  function buildPin(id) {
    const group = new THREE.Group();
    const marker = mesh(markerGeo, red, group, 0, 0.011);
    const post = mesh(postGeo, brass, group);
    const card = new THREE.Group();
    card.scale.setScalar(CARD_SCALE);
    group.add(card);
    const frameMat = new THREE.MeshStandardMaterial({ color: '#fbf6ea', roughness: 0.7 });
    const frame = mesh(frameGeo, frameMat, card);
    const faceMat = new THREE.MeshStandardMaterial({ roughness: 0.85, side: THREE.DoubleSide });
    const face = mesh(faceGeo, faceMat, card, 0, 0, 0.0165);
    const back = mesh(faceGeo, faceMat, card, 0, 0, -0.0165);
    back.rotation.y = Math.PI;
    mesh(clipGeo, red, card, 0, 0.5, 0.03);
    for (const m of [marker, frame, face, back]) { m.userData.pinId = id; hits.push(m); }
    markers.add(group);
    return { id, group, post, card, frameMat, faceMat, sig: '', born: performance.now(), phase: Math.random() * 6, anchor: new THREE.Vector3(0, CARD_Y, 0) };
  }
  function disposePin(e) {
    markers.remove(e.group);
    e.frameMat.dispose();
    e.faceMat.map?.dispose();
    e.faceMat.dispose();
    for (let i = hits.length - 1; i >= 0; i--) if (hits[i].userData.pinId === e.id) hits.splice(i, 1);
  }

  // 相片卡互相避让：靠得太近的卡片向外散开，用细杆连回原地。
  const up = new THREE.Vector3(0, 1, 0);
  function layoutCards() {
    const pts = [...pins.values()].map((e) => ({ e, x: e.group.position.x, z: e.group.position.z, bx: e.group.position.x, bz: e.group.position.z }));
    const minD = 0.58;
    for (let it = 0; it < 80; it++) {
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], b = pts[j];
        let dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
        if (d < 1e-4) { dx = Math.cos(i + j); dz = Math.sin(i + j); d = 1; }
        if (d < minD) {
          const push = (minD - d) / 2 / d;
          a.x -= dx * push; a.z -= dz * push; b.x += dx * push; b.z += dz * push;
        }
      }
      for (const p of pts) { p.x += (p.bx - p.x) * 0.04; p.z += (p.bz - p.z) * 0.04; }
    }
    for (const p of pts) {
      const e = p.e;
      const top = new THREE.Vector3(p.x - p.bx, CARD_Y - CARD_SCALE * 0.5, p.z - p.bz);
      e.anchor.set(top.x, CARD_Y, top.z);
      e.post.scale.set(1, top.length(), 1);
      e.post.quaternion.setFromUnitVectors(up, top.clone().normalize());
    }
  }

  /** list: [{ id, fx, fy, title, image, imageKey }]，按旅行顺序 */
  function syncPins(list) {
    const keep = new Set(list.map((p) => p.id));
    for (const [id, e] of pins) if (!keep.has(id)) { disposePin(e); pins.delete(id); }
    list.forEach((p, index) => {
      let e = pins.get(p.id);
      if (!e) { e = buildPin(p.id); pins.set(p.id, e); }
      e.group.position.copy(world(p.fx, p.fy));
      const sig = `${p.title}|${index}|${p.imageKey}`;
      if (sig !== e.sig) {
        const prev = e.faceMat.map;
        e.faceMat.map = cardTexture(p.image, p.title, index);
        e.faceMat.needsUpdate = true;
        prev?.dispose();
        e.sig = sig;
      }
    });
    layoutCards();
    rebuildRoute(list);
    highlight();
  }
  function rebuildRoute(list) {
    dotPoints = [];
    if (list.length >= 2) {
      const pts = list.map((p) => world(p.fx, p.fy));
      const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      const n = Math.min(MAX_DOTS, Math.floor(curve.getLength() / 0.1));
      for (let i = 1; i < n; i++) {
        const q = curve.getPointAt(i / n);
        if (pts.some((p) => Math.hypot(p.x - q.x, p.z - q.z) < 0.12)) continue;
        q.y = surfaceY(q.x) + 0.008;
        dotPoints.push(q);
      }
    }
    dots.count = dotPoints.length;
    dotPoints.forEach((q, i) => { dummy.position.copy(q); dummy.scale.setScalar(1); dummy.updateMatrix(); dots.setMatrixAt(i, dummy.matrix); });
    dots.instanceMatrix.needsUpdate = true;
  }

  /* ---------- 出生地红灯笼 ---------- */
  const births = new Map();
  const lanternRed = new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.5, emissive: '#ff6a3a', emissiveIntensity: 0.55 });
  const lanternGold = new THREE.MeshStandardMaterial({ color: '#c9a050', roughness: 0.35, metalness: 0.7 });
  const bamboo = new THREE.MeshStandardMaterial({ color: '#6b5a3e', roughness: 0.7 });
  const ribMat = new THREE.MeshStandardMaterial({ color: '#8e2a20', roughness: 0.6 });
  const glowMap = glowTexture('#ff9a5a');
  const lanternLights = new THREE.Group();
  scene.add(lanternLights);
  const LANTERN_LIGHT = 0.6;
  function buildLantern(id) {
    const g = new THREE.Group();
    const plate = mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.03, 24), bamboo, g, 0, 0.015);
    mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.95, 8), bamboo, g, 0, 0.48);
    const lantern = new THREE.Group();
    lantern.position.y = 1.08;
    g.add(lantern);
    const bodyM = mesh(new THREE.SphereGeometry(0.2, 40, 28), lanternRed, lantern);
    bodyM.scale.set(1, 0.86, 1);
    for (const y of [0.17, -0.17]) mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 20), lanternGold, lantern, 0, y);
    for (let k = 0; k < 6; k++) {
      const rib = mesh(new THREE.TorusGeometry(0.201, 0.004, 6, 48, Math.PI), ribMat, lantern);
      rib.rotation.set(0, (k * Math.PI) / 6, Math.PI / 2);
      rib.scale.set(0.86, 1, 1);
    }
    mesh(new THREE.CylinderGeometry(0.012, 0.03, 0.16, 8), ribMat, lantern, 0, -0.27);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 }));
    glow.scale.set(1.3, 1.3, 1);
    lantern.add(glow);
    // 光源放在单独的组里，书合上时只把亮度调成 0（见 showMarkers）
    const light = new THREE.PointLight('#ff9a5a', markers.visible ? LANTERN_LIGHT : 0, 2.4, 2);
    lanternLights.add(light);
    const rings = [0, 1].map(() => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.235, 48),
        new THREE.MeshBasicMaterial({ color: '#b23a2e', transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.012;
      g.add(ring);
      return ring;
    });
    for (const m of [plate, bodyM]) { m.userData.pinId = id; hits.push(m); }
    markers.add(g);
    return { id, group: g, lantern, light, rings, phase: Math.random() * 6 };
  }
  /** list: [{ id, fx, fy }] */
  function syncBirths(list) {
    for (const b of list) {
      let e = births.get(b.id);
      if (!e) { e = buildLantern(b.id); births.set(b.id, e); }
      e.group.position.copy(world(b.fx, b.fy));
      e.light.position.copy(e.group.position);
      e.light.position.y += 1.08;
    }
  }

  /* ---------- 选中、聚焦 ---------- */
  let selected = null, placing = false, transition = false;
  const targetPos = new THREE.Vector3(), targetLook = new THREE.Vector3();
  function highlight() {
    for (const [id, e] of pins) {
      e.frameMat.color.set(id === selected ? '#f2c96a' : placing ? '#e6e0d2' : '#fbf6ea');
      e.frameMat.emissive.set(id === selected ? '#c98a2a' : '#000000');
      e.frameMat.emissiveIntensity = id === selected ? 0.18 : 0;
    }
  }
  const tmp = new THREE.Vector3();
  function focusPoint(p, height) {
    targetLook.copy(p);
    const dir = new THREE.Vector3(camera.position.x - p.x, 0, camera.position.z - p.z);
    if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
    dir.normalize();
    targetPos.copy(p).addScaledVector(dir, 2.2);
    targetPos.y = p.y + height;
    transition = true;
    controls.enabled = false;
  }
  function focus(id) {
    selected = id;
    highlight();
    const e = pins.get(id);
    if (e) { e.card.getWorldPosition(tmp); focusPoint(tmp.clone(), 3.1); return; }
    const b = births.get(id);
    if (b) { b.lantern.getWorldPosition(tmp); focusPoint(tmp.clone(), 2.9); }
  }
  function reset() {
    selected = null;
    highlight();
    targetPos.copy(home);
    targetLook.copy(homeTarget);
    transition = true;
    controls.enabled = false;
  }

  /* ---------- 放置提示 ---------- */
  const ghost = new THREE.Group();
  const ghostMat = new THREE.MeshStandardMaterial({ color: '#b23a2e', transparent: true, opacity: 0.75, emissive: '#ff8a5a', emissiveIntensity: 0.4 });
  mesh(markerGeo, ghostMat, ghost, 0, 0.011).castShadow = false;
  mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.7, 8), ghostMat, ghost, 0, 0.36).castShadow = false;
  mesh(new THREE.SphereGeometry(0.045, 16, 12), ghostMat, ghost, 0, 0.72).castShadow = false;
  ghost.visible = false;
  scene.add(ghost);
  let ghostLocked = false;
  function setGhost(frac) {
    ghostLocked = Boolean(frac);
    ghost.visible = Boolean(frac);
    if (frac) ghost.position.copy(world(frac[0], frac[1]));
  }

  /* ---------- 状态 ---------- */
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let bookOpen = !introWanted;
  let seq = null;   // 合上 / 翻开册子
  let shot = null;  // 相机从包里弹出来拍一张（开场时接着翻开册子）
  /* 两种视角：开场时贴合桌面照片的低机位（desk），之后是俯看地图的阅读视角（reading）。 */
  let viewMode = introWanted ? 'desk' : 'reading';

  /* ---------- 相机：立体相机，正面是 assets/camera.png；平时收在相机包里 ---------- */
  const CW = 3.8;
  const model = buildCameraModel({
    width: CW, photo: photoTexture('assets/camera.png'), lensPhoto: photoTexture('assets/camera-lens.jpg'),
  });
  const prop = model.group;
  const iris = model.iris;
  const CH = model.height;
  prop.visible = false;
  scene.add(prop);

  /* ---------- 书桌上的摆件和相机包（只在看书桌的时候出现，俯看地图时收起来） ---------- */
  const desk = buildDeskProps();
  scene.add(desk.group);
  const bag = buildCameraBag();
  desk.group.add(bag.group);
  const bagSet = new Set(bag.meshes);
  const closedTargets = [...bookTargets, ...bag.meshes];
  function showDesk(on) { desk.group.visible = on; }

  /* ---------- 指针 ---------- */
  const ray = new THREE.Raycaster(), pointer = new THREE.Vector2();
  function cast(e, targets) {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, (-(e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(pointer, camera);
    return ray.intersectObjects(targets, false)[0];
  }
  const pagePoint = (hit) => {
    const fx = hit.uv.x, fy = 1 - hit.uv.y;
    return { fx, fy, px: fx * SPREAD_W, py: fy * SPREAD_H };
  };
  const slotAt = (px, py) => SLOTS.findIndex((s) => px >= s.x && px <= s.x + s.w && py >= s.y && py <= s.y + s.h);
  let downX = 0, downY = 0, downId = -1;
  renderer.domElement.addEventListener('pointerdown', (e) => { if (e.isPrimary) { downX = e.clientX; downY = e.clientY; downId = e.pointerId; } });
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || shot || seq) return;
    if (!bookOpen) { renderer.domElement.style.cursor = cast(e, closedTargets) ? 'pointer' : 'grab'; return; }
    if (placing && !ghostLocked) {
      const hit = cast(e, pageTargets);
      const p = hit && pagePoint(hit);
      const ok = Boolean(p && inMap(p.px, p.py));
      ghost.visible = ok;
      if (ok) ghost.position.copy(world(p.fx, p.fy));
      renderer.domElement.style.cursor = ok ? 'crosshair' : 'not-allowed';
      return;
    }
    let pointerOn = Boolean(cast(e, hits));
    if (!pointerOn) {
      const hit = cast(e, pageTargets);
      if (hit) { const p = pagePoint(hit), slot = slotAt(p.px, p.py); pointerOn = slot >= 0 && onSlot(slot, true); }
    }
    renderer.domElement.style.cursor = pointerOn ? 'pointer' : 'grab';
  });
  renderer.domElement.addEventListener('pointerleave', () => { if (placing && !ghostLocked) ghost.visible = false; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (shot || seq) return;
    if (e.pointerId !== downId || Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
    if (!bookOpen) {
      // 合上时：点册子翻开，点相机包再拍一张
      const hit = cast(e, closedTargets);
      if (hit) (bagSet.has(hit.object) ? onBagTap : onBookTap)?.();
      return;
    }
    if (placing) {
      const hit = cast(e, pageTargets);
      if (!hit) return;
      const p = pagePoint(hit);
      if (inMap(p.px, p.py)) { const [lon, lat] = unproject(p.px, p.py); onPick({ lon, lat, fx: p.fx, fy: p.fy }); }
      else onPickMiss();
      return;
    }
    const pinHit = cast(e, hits);
    if (pinHit) { onSelect(pinHit.object.userData.pinId); return; }
    const hit = cast(e, pageTargets);
    if (hit) {
      const p = pagePoint(hit), slot = slotAt(p.px, p.py);
      if (slot >= 0 && onSlot(slot, false)) return;
    }
    if (selected) onSelect(null);
  });

  const easeInOut = (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
  const easeOutBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2; };
  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const tmpObj = new THREE.Object3D();
  const tmpV = new THREE.Vector3();
  function setOpen(k) { leaf.rotation.z = -Math.PI * (1 - k); }
  /** 地点、出生地和长尾夹一起显示或收起。灯笼的光源一直留在场景里，只改亮度：
      光源数目一变，所有材质都要重新编译，画面会卡一下。 */
  function showMarkers(on) {
    markers.visible = on;
    clip.visible = on;
    for (const b of births.values()) b.light.intensity = on ? LANTERN_LIGHT : 0;
  }
  function revealMarkers() {
    showMarkers(true);
    const now = performance.now();
    for (const e of pins.values()) e.born = now;
  }

  const closedCenter = new THREE.Vector3(coverW / 2, 0.45, 0);
  const DESK_ELEV = (22 * Math.PI) / 180, DESK_FOV = 36;
  function readingFov() {
    const need = THREE.MathUtils.radToDeg(2 * Math.atan((SW / 2 + 0.5) / (home.distanceTo(homeTarget) * camera.aspect)));
    return Math.min(78, Math.max(36, need));
  }
  function deskViewFor(W, H) {
    const m = deskAnchor(W, H);
    const px = m.w * 0.45; // 合上的书约占桌垫宽度的一半
    const d = (coverW * H) / (2 * Math.tan(THREE.MathUtils.degToRad(DESK_FOV / 2)) * px);
    const pos = closedCenter.clone().add(new THREE.Vector3(0, Math.sin(DESK_ELEV), Math.cos(DESK_ELEV)).multiplyScalar(d));
    return { pos, target: closedCenter.clone(), fov: DESK_FOV, offX: W / 2 - m.x, offY: H / 2 - m.y * 0.985, W, H, d };
  }
  const deskView = () => deskViewFor(el.clientWidth || 1, el.clientHeight || 1);

  /* ---------- 相机包放在哪：册子右边的桌面上，整只包（连掀开的翻盖、弹出来的相机）都要在画面里 ---------- */
  const probe = new THREE.PerspectiveCamera(DESK_FOV, 1, 0.1, 300);
  function deskProbe() {
    const dv = deskView();
    probe.aspect = dv.W / dv.H;
    probe.fov = dv.fov;
    probe.position.copy(dv.pos);
    probe.lookAt(dv.target);
    probe.setViewOffset(dv.W, dv.H, dv.offX, dv.offY, dv.W, dv.H);
    probe.updateProjectionMatrix();
    probe.updateMatrixWorld();
    return probe;
  }
  /** 包放在 (x, y0, z)、缩放 s、朝向 yaw 时，包身连同掀开的翻盖、弹出的相机是不是都在画面里。 */
  function bagFits(p, x, z, s, yaw, y0 = 0) {
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    const hw = BAG.W / 2, hd = BAG.D / 2 + 0.3, top = BAG.H + 4.2;
    const corners = [[-hw, 0, hd], [hw, 0, hd], [hw, 0, -hd], [-hw, top, -hd - 1.6], [hw, top, -hd - 1.6], [hw, top * 0.7, hd]];
    for (const [lx, ly, lz] of corners) {
      tmpV.set(x + (lx * c + lz * sn) * s, y0 + ly * s, z + (-lx * sn + lz * c) * s).project(p);
      if (Math.abs(tmpV.x) > 0.95 || tmpV.y > 0.9 || tmpV.y < -0.9) return false;
    }
    return true;
  }
  /** 包整个跑到了画面右边外面 */
  function bagOffRight(p, x, z, s, yaw) {
    const c = Math.cos(yaw), sn = Math.sin(yaw), hw = (BAG.W / 2) * s, hd = (BAG.D / 2 + 0.3) * s;
    for (const lx of [-hw, hw]) for (const lz of [-hd, hd]) {
      if (tmpV.set(x + lx * c + lz * sn, 0, z - lx * sn + lz * c).project(p).x < 1.02) return false;
    }
    return true;
  }
  function setBag(x, y, z, s, yaw) {
    bagScale = s;
    bag.group.position.set(x, y, z);
    bag.group.rotation.set(0, yaw, 0);
    bag.group.scale.setScalar(s);
    bag.group.updateMatrixWorld(true);
  }
  const BOOK_TOP = 0.945; // 合上的册子封面有多高
  let bagScale = 1;
  let bagHop = null;      // 窄屏开场：包先放在合着的册子上，拍完跳到画面外，册子再翻开
  function placeBag({ allowBook = false } = {}) {
    const p = deskProbe();
    const yawAt = (x, z) => Math.atan2(p.position.x - x, p.position.z - z) - 0.28; // 稍微侧一点，能看出包的厚度
    const halfAt = (yaw, s) => (BAG.W / 2 * Math.abs(Math.cos(yaw)) + (BAG.D / 2 + 0.3) * Math.abs(Math.sin(yaw))) * s;
    let pick = null;
    for (const z of [0.3, -0.5]) {
      for (const s of [1, 0.9, 0.8, 0.7, 0.62, 0.55, 0.5, 0.45, 0.4]) {
        for (let x = 12.6; x > 0; x -= 0.25) {
          const yaw = yawAt(x, z);
          if (x - halfAt(yaw, s) < coverW + 0.35) break; // 不能碰到册子
          if (bagFits(p, x, z, s, yaw)) { pick = { x, z, s, yaw }; break; }
        }
        if (pick) break;
      }
      if (pick) break;
    }
    bagHop = null;
    if (allowBook && (!pick || pick.s < 0.62)) {
      // 竖屏手机、平板：册子旁边放不下一只像样的包，开场时就把包放在合着的册子上
      const x = coverW / 2, z = 0.3, yaw = yawAt(x, z);
      const s = [0.85, 0.8, 0.7, 0.62, 0.55, 0.5].find((k) => bagFits(p, x, z, k, yaw, BOOK_TOP)) ?? 0.5;
      let toX = x + 14;
      for (let xx = x; xx < x + 20; xx += 0.25) if (bagOffRight(p, xx, z, s, yaw)) { toX = xx + 0.5; break; }
      setBag(x, BOOK_TOP, z, s, yaw);
      bagHop = { toX };
      desk.right.visible = false;
      return;
    }
    if (!pick) { // 屏幕实在太窄：缩小，贴着册子放，露出一部分也没关系
      const s = 0.5, z = 0.3, yaw = yawAt(coverW + 2, z);
      pick = { x: coverW + 0.35 + halfAt(yaw, s), z, s, yaw };
    }
    setBag(pick.x, 0, pick.z, pick.s, pick.yaw);
    // 胶卷和纸胶带跟着包摆：胶卷在包前面偏左，纸胶带在包右边。包缩小了说明屏幕窄，它们本来也在画面外，就收起来
    const filmAt = (lx) => tmpV.set(lx, 0, 3.0).applyMatrix4(bag.group.matrixWorld);
    let fx = -1.7;
    if (filmAt(fx).x - 0.8 < coverW + 0.3) fx = -0.4; // 离册子太近就往包前面挪一点
    desk.film.position.copy(filmAt(fx)).setY(0);
    desk.film.rotation.y = pick.yaw + 0.9;
    desk.tapes.position.copy(tmpV.set(3.4, 0, 1.4).applyMatrix4(bag.group.matrixWorld)).setY(0);
    desk.right.visible = pick.s >= 0.85;
  }

  /* ---------- 把书桌照片“投”回三维里 ----------
     假想一台和拍照时一样的投影机，从桌面视角把 desk.jpg 投到两块面上：桌面（y = 0）和桌子后面的书架（一面竖墙）。
     站在原来的位置看，和照片一模一样；按住拖动换个角度，桌面和书架就有了前后的立体感。
     照片边缘以外的地方用镜像接上，并稍微压暗、虚化。 */
  const photoTex = loadTracked('assets/desk.jpg');
  photoTex.wrapS = photoTex.wrapT = THREE.MirroredRepeatWrapping;
  photoTex.anisotropy = 8;
  const projector = new THREE.PerspectiveCamera(DESK_FOV, DESK.w / DESK.h, 0.1, 400);
  const pv = deskViewFor(DESK.w, DESK.h);
  projector.position.copy(pv.pos);
  projector.lookAt(pv.target);
  projector.setViewOffset(DESK.w, DESK.h, pv.offX, pv.offY, DESK.w, DESK.h);
  projector.updateProjectionMatrix();
  projector.updateMatrixWorld();
  const projVP = new THREE.Matrix4().multiplyMatrices(projector.projectionMatrix, projector.matrixWorldInverse);
  const projMat = new THREE.ShaderMaterial({
    uniforms: { map: { value: photoTex }, projVP: { value: projVP } },
    vertexShader: `varying vec3 vW;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform sampler2D map; uniform mat4 projVP; varying vec3 vW;
      void main() {
        vec4 c = projVP * vec4(vW, 1.0);
        vec2 uv; float off;
        if (c.w <= 0.0) { uv = vec2(0.5, 0.01); off = 1.0; }
        else { uv = c.xy / c.w * 0.5 + 0.5; vec2 o = max(vec2(0.0), max(-uv, uv - 1.0)); off = length(o); }
        vec3 col = texture2D(map, uv, off * 6.0).rgb;
        col *= 1.0 - min(off * 0.9, 0.4);
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.DoubleSide,
  });
  // 照片里桌面和书架的交界大约在第 805 行：从投影机打一条线到桌面上，就知道书架立在哪里
  const edge = new THREE.Vector3(0, -(805 / DESK.h) * 2 + 1, 0.5).unproject(projector).sub(projector.position).normalize();
  const backZ = projector.position.z + edge.z * (-projector.position.y / edge.y);
  const photoRoom = new THREE.Group();
  const deskPlane = new THREE.Mesh(new THREE.PlaneGeometry(400, 300).rotateX(-Math.PI / 2), projMat);
  deskPlane.position.set(0, -0.004, backZ + 150);
  const shelfWall = new THREE.Mesh(new THREE.PlaneGeometry(400, 200), projMat);
  shelfWall.position.set(0, 100, backZ);
  photoRoom.add(deskPlane, shelfWall);
  photoRoom.visible = false;
  scene.add(photoRoom);
  function showPhotoRoom(on) {
    photoRoom.visible = on;
    el.classList.toggle('orbit', on); // 环顾时画布铺满整页，盖住背后的平面照片
  }

  /* 合上册子以后：按住拖动可以换个角度看看书桌四周，滚轮可以拉近拉远（角度有限，转太多照片就穿帮了） */
  function deskOrbit(on) {
    controls.enabled = on;
    if (on) {
      const d = deskView().d;
      Object.assign(controls, {
        minDistance: d * 0.6, maxDistance: d * 1.25, minPolarAngle: 0.8, maxPolarAngle: 1.36,
        minAzimuthAngle: -0.6, maxAzimuthAngle: 0.6, enablePan: false,
      });
      controls.target.copy(closedCenter);
      controls.update();
    } else {
      Object.assign(controls, {
        minDistance: 2.6, maxDistance: 28, minPolarAngle: 0, maxPolarAngle: Math.PI * 0.4,
        minAzimuthAngle: -Infinity, maxAzimuthAngle: Infinity, enablePan: true,
      });
    }
  }
  function applyView(k) {
    const dv = deskView();
    camera.position.lerpVectors(dv.pos, home, k);
    controls.target.lerpVectors(dv.target, homeTarget, k);
    camera.fov = dv.fov + (readingFov() - dv.fov) * k;
    camera.lookAt(controls.target);
    if (k < 1) camera.setViewOffset(dv.W, dv.H, dv.offX * (1 - k), dv.offY * (1 - k), dv.W, dv.H);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }
  function toReading() {
    deskOrbit(false);
    viewMode = 'reading';
    showDesk(false);
    camera.clearViewOffset();
    camera.position.copy(home);
    controls.target.copy(homeTarget);
    camera.fov = readingFov();
    camera.updateProjectionMatrix();
    controls.enabled = true;
    controls.update();
  }

  /* ---------- 相机从包里弹出来，举到眼前拍一张，再收回包里 ----------
     时间轴（秒）：包先鼓一下 → 翻盖掀开 → 相机弹出 → 飞到眼前 → 按快门、闪光 → 飞回包口 → 落回包里 → 翻盖合上。
     开场时接着翻开册子、镜头推近；合上册子以后点相机包，只拍照不翻书。 */
  const SHOT = {
    wiggle: [0, 0.45], flapOpen: [0.28, 0.82], pop: [0.6, 1.4], toEye: [1.4, 2.4], press: 2.58, flash: 2.7,
    back: [3.12, 4.06], sink: [4.06, 4.42], flapClose: [4.36, 4.98], end: 5.0,
  };
  const BOOK = { open: [4.3, 5.8], dolly: [5.9, 7.5], end: 7.55 };
  const CAM_IN_Y = 0.2 + CH / 2;             // 在包里：机身底离包底一点点，顶不出包口
  const CAM_TOP_Y = BAG.H + CH / 2 + 0.55;   // 弹出来以后停在包口上方
  const bagPoint = (y, out) => out.set(0, y, BAG_CAM_Z).applyMatrix4(bag.group.matrixWorld);
  function bezier(out, a, c, b, k) {
    const u = 1 - k;
    return out.set(u * u * a.x + 2 * u * k * c.x + k * k * b.x, u * u * a.y + 2 * u * k * c.y + k * k * b.y, u * u * a.z + 2 * u * k * c.z + k * k * b.z);
  }
  function beginShot(cb, withBook, delay = 0) {
    bag.group.updateMatrixWorld(true);
    const eye = camera.position.clone();
    ray.setFromCamera(new THREE.Vector2(0, 0), camera);
    const dir = ray.ray.direction.clone();
    // 相机举到眼前的距离：横竖都留出余量，竖屏手机上也不会撑出画面
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max(7.6, CW / 0.62 / (2 * tanH * camera.aspect), CH / 0.55 / (2 * tanH));
    const p0 = eye.clone().addScaledVector(dir, dist);
    tmpObj.position.copy(p0);
    tmpObj.lookAt(eye);
    const top = bagPoint(CAM_TOP_Y, new THREE.Vector3());
    const lift = new THREE.Vector3(0, 1, 0);
    const hop = withBook && bagHop
      ? { t: [5.0, 5.55], x0: bag.group.position.x, y0: bag.group.position.y, toX: bagHop.toX } : null;
    shot = {
      start: performance.now() + delay, cb, withBook, hop, p0, q0: tmpObj.quaternion.clone(), dir, top,
      ctrlOut: top.clone().lerp(p0, 0.45).addScaledVector(lift, 2.4 * bagScale),
      ctrlBack: p0.clone().lerp(top, 0.55).addScaledVector(lift, 2.0 * bagScale),
    };
    controls.enabled = false;
  }
  function restBag() {
    prop.visible = false;
    iris.scale.setScalar(0.001);
    bag.setFlap(0);
    bag.body.scale.setScalar(1);
    bag.body.rotation.z = 0;
  }
  function finishShot() {
    if (!shot) return;
    const { cb, withBook, zoomed } = shot;
    shot = null;
    restBag();
    if (withBook) {
      setOpen(1);
      bookOpen = true;
      toReading();
      revealMarkers();
      if (!zoomed) cb.onZoom?.();
    } else deskOrbit(true); // 合上册子时点的相机包：拍完回到环顾书桌
    cb.onDone?.();
  }
  function stepShot(now) {
    const S = shot, T = SHOT, t = (now - S.start) / 1000;
    const span = (r) => clamp01((t - r[0]) / (r[1] - r[0]));
    // 包：先鼓一下、左右晃两下，像里面有东西要出来
    const w = span(T.wiggle), live = w > 0 && w < 1;
    const bump = live ? Math.sin(w * Math.PI) : 0;
    bag.body.scale.set(1 + bump * 0.03, 1 - bump * 0.05, 1 + bump * 0.03);
    bag.body.rotation.z = live ? Math.sin(w * Math.PI * 4) * 0.03 * (1 - w) : 0;
    // 翻盖：弹开（稍微过头一点再回来）；相机落回去以后合上，最后轻轻一颠
    const fc = span(T.flapClose);
    let flap;
    if (fc > 0) flap = fc < 0.7 ? 1 - (fc / 0.7) ** 2 : Math.sin(((fc - 0.7) / 0.3) * Math.PI) * 0.05;
    else flap = easeOutBack(span(T.flapOpen));
    bag.setFlap(flap);
    // 相机
    const s = bagScale;
    if (t < T.pop[0] || t >= T.sink[1]) prop.visible = false;
    else {
      prop.visible = true;
      if (t < T.toEye[0]) {
        // 一下子冲出包口，冲过头一点再回落站稳（阻尼弹簧）
        const k = span(T.pop);
        bagPoint(CAM_TOP_Y + (CAM_IN_Y - CAM_TOP_Y) * Math.exp(-5.2 * k) * Math.cos(k * 9.5), prop.position);
        prop.quaternion.copy(bag.group.quaternion);
        prop.rotateZ(Math.exp(-3.5 * k) * Math.sin(k * 16) * 0.07);
        prop.scale.setScalar(s);
      } else if (t < T.back[0]) {
        // 举到眼前：沿一条弧线飞过来，同时转正、放大到原大
        const k = easeInOut(span(T.toEye));
        bezier(prop.position, S.top, S.ctrlOut, S.p0, k);
        prop.quaternion.slerpQuaternions(bag.group.quaternion, S.q0, k);
        prop.rotateZ(Math.sin(k * Math.PI) * 0.16);
        prop.scale.setScalar(s + (1 - s) * k);
        // 按下快门：机身轻轻一沉；闪光；一点后坐
        if (t > T.press && t < T.press + 0.2) prop.scale.multiplyScalar(0.985);
        if (t >= T.flash && !S.flashed) { S.flashed = true; S.cb.onFlash?.(); }
        const kick = t > T.flash ? Math.exp(-(t - T.flash) * 9) * Math.sin((t - T.flash) * 40) * 0.08 : 0;
        prop.position.addScaledVector(S.dir, -kick);
      } else if (t < T.sink[0]) {
        // 飞回包口上方
        const k = easeInOut(span(T.back));
        bezier(prop.position, S.p0, S.ctrlBack, S.top, k);
        prop.quaternion.slerpQuaternions(S.q0, bag.group.quaternion, k);
        prop.rotateZ(-Math.sin(k * Math.PI) * 0.12);
        prop.scale.setScalar(1 + (s - 1) * k);
      } else {
        // 落回包里
        const k = span(T.sink);
        bagPoint(CAM_TOP_Y + (CAM_IN_Y - CAM_TOP_Y) * k * k, prop.position);
        prop.quaternion.copy(bag.group.quaternion);
        prop.scale.setScalar(s);
      }
    }
    // 镜头里的光圈一眨
    const blink = (t - T.flash) / 0.16;
    iris.scale.setScalar(blink > 0 && blink < 1 ? Math.max(0.001, Math.sin(blink * Math.PI)) : 0.001);

    // 窄屏：包从册子上一跳，跳到画面外，给翻开的册子让地方
    if (S.hop) {
      const h = span(S.hop.t);
      if (h > 0) {
        bag.group.position.x = S.hop.x0 + (S.hop.toX - S.hop.x0) * h ** 1.5;
        bag.group.position.y = S.hop.y0 * (1 - h) + Math.sin(h * Math.PI) * 1.3 * bagScale;
        bag.group.rotation.z = -Math.sin(h * Math.PI) * 0.18;
      }
    }
    if (S.withBook) {
      const d = S.hop ? 1.15 : 0; // 包要先跳开，册子晚一点翻
      // 翻开书
      const open = span([BOOK.open[0] + d, BOOK.open[1] + d]);
      if (open > 0 && !S.opened) { S.opened = true; S.cb.onOpen?.(); }
      setOpen(easeInOut(open));
      // 镜头从桌面视角推近到俯看地图
      const dk = span([BOOK.dolly[0] + d, BOOK.dolly[1] + d]);
      if (dk > 0 && !S.zoomed) { S.zoomed = true; S.cb.onZoom?.(); }
      applyView(easeInOut(dk));
      if (t >= BOOK.end + d) finishShot();
    } else if (t >= T.end) finishShot();
  }
  function startIntro(cb = {}) {
    viewMode = 'desk';
    applyView(0);
    placeBag({ allowBook: true });
    beginShot(cb, true, reduced ? 0 : 450); // 先等画面淡入，再开始动
  }

  /* ---------- 合上 / 翻开册子 ---------- */
  const SEQ = {
    close: { fold: [0.15, 1.5], back: [0, 0.9], dolly: [1.6, 3.2], end: 3.25 },
    open: { unfold: [0, 1.4], dolly: [1.5, 3.1], end: 3.15 },
  };
  function closeBook(cb = {}) {
    if (shot || seq || !bookOpen) return false;
    selected = null; highlight();
    transition = false;
    placing = false; ghost.visible = false;
    showMarkers(false);
    viewMode = 'seq';
    controls.enabled = false;
    seq = { kind: 'close', start: performance.now(), cb, fromPos: camera.position.clone(), fromTarget: controls.target.clone(), fromFov: camera.fov };
    cb.onFold?.();
    return true;
  }
  function openBook(cb = {}) {
    if (shot || seq || bookOpen) return false;
    viewMode = 'seq';
    deskOrbit(false);
    // 记下环顾时转到的位置，翻开时先平滑地转回正面
    seq = { kind: 'open', start: performance.now(), cb, fromPos: camera.position.clone(), fromTarget: controls.target.clone() };
    cb.onUnfold?.();
    return true;
  }
  function stepSeq(now) {
    const t = (now - seq.start) / 1000, S = seq, T = SEQ[S.kind];
    if (S.kind === 'close') {
      setOpen(1 - easeInOut(clamp01((t - T.fold[0]) / (T.fold[1] - T.fold[0]))));
      if (t < T.dolly[0]) {
        // 先回到正上方的阅读视角（看书时可能转动过镜头）
        const k = easeInOut(clamp01((t - T.back[0]) / (T.back[1] - T.back[0])));
        camera.clearViewOffset();
        camera.position.lerpVectors(S.fromPos, home, k);
        controls.target.lerpVectors(S.fromTarget, homeTarget, k);
        camera.fov = S.fromFov + (readingFov() - S.fromFov) * k;
        camera.lookAt(controls.target);
        camera.updateProjectionMatrix();
      } else {
        if (!S.unzoomed) { S.unzoomed = true; placeBag(); showDesk(true); S.cb.onUnzoom?.(); }
        applyView(1 - easeInOut(clamp01((t - T.dolly[0]) / (T.dolly[1] - T.dolly[0]))));
      }
      if (t >= T.end) { seq = null; bookOpen = false; viewMode = 'desk'; showPhotoRoom(true); applyView(0); deskOrbit(true); S.cb.onDone?.(); }
    } else {
      const uk = easeInOut(clamp01((t - T.unfold[0]) / (T.unfold[1] - T.unfold[0])));
      setOpen(uk);
      const dk = clamp01((t - T.dolly[0]) / (T.dolly[1] - T.dolly[0]));
      if (dk > 0 && !S.zoomed) { S.zoomed = true; showPhotoRoom(false); S.cb.onZoom?.(); }
      if (dk === 0) {
        const dv = deskView();
        camera.position.lerpVectors(S.fromPos, dv.pos, uk);
        controls.target.lerpVectors(S.fromTarget, dv.target, uk);
        camera.lookAt(controls.target);
      } else applyView(easeInOut(dk));
      if (t >= T.end) { seq = null; bookOpen = true; toReading(); revealMarkers(); S.cb.onDone?.(); }
    }
  }

  /* ---------- 初始状态 ---------- */
  showDesk(introWanted);
  if (introWanted) {
    // 开场前先停在桌面视角：册子合着，相机收在包里，等贴图和着色器都准备好再开始动
    setOpen(0);
    showMarkers(false);
    controls.enabled = false;
  }

  /* ---------- 尺寸 ---------- */
  const resize = () => {
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    if (viewMode === 'reading') { camera.fov = readingFov(); camera.updateProjectionMatrix(); }
    else if (!shot && !seq) {
      applyView(0);
      placeBag();
      if (controls.enabled) { controls.target.copy(closedCenter); controls.update(); }
    }
  };
  new ResizeObserver(resize).observe(el);
  resize();
  placeBag();

  /* ---------- 预热与淡入 ----------
     画布先是透明的（见 css/map.css）。开场前把所有东西都摆出来渲染一帧：贴图上传、着色器编译都在这时做完，
     这一帧用户看不见。之后画布淡入，相机才开始动，动画里就不会突然卡一下。 */
  let revealed = false;
  function reveal() {
    if (revealed) return;
    revealed = true;
    el.classList.add('live');
  }
  function warmTextures() {
    const seen = new Set();
    const upload = (t) => {
      if (!t?.isTexture || seen.has(t)) return;
      seen.add(t);
      try { renderer.initTexture(t); } catch { /* 个别贴图传不上去也不影响 */ }
    };
    scene.traverse((o) => {
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        for (const k of ['map', 'alphaMap', 'bumpMap', 'normalMap', 'roughnessMap', 'emissiveMap']) upload(m[k]);
        if (m.uniforms) for (const u of Object.values(m.uniforms)) upload(u.value);
      }
    });
  }
  async function prepare() {
    await Promise.all(texJobs);
    const parts = [prop, markers, clip, photoRoom, desk.group, ghost];
    const was = parts.map((o) => o.visible);
    const wasPos = prop.position.clone();
    for (const o of parts) o.visible = true;
    prop.position.copy(closedCenter).add(tmpV.set(0, 4, 0));
    bag.setFlap(1);
    try { await renderer.compileAsync?.(scene, camera); } catch { /* 老浏览器没有这个方法，跳过 */ }
    warmTextures();
    renderer.render(scene, camera);
    parts.forEach((o, i) => { o.visible = was[i]; });
    prop.position.copy(wasPos);
    bag.setFlap(0);
    renderer.render(scene, camera);
    reveal();
  }
  if (!introWanted) {
    Promise.all(texJobs).then(() => requestAnimationFrame(reveal));
    setTimeout(reveal, 5000); // 万一有图一直没读完，也别让画面一直空着
  }

  /* ---------- 动画 ---------- */
  desk.update(2.4); // 减少动态效果时，热气就停在这一帧
  let last = performance.now();
  const lo = new THREE.Vector3(-SW / 2 - 1, -1, -SD / 2 - 1), hi = new THREE.Vector3(SW / 2 + 1, 3, SD / 2 + 1);
  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min((now - last) / 1000, 0.05), t = now / 1000;
    last = now;
    for (const e of pins.values()) {
      const age = Math.min(1, (now - e.born) / 650);
      const s = reduced ? 1 : 1 + 2.4 * (age - 1) ** 3 + 1.4 * (age - 1) ** 2;
      e.group.scale.setScalar(Math.max(0.001, s));
      e.card.position.copy(e.anchor);
      e.card.lookAt(camera.position);
      if (!reduced) e.card.rotateZ(Math.sin(t * 1.2 + e.phase) * 0.04 + Math.sin(t * 0.41 + e.phase) * 0.02);
    }
    for (const b of births.values()) {
      if (!reduced) {
        b.lantern.rotation.z = Math.sin(t * 1.1 + b.phase) * 0.05;
        b.lantern.position.y = 1.08 + Math.sin(t * 0.9 + b.phase) * 0.02;
      }
      b.rings.forEach((ring, i) => {
        const k = reduced ? 0.4 : (t * 0.42 + i * 0.5) % 1;
        ring.scale.setScalar(1 + k * 1.8);
        ring.material.opacity = 0.65 * (1 - k);
      });
    }
    if (dotPoints.length && !reduced) {
      const head = (t * 11) % (dotPoints.length + 30);
      dotPoints.forEach((q, i) => {
        dummy.position.copy(q);
        dummy.scale.setScalar(1 + Math.max(0, 1 - Math.abs(i - head) / 5) * 0.6);
        dummy.updateMatrix();
        dots.setMatrixAt(i, dummy.matrix);
      });
      dots.instanceMatrix.needsUpdate = true;
    }
    if (desk.group.visible && !reduced) desk.update(t);
    if (placing && ghost.visible && !reduced) ghost.rotation.y += dt * 1.5;
    if (shot) stepShot(now);
    if (seq) stepSeq(now);
    if (transition) {
      const alpha = reduced ? 1 : 1 - Math.exp(-dt * 4);
      camera.position.lerp(targetPos, alpha);
      controls.target.lerp(targetLook, alpha);
      if (camera.position.distanceTo(targetPos) < 0.01) { transition = false; controls.enabled = true; }
    }
    if (viewMode === 'reading') {
      controls.target.clamp(lo, hi);
      controls.update();
    } else if (viewMode === 'desk' && !shot && !seq && controls.enabled) controls.update();
    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);
  renderer.domElement.addEventListener('webglcontextlost', (event) => { event.preventDefault(); onError('画面暂时中断，请刷新页面重新打开。'); });

  return {
    setPages(canvas) {
      const prev = pageMat.map;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      pageMat.map = tex;
      pageMat.needsUpdate = true;
      prev?.dispose();
    },
    syncPins,
    syncBirths,
    focus,
    reset,
    select(id) { selected = id; highlight(); },
    setPlacing(on) {
      placing = on;
      if (!on) { ghost.visible = false; ghostLocked = false; }
      renderer.domElement.style.cursor = on ? 'crosshair' : 'grab';
      highlight();
    },
    setGhost,
    /** 开场前调用：等贴图、编译着色器，然后画布淡入。 */
    prepare,
    reveal,
    startIntro,
    /** 合上册子时点相机包：再拍一张（不翻书）。 */
    snap(cb = {}) {
      if (shot || seq || bookOpen) return false;
      if (reduced) { cb.onFlash?.(); cb.onDone?.(); return true; }
      beginShot(cb, false);
      return true;
    },
    closeBook,
    openBook,
    get bookOpen() { return bookOpen; },
    get busy() { return Boolean(shot || seq); },
    skipIntro() { if (shot?.withBook) finishShot(); },
    get introPlaying() { return Boolean(shot?.withBook); },
  };
}
