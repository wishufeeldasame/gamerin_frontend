import { describe, expect, it } from 'vitest';
import { isBlockedAccountResponse } from '../auth-session-policy';

describe('isBlockedAccountResponse', () => {
  it.each([
    [401, '사용자 계정이 활성 상태가 아닙니다.'],
    [403, '활성 상태 계정이 아닙니다.'],
    [423, '정지된 계정입니다.'],
  ])('%s %s는 차단 계정이다', (status, message) => {
    expect(isBlockedAccountResponse(status, { message })).toBe(true);
  });

  it.each([
    [401, '만료된 리프레시 토큰입니다.'],
    [401, '사용자를 찾을 수 없습니다.'],
    [403, '권한이 없습니다.'],
    [500, '활성 상태 계정이 아닙니다.'],
  ])('%s %s는 차단 계정이 아니다', (status, message) => {
    expect(isBlockedAccountResponse(status, { message })).toBe(false);
  });

  it('차단 코드나 상태는 HTTP 상태와 관계없이 차단 계정이다', () => {
    expect(isBlockedAccountResponse(401, { code: 'ACCOUNT_SUSPENDED' })).toBe(true);
    expect(isBlockedAccountResponse(200, { data: { status: 'BANNED' } })).toBe(true);
  });
});
