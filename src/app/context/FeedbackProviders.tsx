'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { ConfirmProvider } from './ConfirmContext';
import { ToastProvider } from './ToastContext';

export function FeedbackProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <ConfirmProvider scopeKey={pathname}>
      <ToastProvider>{children}</ToastProvider>
    </ConfirmProvider>
  );
}
