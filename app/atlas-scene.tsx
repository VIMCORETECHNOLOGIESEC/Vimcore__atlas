'use client';

import { Line, RoundedBox, useTexture } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { BOOK_DEPTH, LEFT_PAGE_WIDTH, RIGHT_PAGE_WIDTH, createPageGeometry, createPageTexture, createInsularGeometry, geoToWorld, geography } from './atlas-cartography';

const ASSETS = ['/textures/atlas-parchment.webp?v=1', '/textures/atlas-leather.webp?v=1', '/textures/atlas-walnut.webp?v=1'];

function useAtlasMaterials() {
  const source = useTexture(ASSETS);
  return useMemo(() => {
    source.forEach((texture) => { texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8; });
    return { parchment: source[0], leather: source[1], wood: source[2] };
  }, [source]);
}

function Column({ x, z, height = .65 }: { x: number; z: number; height?: number }) {
  return <group position={[x, .2, z]}>
    <mesh position={[0, height / 2, 0]} castShadow><cylinderGeometry args={[.055, .067, height, 10]} /><meshStandardMaterial color="#e6d7b4" roughness={.85} /></mesh>
    {[0, height].map((y) => <mesh key={y} position={[0, y, 0]}><boxGeometry args={[.17, .085, .17]} /><meshStandardMaterial color="#d5c4a0" /></mesh>)}
  </group>;
}

