'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Html, Line, OrbitControls } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';

import { BOOK_MAP_OFFSET, BOOK_MAP_SCALE, ECUADOR_OUTLINE, MAP_WIDTH, MAP_DEPTH, RELIEF_SCALE, elevationAtUv, geoToWorld, createTerrainGeometry, createBaseGeometry, createTerrainTexture } from './atlas-cartography';
import { AtlasDesk, AtlasMarginalia, BookBase, CoastalIslands, GalapagosInset, Landmark } from './atlas-scene';

type MuseumRegion = 'costa' | 'sierra' | 'amazonia' | 'insular';
type MuseumVariant = 'colonial' | 'modern' | 'archaeological' | 'generic';

type Museum = {
  id: string;
  slug: string;
  city: string;
  province: string;
  region: MuseumRegion;
  name: string;
  short: string;
  geo: { lon: number; lat: number };
  position: [number, number, number];
  accent: string;
  collection: string;
  modelVariant: MuseumVariant;
  markerOffset: [number, number, number];
};

const museums: Museum[] = [
  {
    id: 'muna-quito', slug: 'museo-nacional-quito', city: 'Quito', province: 'Pichincha', region: 'sierra', name: 'Museo Nacional',
    short: 'Memoria, arte y territorio en el corazón de los Andes.',
    geo: { lon: -78.4678, lat: -0.1807 }, position: geoToWorld(-78.4678, -0.1807), accent: '#ba6036', collection: 'Arte e historia',
    modelVariant: 'colonial', markerOffset: [0.46, 1.02, -0.48],
  },
  {
    id: 'pumapungo-cuenca', slug: 'museo-pumapungo-cuenca', city: 'Cuenca', province: 'Azuay', region: 'sierra', name: 'Museo Pumapungo',
    short: 'Un recorrido por la diversidad cultural del Ecuador.',
    geo: { lon: -79.0059, lat: -2.9001 }, position: geoToWorld(-79.0059, -2.9001), accent: '#c99936', collection: 'Cultura ancestral',
    modelVariant: 'archaeological', markerOffset: [0.59, .90, -.22],
  },
  {
    id: 'maac-guayaquil', slug: 'maac-guayaquil', city: 'Guayaquil', province: 'Guayas', region: 'costa', name: 'Museo Antropológico',
    short: 'Arqueología y arte moderno junto al río Guayas.',
    geo: { lon: -79.9224, lat: -2.171 }, position: geoToWorld(-79.9224, -2.171), accent: '#438e7e', collection: 'Arqueología y arte',
    modelVariant: 'modern', markerOffset: [-0.1, .86, -.63],
  },
];

function TopographicTerrain() {
  const terrainGeometry = useMemo(() => createTerrainGeometry(), []);
  const baseGeometry = useMemo(() => createBaseGeometry(), []);
  const terrainTexture = useMemo(() => createTerrainTexture(), []);
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
    terrainTexture.dispose();
  }, [terrainGeometry, baseGeometry, terrainTexture]);

  return (
    <group>
      <mesh geometry={baseGeometry} receiveShadow castShadow>
        <meshStandardMaterial color="#897643" roughness={0.86} metalness={0.15} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={terrainGeometry} receiveShadow castShadow>
        <meshStandardMaterial map={terrainTexture} roughness={0.96} metalness={0} side={THREE.DoubleSide} />
      </mesh>
      <Line points={outlinePoints} color="#4a4e29" lineWidth={2.8} />
      <Line points={outlinePoints.map((p) => p.clone().add(new THREE.Vector3(0, .008, 0)))} color="#c3a35a" lineWidth={1.1} />
    </group>
  );
}

function MuseumModel({ museum, active, dimmed }: { museum: Museum; active: boolean; dimmed: boolean }) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!group.current) return;
    const target = active ? 0.58 : dimmed ? 0.28 : 0.4;
    group.current.scale.setScalar(THREE.MathUtils.lerp(group.current.scale.x, target, 1 - Math.exp(-delta * 4)));
  });
  return <group ref={group} position={museum.position} scale={0.4}><Landmark variant={museum.modelVariant} /></group>;
}

function MuseumMarker({ museum, active, dimmed, onSelect }: { museum: Museum; active: boolean; dimmed: boolean; onSelect: () => void }) {
  const labelPosition = museum.markerOffset;
  return (
    <group position={museum.position}>
      <Line points={[[labelPosition[0], .1, labelPosition[2]], labelPosition]} color="#8e7142" lineWidth={2} transparent opacity={dimmed ? 0.25 : 0.92} />
      <mesh position={labelPosition}>
        <sphereGeometry args={[0.075, 18, 18]} />
        <meshStandardMaterial color={museum.accent} emissive={museum.accent} emissiveIntensity={0.08} />
      </mesh>
      <Html center position={[labelPosition[0] + .44, labelPosition[1], labelPosition[2]]} wrapperClass="pin-html" zIndexRange={[10, 5]} style={{ pointerEvents: 'auto' }}>
        <button
          type="button"
          className={`pin-label ${active ? 'is-active' : ''} ${dimmed ? 'is-dimmed' : ''}`}
          data-city={museum.city}
          onClick={(event) => { event.stopPropagation(); onSelect(); }}
          aria-label={`Acercarse a ${museum.name} en ${museum.city}`}
        >
          <span className="label-dot" style={{ backgroundColor: museum.accent }} />
          <span>{museum.city}</span>
          <small className="sr-only">Ver museo</small>
        </button>
      </Html>
    </group>
  );
}

