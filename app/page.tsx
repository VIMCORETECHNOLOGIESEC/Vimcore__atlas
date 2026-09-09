'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Html, Line, OrbitControls, RoundedBox } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';

const MAP_WIDTH = 6.4;
const MAP_DEPTH = 8.4;
const RELIEF_SCALE = 0.21;
const BOOK_PAGE_WIDTH = 5.72;
const BOOK_DEPTH = 8.16;
const BOOK_MAP_SCALE = 0.72;
const BOOK_MAP_OFFSET: [number, number, number] = [2.92, 0.29, 0];

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
    id: 'muna-quito', slug: 'museo-nacional-quito', city: 'Quito', province: 'Pichincha', region: 'sierra', name: 'Museo Nacional',
    short: 'Memoria, arte y territorio en el corazón de los Andes.',
    geo: { lon: -78.4678, lat: -0.1807 }, position: geoToWorld(-78.4678, -0.1807), accent: '#ff7148', collection: 'Arte e historia',
    modelVariant: 'colonial', markerOffset: [0.72, 1.7, -0.5],
  },
  {
    id: 'pumapungo-cuenca', slug: 'museo-pumapungo-cuenca', city: 'Cuenca', province: 'Azuay', region: 'sierra', name: 'Museo Pumapungo',
    short: 'Un recorrido por la diversidad cultural del Ecuador.',
    geo: { lon: -79.0059, lat: -2.9001 }, position: geoToWorld(-79.0059, -2.9001), accent: '#f0b84c', collection: 'Cultura ancestral',
    modelVariant: 'archaeological', markerOffset: [0.35, 1.45, 1.05],
  },
  {
    id: 'maac-guayaquil', slug: 'maac-guayaquil', city: 'Guayaquil', province: 'Guayas', region: 'costa', name: 'Museo Antropológico',
    short: 'Arqueología y arte moderno junto al río Guayas.',
    geo: { lon: -79.9224, lat: -2.171 }, position: geoToWorld(-79.9224, -2.171), accent: '#74cbb2', collection: 'Arqueología y arte',
    modelVariant: 'modern', markerOffset: [-1.25, 1.55, -0.1],
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
  const coast = new THREE.Color('#c8ad7c');
  const rainforest = new THREE.Color('#b99a67');
  const foothills = new THREE.Color('#c3a16c');
  const highlands = new THREE.Color('#a96f4d');
  const summits = new THREE.Color('#d6bd91');
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
    depth: 0.06,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.018,
    bevelThickness: 0.012,
  });
}

function TopographicTerrain() {
  const terrainGeometry = useMemo(() => createTerrainGeometry(), []);
  const baseGeometry = useMemo(() => createBaseGeometry(), []);
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
      <mesh geometry={baseGeometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]} receiveShadow castShadow>
        <meshStandardMaterial color="#715039" roughness={0.96} />
      </mesh>
      <mesh geometry={terrainGeometry} receiveShadow castShadow>
        <meshStandardMaterial vertexColors roughness={0.93} metalness={0.01} side={THREE.DoubleSide} />
      </mesh>
      <Line points={outlinePoints} color="#5b3a2a" lineWidth={1.3} transparent opacity={0.82} />
    </group>
  );
}

