'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Float, Html, RoundedBox } from '@react-three/drei';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

type Museum = { id: string; city: string; name: string; short: string; position: [number, number, number]; accent: string };

const museums: Museum[] = [
  { id: 'quito', city: 'Quito', name: 'Museo Nacional', short: 'Memoria, arte y territorio en el corazón de los Andes.', position: [-0.25, 0.25, -1.25], accent: '#ff7849' },
  { id: 'cuenca', city: 'Cuenca', name: 'Museo Pumapungo', short: 'Un recorrido por la diversidad cultural del Ecuador.', position: [-0.65, 0.25, 1.45], accent: '#f2b84b' },
  { id: 'guayaquil', city: 'Guayaquil', name: 'Museo Antropológico', short: 'Arqueología y arte moderno junto al río Guayas.', position: [-2.05, 0.25, 0.9], accent: '#72c6b2' },
];

const terrainCells: Array<[number, number, number]> = [
  [-1.7, -2.25, 0.3], [-0.7, -2.15, 0.45], [0.35, -1.95, 0.6], [-2.05, -1.25, 0.45], [-1.05, -1.15, 0.7], [0, -1.05, 0.95], [1.05, -0.9, 0.65],
  [-2.35, -0.2, 0.5], [-1.3, -0.1, 0.8], [-0.2, 0, 1.15], [0.85, 0.05, 0.8], [-2.1, 0.85, 0.55], [-1.05, 0.9, 0.85], [0, 1, 1.05], [0.95, 1.1, 0.7],
  [-1.55, 1.85, 0.45], [-0.5, 1.95, 0.7], [0.45, 2.15, 0.55], [-0.85, 2.75, 0.4], [0.1, 2.95, 0.35],
];

function CameraRig({ selected }: { selected: Museum | null }) {
  const { camera } = useThree();
  const lookAt = useRef(new THREE.Vector3(0, 0, 0));
  useFrame((_, delta) => {
    const destination = selected ? new THREE.Vector3(selected.position[0] + 4.2, 3.4, selected.position[2] + 5.2) : new THREE.Vector3(7.2, 9.2, 9.2);
    const focus = selected ? new THREE.Vector3(selected.position[0], 0.35, selected.position[2]) : new THREE.Vector3(-0.5, 0, 0.25);
    const ease = 1 - Math.exp(-delta * 2.35);
    camera.position.lerp(destination, ease);
    lookAt.current.lerp(focus, ease);
    camera.lookAt(lookAt.current);
  });
  return null;
}

function MuseumModel({ museum, active }: { museum: Museum; active: boolean }) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!group.current) return;
    const next = THREE.MathUtils.lerp(group.current.scale.x, active ? 1 : 0.18, 1 - Math.exp(-delta * 4));
    group.current.scale.setScalar(next);
  });
  return (
    <group ref={group} position={museum.position} scale={0.18}>
      <RoundedBox args={[2.2, 0.22, 1.65]} radius={0.08} position={[0, 0.16, 0]}><meshStandardMaterial color="#ded8ca" roughness={0.75} /></RoundedBox>
      <RoundedBox args={[1.75, 0.9, 1.25]} radius={0.08} position={[0, 0.68, 0]}><meshStandardMaterial color="#f0eadf" roughness={0.62} /></RoundedBox>
      <RoundedBox args={[0.7, 1.2, 0.48]} radius={0.05} position={[0, 0.92, 0.62]}><meshStandardMaterial color={museum.accent} roughness={0.5} /></RoundedBox>
      {[-0.58, 0, 0.58].map((x) => <mesh key={x} position={[x, 0.72, 0.637]}><boxGeometry args={[0.22, 0.38, 0.04]} /><meshStandardMaterial color="#202c38" metalness={0.15} roughness={0.25} /></mesh>)}
      <mesh position={[0, 1.28, 0]}><boxGeometry args={[1.2, 0.12, 0.85]} /><meshStandardMaterial color="#4d665e" roughness={0.75} /></mesh>
    </group>
  );
}

