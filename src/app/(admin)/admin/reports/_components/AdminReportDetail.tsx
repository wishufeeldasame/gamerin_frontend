'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { isAdminRole } from '@/lib/admin-auth';
import { fetchAdminReportDetail, resolveAdminReport, startAdminReportReview, type AdminReportDetailResponse } from '@/lib/admin-report-api';
import { fetchAdminUser, fetchAdminUserPenalties, type AdminUserResponse, type UserPenaltyResponse } from '@/lib/admin-user-api';
import { formatAbsoluteTime, parseDisplayTime, UNKNOWN_TIME } from '@/lib/time-format';
import type { PageResponse } from '@/types/api';
import type { AdminReportUser } from '@/types/admin';
import { RelativeTime } from '@/app/home/components/RelativeTime';
import { AdminPagination } from '../../_components/AdminPagination';
import { AdminStatePanel } from '../../_components/AdminStatePanel';
import { mapAdminReport } from '../_utils/report-mapper';
import { ReportReviewForm, type ReportReviewSubmission } from './ReportReviewForm';
import { ReportProcessedToast } from './ReportProcessedToast';

const cardClass = 'rounded-[20px] border border-[#e4e7ec] bg-white p-5 shadow-sm';
const buttonClass = 'rounded-2xl bg-[#315ef5] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50';
const penaltyLabels = { WARNING: '경고', SUSPENSION_3D: '3일 정지', SUSPENSION_7D: '7일 정지', SUSPENSION_30D: '30일 정지', PERMANENT_BAN: '영구 정지' };

function PenaltyEndTime({ penalty }: { penalty: UserPenaltyResponse }) {
  if (penalty.endAt === null) {
    return penalty.penaltyType === 'PERMANENT_BAN' ? '영구 정지' : '종료 시각 없음';
  }

  const date = parseDisplayTime(penalty.endAt);
  if (!date) return UNKNOWN_TIME;

  const label = formatAbsoluteTime(date);
  return <time dateTime={date.toISOString()} title={label}>{label}</time>;
}

function UserCard({ user, label }: { user: AdminReportUser; label: string }) {
  return (
    <article className="min-w-0 rounded-2xl border border-[#e4e7ec] p-4">
      <h3 className="text-xs font-semibold text-[#667085]">{label}</h3>
      <p className="mt-2 break-words font-semibold text-[#172033]">{user.name}</p>
      <p className="break-all text-sm text-[#667085]">{user.handle}</p>
      <dl className="mt-3 space-y-2 text-xs text-[#344054]">
        <div><dt className="inline text-[#667085]">가입일: </dt><dd className="inline">{user.joinedAt}</dd></div>
        <div><dt className="inline text-[#667085]">계정 대상 신고: </dt><dd className="inline">{user.reportsReceived === null ? '정보 없음' : `${user.reportsReceived}건`}</dd></div>
      </dl>
      {user.id && user.handle !== '-' ? (
        <Link className="mt-3 inline-block text-sm font-semibold text-[#315ef5]" href={`/admin/users/${encodeURIComponent(user.handle.replace(/^@/, ''))}`}>사용자 상세</Link>
      ) : null}
    </article>
  );
}

