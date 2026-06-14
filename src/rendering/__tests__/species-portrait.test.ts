// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { SpeciesThumbnails, speciesThumbHtml } from '../speciesPortrait';
import { MissionPanel } from '../MissionPanel';
import { SPECIES } from '../../utils/constants';
import { createJournal } from '../../state/Journal';

/**
 * §HUD catch-target (i) — the portrait primitive. ⚠️ The thumbnail CACHE pins "render ONCE per species,
 * then a cache hit" (no per-frame render — the GL RTT is one-time + lazy). The MARKUP pins the thumbnail-
 * vs-swatch fallback. The panel pins the portrait appears in a row. The actual GL render is device-
 * validated (no WebGL in jsdom → the panels use the swatch path here). The LOOK is Craig's gate.
 */

describe('SpeciesThumbnails — ⚠️ renders ONCE per species (cached, no per-frame render)', () => {
  it('renderOne is called once per species; repeat gets are pure cache hits', () => {
    const renderOne = vi.fn((s: string) => `data:thumb/${s}`);
    const thumbs = new SpeciesThumbnails(renderOne);

    expect(thumbs.get('hedgehog')).toBe('data:thumb/hedgehog');
    expect(thumbs.get('hedgehog')).toBe('data:thumb/hedgehog'); // again
    expect(thumbs.get('hedgehog')).toBe('data:thumb/hedgehog'); // again
    expect(renderOne).toHaveBeenCalledTimes(1); // ⚠️ rendered ONCE — never re-rendered

    thumbs.get('rabbit');
    expect(renderOne).toHaveBeenCalledTimes(2); // a new species → one more render, cached thereafter
  });
});

describe('speciesThumbHtml — the rendered thumbnail OR the colour+gait swatch fallback', () => {
  it('a dataURL → a background-image portrait', () => {
    const html = speciesThumbHtml('hedgehog', 'data:image/png;base64,XYZ');
    expect(html).toContain('species-thumb');
    expect(html).toContain("background-image:url('data:image/png;base64,XYZ')");
    expect(html).not.toContain('swatch');
  });

  it('null → the SWATCH fallback (the species colour + a gait class)', () => {
    const html = speciesThumbHtml('hedgehog', null);
    expect(html).toContain('species-thumb--swatch');
    expect(html).toContain(`species-gait-${SPECIES.hedgehog.gait}`); // the gait token
    expect(html.toLowerCase()).toContain('#' + SPECIES.hedgehog.color.toString(16).padStart(6, '0')); // the colour
  });

  it('always labels the portrait with the species name (a11y)', () => {
    expect(speciesThumbHtml('hedgehog', null)).toContain(`aria-label="${SPECIES.hedgehog.displayName}"`);
  });
});

describe('MissionPanel — the rows carry a species portrait (the picture beside the text)', () => {
  it('each mission row shows a .species-thumb (swatch path, no GL) plus the unchanged title/progress', () => {
    const panel = new MissionPanel(document.body);
    panel.refresh(createJournal(), { offered: 0, started: 0, progressed: 0, completed: 0, rewardsClaimed: 0 }, false);
    const row = document.querySelector('.mission-row');
    expect(row).not.toBeNull();
    expect(row!.querySelector('.species-thumb')).not.toBeNull(); // the portrait is present
    expect(row!.querySelector('.mission-title')).not.toBeNull(); // the text still there (additive)
    expect(row!.querySelector('.mission-prog')).not.toBeNull();
    document.body.innerHTML = '';
  });
});