function MuseumModel({ museum, active, dimmed }: { museum: Museum; active: boolean; dimmed: boolean }) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!group.current) return;
    const target = active ? 0.82 : dimmed ? 0.2 : 0.48;
    const next = THREE.MathUtils.lerp(group.current.scale.x, target, 1 - Math.exp(-delta * 4));
    group.current.scale.setScalar(next);
  });

  return (
    <group ref={group} position={museum.position} scale={0.48}>
      {museum.modelVariant === 'colonial' && <>
        <RoundedBox args={[1.7, 0.72, 1.05]} radius={0.06} position={[0, 0.42, 0]}><meshStandardMaterial color="#eee4d0" roughness={0.74} /></RoundedBox>
        {[-0.55, 0.55].map((x) => <group key={x} position={[x, 1.02, 0]}><mesh><boxGeometry args={[0.34, 0.9, 0.34]} /><meshStandardMaterial color="#d9c9ac" /></mesh><mesh position={[0, 0.59, 0]}><coneGeometry args={[0.25, 0.42, 4]} /><meshStandardMaterial color="#80543d" /></mesh></group>)}
        <mesh position={[0, 0.92, 0.54]}><circleGeometry args={[0.18, 24]} /><meshStandardMaterial color={museum.accent} /></mesh>
      </>}
      {museum.modelVariant === 'archaeological' && <>
        <mesh position={[0, 0.25, 0]}><cylinderGeometry args={[0.72, 0.82, 0.5, 32]} /><meshStandardMaterial color="#e8ddca" roughness={0.7} /></mesh>
        <mesh position={[0, 0.68, 0]}><cylinderGeometry args={[0.52, 0.66, 0.38, 32]} /><meshStandardMaterial color="#d8cbb5" roughness={0.72} /></mesh>
        <mesh position={[0, 0.91, 0]}><cylinderGeometry args={[0.18, 0.46, 0.22, 32]} /><meshStandardMaterial color={museum.accent} /></mesh>
      </>}
      {museum.modelVariant === 'modern' && <>
        <RoundedBox args={[1.85, 0.26, 1.1]} radius={0.05} position={[0, 0.17, 0]}><meshStandardMaterial color="#d9d6cb" /></RoundedBox>
        <RoundedBox args={[1.52, 0.5, 0.78]} radius={0.04} position={[0, 0.52, 0]}><meshStandardMaterial color="#ede8dc" /></RoundedBox>
        <mesh position={[0, 0.58, 0.405]}><boxGeometry args={[1.12, 0.2, 0.04]} /><meshStandardMaterial color="#17302d" metalness={0.2} /></mesh>
        <mesh position={[-0.58, 0.86, 0]}><boxGeometry args={[0.24, 0.48, 0.72]} /><meshStandardMaterial color={museum.accent} /></mesh>
      </>}
      {museum.modelVariant === 'generic' && <>
        <RoundedBox args={[1.35, 0.58, 0.9]} radius={0.05} position={[0, 0.34, 0]}><meshStandardMaterial color="#e7dcc7" roughness={0.78} /></RoundedBox>
        <mesh position={[0, 0.76, 0]}><boxGeometry args={[0.78, 0.26, 0.62]} /><meshStandardMaterial color={museum.accent} roughness={0.76} /></mesh>
      </>}
      <mesh position={[0, -0.035, 0]} receiveShadow><cylinderGeometry args={[1.12, 1.22, 0.08, 32]} /><meshStandardMaterial color="#5b3d2c" roughness={0.9} /></mesh>
    </group>
  );
}

