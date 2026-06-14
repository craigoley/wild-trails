import { describe, expect, it } from 'vitest';
import thumbnailSource from '../thumbnailRenderer.ts?raw';
import { THUMBNAIL } from '../../utils/constants';

/**
 * §HUD catch-target P3 — the dim-thumbnail fix. The ROOT cause was a colour-space mismatch: the live
 * scene renders sRGB, but a WebGLRenderTarget defaults to LINEAR, so readRenderTargetPixels() returned
 * the un-encoded (darker) linear pixels. The render itself needs WebGL (no GL in Node), so we pin the
 * root-cause line (so it can't silently regress) + the lifted brightness knobs (a pure constants read).
 */
describe('thumbnail P3 — sRGB readback + lifted brightness', () => {
  it('the render-target texture is marked sRGB (the linear-readback root cause)', () => {
    expect(thumbnailSource).toMatch(/target\.texture\.colorSpace\s*=\s*SRGBColorSpace/);
  });

  it('the brightness knobs are lifted above the known-too-dark baseline', () => {
    expect(THUMBNAIL.background).toBeGreaterThan(0x2a2f26); // a lighter backdrop than the dim original
    expect(THUMBNAIL.light.ambient).toBeGreaterThanOrEqual(0.7); // more fill
    expect(THUMBNAIL.light.key).toBeGreaterThanOrEqual(1.1); // more key
  });
});
