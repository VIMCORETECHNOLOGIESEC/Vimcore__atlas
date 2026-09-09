import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three';
import ts from 'typescript';

// Load the actual geometry module without requiring a browser or a TS test runtime.
const geography = JSON.parse(readFileSync(new URL('../app/atlas-geography.json', import.meta.url), 'utf8'));
const dem = JSON.parse(readFileSync(new URL('../app/atlas-elevation.json', import.meta.url), 'utf8'));
const scratch = mkdtempSync(join(tmpdir(), 'atlas-tests-'));
after(() => rmSync(scratch, { recursive: true, force: true }));
for (const name of ['atlas-cartography', 'museum-catalog', 'atlas-navigation']) {
  const source = readFileSync(new URL(`../app/${name}.ts`, import.meta.url), 'utf8')
    .replace("import * as THREE from 'three';", `import * as THREE from ${JSON.stringify(import.meta.resolve('three'))};`)
    .replace(/import (\w+) from '(\.\/[^']+\.json)';/g, (_, binding, file) => `const ${binding} = ${readFileSync(new URL('../app/' + file, import.meta.url), 'utf8')};`)
    .replace(/from '(\.\/[^']+)';/g, (_, path) => `from '${path}.mjs';`);
  writeFileSync(join(scratch, `${name}.mjs`), ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText);
}
const atlas = await import(pathToFileURL(join(scratch, 'atlas-cartography.mjs')));
const catalog = await import(pathToFileURL(join(scratch, 'museum-catalog.mjs')));
const navigation = await import(pathToFileURL(join(scratch, 'atlas-navigation.mjs')));

function boundaryEdges(geometry) {
  const p = geometry.getAttribute('position'), edges = new Map();
  const key = (i) => [p.getX(i), p.getY(i), p.getZ(i)].map((v) => v.toFixed(6)).join(',');
  for (let i = 0; i < p.count; i += 3) for (let j = 0; j < 3; j++) {
    const a = i + j, b = i + (j + 1) % 3, id = [key(a), key(b)].sort().join('|');
    if (edges.has(id)) edges.get(id).count++; else edges.set(id, { a, b, count: 1 });
  }
  return [...edges.entries()].filter(([, edge]) => edge.count === 1);
}

test('DEM retains 112000 real samples, geographic orientation and bilinear interpolation', () => {
  assert.equal(dem.width, 320); assert.equal(dem.height, 350); assert.equal(dem.values.length, 112000);
  assert.ok(dem.values.every(Number.isFinite)); assert.ok(Math.max(...dem.values) > 5900);
  assert.equal(atlas.elevationMetersAtUv(0, 1), dem.values[0]);
  assert.equal(atlas.elevationMetersAtUv(1, 0), dem.values.at(-1));
  const x = 123, y = 101;
  const expected = [dem.values[y * 320 + x], dem.values[y * 320 + x + 1], dem.values[(y + 1) * 320 + x], dem.values[(y + 1) * 320 + x + 1]].reduce((a, b) => a + b) / 4;
  assert.ok(Math.abs(atlas.elevationMetersAtUv((x + .5) / 319, 1 - (y + .5) / 349) - expected) < 1e-8);
});

test('terrain exactly covers the geographic polygon, with upward-facing triangles', () => {
  const g = atlas.createTerrainGeometry();
  const p = g.getAttribute('position');
  let triangleArea = 0;
  for (let i = 0; i < p.count; i += 3) {
    const twiceArea = (p.getX(i + 1) - p.getX(i)) * (p.getZ(i + 2) - p.getZ(i)) - (p.getZ(i + 1) - p.getZ(i)) * (p.getX(i + 2) - p.getX(i));
    assert.ok(twiceArea <= .000001, 'terrain faces must point up');
    triangleArea += Math.abs(twiceArea) / 2;
  }
  let polygonArea = 0;
  const outline = atlas.ECUADOR_OUTLINE;
  for (let i = 1; i < outline.length; i++) polygonArea += outline[i - 1][0] * outline[i][1] - outline[i][0] * outline[i - 1][1];
  polygonArea = Math.abs(polygonArea / 2) * atlas.MAP_WIDTH * atlas.MAP_DEPTH;
  assert.ok(Math.abs(triangleArea - polygonArea) < .00001, 'no holes, grid overshoot, or overlapping triangles');
  assert.ok(p.count < 150000, 'keep the map within its mobile geometry budget');
  g.dispose();
});

