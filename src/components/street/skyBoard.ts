import * as THREE from 'three';

/*
 * Words hanging in the sky over the river: the name at the start, the thanks at the end. They are things in the
 * street like the clouds and the towers, not captions on top of the picture: a camera shot frames each one where
 * the page's text used to be, and when the camera moves on they slide out of the picture on their own.
 *
 * The colour pass draws a board with the rest of the town, so towers and clouds can pass in front of it. The
 * normals pass would draw the whole rectangle (one material for everything there), so the scene hides the boards
 * for that pass and draws them on their own with `cutout`, which only keeps the letters: the ink lines then go
 * round the letters, like everything else in the street, and not round the board they are painted on.
 */

export type Line = {
  text: string;
  size: number; // in texture pixels
  weight: number;
  tracking?: number; // em
  lead?: number; // line height, em
  gap?: number; // space above, in texture pixels
  color?: string;
  pill?: string; // painted on a rounded label of this colour
};

/** Where a shot puts a board: how far up the screen its middle sits (-1..1), how wide it is (share of the screen), how far away (m). */
export type Framing = { y: number; w: number; distance: number };

export type SkyBoard = ReturnType<typeof skyBoard>;

export function skyBoard() {
  const paint = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false, fog: false, visible: false });
  const cutout = new THREE.ShaderMaterial({
    uniforms: { map: { value: null as THREE.Texture | null } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vNormal;
      void main() { vUv = uv; vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D map; varying vec2 vUv; varying vec3 vNormal;
      void main() { if (texture2D(map, vUv).a < 0.5) discard; gl_FragColor = vec4(normalize(vNormal) * 0.5 + 0.5, 1.0); }
    `,
  });
  const mesh = new THREE.Mesh<THREE.PlaneGeometry, THREE.Material>(new THREE.PlaneGeometry(1, 1), paint);
  mesh.renderOrder = 1;
  // ratio: width over height of what is painted; y: the height it hangs at, before any lift; placed: for what
  // screen; on: whether it is out at all
  return { mesh, paint, cutout, ratio: 4, y: 0, placed: '', on: true };
}

/** Paint lines of text onto the board, centred, top to bottom. */
export function paintBoard(b: SkyBoard, lines: Line[], color: string, font: string, anisotropy: number) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  const set = (l: Line) => {
    ctx.font = `${l.weight} ${l.size}px ${font}`;
    ctx.letterSpacing = `${((l.tracking ?? 0) * l.size).toFixed(1)}px`;
  };
  const rows = lines.map((l) => {
    set(l);
    const tw = ctx.measureText(l.text).width;
    return { l, tw, w: l.pill ? tw + l.size * 1.7 : tw, h: l.pill ? l.size * 2.1 : l.size * (l.lead ?? 1.2) };
  });
  const pad = Math.round(Math.max(...lines.map((l) => l.size)) * 0.1);
  c.width = Math.ceil(Math.max(...rows.map((r) => r.w)) + pad * 2);
  c.height = Math.ceil(rows.reduce((a, r) => a + (r.l.gap ?? 0) + r.h, 0) + pad * 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let y = pad;
  for (const { l, w, h } of rows) {
    y += l.gap ?? 0;
    const mid = y + h / 2;
    if (l.pill) {
      ctx.fillStyle = l.pill;
      ctx.beginPath();
      ctx.roundRect(c.width / 2 - w / 2, mid - l.size * 1.0, w, l.size * 2.0, l.size);
      ctx.fill();
    }
    set(l);
    ctx.fillStyle = l.color ?? color;
    // 'middle' centres the em box; nudge down a little so the letters themselves look centred
    ctx.fillText(l.text, c.width / 2, mid + l.size * 0.04);
    y += h;
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  b.paint.map?.dispose();
  b.paint.map = tex;
  b.paint.visible = true;
  b.paint.needsUpdate = true;
  b.cutout.uniforms.map.value = tex;
  b.ratio = c.width / c.height;
  b.placed = '';
}

/** Two lines of about the same length, for a narrow screen. */
export function split2(text: string) {
  const w = text.split(' ');
  let best = [text];
  let score = Infinity;
  for (let i = 1; i < w.length; i++) {
    const a = w.slice(0, i).join(' ');
    const z = w.slice(i).join(' ');
    const s = Math.max(a.length, z.length);
    if (s < score) [best, score] = [[a, z], s];
  }
  return best;
}

const f = new THREE.Vector3();
const right = new THREE.Vector3();
const up = new THREE.Vector3();
const ray = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Hang the board where a shot (from `pos`, looking at `look`) sees it as `at` says. It stands upright and faces the
 * camera's side of the river, like a sign would; it does not turn to follow the camera.
 */
export function placeBoard(b: SkyBoard, pos: THREE.Vector3, look: THREE.Vector3, fov: number, aspect: number, at: Framing) {
  const tv = Math.tan(((fov / 2) * Math.PI) / 180);
  f.copy(look).sub(pos).normalize();
  right.crossVectors(f, UP).normalize();
  up.crossVectors(right, f);
  ray.copy(f).addScaledVector(up, at.y * tv).normalize();
  const depth = at.distance * ray.dot(f);
  const w = at.w * 2 * depth * tv * aspect;
  b.mesh.position.copy(pos).addScaledVector(ray, at.distance);
  b.mesh.scale.set(w, w / b.ratio, 1);
  b.mesh.lookAt(pos.x, b.mesh.position.y, pos.z);
  b.y = b.mesh.position.y;
}
