/**
 * A transient on-screen banner for boundary events (mission complete / biome
 * unlock) — the player-facing feedback the missions pipeline was missing. Reuses
 * the existing fade-notice pattern (a single element, opacity-faded over a
 * timer), but main-owned, with a QUEUE so a completion + its unlock both land
 * (shown back to back rather than clobbering each other). READS nothing from the
 * sim; main pushes messages + ticks the fade. DOM lives here in the rendering
 * layer, never in src/game/.
 */

import { BANNER } from '../utils/constants';
import { clamp } from '../utils/math';
import type { BannerKind } from './missionBanners';

interface QueuedBanner {
  text: string;
  kind: BannerKind;
  sec: number;
}

export class Banner {
  private readonly el: HTMLDivElement;
  private readonly queue: QueuedBanner[] = [];
  private remaining = 0;

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'hud-banner';
    this.el.style.opacity = '0';
    this.el.style.display = 'none';
    container.appendChild(this.el);
  }

  /** Queue a banner to show (mission toast / unlock banner). */
  enqueue(text: string, kind: BannerKind): void {
    this.queue.push({ text, kind, sec: kind === 'unlock' ? BANNER.unlockSec : BANNER.missionSec });
  }

  /** Advance the banner clock by `dt` seconds: hold the current message, fade it
   *  out at the tail, then show the next queued one. */
  tick(dt: number): void {
    if (this.remaining <= 0) {
      const next = this.queue.shift();
      if (!next) {
        if (this.el.style.display !== 'none') {
          this.el.style.opacity = '0';
          this.el.style.display = 'none';
        }
        return;
      }
      this.el.textContent = next.text;
      this.el.className = `hud-banner banner-${next.kind}`;
      this.el.style.display = 'block';
      this.remaining = next.sec;
    }

    this.remaining -= dt;
    // Full opacity, fading out over the last BANNER.fadeSec.
    this.el.style.opacity = String(clamp(this.remaining / BANNER.fadeSec, 0, 1));
    if (this.remaining <= 0 && this.queue.length === 0) {
      this.el.style.display = 'none';
    }
  }

  /** Whether a banner is currently visible (for tests / coordination). */
  get visible(): boolean {
    return this.el.style.display !== 'none';
  }

  /** The current banner text (for tests). */
  get text(): string {
    return this.el.textContent ?? '';
  }
}