test('both curved pages face upward, with north at the top of the texture', () => {
  for (const side of ['left', 'right']) {
    const g = atlas.createPageGeometry(side), p = g.getAttribute('position'), uv = g.getAttribute('uv'), n = g.getAttribute('normal');
    for (let i = 0; i < p.count; i++) {
      assert.ok(n.getY(i) > .9);
      assert.ok(Math.abs(uv.getY(i) - (.5 - p.getZ(i) / atlas.BOOK_DEPTH)) < .000001);
    }
    g.dispose();
  }
});

test('all Galapagos islands stay inside the printed inset, including Darwin and Wolf', () => {
  for (const island of geography.galapagos) {
    const g = atlas.createInsularGeometry(island.coordinates);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const x = -2.21 + p.getX(i), z = 2.21 - p.getY(i);
      assert.ok(x >= -3.872 && x <= -.689, `${island.name} outside inset horizontally`);
      assert.ok(z >= 1.066 && z <= 3.362, `${island.name} outside inset vertically`);
    }
    g.dispose();
  }
});

test('every subdivided shoreline edge joins an outward-facing wall without gaps', () => {
  const terrain = atlas.createTerrainGeometry(), walls = atlas.createBaseGeometry(terrain), p = walls.getAttribute('position'), n = walls.getAttribute('normal');
  const boundary = boundaryEdges(terrain);
  assert.equal(p.count, boundary.length * 6);
  const wallEdges = new Set();
  const key = (i) => [p.getX(i), p.getY(i), p.getZ(i)].map((v) => v.toFixed(6)).join(',');
  for (let i = 0; i < p.count; i += 6) {
    wallEdges.add([key(i), key(i + 1)].sort().join('|'));
    const dx = p.getX(i) - p.getX(i + 1), dz = p.getZ(i) - p.getZ(i + 1);
    assert.ok(n.getX(i) * -dz + n.getZ(i) * dx > 0, 'walls face away from Ecuador');
  }
  for (const [id] of boundary) assert.ok(wallEdges.has(id), 'a DEM edge has an exact matching skirt');
  terrain.dispose(); walls.dispose();
});

test('mainland and coastal islands fit the right page in the same geographic projection', () => {
  assert.ok(geography.coastalIslands.length > 0, 'include Puna and the coastal islands');
  for (const ring of [geography.mainland, ...geography.coastalIslands]) for (const [lon, lat] of ring) {
    const [x, , z] = atlas.geoToWorld(lon, lat);
    assert.ok(x + atlas.BOOK_MAP_OFFSET[0] > .13 && x + atlas.BOOK_MAP_OFFSET[0] < .13 + atlas.RIGHT_PAGE_WIDTH);
    assert.ok(Math.abs(z + atlas.BOOK_MAP_OFFSET[2]) < atlas.BOOK_DEPTH / 2);
  }
});

test('pens and magnifier remain outside the atlas and above the desktop', () => {
  const book = new THREE.Box3(new THREE.Vector3(-4.6, -.56, -4.3), new THREE.Vector3(7.25, .8, 4.3));
  for (const prop of [navigation.DESK_PROPS.penOne, navigation.DESK_PROPS.penTwo]) {
    const bounds = new THREE.Box3(new THREE.Vector3(-.14, -1.4, -.14), new THREE.Vector3(.14, 1.83, .14));
    bounds.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...prop.position), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, prop.angle, Math.PI / 2)), new THREE.Vector3(1, 1, 1)));
    assert.equal(bounds.intersectsBox(book), false); assert.ok(bounds.min.y >= -.66);
  }
  const lens = navigation.DESK_PROPS.magnifier;
  const bounds = new THREE.Box3(new THREE.Vector3(-.815, -.13, -.815), new THREE.Vector3(.815, .13, 1.84));
  bounds.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...lens.position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...lens.rotation)), new THREE.Vector3(1, 1, 1)));
  assert.equal(bounds.intersectsBox(book), false); assert.ok(bounds.min.y > -.64);
});

function fixtures(count) {
  return Array.from({ length: count }, (_, i) => ({ ...catalog.museums[i % 3], id: `test-only-${i.toString().padStart(3, '0')}`, region: ['costa', 'sierra', 'amazonia', 'insular'][i % 4], categories: [['historia'], ['arte'], ['arqueologia']][i % 3] }));
}

