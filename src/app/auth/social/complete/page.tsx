'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { AuthPageShell } from '@/app/auth/_components/AuthPageShell';
import { EMPTY_SIGNUP_CONSENT, SignupConsent, isSignupConsentComplete, toSignupConsentPayload } from '@/app/auth/_components/SignupConsent';
import { AuthTextField } from '@/app/auth/_components/AuthTextField';
import { clearLoginReturnTo, readLoginReturnTo } from '@/lib/login-prompt';
import { useAuth } from '@/app/context/AuthContext';
import { SignupCompletedError, completeSocialSignup } from '@/lib/auth-api';
import { getPublicRequestErrorMessage } from '@/lib/public-request-error';
import {
  HANDLE_MAX_LENGTH,
  NICKNAME_MAX_LENGTH,
  validateHandle,
  validateNickname,
} from '@/lib/auth-validation';

export default function SocialCompletePage() {
  const router = useRouter();
  const { login } = useAuth();

  const [signupToken, setSignupToken] = useState<string | null>(null);
  const [handle, setHandle] = useState('');
  const [nickname, setNickname] = useState('');
  const [consent, setConsent] = useState(EMPTY_SIGNUP_CONSENT);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // 가입은 끝났지만 로그인 확인에 실패한 상태. 가입 토큰이 소진돼 다시 제출할 수 없다.
  const [accountCreated, setAccountCreated] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    setSignupToken(params.get('signupToken'));
  }, []);

  const handleSubmit = async () => {
    const trimmedHandle = handle.trim();
    const trimmedNickname = nickname.trim();

    if (!signupToken) {
      setError('소셜 회원가입 토큰이 없습니다. 다시 로그인해 주세요.');
      return;
    }

    const validationError = validateHandle(trimmedHandle) ?? validateNickname(trimmedNickname);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');

    try {
      login(
        await completeSocialSignup({
          signupToken,
          handle: trimmedHandle,
          nickname: trimmedNickname,
          ...toSignupConsentPayload(consent),
        }),
      );
      const returnTo = readLoginReturnTo();
      clearLoginReturnTo();
      router.replace(returnTo);
    } catch (err) {
      // 가입 도중 로그아웃·사용자 전환이 있었으면 그 요청의 결과는 버린다.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (err instanceof SignupCompletedError) setAccountCreated(true);
      setError(getPublicRequestErrorMessage(err, '소셜 회원가입에 실패했습니다.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell
      title="추가 정보 입력"
      description="소셜 회원가입을 완료하기 위해 사용할 아이디와 닉네임을 입력해 주세요."
      icon={<CheckCircle2 size={28} />}
    >
      <div className="space-y-4">
        <label htmlFor="social-handle" className="block text-label text-fg-primary">아이디</label>
        <AuthTextField
          id="social-handle"
          value={handle}
          onChange={(event) => {
            setHandle(event.target.value);
            if (error) setError('');
          }}
          placeholder="아이디"
          type="text"
          maxLength={HANDLE_MAX_LENGTH}
          autoComplete="username"
          aria-label="아이디"
        />

        <label htmlFor="social-nickname" className="block text-label text-fg-primary">닉네임</label>
        <AuthTextField
          id="social-nickname"
          value={nickname}
          onChange={(event) => {
            setNickname(event.target.value);
            if (error) setError('');
          }}
          placeholder="닉네임"
          type="text"
          maxLength={NICKNAME_MAX_LENGTH}
          autoComplete="nickname"
          aria-label="닉네임"
        />

        <SignupConsent value={consent} onChange={setConsent} />

        {error && (
          <div role="alert" className="flex items-start gap-1.5 text-fg-danger">
            <AlertCircle size={14} />
            <span className="text-label">{error}</span>
          </div>
        )}

        {accountCreated ? (
          <Link
            href="/?login=1"
            className="btn-primary h-12 w-full"
          >
            로그인 화면으로 이동
          </Link>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !isSignupConsentComplete(consent)}
            className="btn-primary h-12 w-full"
          >
            {loading ? '처리 중...' : '회원가입 완료'}
          </button>
        )}
      </div>
    </AuthPageShell>
  );
}
