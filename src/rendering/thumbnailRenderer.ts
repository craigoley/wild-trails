/**
 * §HUD catch-target (i) — the RTT thumbnail render (the new capability). Renders a procedural species
 * model ONCE into a small `WebGLRenderTarget` via the EXISTING renderer (one GL context — not a 2nd
 * renderer, the mobile multi-context limit), reads the pixels into a 2D canvas → a dataURL. Pure render;
 * called lazily (on first panel display), never per frame. ⚠️ Restores the main render target after each
 * render (the live scene is untouched). ⚠️ Flips the model's `depthTest` back to true (the entity
 * materials ship `depthTest:false` for world-compositing — which would muddy an isolated thumbnail).
 *
 * The offscreen scene / camera / target / canvas are built ONCE in the factory and reused per species;
 * only the per-species model is built + disposed each render (a one-time cost, then cached upstream).
 */

import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  Scene,
  Vector3,
  WebGLRenderTarget,
  type Group,
  type WebGLRenderer,
} from 'three';
import { buildAnimalModel } from './models/builders';
import { SPECIES, THUMBNAIL, type SpeciesId } from '../utils/constants';

/** Free a one-shot model's geometries + materials (built fresh per thumbnail). */
function disposeModel(model: Group): void {
  model.traverse((o) => {
    const m = o as Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as MeshStandardMaterial | MeshStandardMaterial[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}

/** Build the per-species RTT render function (the `renderOne` for SpeciesThumbnails). One render →
 *  one dataURL; the caller (SpeciesThumbnails) caches it. */
export function createThumbnailRenderer(renderer: WebGLRenderer): (species: SpeciesId) => string {
  const S = THUMBNAIL.size;
  const target = new WebGLRenderTarget(S, S);
  const scene = new Scene();
  scene.background = new Color(THUMBNAIL.background);
  scene.add(new AmbientLight(0xffffff, THUMBNAIL.light.ambient));
  const key = new DirectionalLight(0xffffff, THUMBNAIL.light.key);
  key.position.set(THUMBNAIL.light.keyPos.x, THUMBNAIL.light.keyPos.y, THUMBNAIL.light.keyPos.z);
  scene.add(key);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
  const pixels = new Uint8Array(S * S * 4);
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(S, S);
  const box = new Box3();
  const center = new Vector3();
  const sizeV = new Vector3();

  return (species: SpeciesId): string => {
    const model = buildAnimalModel(SPECIES[species]);
    // ⚠️ flip depthTest back on so the model self-occludes (the entity flatMat ships it false).
    model.traverse((o) => {
      const mat = (o as Mesh).material as MeshStandardMaterial | undefined;
      if (mat && 'depthTest' in mat) mat.depthTest = true;
    });
    scene.add(model);

    // Frame the model: an iso-ish view fitting its bounds with a little margin.
    box.setFromObject(model);
    box.getCenter(center);
    const r = (box.getSize(sizeV).length() / 2) * THUMBNAIL.margin;
    camera.left = -r;
    camera.right = r;
    camera.top = r;
    camera.bottom = -r;
    camera.position.set(center.x + r, center.y + r, center.z + r);
    camera.lookAt(center);
    camera.updateProjectionMatrix();

    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(target, 0, 0, S, S, pixels);
    renderer.setRenderTarget(prev); // ⚠️ restore the live render target — the main scene is untouched

    scene.remove(model);
    disposeModel(model);

    // Blit into the 2D canvas, flipping Y (WebGL reads bottom-up).
    const data = image.data;
    const row = S * 4;
    for (let y = 0; y < S; y++) {
      data.set(pixels.subarray((S - 1 - y) * row, (S - y) * row), y * row);
    }
    ctx.putImageData(image, 0, 0);
    return canvas.toDataURL();
  };
}
