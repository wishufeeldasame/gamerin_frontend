'use client';

import Image from 'next/image';
import { X } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { restoreFeedbackFocus } from '@/app/context/ConfirmContext';
import { usePopup } from '@/app/context/PopupContext';
import { useToast } from '@/app/context/ToastContext';

interface PostImageProps {
  src: string;
  imageNumber: number;
  width: number;
  height: number;
  sizes?: string;
  className: string;
}

function ImagePreview({
  src, imageNumber, titleId, returnFocusTo, onClose, onUnavailable,
}: {
  src: string;
  imageNumber: number;
  titleId: string;
  returnFocusTo: HTMLButtonElement | null;
  onClose: () => void;
  onUnavailable: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    try {
      dialog.showModal();
      closeButtonRef.current?.focus();
    } catch {
      onUnavailable();
      restoreFeedbackFocus(returnFocusTo);
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
      restoreFeedbackFocus(returnFocusTo);
    };
  }, [onClose, onUnavailable, returnFocusTo]);

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClose={(event) => {
        // StrictMode can queue a close event before the same dialog is reopened.
        if (!event.currentTarget.open) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        } else if (event.key === 'Tab') {
          event.preventDefault();
          closeButtonRef.current?.focus();
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-6xl overflow-y-auto rounded-2xl border border-neutral-700 bg-neutral-950 p-4 text-white shadow-xl backdrop:bg-black/80"
    >
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 id={titleId} className="text-sm font-bold">게시물 이미지 {imageNumber} 확대</h2>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="이미지 확대 닫기"
          className="shrink-0 rounded-xl p-2 hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <X size={24} aria-hidden="true" />
        </button>
      </div>
      {failed ? (
        <p role="alert" className="py-12 text-center text-sm">이미지를 불러오지 못했습니다.</p>
      ) : (
        <Image
          src={src}
          alt={`확대된 게시물 이미지 ${imageNumber}`}
          width={1200}
          height={800}
          sizes="100vw"
          unoptimized
          onError={() => setFailed(true)}
          className="mx-auto h-auto max-h-[calc(100dvh-8rem)] w-full object-contain"
        />
      )}
    </dialog>,
    document.body,
  );
}

export function PostImage({ src, imageNumber, width, height, sizes, className }: PostImageProps) {
  const toast = useToast();
  const titleId = useId();
  const { closeAll } = usePopup(titleId);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const handleUnavailable = useCallback(() => {
    setOpen(false);
    toast.error('이미지 확대를 열 수 없습니다.');
  }, [toast]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`게시물 이미지 ${imageNumber} 확대 보기`}
        aria-haspopup="dialog"
        data-card-open-ignore="true"
        onClick={() => { closeAll(); setOpen(true); }}
        className="group pointer-events-auto relative block w-full cursor-zoom-in overflow-hidden rounded-[inherit] focus:outline-none"
      >
        <Image src={src} alt="게시물 미디어" width={width} height={height} sizes={sizes} unoptimized className={className} />
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] border-2 border-transparent group-focus-visible:border-white group-focus-visible:shadow-[inset_0_0_0_2px_black]" />
      </button>
      {open ? (
        <ImagePreview src={src} imageNumber={imageNumber} titleId={titleId} returnFocusTo={triggerRef.current} onClose={close} onUnavailable={handleUnavailable} />
      ) : null}
    </>
  );
}
