'use client';

import { AdminDialog } from '../../_components/AdminDialog';

type MentorApprovalDialogProps = {
  applicantName: string;
  isSubmitting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function MentorApprovalDialog({ applicantName, isSubmitting, error, onCancel, onConfirm }: MentorApprovalDialogProps) {
  return (
    <AdminDialog isOpen titleId="mentor-approval-title" descriptionId="mentor-approval-description" onClose={onCancel} maxWidthClassName="max-w-[448px]">
      <h2 id="mentor-approval-title" className="text-xl font-bold text-[#172033]">멘토 신청을 승인하시겠습니까?</h2>
      <p id="mentor-approval-description" className="mt-1.5 text-[13px] leading-5 text-[#667085]">승인하면 멘토 프로필이 활성 상태로 변경됩니다.</p>
      <div className="mt-4 rounded-2xl bg-[#f9fafb] p-3 text-[13px] text-[#344054]">{applicantName}</div>
      {error ? <p role="alert" className="mt-3 text-sm text-[#b42318]">{error}</p> : null}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" disabled={isSubmitting} onClick={onCancel} className="h-10 rounded-2xl border border-[#d0d5dd] px-4 text-sm font-semibold text-[#344054] disabled:cursor-not-allowed">취소</button>
        <button type="button" autoFocus disabled={isSubmitting} onClick={onConfirm} className="h-10 rounded-2xl bg-[#315ef5] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#98a2b3]">{isSubmitting ? '처리 중…' : '승인 확인'}</button>
      </div>
    </AdminDialog>
  );
}
