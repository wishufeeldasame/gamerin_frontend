'use client';

import { useState, type FormEvent } from 'react';
import { AdminDialog } from '../../_components/AdminDialog';

export type MentoringReasonDialogProps = {
  targetName: string;
  action: 'reject' | 'hide';
  isSubmitting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
};

export function MentoringReasonDialog({ targetName, action, isSubmitting, error, onCancel, onConfirm }: MentoringReasonDialogProps) {
  const [reason, setReason] = useState('');
  const [showError, setShowError] = useState(false);
  const label = action === 'reject' ? '반려 사유' : '숨김 사유';
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    if (!reason.trim()) { setShowError(true); return; }
    onConfirm(reason.trim());
  };

  return (
    <AdminDialog isOpen titleId="mentoring-reason-title" descriptionId="mentoring-reason-description" onClose={onCancel} maxWidthClassName="max-w-[448px]">
      <h2 id="mentoring-reason-title" className="text-xl font-bold text-[#172033]">{action === 'reject' ? '멘토 신청을 반려하시겠습니까?' : '프로그램을 숨김 처리하시겠습니까?'}</h2>
      <p id="mentoring-reason-description" className="mt-1.5 text-[13px] leading-5 text-[#667085]">{action === 'reject' ? '멘토 프로필이 비활성 상태로 변경됩니다. 반려 사유는 작업 이력에 기록됩니다.' : '사용자에게 프로그램이 노출되지 않습니다. 숨김 사유는 작업 이력에 기록됩니다.'}</p>
      <div className="mt-4 rounded-2xl bg-[#f9fafb] p-3 text-[13px] text-[#344054]">{targetName}</div>
      <form onSubmit={submit} noValidate>
        <label className="mt-4 block">
          <span className="block pb-1.5 text-[13px] font-semibold text-[#344054]">{label} <span aria-hidden="true" className="text-[#d92d20]">*</span></span>
          <textarea
            autoFocus
            required
            disabled={isSubmitting}
            value={reason}
            onChange={(event) => { setReason(event.target.value); if (event.target.value.trim()) setShowError(false); }}
            placeholder="처리 근거를 입력해주세요."
            aria-invalid={showError}
            aria-describedby={showError ? 'mentoring-reason-error' : undefined}
            className="h-[89px] w-full resize-none rounded-2xl border border-[#d0d5dd] bg-white p-3 text-sm text-[#172033] outline-none focus:border-[#315ef5] focus:ring-2 focus:ring-[#315ef5]/10 disabled:bg-[#f2f4f7]"
          />
        </label>
        {showError ? <p id="mentoring-reason-error" role="alert" className="mt-1 text-xs text-[#b42318]">{label}는 필수입니다.</p> : null}
        {error ? <p role="alert" className="mt-3 text-sm text-[#b42318]">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" disabled={isSubmitting} onClick={onCancel} className="h-10 rounded-2xl border border-[#d0d5dd] px-4 text-sm font-semibold text-[#344054] disabled:cursor-not-allowed">취소</button>
          <button type="submit" disabled={isSubmitting} className="h-10 rounded-2xl bg-[#d92d20] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#98a2b3]">{isSubmitting ? '처리 중…' : action === 'reject' ? '반려 처리' : '숨김 처리'}</button>
        </div>
      </form>
    </AdminDialog>
  );
}
