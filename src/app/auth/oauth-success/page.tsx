'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { completeOAuthSession } from '@/lib/auth-api';

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
                router.replace('/home');
            } catch (err) {
                if (cancelled) return;
                // 실패한 세션 정리는 completeOAuthSession이 한다. 사용자 전환·로그아웃(AbortError)이면 화면을 바꾸지 않는다.
                if (err instanceof DOMException && err.name === 'AbortError') return;
                setError(err instanceof Error ? err.message : '로그인 처리 중 오류가 발생했습니다.');
                redirectTimer = setTimeout(() => {
                    router.replace('/login');
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
        <div className="flex min-h-screen flex-col items-center justify-center bg-white font-sans text-black">
            <div className="flex flex-col items-center space-y-4">
                {error ? (
                    <>
                        <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-xl">!</div>
                        <h1 className="text-xl font-bold">오류 발생</h1>
                        <p className="text-zinc-600">{error}</p>
                        <p className="text-zinc-400 text-sm">잠시 후 로그인 페이지로 이동합니다...</p>
                    </>
                ) : (
                    <>
                        <div className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-200 border-t-black" />
                        <h1 className="text-xl font-bold">로그인 처리 중</h1>
                        <p className="text-zinc-500">안전하게 로그인 세션을 설정하고 있습니다. 잠시만
                            기다려주세요...</p>
                    </>
                )}
            </div>
        </div>
    );
}