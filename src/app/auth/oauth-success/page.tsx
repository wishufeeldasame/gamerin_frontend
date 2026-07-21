'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { setAccessToken } from '@/lib/auth-store';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export default function OAuthSuccessPage() {
    const router = useRouter();
    const { login } = useAuth();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const fetchTokens = async () => {
            try {
                // 1. HttpOnly refresh_token 쿠키를 사용하여 새로운 accessToken 요청
                const response = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
                    method: 'POST',
                    credentials: 'include',
                });

                if (!response.ok) {
                    throw new Error('인증 세션 생성에 실패했습니다.');
                }

                const body = await response.json();
                const nextToken = body?.data?.accessToken;
                if (!nextToken) {
                    throw new Error('액세스 토큰을 받아오지 못했습니다.');
                }

                if (cancelled) return;

                // 2. 받아온 access token을 브라우저 메모리에 저장
                setAccessToken(nextToken);

                // 3. 내 사용자 정보 가져오기
                const meResponse = await fetch(`${API_BASE}/api/v1/auth/me`, {
                    headers: {
                        Authorization: `Bearer ${nextToken}`,
                    },
                    credentials: 'include',
                });

                if (!meResponse.ok) {
                    throw new Error('사용자 정보를 가져올 수 없습니다.');
                }

                const meBody = await meResponse.json();
                const meData = meBody?.data;

                if (!meData) {
                    throw new Error('사용자 데이터가 비어 있습니다.');
                }

                // 4. 로그인 상태 세션 업데이트
                login({
                    id: String(meData.userId),
                    name: meData.nickname ?? meData.handle,
                    nickname: meData.nickname,
                    handle: meData.handle,
                    gameTier: 'Unranked',
                    bio: '',
                });

                // 5. 홈 화면 진입
                router.replace('/home');
            } catch (err) {
                if (cancelled) return;
                console.error(err);
                setError(err instanceof Error ? err.message : '로그인 처리 중 오류가 발생했습니다.');
                setTimeout(() => {
                    router.replace('/login');
                }, 3000);
            }
        };

        void fetchTokens();

        return () => {
            cancelled = true;
        };
    }, [login, router]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-white font-
  sans text-black">
            <div className="flex flex-col items-center space-y-4">
                {error ? (
                    <>
                        <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-
  center text-red-600 font-bold text-xl">!</div>
                        <h1 className="text-xl font-bold">오류 발생</h1>
                        <p className="text-zinc-600">{error}</p>
                        <p className="text-zinc-400 text-sm">잠시 후 로그인 페이지로 이동합니다...</p>
                    </>
                ) : (
                    <>
                        <div className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-200
  border-t-black" />
                        <h1 className="text-xl font-bold">로그인 처리 중</h1>
                        <p className="text-zinc-500">안전하게 로그인 세션을 설정하고 있습니다. 잠시만
                            기다려주세요...</p>
                    </>
                )}
            </div>
        </div>
    );
}