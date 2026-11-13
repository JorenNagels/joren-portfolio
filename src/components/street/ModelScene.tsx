'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { dais } from './character';
import { loadBody } from './actor';
import type { Made } from './character';
import { Crew } from './Crew';
import { kayak, standing, tourBoat } from './folk';
import { inkPass, toonMaterial } from './toon';

// A line-up of the people from the street (the same seeds as the walkers), under the street's daylight and
// drawn with the same passes: colour, normals and depth, then the ink lines.

const COUNT = 12;
const GAP = 0.78;
const FOV = 22;

function Scene({ close }: { close: boolean }) {
  const { gl, scene, camera, size } = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  const material = useMemo(toonMaterial, []);
  // ?v=boats: a tour boat and a kayak with their crews, moving, to check the animation
  const boats = useMemo(() => (new URLSearchParams(location.search).get('v') === 'boats' ? [tourBoat(3, { len: 9, hull: '#c45a3d', trim: '#f4f1e6' }), kayak(5, '#e6c15a')] : null), []);
  const [body, setBody] = useState<Made>();
  useEffect(() => void (boats && loadBody().then(setBody)), [boats]);
  const bodies = useMemo(() => (boats ? [] : Array.from({ length: COUNT }, (_, i) => standing(i + 1))), [boats]);
  const stand = useMemo(dais, []);
  const ink = useMemo(inkPass, []);
  const normals = useMemo(() => new THREE.MeshNormalMaterial(), []);
  const targets = useMemo(() => {
    const color = new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType });
    const normal = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    normal.depthTexture = new THREE.DepthTexture(1, 1);
    return { color, normal };
  }, []);
  const sun = useRef<THREE.DirectionalLight>(null);
  const buf = useMemo(() => new THREE.Vector2(), []);
  const portrait = size.height > size.width;
  const cols = portrait ? 3 : 6;
  const rows = Math.max(1, bodies.length / cols);
  const spots: [number, number][] = bodies.map((_, i) => [((i % cols) - (cols - 1) / 2) * GAP, -Math.floor(i / cols) * 2.0]);

  useEffect(() => {
    if (sun.current) scene.add(sun.current.target);
  }, [scene]);

  useFrame(() => {
    const aspect = size.width / size.height;
    const c = boats ? new THREE.Vector3(0, 1.2, 0) : close ? new THREE.Vector3(spots[1][0], 1.45, 0) : new THREE.Vector3(0, 0.86 - (rows - 1), 0);
    const w = boats ? 10 : close ? 3 * GAP : cols * GAP + 0.3;
    const h = boats ? 3.2 : close ? 0.55 : rows * 2.0 + 0.1;
    const d = Math.max(h, w / aspect) / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    cam.fov = FOV;
    cam.near = Math.max(0.1, d - 4);
    cam.far = d + 6;
    cam.position.set(c.x, c.y + d * 0.06, d);
    cam.lookAt(c);
    cam.updateProjectionMatrix();

    gl.getDrawingBufferSize(buf);
    if (targets.color.width !== buf.x || targets.color.height !== buf.y) {
      targets.color.setSize(buf.x, buf.y);
      targets.normal.setSize(buf.x, buf.y);
    }
    gl.setClearColor(0x000000, 0);
    gl.setRenderTarget(targets.color);
    gl.clear();
    gl.render(scene, cam);
    scene.overrideMaterial = normals;
    gl.setRenderTarget(targets.normal);
    gl.clear();
    gl.render(scene, cam);
    scene.overrideMaterial = null;
    gl.setRenderTarget(null);
    const u = ink.mat.uniforms;
    u.tColor.value = targets.color.texture;
    u.tNormal.value = targets.normal.texture;
    u.tDepth.value = targets.normal.depthTexture;
    u.uRes.value.copy(buf);
    u.uNear.value = cam.near;
    u.uFar.value = cam.far;
    u.uThick.value = Math.max(1, gl.getPixelRatio() * 0.9);
    gl.clear();
    gl.render(ink.scene, ink.camera);
  }, 1);

  return (
    <>
      <hemisphereLight args={['#b9e4de', '#d6c4a0', 1.15]} />
      <directionalLight
        ref={sun}
        position={[-4.5, 6.2, 6.5]}
        intensity={2.3}
        color="#fff7e8"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-camera-near={1}
        shadow-camera-far={24}
      />
      {boats?.map((b, i) => (
        <group key={i} position={i ? [-1, 0.1, 2.2] : [0, 0, -1]} rotation-y={i ? -0.5 : 0.35}>
          <mesh geometry={b.g} material={material} castShadow receiveShadow />
          {body && <Crew crew={b.crew} material={material} body={body} />}
        </group>
      ))}
      {spots.map(([x, y], i) => (
        <group key={i} position={[x, y, 0]}>
          <mesh geometry={bodies[i]} material={material} rotation-y={-0.3} castShadow receiveShadow />
          <mesh geometry={stand} material={material} receiveShadow />
        </group>
      ))}
    </>
  );
}

export default function ModelScene({ close }: { close: boolean }) {
  return (
    <Canvas
      className="!absolute inset-0"
      dpr={typeof window !== 'undefined' && matchMedia('(pointer: coarse)').matches ? [1, 1.5] : 2}
      shadows={{ type: THREE.PCFShadowMap }}
      gl={{ antialias: false, alpha: true, toneMapping: THREE.NoToneMapping }}
      camera={{ fov: FOV, near: 0.1, far: 30, position: [0, 1, 10] }}
    >
      <Scene close={close} />
    </Canvas>
  );
}