function Dome({ x = 0, y, z = 0, radius, blue = true }: { x?: number; y: number; z?: number; radius: number; blue?: boolean }) {
  return <group position={[x, y, z]}>
    <mesh castShadow><sphereGeometry args={[radius, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={blue ? '#447e83' : '#b4a988'} roughness={.65} metalness={.18} /></mesh>
    <mesh position={[0, -.04, 0]}><cylinderGeometry args={[radius, radius, .10, 20]} /><meshStandardMaterial color="#dccca9" /></mesh>
    <mesh position={[0, radius + .055, 0]}><sphereGeometry args={[.04, 8, 8]} /><meshStandardMaterial color="#b4914c" metalness={.7} roughness={.35} /></mesh>
    <mesh position={[0, radius + .13, 0]}><cylinderGeometry args={[.012, .012, .12, 6]} /><meshStandardMaterial color="#99773a" /></mesh>
  </group>;
}

/** Architectural miniatures inspired by the reference, not measured museum replicas. */
export function Landmark({ variant }: { variant: string }) {
  return <group>
    <RoundedBox args={[1.9, .13, 1.4]} radius={.15} position={[0, .04, 0]} castShadow receiveShadow><meshStandardMaterial color="#686943" roughness={1} /></RoundedBox>
    {[0, 1, 2].map((i) => <mesh key={i} position={[0, .12 + i * .045, .61 - i * .085]} receiveShadow><boxGeometry args={[.84 - i * .035, .05, .26]} /><meshStandardMaterial color="#c8baa0" /></mesh>)}
    {variant === 'colonial' ? <>
      <mesh position={[0, .52, -.08]} castShadow><boxGeometry args={[1.28, .72, .82]} /><meshStandardMaterial color="#e3d4b9" roughness={.9} /></mesh>
      <mesh position={[0, 1.01, -.12]} rotation={[0, Math.PI / 4, 0]} castShadow><coneGeometry args={[.8, .4, 4]} /><meshStandardMaterial color="#89785f" roughness={.9} /></mesh>
      {[-.57, .57].map((x) => <group key={x} position={[x, 0, .28]}>
        <mesh position={[0, .9, 0]} castShadow><boxGeometry args={[.32, 1.45, .33]} /><meshStandardMaterial color="#e9d9bb" roughness={.85} /></mesh>
        <mesh position={[0, 1.37, .172]}><boxGeometry args={[.115, .28, .018]} /><meshStandardMaterial color="#584c3b" /></mesh>
        <mesh position={[0, 1.62, 0]}><boxGeometry args={[.38, .08, .39]} /><meshStandardMaterial color="#c7b897" /></mesh>
        <mesh position={[0, 1.91, 0]} castShadow><coneGeometry args={[.22, .56, 4]} /><meshStandardMaterial color="#9c9c89" metalness={.1} /></mesh>
        <mesh position={[0, 2.28, 0]}><boxGeometry args={[.024, .2, .025]} /><meshStandardMaterial color="#9b814c" /></mesh>
        <mesh position={[0, 2.30, 0]}><boxGeometry args={[.12, .024, .025]} /><meshStandardMaterial color="#9b814c" /></mesh>
      </group>)}
      <mesh position={[0, .36, .341]}><boxGeometry args={[.3, .43, .018]} /><meshStandardMaterial color="#544634" /></mesh>
      <mesh position={[0, .87, .35]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.135, .025, 8, 20]} /><meshStandardMaterial color="#af9871" /></mesh>
    </> : variant === 'archaeological' ? <>
      <mesh position={[0, .48, -.1]} castShadow><boxGeometry args={[1.5, .65, .83]} /><meshStandardMaterial color="#e2d1af" roughness={.9} /></mesh>
      {[-.51, 0, .51].map((x, i) => <group key={x}>
        <mesh position={[x, .82, -.09]} castShadow><cylinderGeometry args={[i === 1 ? .3 : .22, i === 1 ? .3 : .22, .4, 16]} /><meshStandardMaterial color="#d6c5a2" /></mesh>
        <Dome x={x} y={1.04} z={-.09} radius={i === 1 ? .35 : .27} />
        <mesh position={[x, .43, .327]}><boxGeometry args={[.17, .38, .018]} /><meshStandardMaterial color="#5a5742" /></mesh>
      </group>)}
      {[-.69, -.3, .3, .69].map((x) => <Column key={x} x={x} z={.4} height={.58} />)}
      <mesh position={[0, .85, .43]}><boxGeometry args={[1.65, .12, .22]} /><meshStandardMaterial color="#efdfbc" /></mesh>
    </> : <>
      <mesh position={[0, .45, -.12]} castShadow><cylinderGeometry args={[.64, .68, .57, 20]} /><meshStandardMaterial color="#e5d6b5" roughness={.85} /></mesh>
      {[-.61, -.30, .30, .61].map((x) => <Column key={x} x={x} z={.46} height={.62} />)}
      <mesh position={[0, .88, .36]} castShadow><boxGeometry args={[1.65, .15, .53]} /><meshStandardMaterial color="#d6c19a" /></mesh>
      <mesh position={[0, .91, -.16]}><cylinderGeometry args={[.4, .43, .30, 20]} /><meshStandardMaterial color="#ded1b2" /></mesh>
      <Dome y={1.08} z={-.16} radius={.43} blue={false} />
      <mesh position={[0, .41, .52]}><boxGeometry args={[.22, .45, .025]} /><meshStandardMaterial color="#524c3b" /></mesh>
    </>}
    {[-.79, .79].map((x, i) => <group key={x} position={[x, .22, -.4 + i * .18]}>
      <mesh position={[0, .15, 0]}><cylinderGeometry args={[.026, .04, .32, 6]} /><meshStandardMaterial color="#695033" /></mesh>
      <mesh position={[0, .37, 0]} castShadow scale={[.14, .25, .14]}><icosahedronGeometry args={[1, 2]} /><meshStandardMaterial color={i ? '#5e6736' : '#737440'} roughness={1} /></mesh>
    </group>)}
  </group>;
}

export function BookBase() {
  const { parchment, leather } = useAtlasMaterials();
  const resources = useMemo(() => ({
    left: createPageGeometry('left'), right: createPageGeometry('right'),
    leftTexture: createPageTexture('left', parchment), rightTexture: createPageTexture('right', parchment),
  }), [parchment]);
  useEffect(() => () => { Object.values(resources).forEach((resource) => resource.dispose()); }, [resources]);
  return <group>
    {([-1, 1] as const).map((side) => {
      const width = side === -1 ? LEFT_PAGE_WIDTH : RIGHT_PAGE_WIDTH;
      const center = side * (width / 2 + .13);
      return <group key={side}>
        <RoundedBox args={[width + .35, .24, BOOK_DEPTH + .43]} radius={.09} smoothness={4} position={[center, -.28, 0]} castShadow receiveShadow><meshStandardMaterial map={leather} bumpMap={leather} bumpScale={.055} roughness={.8} color="#b19785" /></RoundedBox>
        <RoundedBox args={[width + .02, .27, BOOK_DEPTH + .02]} radius={.055} position={[center, -.06, 0]} castShadow receiveShadow><meshStandardMaterial color="#bba079" map={parchment} roughness={1} /></RoundedBox>
        {Array.from({ length: 11 }, (_, i) => <Line key={i} points={[[side * .15, -.18 + i * .024, 4.13], [side * (width + .12), -.18 + i * .024, 4.13], [side * (width + .15), -.18 + i * .024, -4.12]]} lineWidth={.65} color={i % 3 ? '#8d7351' : '#dac298'} transparent opacity={.7} />)}
        <mesh geometry={side === -1 ? resources.left : resources.right} castShadow receiveShadow><meshStandardMaterial map={side === -1 ? resources.leftTexture : resources.rightTexture} bumpMap={parchment} bumpScale={.012} roughness={.96} side={THREE.DoubleSide} /></mesh>
        <Line points={[[side * .2, -.147, 4.29], [side * (width + .25), -.147, 4.29], [side * (width + .25), -.147, -4.29], [side * .2, -.147, -4.29]]} color="#9e7538" lineWidth={1.2} />
        {[-3.96, 3.96].map((z) => <mesh key={z} position={[side * (width + .09), -.139, z]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}><planeGeometry args={[.28, .28]} /><meshStandardMaterial color="#a47c39" metalness={.6} roughness={.52} /></mesh>)}
      </group>;
    })}
    <mesh position={[0, -.18, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[.26, .26, 8.6, 24]} /><meshStandardMaterial map={leather} bumpMap={leather} bumpScale={.04} color="#9e806b" roughness={.8} /></mesh>
    {[-3.5, -2, 0, 2, 3.5].map((z) => <mesh key={z} position={[0, -.18, z]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.265, .035, 8, 24]} /><meshStandardMaterial color="#866034" metalness={.35} roughness={.7} /></mesh>)}
    {['colonial', 'archaeological', 'modern'].map((variant, i) => <group key={variant} position={[-3.21, .2, -1.43 + i * .885]} scale={.28}><Landmark variant={variant} /></group>)}
  </group>;
}

export function GalapagosInset() {
  const geometries = useMemo(() => geography.galapagos.map((island) => createInsularGeometry(island.coordinates)), []);
  useEffect(() => () => geometries.forEach((geometry) => geometry.dispose()), [geometries]);
  return <group position={[-2.21, .2, 2.21]}>
    {geometries.map((geometry, index) => <mesh key={index} geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow><meshStandardMaterial color={index % 3 ? '#7f8a50' : '#9c9d5d'} roughness={1} /></mesh>)}
  </group>;
}

export function CoastalIslands() {
  const geometries = useMemo(() => geography.coastalIslands.map((coordinates) => {
    const shape = new THREE.Shape(coordinates.map(([lon, lat]) => { const [x, , z] = geoToWorld(lon, lat); return new THREE.Vector2(x, -z); }));
    return new THREE.ExtrudeGeometry(shape, { depth: .055, bevelEnabled: false });
  }), []);
  useEffect(() => () => geometries.forEach((geometry) => geometry.dispose()), [geometries]);
  return <group>{geometries.map((geometry, i) => <mesh key={i} geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow><meshStandardMaterial color="#9b9c60" roughness={1} /></mesh>)}</group>;
}

function ClosedBook({ position, rotation, color, width = 3.4 }: { position: [number, number, number]; rotation: number; color: string; width?: number }) {
  const { leather, parchment } = useAtlasMaterials();
  return <group position={position} rotation={[0, rotation, 0]}>
    {[-.19, .23].map((y) => <RoundedBox key={y} args={[width, .13, 4.4]} radius={.08} position={[0, y, 0]} castShadow receiveShadow><meshStandardMaterial map={leather} bumpMap={leather} bumpScale={.05} color={color} roughness={.82} /></RoundedBox>)}
    <mesh castShadow position={[.04, .02, 0]}><boxGeometry args={[width - .23, .34, 4.13]} /><meshStandardMaterial map={parchment} color="#b9a382" roughness={1} /></mesh>
    <mesh position={[-width / 2 + .045, .02, 0]} castShadow><boxGeometry args={[.16, .43, 4.35]} /><meshStandardMaterial map={leather} color={color} roughness={.8} /></mesh>
    {[-1.7, -1.45, 1.45, 1.7].map((z) => <mesh key={z} position={[-width / 2 - .04, .02, z]}><boxGeometry args={[.015, .38, .035]} /><meshStandardMaterial color="#b09250" metalness={.6} roughness={.5} /></mesh>)}
    <Line points={[[-width / 2 + .24, .3, -1.96], [width / 2 - .24, .3, -1.96], [width / 2 - .24, .3, 1.96], [-width / 2 + .24, .3, 1.96], [-width / 2 + .24, .3, -1.96]]} color="#8f723f" lineWidth={1.1} />
  </group>;
}

function FountainPen({ position, angle, color }: { position: [number, number, number]; angle: number; color: string }) {
  return <group position={position} rotation={[0, angle, Math.PI / 2]}>
    <mesh castShadow><cylinderGeometry args={[.09, .07, 2.75, 20]} /><meshStandardMaterial color={color} roughness={.32} metalness={.35} /></mesh>
    <mesh position={[0, 1.6, 0]} castShadow><coneGeometry args={[.083, .46, 4]} /><meshStandardMaterial color="#c4a464" metalness={.85} roughness={.27} /></mesh>
    {[-1.23, -.82, 1.22].map((y) => <mesh key={y} position={[0, y, 0]}><cylinderGeometry args={[.098, .098, .045, 20]} /><meshStandardMaterial color="#bc924b" metalness={.8} roughness={.35} /></mesh>)}
    <mesh position={[.092, -.97, 0]}><boxGeometry args={[.035, .58, .035]} /><meshStandardMaterial color="#b6914c" metalness={.8} /></mesh>
  </group>;
}

function DeskCompass() {
  const ticks = useMemo(() => Array.from({ length: 48 }, (_, i) => {
    const angle = i / 48 * Math.PI * 2;
    return [[Math.sin(angle) * .72, .19, Math.cos(angle) * .72], [Math.sin(angle) * (i % 4 ? .81 : .87), .19, Math.cos(angle) * (i % 4 ? .81 : .87)]] as [number, number, number][];
  }), []);
  return <group position={[-5.45, -.35, -2.35]}>
    <mesh castShadow><cylinderGeometry args={[1, 1.03, .24, 64]} /><meshStandardMaterial color="#9d7338" metalness={.8} roughness={.4} /></mesh>
    <mesh position={[0, .134, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[.89, 64]} /><meshStandardMaterial color="#bba16e" metalness={.35} roughness={.6} /></mesh>
    <mesh position={[0, .17, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[.94, .055, 12, 64]} /><meshStandardMaterial color="#c49e55" metalness={.85} roughness={.27} /></mesh>
    {ticks.map((points, i) => <Line key={i} points={points} color="#4e412b" lineWidth={1} />)}
    {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle, i) => <mesh key={angle} position={[Math.sin(angle) * .3, .195, Math.cos(angle) * .3]} rotation={[Math.PI / 2, 0, -angle]} scale={[1, 2.5, .1]}><coneGeometry args={[.12, .45, 3]} /><meshStandardMaterial color={i % 2 ? '#665536' : '#413a2c'} /></mesh>)}
    <mesh position={[0, .24, 0]}><sphereGeometry args={[.08, 12, 12]} /><meshStandardMaterial color="#aa8542" metalness={.85} /></mesh>
  </group>;
}

function SailingMiniature({ position, scale }: { position: [number, number, number]; scale: number }) {
  const sail = useMemo(() => {
    const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0, .9), new THREE.Vector2(.42, .05)]);
    return new THREE.ShapeGeometry(shape);
  }, []);
  useEffect(() => () => sail.dispose(), [sail]);
  return <group position={position} scale={scale} rotation={[0, -.2, 0]}>
    <mesh scale={[1, .24, .3]}><sphereGeometry args={[.68, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} /><meshStandardMaterial color="#746040" roughness={1} /></mesh>
    {[-.37, 0, .37].map((x, i) => <group key={x} position={[x, 0, 0]}>
      <mesh position={[0, .53, 0]}><cylinderGeometry args={[.012, .018, 1.18, 6]} /><meshStandardMaterial color="#79613e" /></mesh>
      <mesh geometry={sail} position={[.025, .2, 0]} scale={[i === 1 ? 1 : .8, i === 1 ? 1 : .8, 1]}><meshStandardMaterial color="#b8a079" roughness={1} side={THREE.DoubleSide} /></mesh>
      <Line points={[[0, 1.1, 0], [.6 - x, 0, 0], [-.6 - x, 0, 0], [0, 1.1, 0]]} color="#806947" lineWidth={.6} />
    </group>)}
  </group>;
}

