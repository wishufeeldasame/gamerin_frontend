import { describe, expect, it } from 'vitest';
import { toNumber } from '@/lib/coerce';

describe('toNumber', () => {
  it('숫자는 그대로 돌려준다', () => {
    expect(toNumber(0)).toBe(0);
    expect(toNumber(42)).toBe(42);
    expect(toNumber(-3.5)).toBe(-3.5);
  });

  it('숫자 문자열은 숫자로 변환한다', () => {
    expect(toNumber('7')).toBe(7);
    expect(toNumber('-1.25')).toBe(-1.25);
  });

  it.each([
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['-Infinity', -Infinity],
    ['undefined', undefined],
    ['빈 문자열', ''],
    ['null', null],
    ['숫자가 아닌 문자열', 'abc'],
  ])('%s는 0이 된다', (_label, value) => {
    expect(toNumber(value)).toBe(0);
  });
});
