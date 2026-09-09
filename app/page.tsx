'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Html, Line, OrbitControls, RoundedBox } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';

const MAP_WIDTH = 6.4;
const MAP_DEPTH = 8.4;
const RELIEF_SCALE = 1.38;

type Museum = {
  id: 'quito' | 'cuenca' | 'guayaquil';
  city: string;
  name: string;
  short: string;
  position: [number, number, number];
  accent: string;
  collection: string;
};

// Contorno continental aproximado. Es ilustrativo, no cartografía de medición.
const ECUADOR_LON_LAT: Array<[number, number]> = [
  [-78.84, 1.45], [-78.47, 1.39], [-78.25, 1.18], [-77.97, 1.03], [-77.70, 0.82],
  [-77.45, 0.71], [-77.24, 0.45], [-76.84, 0.36], [-76.53, 0.18], [-76.10, 0.25],
  [-75.72, 0.10], [-75.25, 0.10], [-75.18, -0.28], [-75.36, -0.66], [-75.23, -1.01],
  [-75.48, -1.31], [-75.31, -1.69], [-75.56, -1.98], [-75.90, -2.18], [-76.12, -2.54],
  [-76.52, -2.72], [-76.71, -3.07], [-77.10, -3.23], [-77.27, -3.62], [-77.55, -3.87],
  [-77.70, -4.22], [-78.05, -4.47], [-78.31, -4.88], [-78.64, -4.76], [-78.83, -4.42],
  [-79.16, -4.41], [-79.36, -4.12], [-79.65, -4.04], [-79.78, -3.72], [-80.02, -3.61],
  [-80.15, -3.30], [-80.45, -3.08], [-80.32, -2.77], [-80.59, -2.60], [-80.75, -2.30],
  [-80.72, -1.95], [-80.89, -1.60], [-80.78, -1.19], [-80.90, -0.88], [-80.63, -0.58],
  [-80.51, -0.21], [-80.28, 0.12], [-80.08, 0.50], [-79.76, 0.72], [-79.45, 1.02],
  [-79.04, 1.18],
];

const GEO_BOUNDS = { west: -80.9, east: -75.18, south: -4.88, north: 1.45 };
const ECUADOR_OUTLINE: Array<[number, number]> = ECUADOR_LON_LAT.map(([lon, lat]) => [
  (lon - GEO_BOUNDS.west) / (GEO_BOUNDS.east - GEO_BOUNDS.west),
  (lat - GEO_BOUNDS.south) / (GEO_BOUNDS.north - GEO_BOUNDS.south),
] as [number, number]);

function geoToWorld(lon: number, lat: number): [number, number, number] {
  const u = (lon - GEO_BOUNDS.west) / (GEO_BOUNDS.east - GEO_BOUNDS.west);
  const v = (lat - GEO_BOUNDS.south) / (GEO_BOUNDS.north - GEO_BOUNDS.south);
  const x = (u - 0.5) * MAP_WIDTH;
  const z = -(v - 0.5) * MAP_DEPTH;
  return [x, elevationAtWorld(x, z), z];
}

function worldToUv(x: number, z: number) {
  return { u: x / MAP_WIDTH + 0.5, v: 0.5 - z / MAP_DEPTH };
}

function elevationAtUv(u: number, v: number) {
  const ridgeCenter = 0.45 - 0.12 * (1 - v) + 0.018 * Math.sin(v * Math.PI * 2.4);
  const mainRidge = Math.exp(-Math.pow((u - ridgeCenter) / 0.105, 2));
  const easternRidge = Math.exp(-Math.pow((u - ridgeCenter - 0.115) / 0.11, 2)) * 0.42;
  const broadHills = Math.exp(-Math.pow((u - 0.63) / 0.25, 2)) * 0.09;
  const detail = (
    Math.sin(u * 38 + v * 17) * 0.035 +
    Math.sin(u * 19 - v * 34) * 0.025 +
    Math.sin((u + v) * 55) * 0.012
  ) * (0.35 + mainRidge * 0.9);
  const mountainVariation = 0.68 + 0.17 * Math.sin(v * 22) + 0.08 * Math.sin(v * 47 + u * 9);
  return THREE.MathUtils.clamp(0.055 + broadHills + mainRidge * mountainVariation + easternRidge + detail, 0.025, 1);
}