export function AtlasMarginalia() {
  return <group>
    <SailingMiniature position={[.92, .22, 2.9]} scale={.48} />
    <SailingMiniature position={[1.16, .23, -.92]} scale={.34} />
  </group>;
}

export function AtlasDesk() {
  const { wood, parchment } = useAtlasMaterials();
  const deskTexture = useMemo(() => { const texture = wood.clone(); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(3, 3); return texture; }, [wood]);
  useEffect(() => () => deskTexture.dispose(), [deskTexture]);
  return <group>
    <mesh position={[0, -.64, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[80, 80]} /><meshStandardMaterial map={deskTexture} bumpMap={deskTexture} bumpScale={.045} roughness={.72} color="#937b68" /></mesh>
    <ClosedBook position={[-3.1, -.23, -5.5]} rotation={-.28} color="#667062" width={3.6} />
    <ClosedBook position={[5.8, -.22, -5.6]} rotation={.25} color="#8f6855" />
    <ClosedBook position={[6.05, .27, -5.9]} rotation={.08} color="#75624d" width={3.1} />
    <mesh rotation={[-Math.PI / 2, 0, -.37]} position={[7.4, -.61, 2.8]} receiveShadow><planeGeometry args={[3.6, 5]} /><meshStandardMaterial map={parchment} color="#b29a70" roughness={1} /></mesh>
    <FountainPen position={[6.7, -.1, 3.65]} angle={-.75} color="#38251c" />
    <FountainPen position={[7.05, -.1, 4.04]} angle={-.75} color="#64503a" />
    <DeskCompass />
    <group position={[7.55, -.36, -2.7]}>
      <mesh castShadow><cylinderGeometry args={[.32, .4, .5, 8]} /><meshStandardMaterial color="#23312c" metalness={.55} roughness={.3} /></mesh>
      <mesh position={[0, .3, 0]}><cylinderGeometry args={[.26, .29, .15, 24]} /><meshStandardMaterial color="#ab8544" metalness={.8} roughness={.35} /></mesh>
    </group>
    <group position={[7.3, .6, -4.85]} rotation={[.1, -.4, -.1]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} castShadow><torusGeometry args={[.75, .065, 12, 48]} /><meshStandardMaterial color="#b99656" metalness={.85} roughness={.28} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[.7, 48]} /><meshStandardMaterial color="#9cbbb4" metalness={.25} roughness={.13} transparent opacity={.14} depthWrite={false} /></mesh>
      <mesh position={[0, 0, 1.29]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[.09, .13, 1.1, 20]} /><meshStandardMaterial color="#463226" roughness={.48} /></mesh>
      <mesh position={[0, 0, .79]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.1, .1, .22, 20]} /><meshStandardMaterial color="#b18d48" metalness={.75} /></mesh>
    </group>
  </group>;
}
