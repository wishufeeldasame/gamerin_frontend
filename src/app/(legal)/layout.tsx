import type { ReactNode } from 'react';
import Link from 'next/link';

// 비로그인 상태에서도 열려야 해서 (app) 인증 가드 밖에 둔다.
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-canvas px-4 py-8 text-fg-primary sm:px-8 sm:py-10">
      <div className="mx-auto max-w-[720px] space-y-8">
        <nav aria-label="약관 문서" className="flex flex-wrap items-center gap-5 text-label text-fg-secondary">
          <Link href="/" className="text-title text-fg-primary focus-visible:outline-2 focus-visible:outline-line-focus">
            Gamer<span className="text-fg-brand">IN</span>
          </Link>
          <Link href="/terms" className="hover:text-fg-primary focus-visible:outline-2 focus-visible:outline-line-focus">
            이용약관
          </Link>
          <Link href="/privacy" className="hover:text-fg-primary focus-visible:outline-2 focus-visible:outline-line-focus">
            개인정보 처리방침
          </Link>
        </nav>
        <article className="space-y-8 break-words text-body leading-7 text-fg-secondary">{children}</article>
      </div>
    </main>
  );
}
