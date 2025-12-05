import { describe, expect, it } from 'vitest';
import { colorForLabel, formatLabel } from './overlayAdapters';

describe('overlayAdapters helpers', () => {
  it('formats labels with percentages', () => {
    expect(formatLabel('HSIL', 0.923)).toBe('HSIL 92%');
    expect(formatLabel('Normal', null)).toBe('Normal');
  });

  it('returns fallback color when label unknown', () => {
    expect(colorForLabel('SCC')).toBe('#B22222');
    expect(colorForLabel(undefined, '#123456')).toBe('#123456');
  });
});
