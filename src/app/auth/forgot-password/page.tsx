'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, User } from 'lucide-react';
import { AuthPageShell } from '@/app/auth/_components/AuthPageShell';
import { AuthStatusCard } from '@/app/auth/_components/AuthStatusCard';
import { AuthTextField } from '@/app/auth/_components/AuthTextField';
import { getApiBaseUrl } from '@/lib/api-base';
import {
  getPublicRequestErrorMessage,
  readPublicResponseErrorMessage,
} from '@/lib/public-request-error';

const SUCCESS_MESSAGE =
  '입력한 정보가 유효하다면 비밀번호 재설정 메일이 발송됩니다.';
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
        throw new Error(await readPublicResponseErrorMessage(response, SUBMIT_ERROR_MESSAGE));
      }

      setIsSuccess(true);
    } catch (error) {
      setError(getPublicRequestErrorMessage(error, SUBMIT_ERROR_MESSAGE));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <AuthStatusCard
        icon={<CheckCircle2 size={32} aria-hidden="true" />}
        title="메일을 확인해 주세요"
        description={SUCCESS_MESSAGE}
      >
        <button
          type="button"
          onClick={() => router.replace('/?login=1')}
          className="btn-primary h-12 w-full"
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
      back={{ href: '/?login=1', label: '로그인 창으로 돌아가기' }}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="forgot-password-handle" className="block text-label text-fg-primary">아이디</label>
          <AuthTextField
            id="forgot-password-handle"
            autoComplete="username"
            aria-describedby={error ? 'forgot-password-error' : undefined}
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
            <div id="forgot-password-error" role="alert" className="flex items-start gap-1.5 text-fg-danger">
              <AlertCircle size={14} />
              <span className="text-label">{error}</span>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={!normalizedHandle || isSubmitting}
          className="btn-primary h-12 w-full"
        >
          {isSubmitting ? '전송 중...' : '비밀번호 재설정 메일 받기'}
        </button>
      </form>

      <div className="border-t border-line pt-6 text-center">
        <p className="text-body text-fg-secondary">
          아이디를 잊으셨나요?{' '}
          <Link href="/find-id" className="ml-1.5 text-label text-fg-brand underline-offset-4 hover:underline">
            아이디 찾기
          </Link>
        </p>
      </div>
    </AuthPageShell>
  );
}
