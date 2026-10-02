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

async function readErrorMessage(response: Response, fallback: string) {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const data = await response.json().catch(() => null);
    return data?.message || data?.error || fallback;
  }

  const text = await response.text().catch(() => '');
  return text.trim() || fallback;
}

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
      router.replace('/login');
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
          await readErrorMessage(
            response,
            '비밀번호 변경에 실패했습니다.'
          )
        );
      }

      logout({ redirectTo: null });
      setIsSuccess(true);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : '비밀번호 변경에 실패했습니다.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-6">
        <div className="w-full max-w-sm text-center space-y-6 animate-in fade-in zoom-in-95">
          <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center mx-auto shadow-xl">
            <CheckCircle2 size={40} className="text-white" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-black tracking-tighter">
              비밀번호 변경 완료
            </h1>
            <p className="text-zinc-500 font-medium">
              새로운 비밀번호로 다시 로그인해 주세요
            </p>
          </div>
          <button
            onClick={() => router.replace('/login')}
            className="w-full h-14 bg-black text-white rounded-full font-black text-[16px] hover:bg-zinc-800 transition-all"
          >
            로그인하러 가기
          </button>
        </div>
      </div>
    );
  }

  if (isTokenMissing) {
    return (
      <AuthStatusCard
        icon={<AlertCircle size={32} className="text-white" />}
        title="유효하지 않은 링크입니다"
        description="비밀번호 재설정 토큰이 없습니다. 다시 재설정 링크를 요청해 주세요."
      >
        <Link
          href="/auth/forgot-password"
          className="flex h-14 w-full items-center justify-center rounded-full bg-black text-[16px] font-black text-white transition-all hover:bg-zinc-800 active:scale-[0.98]"
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
          <AuthTextField
            variant="reset"
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
                className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black"
              >
                {showPw ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            }
          />
          {newPassword && passwordError && (
            <p className="ml-2 text-xs font-bold text-red-500">{passwordError}</p>
          )}
        </div>

        <div className="space-y-1">
          <AuthTextField
            variant="reset"
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
              className={`text-xs font-bold ml-2 pt-1 ${
                isMatch ? 'text-green-600' : 'text-red-500'
              }`}
            >
              {isMatch
                ? '새 비밀번호가 일치합니다.'
                : '새 비밀번호가 일치하지 않습니다.'}
            </p>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-1.5 px-2 text-red-500">
            <AlertCircle size={14} />
            <span className="text-sm font-bold">{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={!isPasswordValid || !isMatch || isSubmitting}
          className="mt-4 w-full h-14 bg-black text-white rounded-full font-black text-[16px] hover:bg-zinc-800 transition-all active:scale-[0.98] disabled:bg-zinc-100 disabled:text-zinc-400 disabled:cursor-not-allowed"
        >
          {isSubmitting ? '변경 중...' : '비밀번호 변경하기'}
        </button>
      </form>
    </AuthPageShell>
  );
}

function ResetPasswordPageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-6 font-sans text-black">
      <p className="text-sm font-black uppercase tracking-widest text-zinc-400">
        Reset Password Loading...
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
