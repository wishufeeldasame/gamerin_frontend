'use client';

import { FormEvent, useId, useState } from 'react';
import { AdminDialog } from '../../_components/AdminDialog';

type RestoreContentButtonProps = {
  contentPreview: string;
  onRestore: (reason: string) => void;
};

export function RestoreContentButton({ contentPreview, onRestore }: RestoreContentButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const reasonId = `restore-reason-${titleId}`;
  const reasonErrorId = `restore-reason-error-${titleId}`;

  const closeDialog = () => {
    setReason('');
    setReasonError(false);
    setIsOpen(false);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reason.trim()) {
      setReasonError(true);
      return;
    }

    onRestore(reason.trim());
    closeDialog();
  };

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="inline-flex rounded-2xl border border-[#d0d5dd] bg-white px-[13px] py-[7px] text-xs font-semibold text-[#344054] transition hover:border-[#98a2b3] hover:bg-[#f9fafb]">
        복구
      </button>

      <AdminDialog isOpen={isOpen} titleId={titleId} descriptionId={descriptionId} onClose={closeDialog} maxWidthClassName="max-w-[448px]">
        <h2 id={titleId} className="text-xl leading-[30px] font-bold text-[#172033]">콘텐츠를 복구하시겠습니까?</h2>
        <p id={descriptionId} className="mt-1.5 text-[13px] leading-[19.5px] text-[#667085]">
          복구하면 사용자에게 다시 표시됩니다. 복구 사유는 작업 이력에 기록됩니다.
        </p>
        <p className="mt-4 truncate rounded-2xl bg-[#f9fafb] p-3 text-[13px] text-[#344054]">&quot;{contentPreview}&quot;</p>

        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor={reasonId} className="mt-4 mb-1.5 block text-[13px] font-semibold text-[#344054]">복구 사유 <span className="text-[#d92d20]">*</span></label>
          <textarea
            id={reasonId}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              if (event.target.value.trim()) setReasonError(false);
            }}
            aria-invalid={reasonError}
            aria-describedby={reasonError ? reasonErrorId : undefined}
            placeholder="복구 근거를 입력해주세요."
            className={`h-[89px] w-full resize-none rounded-2xl border bg-white p-[13px] text-sm text-[#172033] outline-none transition ${reasonError ? 'border-[#f04438] focus:ring-2 focus:ring-[#f04438]/10' : 'border-[#d0d5dd] focus:border-[#315ef5] focus:ring-2 focus:ring-[#315ef5]/10'}`}
          />
          {reasonError ? <p id={reasonErrorId} className="mt-1.5 text-xs text-[#f04438]" role="alert">복구 사유는 필수입니다.</p> : null}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={closeDialog} className="h-10 rounded-2xl border border-[#d0d5dd] bg-white px-[17px] text-sm font-semibold text-[#344054] hover:bg-[#f9fafb]">취소</button>
            <button type="submit" className="h-10 rounded-2xl bg-[#315ef5] px-4 text-sm font-semibold text-white hover:bg-[#294fd5]">콘텐츠 복구</button>
          </div>
        </form>
      </AdminDialog>
    </>
  );
}
