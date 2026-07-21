'use client';

import { CheckCircle2, X } from 'lucide-react';
import { useState } from 'react';
import { getInitials } from '@/lib/feed-api';

const reportReasons = [
  '스팸 또는 광고성 콘텐츠',
  '욕설 또는 혐오 표현',
  '괴롭힘 또는 위협',
  '음란하거나 부적절한 콘텐츠',
  '사칭 또는 허위 정보',
  '개인정보 노출',
  '저작권 침해',
  '기타',
];

interface ReportContentModalProps {
  title: string;
  author: string;
  authorHandle: string;
  content: string | null;
  emptyContentLabel: string;
  onClose: () => void;
}

export function ReportContentModal({
  title,
  author,
  authorHandle,
  content,
  emptyContentLabel,
  onClose,
}: ReportContentModalProps) {
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const canSubmit = Boolean(selectedReason && (selectedReason !== '기타' || customReason.trim()));

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }

    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    setConfirmOpen(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 px-4">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-success-title"
          className="w-full max-w-sm rounded-[22px] bg-white p-6 text-center shadow-2xl"
        >
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-[#f5b93d]">
            <CheckCircle2 size={22} />
          </div>
          <h2 id="report-success-title" className="mt-4 text-xl font-black text-black">
            신고가 접수되었습니다
          </h2>
          <p className="mt-3 text-xs font-bold leading-5 text-zinc-500">
            운영 정책에 따라 신고 내용을 검토한 뒤 조치하겠습니다.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-5 h-11 w-full rounded-xl bg-black text-sm font-black text-white transition hover:bg-zinc-800"
          >
            확인
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 px-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-content-title"
        className="max-h-[90vh] w-full max-w-xl overflow-hidden rounded-[22px] bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-zinc-100 px-6 py-5">
          <h2 id="report-content-title" className="text-xl font-black text-black">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="신고 모달 닫기"
            className="rounded-xl p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-black"
          >
            <X size={18} />
          </button>
        </header>

        <div className="max-h-[calc(90vh-150px)] space-y-5 overflow-y-auto px-6 py-5">
          <section>
            <p className="mb-3 text-xs font-black text-zinc-400">신고 대상</p>
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black text-xs font-black text-white">
                  {getInitials(author)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-black">{author}</p>
                  <p className="truncate text-xs font-bold text-zinc-400">@{authorHandle}</p>
                </div>
              </div>
              <p className="line-clamp-2 text-sm font-medium leading-6 text-zinc-700">
                {content || emptyContentLabel}
              </p>
            </div>
          </section>

          <section>
            <p className="mb-3 text-sm font-black text-black">신고 사유를 선택해주세요</p>
            <div className="space-y-2">
              {reportReasons.map((reason) => {
                const selected = selectedReason === reason;

                return (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setSelectedReason(reason)}
                    className={[
                      'flex h-11 w-full items-center justify-between rounded-xl border px-4 text-left text-sm font-black transition',
                      selected
                        ? 'border-[#f5b93d] bg-amber-50 text-black'
                        : 'border-zinc-100 bg-white text-black hover:border-zinc-300',
                    ].join(' ')}
                  >
                    <span>{reason}</span>
                    <span
                      className={[
                        'flex h-5 w-5 items-center justify-center rounded-full border',
                        selected ? 'border-[#f5b93d] bg-[#f5b93d]' : 'border-zinc-300',
                      ].join(' ')}
                    >
                      {selected ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                    </span>
                  </button>
                );
              })}

              {selectedReason === '기타' ? (
                <div className="pt-2">
                  <textarea
                    value={customReason}
                    onChange={(event) => setCustomReason(event.target.value)}
                    maxLength={300}
                    placeholder="신고 사유를 자세히 입력해주세요."
                    aria-label="기타 신고 사유"
                    className="min-h-28 w-full resize-none rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium leading-6 text-black outline-none transition placeholder:text-zinc-400 focus:border-[#f5b93d]"
                  />
                  <p className="mt-1 text-right text-xs font-bold text-zinc-400">
                    {customReason.length} / 300
                  </p>
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <footer className="flex gap-3 border-t border-zinc-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-xl border border-zinc-200 text-sm font-black text-black transition hover:border-zinc-400"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="h-11 flex-1 rounded-xl bg-red-500 text-sm font-black text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-zinc-200"
          >
            신고 접수
          </button>
        </footer>
      </section>

      {confirmOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 px-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-confirm-title"
            className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <h2 id="report-confirm-title" className="text-xl font-black text-black">
                신고하시겠습니까?
              </h2>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                aria-label="신고 확인 닫기"
                className="rounded-xl p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-black"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mt-4 text-sm font-medium leading-6 text-zinc-500">
              신고 내용은 운영 정책에 따라 검토됩니다. 허위 신고를 반복할 경우 서비스 이용이 제한될 수 있습니다.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="h-11 flex-1 rounded-xl border border-zinc-200 text-sm font-black text-black transition hover:border-zinc-400"
              >
                돌아가기
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="h-11 flex-1 rounded-xl bg-red-500 text-sm font-black text-white transition hover:bg-red-600"
              >
                신고 접수
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
