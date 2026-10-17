import { afterEach, describe, expect, it } from 'vitest';
import { isMobileBrowser } from '../payment-device';
import { readPaymentReturnTo, rememberPaymentReturnTo, safeReturnTo } from '../payment-return';

describe('safeReturnTo', () => {
  it.each(['/mentoring', '/mentoring?programId=p1', '/membership', '/wallet?tab=payments'])('허용 경로 %s', (value) => {
    expect(safeReturnTo(value)).toBe(value);
  });

  it.each([null, '', 'mentoring', '//evil.test', '/\\evil.test', 'https://evil.test/mentoring', '/home', '/mentoringx'])(
    '그 밖의 값 %j는 무시한다',
    (value) => {
      expect(safeReturnTo(value)).toBeNull();
    },
  );
});

describe('결제 복귀 경로 저장', () => {
  afterEach(() => window.sessionStorage.clear());

  it('같은 주문일 때만 허용 경로를 돌려준다', () => {
    rememberPaymentReturnTo('o1', '/mentoring?tab=mine');
    expect(readPaymentReturnTo('o1')).toBe('/mentoring?tab=mine');
    expect(readPaymentReturnTo('o2')).toBeNull();

    window.sessionStorage.setItem('gamerin_payment_return_to', JSON.stringify({ orderId: 'o3', returnTo: '//evil.test' }));
    expect(readPaymentReturnTo('o3')).toBeNull();
  });
});

describe('isMobileBrowser', () => {
  it('userAgentData.mobile을 우선하고 없으면 UA로 판정한다', () => {
    const nav = window.navigator as Navigator & { userAgentData?: unknown };
    Object.defineProperty(nav, 'userAgentData', { configurable: true, value: { mobile: true } });
    expect(isMobileBrowser()).toBe(true);
    Object.defineProperty(nav, 'userAgentData', { configurable: true, value: undefined });
    expect(isMobileBrowser()).toBe(/Mobi|Android|iPhone|iPad/.test(navigator.userAgent));
  });
});