function elevationAtWorld(x: number, z: number) {
  const { u, v } = worldToUv(x, z);
  return elevationAtUv(u, v) * RELIEF_SCALE + 0.05;
}

const museums: Museum[] = [
  {
    id: 'quito', city: 'Quito', name: 'Museo Nacional',
    short: 'Memoria, arte y territorio en el corazón de los Andes.',
    position: geoToWorld(-78.4678, -0.1807), accent: '#ff7148', collection: 'Arte e historia',
  },
  {
    id: 'cuenca', city: 'Cuenca', name: 'Museo Pumapungo',
    short: 'Un recorrido por la diversidad cultural del Ecuador.',
    position: geoToWorld(-79.0059, -2.9001), accent: '#f0b84c', collection: 'Cultura ancestral',
  },
  {
    id: 'guayaquil', city: 'Guayaquil', name: 'Museo Antropológico',
    short: 'Arqueología y arte moderno junto al río Guayas.',
    position: geoToWorld(-79.9224, -2.171), accent: '#74cbb2', collection: 'Arqueología y arte',
  },
];

function pointInPolygon(u: number, v: number) {
  let inside = false;
  for (let i = 0, j = ECUADOR_OUTLINE.length - 1; i < ECUADOR_OUTLINE.length; j = i++) {
    const [xi, yi] = ECUADOR_OUTLINE[i];
    const [xj, yj] = ECUADOR_OUTLINE[j];
    if ((yi > v) !== (yj > v) && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function terrainColor(elevation: number, u: number) {
  const coast = new THREE.Color('#5b965f');
  const rainforest = new THREE.Color('#34785a');
  const foothills = new THREE.Color('#849750');
  const highlands = new THREE.Color('#b56b3c');
  const summits = new THREE.Color('#e2c58e');
  if (elevation < 0.18) return (u > 0.56 ? rainforest : coast).lerp(foothills, elevation / 0.18);
  if (elevation < 0.48) return foothills.clone().lerp(highlands, (elevation - 0.18) / 0.3);
  return highlands.clone().lerp(summits, (elevation - 0.48) / 0.52);
}

function createTerrainGeometry() {
  const columns = 72;
  const rows = 94;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const addVertex = (u: number, v: number) => {
    const x = (u - 0.5) * MAP_WIDTH;
    const z = -(v - 0.5) * MAP_DEPTH;
    const elevation = elevationAtUv(u, v);
    const y = elevation * RELIEF_SCALE + 0.05;
    const color = terrainColor(elevation, u);
    const contour = Math.abs((elevation * 17) % 1 - 0.5) > 0.46 ? 0.76 : 1;
    positions.push(x, y, z);
    colors.push(color.r * contour, color.g * contour, color.b * contour);
  };

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const u0 = column / columns;
      const u1 = (column + 1) / columns;
      const v0 = row / rows;
      const v1 = (row + 1) / rows;
      if (!pointInPolygon((u0 + u1) / 2, (v0 + v1) / 2)) continue;
      const offset = positions.length / 3;
      addVertex(u0, v0);
      addVertex(u1, v0);
      addVertex(u1, v1);
      addVertex(u0, v1);
      indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createBaseGeometry() {
  const shape = new THREE.Shape();
  ECUADOR_OUTLINE.forEach(([u, v], index) => {
    const x = (u - 0.5) * MAP_WIDTH;
    const y = (v - 0.5) * MAP_DEPTH;
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.34,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.055,
    bevelThickness: 0.045,
  });
}

function TopographicTerrain() {
  const terrainGeometry = useMemo(createTerrainGeometry, []);
  const baseGeometry = useMemo(createBaseGeometry, []);
  const outlinePoints = useMemo(() => ECUADOR_OUTLINE.map(([u, v]) => {
    const x = (u - 0.5) * MAP_WIDTH;
    const z = -(v - 0.5) * MAP_DEPTH;
    return new THREE.Vector3(x, elevationAtUv(u, v) * RELIEF_SCALE + 0.09, z);
  }).concat([new THREE.Vector3(
    (ECUADOR_OUTLINE[0][0] - 0.5) * MAP_WIDTH,
    elevationAtUv(ECUADOR_OUTLINE[0][0], ECUADOR_OUTLINE[0][1]) * RELIEF_SCALE + 0.09,
    -(ECUADOR_OUTLINE[0][1] - 0.5) * MAP_DEPTH,
  )]), []);

  useEffect(() => () => {
    terrainGeometry.dispose();
    baseGeometry.dispose();
  }, [terrainGeometry, baseGeometry]);

  return (
    <group>
      <mesh geometry={baseGeometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.34, 0]} receiveShadow castShadow>
        <meshStandardMaterial color="#0d3b31" roughness={0.92} />
      </mesh>
      <mesh geometry={terrainGeometry} receiveShadow castShadow>
        <meshStandardMaterial vertexColors roughness={0.93} metalness={0.01} side={THREE.DoubleSide} />
      </mesh>
      <Line points={outlinePoints} color="#f1e8d3" lineWidth={1.15} transparent opacity={0.72} />
    </group>
  );
}

function MuseumModel({ museum, active, dimmed }: { museum: Museum; active: boolean; dimmed: boolean }) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!group.current) return;
    const target = active ? 0.96 : dimmed ? 0.24 : 0.58;
    const next = THREE.MathUtils.lerp(group.current.scale.x, target, 1 - Math.exp(-delta * 4));
    group.current.scale.setScalar(next);
  });

  return (
    <group ref={group} position={museum.position} scale={0.58}>
      {museum.id === 'quito' && <>
        <RoundedBox args={[1.7, 0.72, 1.05]} radius={0.06} position={[0, 0.42, 0]}><meshStandardMaterial color="#eee4d0" roughness={0.74} /></RoundedBox>
        {[-0.55, 0.55].map((x) => <group key={x} position={[x, 1.02, 0]}><mesh><boxGeometry args={[0.34, 0.9, 0.34]} /><meshStandardMaterial color="#d9c9ac" /></mesh><mesh position={[0, 0.59, 0]}><coneGeometry args={[0.25, 0.42, 4]} /><meshStandardMaterial color="#80543d" /></mesh></group>)}
        <mesh position={[0, 0.92, 0.54]}><circleGeometry args={[0.18, 24]} /><meshStandardMaterial color={museum.accent} /></mesh>
      </>}
      {museum.id === 'cuenca' && <>
        <mesh position={[0, 0.25, 0]}><cylinderGeometry args={[0.72, 0.82, 0.5, 32]} /><meshStandardMaterial color="#e8ddca" roughness={0.7} /></mesh>
        <mesh position={[0, 0.68, 0]}><cylinderGeometry args={[0.52, 0.66, 0.38, 32]} /><meshStandardMaterial color="#d8cbb5" roughness={0.72} /></mesh>
        <mesh position={[0, 0.91, 0]}><cylinderGeometry args={[0.18, 0.46, 0.22, 32]} /><meshStandardMaterial color={museum.accent} /></mesh>
      </>}
      {museum.id === 'guayaquil' && <>
        <RoundedBox args={[1.85, 0.26, 1.1]} radius={0.05} position={[0, 0.17, 0]}><meshStandardMaterial color="#d9d6cb" /></RoundedBox>
        <RoundedBox args={[1.52, 0.5, 0.78]} radius={0.04} position={[0, 0.52, 0]}><meshStandardMaterial color="#ede8dc" /></RoundedBox>
        <mesh position={[0, 0.58, 0.405]}><boxGeometry args={[1.12, 0.2, 0.04]} /><meshStandardMaterial color="#17302d" metalness={0.2} /></mesh>
        <mesh position={[-0.58, 0.86, 0]}><boxGeometry args={[0.24, 0.48, 0.72]} /><meshStandardMaterial color={museum.accent} /></mesh>
      </>}
      <mesh position={[0, -0.035, 0]} receiveShadow><cylinderGeometry args={[1.12, 1.22, 0.08, 32]} /><meshStandardMaterial color="#174c3d" roughness={0.85} /></mesh>
    </group>
  );
}

