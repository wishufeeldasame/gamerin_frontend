'use client';

import { useId, useState } from 'react';
import { AdminDialog } from '../../_components/AdminDialog';

type RestoreContentButtonProps = {
  contentPreview: string;
  onRestore: () => Promise<void>;
  disabled?: boolean;
};

export function RestoreContentButton({
  contentPreview,
  onRestore,
  disabled = false,
}: RestoreContentButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  const closeDialog = () => {
    if (isSubmitting) return;
    setSubmitError(null);
    setIsOpen(false);
  };

  const handleRestore = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await onRestore();
      setIsOpen(false);
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : '콘텐츠를 복구하지 못했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        title={disabled ? '콘텐츠 복구 기능을 사용할 수 없습니다.' : undefined}
        onClick={() => {
          setSubmitError(null);
          setIsOpen(true);
        }}
        className="inline-flex rounded-2xl border border-[#d0d5dd] bg-white px-[13px] py-[7px] text-xs font-semibold text-[#344054] transition hover:border-[#98a2b3] hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:border-[#e4e7ec] disabled:bg-[#f2f4f7] disabled:text-[#98a2b3]"
      >
        복구
      </button>

      <AdminDialog
        isOpen={isOpen}
        titleId={titleId}
        descriptionId={descriptionId}
        onClose={closeDialog}
        maxWidthClassName="max-w-[448px]"
      >
        <h2 id={titleId} className="text-xl leading-[30px] font-bold text-[#172033]">
          콘텐츠를 복구하시겠습니까?
        </h2>
        <p id={descriptionId} className="mt-1.5 text-[13px] leading-[19.5px] text-[#667085]">
          복구하면 사용자에게 다시 표시됩니다.
        </p>
        <p className="mt-4 break-all rounded-2xl bg-[#f9fafb] p-3 text-[13px] text-[#344054]">
          {contentPreview}
        </p>

        {submitError ? (
          <p className="mt-4 rounded-xl border border-[#fecdca] bg-[#fef3f2] px-3 py-2 text-xs text-[#b42318]" role="alert">
            {submitError}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={closeDialog}
            disabled={isSubmitting}
            className="h-10 rounded-2xl border border-[#d0d5dd] bg-white px-[17px] text-sm font-semibold text-[#344054] hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-60"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => void handleRestore()}
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            className="h-10 rounded-2xl bg-[#315ef5] px-4 text-sm font-semibold text-white hover:bg-[#294fd5] disabled:cursor-wait disabled:opacity-60"
          >
            {isSubmitting ? '복구 중...' : '콘텐츠 복구'}
          </button>
        </div>
      </AdminDialog>
    </>
  );
}
