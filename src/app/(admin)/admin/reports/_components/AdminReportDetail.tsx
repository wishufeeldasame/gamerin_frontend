'use client';

import { ArrowUpRight, CircleCheckBig, ImageIcon, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  fetchAdminReportDetail,
  resolveAdminReport,
  startAdminReportReview,
} from '@/lib/admin-report-api';
import { AdminStatePanel } from '../../_components/AdminStatePanel';
import { mapAdminReport, targetTypeCodeByLabel } from '../_utils/report-mapper';
import { ReportReviewForm, type ReportReviewSubmission } from './ReportReviewForm';
import { ReportProcessedToast } from './ReportProcessedToast';
import type { AdminReport, AdminReportStatus as ReportStatus, AdminReportUser as ReportUser } from '@/types/admin';

const statusStyles: Record<ReportStatus, { background: string; dot: string; text: string }> = {
  접수: { background: '#fef6e7', dot: '#d97706', text: '#b54708' },
  '검토 중': { background: '#eef3ff', dot: '#315ef5', text: '#1d46c7' },
  '처리 완료': { background: '#e7f6ee', dot: '#168a4a', text: '#087443' },
  반려: { background: '#f2f4f7', dot: '#98a2b3', text: '#667085' },
};

const cardClass =
  'rounded-[20px] border border-[#e4e7ec] bg-[#fff] p-[21px] shadow-[0_1px_1px_rgba(16,24,40,0.04)]';

function StatusBadge({ status }: { status: ReportStatus }) {
  const style = statusStyles[status];

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs leading-[18px] font-semibold"
      style={{ backgroundColor: style.background, color: style.text }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: style.dot }} />
      {status}
    </span>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[13px] leading-[19.5px] text-[#667085]">{label}</dt>
      <dd className="mt-0.5 text-[13px] leading-[19.5px] font-semibold text-[#172033]">{value}</dd>
    </div>
  );
}

