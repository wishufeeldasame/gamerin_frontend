'use client';

import { useEffect, type ReactNode } from 'react';

type AdminDialogProps = {
  isOpen: boolean;
  titleId: string;
  descriptionId?: string;
  onClose: () => void;
  children: ReactNode;
  maxWidthClassName?: string;
};

export function AdminDialog({
  isOpen,
  titleId,
  descriptionId,
  onClose,
  children,
  maxWidthClassName = 'max-w-[512px]',
}: AdminDialogProps) {
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(16,24,40,0.5)] p-4 sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={`max-h-[calc(100dvh-32px)] w-full overflow-y-auto rounded-2xl bg-white p-5 shadow-[0_25px_25px_rgba(0,0,0,0.25)] sm:p-6 ${maxWidthClassName}`}
      >
        {children}
      </section>
    </div>
  );
}