function Pin({ museum, selected, onSelect }: { museum: Museum; selected: boolean; onSelect: () => void }) {
  return (
    <Float speed={2.2} rotationIntensity={0} floatIntensity={selected ? 0.08 : 0.22}>
      <group position={[museum.position[0], 0.95, museum.position[2]]} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
        <mesh rotation={[Math.PI, 0, 0]} position={[0, 0.22, 0]}><coneGeometry args={[0.22, 0.55, 24]} /><meshStandardMaterial color={museum.accent} emissive={museum.accent} emissiveIntensity={selected ? 0.9 : 0.28} /></mesh>
        <mesh position={[0, 0.58, 0]}><sphereGeometry args={[0.26, 28, 28]} /><meshStandardMaterial color={museum.accent} emissive={museum.accent} emissiveIntensity={selected ? 1 : 0.35} /></mesh>
        <Html center position={[0, 1.05, 0]} distanceFactor={10} style={{ pointerEvents: 'none' }}><span className={`pin-label ${selected ? 'is-active' : ''}`}>{museum.city}</span></Html>
      </group>
    </Float>
  );
}

function Terrain({ selected, onSelect }: { selected: Museum | null; onSelect: (museum: Museum) => void }) {
  const cells = useMemo(() => terrainCells, []);
  return (
    <group rotation={[0, -0.08, 0]}>
      {cells.map(([x, z, height], index) => <RoundedBox key={`${x}-${z}`} args={[1.12, height, 1.12]} radius={0.16} position={[x, -height / 2, z]}><meshStandardMaterial color={index % 3 === 0 ? '#244f4a' : index % 2 === 0 ? '#31685e' : '#285b53'} roughness={0.92} /></RoundedBox>)}
      {museums.map((museum) => <group key={museum.id}><MuseumModel museum={museum} active={selected?.id === museum.id} /><Pin museum={museum} selected={selected?.id === museum.id} onSelect={() => onSelect(museum)} /></group>)}
      <ContactShadows position={[0, -0.7, 0]} opacity={0.42} scale={12} blur={2.4} far={5} />
    </group>
  );
}

export default function Home() {
  const [selected, setSelected] = useState<Museum | null>(null);
  return (
    <main className="experience-shell">
      <header className="topbar"><a className="brand" href="#" aria-label="Atlas Cultural, inicio"><span className="brand-mark">AC</span><span>Atlas Cultural</span></a><span className="prototype-badge">Prototipo interactivo</span><button className="about-button" onClick={() => setSelected(null)}>Vista país</button></header>
      <section className="intro" aria-labelledby="page-title"><p className="eyebrow">Ecuador · colección piloto</p><h1 id="page-title">Explora el país<br />a través de sus museos.</h1><p className="lede">Selecciona una ubicación para acercarte al territorio y descubrir su arquitectura en 3D.</p><div className="legend"><i /> Pulsa un pin para explorar</div><nav className="location-list" aria-label="Museos disponibles">{museums.map((museum, index) => <button key={museum.id} className={selected?.id === museum.id ? 'is-selected' : ''} onClick={() => setSelected(museum)}><span>0{index + 1}</span>{museum.city}</button>)}</nav></section>
      <section className="scene" aria-label="Mapa tridimensional interactivo de Ecuador"><Canvas dpr={[1, 1.8]} gl={{ antialias: true }} camera={{ position: [7.2, 9.2, 9.2], fov: 38 }}><color attach="background" args={['#e9e2d4']} /><fog attach="fog" args={['#e9e2d4', 14, 23]} /><ambientLight intensity={1.35} /><directionalLight position={[6, 10, 5]} intensity={2.2} color="#fff4da" /><directionalLight position={[-5, 4, -3]} intensity={0.8} color="#83b8ae" /><Terrain selected={selected} onSelect={setSelected} /><CameraRig selected={selected} /></Canvas></section>
      <aside className={`museum-card ${selected ? 'is-visible' : ''}`} aria-live="polite">{selected && <><button className="close-button" onClick={() => setSelected(null)} aria-label="Volver al mapa">×</button><p className="card-kicker">{selected.city} · Ecuador</p><h2>{selected.name}</h2><p>{selected.short}</p><div className="model-note"><span>01</span><div><strong>Modelo conceptual</strong><small>Geometría base · listo para GLB/GLTF</small></div></div><button className="visit-button">Entrar al museo <span>↗</span></button></>}</aside>
      <div className="progress" aria-hidden="true"><span /><span className={selected ? 'active' : ''} /></div><footer><span>03 ubicaciones</span><span>© Atlas Cultural 2026</span></footer>
    </main>
  );
}