function MuseumMarker({ museum, active, dimmed, onSelect }: { museum: Museum; active: boolean; dimmed: boolean; onSelect: () => void }) {
  const labelPosition: [number, number, number] = museum.id === 'cuenca'
    ? [-0.28, 2.12, 0.12]
    : museum.id === 'guayaquil'
      ? [0.55, 1.78, 0.34]
      : [0, 2.05, -0.58];
  return (
    <group position={museum.position}>
      <mesh position={[0, 1.15, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.7, 10]} />
        <meshStandardMaterial color={museum.accent} emissive={museum.accent} emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0, 1.5, 0]}>
        <sphereGeometry args={[0.075, 18, 18]} />
        <meshStandardMaterial color={museum.accent} emissive={museum.accent} emissiveIntensity={0.7} />
      </mesh>
      <Html center position={labelPosition} zIndexRange={[40, 10]} style={{ pointerEvents: 'auto' }}>
        <button
          type="button"
          className={`pin-label ${active ? 'is-active' : ''} ${dimmed ? 'is-dimmed' : ''}`}
          onClick={(event) => { event.stopPropagation(); onSelect(); }}
          aria-label={`Acercarse a ${museum.name} en ${museum.city}`}
        >
          <span className="label-dot" style={{ backgroundColor: museum.accent }} />
          <span>{museum.city}</span>
          <small>Ver museo</small>
        </button>
      </Html>
    </group>
  );
}

