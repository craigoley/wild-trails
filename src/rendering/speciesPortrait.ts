/**
 * §HUD catch-target (i) — the portrait PRIMITIVE shared by the research/mission panels (and, in slice
 * ii, the play-screen chip). Two halves:
 *
 *  - `SpeciesThumbnails`: a per-species CACHE. `renderOne` is called ONCE per species (memoised), lazily
 *    on first `get`. The render fn is INJECTED so the GL render-to-texture is swappable — main passes the
 *    real RTT (thumbnailRenderer.ts); a test passes a fake (no WebGL in jsdom). No per-frame work: the
 *    panels call `get` on refresh (when opened), never the frame loop.
 *
 *  - `speciesThumbHtml`: the portrait markup. A cached thumbnail dataURL → a background-image span; no
 *    thumbnail (no GL / not yet rendered) → the colour+gait SWATCH fallback (the JournalPanel.card-swatch
 *    pattern). So the portraits read SOMETHING everywhere (the swatch), enriched by the RTT on device.
 */

import { SPECIES, type SpeciesId } from '../utils/constants';

export class SpeciesThumbnails {
  private readonly cache = new Map<SpeciesId, string>();
  /** `renderOne` produces the thumbnail dataURL for a species (the RTT). Injected for testability. */
  private readonly renderOne: (species: SpeciesId) => string;
  constructor(renderOne: (species: SpeciesId) => string) {
    this.renderOne = renderOne;
  }

  /** The cached thumbnail dataURL — renders ONCE per species (lazily), then a pure cache hit. */
  get(species: SpeciesId): string {
    let url = this.cache.get(species);
    if (url === undefined) {
      url = this.renderOne(species);
      this.cache.set(species, url);
    }
    return url;
  }
}

/**
 * The portrait `<span>` markup for a species. `url` = a cached thumbnail dataURL → shown as a
 * background image; `null` → the SWATCH fallback (the species colour + a gait class). Always renders a
 * recognisable token, so the panels work with or without the GL thumbnail. Escapes nothing — the inputs
 * are our own constants (a species' displayName), not user text.
 */
export function speciesThumbHtml(species: SpeciesId, url: string | null): string {
  const def = SPECIES[species];
  if (url) {
    return `<span class="species-thumb" role="img" aria-label="${def.displayName}" style="background-image:url('${url}')"></span>`;
  }
  const color = '#' + def.color.toString(16).padStart(6, '0');
  return `<span class="species-thumb species-thumb--swatch species-gait-${def.gait}" role="img" aria-label="${def.displayName}" style="background:${color}"></span>`;
}
