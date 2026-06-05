import { describe, expect, it } from 'vitest';
import { hasScrollableOverflow, scrollVerdict } from '../ScrollProbe';

/**
 * The probe's VALUE is the on-device readout — jsdom has no layout engine, so it
 * cannot produce the real clientHeight/scrollHeight that decide this (that's the
 * whole point: we read them on Craig's phone). These tests only pin the pure
 * VERDICT logic that interprets whatever heights the device reports.
 */
describe('ScrollProbe — the scroll verdict logic', () => {
  it('scrollHeight > clientHeight => there IS overflow to scroll', () => {
    expect(hasScrollableOverflow(760, 812)).toBe(true);
    expect(scrollVerdict(760, 812)).toContain('HAS overflow');
  });

  it('scrollHeight == clientHeight => NO overflow (the body grew to content — the bug)', () => {
    expect(hasScrollableOverflow(812, 812)).toBe(false);
    const v = scrollVerdict(812, 812);
    expect(v).toContain('NO overflow');
    expect(v).toContain('THE BUG');
  });

  it('a body shorter than its content (the healthy case) reports overflow', () => {
    // e.g. a 600px viewport with 900px of content.
    expect(hasScrollableOverflow(600, 900)).toBe(true);
  });
});
