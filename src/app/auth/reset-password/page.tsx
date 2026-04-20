'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Lock,
  Eye,
  EyeOff,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

const PASSWORD_RULE =
  /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,20}$/;

async function readErrorMessage(response: Response, fallback: string) {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const data = await response.json().catch(() => null);
    return data?.message || data?.error || fallback;
  }

  const text = await response.text().catch(() => '');
  return text.trim() || fallback;
}

export default function ResetPasswordPage() {
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
  const isPasswordValid = PASSWORD_RULE.test(newPassword);
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

    if (!isPasswordValid) {
      setError('비밀번호는 8~20자이며 영문, 숫자, 특수문자를 모두 포함해야 합니다.');
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
      const response = await fetch(`${API_BASE}/api/v1/auth/reset-password`, {
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

      logout();
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
      <div className="flex min-h-screen items-center justify-center bg-white p-6 font-sans text-black">
        <div className="w-full max-w-md space-y-6 rounded-[2rem] border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-black shadow-xl">
            <AlertCircle size={32} className="text-white" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tighter text-black">
              유효하지 않은 링크입니다
            </h1>
            <p className="text-[15px] font-medium leading-relaxed text-zinc-600">
              비밀번호 재설정 토큰이 없습니다. 다시 재설정 링크를 요청해 주세요.
            </p>
          </div>
          <Link
            href="/auth/forgot-password"
            className="flex h-14 w-full items-center justify-center rounded-full bg-black text-[16px] font-black text-white transition-all hover:bg-zinc-800 active:scale-[0.98]"
          >
            비밀번호 찾기로 이동
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-white font-sans text-black">
      <div className="hidden border-r border-gray-100 bg-gray-50/50 p-12 md:flex md:flex-[0_0_45%] md:items-center md:justify-center">
        <div className="relative flex h-80 w-80 items-center justify-center">
          <Image
            src="/logo.png"
            alt="GamerIN Logo"
            width={600}
            height={600}
            className="object-contain drop-shadow-2xl"
            priority
          />
        </div>
      </div>

      <div className="relative flex flex-1 flex-col justify-center p-8 lg:p-16 xl:p-24">
        <Link
          href="/auth/forgot-password"
          className="group absolute left-10 top-10 flex items-center gap-2.5 font-semibold text-zinc-600 transition-colors hover:text-black"
        >
          <div className="rounded-full border border-zinc-200 p-1.5 transition-colors group-hover:border-black">
            <ChevronLeft size={18} />
          </div>
          <span className="text-[15px]">이전으로 돌아가기</span>
        </Link>

        <div className="mx-auto w-full max-w-[420px] space-y-12 pt-16 md:pt-0">
          <div className="space-y-4">
            <h1 className="text-4xl font-black tracking-tighter text-black">
              비밀번호 재설정
            </h1>
            <p className="text-[16px] font-medium leading-relaxed text-zinc-600">
              새로운 비밀번호를 입력해 주세요.
              <br />
              영문, 숫자, 특수문자를 포함한 8~20자로 설정해야 합니다.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1">
              <div className="relative">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400">
                  <Lock size={20} />
                </div>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="새 비밀번호"
                  className={`w-full h-14 rounded-2xl border bg-white px-14 text-black font-semibold outline-none transition-all placeholder:text-zinc-400 ${
                    newPassword && !isPasswordValid
                      ? 'border-red-500 ring-1 ring-red-500'
                      : 'border-zinc-200 focus:border-black'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black"
                >
                  {showPw ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {newPassword && !isPasswordValid && (
                <p className="ml-2 text-xs font-bold text-red-500">
                  8~20자, 영문/숫자/특수문자를 모두 포함해야 합니다.
                </p>
              )}
            </div>

            <div className="space-y-1">
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (error) setError('');
                }}
                placeholder="새 비밀번호 확인"
                className={`w-full h-14 rounded-2xl border bg-white px-14 text-black font-semibold outline-none transition-all placeholder:text-zinc-400 ${
                  confirmPassword && !isMatch
                    ? 'border-red-500 ring-1 ring-red-500'
                    : 'border-zinc-200 focus:border-black'
                }`}
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
        </div>
      </div>
    </div>
  );
}
