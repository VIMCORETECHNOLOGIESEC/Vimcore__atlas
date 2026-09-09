'use client';

import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { RoundedBox, useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { Museum } from './museum-catalog';

function useStone() {
  const source = useTexture('/textures/limestone-facade.webp');
  const stone = useMemo(() => { const texture = source.clone(); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(2, 2); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8; return texture; }, [source]);
  useEffect(() => () => stone.dispose(), [stone]);
  return stone;
}

function ArchedWindow({ x, y, z, stone }: { x: number; y: number; z: number; stone: THREE.Texture }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape(); shape.moveTo(-.09, -.14); shape.lineTo(.09, -.14); shape.lineTo(.09, .07); shape.absarc(0, .07, .09, 0, Math.PI); shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <group position={[x, y, z]}>
    <mesh geometry={geometry}><meshStandardMaterial color="#293d3c" metalness={.65} roughness={.22} envMapIntensity={1.2} /></mesh>
    <mesh position={[0, -.148, .014]}><boxGeometry args={[.24, .038, .09]} /><meshStandardMaterial map={stone} color="#d2c5a6" /></mesh>
    <mesh position={[0, -.02, .02]}><boxGeometry args={[.016, .24, .022]} /><meshStandardMaterial color="#b8a783" /></mesh>
    <mesh position={[0, .015, .02]}><boxGeometry args={[.18, .016, .022]} /><meshStandardMaterial color="#b8a783" /></mesh>
    <mesh position={[0, .076, .006]}><torusGeometry args={[.105, .021, 6, 18, Math.PI]} /><meshStandardMaterial map={stone} color="#e1d3b4" /></mesh>
  </group>;
}

function Palm({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return <group position={position} scale={scale}>
    <mesh position={[0, .29, 0]} castShadow><cylinderGeometry args={[.022, .033, .58, 8]} /><meshStandardMaterial color="#79644a" roughness={.95} /></mesh>
    {[0, 1, 2, 3, 4, 5].map((i) => <mesh key={i} position={[Math.cos(i * Math.PI / 3) * .085, .55, Math.sin(i * Math.PI / 3) * .085]} rotation={[.5, i * Math.PI / 3, .25]} scale={[.07, .025, .27]} castShadow><sphereGeometry args={[1, 8, 6]} /><meshStandardMaterial color="#65754a" roughness={1} /></mesh>)}
  </group>;
}

function Dome({ x, y, z, radius = .23 }: { x: number; y: number; z: number; radius?: number }) {
  return <group position={[x, y, z]}>
    <mesh position={[0, -.09, 0]} castShadow><cylinderGeometry args={[radius * .92, radius, .22, 24]} /><meshStandardMaterial color="#ccbea0" roughness={.78} /></mesh>
    <mesh castShadow><sphereGeometry args={[radius, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#547c79" metalness={.55} roughness={.46} /></mesh>
    {Array.from({ length: 8 }, (_, i) => <mesh key={i} rotation={[0, i * Math.PI / 4, Math.PI / 2]}><torusGeometry args={[radius + .002, .006, 4, 20, Math.PI / 2]} /><meshStandardMaterial color="#819489" metalness={.65} roughness={.5} /></mesh>)}
    <mesh position={[0, radius + .045, 0]}><cylinderGeometry args={[.012, .018, .10, 8]} /><meshStandardMaterial color="#c1a169" metalness={.65} /></mesh>
  </group>;
}

/** Detailed, reusable architectural study. Museum-specific GLBs override this when supplied. */
export function ArchitecturalStudy({ variant }: { variant: Museum['modelVariant'] }) {
  const stone = useStone();
  return <group>
    <RoundedBox args={[2.62, .09, 1.85]} radius={.035} position={[0, -.035, 0]} castShadow receiveShadow><meshStandardMaterial map={stone} color="#a4a58b" roughness={.95} /></RoundedBox>
    <mesh position={[0, .018, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.2, 1.24, 72]} /><meshStandardMaterial color="#c5a463" metalness={.6} roughness={.5} side={THREE.DoubleSide} /></mesh>
    {[0, 1, 2, 3, 4].map((i) => <mesh key={i} position={[0, .035 + i * .024, .83 - i * .07]} receiveShadow castShadow><boxGeometry args={[1.12 - i * .04, .026, .20]} /><meshStandardMaterial map={stone} color="#d5c9ad" roughness={.95} /></mesh>)}
    {variant === 'modern' ? <>
      <mesh position={[0, .56, -.08]} castShadow receiveShadow><boxGeometry args={[2.17, 1.02, 1.23]} /><meshStandardMaterial map={stone} color="#d2c9b4" roughness={.78} /></mesh>
      <mesh position={[.18, .56, .548]}><boxGeometry args={[1.67, .79, .018]} /><meshStandardMaterial color="#284745" metalness={.7} roughness={.15} envMapIntensity={1.7} /></mesh>
      <mesh position={[1.095, .56, -.04]}><boxGeometry args={[.018, .79, 1.12]} /><meshStandardMaterial color="#284745" metalness={.7} roughness={.15} envMapIntensity={1.7} /></mesh>
      {[-.62, -.35, -.08, .19, .46, .73, 1].map((x) => <mesh key={x} position={[x, .56, .57]} castShadow><boxGeometry args={[.03, .86, .06]} /><meshStandardMaterial color="#b49b6c" metalness={.55} roughness={.38} /></mesh>)}
      {[.25, .57, .90].map((y) => <mesh key={y} position={[.19, y, .568]}><boxGeometry args={[1.7, .025, .06]} /><meshStandardMaterial color="#bca576" metalness={.6} roughness={.4} /></mesh>)}
      <mesh position={[0, 1.105, -.025]} castShadow><boxGeometry args={[2.37, .10, 1.47]} /><meshStandardMaterial map={stone} color="#e3d8bf" roughness={.76} /></mesh>
      <mesh position={[-.86, .54, .62]} castShadow><boxGeometry args={[.35, 1.02, .23]} /><meshStandardMaterial map={stone} color="#bdac8c" roughness={.88} /></mesh>
      <mesh position={[0, .79, .595]}><boxGeometry args={[1.7, .018, .045]} /><meshStandardMaterial color="#edc68e" emissive="#ffbd69" emissiveIntensity={.9} /></mesh>
      <Palm position={[-1.06, .06, .61]} scale={1.1} /><Palm position={[1.08, .06, .64]} />
    </> : <>
      <mesh position={[0, .66, -.05]} castShadow receiveShadow><boxGeometry args={[2.04, 1.2, 1.04]} /><meshStandardMaterial map={stone} bumpMap={stone} bumpScale={.008} color="#ede0c0" roughness={.86} /></mesh>
      {[-.82, -.51, -.2, .2, .51, .82].map((x) => [.38, .9].map((y) => <ArchedWindow key={`${x}-${y}`} x={x} y={y} z={.483} stone={stone} />))}
      {[-1.04, -.66, -.32, .32, .66, 1.04].map((x) => <group key={x} position={[x, .66, .505]}>
        <mesh castShadow><boxGeometry args={[.067, 1.2, .065]} /><meshStandardMaterial map={stone} color="#dfd0b0" roughness={.9} /></mesh>
        {[.06, .62, 1.22].map((y) => <mesh key={y} position={[0, y - .66, .015]}><boxGeometry args={[.10, .05, .12]} /><meshStandardMaterial map={stone} color="#e8d7b4" /></mesh>)}
      </group>)}
      {[.12, .64, 1.27].map((y) => <mesh key={y} position={[0, y, -.035]} castShadow><boxGeometry args={[2.2, .065, 1.17]} /><meshStandardMaterial map={stone} color="#c9b897" roughness={.85} /></mesh>)}
      <mesh position={[0, .315, .514]}><boxGeometry args={[.29, .48, .04]} /><meshStandardMaterial color="#534331" roughness={.68} /></mesh>
      <mesh position={[0, 1.34, -.07]} rotation={[0, Math.PI / 4, 0]} castShadow><coneGeometry args={[1.28, .28, 4]} /><meshStandardMaterial color="#727c71" metalness={.2} roughness={.72} /></mesh>
      {variant === 'colonial' ? [-.82, .82].map((x) => <group key={x} position={[x, 0, -.05]}>
        <mesh position={[0, 1.43, 0]} castShadow><boxGeometry args={[.35, .44, .37]} /><meshStandardMaterial map={stone} color="#e1d4b6" roughness={.88} /></mesh>
        <ArchedWindow x={0} y={1.44} z={.19} stone={stone} />
        <Dome x={0} y={1.74} z={0} radius={.23} />
      </group>) : [-.6, 0, .6].map((x) => <Dome key={x} x={x} y={1.6} z={-.09} radius={x ? .23 : .31} />)}
      <Palm position={[-1.13, .06, -.56]} scale={.75} /><Palm position={[1.13, .06, -.56]} scale={.75} />
    </>}
    {[-1.15, 1.15].map((x) => <mesh key={x} position={[x, .10, -.12]} scale={[.08, .10, .28]} castShadow><icosahedronGeometry args={[1, 2]} /><meshStandardMaterial color="#516447" roughness={1} /></mesh>)}
  </group>;
}

function MuseumGLB({ model }: { model: NonNullable<Museum['model']> }) {
  const { scene } = useGLTF(model.url);
  const copy = useMemo(() => { const clone = scene.clone(true); clone.traverse((child) => { if (child instanceof THREE.Mesh) { child.castShadow = true; child.receiveShadow = true; } }); return clone; }, [scene]);
  return <primitive object={copy} scale={model.scale} rotation={[0, model.rotationY ?? 0, 0]} />;
}

class ModelBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function MuseumBuilding({ museum }: { museum: Museum }) {
  const fallback = <ArchitecturalStudy variant={museum.modelVariant} />;
  return museum.model ? <ModelBoundary key={museum.id} fallback={fallback}><Suspense fallback={fallback}><MuseumGLB model={museum.model} /></Suspense></ModelBoundary> : fallback;
}
