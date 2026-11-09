'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { AuthPageShell } from '@/app/auth/_components/AuthPageShell';
import { AuthStatusCard } from '@/app/auth/_components/AuthStatusCard';
import { AuthTextField } from '@/app/auth/_components/AuthTextField';
import { useAuth } from '@/app/context/AuthContext';
import { getApiBaseUrl } from '@/lib/api-base';
import { PASSWORD_MAX_LENGTH, validatePassword } from '@/lib/auth-validation';
import {
  getPublicRequestErrorMessage,
  readPublicResponseErrorMessage,
} from '@/lib/public-request-error';

function ResetPasswordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { logout } = useAuth();

  const resetToken = searchParams.get('token')?.trim() ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isTokenMissing = !resetToken;
  const passwordError = validatePassword(newPassword);
  const isPasswordValid = !passwordError;
  const isMatch = confirmPassword.length > 0 && newPassword === confirmPassword;

  useEffect(() => {
    if (!isSuccess) return;

    const timeoutId = window.setTimeout(() => {
      router.replace('/?login=1');
    }, 1200);

    return () => window.clearTimeout(timeoutId);
  }, [isSuccess, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isTokenMissing) {
      setError('비밀번호 재설정 링크가 유효하지 않습니다. 다시 요청해 주세요.');
      return;
    }

    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (!isMatch) {
      setError('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    if (isSubmitting || isSuccess) return;

    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resetToken,
          newPassword,
          newPasswordConfirm: confirmPassword,
        }),
      });

      if (!response.ok) {
        throw new Error(
          await readPublicResponseErrorMessage(
            response,
            '비밀번호 변경에 실패했습니다.'
          )
        );
      }

      logout({ redirectTo: null });
      setIsSuccess(true);
    } catch (error) {
      setError(getPublicRequestErrorMessage(error, '비밀번호 변경에 실패했습니다.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <AuthStatusCard
        icon={<CheckCircle2 size={28} />}
        title="비밀번호 변경 완료"
        description="새로운 비밀번호로 다시 로그인해 주세요"
      >
          <button
            onClick={() => router.replace('/?login=1')}
            className="btn-primary h-12 w-full"
          >
            로그인하러 가기
          </button>
      </AuthStatusCard>
    );
  }

  if (isTokenMissing) {
    return (
      <AuthStatusCard
        icon={<AlertCircle size={32} aria-hidden="true" />}
        title="유효하지 않은 링크입니다"
        description="비밀번호 재설정 토큰이 없습니다. 다시 재설정 링크를 요청해 주세요."
      >
        <Link
          href="/auth/forgot-password"
          className="btn-primary h-12 w-full"
        >
          비밀번호 찾기로 이동
        </Link>
      </AuthStatusCard>
    );
  }

  return (
    <AuthPageShell
      title="비밀번호 재설정"
      description={
        <>
          새로운 비밀번호를 입력해 주세요.
          <br />
          영문, 숫자, 특수문자를 포함한 8~20자로 설정해야 합니다.
        </>
      }
      back={{ href: '/auth/forgot-password', label: '이전으로 돌아가기' }}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1">
          <label htmlFor="reset-password" className="mb-2 block text-label text-fg-primary">새 비밀번호</label>
          <AuthTextField
            id="reset-password"
            autoComplete="new-password"
            aria-describedby={newPassword && passwordError ? 'reset-password-error' : undefined}
            type={showPw ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              if (error) setError('');
            }}
            placeholder="새 비밀번호"
            maxLength={PASSWORD_MAX_LENGTH}
            icon={<Lock size={20} />}
            invalid={Boolean(newPassword) && !isPasswordValid}
            endAdornment={
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 표시'}
                aria-pressed={showPw}
                className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-control text-icon-secondary hover:text-fg-primary focus-visible:outline-2 focus-visible:outline-line-focus"
              >
                {showPw ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            }
          />
          {newPassword && passwordError && (
            <p id="reset-password-error" className="ml-2 text-caption text-fg-danger">{passwordError}</p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="reset-password-confirm" className="mb-2 block text-label text-fg-primary">새 비밀번호 확인</label>
          <AuthTextField
            id="reset-password-confirm"
            autoComplete="new-password"
            aria-describedby={confirmPassword ? 'reset-password-match' : undefined}
            type="password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (error) setError('');
            }}
            placeholder="새 비밀번호 확인"
            maxLength={PASSWORD_MAX_LENGTH}
            invalid={Boolean(confirmPassword) && !isMatch}
          />
          {confirmPassword.length > 0 && (
            <p
              id="reset-password-match"
              className={`text-caption ml-2 pt-1 ${
                isMatch ? 'text-fg-secondary' : 'text-fg-danger'
              }`}
            >
              {isMatch
                ? '새 비밀번호가 일치합니다.'
                : '새 비밀번호가 일치하지 않습니다.'}
            </p>
          )}
        </div>

        {error && (
          <div role="alert" className="flex items-start gap-1.5 text-fg-danger">
            <AlertCircle size={14} />
            <span className="text-label">{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={!isPasswordValid || !isMatch || isSubmitting}
          className="btn-primary h-12 w-full"
        >
          {isSubmitting ? '변경 중...' : '비밀번호 변경하기'}
        </button>
      </form>
    </AuthPageShell>
  );
}

function ResetPasswordPageFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas p-6 text-fg-secondary">
      <p role="status" className="text-body">
        비밀번호 재설정 화면을 불러오는 중...
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordPageFallback />}>
      <ResetPasswordPageContent />
    </Suspense>
  );
}
