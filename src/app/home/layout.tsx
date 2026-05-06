'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { setAccessToken } from '@/lib/auth-store';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

type JwtPayload = {
  sub?: string;
  userId?: string;
  id?: string;
  handle?: string;
  nickname?: string;
  name?: string;
  gameTier?: string;
  bio?: string;
};

type MeResponse = {
  userId?: string;
  handle?: string;
  nickname?: string;
  role?: string;
  status?: string;
};

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedBase64 = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = decodeURIComponent(
      atob(paddedBase64)
        .split('')
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join('')
    );

    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

function buildUser(data: MeResponse | null, fallback: JwtPayload | null) {
  const handle = data?.handle ?? fallback?.handle ?? 'user';
  const nickname = data?.nickname ?? fallback?.nickname ?? fallback?.name ?? handle;

  return {
    id: String(data?.userId ?? fallback?.userId ?? fallback?.id ?? fallback?.sub ?? handle),
    name: nickname,
    nickname,
    handle,
    gameTier: fallback?.gameTier ?? 'Unranked',
    bio: fallback?.bio ?? '',
  };
}

async function fetchMe(accessToken: string): Promise<MeResponse | null> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: 'include',
    });

    if (!response.ok) return null;

    const body = await response.json().catch(() => null);
    return body?.data ?? null;
  } catch {
    return null;
  }
}

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isAuthReady, login } = useAuth();

  useEffect(() => {
    if (!isAuthReady) return;

    let cancelled = false;

    const syncSocialLogin = async () => {
      // window.location.hash는 "#accessToken=..." 형태입니다.
    const hash = window.location.hash.substring(1); // 맨 앞 '#' 제거
    const params = new URLSearchParams(hash); 
    const token = params.get('accessToken');

      if (token) {
        setAccessToken(token);

        const fallback = decodeJwtPayload(token);
        const me = await fetchMe(token);

        if (cancelled) return;

        login(buildUser(me, fallback));
        router.replace('/home');
        return;
      }

      if (!user) {
        router.replace('/login');
      }
    };

    syncSocialLogin();

    return () => {
      cancelled = true;
    };
  }, [isAuthReady, login, router, user]);

  if (!isAuthReady || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <div className="flex max-w-[1440px] mx-auto pt-16">
        <aside className="hidden lg:block w-64 h-[calc(100vh-4rem)] sticky top-16 border-r border-zinc-100 p-4">
          <Sidebar />
        </aside>

        <main className="flex-1 min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}
