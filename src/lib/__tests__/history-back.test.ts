import { afterEach, describe, expect, it } from 'vitest';
import { canGoBack } from '@/lib/history-back';

const setNavigation = (value: unknown) => {
  Object.defineProperty(window, 'navigation', { value, configurable: true });
};

describe('canGoBack', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'navigation');
  });

  it('Navigation API가 있으면 history.length가 아니라 canGoBack을 따른다', () => {
    window.history.pushState(null, '', '/posts/1');
    expect(window.history.length).toBeGreaterThan(1);

    setNavigation({ canGoBack: false });
    expect(canGoBack()).toBe(false);

    setNavigation({ canGoBack: true });
    expect(canGoBack()).toBe(true);
  });

  it('Navigation API가 없으면 history.length로 판단한다', () => {
    setNavigation(undefined);
    expect(canGoBack()).toBe(window.history.length > 1);
  });
});
