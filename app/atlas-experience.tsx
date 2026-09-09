'use client';

import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { BOOK_MAP_OFFSET, ECUADOR_OUTLINE, MAP_WIDTH, MAP_DEPTH, elevationAtWorld, createTerrainGeometry, createBaseGeometry, createTerrainTexture } from './atlas-cartography';
import { AtlasDesk, AtlasMarginalia, BookBase, CoastalIslands, GalapagosInset, Landmark } from './atlas-scene';
import { CloudLayer, ForestCanopy } from './atlas-atmosphere';
import { MuseumBuilding } from './museum-building';
import { clusterMuseums, clusterPosition, compassAngle, museumWorldPosition, type Museum, type MuseumCluster } from './museum-catalog';
import { DIVE_DURATION, MUSEUM_SCALE, museumPlacement, museumPose, overviewPose, sampleDive, sceneVisibility, transitionEffects, type CameraPose, type ViewPhase } from './atlas-navigation';

export type CameraCommand = { revision: number; kind: 'overview' | 'museum' | 'cluster' | 'zoom-in' | 'zoom-out'; cluster?: MuseumCluster };
type ExperienceProps = {
  catalog: Museum[];
  selected: Museum | null;
  phase: ViewPhase;
  command: CameraCommand;
  clouds: boolean;
  reducedMotion: boolean;
  onSelect: (museum: Museum) => void;
  onCluster: (cluster: MuseumCluster) => void;
  onComplete: (phase: 'overview' | 'museum') => void;
  stageRef: RefObject<HTMLElement | null>;
  compassRef: RefObject<SVGGElement | null>;
};

function Terrain() {
  const resources = useMemo(() => { const geometry = createTerrainGeometry(); return { geometry, walls: createBaseGeometry(geometry), texture: createTerrainTexture() }; }, []);
  const points = useMemo(() => ECUADOR_OUTLINE.map(([u, v]) => {
    const x = (u - .5) * MAP_WIDTH, z = -(v - .5) * MAP_DEPTH;
    return new THREE.Vector3(x, elevationAtWorld(x, z) + .014, z);
  }), []);
  useEffect(() => () => { Object.values(resources).forEach((resource) => resource.dispose()); }, [resources]);
  return <group position={BOOK_MAP_OFFSET}>
    <mesh geometry={resources.walls} castShadow receiveShadow><meshStandardMaterial color="#68654b" roughness={.96} side={THREE.DoubleSide} /></mesh>
    <mesh geometry={resources.geometry} castShadow receiveShadow><meshStandardMaterial map={resources.texture} roughness={.96} side={THREE.DoubleSide} /></mesh>
    <Line points={points} color="#c8ae70" lineWidth={1.1} transparent opacity={.8} />
    <CoastalIslands />
  </group>;
}