function MapWorld({ selected, onSelect }: { selected: Museum | null; onSelect: (museum: Museum) => void }) {
  return (
    <group rotation={[0, 0.02, 0]}>
      <TopographicTerrain />
      {museums.map((museum) => (
        <group key={museum.id}>
          <MuseumModel museum={museum} active={selected?.id === museum.id} dimmed={Boolean(selected && selected.id !== museum.id)} />
          <MuseumMarker museum={museum} active={selected?.id === museum.id} dimmed={Boolean(selected && selected.id !== museum.id)} onSelect={() => onSelect(museum)} />
        </group>
      ))}
      <ContactShadows position={[0, -0.36, 0]} opacity={0.38} scale={12} blur={2.8} far={4} />
    </group>
  );
}

function CameraController({ selected }: { selected: Museum | null }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const transition = useRef({
    active: false,
    progress: 0,
    fromPosition: new THREE.Vector3(),
    toPosition: new THREE.Vector3(),
    fromTarget: new THREE.Vector3(),
    toTarget: new THREE.Vector3(),
  });

  useEffect(() => {
    if (!controls.current) return;
    const selectedOffset = selected?.id === 'guayaquil'
      ? new THREE.Vector3(-4.7, 3.45, 4.25)
      : selected?.id === 'cuenca'
        ? new THREE.Vector3(-3.9, 3.5, 4.85)
        : new THREE.Vector3(4.45, 3.6, -5.25);
    const destination = selected
      ? new THREE.Vector3(...selected.position).add(selectedOffset)
      : new THREE.Vector3(7.4, 7.8, -8.2);
    const focus = selected
      ? new THREE.Vector3(selected.position[0], selected.position[1] + 0.42, selected.position[2])
      : new THREE.Vector3(0, 0.5, 0);
    transition.current = {
      active: true,
      progress: 0,
      fromPosition: camera.position.clone(),
      toPosition: destination,
      fromTarget: controls.current.target.clone(),
      toTarget: focus,
    };
  }, [selected, camera]);

  useFrame((_, delta) => {
    const control = controls.current;
    if (!control) return;
    const state = transition.current;
    if (state.active) {
      state.progress = Math.min(1, state.progress + delta / 1.15);
      const eased = 1 - Math.pow(1 - state.progress, 3);
      camera.position.lerpVectors(state.fromPosition, state.toPosition, eased);
      control.target.lerpVectors(state.fromTarget, state.toTarget, eased);
      if (state.progress >= 1) state.active = false;
    } else {
      control.target.x = THREE.MathUtils.clamp(control.target.x, -2.75, 2.75);
      control.target.y = THREE.MathUtils.clamp(control.target.y, 0.05, 1.5);
      control.target.z = THREE.MathUtils.clamp(control.target.z, -3.6, 3.6);
    }
    control.update();
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.075}
      enablePan
      screenSpacePanning={false}
      minDistance={3.4}
      maxDistance={13.5}
      minPolarAngle={0.42}
      maxPolarAngle={1.33}
      target={[0, 0.5, 0]}
      onStart={() => { transition.current.active = false; }}
    />
  );
}

