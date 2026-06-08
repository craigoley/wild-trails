/**
 * HUD glyphs — a SINGLE consistent inline-SVG icon set for the top-right toggle
 * cluster, replacing the mixed-weight OS emoji (the "inconsistent icons" HUD
 * problem: some emoji render colour, some grey, all differently per device). These
 * are monochrome line glyphs drawn in `currentColor` at a uniform 2px stroke, so
 * the whole cluster reads as ONE visual language and looks identical everywhere.
 * Zero-asset (inline markup, no files); sized by CSS (.action-btn svg).
 */

const SVG = (inner: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

/** Field Journal — a closed book with a spine. */
export const ICON_JOURNAL = SVG('<rect x="5" y="3.5" width="13.5" height="17" rx="1.6"/><path d="M9 3.5v17"/>');

/** Missions — a pennant flag on a pole. */
export const ICON_MISSIONS = SVG('<path d="M6.5 21V3.5"/><path d="M6.5 4h11l-2.6 3.6L17.5 11h-11"/>');

/** Research — an Erlenmeyer flask with a liquid line. */
export const ICON_RESEARCH = SVG(
  '<path d="M9 3.5h6"/><path d="M10 3.5v5.4L5.3 16.2A2 2 0 0 0 7 19.2h10a2 2 0 0 0 1.7-3L14 8.9V3.5"/><path d="M8.4 14h7.2"/>',
);

/** Bait — a feed dish (shallow bowl) with scattered feed above it. Not a worm, not
 *  fishing-specific: "food you set out to lure animals". The dots are filled. */
export const ICON_BAIT = SVG(
  '<path d="M3.5 12.5a8.5 5 0 0 0 17 0"/>' +
    '<circle cx="9" cy="7.5" r="1.15" fill="currentColor" stroke="none"/>' +
    '<circle cx="12.5" cy="6.4" r="1.15" fill="currentColor" stroke="none"/>' +
    '<circle cx="15.6" cy="8" r="1.15" fill="currentColor" stroke="none"/>',
);

/** Audio on — a speaker with two sound arcs. */
export const ICON_SPEAKER = SVG(
  '<path d="M4 9v6h3.5L13 19V5L7.5 9H4z"/><path d="M16.5 9.5a3.5 3.5 0 0 1 0 5"/><path d="M19 7a7 7 0 0 1 0 10"/>',
);

/** Audio muted — the same speaker with an ✕ where the arcs were. */
export const ICON_SPEAKER_MUTED = SVG(
  '<path d="M4 9v6h3.5L13 19V5L7.5 9H4z"/><path d="M17 9.5l5 5"/><path d="M22 9.5l-5 5"/>',
);
