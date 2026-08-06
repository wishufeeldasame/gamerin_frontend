'use client';

import { useState } from 'react';
import { ReportReviewConfirmDialog } from './ReportReviewConfirmDialog';

type ReviewDecision = 'complete' | 'reject';
type CompletedStatus = '처리 완료' | '반려';

type ReportReviewFormProps = {
  onComplete: (status: CompletedStatus, contentHidden: boolean) => void;
};

const decisionOptions: Array<{ value: ReviewDecision; label: string }> = [
  { value: 'complete', label: '처리 완료' },
  { value: 'reject', label: '신고 반려' },
];

const sanctionOptions = [
  { value: '', label: '제재 없음', summary: '제재 없음' },
  { value: 'warning', label: '경고', summary: '경고' },
  { value: '3-days', label: '3일 이용 제한', summary: '3일 정지' },
  { value: '7-days', label: '7일 이용 제한', summary: '7일 정지' },
  { value: '30-days', label: '30일 이용 제한', summary: '30일 정지' },
  { value: 'permanent', label: '영구 이용 제한', summary: '영구 정지' },
] as const;

export function ReportReviewForm({ onComplete }: ReportReviewFormProps) {
  const [decision, setDecision] = useState<ReviewDecision>('complete');
  const [hidePost, setHidePost] = useState(false);
  const [hideComment, setHideComment] = useState(false);
  const [sanction, setSanction] = useState('');
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState(false);
  const [memo, setMemo] = useState('');
  const [includeRelated, setIncludeRelated] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const contentActions = [hidePost ? '게시글 숨기기' : '', hideComment ? '댓글 숨기기' : ''].filter(Boolean);
  const selectedSanction = sanctionOptions.find((option) => option.value === sanction);
  const decisionLabel = decision === 'complete' ? '처리 완료' : '신고 반려';
  const contentActionLabel = contentActions.length > 0 ? contentActions.join(', ') : '조치 없음';
  const userActionLabel = selectedSanction?.summary ?? '제재 없음';
  const confirmLabel =
    decision === 'reject'
      ? '신고 반려'
      : contentActions.length > 0
        ? '숨김 처리 후 완료'
        : '처리 완료';

  const openConfirmDialog = () => {
    if (!reason.trim()) {
      setReasonError(true);
      return;
    }

    setReasonError(false);
    setIsConfirmOpen(true);
  };

  return (
    <div className="mt-4">
      <fieldset>
        <legend className="text-[13px] leading-[19.5px] font-semibold text-[#344054]">처리 결정</legend>
        <div className="mt-1.5 space-y-2">
          {decisionOptions.map((option) => {
            const isSelected = decision === option.value;
            return (
              <label
                key={option.value}
                className={`flex min-h-[43px] cursor-pointer items-center gap-2.5 rounded-2xl border px-[13px] text-sm font-medium text-[#172033] transition ${
                  isSelected ? 'border-[#315ef5] bg-[#eef3ff]' : 'border-[#d0d5dd] bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="review-decision"
                  value={option.value}
                  checked={isSelected}
                  onChange={() => setDecision(option.value)}
                  className="size-[13px] accent-[#315ef5]"
                />
                {option.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="text-[13px] leading-[19.5px] font-semibold text-[#344054]">콘텐츠 조치</legend>
        <div className="mt-1.5 space-y-2">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-[#344054]">
            <input type="checkbox" checked={hidePost} onChange={(event) => setHidePost(event.target.checked)} className="size-4 rounded-sm accent-[#315ef5]" />
            게시글 숨기기
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-[#344054]">
            <input type="checkbox" checked={hideComment} onChange={(event) => setHideComment(event.target.checked)} className="size-4 rounded-sm accent-[#315ef5]" />
            댓글 숨기기
          </label>
        </div>
        <p className="mt-1.5 text-xs leading-[18px] text-[#98a2b3]">완전 삭제 대신 숨김을 우선 사용합니다.</p>
      </fieldset>

      <label className="mt-5 block">
        <span className="mb-1.5 block text-[13px] font-semibold text-[#344054]">사용자 제재</span>
        <select
          value={sanction}
          onChange={(event) => setSanction(event.target.value)}
          aria-label="사용자 제재"
          className="h-10 w-full rounded-2xl border border-[#d0d5dd] bg-white px-3 text-[13px] text-[#344054] outline-none transition focus:border-[#315ef5] focus:ring-2 focus:ring-[#315ef5]/10 dark:!border-[#d0d5dd] dark:!bg-white dark:!text-[#344054]"
        >
          {sanctionOptions.map((option) => (
            <option key={option.value || 'none'} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>

      <label className="mt-5 block">
        <span className="mb-1.5 block text-[13px] font-semibold text-[#344054]">
          관리자 처리 사유 <span className="text-[#d92d20]">*</span>
        </span>
        <textarea
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            if (event.target.value.trim()) setReasonError(false);
          }}
          aria-invalid={reasonError}
          aria-describedby={reasonError ? 'report-review-reason-error' : undefined}
          rows={3}
          placeholder="처리 근거를 구체적으로 작성해주세요. 이 내용은 작업 이력에 기록됩니다."
          className={`h-24 w-full resize-none rounded-2xl border bg-white p-[13px] text-sm leading-[21px] text-[#172033] outline-none transition placeholder:text-[rgba(23,32,51,0.5)] dark:!bg-white dark:!text-[#172033] ${
            reasonError
              ? 'border-[#f04438] focus:border-[#f04438] focus:ring-2 focus:ring-[#f04438]/10'
              : 'border-[#d0d5dd] focus:border-[#315ef5] focus:ring-2 focus:ring-[#315ef5]/10'
          }`}
        />
        {reasonError ? (
          <span id="report-review-reason-error" className="mt-1.5 block text-xs text-[#f04438]" role="alert">
            처리 사유는 필수입니다.
          </span>
        ) : null}
      </label>

      <label className="mt-5 block">
        <span className="mb-1.5 block text-[13px] font-semibold text-[#344054]">내부 메모 (선택)</span>
        <textarea
          value={memo}
          onChange={(event) => setMemo(event.target.value)}
          rows={2}
          placeholder="다른 관리자에게 공유할 메모"
          className="h-16 w-full resize-none rounded-2xl border border-[#d0d5dd] bg-white p-[13px] text-sm text-[#172033] outline-none transition focus:border-[#315ef5] focus:ring-2 focus:ring-[#315ef5]/10 dark:!border-[#d0d5dd] dark:!bg-white dark:!text-[#172033]"
        />
      </label>

      <label className="flex min-h-[61px] cursor-pointer items-center gap-2.5 text-sm font-medium text-[#344054]">
        <input type="checkbox" checked={includeRelated} onChange={(event) => setIncludeRelated(event.target.checked)} className="size-4 rounded-sm accent-[#315ef5]" />
        관련 신고 함께 처리 (2건)
      </label>

      <button type="button" onClick={openConfirmDialog} className="h-10 w-full rounded-2xl bg-[#315ef5] text-sm font-semibold text-white transition hover:bg-[#244bd4]">
        처리 내용 확인
      </button>

      <ReportReviewConfirmDialog
        isOpen={isConfirmOpen}
        decision={decisionLabel}
        contentAction={contentActionLabel}
        userAction={userActionLabel}
        reason={reason.trim()}
        confirmLabel={confirmLabel}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={() => {
          setIsConfirmOpen(false);
          onComplete(decision === 'complete' ? '처리 완료' : '반려', decision === 'complete' && contentActions.length > 0);
        }}
      />
    </div>
  );
}