function MuseumDetails({ museum, onClose }: { museum: Museum; onClose: () => void }) {
  return (
    <section className="museum-details" aria-live="polite">
      <button className="details-close" onClick={onClose} aria-label="Cerrar ficha y volver al país">×</button>
      <p className="detail-location">{museum.city} · Ecuador</p>
      <h2>{museum.name}</h2>
      <p className="detail-copy">{museum.short}</p>
      <div className="detail-data">
        <span><small>Colección</small>{museum.collection}</span>
        <span><small>Vista</small>Modelo conceptual 3D</span>
      </div>
      <button className="visit-button">Entrar al museo <span>↗</span></button>
    </section>
  );
}

export default function Home() {
  const [selected, setSelected] = useState<Museum | null>(null);

  return (
    <main className="experience-shell">
      <header className="topbar">
        <a className="brand" href="#" onClick={() => setSelected(null)} aria-label="Atlas Cultural, vista general"><span className="brand-mark">AC</span><span>Atlas Cultural</span></a>
        <span className="prototype-badge">Ecuador · archivo territorial</span>
        <button className="country-button" onClick={() => setSelected(null)}>Vista país <span>↗</span></button>
      </header>

      <div className="workspace">
        <aside className={`side-panel ${selected ? 'has-selection' : ''}`}>
          <div className="panel-intro">
            <p className="eyebrow">Atlas cultural · 01</p>
            <h1>El territorio<br />guarda memoria.</h1>
            <p className="lede">Recorre la topografía del Ecuador y selecciona una ciudad para acercarte a su museo.</p>
          </div>

          {selected && <MuseumDetails museum={selected} onClose={() => setSelected(null)} />}

          <nav className="location-list" aria-label="Museos disponibles">
            <p>Explorar ubicaciones</p>
            {museums.map((museum, index) => (
              <button key={museum.id} className={selected?.id === museum.id ? 'is-selected' : ''} onClick={() => setSelected(museum)}>
                <span className="location-index">0{index + 1}</span>
                <span><strong>{museum.city}</strong><small>{museum.name}</small></span>
                <i>↗</i>
              </button>
            ))}
          </nav>

          {!selected && <div className="navigation-help"><span className="mouse-icon" /><p><strong>Navega el mapa</strong><small>Arrastra para rotar · rueda para acercar</small></p></div>}
        </aside>

        <section className="map-stage" aria-label="Mapa topográfico tridimensional e interactivo del Ecuador">
          <div className="stage-heading"><span>Mapa topográfico</span><span>3 museos · Andes / Costa / Amazonía</span></div>
          <Canvas shadows dpr={[1, 1.65]} gl={{ antialias: true, powerPreference: 'high-performance' }} camera={{ position: [7.4, 7.8, -8.2], fov: 39 }}>
            <color attach="background" args={['#dce8e0']} />
            <fog attach="fog" args={['#dce8e0', 14, 25]} />
            <ambientLight intensity={1.35} />
            <hemisphereLight args={['#fff5dc', '#17483c', 1.25]} />
            <directionalLight position={[-4, 10, 6]} intensity={2.8} color="#fff1d4" castShadow shadow-mapSize={[1536, 1536]} />
            <directionalLight position={[6, 3, -5]} intensity={0.65} color="#7fb4a5" />
            <MapWorld selected={selected} onSelect={setSelected} />
            <CameraController selected={selected} />
          </Canvas>
          <div className="elevation-key" aria-hidden="true"><span>Costa</span><i /><span>Andes</span><i /><span>Amazonía</span></div>
          <div className="compass" aria-hidden="true"><span>N</span><i /></div>
        </section>
      </div>
    </main>
  );
}