function MuseumOverviewPoints({ museumList }: { museumList: Museum[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    if (!mesh.current) return;
    const matrix = new THREE.Matrix4();
    museumList.forEach((museum, index) => {
      matrix.makeTranslation(museum.position[0], museum.position[1] + 0.08, museum.position[2]);
      mesh.current!.setMatrixAt(index, matrix);
      mesh.current!.setColorAt(index, new THREE.Color(museum.accent));
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [museumList]);
  if (!museumList.length) return null;
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, museumList.length]} castShadow>
      <cylinderGeometry args={[0.07, 0.09, 0.16, 8]} />
      <meshStandardMaterial roughness={0.76} />
    </instancedMesh>
  );
}

function BookWorld({ selected, onSelect, museumList }: { selected: Museum | null; onSelect: (museum: Museum) => void; museumList: Museum[] }) {
  const { size } = useThree();
  const labelLimit = size.width < 560 ? 4 : size.width < 900 ? 8 : 12;
  const labeledMuseums = useMemo(() => {
    const prioritized = selected
      ? [selected, ...museumList.filter((museum) => museum.id !== selected.id)]
      : museumList;
    return prioritized.slice(0, labelLimit);
  }, [museumList, selected, labelLimit]);
  const proxyMuseums = useMemo(() => museumList.filter((museum) => !labeledMuseums.some((labeled) => labeled.id === museum.id)), [museumList, labeledMuseums]);
  return (
    <group>
      <AtlasDesk />
      <BookBase />
      <GalapagosInset />
      <AtlasMarginalia />
      <group position={BOOK_MAP_OFFSET} scale={BOOK_MAP_SCALE}>
        <TopographicTerrain />
        <CoastalIslands />
        <MuseumOverviewPoints museumList={proxyMuseums} />
        {labeledMuseums.map((museum) => (
          <group key={museum.id}>
            <MuseumModel museum={museum} active={selected?.id === museum.id} dimmed={Boolean(selected && selected.id !== museum.id)} />
            <MuseumMarker museum={museum} active={selected?.id === museum.id} dimmed={Boolean(selected && selected.id !== museum.id)} onSelect={() => onSelect(museum)} />
          </group>
        ))}
      </group>
      <ContactShadows position={[1, -.62, 0]} opacity={0.36} scale={23} blur={2.3} far={6} resolution={512} frames={1} />
    </group>
  );
}

function museumToBookPosition(museum: Museum) {
  return new THREE.Vector3(
    BOOK_MAP_OFFSET[0] + museum.position[0] * BOOK_MAP_SCALE,
    BOOK_MAP_OFFSET[1] + museum.position[1] * BOOK_MAP_SCALE,
    BOOK_MAP_OFFSET[2] + museum.position[2] * BOOK_MAP_SCALE,
  );
}

