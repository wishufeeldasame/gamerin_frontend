'use client';

import { CircleAlert, CircleCheck } from 'lucide-react';
import { useEffect, useState } from 'react';

type AdminToastProps = {
  variant: 'success' | 'error';
  title: string;
  description?: string;
  onDismiss: () => void;
  duration?: number;
};

export function AdminToast({
  variant,
  title,
  description,
  onDismiss,
  duration = 3000,
}: AdminToastProps) {
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const leavingTimer = window.setTimeout(() => setIsLeaving(true), duration);
    const removeTimer = window.setTimeout(onDismiss, duration + 300);

    return () => {
      window.clearTimeout(leavingTimer);
      window.clearTimeout(removeTimer);
    };
  }, [duration, onDismiss]);

  const Icon = variant === 'success' ? CircleCheck : CircleAlert;
  const palette =
    variant === 'success'
      ? 'border-[#003d1c] bg-[#001f0f] text-[#59f3a6]'
      : 'border-[#7a271a] bg-[#3b120e] text-[#fda29b]';

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live="polite"
      className={`pointer-events-none fixed top-4 right-4 left-4 z-[70] flex max-w-[380px] items-start gap-2 rounded-xl border p-4 shadow-[0_4px_12px_rgba(0,0,0,0.16)] transition-all duration-300 ease-in sm:top-6 sm:right-6 sm:left-auto sm:w-[356px] ${palette} ${
        isLeaving ? '-translate-y-28 opacity-0' : 'translate-y-0 opacity-100'
      }`}
    >
      <Icon className="mt-0.5 size-5 shrink-0" strokeWidth={2.2} aria-hidden="true" />
      <div className="min-w-0 text-[13px]">
        <p className="leading-[19.5px] font-semibold">{title}</p>
        {description ? <p className="mt-0.5 leading-[18.2px]">{description}</p> : null}
      </div>
    </div>
  );
}
