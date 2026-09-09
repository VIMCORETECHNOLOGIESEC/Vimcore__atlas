import { BOOK_MAP_OFFSET, elevationAtWorld, geoToWorld } from './atlas-cartography';

export type MuseumRegion = 'costa' | 'sierra' | 'amazonia' | 'insular';
export type MuseumCategory = 'arqueologia' | 'arte' | 'historia';
export type Museum = {
  id: string;
  city: string;
  province: string;
  region: MuseumRegion;
  name: string;
  short: string;
  geo: { lon: number; lat: number };
  accent: string;
  collection: string;
  categories: MuseumCategory[];
  modelVariant: 'colonial' | 'modern' | 'archaeological';
  /** Optional production GLB, requested only after selecting this museum. */
  model?: { url: string; scale: number; rotationY?: number };
};

// The catalog is data-driven. Add verified records here; stress fixtures never enter production.
export const museums: Museum[] = [
  { id: 'muna-quito', city: 'Quito', province: 'Pichincha', region: 'sierra', name: 'Museo Nacional', short: 'Un encuentro con la memoria del Ecuador: sus primeras culturas, el arte y las historias que nos conectan.', geo: { lon: -78.4678, lat: -.1807 }, accent: '#d5ad71', collection: 'Arte e historia', categories: ['arte', 'historia'], modelVariant: 'colonial' },
  { id: 'pumapungo-cuenca', city: 'Cuenca', province: 'Azuay', region: 'sierra', name: 'Museo Pumapungo', short: 'Culturas ancestrales y patrimonio vivo en el paisaje andino de Cuenca.', geo: { lon: -79.0059, lat: -2.9001 }, accent: '#cfb168', collection: 'Arqueología y etnografía', categories: ['arqueologia', 'historia'], modelVariant: 'archaeological' },
  { id: 'maac-guayaquil', city: 'Guayaquil', province: 'Guayas', region: 'costa', name: 'MAAC', short: 'Arqueología y arte contemporáneo a orillas del río Guayas. Un diálogo entre la creación actual y las culturas de la costa.', geo: { lon: -79.9224, lat: -2.171 }, accent: '#80b8a4', collection: 'Arqueología y arte contemporáneo', categories: ['arqueologia', 'arte'], modelVariant: 'modern' },
];

export function museumWorldPosition(museum: Pick<Museum, 'geo' | 'region'>): [number, number, number] {
  if (museum.region === 'insular') return [-2.21 + (museum.geo.lon + 90.6) * .61, .26, 2.21 - (museum.geo.lat - .1) * .61];
  const [x, y, z] = geoToWorld(museum.geo.lon, museum.geo.lat);
  return [x + BOOK_MAP_OFFSET[0], y + BOOK_MAP_OFFSET[1], z + BOOK_MAP_OFFSET[2]];
}

export function filterMuseums(catalog: Museum[], query: string, region: string, category: string) {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const text = normalize(query).trim();
  return catalog.filter((museum) => (region === 'all' || museum.region === region) && (category === 'all' || museum.categories.includes(category as MuseumCategory)) && (!text || normalize(`${museum.name} ${museum.city} ${museum.province} ${museum.collection}`).includes(text)));
}

export type ProjectedMuseum = { museum: Museum; x: number; y: number };
export type MuseumCluster = { id: string; members: Museum[]; x: number; y: number };

/** Deterministic screen-space connected components; 140 records need fewer than 10k comparisons. */
export function clusterMuseums(projected: ProjectedMuseum[], radius = 38): MuseumCluster[] {
  const points = [...projected].sort((a, b) => a.museum.id.localeCompare(b.museum.id));
  const parents = points.map((_, i) => i);
  const find = (index: number): number => { while (parents[index] !== index) { parents[index] = parents[parents[index]]; index = parents[index]; } return index; };
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    if ((points[i].x - points[j].x) ** 2 + (points[i].y - points[j].y) ** 2 <= radius ** 2) parents[find(j)] = find(i);
  }
  const groups = new Map<number, ProjectedMuseum[]>();
  points.forEach((point, i) => { const root = find(i); groups.set(root, [...(groups.get(root) ?? []), point]); });
  return [...groups.values()].map((group) => ({ id: group.map((p) => p.museum.id).join('|'), members: group.map((p) => p.museum), x: group.reduce((sum, p) => sum + p.x, 0) / group.length, y: group.reduce((sum, p) => sum + p.y, 0) / group.length }));
}

export function clusterPosition(cluster: MuseumCluster): [number, number, number] {
  const positions = cluster.members.map(museumWorldPosition);
  const x = positions.reduce((sum, p) => sum + p[0], 0) / positions.length, z = positions.reduce((sum, p) => sum + p[2], 0) / positions.length;
  const ground = cluster.members.every((museum) => museum.region === 'insular') ? .26 : elevationAtWorld(x - BOOK_MAP_OFFSET[0], z - BOOK_MAP_OFFSET[2]) + BOOK_MAP_OFFSET[1];
  return [x, Math.max(ground, ...positions.map((p) => p[1])), z];
}

export function compassAngle(origin: { x: number; y: number }, north: { x: number; y: number }, width: number, height: number) {
  return Math.atan2((north.x - origin.x) * width, (north.y - origin.y) * height) * 180 / Math.PI;
}
