'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { completeSocialSignup } from '@/lib/auth-api';
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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    setSignupToken(params.get('signupToken'));
  }, []);

  const handleSubmit = async () => {
    const trimmedHandle = handle.trim();
    const trimmedNickname = nickname.trim();

    if (!signupToken) {
      setError('소셜 회원가입 토큰이 없습니다. 다시 로그인해주세요.');
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
      login(await completeSocialSignup({ signupToken, handle: trimmedHandle, nickname: trimmedNickname }));
      router.replace('/home');
    } catch (err) {
      // 가입 도중 로그아웃·사용자 전환이 있었으면 그 요청의 결과는 버린다.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : '소셜 회원가입에 실패했습니다.');
    } finally {
      setLoading(false);
    }
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

      <div className="flex flex-1 flex-col justify-center p-8 lg:p-16 xl:p-24">
        <div className="mx-auto w-full max-w-[420px] space-y-8">
          <div className="space-y-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black text-white shadow-lg">
              <CheckCircle2 size={28} />
            </div>
            <div className="space-y-2">
              <h1 className="text-4xl font-black tracking-tighter">추가 정보 입력</h1>
              <p className="text-[16px] font-medium leading-relaxed text-zinc-600">
                소셜 회원가입을 완료하기 위해 사용할 아이디와 닉네임을 입력해주세요.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <input
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
              className="h-14 w-full rounded-2xl border border-zinc-200 bg-white px-5 text-[15px] font-semibold text-black outline-none transition-all placeholder:font-medium placeholder:text-zinc-400 focus:border-black focus:ring-1 focus:ring-black"
            />

            <input
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
              className="h-14 w-full rounded-2xl border border-zinc-200 bg-white px-5 text-[15px] font-semibold text-black outline-none transition-all placeholder:font-medium placeholder:text-zinc-400 focus:border-black focus:ring-1 focus:ring-black"
            />

            {error && (
              <div className="flex items-center gap-1.5 px-2 text-red-500">
                <AlertCircle size={14} />
                <span className="text-sm font-bold">{error}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="h-14 w-full rounded-full bg-black text-[16px] font-black text-white transition-all hover:bg-zinc-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
            >
              {loading ? '처리 중...' : '회원가입 완료'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
