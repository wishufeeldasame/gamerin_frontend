import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

interface AuthPageShellProps {
  title: string;
  description: ReactNode;
  /** 제목 위에 놓는 아이콘(원형 배지 안). */
  icon?: ReactNode;
  /** 있으면 좌상단에 뒤로가기 링크를 둔다. 링크를 피하도록 모바일 상단 여백도 함께 준다. */
  back?: { href: string; label: string };
  children: ReactNode;
}

const titleClassName = 'text-display text-fg-primary';
const descriptionClassName = 'text-body text-fg-secondary';

// 좌측 로고 패널과 우측 폼 영역으로 나뉜 인증 화면의 공통 레이아웃.
export function AuthPageShell({ title, description, icon, back, children }: AuthPageShellProps) {
  return (
    <div className="flex min-h-dvh bg-surface font-sans text-fg-primary">
      <div className="hidden border-r border-line bg-canvas p-10 md:flex md:flex-[0_0_45%] md:items-center md:justify-center">
        <div className="flex w-full max-w-80 flex-col items-center gap-6 text-center">
          <Image
            src="/logo.png"
            alt="GamerIN Logo"
            width={224}
            height={224}
            className="h-auto w-full max-w-56 object-contain"
            priority
          />
          <div className="space-y-2">
            <p className="text-display text-fg-primary">GamerIN</p>
            <p className="text-body text-fg-secondary">실력 인증부터 멘토링까지, 게이머들의 이력서이자 커뮤니티</p>
          </div>
        </div>
      </div>

      <div
        className="flex min-w-0 flex-1 flex-col px-5 py-8 sm:px-8 lg:p-16"
      >
        {back ? (
          <Link
            href={back.href}
            className="mb-8 inline-flex min-h-11 w-fit items-center gap-2 rounded-control text-label text-fg-secondary transition-colors hover:text-fg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-line-focus"
          >
            <ChevronLeft size={18} aria-hidden="true" />
            <span>{back.label}</span>
          </Link>
        ) : null}

        <div
          className="mx-auto my-auto w-full max-w-[400px] space-y-6"
        >
          <div className="space-y-4">
            <Image src="/logo.png" alt="" width={96} height={96} className="h-24 w-24 object-contain md:hidden" priority />
            {icon ? (
              <>
                <div aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-subtle text-fg-brand">
                  {icon}
                </div>
                <div className="space-y-2">
                  <h1 className={titleClassName}>{title}</h1>
                  <p className={descriptionClassName}>{description}</p>
                </div>
              </>
            ) : (
              <>
                <h1 className={titleClassName}>{title}</h1>
                <p className={descriptionClassName}>{description}</p>
              </>
            )}
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
