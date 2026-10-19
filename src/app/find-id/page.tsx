'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, AlertCircle } from 'lucide-react';
import { AuthPageShell } from '@/app/auth/_components/AuthPageShell';
import { AuthTextField } from '@/app/auth/_components/AuthTextField';
import { getApiBaseUrl } from '@/lib/api-base';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
      const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/find-id`, {
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
      const createdAt = data?.data?.createdAt ?? "";


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
    <AuthPageShell
      title="아이디 찾기"
      description={
        <>
          가입하신 이메일을 입력해 주세요.
          <br />
          등록된 정보로 아이디를 검색합니다.
        </>
      }
      back={{ href: '/login', label: '로그인 페이지로 돌아가기' }}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <AuthTextField
            type="email"
            value={email}
            onChange={handleInputChange}
            placeholder="이메일 입력"
            icon={<Search size={20} />}
            invalid={errorType !== 'none'}
            highlightIconOnError
          />

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
    </AuthPageShell>
  );
}
