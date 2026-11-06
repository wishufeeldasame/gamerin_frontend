import { describe, expect, it } from 'vitest';
import { formatViewCount } from '@/lib/view-count';

describe('formatViewCount', () => {
  it.each([
    [0, '0'],
    [7, '7'],
    [999, '999'],
    [1_000, '1,000'],
    [9_999, '9,999'],
    [10_000, '1만'],
    [12_000, '1.2만'],
    [12_999, '1.2만'],
    [57_000, '5.7만'],
    [99_999, '9.9만'],
    [100_000, '10만'],
    [123_456, '12만'],
    [9_999_999, '999만'],
    [99_999_999, '9999만'],
    [100_000_000, '1억'],
    [150_000_000, '1.5억'],
    [1_234_567_890, '12억'],
  ])('%d → %s', (count, label) => {
    expect(formatViewCount(count)).toBe(label);
  });
});
