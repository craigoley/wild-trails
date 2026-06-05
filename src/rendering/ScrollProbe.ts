/**
 * Runtime SCROLL PROBE (debug instrumentation, Plan #7/#16/#28 follow-up) — NOT a
 * fix. The journal/mission touch-scroll has survived two CSS fixes; rather than a
 * third guess, this reads the ACTUAL computed runtime values of the scroll chain
 * LIVE on the device and renders them in a fixed readout, so the real cause is
 * legible on Craig's phone (where there's no console).
 *
 * The decisive line is the VERDICT: scrollBody.scrollHeight > clientHeight ?
 *   "HAS overflow to scroll"  (so it's a touch-action / momentum / iOS issue)
 * : "NO overflow — body sized to content"  (the height cap isn't reaching the body
 *   — a different cause than #28 assumed).
 *
 * Gated entirely on ?debug=1: inert (no element shown, no polling) in normal play.
 * Renders as a FIXED overlay (NOT inside the panel) so the readout can't depend on
 * the broken scroll. Inline-styled — touches NO stylesheet (this PR changes no CSS).
 */

import { isDebugEnabled } from './HUD';

/** Does the scroll body have content taller than its viewport (so it CAN scroll)? */
export function hasScrollableOverflow(clientHeight: number, scrollHeight: number): boolean {
  return scrollHeight > clientHeight;
}

/** The human-readable verdict for the readout. */
export function scrollVerdict(clientHeight: number, scrollHeight: number): string {
  return hasScrollableOverflow(clientHeight, scrollHeight)
    ? `HAS overflow to scroll (scroll ${scrollHeight} > client ${clientHeight}) — gesture/iOS issue`
    : `NO overflow — body sized to content (client == scroll == ${clientHeight}) — THE BUG: cap not reaching the body`;
}

/** The panels the probe watches, by overlay/panel/scroll-body class. */
const PANELS = [
  { name: 'journal', overlay: '.journal-overlay', panel: '.journal-panel', scroll: '.journal-scroll' },
  { name: 'mission', overlay: '.mission-overlay', panel: '.mission-panel', scroll: '.mission-scroll' },
] as const;

export class ScrollProbe {
  private readonly el: HTMLPreElement;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(container: HTMLElement) {
    this.el = document.createElement('pre');
    // Inline styles only — no stylesheet touched. Fixed at the top, above
    // everything, click-through so it never blocks the panel underneath.
    Object.assign(this.el.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      right: '0',
      maxHeight: '62vh',
      margin: '0',
      padding: '6px 8px',
      zIndex: '99999',
      background: 'rgba(0,0,0,0.82)',
      color: '#7dff9b',
      font: '9px/1.35 ui-monospace, Menlo, monospace',
      whiteSpace: 'pre-wrap',
      pointerEvents: 'none',
      display: 'none',
    } satisfies Partial<CSSStyleDeclaration>);
    container.appendChild(this.el);

    if (!isDebugEnabled()) return; // inert in normal play — no polling, hidden
    this.timer = setInterval(() => this.update(), 200);
  }

  private update(): void {
    const open = this.openPanel();
    if (!open) {
      this.el.style.display = 'none';
      return;
    }
    this.el.textContent = this.readChain(open.name, open.panel, open.scroll);
    this.el.style.display = 'block';
  }

  /** The first panel whose overlay is actually displayed, with its scroll body. */
  private openPanel(): { name: string; panel: HTMLElement; scroll: HTMLElement } | null {
    for (const p of PANELS) {
      const overlay = document.querySelector<HTMLElement>(p.overlay);
      if (!overlay || getComputedStyle(overlay).display === 'none') continue;
      const panel = document.querySelector<HTMLElement>(p.panel);
      const scroll = document.querySelector<HTMLElement>(p.scroll);
      if (panel && scroll) return { name: p.name, panel, scroll };
    }
    return null;
  }

  private readChain(name: string, panel: HTMLElement, scroll: HTMLElement): string {
    const vv = window.visualViewport;
    const ps = getComputedStyle(panel);
    const bs = getComputedStyle(scroll);

    const lines = [
      `[scroll probe · ${name}]`,
      `viewport: innerH=${window.innerHeight}  visualH=${vv ? Math.round(vv.height) : 'n/a'}`,
      `panel: maxH(resolved)=${ps.maxHeight}  client=${panel.clientHeight}  scroll=${panel.scrollHeight}` +
        `  offset=${panel.offsetHeight}  disp=${ps.display}/${ps.flexDirection}  minH=${ps.minHeight}  ov=${ps.overflow}`,
      `body:  client=${scroll.clientHeight}  scroll=${scroll.scrollHeight}  ovY=${bs.overflowY}` +
        `  minH=${bs.minHeight}  flex=${bs.flexGrow}/${bs.flexShrink}/${bs.flexBasis}  h=${bs.height}  maxH=${bs.maxHeight}` +
        `  ta=${bs.touchAction}  wos=${(bs as unknown as Record<string, string>).webkitOverflowScrolling ?? '-'}`,
      `VERDICT: ${scrollVerdict(scroll.clientHeight, scroll.scrollHeight)}`,
      `ancestors (scroll-body → body):`,
    ];

    let node: HTMLElement | null = scroll;
    let guard = 0;
    while (node && guard++ < 12) {
      const s = getComputedStyle(node);
      const tag = node === document.body ? 'body' : node.id ? `#${node.id}` : `.${node.className.split(' ')[0] || node.tagName.toLowerCase()}`;
      lines.push(
        ` ${tag}: ov=${s.overflow}  ta=${s.touchAction}  pos=${s.position}` +
          `  h=${s.height}  minH=${s.minHeight}  client=${node.clientHeight}  tf=${s.transform === 'none' ? 'none' : 'set'}`,
      );
      if (node === document.body) break;
      node = node.parentElement;
    }
    return lines.join('\n');
  }

  /** Stop polling (not used in play, but keeps the probe self-contained). */
  dispose(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }
}
