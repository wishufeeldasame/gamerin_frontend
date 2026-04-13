'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { User, ChevronLeft, AlertCircle } from 'lucide-react';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export default function FindPasswordPage() {
  const [userId, setUserId] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const handle = userId.trim();
    if (!handle) return;

    setError('');

    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/find-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          handle,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '비밀번호 찾기에 실패했습니다.');
      }

      router.push(`/reset-password?handle=${encodeURIComponent(handle)}`);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : '비밀번호 찾기에 실패했습니다.'
      );
    }
  };

  return (
    <div className="flex min-h-screen bg-white font-sans text-black">
      <div className="hidden md:flex flex-[0_0_45%] items-center justify-center p-12 bg-gray-50/50 border-r border-gray-100">
        <div className="relative w-80 h-80 flex items-center justify-center">
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

      <div className="flex-1 flex flex-col justify-center p-8 lg:p-16 xl:p-24 relative">
        <Link
          href="/login"
          className="absolute top-10 left-10 flex items-center gap-2.5 text-zinc-600 hover:text-black transition-colors font-semibold group"
        >
          <div className="p-1.5 rounded-full border border-zinc-200 group-hover:border-black transition-colors">
            <ChevronLeft size={18} />
          </div>
          <span className="text-[15px]">로그인 페이지로 돌아가기</span>
        </Link>

        <div className="w-full max-w-[420px] mx-auto space-y-12 pt-16 md:pt-0">
          <div className="space-y-4">
            <h1 className="text-4xl font-black text-black tracking-tighter">
              비밀번호 찾기
            </h1>
            <p className="text-[16px] text-zinc-600 leading-relaxed font-medium">
              가입하신 아이디를 입력해 주세요.<br />
              본인 확인 후 비밀번호를 재설정할 수 있습니다.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-black transition-colors">
                  <User size={20} />
                </div>
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => {
                    setUserId(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="아이디 입력"
                  className={`w-full h-14 rounded-2xl border bg-white px-14 text-black font-semibold outline-none transition-all placeholder:text-zinc-400 placeholder:font-medium text-[15px] ${
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
              disabled={!userId.trim()}
              className="w-full h-14 bg-black text-white rounded-full font-black text-[16px] hover:bg-zinc-800 transition-all active:scale-[0.98] disabled:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-400 disabled:border disabled:border-zinc-200"
            >
              다음 단계로
            </button>
          </form>

          <div className="pt-10 border-t border-zinc-100 text-center">
            <p className="text-[15px] text-zinc-600 font-medium">
              아이디를 잊으셨나요?{' '}
              <Link
                href="/find-id"
                className="ml-1.5 font-black text-black hover:underline underline-offset-4"
              >
                아이디 찾기
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
