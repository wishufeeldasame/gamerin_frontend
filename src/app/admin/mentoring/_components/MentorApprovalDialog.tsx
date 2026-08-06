'use client';

type MentorApprovalDialogProps = {
  applicantName: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function MentorApprovalDialog({
  applicantName,
  onCancel,
  onConfirm,
}: MentorApprovalDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(16,24,40,0.5)] p-5"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mentor-approval-title"
        aria-describedby="mentor-approval-description"
        className="w-full max-w-[448px] rounded-2xl bg-[#fff] p-6 shadow-[0_25px_25px_rgba(0,0,0,0.25)]"
      >
        <h2
          id="mentor-approval-title"
          className="text-xl leading-[30px] font-bold tracking-[-0.3px] text-[#172033]"
        >
          멘토 신청을 승인하시겠습니까?
        </h2>
        <p
          id="mentor-approval-description"
          className="mt-1.5 text-[13px] leading-[19.5px] text-[#667085]"
        >
          승인하면 해당 사용자는 멘토 프로그램을 개설할 수 있습니다.
        </p>

        <div className="mt-4 rounded-2xl bg-[#f9fafb] p-3 text-[13px] leading-[19.5px] text-[#344054]">
          {applicantName}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-2xl border border-[#d0d5dd] bg-[#fff] px-[17px] text-sm leading-[21px] font-semibold text-[#344054] transition hover:bg-[#f9fafb]"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-10 rounded-2xl bg-[#315ef5] px-4 text-sm leading-[21px] font-semibold text-white transition hover:bg-[#2448c9]"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