function OverviewMarkers({ catalog, onSelect, onCluster }: Pick<ExperienceProps, 'catalog' | 'onSelect' | 'onCluster'>) {
  const { camera, size, gl } = useThree();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const [clusters, setClusters] = useState<MuseumCluster[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);
  const lastUpdate = useRef(-Infinity);
  const signature = useRef('');
  const lastCamera = useRef('');
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const scratch = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => { lastUpdate.current = -Infinity; lastCamera.current = ''; }, [catalog]);
  useEffect(() => () => { gl.domElement.style.removeProperty('cursor'); }, [gl]);
  useFrame(({ clock }) => {
    if (clock.elapsedTime - lastUpdate.current < .14) return;
    lastUpdate.current = clock.elapsedTime;
    const pose = camera.matrixWorld.elements.map((value) => value.toFixed(3)).join(',') + `:${size.width}:${size.height}`;
    if (pose !== lastCamera.current) {
      lastCamera.current = pose;
      const projected = catalog.map((museum) => {
        scratch.set(...museumWorldPosition(museum)).add(new THREE.Vector3(0, .19, 0)).project(camera);
        return { museum, x: (scratch.x + 1) * size.width / 2, y: (1 - scratch.y) * size.height / 2, depth: scratch.z };
      }).filter((point) => point.depth > -1 && point.depth < 1);
      const next = clusterMuseums(projected, size.width < 650 ? 42 : 38);
      const nextSignature = next.map((cluster) => cluster.id).join(';');
      if (nextSignature !== signature.current) { signature.current = nextSignature; setClusters(next); }
    }
  });

  useFrame(() => {
    if (!mesh.current) return;
    const worldPerPixel = camera instanceof THREE.PerspectiveCamera ? 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / size.height : .01;
    clusters.forEach((cluster, index) => {
      const p = clusterPosition(cluster);
      const distance = camera.position.distanceTo(scratch.set(...p));
      const scale = THREE.MathUtils.clamp(distance * worldPerPixel * (cluster.members.length > 1 ? 11 : 7), .028, .18);
      matrix.compose(scratch.set(p[0], p[1] + .16, p[2]), new THREE.Quaternion(), new THREE.Vector3(scale, scale, scale));
      mesh.current!.setMatrixAt(index, matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  useEffect(() => {
    if (!mesh.current) return;
    clusters.forEach((cluster, i) => mesh.current!.setColorAt(i, new THREE.Color(cluster.id === hovered ? '#fff2ca' : cluster.members[0].accent)));
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [clusters, hovered]);

  const activate = (cluster: MuseumCluster) => cluster.members.length === 1 ? onSelect(cluster.members[0]) : onCluster(cluster);
  const pick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (event.instanceId !== undefined && clusters[event.instanceId]) activate(clusters[event.instanceId]);
  };
  // Every marker is pickable; HTML is limited independently of catalog size.
  const labels = clusters.filter((cluster) => cluster.id === hovered || clusters.length <= 3).slice(0, 3);
  return <group name="overview-markers">
    {clusters.length > 0 && <instancedMesh key={clusters.length} ref={mesh} args={[undefined, undefined, clusters.length]} frustumCulled={false} onClick={pick}
      onPointerMove={(event) => { event.stopPropagation(); if (event.instanceId !== undefined) setHovered(clusters[event.instanceId]?.id ?? null); gl.domElement.style.setProperty('cursor', 'pointer'); }}
      onPointerOut={() => { setHovered(null); gl.domElement.style.setProperty('cursor', 'grab'); }}>
      <sphereGeometry args={[1, 16, 12]} /><meshStandardMaterial color="#cdb174" metalness={.5} roughness={.38} emissive="#735521" emissiveIntensity={.2} />
    </instancedMesh>}
    {clusters.map((cluster) => {
      const position = clusterPosition(cluster);
      return <Line key={cluster.id} points={[position, [position[0], position[1] + .16, position[2]]]} color="#c8ae73" lineWidth={1} />;
    })}
    {catalog.length <= 6 && clusters.filter((cluster) => cluster.members.length === 1).slice(0, 3).map((cluster) => <group key={cluster.id} position={museumWorldPosition(cluster.members[0])} scale={.13} onClick={(event) => { event.stopPropagation(); onSelect(cluster.members[0]); }}><Landmark variant={cluster.members[0].modelVariant} /></group>)}
    {labels.map((cluster) => {
      const [x, y, z] = clusterPosition(cluster);
      return <Html key={cluster.id} position={[x, y + .16, z]} center zIndexRange={[8, 4]} wrapperClass="map-label-wrapper">
        <button type="button" className="map-point-label" onClick={() => activate(cluster)} aria-label={cluster.members.length > 1 ? `Explorar grupo de ${cluster.members.length} museos` : `Explorar ${cluster.members[0].name} en ${cluster.members[0].city}`}>
          {cluster.members.length > 1 ? `${cluster.members.length} museos` : cluster.members[0].city}
        </button>
      </Html>;
    })}
  </group>;
}

function CameraRig({ selected, command, onComplete, stageRef, compassRef, reducedMotion }: Pick<ExperienceProps, 'selected' | 'command' | 'onComplete' | 'stageRef' | 'compassRef' | 'reducedMotion'>) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size, gl } = useThree();
  const initialized = useRef(false);
  const requestKey = useRef('');
  const focus = useRef(0);
  const startFocus = useRef(0);
  const finished = useRef(onComplete);
  const state = useRef<{ active: boolean; elapsed: number; duration: number; from: CameraPose; to: CameraPose; destination: 'overview' | 'museum'; cinematic: boolean }>({ active: false, elapsed: 0, duration: DIVE_DURATION, from: overviewPose(1.4), to: overviewPose(1.4), destination: 'overview', cinematic: false });
  useEffect(() => { finished.current = onComplete; }, [onComplete]);

  useEffect(() => {
    const control = controls.current;
    if (!control) return;
    const key = `${command.revision}:${size.width}:${size.height}:${reducedMotion}`;
    if (requestKey.current === key) return;
    requestKey.current = key;
    const aspect = size.width / size.height;
    let to = selected && command.kind === 'museum' ? museumPose(selected, aspect) : overviewPose(aspect);
    let cinematic = command.kind === 'museum' || command.kind === 'overview';
    const destination = command.kind === 'museum' && selected ? 'museum' : command.kind === 'zoom-in' || command.kind === 'zoom-out' ? state.current.destination : 'overview';
    if (command.kind === 'cluster' && command.cluster) {
      const position = clusterPosition(command.cluster);
      const target = new THREE.Vector3(...position);
      const spread = Math.max(.45, ...command.cluster.members.map((museum) => target.distanceTo(new THREE.Vector3(...museumWorldPosition(museum)))));
      to = { target, position: target.clone().add(new THREE.Vector3(.12, 2.1, 1.45).multiplyScalar(Math.max(1, spread * 1.5, .9 / aspect))) };
      cinematic = false;
    }
    if (command.kind === 'zoom-in' || command.kind === 'zoom-out') {
      const offset = camera.position.clone().sub(control.target);
      offset.multiplyScalar(command.kind === 'zoom-in' ? .77 : 1.3).clampLength(selected ? .55 : 2.2, 38);
      to = { target: control.target.clone(), position: control.target.clone().add(offset) };
      cinematic = false;
    }
    if (!initialized.current) {
      camera.position.copy(to.position); control.target.copy(to.target); control.update(); initialized.current = true;
      state.current.destination = destination; return;
    }
    state.current = { active: true, elapsed: 0, duration: reducedMotion ? .01 : cinematic ? DIVE_DURATION : .55, from: { position: camera.position.clone(), target: control.target.clone() }, to, destination, cinematic };
    startFocus.current = focus.current;
    // Flush orbit inertia, then restore the captured pose before the first animation frame.
    control.enableDamping = false; control.update();
    camera.position.copy(state.current.from.position); control.target.copy(state.current.from.target); control.update();
    control.enabled = false;
  }, [command, selected, camera, size.width, size.height, reducedMotion]);

  const temporary = useMemo(() => ({ origin: new THREE.Vector3(), north: new THREE.Vector3(), offset: new THREE.Vector3() }), []);
  useFrame((_, delta) => {
    const control = controls.current;
    if (!control) return;
    const motion = state.current;
    if (motion.active) {
      motion.elapsed = Math.min(motion.duration, motion.elapsed + delta);
      const progress = motion.elapsed / motion.duration;
      const pose = sampleDive(motion.from, motion.to, progress);
      camera.position.copy(pose.position); control.target.copy(pose.target);
      if (motion.cinematic) {
        const effects = transitionEffects(progress, motion.destination === 'museum', reducedMotion);
        gl.domElement.style.setProperty('filter', `blur(${effects.blur.toFixed(2)}px) saturate(${effects.saturation.toFixed(3)})`);
        focus.current = THREE.MathUtils.lerp(startFocus.current, Number(motion.destination === 'museum'), progress * progress * (3 - 2 * progress));
        stageRef.current?.style.setProperty('--focus', String(focus.current));
      }
      if (progress >= 1) {
        motion.active = false; control.enabled = true; control.enableDamping = true; gl.domElement.style.removeProperty('filter');
        if (motion.cinematic) finished.current(motion.destination);
      }
    } else if (motion.destination === 'overview') {
      temporary.offset.set(THREE.MathUtils.clamp(control.target.x, -4.5, 8) - control.target.x, THREE.MathUtils.clamp(control.target.y, .02, 1.5) - control.target.y, THREE.MathUtils.clamp(control.target.z, -4.2, 4.2) - control.target.z);
      control.target.add(temporary.offset); camera.position.add(temporary.offset);
    }
    control.update();
    temporary.origin.copy(control.target).project(camera);
    temporary.north.copy(control.target).add(new THREE.Vector3(0, 0, -1)).project(camera);
    const angle = compassAngle(temporary.origin, temporary.north, size.width, size.height);
    compassRef.current?.setAttribute('transform', `rotate(${angle.toFixed(2)} 60 60)`);
  });

  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={.07} enablePan={!selected} screenSpacePanning={false} minDistance={selected ? .6 : 2.2} maxDistance={Math.max(32, 24 / (size.width / size.height))} minPolarAngle={.18} maxPolarAngle={selected ? 1.18 : 1.02} target={[1.45, .12, .12]} />;
}

function World(props: ExperienceProps) {
  const visibility = sceneVisibility(props.phase, props.selected?.id ?? null);
  const placement = props.selected ? museumPlacement(props.selected) : null;
  return <>
    <color attach="background" args={['#111c1a']} />
    <ambientLight intensity={.58} />
    <hemisphereLight args={['#eee4cb', '#3b4439', 1.25]} />
    <directionalLight position={[-4, 11, -4]} intensity={2.3} color="#fff0d4" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} shadow-bias={-.00015} shadow-normalBias={.015} />
    <directionalLight position={[6, 5, 7]} intensity={.85} color="#bcd8d3" />
    <Suspense fallback={<Html center><span className="atlas-loading">Desplegando el atlas…</span></Html>}>
      <AtlasDesk /><BookBase /><GalapagosInset /><AtlasMarginalia />
      <Terrain /><ForestCanopy />
      <CloudLayer focused={props.phase !== 'overview' || Boolean(props.selected)} enabled={props.clouds} reducedMotion={props.reducedMotion} />
      {visibility.overviewMarkers && <OverviewMarkers catalog={props.catalog} onSelect={props.onSelect} onCluster={props.onCluster} />}
      {visibility.detailId && props.selected && placement && <group name="selected-museum" position={placement.position}>
        <mesh position={[0, -placement.foundationHeight / 2, 0]} castShadow receiveShadow><cylinderGeometry args={[.27, .3, placement.foundationHeight, 48]} /><meshStandardMaterial color="#85836a" roughness={.98} /></mesh>
        <Suspense fallback={null}><group scale={MUSEUM_SCALE}><MuseumBuilding museum={props.selected} /></group></Suspense>
      </group>}
    </Suspense>
    <CameraRig {...props} />
  </>;
}

export default function AtlasExperience(props: ExperienceProps) {
  return <Canvas shadows={{ type: THREE.PCFShadowMap }} dpr={[1, 1.6]} gl={{ antialias: true, powerPreference: 'high-performance' }} camera={{ position: [2.15, 12, 8.32], fov: 39, near: .025, far: 100 }}>
    <World {...props} />
  </Canvas>;
}
