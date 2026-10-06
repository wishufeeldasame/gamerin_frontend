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

const titleClassName = 'text-4xl font-black tracking-tighter text-black';
const descriptionClassName = 'text-[16px] font-medium leading-relaxed text-zinc-600';

// 좌측 로고 패널과 우측 폼 영역으로 나뉜 인증 화면의 공통 레이아웃.
export function AuthPageShell({ title, description, icon, back, children }: AuthPageShellProps) {
  return (
    <div className="flex min-h-screen bg-white font-sans text-black">
      <div className="hidden border-r border-gray-100 bg-gray-50/50 p-12 md:flex md:flex-[0_0_45%] md:items-center md:justify-center">
        <div className="relative flex h-80 w-80 items-center justify-center">
          <Image
            src="/logo.png"
            alt="GamerIN Logo"
            width={600}
            height={600}
            className="object-contain drop-shadow-2xl"
            priority
          />
        </div>
      </div>

      <div
        className={`${back ? 'relative ' : ''}flex flex-1 flex-col justify-center p-8 lg:p-16 xl:p-24`}
      >
        {back ? (
          <Link
            href={back.href}
            className="group absolute left-10 top-10 flex items-center gap-2.5 font-semibold text-zinc-600 transition-colors hover:text-black"
          >
            <div className="rounded-full border border-zinc-200 p-1.5 transition-colors group-hover:border-black">
              <ChevronLeft size={18} />
            </div>
            <span className="text-[15px]">{back.label}</span>
          </Link>
        ) : null}

        <div
          className={`mx-auto w-full max-w-[420px] ${back ? 'space-y-12 pt-16 md:pt-0' : 'space-y-8'}`}
        >
          <div className="space-y-4">
            {icon ? (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black text-white shadow-lg">
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
