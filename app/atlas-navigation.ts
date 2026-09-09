import * as THREE from 'three';
import { museumWorldPosition, type Museum } from './museum-catalog';
import { BOOK_MAP_OFFSET, elevationAtWorld } from './atlas-cartography';

export type ViewPhase = 'overview' | 'dive' | 'museum';
export type CameraPose = { position: THREE.Vector3; target: THREE.Vector3 };
export const MUSEUM_SCALE = .19;
export const DIVE_DURATION = 1.65;

export function museumPlacement(museum: Museum) {
  const [x, y, z] = museumWorldPosition(museum);
  let minimum = y, maximum = y;
  if (museum.region !== 'insular') for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) {
    const ground = elevationAtWorld(x - BOOK_MAP_OFFSET[0] + i * .05, z - BOOK_MAP_OFFSET[2] + j * .05) + BOOK_MAP_OFFSET[1];
    minimum = Math.min(minimum, ground); maximum = Math.max(maximum, ground);
  }
  return { position: [x, maximum + .025, z] as [number, number, number], foundationHeight: maximum - minimum + .065 };
}

export function overviewPose(aspect: number): CameraPose {
  const target = new THREE.Vector3(1.45, .12, .12);
  return { target, position: target.clone().add(new THREE.Vector3(.7, 11.9, 8.2).multiplyScalar(Math.max(1, 1.36 / aspect))) };
}

export function museumPose(museum: Museum, aspect: number): CameraPose {
  const center = new THREE.Vector3(...museumPlacement(museum).position);
  const target = center.clone().add(new THREE.Vector3(0, .17, 0));
  // Approach from the south: ground detail fills the view and the building keeps its miniature scale.
  return { target, position: target.clone().add(new THREE.Vector3(.28, .47, 1.08).multiplyScalar(Math.max(1, .95 / aspect))) };
}

export function sampleDive(from: CameraPose, to: CameraPose, progress: number): CameraPose {
  const t = THREE.MathUtils.clamp(progress, 0, 1);
  const eased = t * t * (3 - 2 * t);
  const position = new THREE.Vector3().lerpVectors(from.position, to.position, eased);
  // A low, symmetric arc preserves exact endpoints and works for the reverse flight as well.
  position.y += Math.sin(Math.PI * eased) * Math.min(.75, from.position.distanceTo(to.position) * .07);
  return { position, target: new THREE.Vector3().lerpVectors(from.target, to.target, eased) };
}

export function transitionEffects(progress: number, toMuseum: boolean, reducedMotion: boolean) {
  const t = THREE.MathUtils.clamp(progress, 0, 1);
  return { blur: reducedMotion ? 0 : Math.sin(Math.PI * t) * 4, vignette: toMuseum ? t : 1 - t, saturation: reducedMotion ? 1 : 1 - Math.sin(Math.PI * t) * .18 };
}

export function sceneVisibility(phase: ViewPhase, selectedId: string | null) {
  return { overviewMarkers: phase === 'overview' && !selectedId, detailId: selectedId, secondaryLabels: phase === 'overview' && !selectedId };
}

export const DESK_PROPS = {
  penOne: { position: [8.8, -.51, 2.95] as [number, number, number], angle: -.75 },
  penTwo: { position: [9.18, -.51, 2.55] as [number, number, number], angle: -.75 },
  magnifier: { position: [8.7, -.5, -.8] as [number, number, number], rotation: [0, -.35, 0] as [number, number, number] },
};
