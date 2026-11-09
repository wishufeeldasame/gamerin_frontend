'use client';

import { CheckCircle2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getInitials } from '@/lib/feed-api';
import { REPORT_DETAILS_MAX_LENGTH } from '@/lib/report-validation';
import {
  ReportApiError,
  createReport,
  fetchReportReasons,
  type ReportReason,
} from '@/lib/report-api';
import type { ReportReasonCode, ReportTargetType } from '@/types/report';

interface ReportContentModalProps {
  targetType: ReportTargetType;
  targetId: string;
  title: string;
  author: string;
  authorHandle: string;
  content: string | null;
  emptyContentLabel: string;
  onClose: () => void;
}

export function ReportContentModal({
  targetType,
  targetId,
  title,
  author,
  authorHandle,
  content,
  emptyContentLabel,
  onClose,
}: ReportContentModalProps) {
  const [reportReasons, setReportReasons] = useState<ReportReason[]>([]);
  const [selectedReason, setSelectedReason] = useState<ReportReasonCode | ''>('');
  const [customReason, setCustomReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loadingReasons, setLoadingReasons] = useState(true);
  const [reasonsError, setReasonsError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const [reasonsReloadKey, setReasonsReloadKey] = useState(0);
  const canSubmit = Boolean(
    selectedReason &&
      (selectedReason !== 'OTHER' || customReason.trim()) &&
      customReason.length <= REPORT_DETAILS_MAX_LENGTH,
  );

  useEffect(() => {
    const controller = new AbortController();

    const loadReasons = async () => {
      try {
        setLoadingReasons(true);
        setReasonsError(null);
        const reasons = await fetchReportReasons(controller.signal);
        setReportReasons(reasons);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        setReasonsError(
          error instanceof Error ? error.message : '신고 사유를 불러오지 못했습니다.',
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoadingReasons(false);
        }
      }
    };

    void loadReasons();
    return () => controller.abort();
  }, [reasonsReloadKey]);

  const handleSubmit = () => {
    if (!canSubmit || submitting || submitLockRef.current) {
      return;
    }

    setSubmitError(null);
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!selectedReason || (selectedReason === 'OTHER' && !customReason.trim()) || submitLockRef.current) {
      return;
    }

    submitLockRef.current = true;
    try {
      setSubmitting(true);
      setSubmitError(null);
      await createReport({
        targetType,
        targetId,
        reasonCode: selectedReason,
        details: customReason.trim() || null,
      });
      setConfirmOpen(false);
      setSubmitted(true);
    } catch (error) {
      setConfirmOpen(false);
      if (error instanceof ReportApiError && error.status === 409 && targetType !== 'MENTORING') {
        setSubmitError('이미 신고한 대상입니다.');
      } else {
        setSubmitError(error instanceof Error ? error.message : '신고 접수에 실패했습니다.');
      }
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="modal-overlay z-[80]">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-success-title"
          className="modal-panel overflow-y-auto p-6 text-center lg:max-w-sm"
        >
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-brand-subtle text-fg-brand">
            <CheckCircle2 size={22} />
          </div>
          <h2 id="report-success-title" className="mt-4 text-title text-fg-primary">
            신고가 접수되었습니다
          </h2>
          <p className="mt-3 text-label text-fg-secondary">
            운영 정책에 따라 신고 내용을 검토한 뒤 조치하겠습니다.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="btn-primary mt-5 w-full"
          >
            확인
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="modal-overlay z-[80]">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-content-title"
        className="modal-panel flex flex-col overflow-hidden lg:max-w-[480px]"
      >
        <div aria-hidden="true" className="modal-handle" />
        <header className="flex items-center justify-between gap-2 px-5 pt-4 lg:px-6 lg:pt-6">
          <h2 id="report-content-title" className="text-title text-fg-primary">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="신고 모달 닫기"
            className="btn-icon"
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4 lg:px-6">
          <section>
            <p className="mb-2 text-label text-fg-secondary">신고 대상</p>
            <div className="rounded-control bg-subtle p-3">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-caption text-fg-secondary">
                  {getInitials(author)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-body text-fg-primary">{author}</p>
                  {authorHandle ? <p className="truncate text-caption text-fg-tertiary">@{authorHandle}</p> : null}
                </div>
              </div>
              <p className="line-clamp-2 text-body text-fg-secondary">
                {content || emptyContentLabel}
              </p>
            </div>
          </section>

          <section>
            <p className="mb-3 text-label text-fg-primary">신고 사유를 선택해 주세요</p>
            <div className="space-y-2">
              {loadingReasons ? (
                <p role="status" className="rounded-control bg-subtle px-4 py-4 text-center text-label text-fg-secondary">
                  신고 사유를 불러오는 중입니다.
                </p>
              ) : null}

              {reasonsError ? (
                <div className="rounded-control bg-danger-subtle px-4 py-3 text-label text-fg-danger">
                  <p role="alert">{reasonsError}</p>
                  <button
                    type="button"
                    onClick={() => setReasonsReloadKey((current) => current + 1)}
                    className="mt-2 underline underline-offset-2"
                  >
                    다시 시도
                  </button>
                </div>
              ) : null}

              {reportReasons.map((reason) => {
                const selected = selectedReason === reason.code;

                return (
                  <button
                    key={reason.code}
                    type="button"
                    onClick={() => setSelectedReason(reason.code)}
                    aria-pressed={selected}
                    className={[
                      'flex min-h-11 w-full items-center justify-between gap-3 rounded-control border px-4 py-2 text-left text-label transition focus-visible:outline-2 focus-visible:outline-line-focus',
                      selected
                        ? 'border-brand bg-brand-subtle text-fg-primary'
                        : 'border-line bg-surface text-fg-primary hover:border-line-strong',
                    ].join(' ')}
                  >
                    <span>{reason.label}</span>
                    <span
                      className={[
                        'flex h-5 w-5 items-center justify-center rounded-full border',
                        selected ? 'border-brand bg-brand' : 'border-line-strong',
                      ].join(' ')}
                    >
                      {selected ? <span className="h-2 w-2 rounded-full bg-fg-on-brand" /> : null}
                    </span>
                  </button>
                );
              })}

              <div className="pt-2">
                <label htmlFor="report-details" className="mb-2 block text-label text-fg-secondary">
                  상세 내용 {selectedReason === 'OTHER' ? '(필수)' : '(선택)'}
                </label>
                <textarea
                  id="report-details"
                  value={customReason}
                  onChange={(event) => setCustomReason(event.target.value)}
                  maxLength={REPORT_DETAILS_MAX_LENGTH}
                  placeholder={selectedReason === 'OTHER' ? '기타 신고 사유를 자세히 입력해 주세요.' : '추가로 설명할 내용이 있다면 입력해 주세요.'}
                  aria-label="신고 상세 내용"
                  aria-required={selectedReason === 'OTHER'}
                  className="input-base min-h-24 resize-none py-3"
                />
                <p className="mt-1 text-right text-caption text-fg-tertiary">
                  {customReason.length} / {REPORT_DETAILS_MAX_LENGTH}
                </p>
              </div>
            </div>
          </section>

          {submitError ? (
            <p
              role="alert"
              className="rounded-control bg-danger-subtle px-4 py-3 text-label text-fg-danger"
            >
              {submitError}
            </p>
          ) : null}
        </div>

        <footer className="flex gap-3 border-t border-line px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] lg:px-6 lg:pb-6">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary flex-1"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || loadingReasons || submitting}
            className="btn-primary flex-1"
          >
            신고 접수
          </button>
        </footer>
      </section>

      {confirmOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 px-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-confirm-title"
            className="w-full max-w-md rounded-card border border-line bg-surface p-6 text-fg-primary shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <h2 id="report-confirm-title" className="text-title text-fg-primary">
                신고하시겠습니까?
              </h2>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={submitting}
                aria-label="신고 확인 닫기"
                className="btn-icon shrink-0"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mt-4 text-body text-fg-secondary">
              신고 내용은 운영 정책에 따라 검토됩니다. 허위 신고를 반복할 경우 서비스 이용이 제한될 수 있습니다.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={submitting}
                className="btn-secondary flex-1"
              >
                돌아가기
              </button>
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={submitting}
                className="btn-primary flex-1"
              >
                {submitting ? '접수 중...' : '신고 접수'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
