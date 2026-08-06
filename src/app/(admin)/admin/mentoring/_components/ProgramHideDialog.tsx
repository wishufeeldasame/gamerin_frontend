'use client';

import { FormEvent, useState } from 'react';

type ProgramHideDialogProps = {
  programTitle: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
};

export function ProgramHideDialog({
  programTitle,
  onCancel,
  onConfirm,
}: ProgramHideDialogProps) {
  const [reason, setReason] = useState('');
  const [showError, setShowError] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedReason = reason.trim();

    if (!trimmedReason) {
      setShowError(true);
      return;
    }

    onConfirm(trimmedReason);
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(16,24,40,0.5)] p-5"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="program-hide-title"
        aria-describedby="program-hide-description"
        className="w-full max-w-[448px] rounded-2xl bg-[#fff] p-6 shadow-[0_25px_25px_rgba(0,0,0,0.25)]"
      >
        <h2
          id="program-hide-title"
          className="text-xl leading-[30px] font-bold tracking-[-0.3px] text-[#172033]"
        >
          프로그램을 숨김 처리하시겠습니까?
        </h2>
        <p
          id="program-hide-description"
          className="mt-1.5 text-[13px] leading-[19.5px] text-[#667085]"
        >
          숨김 처리하면 사용자에게 노출되지 않습니다. 숨김 사유는 작업 이력에 기록됩니다.
        </p>

        <div className="mt-4 rounded-2xl bg-[#f9fafb] p-3 text-[13px] leading-[19.5px] text-[#344054]">
          {programTitle}
        </div>

        <form onSubmit={submit} noValidate>
          <label className="mt-4 block">
            <span className="block pb-1.5 text-[13px] leading-[19.5px] font-semibold text-[#344054]">
              숨김 사유 <span className="text-[#d92d20]">*</span>
            </span>
            <textarea
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                if (showError && event.target.value.trim()) setShowError(false);
              }}
              placeholder="처리 근거를 입력해주세요."
              aria-invalid={showError}
              aria-describedby={showError ? 'program-hide-reason-error' : undefined}
              autoFocus
              className={`h-[89px] w-full resize-none rounded-2xl bg-[#fff] p-[13px] text-sm leading-[21px] text-[#172033] outline-none transition placeholder:text-[rgba(23,32,51,0.5)] ${
                showError
                  ? 'border border-[#f04438] focus:ring-2 focus:ring-[#f04438]/10'
                  : 'border border-[#d0d5dd] focus:border-[#315ef5] focus:ring-2 focus:ring-[#315ef5]/10'
              }`}
            />
          </label>
          {showError ? (
            <p
              id="program-hide-reason-error"
              className="mt-1 text-xs leading-[18px] text-[#f04438]"
            >
              숨김 사유는 필수입니다.
            </p>
          ) : null}

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="h-10 rounded-2xl border border-[#d0d5dd] bg-[#fff] px-[17px] text-sm leading-[21px] font-semibold text-[#344054] transition hover:bg-[#f9fafb]"
            >
              취소
            </button>
            <button
              type="submit"
              className="h-10 rounded-2xl bg-[#d92d20] px-4 text-sm leading-[21px] font-semibold text-white transition hover:bg-[#b42318]"
            >
              숨김 처리
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
