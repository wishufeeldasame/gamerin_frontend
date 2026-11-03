import type { ReactNode } from 'react';
import Link from 'next/link';

// 비로그인 상태에서도 열려야 해서 (app) 인증 가드 밖에 둔다.
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-background px-4 py-8 font-sans text-black sm:px-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <nav aria-label="약관 문서" className="flex flex-wrap items-center gap-4 text-sm font-bold text-zinc-500">
          <Link href="/" className="font-black text-black">
            GamerIN
          </Link>
          <Link href="/terms" className="hover:underline">
            이용약관
          </Link>
          <Link href="/privacy" className="hover:underline">
            개인정보 처리방침
          </Link>
        </nav>
        <article className="space-y-8 text-base leading-7 text-zinc-700">{children}</article>
      </div>
    </main>
  );
}