function UserCard({ user, role, showAction = false }: { user: ReportUser; role: string; showAction?: boolean }) {
  return (
    <article className="min-h-[220px] rounded-2xl border border-[#e4e7ec] p-[17px]">
      <p className="text-xs leading-[18px] font-semibold text-[#667085]">{role}</p>
      <div className="mt-2 flex items-center gap-3">
        <span
          className={`grid size-10 place-items-center rounded-full text-base font-bold text-white ${
            showAction ? 'bg-[#0891b2]' : 'bg-[#d97706]'
          }`}
        >
          {user.initial}
        </span>
        <div>
          <p className="text-sm leading-[21px] font-semibold text-[#172033]">{user.name}</p>
          <p className="text-xs leading-[18px] text-[#667085]">{user.handle}</p>
        </div>
      </div>
      <dl className="mt-3 space-y-1 text-xs leading-[18px]">
        <div className="flex justify-between gap-4">
          <dt className="text-[#667085]">가입일</dt>
          <dd className="text-[#172033]">{user.joinedAt}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[#667085]">받은 신고</dt>
          <dd className="text-[#172033]">{user.reportsReceived}회</dd>
        </div>
        {showAction ? (
          <div className="flex justify-between gap-4">
            <dt className="text-[#667085]">활성 제재</dt>
            <dd className="text-[#172033]">{user.activeSanction ?? '제재 없음'}</dd>
          </div>
        ) : null}
      </dl>
      {showAction && user.handle && user.handle !== '-' ? (
        <Link
          href={`/profile/${encodeURIComponent(user.handle.replace(/^@/, ''))}`}
          className="mt-2 flex h-[34px] w-full items-center justify-center gap-1 rounded-2xl bg-[#eef3ff] text-xs leading-[18px] font-semibold text-[#1d46c7] transition hover:bg-[#dfe8ff]"
        >
          사용자 프로필
          <ArrowUpRight className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
        </Link>
      ) : showAction ? (
        <p className="mt-2 rounded-2xl bg-[#f2f4f7] px-3 py-2 text-center text-xs text-[#667085]">연결 가능한 사용자 핸들이 없습니다.</p>
      ) : null}
    </article>
  );
}

type DetailTab = 'related' | 'sanctions' | 'history';

type AdminReportDetailViewProps = {
  report: AdminReport;
  isSubmitting: boolean;
  actionError: string | null;
  onStartReview: () => Promise<boolean>;
  onResolve: (submission: ReportReviewSubmission) => Promise<ReportStatus | null>;
};

function AdminReportDetailView({
  report,
  isSubmitting,
  actionError,
  onStartReview,
  onResolve,
}: AdminReportDetailViewProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>(report.status === '검토 중' ? 'sanctions' : 'related');
  const [currentStatus, setCurrentStatus] = useState<ReportStatus>(report.status);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [isToastLeaving, setIsToastLeaving] = useState(false);

  useEffect(() => {
    if (!showSuccessToast) return;

    const leaveTimeoutId = window.setTimeout(() => {
      setIsToastLeaving(true);
    }, 3000);
    const removeTimeoutId = window.setTimeout(() => {
      setShowSuccessToast(false);
    }, 3300);

    return () => {
      window.clearTimeout(leaveTimeoutId);
      window.clearTimeout(removeTimeoutId);
    };
  }, [showSuccessToast]);

  const tabContent: Record<Exclude<DetailTab, 'related'>, string[]> = {
    sanctions: [
      `현재 활성 제재: ${report.targetUser.activeSanction ?? '제재 없음'}`,
      '전체 제재 이력 API는 아직 지원되지 않아 현재 활성 제재만 표시합니다.',
    ],
    history: [
      `${report.receivedAt} · 신고 접수`,
      report.administrator === '미배정'
        ? '담당 관리자 배정 전'
        : `${report.updatedAt ?? report.receivedAt} · ${report.administrator} · 현재 상태 ${currentStatus}`,
      '전체 처리 이력 API는 아직 지원되지 않아 신고 생성·최종 수정 정보만 표시합니다.',
    ],
  };
  const relatedSearchParams = new URLSearchParams({
    targetId: report.targetId ?? '',
    targetType: targetTypeCodeByLabel[report.targetType],
  });

  const tabs: Array<{ id: DetailTab; label: string }> = [
    { id: 'related', label: '관련 신고' },
    { id: 'sanctions', label: '사용자 제재 이력' },
    { id: 'history', label: '처리 이력' },
  ];

  return (
    <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 items-start gap-6 p-4 sm:p-6 lg:p-8 xl:grid-cols-[minmax(0,749px)_minmax(320px,363px)]">
      <div className="space-y-6">
        <section className={cardClass} aria-label="신고 기본 정보">
          <div className="flex items-center gap-3">
            <p className="font-mono text-sm leading-[21px] font-bold text-[#315ef5]">{report.id}</p>
            <StatusBadge status={currentStatus} />
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-x-6 gap-y-4">
            <DetailItem label="신고 대상 유형" value={report.targetType} />
            <DetailItem label="신고 사유" value={report.reason} />
            <DetailItem label="접수 시각" value={report.receivedAt} />
            <DetailItem label="담당 관리자" value={report.administrator} />
            <DetailItem label="신고자" value={report.reporter} />
            <DetailItem label="신고 대상자" value={report.targetUser.handle} />
          </dl>
        </section>

        <section className={cardClass}>
          <h2 className="text-base leading-6 font-bold text-[#172033]">신고 상세 설명</h2>
          <p className="mt-3 rounded-2xl bg-[#f9fafb] p-4 text-sm leading-6 text-[#344054]">
            {report.description}
          </p>
        </section>

        <section className={cardClass}>
          <h2 className="text-base leading-6 font-bold text-[#172033]">관련 사용자</h2>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <UserCard user={report.reporterUser} role="신고자" showAction />
            <UserCard user={report.targetUser} role="신고 대상 작성자" showAction />
          </div>
        </section>

        <section className={cardClass}>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base leading-6 font-bold text-[#172033]">신고 당시 콘텐츠</h2>
            <p className="text-xs leading-[18px] text-[#98a2b3]">Snapshot · {report.receivedAt}</p>
          </div>
          <div className="mt-3 rounded-2xl border border-[#e4e7ec] p-[17px]">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-full bg-[#0891b2] text-[13px] font-bold text-white">
                {report.targetUser.initial}
              </span>
              <div>
                <p className="text-[13px] leading-[19.5px] font-semibold text-[#172033]">
                  {report.targetUser.name}
                </p>
                <p className="text-xs leading-[18px] text-[#667085]">{report.targetUser.handle}</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#172033]">{report.content}</p>
            <div className="mt-3 flex h-40 items-center justify-center gap-2 rounded-2xl bg-[#f2f4f7] text-[13px] font-medium text-[#98a2b3]">
              <ImageIcon className="size-4" strokeWidth={1.7} aria-hidden="true" />
              첨부 이미지 미리보기
            </div>
          </div>
        </section>

        <section className={cardClass}>
          <h2 className="text-base leading-6 font-bold text-[#172033]">현재 콘텐츠 상태</h2>
          <div className="mt-3">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs leading-[18px] font-semibold ${
              report.contentHidden
                ? 'bg-[#feeceb] text-[#b42318]'
                : 'bg-[#e7f6ee] text-[#087443]'
            }`}>
              <span className={`size-1.5 rounded-full ${report.contentHidden ? 'bg-[#d92d20]' : 'bg-[#168a4a]'}`} />
              {report.contentHidden ? '숨김' : '표시 중'}
            </span>
          </div>
        </section>

        <section className={cardClass}>
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-[#f2f4f7] p-1" role="tablist">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={`h-10 rounded-[14px] text-base leading-6 font-medium transition ${
                    isActive
                      ? 'bg-[#fff] text-[#172033] shadow-[0_1px_2px_rgba(0,0,0,0.1)]'
                      : 'text-[#667085] hover:text-[#344054]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          <div className="mt-4 space-y-2" role="tabpanel">
            {activeTab === 'related' ? (
              <div className="rounded-2xl bg-[#f9fafb] p-4">
                <p className="text-[13px] leading-5 text-[#344054]">
                  동일한 신고 대상을 기준으로 관련 신고 목록을 조회합니다.
                </p>
                <Link
                  href={`/admin/reports?${relatedSearchParams.toString()}`}
                  className="mt-3 inline-flex h-9 items-center gap-1 rounded-2xl bg-[#eef3ff] px-3 text-xs font-semibold text-[#1d46c7] transition hover:bg-[#dfe8ff]"
                >
                  동일 대상 신고 검색
                  <ArrowUpRight className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
                </Link>
                <p className="mt-2 text-xs text-[#98a2b3]">검색 결과에는 처리 완료 신고도 포함될 수 있습니다.</p>
              </div>
            ) : tabContent[activeTab].map((item) => (
              <p key={item} className="rounded-2xl bg-[#f9fafb] px-3 py-2.5 text-[13px] leading-[19.5px] text-[#344054]">
                {item}
              </p>
            ))}
          </div>
        </section>
      </div>

      <aside className={`${cardClass} sticky top-6`} aria-label="신고 처리">
        <h2 className="flex items-center gap-2 text-base leading-6 font-bold text-[#172033]">
          <ShieldCheck className="size-5 text-[#315ef5]" strokeWidth={1.8} aria-hidden="true" />
          신고 처리
        </h2>
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-[#f9fafb] px-3 py-2.5">
          <span className="text-[13px] leading-[19.5px] text-[#667085]">현재 상태</span>
          <StatusBadge status={currentStatus} />
        </div>
        {currentStatus === '접수' ? (
          <>
            <p className="mt-4 text-[13px] leading-[19.5px] text-[#667085]">
              검토를 시작하면 조치를 선택할 수 있습니다.
            </p>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                void onStartReview().then((started) => {
                  if (!started) return;
                  setCurrentStatus('검토 중');
                  setActiveTab('sanctions');
                });
              }}
              className="mt-3 h-10 w-full rounded-2xl bg-[#315ef5] text-sm leading-[21px] font-semibold text-white transition hover:bg-[#244bd4] disabled:cursor-wait disabled:bg-[#98a2b3]"
            >
              {isSubmitting ? '시작 중...' : '검토 시작'}
            </button>
            {actionError ? <p className="mt-2 text-xs text-[#b42318]" role="alert">{actionError}</p> : null}
          </>
        ) : currentStatus === '검토 중' ? (
          <ReportReviewForm
            targetType={report.targetType}
            isSubmitting={isSubmitting}
            submitError={actionError}
            canSanction={Boolean(report.targetUser.id)}
            onComplete={(submission) => {
              void onResolve(submission).then((status) => {
                if (!status) return;
                setCurrentStatus(status);
                setActiveTab('related');
                setShowSuccessToast(status === '처리 완료');
                setIsToastLeaving(false);
              });
            }}
          />
        ) : currentStatus === '처리 완료' ? (
          <div className="mt-4 flex h-[187px] flex-col items-center gap-2 rounded-2xl bg-[#e7f6ee] px-4 py-6">
            <CircleCheckBig
              className="size-8 text-[#168a4a]"
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <p className="text-sm leading-[21px] font-semibold text-[#087443]">
              처리 완료된 신고입니다.
            </p>
            <p className="text-xs leading-[18px] text-[#667085]">
              관리자 작업 이력에서 확인할 수 있습니다.
            </p>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className="mt-1 h-10 rounded-2xl border border-[#d0d5dd] bg-[#fff] px-[17px] text-sm leading-[21px] font-semibold text-[#344054] transition hover:bg-[#f9fafb]"
            >
              작업 이력 보기
            </button>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl bg-[#f2f4f7] px-4 py-6 text-center">
            <p className="text-sm leading-[21px] font-semibold text-[#667085]">
              반려 처리된 신고입니다.
            </p>
          </div>
        )}
      </aside>

      {showSuccessToast ? <ReportProcessedToast isLeaving={isToastLeaving} /> : null}
    </div>
  );
}

export function AdminReportDetail({ reportCode }: { reportCode: string }) {
  const [report, setReport] = useState<AdminReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const actionLockRef = useRef(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(null);

    void fetchAdminReportDetail(reportCode, controller.signal)
      .then((response) => {
        setReport(mapAdminReport(response.report, response));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : '신고 상세를 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [reloadKey, reportCode]);

  const startReview = async () => {
    if (actionLockRef.current) return false;
    actionLockRef.current = true;
    setIsSubmitting(true);
    setActionError(null);
    try {
      const response = await startAdminReportReview(reportCode);
      setReport(mapAdminReport(response.report, response));
      return true;
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '검토를 시작하지 못했습니다.');
      return false;
    } finally {
      actionLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const resolveReport = async (submission: ReportReviewSubmission): Promise<ReportStatus | null> => {
    if (actionLockRef.current) return null;
    actionLockRef.current = true;
    setIsSubmitting(true);
    setActionError(null);
    try {
      const response = await resolveAdminReport(reportCode, submission);
      const nextReport = mapAdminReport(response.report, response);
      setReport(nextReport);
      return nextReport.status;
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '신고를 처리하지 못했습니다.');
      return null;
    } finally {
      actionLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <AdminStatePanel state="loading" title="신고 상세를 불러오는 중입니다." />;
  }

  if (loadError || !report) {
    return (
      <AdminStatePanel
        state="error"
        title="신고 상세를 불러오지 못했습니다."
        description={loadError ?? '신고를 찾을 수 없습니다.'}
        onRetry={() => setReloadKey((current) => current + 1)}
      />
    );
  }

  return (
    <AdminReportDetailView
      report={report}
      isSubmitting={isSubmitting}
      actionError={actionError}
      onStartReview={startReview}
      onResolve={resolveReport}
    />
  );
}