for (const count of [20, 40, 60, 140]) test(`${count} records cluster deterministically without losing or duplicating IDs`, () => {
  const records = fixtures(count), ids = records.map((m) => m.id).sort();
  const project = (m, i) => ({ museum: m, x: Math.floor(i / 4) * 55, y: i % 4 * 8 });
  const points = records.map(project), clusters = catalog.clusterMuseums(points);
  assert.deepEqual(catalog.clusterMuseums([...points].reverse()), clusters);
  assert.deepEqual(clusters.flatMap((c) => c.members.map((m) => m.id)).sort(), ids);
  for (const region of ['all', 'costa', 'sierra', 'amazonia', 'insular']) for (const category of ['all', 'arqueologia', 'arte', 'historia']) {
    const filtered = catalog.filterMuseums(records, '', region, category);
    assert.deepEqual(filtered.map((m) => m.id), records.filter((m) => (region === 'all' || m.region === region) && (category === 'all' || m.categories.includes(category))).map((m) => m.id));
    assert.deepEqual(catalog.clusterMuseums(filtered.map(project)).flatMap((c) => c.members.map((m) => m.id)).sort(), filtered.map((m) => m.id).sort());
  }
  const coincident = catalog.clusterMuseums(records.map((museum) => ({ museum, x: 100, y: 100 })));
  assert.equal(coincident.length, 1); assert.equal(coincident[0].members.length, count);
});

test('search ignores accents and production contains only the three verified records', () => {
  assert.equal(catalog.museums.length, 3); assert.equal(catalog.filterMuseums(catalog.museums, 'arqueologia', 'all', 'all').length, 2);
  assert.equal(catalog.filterMuseums(catalog.museums, 'pichincha', 'all', 'all')[0].id, 'muna-quito');
});

test('dive and close-up expose one detailed museum and no secondary labels or proxy markers', () => {
  for (const phase of ['dive', 'museum']) for (const museum of catalog.museums) {
    const visible = navigation.sceneVisibility(phase, museum.id);
    assert.equal(visible.overviewMarkers, false); assert.equal(visible.secondaryLabels, false); assert.equal(visible.detailId, museum.id);
  }
  assert.deepEqual(navigation.sceneVisibility('overview', null), { overviewMarkers: true, detailId: null, secondaryLabels: true });
  assert.equal(navigation.sceneVisibility('dive', null).secondaryLabels, false);
});

test('compass follows projected north at four cardinal orientations and different viewport shapes', () => {
  for (const [dx, dy, expected] of [[0, 1, 0], [1, 0, 90], [0, -1, 180], [-1, 0, -90]]) for (const [width, height] of [[400, 800], [1200, 700]]) {
    assert.equal(catalog.compassAngle({ x: .2, y: -.1 }, { x: .2 + dx, y: -.1 + dy }, width, height), expected);
  }
});

test('museum foundation clears the DEM footprint and is the camera focus', () => {
  for (const museum of catalog.museums) {
    const placement = navigation.museumPlacement(museum), [x, y, z] = placement.position;
    for (let i = -5; i <= 5; i++) for (let j = -4; j <= 4; j++) assert.ok(y - .016 > atlas.elevationAtWorld(x - atlas.BOOK_MAP_OFFSET[0] + i * .05, z - atlas.BOOK_MAP_OFFSET[2] + j * .045) + atlas.BOOK_MAP_OFFSET[1]);
    for (const aspect of [.5, 1, 2.2]) {
      const pose = navigation.museumPose(museum, aspect);
      assert.equal(pose.target.x, x); assert.equal(pose.target.z, z); assert.ok(pose.position.y > pose.target.y);
      assert.ok(Math.abs(pose.target.y - y - .17) < 1e-8);
    }
  }
});

test('camera flight has exact endpoints, smooth reversible motion and no scale change', () => {
  assert.ok(navigation.DIVE_DURATION >= 1.2 && navigation.DIVE_DURATION <= 1.8); assert.ok(navigation.MUSEUM_SCALE < .25);
  for (const museum of catalog.museums) for (const aspect of [.5, 1.6, 2.4]) {
    const from = navigation.overviewPose(aspect), to = navigation.museumPose(museum, aspect);
    for (let i = 0; i <= 100; i++) {
      const t = i / 100, forward = navigation.sampleDive(from, to, t), reverse = navigation.sampleDive(to, from, 1 - t);
      assert.ok(forward.position.distanceTo(reverse.position) < 1e-10); assert.ok(forward.target.distanceTo(reverse.target) < 1e-10);
    }
    assert.ok(navigation.sampleDive(from, to, 0).position.distanceTo(from.position) < 1e-12);
    assert.ok(navigation.sampleDive(from, to, 1).position.distanceTo(to.position) < 1e-12);
    assert.ok(navigation.sampleDive(from, to, .0001).position.distanceTo(from.position) < .0001);
    const mid = navigation.sampleDive(from, to, .43), interrupted = navigation.sampleDive(mid, from, 0);
    assert.equal(interrupted.position.distanceTo(mid.position), 0);
  }
  assert.equal(navigation.transitionEffects(.5, true, false).blur, 4);
  assert.equal(navigation.transitionEffects(.5, true, true).blur, 0);
  assert.ok(navigation.transitionEffects(1, true, false).blur < 1e-12);
});
