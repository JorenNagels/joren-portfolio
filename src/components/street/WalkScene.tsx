'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { actor, loadBody, type Move, pace } from './actor';
import type { Made } from './character';
import { paint } from './houses';
import { inkPass, toonMaterial } from './toon';
import type { View } from './WalkPreview';

// One person on a long cobbled street, the camera keeping pace beside them. The cobbles show at once
// whether a foot slides.

const FOV = 30;
const WALKS: Move[] = ['Walk_Loop', 'Walk_Formal_Loop'];

function Scene({ seed, move, view, slow, body }: { seed: number; move: Move; view: View; slow: boolean; body?: Made }) {
  const { gl, scene, camera } = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  const material = useMemo(toonMaterial, []);
  const speeds = useMemo(() => new Map(WALKS.map((m) => [m, pace(m, material)])), [material]);
  const a = useMemo(() => actor(seed, material, undefined, body), [seed, material, body]);
  useEffect(() => () => a.dispose(), [a]);
  const ground = useMemo(() => paint(new THREE.PlaneGeometry(2000, 8).rotateX(-Math.PI / 2).translate(990, 0, 0), '#cfc6b0', 0, 7), []);
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
  const at = useRef({ x: 0, v: 0, cam: new THREE.Vector3() });

  useEffect(() => {
    a.play(move, 0.4);
  }, [a, move]);
  useEffect(() => {
    if (sun.current) scene.add(sun.current.target);
  }, [scene]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05) * (slow ? 0.25 : 1);
    const walking = WALKS.includes(move);
    const want = walking ? speeds.get(move)! * a.size : 0;
    const s = at.current;
    s.v += THREE.MathUtils.clamp(want - s.v, -1.5 * dt, 1.5 * dt);
    s.x += s.v * dt;
    if (s.x > 900) s.x = 0;
    a.mesh.position.set(s.x, 0, 0);
    a.mesh.rotation.y = Math.PI / 2; // walking along +x
    a.update(dt);

    const hip = new THREE.Vector3(s.x, (view === 'face' ? 1.42 : 0.85) * a.size, 0);
    const off = { side: new THREE.Vector3(0, 0.25, 3.6), three: new THREE.Vector3(2.4, 0.45, 2.7), front: new THREE.Vector3(3.6, 0.25, 0.15), face: new THREE.Vector3(0.75, 0.05, 0.8) }[view];
    s.cam.copy(hip).add(off);
    cam.fov = FOV;
    cam.position.copy(s.cam);
    cam.lookAt(hip);
    cam.updateProjectionMatrix();
    if (sun.current) {
      sun.current.position.set(s.x - 4.5, 6.2, 6.5);
      sun.current.target.position.set(s.x, 0, 0);
    }

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
        intensity={2.3}
        color="#fff7e8"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
        shadow-camera-near={1}
        shadow-camera-far={20}
      />
      <primitive object={a.mesh} />
      <mesh geometry={ground} material={material} receiveShadow />
    </>
  );
}

export default function WalkScene(props: { seed: number; move: Move; view: View; slow: boolean }) {
  // the body from Blender, unless ?code=1 asks for the one built in code
  const [body, setBody] = useState<Made | undefined>();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(location.search).get('code')) return setReady(true);
    loadBody().then((b) => {
      setBody(b);
      setReady(true);
    });
  }, []);
  if (!ready) return null;
  return (
    <Canvas
      className="!absolute inset-0"
      dpr={typeof window !== 'undefined' && matchMedia('(pointer: coarse)').matches ? [1, 1.5] : 2}
      shadows={{ type: THREE.PCFShadowMap }}
      gl={{ antialias: false, alpha: true, toneMapping: THREE.NoToneMapping }}
      camera={{ fov: FOV, near: 0.1, far: 200, position: [0, 1, 4] }}
    >
      <Scene {...props} body={body} />
    </Canvas>
  );
}
