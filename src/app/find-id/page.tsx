'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Search, ChevronLeft, AlertCircle } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/api-base';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const API_BASE = getApiBaseUrl();

export default function FindIdPage() {
  const [email, setEmail] = useState('');
  const [errorType, setErrorType] = useState<'none' | 'invalid' | 'notFound'>('none');
  const router = useRouter();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorType('none');

    const normalizedEmail = email.trim();

    if (!emailRegex.test(email.trim())) {
      setErrorType('invalid');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/find-id`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
        }),
      });
    
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "아이디 찾기에 실패했습니다.");
      }

      // 백엔드 응답에서 필요한 데이터(maskedHandle, createdAt) 추출
      const maskedHandle = data?.data?.maskedHandle ?? "";
      const createdAt = data?.data?.createdAt ?? data?.data?.created_at ?? "";


      // 결과 페이지로 이동하면서 두 데이터를 쿼리 파라미터로 전달
      router.push(
        `/find-id-result?maskedHandle=${encodeURIComponent(maskedHandle)}&createdAt=${encodeURIComponent(createdAt)}`
      );
    } catch {
      setErrorType("notFound");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (errorType !== 'none') setErrorType('none');
  };

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
            <h1 className="text-4xl font-black tracking-tighter text-black">아이디 찾기</h1>
            <p className="text-[16px] font-medium leading-relaxed text-zinc-600">
              가입하신 이메일을 입력해 주세요.
              <br />
              등록된 정보로 아이디를 검색합니다.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <div className="group relative">
                <div
                  className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors ${
                    errorType !== 'none'
                      ? 'text-red-500'
                      : 'text-zinc-400 group-focus-within:text-black'
                  }`}
                >
                  <Search size={20} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={handleInputChange}
                  placeholder="이메일 입력"
                  className={`h-14 w-full rounded-2xl border bg-white px-14 text-[15px] font-semibold text-black outline-none transition-all placeholder:font-medium placeholder:text-zinc-400 ${
                    errorType !== 'none'
                      ? 'border-red-500 ring-1 ring-red-500'
                      : 'border-zinc-200 focus:border-black focus:ring-1 focus:ring-black'
                  }`}
                />
              </div>

              {errorType === 'invalid' && (
                <div className="animate-in slide-in-from-top-1 fade-in flex items-center gap-1.5 px-2 text-red-500">
                  <AlertCircle size={14} />
                  <span className="text-sm font-bold">올바른 이메일 형식을 입력해 주세요.</span>
                </div>
              )}
              {errorType === 'notFound' && (
                <div className="animate-in slide-in-from-top-1 fade-in flex items-center gap-1.5 px-2 text-red-500">
                  <AlertCircle size={14} />
                  <span className="text-sm font-bold">일치하는 정보가 없습니다. 다시 확인해 주세요.</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!email.trim()}
              className="h-14 w-full rounded-full bg-black text-[16px] font-black text-white transition-all active:scale-[0.98] hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
            >
              아이디 찾기
            </button>
          </form>

          <div className="border-t border-zinc-100 pt-10 text-center">
            <p className="text-[15px] font-medium text-zinc-600">
              비밀번호를 잊으셨나요?{' '}
              <Link
                href="/auth/forgot-password"
                className="ml-1.5 font-black text-black underline-offset-4 hover:underline"
              >
                비밀번호 찾기
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
