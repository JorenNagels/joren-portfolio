import * as THREE from 'three';

// The look: flat colours in two tones, a cool shadow, and wobbly ink lines drawn on top in screen space.

export const uniforms = {
  uNight: { value: 0 },
  uTime: { value: 0 },
};

function gradient() {
  // Two light levels: lit and shadow, nothing in between.
  const data = new Uint8Array([120, 120, 120, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(data, 2, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}
const ramp = gradient();

// Hand-drawn surface detail, in world space, picked by the surface's class (aMat) and which way it faces.
// Every pattern fades out before it gets finer than a pixel, so nothing shimmers in the distance.
const DETAIL = /* glsl */ `
  float dHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float dNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(dHash(i), dHash(i + vec2(1, 0)), u.x), mix(dHash(i + vec2(0, 1)), dHash(i + vec2(1, 1)), u.x), u.y);
  }
  // 1 on the joints of a staggered grid of size-sized cells, with a slight hand wobble
  float joints(vec2 p, vec2 size, float stagger) {
    p += (vec2(dNoise(p * 1.7), dNoise(p * 1.7 + 9.1)) - 0.5) * 0.05;
    vec2 q = p / size;
    q.x += stagger * mod(floor(q.y), 2.0);
    vec2 f = abs(fract(q) - 0.5);
    vec2 w = fwidth(q) * 1.1;
    vec2 m = smoothstep(vec2(0.48) - w, vec2(0.48), f);
    float fade = 1.0 - smoothstep(0.12, 0.3, max(w.x, w.y));
    return max(m.x, m.y) * fade;
  }
  // a random shade per cell of the same grid, gone before the cells get as small as a pixel
  float cellTint(vec2 p, vec2 size, float stagger) {
    vec2 q = p / size;
    q.x += stagger * mod(floor(q.y), 2.0);
    vec2 w = fwidth(p / size);
    return (dHash(floor(q)) - 0.5) * (1.0 - smoothstep(0.08, 0.25, max(w.x, w.y)));
  }
  vec3 detail(vec3 col, vec3 wp, vec3 n, float mat) {
    if (mat < 0.5) return col;
    vec3 an = abs(n);
    bool floorish = an.y > 0.75;
    vec2 uv = floorish ? wp.xz : (an.x > an.z ? vec2(wp.z, wp.y) : vec2(wp.x, wp.y));
    float ink = 0.0;   // darkening by lines
    float tint = 0.0;  // per-cell colour variation
    if (floorish && (mat < 2.5 || mat > 6.5)) {
      // cobbles
      ink = joints(uv, vec2(0.6, 0.45), 0.5) * 0.55;
      tint = cellTint(uv, vec2(0.6, 0.45), 0.5) * 0.08;
    } else if (mat > 6.5) {
      // dressed stone: quay walls, the bridge, the towers
      ink = joints(uv, vec2(1.3, 0.62), 0.5) * 0.6;
      tint = cellTint(uv, vec2(1.3, 0.62), 0.5) * 0.09;
    } else if (mat < 1.5) {
      // plaster: dirt along the bottom, and here and there the bricks show through
      float bare = smoothstep(0.62, 0.7, dNoise(uv * 0.32 + 4.0));
      ink = joints(uv, vec2(0.5, 0.2), 0.5) * bare * 0.6;
      tint = -0.1 * (1.0 - smoothstep(0.0, 1.4, wp.y)) - bare * 0.05;
    } else if (mat < 2.5) {
      // brick bond
      ink = joints(uv, vec2(0.48, 0.19), 0.5) * 0.5;
      tint = cellTint(uv, vec2(0.48, 0.19), 0.5) * 0.12;
    } else if (mat < 3.5) {
      // roof tiles: rows down the slope, staggered joints
      vec2 r = vec2(an.x > an.z ? wp.z : wp.x, wp.y);
      ink = joints(r, vec2(0.42, 0.28), 0.5) * 0.55;
      tint = cellTint(r, vec2(0.42, 0.28), 0.5) * 0.1;
    } else if (mat < 4.5) {
      // planks
      ink = joints(vec2(uv.x, uv.y * 0.02), vec2(0.18, 10.0), 0.0) * 0.5;
    } else if (mat < 5.5) {
      // leaves: short dark hatches
      float h = step(0.72, dNoise(wp.xy * 3.1 + wp.zx * 2.3));
      ink = h * 0.35 * (1.0 - smoothstep(0.15, 0.4, length(fwidth(wp.xy * 3.1))));
    } else {
      // ground: grass tufts and pebbles, sparse
      float t = step(0.9, dNoise(uv * 1.8)) * step(0.5, dHash(floor(uv * 6.0)));
      ink = t * 0.3 * (1.0 - smoothstep(0.1, 0.3, length(fwidth(uv * 6.0))));
      tint = (dNoise(uv * 0.15) - 0.5) * 0.12;
    }
    return col * (1.0 + tint) * (1.0 - ink * 0.42);
  }

  // Cloth and hair (aMat 8 and up). These are drawn in the piece's own coordinates, metres along its surface,
  // so the pattern moves with whoever wears it. Same rule as above: gone before it gets finer than a pixel.
  float fFade(vec2 q) { vec2 w = fwidth(q); return 1.0 - smoothstep(0.22, 0.5, max(w.x, w.y)); }
  float fBand(float q, float h) { float w = fwidth(q) * 0.75; return 1.0 - smoothstep(h - w, h + w, abs(fract(q) - 0.5)); }
  vec3 fabric(vec3 col, vec2 uv, float mat) {
    float dark = 0.0;
    float light = 0.0;
    if (mat < 8.5) {
      // knit: ribs
      float q = uv.x / 0.03;
      dark = fBand(q, 0.16) * 0.22 * fFade(vec2(q));
    } else if (mat < 9.5) {
      // checks: broad darker bands both ways, a thin light thread between them
      vec2 q = uv / 0.12;
      dark = (fBand(q.x, 0.2) + fBand(q.y, 0.2)) * 0.17 * fFade(q * 2.5);
      light = max(fBand(q.x + 0.5, 0.04), fBand(q.y + 0.5, 0.04)) * 0.4 * fFade(q * 8.0);
    } else if (mat < 10.5) {
      // denim: washed, lighter down the length of the leg
      dark = (dNoise(uv * vec2(20.0, 5.0)) - 0.4) * 0.26 * fFade(uv * 20.0);
    } else if (mat < 11.5) {
      // dots
      vec2 q = uv / 0.06;
      float f = fFade(q * 1.6);
      float w = max(fwidth(q.x), fwidth(q.y));
      q.x += 0.5 * mod(floor(q.y), 2.0);
      light = (1.0 - smoothstep(0.27 - w, 0.27 + w, length(fract(q) - 0.5))) * f * 0.9;
    } else if (mat < 12.5) {
      // hair: strands
      float q = uv.x / 0.022;
      dark = (dNoise(vec2(q, 0.5)) - 0.4) * 0.42 * fFade(vec2(q));
    } else if (mat < 13.5) {
      // herringbone
      vec2 q = uv / 0.06;
      dark = fBand(q.y * 2.0 + abs(fract(q.x) - 0.5) * 2.0, 0.2) * 0.22 * fFade(q * 3.0);
    } else if (mat < 14.5) {
      // corduroy
      float q = uv.x / 0.024;
      dark = fBand(q, 0.2) * 0.2 * fFade(vec2(q));
    } else if (mat > 15.5 && mat < 17.5) {
      // a face on the front of the head (16 smiles, 17 does not). uv runs once round the head and from chin to crown;
      // f is in metres from the middle of the face.
      vec2 f = vec2((uv.x - 0.25) * 1.1, (uv.y - 0.5) * 0.583);
      float ax = abs(f.x);
      float px = max(fwidth(f.x), fwidth(f.y));
      float thin = 1.0 - smoothstep(0.007, 0.016, px); // brows and mouth go before they turn into specks
      float blush = (1.0 - smoothstep(0.016, 0.042, length(vec2(ax - 0.1, f.y + 0.042)))) * 0.42;
      float nose = (1.0 - smoothstep(0.006, 0.016, length(vec2(f.x - 0.004, f.y + 0.028)))) * 0.16 * thin;
      float eye = 1.0 - smoothstep(1.0 - px / 0.02, 1.0 + px / 0.02, length(vec2(ax - 0.064, f.y - 0.012) / vec2(0.02, 0.029)));
      float shine = (1.0 - smoothstep(0.004, 0.007, length(vec2(ax - 0.058, f.y - 0.022)))) * thin;
      float brow = (1.0 - smoothstep(0.022, 0.03, abs(ax - 0.066))) * (1.0 - smoothstep(0.0055 - px, 0.0055 + px, abs(f.y - 0.062 + (ax - 0.066) * 0.3))) * thin;
      float curve = mat < 16.5 ? 9.0 * f.x * f.x : 0.0;
      float mouth = (1.0 - smoothstep(0.028, 0.036, ax)) * (1.0 - smoothstep(0.0055 - px, 0.0055 + px, abs(f.y + 0.086 - curve))) * thin;
      col = mix(col, vec3(0.76, 0.2, 0.14), blush);
      col *= 1.0 - nose;
      col = mix(col, vec3(0.24, 0.05, 0.04), mouth);
      col = mix(col, col * 0.3, brow);
      col = mix(col, vec3(0.02, 0.02, 0.03), eye);
      return mix(col, vec3(1.0), shine * eye);
    } else if (mat > 17.5) {
      // 18 to 21: the face of the figures, drawn on a thin copy of the front of the head. uv is in metres from
      // the point between the eyes. Flat shapes in the manner of Messenger: heavy lids, straight brows, a
      // shadow beside the nose and a short mouth. 19 and 21 smile, 20 and 21 wear glasses.
      float variant = mat - 18.0;
      float smile = step(0.5, mod(variant + 0.25, 2.0));
      float specs = step(1.5, variant);
      vec2 f = uv;
      float ax = abs(f.x);
      float px = max(fwidth(f.x), fwidth(f.y));
      float thin = 1.0 - smoothstep(0.0025, 0.007, px);
      vec2 e = vec2(ax - 0.041, f.y);
      float lidY = 0.0095 - 9.0 * e.x * e.x - 0.12 * max(e.x - 0.008, 0.0);
      float almond = length(e / vec2(0.0135, 0.0165));
      float eye = (1.0 - smoothstep(1.0 - px / 0.014, 1.0 + px / 0.014, almond)) * (1.0 - smoothstep(lidY - px, lidY + px, f.y));
      float lid = (1.0 - smoothstep(0.0028 - px, 0.0028 + px, abs(f.y - lidY))) * smoothstep(-0.018, -0.014, e.x) * (1.0 - smoothstep(0.02, 0.024, e.x));
      float bt = 0.0035 + 0.0025 * (1.0 - smoothstep(0.02, 0.064, ax));
      float brow = (1.0 - smoothstep(bt - px, bt + px, abs(f.y - 0.033 - 0.11 * (ax - 0.022)))) * smoothstep(0.016, 0.02, ax) * (1.0 - smoothstep(0.06, 0.066, ax)) * thin;
      float nose = (1.0 - smoothstep(0.6, 1.0, length((f - vec2(0.007, -0.04)) / vec2(0.006, 0.013)))) * 0.2;
      float mw = 0.016 + 0.004 * smile;
      float mouth = (1.0 - smoothstep(mw - 0.004, mw, ax)) * (1.0 - smoothstep(0.0022 - px, 0.0022 + px, abs(f.y + 0.071 - smile * 0.004 - (4.0 + 26.0 * smile) * f.x * f.x))) * thin;
      // glasses: two rounded frames and a bridge
      vec2 g = abs(vec2(ax - 0.042, f.y + 0.001)) - vec2(0.013, 0.008);
      float frame = length(max(g, 0.0)) + min(max(g.x, g.y), 0.0) - 0.008;
      float glasses = specs * thin * max(1.0 - smoothstep(0.0016 - px, 0.0016 + px, abs(frame)), (1.0 - smoothstep(0.019, 0.021, ax)) * (1.0 - smoothstep(0.0015 - px, 0.0015 + px, abs(f.y - 0.005))));
      float lip = (1.0 - smoothstep(0.5, 1.0, length((f - vec2(0.0, -0.079)) / vec2(0.01, 0.004)))) * 0.1;
      float blush = (1.0 - smoothstep(0.004, 0.02, length(vec2(ax - 0.058, f.y + 0.03)))) * 0.14;
      vec3 ink = vec3(0.012, 0.009, 0.011); // linear and before the light, so it has to be this dark to read as black
      col = mix(col, vec3(0.8, 0.32, 0.26), blush);
      col *= 1.0 - nose - lip;
      col = mix(col, vec3(0.16, 0.04, 0.035), mouth * 0.9);
      col = mix(col, ink, brow * 0.92);
      col = mix(col, ink, max(max(eye, lid * thin), glasses));
      return col;
    } else {
      // stripes; far away they blend to the colour in between
      float q = uv.y / 0.07;
      light = mix(0.5, fBand(q, 0.25), fFade(vec2(q) * 1.2)) * 0.92;
    }
    return mix(col * (1.0 - dark), vec3(0.9, 0.87, 0.78), light);
  }
`;

/** Vertex-coloured toon material; glass (aGlow > 0) lights up at night, some windows more than others. */
export function toonMaterial() {
  const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp });
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniforms);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aGlow;\nattribute float aMat;\nattribute vec2 aUv;\nvarying float vGlow;\nvarying float vMat;\nvarying vec2 vFab;\nvarying vec3 vWp;\nvarying vec3 vWn;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;\nvMat = aMat;\nvFab = aUv;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWn = normalize(mat3(modelMatrix) * objectNormal);');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uNight;\nvarying float vGlow;\nvarying float vMat;\nvarying vec2 vFab;\nvarying vec3 vWp;\nvarying vec3 vWn;\n${DETAIL}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = vMat > 7.5 ? fabric(diffuseColor.rgb, vFab, vMat) : detail(diffuseColor.rgb, vWp, normalize(vWn), vMat);')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         float lit = vGlow > 1.5 ? 1.0 : step(0.45, vGlow);
         vec3 warm = vGlow > 1.5 ? vec3(1.0, 0.85, 0.55) : mix(vec3(1.0, 0.6, 0.25), vec3(1.0, 0.82, 0.5), fract(vGlow * 7.0));
         // 3 = floodlit stone (the towers): keep the shading, add warm light at night
         if (vGlow > 2.5) totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.78, 0.55) * uNight * 0.75;
         else totalEmissiveRadiance += warm * lit * step(0.001, vGlow) * uNight * 1.4;`,
      );
  };
  return m;
}

/** The Leie: flat teal with drifting ripple lines and foam along the quay. Slightly see-through for reflections. */
export function waterMaterial(quay: number) {
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      ...uniforms,
      uDeep: { value: new THREE.Color('#2f7d7a') },
      uShallow: { value: new THREE.Color('#5cb8ad') },
      uLine: { value: new THREE.Color('#bfe8dc') },
      uQuay: { value: quay },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uNight; uniform float uQuay;
      uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uLine;
      varying vec3 vWorld;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      void main() {
        float d = vWorld.z - uQuay;
        vec3 col = mix(uShallow, uDeep, smoothstep(0.0, 18.0, d));
        // short horizontal ripple dashes, drifting with the current
        vec2 q = vec2(vWorld.x * 0.22 + uTime * 0.25, vWorld.z * 1.4);
        float n = noise(q) * noise(q * 0.5 + 3.0);
        float dash = smoothstep(0.28, 0.31, n) * (1.0 - smoothstep(0.31, 0.36, n));
        col = mix(col, uLine, dash * 0.8);
        // foam where the water meets the quay
        float foam = 1.0 - smoothstep(0.0, 0.5 + 0.35 * noise(vec2(vWorld.x * 0.8 + uTime * 0.6, 1.0)), d);
        col = mix(col, uLine, foam);
        col *= mix(1.0, 0.45, uNight);
        gl_FragColor = vec4(col, 0.8 + 0.2 * foam);
      }
    `,
  });
}

