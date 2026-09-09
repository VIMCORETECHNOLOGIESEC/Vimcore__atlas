import * as THREE from 'three';
import geography from './atlas-geography.json';

export const LEFT_PAGE_WIDTH = 4.3;
export const RIGHT_PAGE_WIDTH = 6.9;
export const BOOK_DEPTH = 8.2;
export const GEO_BOUNDS = { west: -81.10, east: -75.18, south: -5.02, north: 1.46 };
export const MAP_WIDTH = 5.45;
export const MAP_DEPTH = MAP_WIDTH * (GEO_BOUNDS.north - GEO_BOUNDS.south) / (GEO_BOUNDS.east - GEO_BOUNDS.west);
export const BOOK_MAP_OFFSET: [number, number, number] = [3.92, 0.22, 0.04];
export const BOOK_MAP_SCALE = 1;
export const RELIEF_SCALE = 0.18;
type Coordinate = [number, number];
export const ECUADOR_LON_LAT = geography.mainland as Coordinate[];
export const ECUADOR_OUTLINE = ECUADOR_LON_LAT.map(([lon, lat]) => [
  (lon - GEO_BOUNDS.west) / (GEO_BOUNDS.east - GEO_BOUNDS.west),
  (lat - GEO_BOUNDS.south) / (GEO_BOUNDS.north - GEO_BOUNDS.south),
] as Coordinate);

export function elevationAtUv(u: number, v: number) {
  const ridgeCenter = 0.48 - 0.24 * (1 - v) + 0.016 * Math.sin(v * 19);
  const ridge = Math.exp(-Math.pow((u - ridgeCenter) / 0.095, 2));
  const east = Math.exp(-Math.pow((u - ridgeCenter - 0.095) / 0.07, 2)) * 0.28;
  const folds = (Math.sin(v * 81 + u * 46) + Math.sin(v * 141 - u * 90)) * 0.075;
  return THREE.MathUtils.clamp(0.04 + ridge * (0.62 + folds + 0.13 * Math.sin(v * 27)) + east, 0.025, 1);
}

export function geoToWorld(lon: number, lat: number): [number, number, number] {
  const u = (lon - GEO_BOUNDS.west) / (GEO_BOUNDS.east - GEO_BOUNDS.west);
  const v = (lat - GEO_BOUNDS.south) / (GEO_BOUNDS.north - GEO_BOUNDS.south);
  return [(u - 0.5) * MAP_WIDTH, elevationAtUv(u, v) * RELIEF_SCALE + 0.055, -(v - 0.5) * MAP_DEPTH];
}

export function elevationAtWorld(x: number, z: number) {
  return elevationAtUv(x / MAP_WIDTH + 0.5, 0.5 - z / MAP_DEPTH) * RELIEF_SCALE + 0.055;
}

export function pageHeight(x: number, z: number, width: number) {
  const t = THREE.MathUtils.clamp((Math.abs(x) - 0.13) / width, 0, 1);
  return 0.12 + 0.19 * Math.exp(-t * 8) + 0.035 * t ** 5 + 0.018 * Math.sin(z * 0.7) * Math.sin(t * Math.PI);
}

