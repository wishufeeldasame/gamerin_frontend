'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearLoginReturnTo, readLoginReturnTo } from '@/lib/login-prompt';
import { useAuth } from '@/app/context/AuthContext';
import { completeOAuthSession } from '@/lib/auth-api';
import { AuthStatusCard } from '@/app/auth/_components/AuthStatusCard';
import { AlertCircle, LoaderCircle } from 'lucide-react';

export default function OAuthSuccessPage() {
    const router = useRouter();
    const { login } = useAuth();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        let redirectTimer: ReturnType<typeof setTimeout> | undefined;

        const finishLogin = async () => {
            try {
                const user = await completeOAuthSession();
                if (cancelled) return;

                login(user);
                const returnTo = readLoginReturnTo();
      clearLoginReturnTo();
      router.replace(returnTo);
            } catch (err) {
                if (cancelled) return;
                // 실패한 세션 정리는 completeOAuthSession이 한다. 사용자 전환·로그아웃(AbortError)이면 화면을 바꾸지 않는다.
                if (err instanceof DOMException && err.name === 'AbortError') return;
                setError(err instanceof Error ? err.message : '로그인 처리 중 오류가 발생했습니다.');
                redirectTimer = setTimeout(() => {
                    router.replace('/?login=1');
                }, 3000);
            }
        };

        void finishLogin();

        return () => {
            cancelled = true;
            if (redirectTimer !== undefined) {
                clearTimeout(redirectTimer);
            }
        };
    }, [login, router]);

    return (
        <AuthStatusCard
            icon={error ? <AlertCircle size={28} /> : <LoaderCircle size={28} className="animate-spin motion-reduce:animate-none" />}
            title={error ? '오류 발생' : '로그인 처리 중'}
            description={error ?? '안전하게 로그인 세션을 설정하고 있습니다. 잠시만 기다려 주세요...'}
        >
            <p role={error ? 'alert' : 'status'} className="text-label text-fg-secondary">
                {error ? '잠시 후 로그인 창으로 이동합니다...' : '로그인 확인 중...'}
            </p>
        </AuthStatusCard>
    );
}