function CameraController({ selected, viewRevision }: { selected: Museum | null; viewRevision: number }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size } = useThree();
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
    const selectedOffset = new THREE.Vector3(.8, 4.8, 4.5).multiplyScalar(Math.max(1, .8 / (size.width / size.height)));
    const museumPosition = selected ? museumToBookPosition(selected) : null;
    const destination = selected
      ? museumPosition!.clone().add(selectedOffset)
      : new THREE.Vector3(1.25, 0, 0).add(new THREE.Vector3(1.5, 13.8, 8.0).multiplyScalar(Math.max(1, 1.32 / (size.width / size.height))));
    const focus = selected
      ? museumPosition!.clone().add(new THREE.Vector3(0, 0.32, 0))
      : new THREE.Vector3(1.25, 0.08, 0);
    transition.current = {
      active: true,
      progress: 0,
      fromPosition: camera.position.clone(),
      toPosition: destination,
      fromTarget: controls.current.target.clone(),
      toTarget: focus,
    };
  }, [selected, camera, size.width, size.height, viewRevision]);

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
      control.target.x = THREE.MathUtils.clamp(control.target.x, -5.35, 5.35);
      control.target.y = THREE.MathUtils.clamp(control.target.y, 0.02, 1.1);
      control.target.z = THREE.MathUtils.clamp(control.target.z, -3.75, 3.75);
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
      minDistance={3.1}
      maxDistance={Math.max(32, 24 / (size.width / size.height))}
      minPolarAngle={0.14}
      maxPolarAngle={1.14}
      target={[1.25, 0.08, 0]}
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
  const [viewRevision, setViewRevision] = useState(0);
  const resetView = () => { setSelected(null); setViewRevision((value) => value + 1); };
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState<'all' | MuseumRegion>('all');
  const [visibleCount, setVisibleCount] = useState(20);
  const filteredMuseums = useMemo(() => {
    const normalizedQuery = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    return museums.filter((museum) => {
      if (region !== 'all' && museum.region !== region) return false;
      if (!normalizedQuery) return true;
      const searchable = `${museum.name} ${museum.city} ${museum.province} ${museum.collection}`
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      return searchable.includes(normalizedQuery);
    });
  }, [query, region]);
  const listedMuseums = filteredMuseums.slice(0, visibleCount);

  return (
    <main className="experience-shell">
      <header className="topbar">
        <a className="brand" href="#" onClick={resetView} aria-label="Atlas Cultural, vista general"><span className="brand-mark">AC</span><span>Atlas Cultural</span></a>
        <span className="prototype-badge">Ecuador · archivo territorial</span>
        <button className="country-button" onClick={resetView}>Vista país <span>↗</span></button>
      </header>

      <div className="workspace">
        <aside className={`side-panel ${selected ? 'has-selection' : ''}`}>
          <div className="panel-intro">
            <p className="eyebrow">Atlas cultural · 01</p>
            <h1>El territorio<br />guarda memoria.</h1>
            <p className="lede">Recorre la topografía del Ecuador y selecciona una ciudad para acercarte a su museo.</p>
          </div>

          <section className="catalog-tools" aria-label="Buscar y filtrar el catálogo">
            <label className="museum-search">
              <span className="sr-only">Buscar museo, ciudad o provincia</span>
              <span aria-hidden="true">⌕</span>
              <input value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(20); setSelected(null); }} placeholder="Buscar museo, ciudad o provincia" />
              {query && <button type="button" onClick={() => { setQuery(''); setVisibleCount(20); setSelected(null); }} aria-label="Limpiar búsqueda">×</button>}
            </label>
            <div className="region-filters" aria-label="Filtrar por región">
              {([['all', 'Todas'], ['costa', 'Costa'], ['sierra', 'Sierra'], ['amazonia', 'Amazonía'], ['insular', 'Insular']] as const).map(([value, label]) => (
                <button key={value} type="button" aria-pressed={region === value} className={region === value ? 'is-active' : ''} onClick={() => { setRegion(value); setVisibleCount(20); setSelected(null); }}>{label}</button>
              ))}
            </div>
            <p className="catalog-count"><strong>{filteredMuseums.length}</strong> de {museums.length} museos piloto <span>· preparado para 140</span></p>
          </section>

          {selected && <MuseumDetails museum={selected} onClose={resetView} />}

          <nav className="location-list" aria-label="Museos disponibles">
            <p>Explorar ubicaciones</p>
            {listedMuseums.map((museum, index) => (
              <button key={museum.id} className={selected?.id === museum.id ? 'is-selected' : ''} onClick={() => setSelected(museum)}>
                <span className="location-index">{String(index + 1).padStart(3, '0')}</span>
                <span><strong>{museum.city}</strong><small>{museum.name}</small></span>
                <i>↗</i>
              </button>
            ))}
            {!filteredMuseums.length && <p className="empty-results">No hay coincidencias con estos filtros.</p>}
            {visibleCount < filteredMuseums.length && (
              <button type="button" className="show-more" onClick={() => setVisibleCount((count) => count + 20)}>
                Mostrar 20 más <span>{visibleCount} / {filteredMuseums.length}</span>
              </button>
            )}
          </nav>

          {!selected && <div className="navigation-help"><span className="mouse-icon" /><p><strong>Navega el mapa</strong><small>Arrastra para rotar · rueda para acercar</small></p></div>}
        </aside>

        <section className="map-stage" aria-label="Mapa topográfico tridimensional e interactivo del Ecuador">
          <div className="stage-heading"><span>Atlas abierto · Ecuador</span><span>{filteredMuseums.length} {filteredMuseums.length === 1 ? 'museo visible' : 'museos visibles'} · catálogo en expansión</span></div>
          <Canvas shadows dpr={[1, 1.65]} gl={{ antialias: true, powerPreference: 'high-performance' }} camera={{ position: [2.75, 13.8, 8], fov: 39, near: .1, far: 100 }}>
            <color attach="background" args={['#2e211c']} />
            <ambientLight intensity={0.6} />
            <hemisphereLight args={['#f9ecd1', '#524736', 1.2]} />
            <directionalLight position={[-5, 12, -3]} intensity={2.4} color="#ffe5bf" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} shadow-normalBias={.035} shadow-bias={-.00015} />
            <directionalLight position={[7, 4, -6]} intensity={0.48} color="#c88e62" />
            <Suspense fallback={<Html center><span className="atlas-loading">Abriendo el atlas…</span></Html>}>
              <BookWorld selected={selected} onSelect={setSelected} museumList={filteredMuseums} />
            </Suspense>
            <CameraController selected={selected} viewRevision={viewRevision} />
          </Canvas>
          <div className="atlas-view-controls"><button type="button" onClick={resetView} aria-label="Restaurar perspectiva del atlas">↺ <span>Vista general</span></button><span>Arrastra para girar · acerca para explorar</span></div>
          <a className="map-attribution" href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noreferrer">Cartografía: Natural Earth</a>
          <div className="compass" aria-hidden="true"><span>N</span><i /></div>
        </section>
      </div>
    </main>
  );
}
