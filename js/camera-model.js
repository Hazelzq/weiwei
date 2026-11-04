// 立体相机：用 assets/camera.png 的轮廓挤出机身，正面贴原照片，
// 再装上真正的圆柱镜头（镜头前端贴照片里的镜片部分），这样从侧面看也有厚度。
import * as THREE from 'three';
import { CAMERA_IMG, BODY_OUTLINE, GRIP_OUTLINE } from './camera-shape.js';

function leatherTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const c = cv.getContext('2d');
  c.fillStyle = '#1c1c1f'; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    c.fillStyle = Math.random() > 0.5 ? '#ffffff0c' : '#00000038';
    c.beginPath(); c.arc(Math.random() * 256, Math.random() * 256, 0.8 + Math.random() * 1.8, 0, 7); c.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function ribTexture() {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 32;
  const c = cv.getContext('2d');
  c.fillStyle = '#18181a'; c.fillRect(0, 0, 512, 32);
  c.fillStyle = '#2c2c30';
  for (let x = 0; x < 512; x += 6) c.fillRect(x, 0, 2.5, 32);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(4, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * @param {{ width: number, photo: THREE.Texture, lensPhoto: THREE.Texture }} opts
 * @returns {{ group: THREE.Group, iris: THREE.Mesh, height: number, frontZ: number, meshes: THREE.Mesh[] }}
 */
export function buildCameraModel({ width = 3.8, photo, lensPhoto }) {
  const k = width / CAMERA_IMG.w;
  const height = CAMERA_IMG.h * k;
  const toV = ([px, py]) => new THREE.Vector2((px - CAMERA_IMG.w / 2) * k, (CAMERA_IMG.h / 2 - py) * k);
  const shape = (pts) => new THREE.Shape(pts.map(toV));
  const group = new THREE.Group();
  const meshes = [];
  const add = (geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    meshes.push(m);
    return m;
  };
  // 正面照片：按顶点位置换算贴图坐标，与照片像素一一对应
  const photoUV = (geo) => {
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / width + 0.5, pos.getY(i) / height + 0.5);
    uv.needsUpdate = true;
    return geo;
  };

  const leather = new THREE.MeshStandardMaterial({ map: leatherTexture(), roughness: 0.6, metalness: 0.1, envMapIntensity: 2 });
  const face = new THREE.MeshStandardMaterial({ map: photo, roughness: 0.5, metalness: 0.05, envMapIntensity: 1.5 });
  const BODY_D = 1.35, GRIP_D = 0.72, BEV = 0.07;

  // 机身
  const bodyGeo = new THREE.ExtrudeGeometry(shape(BODY_OUTLINE), {
    depth: BODY_D - BEV * 2, bevelEnabled: true, bevelSize: BEV, bevelThickness: BEV, bevelSegments: 3, curveSegments: 6,
  });
  bodyGeo.translate(0, 0, -(BODY_D - BEV * 2) / 2);
  add(bodyGeo, leather);
  add(photoUV(new THREE.ShapeGeometry(shape(BODY_OUTLINE))), face, 0, 0, BODY_D / 2 + 0.003);

  // 握把：向前凸出
  const gripGeo = new THREE.ExtrudeGeometry(shape(GRIP_OUTLINE), {
    depth: GRIP_D - 0.2, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.1, bevelSegments: 4, curveSegments: 6,
  });
  gripGeo.translate(0, 0, BODY_D / 2 - 0.05 + 0.1);
  add(gripGeo, leather);
  add(photoUV(new THREE.ShapeGeometry(shape(GRIP_OUTLINE))), face, 0, 0, BODY_D / 2 - 0.05 + GRIP_D + 0.003);

  // 背面屏幕
  const lcd = add(new THREE.PlaneGeometry(width * 0.52, height * 0.5),
    new THREE.MeshPhysicalMaterial({ color: '#0b0d12', roughness: 0.08, clearcoat: 1, envMapIntensity: 3 }), width * 0.08, -height * 0.08, -BODY_D / 2 - 0.004);
  lcd.rotation.y = Math.PI;

  // 镜头
  const L = CAMERA_IMG.lens, c = toV([L.x, L.y]), R = L.r * k;
  const metal = new THREE.MeshStandardMaterial({ color: '#2a2b2f', roughness: 0.3, metalness: 0.8, envMapIntensity: 3 });
  const gloss = new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.35, metalness: 0.2, envMapIntensity: 2.5 });
  const rubber = new THREE.MeshStandardMaterial({ map: ribTexture(), roughness: 0.85 });
  let z = BODY_D / 2;
  const ring = (r1, r2, len, mat) => {
    const m = add(new THREE.CylinderGeometry(r1, r2, len, 64), mat, c.x, c.y, z + len / 2);
    m.rotation.x = Math.PI / 2;
    z += len;
    return m;
  };
  ring(R * 1.03, R * 1.03, 0.14, metal);
  ring(R * 0.97, R * 0.99, 0.5, gloss);
  ring(R * 1.0, R * 1.0, 0.82, rubber);
  ring(R * 0.97, R * 0.98, 0.56, gloss);
  ring(R * 1.0, R * 1.0, 0.06, metal);
  const cap = add(new THREE.CircleGeometry(R, 72), new THREE.MeshStandardMaterial({ map: lensPhoto, roughness: 0.15, metalness: 0.1, envMapIntensity: 2 }), c.x, c.y, z + 0.002);
  cap.castShadow = false;
  // 镜片的一点反光
  const glint = new THREE.Mesh(new THREE.SphereGeometry(R * 0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.32),
    new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.12, roughness: 0.02, clearcoat: 1, envMapIntensity: 4, depthWrite: false }));
  glint.rotation.x = Math.PI / 2;
  glint.position.set(c.x, c.y, z - R * 0.42);
  group.add(glint);
  const iris = new THREE.Mesh(new THREE.CircleGeometry(R * 0.45, 6), new THREE.MeshBasicMaterial({ color: '#050506', toneMapped: false }));
  iris.position.set(c.x, c.y, z + 0.008);
  iris.scale.setScalar(0.001);
  group.add(iris);

  return { group, iris, height, frontZ: z, meshes };
}
