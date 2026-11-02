import { describe, expect, it } from 'vitest';
import { toSignupConsentPayload } from '../SignupConsent';

describe('toSignupConsentPayload', () => {
  it('각 동의 값을 서로 다른 요청 필드로 옮기고 약관 버전을 싣는다', () => {
    expect(toSignupConsentPayload({ age: true, terms: false, privacy: true })).toEqual({
      agreedToTerms: false,
      agreedToPrivacy: true,
      agreedToAge14: true,
      termsVersion: '1.0',
      privacyVersion: '1.0',
    });
    expect(toSignupConsentPayload({ age: false, terms: true, privacy: false })).toMatchObject({
      agreedToTerms: true,
      agreedToPrivacy: false,
      agreedToAge14: false,
    });
  });
});
