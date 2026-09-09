'use client';

import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BOOK_MAP_OFFSET, ECUADOR_OUTLINE, MAP_WIDTH, MAP_DEPTH, elevationAtUv, elevationAtWorld } from './atlas-cartography';
import { museums, museumWorldPosition } from './museum-catalog';

function seededRandom(initial: number) {
  let seed = initial;
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}

export function CloudLayer({ focused, enabled, reducedMotion }: { focused: boolean; enabled: boolean; reducedMotion: boolean }) {
  const texture = useTexture('/textures/cumulus-cloud.webp');
  const sprites = useRef<Array<THREE.Sprite | null>>([]);
  const openness = useRef(0);
  const clouds = useMemo(() => [
    [-2.35, 1.08, -1.15, 1.85], [-1.1, 1.25, -2.75, 1.7], [1.55, 1.05, -2.2, 1.7],
    [2.15, .95, .82, 2.0], [1.32, 1.0, 2.55, 1.7], [-1.9, .95, 2.1, 1.35],
  ], []);
  useFrame(({ clock }, delta) => {
    openness.current = reducedMotion ? Number(focused) : THREE.MathUtils.damp(openness.current, focused ? 1 : 0, 4.5, delta);
    sprites.current.forEach((sprite, i) => {
      if (!sprite) return;
      const [x, y, z, scale] = clouds[i];
      const drift = reducedMotion ? 0 : Math.sin(clock.elapsedTime * .045 + i) * .28;
      const clear = openness.current;
      sprite.position.set(x + drift + Math.sign(x) * clear * 1.7, y + clear * .6, z + Math.sign(z) * clear);
      sprite.scale.set(scale, scale * .7, 1);
      (sprite.material as THREE.SpriteMaterial).opacity = (enabled ? .42 : 0) * (1 - clear);
      sprite.visible = (sprite.material as THREE.SpriteMaterial).opacity > .005;
    });
  });
  return <group position={BOOK_MAP_OFFSET}>
    {clouds.map((_, i) => <sprite key={i} ref={(sprite) => { sprites.current[i] = sprite; }} renderOrder={5}>
      <spriteMaterial map={texture} transparent opacity={.42} depthWrite={false} toneMapped={false} color="#d6ded4" />
    </sprite>)}
  </group>;
}

export function ForestCanopy() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const trees = useMemo(() => {
    const contains = (u: number, v: number) => {
      let inside = false;
      for (let i = 0, j = ECUADOR_OUTLINE.length - 1; i < ECUADOR_OUTLINE.length; j = i++) {
        const a = ECUADOR_OUTLINE[i], b = ECUADOR_OUTLINE[j];
        if ((a[1] > v) !== (b[1] > v) && u < (b[0] - a[0]) * (v - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
      }
      return inside;
    };
    const random = seededRandom(701);
    const result: Array<{ x: number; y: number; z: number; scale: number; tint: number }> = [];
    const museumPositions = museums.map(museumWorldPosition);
    for (let i = 0; i < 3600; i++) {
      const u = .40 + random() * .6, v = .15 + random() * .72;
      const height = elevationAtUv(u, v);
      if (height > .32 || !contains(u, v)) continue;
      const x = (u - .5) * MAP_WIDTH, z = -(v - .5) * MAP_DEPTH;
      if (museumPositions.some((p) => Math.hypot(p[0] - x - BOOK_MAP_OFFSET[0], p[2] - z - BOOK_MAP_OFFSET[2]) < .42)) continue;
      result.push({ x, z, y: elevationAtWorld(x, z) + .024, scale: .014 + random() * .027, tint: random() });
    }
    return result.slice(0, 1400);
  }, []);
  useEffect(() => {
    if (!mesh.current) return;
    const dummy = new THREE.Object3D();
    trees.forEach((tree, i) => {
      dummy.position.set(tree.x, tree.y, tree.z); dummy.scale.set(tree.scale * 1.1, tree.scale * .9, tree.scale); dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
      mesh.current!.setColorAt(i, new THREE.Color().lerpColors(new THREE.Color('#3d5631'), new THREE.Color('#80905a'), tree.tint));
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [trees]);
  return <instancedMesh ref={mesh} args={[undefined, undefined, trees.length]} position={BOOK_MAP_OFFSET} receiveShadow>
    <icosahedronGeometry args={[1, 0]} /><meshStandardMaterial roughness={1} />
  </instancedMesh>;
}
