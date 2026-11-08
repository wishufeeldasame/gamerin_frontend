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
    <div className="flex min-h-dvh items-center justify-center bg-canvas p-5 font-sans text-fg-primary">
      <div className="w-full max-w-[400px] space-y-6 rounded-card border border-line-card bg-surface p-6 text-center sm:p-8">
        <div aria-hidden="true" className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-subtle text-fg-brand">
          {icon}
        </div>
        <div className="space-y-2">
          <h1 className="text-title text-fg-primary">{title}</h1>
          <p className="break-words text-body text-fg-secondary">{description}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