function ReportPenaltyHistory({ userId, revision }: { userId: string; revision: number }) {
  const [page, setPage] = useState(0);
  const [data, setData] = useState<PageResponse<UserPenaltyResponse> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void fetchAdminUserPenalties(userId, { page, size: 5, sort: 'createdAt,desc' }, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        if (page > 0 && page >= response.totalPages) {
          setPage(Math.max(0, response.totalPages - 1));
          return;
        }
        setData(response);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted || (reason instanceof DOMException && reason.name === 'AbortError')) return;
        setError(reason instanceof Error ? reason.message : '제재 이력을 불러오지 못했습니다.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, retry, revision, userId]);
  return (
    <section className={cardClass} aria-label="사용자 제재 이력">
      <h2 className="font-bold text-[#172033]">사용자 제재 이력</h2>
      {loading ? <AdminStatePanel state="loading" title="제재 이력을 불러오는 중입니다." /> : error ? (
        <AdminStatePanel state="error" title="제재 이력 조회 실패" description={error} onRetry={() => setRetry((value) => value + 1)} />
      ) : data && data.content.length > 0 ? (
        <>
          <ul className="mt-3 space-y-3">
            {data.content.map((penalty) => (
              <li key={penalty.id} className="rounded-xl bg-[#f9fafb] p-3 text-sm text-[#344054]">
                <p className="font-semibold">{penaltyLabels[penalty.penaltyType]} · {penalty.isActive ? '활성' : '해제 또는 만료'}</p>
                <p className="mt-1 whitespace-pre-wrap break-words">{penalty.reason}</p>
                <p className="mt-1 text-xs text-[#667085]">시작: <RelativeTime createdAt={penalty.startAt} /> · 종료: <PenaltyEndTime penalty={penalty} /></p>
              </li>
            ))}
          </ul>
          <AdminPagination currentPage={page} totalPages={data.totalPages} totalItems={data.totalElements} pageSize={5} itemLabel="건" onPageChange={setPage} />
        </>
      ) : <p className="mt-3 text-sm text-[#667085]">제재 이력이 없습니다.</p>}
    </section>
  );
}

function ReportDetailContent({ reportCode }: { reportCode: string }) {
  const { user } = useAuth();
  const [detail, setDetail] = useState<AdminReportDetailResponse | null>(null);
  const [target, setTarget] = useState<AdminUserResponse | null>(null);
  const [targetLoading, setTargetLoading] = useState(false);
  const [targetError, setTargetError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [revision, setRevision] = useState(0);
  const [targetRetry, setTargetRetry] = useState(0);
  const [success, setSuccess] = useState(false);
  const actionLock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(null);
    void fetchAdminReportDetail(reportCode, controller.signal)
      .then((response) => { if (!controller.signal.aborted) setDetail(response); })
      .catch((error: unknown) => {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
        setLoadError(error instanceof Error ? error.message : '신고 상세를 불러오지 못했습니다.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reportCode, revision]);

  const targetId = detail?.targetUser?.id;
  useEffect(() => {
    const controller = new AbortController();
    setTarget(null);
    setTargetError(null);
    if (!targetId) {
      setTargetLoading(false);
      return () => controller.abort();
    }
    setTargetLoading(true);
    void fetchAdminUser(targetId, controller.signal)
      .then((response) => { if (!controller.signal.aborted) setTarget(response); })
      .catch((error: unknown) => {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
        setTargetError(error instanceof Error ? error.message : '대상 사용자 정보를 확인하지 못했습니다.');
      })
      .finally(() => { if (!controller.signal.aborted) setTargetLoading(false); });
    return () => controller.abort();
  }, [targetId, targetRetry, revision]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(false), 3300);
    return () => window.clearTimeout(timer);
  }, [success]);

  const canSanction = Boolean(user?.id && isAdminRole(user.role) && target && target.id === targetId && target.role === 'USER' && target.status !== 'DELETED' && target.id !== user.id);
  const unavailableReason = targetLoading ? '대상 사용자 권한을 확인하는 중입니다.'
    : targetError ? '대상 사용자 조회에 실패해 제재를 선택할 수 없습니다.'
    : target?.role === 'ADMIN' || target?.id === user?.id ? '관리자 및 본인 계정에는 경고를 포함한 제재를 부여할 수 없습니다.'
    : target?.status === 'DELETED' ? '탈퇴한 계정에는 제재를 부여할 수 없습니다.'
    : '신고 대상 사용자를 확인할 수 없어 제재할 수 없습니다.';

  const runAction = async (submission?: ReportReviewSubmission) => {
    if (actionLock.current || !detail) return;
    if (submission?.penaltyType && !canSanction) {
      setActionError(unavailableReason);
      return;
    }
    actionLock.current = true;
    setSubmitting(true);
    setActionError(null);
    try {
      const response = submission ? await resolveAdminReport(reportCode, submission) : await startAdminReportReview(reportCode);
      if (!mounted.current) return;
      setDetail(response);
      setRevision((value) => value + 1);
      setSuccess(Boolean(submission && response.report.status === 'RESOLVED'));
    } catch (error: unknown) {
      if (!mounted.current || (error instanceof DOMException && error.name === 'AbortError')) return;
      setActionError(error instanceof Error ? error.message : '신고 처리에 실패했습니다.');
    } finally {
      actionLock.current = false;
      if (mounted.current) setSubmitting(false);
    }
  };

  if (loading) return <AdminStatePanel state="loading" title="신고 상세를 불러오는 중입니다." />;
  if (loadError || !detail) return <AdminStatePanel state="error" title="신고 상세를 불러오지 못했습니다." description={loadError ?? '신고를 찾을 수 없습니다.'} onRetry={() => setRevision((value) => value + 1)} />;
  const report = mapAdminReport(detail.report, detail);

  return (
    <div className="mx-auto grid w-full max-w-[1200px] min-w-0 grid-cols-1 items-start gap-6 p-4 sm:p-6 lg:p-8 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-6">
        <section className={cardClass} aria-label="신고 기본 정보">
          <div className="flex flex-wrap items-center gap-3"><h2 className="break-all font-mono font-bold text-[#315ef5]">{report.id}</h2><span className="rounded-full bg-[#eef3ff] px-3 py-1 text-xs font-semibold text-[#344054]">{report.status}</span></div>
          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm text-[#344054] sm:grid-cols-2">
            <div><dt className="text-xs text-[#667085]">신고 대상 유형</dt><dd>{report.targetType}</dd></div>
            <div><dt className="text-xs text-[#667085]">신고 사유</dt><dd>{report.reason}</dd></div>
            <div><dt className="text-xs text-[#667085]">접수 시각</dt><dd><RelativeTime createdAt={detail.report.createdAt} /></dd></div>
            <div><dt className="text-xs text-[#667085]">최종 수정 시각</dt><dd><RelativeTime createdAt={detail.report.updatedAt} /></dd></div>
            <div><dt className="text-xs text-[#667085]">담당 관리자</dt><dd>{report.administrator}</dd></div>
          </dl>
        </section>
        <section className={cardClass}><h2 className="font-bold text-[#172033]">신고 상세 설명</h2><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-[#344054]">{report.description}</p></section>
        <section className={cardClass}><h2 className="font-bold text-[#172033]">관련 사용자</h2><div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2"><UserCard user={report.reporterUser} label="신고자" /><UserCard user={report.targetUser} label="신고 대상 사용자" /></div></section>
        <section className={cardClass}><h2 className="font-bold text-[#172033]">신고 당시 내용 요약</h2><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-[#344054]">{report.content}</p></section>
        {(detail.report.targetType === 'POST' || detail.report.targetType === 'COMMENT') ? (
          <section className={cardClass}><h2 className="font-bold text-[#172033]">신고에 따른 숨김 여부</h2><p className="mt-3 text-sm text-[#344054]">{detail.contentHidden ? '숨김' : '신고 숨김 없음'}</p><p className="mt-2 text-xs text-[#667085]">원본 콘텐츠의 모든 삭제·공개 상태를 나타내지는 않습니다.</p></section>
        ) : null}
        {targetId ? <ReportPenaltyHistory key={targetId} userId={targetId} revision={revision} /> : null}
      </div>
      <aside className={`${cardClass} min-w-0 xl:sticky xl:top-6`} aria-label="신고 처리">
        <h2 className="font-bold text-[#172033]">신고 처리</h2>
        <p className="mt-3 text-sm text-[#667085]">현재 상태: {report.status}</p>
        {detail.report.status === 'RECEIVED' ? (
          <><p className="mt-4 text-sm text-[#667085]">검토를 시작하면 조치를 선택할 수 있습니다.</p><button type="button" className={`${buttonClass} mt-3 w-full`} disabled={submitting} onClick={() => void runAction()}>{submitting ? '시작 중...' : '검토 시작'}</button>{actionError ? <p role="alert" className="mt-2 text-sm text-[#b42318]">{actionError}</p> : null}</>
        ) : detail.report.status === 'IN_REVIEW' ? (
          <><ReportReviewForm key={detail.report.id} targetType={report.targetType} canSanction={canSanction} sanctionUnavailableReason={unavailableReason} isSubmitting={submitting} submitError={actionError} onComplete={(submission) => void runAction(submission)} />{targetError ? <button type="button" className="mt-2 text-sm font-semibold text-[#315ef5]" onClick={() => setTargetRetry((value) => value + 1)}>대상 사용자 다시 확인</button> : null}</>
        ) : (
          <div className="mt-4 rounded-2xl bg-[#f9fafb] p-4 text-sm text-[#344054]"><p>{report.status === '처리 완료' ? '처리 완료된 신고입니다.' : '반려 처리된 신고입니다.'}</p><Link href="/admin/audit-logs" className="mt-3 inline-block font-semibold text-[#315ef5]">전체 관리자 작업 이력으로 이동</Link></div>
        )}
      </aside>
      {success ? <ReportProcessedToast isLeaving={false} /> : null}
    </div>
  );
}

export function AdminReportDetail({ reportCode }: { reportCode: string }) {
  const { user } = useAuth();
  return <ReportDetailContent key={`${user?.id ?? 'anonymous'}:${reportCode}`} reportCode={reportCode} />;
}
