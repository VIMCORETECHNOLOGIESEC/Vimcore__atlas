import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Load the actual geometry module without requiring a browser or a TS test runtime.
const geography = JSON.parse(readFileSync(new URL('../app/atlas-geography.json', import.meta.url), 'utf8'));
const source = readFileSync(new URL('../app/atlas-cartography.ts', import.meta.url), 'utf8')
  .replace("import * as THREE from 'three';", `import * as THREE from ${JSON.stringify(import.meta.resolve('three'))};`)
  .replace("import geography from './atlas-geography.json';", `const geography = ${JSON.stringify(geography)};`);
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const atlas = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

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

test('terrain walls meet the variable height of the shoreline', () => {
  const g = atlas.createBaseGeometry(), p = g.getAttribute('position');
  assert.equal(p.count, (atlas.ECUADOR_OUTLINE.length - 1) * 6);
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) > 0) assert.ok(Math.abs(p.getY(i) - atlas.elevationAtWorld(p.getX(i), p.getZ(i))) < .000001);
  }
  g.dispose();
});

test('mainland and coastal islands fit the right page in the same geographic projection', () => {
  assert.ok(geography.coastalIslands.length > 0, 'include Puna and the coastal islands');
  for (const ring of [geography.mainland, ...geography.coastalIslands]) for (const [lon, lat] of ring) {
    const [x, , z] = atlas.geoToWorld(lon, lat);
    assert.ok(x + atlas.BOOK_MAP_OFFSET[0] > .13 && x + atlas.BOOK_MAP_OFFSET[0] < .13 + atlas.RIGHT_PAGE_WIDTH);
    assert.ok(Math.abs(z + atlas.BOOK_MAP_OFFSET[2]) < atlas.BOOK_DEPTH / 2);
  }
});
