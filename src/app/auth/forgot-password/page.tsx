'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, User } from 'lucide-react';
import { AuthPageShell } from '@/app/auth/_components/AuthPageShell';
import { AuthStatusCard } from '@/app/auth/_components/AuthStatusCard';
import { AuthTextField } from '@/app/auth/_components/AuthTextField';
import { getApiBaseUrl } from '@/lib/api-base';

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
      const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/find-password`, {
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
      <AuthStatusCard
        icon={<CheckCircle2 size={32} className="text-white" />}
        title="메일을 확인해 주세요"
        description={SUCCESS_MESSAGE}
      >
        <button
          type="button"
          onClick={() => router.replace('/login')}
          className="h-14 w-full rounded-full bg-black text-[16px] font-black text-white transition-all hover:bg-zinc-800 active:scale-[0.98]"
        >
          로그인하러 가기
        </button>
      </AuthStatusCard>
    );
  }

  return (
    <AuthPageShell
      title="비밀번호 찾기"
      description={
        <>
          가입하신 아이디를 입력해 주세요.
          <br />
          재설정 링크를 이메일로 안내해 드립니다.
        </>
      }
      back={{ href: '/login', label: '로그인 페이지로 돌아가기' }}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <AuthTextField
            type="text"
            value={handle}
            onChange={(e) => {
              setHandle(e.target.value);
              if (error) setError('');
            }}
            placeholder="아이디 입력"
            icon={<User size={20} />}
            invalid={Boolean(error)}
          />

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
    </AuthPageShell>
  );
}