function MuseumMarker({ museum, active, dimmed, onSelect }: { museum: Museum; active: boolean; dimmed: boolean; onSelect: () => void }) {
  const labelPosition = museum.markerOffset;
  return (
    <group position={museum.position}>
      <Line points={[[0, 0.48, 0], labelPosition]} color={museum.accent} lineWidth={1.5} transparent opacity={dimmed ? 0.25 : 0.92} />
      <mesh position={labelPosition}>
        <sphereGeometry args={[0.075, 18, 18]} />
        <meshStandardMaterial color={museum.accent} emissive={museum.accent} emissiveIntensity={0.7} />
      </mesh>
      <Html center position={labelPosition} wrapperClass="pin-html" zIndexRange={[100, 20]} style={{ pointerEvents: 'auto' }}>
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

function createPageGeometry(side: 'left' | 'right') {
  const columns = 36;
  const rows = 20;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows;
    for (let column = 0; column <= columns; column += 1) {
      const t = column / columns;
      const direction = side === 'right' ? 1 : -1;
      const x = direction * (0.13 + t * BOOK_PAGE_WIDTH);
      const z = (v - 0.5) * BOOK_DEPTH;
      const spineLift = 0.24 * Math.exp(-t * 7.2);
      const edgeLift = 0.045 * Math.pow(t, 5);
      const cornerCurl = 0.025 * Math.pow(t, 7) * Math.pow(Math.abs(v - 0.5) * 2, 3);
      const pageWave = 0.014 * Math.sin(v * Math.PI) * Math.sin(t * Math.PI);
      positions.push(x, 0.12 + spineLift + edgeLift + cornerCurl + pageWave, z);
      uvs.push(side === 'right' ? t : 1 - t, v);
    }
  }

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = row * (columns + 1) + column;
      const b = a + 1;
      const c = a + columns + 2;
      const d = a + columns + 1;
      indices.push(a, d, c, a, c, b);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function BookBase() {
  const leftPage = useMemo(() => createPageGeometry('left'), []);
  const rightPage = useMemo(() => createPageGeometry('right'), []);

  useEffect(() => () => {
    leftPage.dispose();
    rightPage.dispose();
  }, [leftPage, rightPage]);

  return (
    <group>
      <RoundedBox args={[5.98, 0.18, 8.48]} radius={0.16} smoothness={5} position={[-3.03, -0.28, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#4f2f25" roughness={0.82} />
      </RoundedBox>
      <RoundedBox args={[5.98, 0.18, 8.48]} radius={0.16} smoothness={5} position={[3.03, -0.28, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#4f2f25" roughness={0.82} />
      </RoundedBox>
      <RoundedBox args={[5.78, 0.27, 8.22]} radius={0.12} smoothness={4} position={[-2.98, -0.13, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#b99b6c" roughness={0.98} />
      </RoundedBox>
      <RoundedBox args={[5.78, 0.27, 8.22]} radius={0.12} smoothness={4} position={[2.98, -0.13, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#b99b6c" roughness={0.98} />
      </RoundedBox>
      <mesh geometry={leftPage} receiveShadow castShadow>
        <meshStandardMaterial color="#e8d4aa" roughness={1} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={rightPage} receiveShadow castShadow>
        <meshStandardMaterial color="#e8d4aa" roughness={1} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -0.18, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.23, 0.23, 8.5, 24]} />
        <meshStandardMaterial color="#3b241d" roughness={0.78} />
      </mesh>
      {[-1, 1].map((side) => (
        <Line
          key={side}
          points={[[side * 5.83, 0.18, -3.92], [side * 5.89, 0.18, 0], [side * 5.83, 0.18, 3.92]]}
          color="#8e6848"
          lineWidth={0.7}
          transparent
          opacity={0.55}
        />
      ))}
    </group>
  );
}

function GalapagosInset() {
  const islands: Array<[number, number, number, number]> = [
    [-3.35, 0.36, 0.54, 0.38], [-2.7, 0.05, 0.34, 0.24], [-3.78, -0.24, 0.27, 0.2],
    [-2.95, -0.62, 0.22, 0.16], [-3.98, 0.72, 0.18, 0.13], [-2.44, 0.78, 0.14, 0.1],
  ];
  return (
    <group position={[0, 0.2, 0.25]}>
      {islands.map(([x, z, sx, sz], index) => (
        <mesh key={`${x}-${z}`} position={[x, 0.05 + index * 0.002, z]} scale={[sx, 0.08, sz]} castShadow receiveShadow>
          <icosahedronGeometry args={[1, 2]} />
          <meshStandardMaterial color={index === 0 ? '#a8734e' : '#b88959'} roughness={0.96} />
        </mesh>
      ))}
      <Line points={[[-4.5, 0.03, -1.35], [-1.8, 0.03, -1.35], [-1.8, 0.03, 1.55], [-4.5, 0.03, 1.55], [-4.5, 0.03, -1.35]]} color="#9b7650" lineWidth={0.7} transparent opacity={0.34} />
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
    <group rotation={[0, 0.015, 0]}>
      <BookBase />
      <GalapagosInset />
      <group position={BOOK_MAP_OFFSET} scale={BOOK_MAP_SCALE}>
        <TopographicTerrain />
        <MuseumOverviewPoints museumList={proxyMuseums} />
        {labeledMuseums.map((museum) => (
          <group key={museum.id}>
            <MuseumModel museum={museum} active={selected?.id === museum.id} dimmed={Boolean(selected && selected.id !== museum.id)} />
            <MuseumMarker museum={museum} active={selected?.id === museum.id} dimmed={Boolean(selected && selected.id !== museum.id)} onSelect={() => onSelect(museum)} />
          </group>
        ))}
        <ContactShadows position={[0, -0.36, 0]} opacity={0.32} scale={11} blur={2.8} far={3} />
      </group>
      <ContactShadows position={[0, -0.38, 0]} opacity={0.48} scale={17} blur={3.2} far={6} />
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
    const selectedOffset = new THREE.Vector3(3.25, 3.15, 4.15);
    const museumPosition = selected ? museumToBookPosition(selected) : null;
    const destination = selected
      ? museumPosition!.clone().add(selectedOffset)
      : new THREE.Vector3(10.4, 10.8, 13.4);
    const focus = selected
      ? museumPosition!.clone().add(new THREE.Vector3(0, 0.32, 0))
      : new THREE.Vector3(0, 0.08, 0);
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
      maxDistance={20}
      minPolarAngle={0.42}
      maxPolarAngle={1.28}
      target={[0, 0.08, 0]}
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

          {selected && <MuseumDetails museum={selected} onClose={() => setSelected(null)} />}

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
          <Canvas shadows dpr={[1, 1.65]} gl={{ antialias: true, powerPreference: 'high-performance' }} camera={{ position: [10.4, 10.8, 13.4], fov: 39 }}>
            <color attach="background" args={['#2e211c']} />
            <fog attach="fog" args={['#2e211c', 18, 30]} />
            <ambientLight intensity={0.92} />
            <hemisphereLight args={['#f5dfb6', '#241712', 1.1]} />
            <directionalLight position={[-5, 11, 6]} intensity={2.5} color="#ffe4b3" castShadow shadow-mapSize={[1536, 1536]} />
            <directionalLight position={[7, 4, -6]} intensity={0.48} color="#c88e62" />
            <BookWorld selected={selected} onSelect={setSelected} museumList={filteredMuseums} />
            <CameraController selected={selected} />
          </Canvas>
          <div className="elevation-key" aria-hidden="true"><span>Libro cartográfico</span><i /><span>Relieve suave</span></div>
          <div className="compass" aria-hidden="true"><span>N</span><i /></div>
        </section>
      </div>
    </main>
  );
}
