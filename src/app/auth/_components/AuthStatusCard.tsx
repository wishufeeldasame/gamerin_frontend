import type { ReactNode } from 'react';

interface AuthStatusCardProps {
  icon: ReactNode;
  title: string;
  description: ReactNode;
  /** 카드 아래에 놓는 동작(버튼·링크). */
  children: ReactNode;
}

// 화면 가운데에 놓는 상태 안내 카드(성공·유효하지 않은 링크 등).
export function AuthStatusCard({ icon, title, description, children }: AuthStatusCardProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-6 font-sans text-black">
      <div className="w-full max-w-md space-y-6 rounded-[2rem] border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-black shadow-xl">
          {icon}
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-tighter text-black">{title}</h1>
          <p className="text-[15px] font-medium leading-relaxed text-zinc-600">{description}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
