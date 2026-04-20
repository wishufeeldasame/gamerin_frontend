'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ChevronLeft, AlertCircle, CheckCircle2, User } from 'lucide-react';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
const SUCCESS_MESSAGE =
  '입력한 정보가 유효하면 비밀번호 재설정 메일을 발송했습니다.';
const SUBMIT_ERROR_MESSAGE =
  '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [handle, setHandle] = useState('');
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedHandle = handle.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!normalizedHandle || isSubmitting || isSuccess) return;

    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/find-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          handle: normalizedHandle,
        }),
      });

      if (!response.ok) {
        throw new Error(SUBMIT_ERROR_MESSAGE);
      }

      setIsSuccess(true);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : SUBMIT_ERROR_MESSAGE
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-6 font-sans text-black">
        <div className="w-full max-w-md space-y-6 rounded-[2rem] border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-black shadow-xl">
            <CheckCircle2 size={32} className="text-white" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tighter text-black">
              메일을 확인해 주세요
            </h1>
            <p className="text-[15px] font-medium leading-relaxed text-zinc-600">
              {SUCCESS_MESSAGE}
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.replace('/login')}
            className="h-14 w-full rounded-full bg-black text-[16px] font-black text-white transition-all hover:bg-zinc-800 active:scale-[0.98]"
          >
            로그인하러 가기
          </button>
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
          href="/login"
          className="group absolute left-10 top-10 flex items-center gap-2.5 font-semibold text-zinc-600 transition-colors hover:text-black"
        >
          <div className="rounded-full border border-zinc-200 p-1.5 transition-colors group-hover:border-black">
            <ChevronLeft size={18} />
          </div>
          <span className="text-[15px]">로그인 페이지로 돌아가기</span>
        </Link>

        <div className="mx-auto w-full max-w-[420px] space-y-12 pt-16 md:pt-0">
          <div className="space-y-4">
            <h1 className="text-4xl font-black tracking-tighter text-black">
              비밀번호 찾기
            </h1>
            <p className="text-[16px] font-medium leading-relaxed text-zinc-600">
              가입하신 아이디를 입력해 주세요.
              <br />
              재설정 링크를 이메일로 안내해 드립니다.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <div className="group relative">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-black transition-colors">
                  <User size={20} />
                </div>
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => {
                    setHandle(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="아이디 입력"
                  className={`h-14 w-full rounded-2xl border bg-white px-14 text-[15px] font-semibold text-black outline-none transition-all placeholder:font-medium placeholder:text-zinc-400 ${
                    error
                      ? 'border-red-500 ring-1 ring-red-500'
                      : 'border-zinc-200 focus:border-black focus:ring-1 focus:ring-black'
                  }`}
                />
              </div>

              {error && (
                <div className="flex items-center gap-1.5 px-2 text-red-500">
                  <AlertCircle size={14} />
                  <span className="text-sm font-bold">{error}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!normalizedHandle || isSubmitting}
              className="h-14 w-full rounded-full bg-black text-[16px] font-black text-white transition-all hover:bg-zinc-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
            >
              {isSubmitting ? '전송 중...' : '비밀번호 재설정 메일 받기'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