/** Upside-down copy of the street under the water, wobbling a little. */
export function reflectionMaterial(water: number) {
  // drawn a hair in front of whatever real stone sits in the same plane under the water
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniforms, { uWater: { value: water } });
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying float vY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.x += sin(position.y * 2.2 + uTime * 1.6) * 0.12;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvY = (modelMatrix * vec4(transformed, 1.0)).y;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uWater;\nvarying float vY;`)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vY > uWater - 0.02) discard;')
      .replace('#include <dithering_fragment>', 'gl_FragColor.rgb *= 0.78;\n#include <dithering_fragment>');
  };
  return m;
}

/* ---------------- The ink pass ---------------- */

export function inkPass() {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: null },
      tNormal: { value: null },
      tDepth: { value: null },
      uRes: { value: new THREE.Vector2(1, 1) },
      uNear: { value: 0.5 },
      uFar: { value: 600 },
      uThick: { value: 1 },
      uInk: { value: new THREE.Color('#25262f') },
      uHaze: { value: new THREE.Color('#e9e2cf') },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tColor; uniform sampler2D tNormal; uniform sampler2D tDepth;
      uniform vec2 uRes; uniform float uNear; uniform float uFar; uniform float uThick;
      uniform vec3 uInk; uniform vec3 uHaze;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float lin(float d) { float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
      vec3 nrm(vec2 uv) { return texture2D(tNormal, uv).xyz * 2.0 - 1.0; }
      // The words hanging in the sky tag themselves with a half in the alpha (skyBoard.ts). They carry a painted
      // line of their own, so this pass keeps its hands off them.
      float board(vec2 uv) { return 1.0 - step(0.1, abs(texture2D(tNormal, uv).a - 0.5)); }
      void main() {
        // The lines sit exactly on the geometry. Any wobble tied to the screen makes them slide when the view turns.
        vec2 p = vUv * uRes;
        vec2 uv = vUv;
        vec2 dx = vec2(uThick / uRes.x, 0.0), dy = vec2(0.0, uThick / uRes.y);

        float d0 = lin(texture2D(tDepth, uv).r);
        float d1 = lin(texture2D(tDepth, uv + dx).r), d2 = lin(texture2D(tDepth, uv - dx).r);
        float d3 = lin(texture2D(tDepth, uv + dy).r), d4 = lin(texture2D(tDepth, uv - dy).r);
        float dd = (abs(d1 - d0) + abs(d2 - d0) + abs(d3 - d0) + abs(d4 - d0)) / max(d0, 0.001);
        float edgeD = smoothstep(0.035, 0.08, dd);

        vec3 n0 = nrm(uv);
        float dn = length(nrm(uv + dx) - n0) + length(nrm(uv - dx) - n0) + length(nrm(uv + dy) - n0) + length(nrm(uv - dy) - n0);
        // creases and small details lose their line with distance, outlines keep theirs: far houses stay calm
        float edgeN = smoothstep(0.6, 1.1, dn) * (1.0 - smoothstep(60.0, 170.0, d0) * 0.9);
        // The hills on the horizon get no line at all. A faint line that thin breaks up into dashes.
        // Measured from the nearest of the samples, so both sides of an outline fade alike.
        float dNear = min(d0, min(min(d1, d2), min(d3, d4)));
        // ...and off the pixel beside them, which is as far as the comparisons above can reach.
        float onBoard = max(max(board(uv), max(board(uv + dx), board(uv - dx))), max(board(uv + dy), board(uv - dy)));
        float edge = max(edgeD, edgeN) * (1.0 - smoothstep(200.0, 400.0, dNear)) * (1.0 - onBoard);

        vec4 col = texture2D(tColor, vUv);
        // distant things fade into the sky a little
        col.rgb = mix(col.rgb, uHaze * col.a, smoothstep(70.0, 520.0, d0) * 0.6);
        col.rgb = mix(col.rgb, uInk, edge);
        // a little paper grain
        col.rgb *= 0.985 + 0.03 * hash(floor(p / 1.5));
        gl_FragColor = vec4(col.rgb, max(col.a, edge));
        #include <colorspace_fragment>
      }
    `,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  return { mat, scene, camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1) };
}
