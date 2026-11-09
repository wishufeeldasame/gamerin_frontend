'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';

/**
 * 저장된 세션을 일시 장애(refresh 409 재시도 소진·429·5xx·네트워크 오류)로 확인하지 못했을 때의 안내.
 * 세션은 유지되므로 로그인 화면으로 보내지 않고, 사용자가 직접 다시 시도하게 한다(429 한도를 자동 재시도로 소모하지 않는다).
 */
export function SessionUnavailableNotice({ loginHref }: { loginHref?: string }) {
  const { retrySessionRestore, logout } = useAuth();
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    try {
      await retrySessionRestore();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4">
      <section
        aria-labelledby="session-unavailable-title"
        className="w-full max-w-sm rounded-2xl border border-zinc-100 bg-white p-6 text-center"
      >
        <h1 id="session-unavailable-title" className="text-lg font-black text-black">
          로그인 상태를 확인하지 못했습니다
        </h1>
        <p role="alert" className="mt-2 text-sm font-medium text-zinc-500">
          일시적인 문제로 세션을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
        <button
          type="button"
          onClick={() => void handleRetry()}
          disabled={isRetrying}
          aria-busy={isRetrying}
          className="btn-primary mt-5 w-full"
        >
          {isRetrying ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
          {isRetrying ? '확인하는 중...' : '다시 시도'}
        </button>
        {loginHref ? (
        <Link
          href={loginHref}
          className="mt-3 inline-block text-sm font-bold text-zinc-500 underline underline-offset-2"
        >
          로그인 화면으로 이동
        </Link>
        ) : <button type="button" onClick={() => void logout({ redirectTo: '/?login=1' })} className="mt-3 text-sm font-bold text-zinc-500 underline underline-offset-2">다시 로그인</button>}
      </section>
    </main>
  );
}
