'use client';

import { TriangleAlert } from 'lucide-react';
import { AdminDialog } from '../../_components/AdminDialog';

type ReportReviewConfirmDialogProps = {
  isOpen: boolean;
  decision: string;
  contentAction: string;
  userAction: string;
  reason: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => void;
};

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-6 text-[13px] leading-[19.5px]">
      <dt className="shrink-0 text-[#667085]">{label}</dt>
      <dd className="max-w-[300px] text-right font-medium break-words text-[#172033]">{value}</dd>
    </div>
  );
}

export function ReportReviewConfirmDialog({
  isOpen,
  decision,
  contentAction,
  userAction,
  reason,
  confirmLabel,
  onClose,
  onConfirm,
}: ReportReviewConfirmDialogProps) {
  return (
    <AdminDialog
      isOpen={isOpen}
      titleId="report-review-confirm-title"
      descriptionId="report-review-confirm-description"
      onClose={onClose}
    >
      <div className="grid size-11 place-items-center rounded-2xl bg-[#feeceb]">
        <TriangleAlert className="size-6 text-[#d92d20]" strokeWidth={1.8} aria-hidden="true" />
      </div>
      <h2 id="report-review-confirm-title" className="mt-4 text-xl leading-[30px] font-bold text-[#172033]">
        신고를 처리하시겠습니까?
      </h2>
      <p id="report-review-confirm-description" className="mt-1.5 text-[13px] leading-[19.5px] text-[#667085]">
        아래 내용으로 처리되며, 모든 작업은 관리자 작업 이력에 기록됩니다.
      </p>

      <dl className="mt-4 space-y-2 rounded-2xl bg-[#f9fafb] p-4">
        <SummaryRow label="처리 결정" value={decision} />
        <SummaryRow label="콘텐츠 조치" value={contentAction} />
        <SummaryRow label="사용자 조치" value={userAction} />
        <SummaryRow label="처리 사유" value={reason} />
      </dl>

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="h-10 rounded-2xl border border-[#d0d5dd] bg-white px-[17px] text-sm font-semibold text-[#344054] transition hover:bg-[#f9fafb]">
          취소
        </button>
        <button type="button" onClick={onConfirm} className="h-10 rounded-2xl bg-[#d92d20] px-4 text-sm font-semibold text-white transition hover:bg-[#b42318]">
          {confirmLabel}
        </button>
      </div>
    </AdminDialog>
  );
}
