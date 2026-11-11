import { beforeEach, describe, expect, it } from 'vitest';
import { clearLoginReturnTo, isPublicAppPath, readLoginReturnTo, rememberLoginReturnTo, safeLoginReturnTo } from '@/lib/login-prompt';

describe('로그인 복귀 경로', () => {
  beforeEach(() => sessionStorage.clear());
  it.each(['https://evil.test/a', '//evil.test/a', '/\\evil.test', '/%2f%2fevil.test', '/auth/oauth-success#token', '/signup', '/login', '/admin/login', '/\n/evil.test'])('외부·인증 순환 경로 %s를 거부한다', (path) => {
    expect(safeLoginReturnTo(path)).toBe('/');
  });
  it('공개 상세의 쿼리와 앵커를 보존한다', () => {
    expect(safeLoginReturnTo('/posts/7?target=comments#comment-1')).toBe('/posts/7?target=comments#comment-1');
  });
  it('지갑의 별도 복귀 경로를 지우지 않는다', () => {
    const path = '/wallet?returnTo=%2Fmentoring%3FprogramId%3Dabc';
    expect(safeLoginReturnTo(path)).toBe(path);
  });
  it('결제 콜백·PG 토큰을 복귀값으로 보관해 승인을 재실행하지 않는다', () => {
    expect(safeLoginReturnTo('/payments/result?orderId=fixture&pg_token=sample')).toBe('/wallet?tab=payments');
  });
  it('과거 홈 복귀 값만 루트로 정규화한다', () => {
    expect(safeLoginReturnTo('/home?tab=following#feed')).toBe('/?tab=following#feed');
  });
  it.each(['email_not_verified', 'account_withdrawn'])('OAuth 오류 %s를 복귀값에서 제거한다', (error) => {
    expect(safeLoginReturnTo(`/?login=1&error=${error}`)).toBe('/');
  });
  it('OAuth 복귀값을 안전하게 보관하고 제거한다', () => {
    rememberLoginReturnTo('/mentoring?programId=abc');
    expect(readLoginReturnTo()).toBe('/mentoring?programId=abc');
    clearLoginReturnTo();
    expect(readLoginReturnTo()).toBe('/');
    rememberLoginReturnTo('//evil.test');
    expect(readLoginReturnTo()).toBe('/');
  });
  it.each([['/', true], ['/demo', true], ['/posts/7', true], ['/profile/player', true], ['/mentoring', true], ['/membership/content', true], ['/membership/content-preview', true], ['/membership/content-preview/private', false], ['/membership', false], ['/membership/content/private', false], ['/profile', false], ['/profile/me', false], ['/profile/%6de', false], ['/wallet', false], ['/search', false], ['/hashtags/game', false]])('공개 경로 %s = %s', (path, allowed) => {
    expect(isPublicAppPath(String(path))).toBe(allowed);
  });
});