export function createPageGeometry(side: 'left' | 'right') {
  const width = side === 'left' ? LEFT_PAGE_WIDTH : RIGHT_PAGE_WIDTH;
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const columns = 48, rows = 32;
  for (let row = 0; row <= rows; row++) {
    for (let column = 0; column <= columns; column++) {
      const t = column / columns, v = row / rows;
      const x = (side === 'right' ? 1 : -1) * (0.13 + t * width);
      const z = (v - 0.5) * BOOK_DEPTH;
      positions.push(x, pageHeight(x, z, width), z);
      uvs.push(side === 'right' ? t : 1 - t, 1 - v);
    }
  }
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const a = row * (columns + 1) + column, b = a + 1, c = a + columns + 2, d = a + columns + 1;
      indices.push(...(side === 'right' ? [a, d, c, a, c, b] : [a, c, d, a, b, c]));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createTerrainGeometry() {
  // Triangulate the actual coast before subdivision: no square-grid cells outside Ecuador.
  const contour = ECUADOR_OUTLINE.map(([u, v]) => new THREE.Vector2((u - 0.5) * MAP_WIDTH, (v - 0.5) * MAP_DEPTH));
  if (contour[0].distanceTo(contour[contour.length - 1]) < 0.00001) contour.pop();
  const faces = THREE.ShapeUtils.triangulateShape(contour, []);
  const positions: number[] = [], uvs: number[] = [];
  function triangle(a: THREE.Vector2, b: THREE.Vector2, c: THREE.Vector2, depth = 0) {
    const ab = a.distanceToSquared(b), bc = b.distanceToSquared(c), ca = c.distanceToSquared(a);
    if (depth < 12 && Math.max(ab, bc, ca) > 0.032) {
      if (ab >= bc && ab >= ca) { const m = a.clone().lerp(b, 0.5); triangle(a, m, c, depth + 1); triangle(m, b, c, depth + 1); }
      else if (bc >= ca) { const m = b.clone().lerp(c, 0.5); triangle(a, b, m, depth + 1); triangle(a, m, c, depth + 1); }
      else { const m = c.clone().lerp(a, 0.5); triangle(a, b, m, depth + 1); triangle(m, b, c, depth + 1); }
      return;
    }
    for (const p of [a, b, c]) {
      positions.push(p.x, elevationAtWorld(p.x, -p.y), -p.y);
      uvs.push(p.x / MAP_WIDTH + 0.5, p.y / MAP_DEPTH + 0.5);
    }
  }
  faces.forEach(([a, b, c]) => triangle(contour[a], contour[b], contour[c]));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

export function createBaseGeometry() {
  const positions: number[] = [];
  for (let i = 1; i < ECUADOR_OUTLINE.length; i++) {
    const [u0, v0] = ECUADOR_OUTLINE[i - 1], [u1, v1] = ECUADOR_OUTLINE[i];
    const x0 = (u0 - .5) * MAP_WIDTH, z0 = -(v0 - .5) * MAP_DEPTH;
    const x1 = (u1 - .5) * MAP_WIDTH, z1 = -(v1 - .5) * MAP_DEPTH;
    const y0 = elevationAtWorld(x0, z0), y1 = elevationAtWorld(x1, z1);
    positions.push(x0, 0, z0, x1, 0, z1, x1, y1, z1, x0, 0, z0, x1, y1, z1, x0, y0, z0);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function hash(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
function noise(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), sx), THREE.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), sx), sy);
}
function canvasTexture(canvas: HTMLCanvasElement) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function createTerrainTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 1152;
  const ctx = canvas.getContext('2d')!;
  const pixels = ctx.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    const u = x / canvas.width, v = 1 - y / canvas.height;
    const elevation = elevationAtUv(u, v);
    const wash = noise(u * 16, v * 20) * 0.6 + noise(u * 56, v * 62) * 0.3 + noise(u * 160, v * 175) * 0.1;
    const high = THREE.MathUtils.smoothstep(elevation, 0.13, 0.7);
    const green = u > 0.52 ? [135, 145, 88] : [146, 153, 93];
    const mountain = [187, 134, 78];
    const slope = elevationAtUv(u + 0.004, v + 0.002) - elevationAtUv(u - 0.004, v - 0.002);
    const grain = hash(x, y) * 13 - 6;
    const shade = 0.82 + wash * 0.32 + slope * 2.3;
    const i = (y * canvas.width + x) * 4;
    for (let channel = 0; channel < 3; channel++) pixels.data[i + channel] = THREE.MathUtils.clamp((green[channel] * (1 - high) + mountain[channel] * high) * shade + grain, 0, 255);
    pixels.data[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  // Geographic rivers remain aligned with the same projection as the country and city pins.
  ctx.strokeStyle = 'rgba(42,84,76,.64)'; ctx.lineWidth = 1.35;
  for (const river of geography.rivers ?? []) {
    ctx.beginPath();
    river.forEach(([lon, lat], i) => {
      const x = (lon - GEO_BOUNDS.west) / (GEO_BOUNDS.east - GEO_BOUNDS.west) * canvas.width;
      const y = (GEO_BOUNDS.north - lat) / (GEO_BOUNDS.north - GEO_BOUNDS.south) * canvas.height;
      if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(47,57,30,.82)'; ctx.font = '22px Georgia'; ctx.textAlign = 'center';
  ctx.fillText('A M A Z O N Í A', canvas.width * .72, canvas.height * .47);
  return canvasTexture(canvas);
}

function frame(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.strokeStyle = 'rgba(93,62,33,.65)'; ctx.lineWidth = 1.7;
  ctx.strokeRect(37, 37, w - 74, h - 74); ctx.strokeRect(47, 47, w - 94, h - 94);
  for (const [x, y, sx, sy] of [[52, 52, 1, 1], [w - 52, 52, -1, 1], [52, h - 52, 1, -1], [w - 52, h - 52, -1, -1]]) {
    ctx.save(); ctx.translate(x, y); ctx.scale(sx, sy);
    ctx.beginPath(); ctx.moveTo(0, 33); ctx.quadraticCurveTo(18, 18, 0, 0); ctx.quadraticCurveTo(18, 18, 33, 0); ctx.stroke();
    ctx.strokeRect(7, 7, 7, 7); ctx.restore();
  }
}

function compass(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.save(); ctx.translate(x, y); ctx.strokeStyle = '#705634'; ctx.fillStyle = '#705634'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.66, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.74, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 8; i++) {
    ctx.save(); ctx.rotate(i * Math.PI / 4);
    ctx.beginPath(); ctx.moveTo(0, -r * (i % 2 ? .64 : 1)); ctx.lineTo(r * .13, 0); ctx.lineTo(0, r * .12); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -r * (i % 2 ? .64 : 1)); ctx.lineTo(-r * .13, 0); ctx.lineTo(0, r * .12); ctx.closePath(); ctx.stroke(); ctx.restore();
  }
  ctx.font = `${r * .26}px Georgia`; ctx.textAlign = 'center';
  ctx.fillText('N', 0, -r * 1.17); ctx.fillText('S', 0, r * 1.4); ctx.fillText('O', -r * 1.3, 6); ctx.fillText('E', r * 1.3, 6);
  ctx.restore();
}

export function createPageTexture(side: 'left' | 'right', parchment: THREE.Texture) {
  const canvas = document.createElement('canvas');
  canvas.width = side === 'left' ? 1024 : 1536; canvas.height = 1840;
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = '#d9bd89'; ctx.fillRect(0, 0, w, h);
  const parchmentImage = parchment.image as CanvasImageSource;
  ctx.drawImage(parchmentImage, 0, 0, w, h);
  const vignette = ctx.createRadialGradient(w * .5, h * .5, w * .22, w * .5, h * .5, h * .65);
  vignette.addColorStop(0, 'rgba(89,48,15,0)'); vignette.addColorStop(1, 'rgba(89,48,15,.3)');
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, w, h);
  if (side === 'right') {
    const toPixel = (lon: number, lat: number) => {
      const p = geoToWorld(lon, lat);
      return [(p[0] + BOOK_MAP_OFFSET[0] - .13) / RIGHT_PAGE_WIDTH * w, (p[2] + BOOK_MAP_OFFSET[2] + BOOK_DEPTH / 2) / BOOK_DEPTH * h];
    };
    ctx.save(); ctx.beginPath(); ctx.rect(53, 53, w - 106, h - 106); ctx.clip();
    ctx.fillStyle = '#a2b6af'; ctx.globalAlpha = .7; ctx.fillRect(53, 53, w - 106, h - 106); ctx.globalAlpha = 1;
    for (const country of [...geography.neighbors, { name: 'Ecuador', coordinates: geography.mainland }, ...geography.coastalIslands.map((coordinates) => ({ name: 'Ecuador', coordinates }))]) {
      ctx.beginPath();
      country.coordinates.forEach(([lon, lat], i) => { const [x, y] = toPixel(lon, lat); if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
      ctx.closePath(); ctx.fillStyle = '#d3b988'; ctx.fill();
      ctx.save(); ctx.clip(); ctx.globalAlpha = .68; ctx.drawImage(parchmentImage, 0, 0, w, h); ctx.restore();
      ctx.strokeStyle = 'rgba(91,68,43,.8)'; ctx.lineWidth = 1.9; ctx.stroke();
    }
    ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = .5; ctx.drawImage(parchmentImage, 0, 0, w, h); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#4c4a32'; ctx.font = '25px Georgia'; ctx.textAlign = 'center';
    ctx.fillText('C O L O M B I A', w * .67, h * .14);
    ctx.fillText('P E R Ú', w * .78, h * .88);
    ctx.font = 'italic 22px Georgia'; ctx.fillStyle = '#415c59';
    ctx.fillText('OCÉANO', w * .13, h * .30); ctx.fillText('PACÍFICO', w * .13, h * .324);
    ctx.strokeStyle = 'rgba(52,85,85,.26)'; ctx.lineWidth = 1.3;
    for (let row = 0; row < 23; row++) {
      const y = h * .35 + row * 35;
      ctx.beginPath();
      for (let x = 90; x < 210; x++) { const yy = y + Math.sin(x * .15) * 2.5; if (x === 90) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); } ctx.stroke();
    }
    compass(ctx, w * .88, h * .22, 70);
    ctx.restore();
  } else {
    ctx.fillStyle = '#283a2c'; ctx.textAlign = 'center'; ctx.font = '66px Georgia';
    ctx.fillText('ATLAS', w * .5, h * .15); ctx.fillText('CULTURAL', w * .5, h * .195);
    ctx.font = '19px Georgia'; ctx.fillText('E C U A D O R', w * .5, h * .235);
    ctx.strokeStyle = '#896b42'; ctx.lineWidth = 1.6;
    for (const y of [.09, .267, .375, .483, .592]) { ctx.beginPath(); ctx.moveTo(w * .16, h * y); ctx.lineTo(w * .84, h * y); ctx.stroke(); }
    ctx.font = '35px Georgia'; ctx.textAlign = 'left';
    [['QUITO', '#b95932'], ['CUENCA', '#bd8c2e'], ['GUAYAQUIL', '#438875']].forEach(([name, color], i) => {
      const y = h * (.328 + i * .108); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(w * .4, y - 10, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#29392a'; ctx.fillText(name, w * .45, y);
    });
    ctx.strokeStyle = '#967849'; ctx.strokeRect(w * .13, h * .63, w * .74, h * .28);
    ctx.font = '21px Georgia'; ctx.textAlign = 'center'; ctx.fillText('I S L A S  G A L Á P A G O S', w * .5, h * .946);
    compass(ctx, w * .78, h * .69, 43);
  }
  frame(ctx, w, h);
  const gutter = ctx.createLinearGradient(side === 'left' ? w - 90 : 0, 0, side === 'left' ? w : 90, 0);
  gutter.addColorStop(0, side === 'left' ? 'rgba(51,27,11,0)' : 'rgba(51,27,11,.45)');
  gutter.addColorStop(1, side === 'left' ? 'rgba(51,27,11,.45)' : 'rgba(51,27,11,0)');
  ctx.fillStyle = gutter; ctx.fillRect(side === 'left' ? w - 90 : 0, 0, 90, h);
  return canvasTexture(canvas);
}

export function createInsularGeometry(coordinates: number[][]) {
  const shape = new THREE.Shape(coordinates.map(([lon, lat]) => new THREE.Vector2((lon + 90.6) * .61, (lat - .1) * .61)));
  // The same geographic scale fits Darwin and Wolf without enlarging small islands with a bevel.
  return new THREE.ExtrudeGeometry(shape, { depth: .035, bevelEnabled: false });
}
export { geography };
