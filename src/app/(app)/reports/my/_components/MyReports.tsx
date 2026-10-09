'use client';

import Link from 'next/link';
import { Fragment, useEffect, useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { RelativeTime } from '@/app/home/components/RelativeTime';
import { fetchMyReports, type CreatedReport } from '@/lib/report-api';
import type { PageResponse } from '@/types/api';
import type { ReportStatus, ReportTargetType } from '@/types/report';
import { AdminPagination } from '@/app/(admin)/admin/_components/AdminPagination';
import { AdminStatePanel } from '@/app/(admin)/admin/_components/AdminStatePanel';
import { AdminStatusBadge } from '@/app/(admin)/admin/_components/AdminStatusBadge';

const PAGE_SIZE = 20;
const targetLabels: Record<ReportTargetType, string> = {
  POST: '게시글', COMMENT: '댓글', USER: '사용자', MENTORING: '멘토링', MESSAGE: '메시지',
};
const statusLabels: Record<ReportStatus, string> = {
  RECEIVED: '접수', IN_REVIEW: '검토 중', RESOLVED: '처리 완료', REJECTED: '반려',
};
const statusTones = {
  RECEIVED: 'warning', IN_REVIEW: 'info', RESOLVED: 'success', REJECTED: 'neutral',
} as const;

function MyReportsList() {
  const [currentPage, setCurrentPage] = useState(0);
  const [result, setResult] = useState<PageResponse<CreatedReport> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setExpandedId(null);
    void fetchMyReports({ page: currentPage, size: PAGE_SIZE }, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        if (currentPage > 0 && currentPage >= Math.max(response.totalPages, 1)) {
          setCurrentPage(Math.max(response.totalPages - 1, 0));
          return;
        }
        setResult(response);
      })
      .catch((failure: unknown) => {
        if (controller.signal.aborted || (failure instanceof Error && failure.name === 'AbortError')) return;
        setResult(null);
        setError(failure instanceof Error ? failure.message : '내 신고를 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [currentPage, revision]);

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-700">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">접수 내역</h2>
        <button type="button" disabled={loading} onClick={() => setRevision((current) => current + 1)} className="rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200">새로고침</button>
      </div>
      {loading ? <AdminStatePanel state="loading" title="내 신고를 불러오는 중입니다." /> : error ? (
        <AdminStatePanel state="error" title="내 신고를 불러오지 못했습니다." description={error} onRetry={() => setRevision((current) => current + 1)} />
      ) : result && result.content.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead><tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"><th className="px-5 py-3">신고 코드</th><th className="px-3">대상 유형</th><th className="px-3">신고 사유</th><th className="px-3">상태</th><th className="px-3">접수 시각</th><th className="px-5">신고 내용</th></tr></thead>
            <tbody>{result.content.map((report) => (
              <Fragment key={report.id}>
                <tr className="border-b border-zinc-100 text-zinc-800 dark:border-zinc-800 dark:text-zinc-200">
                  <td className="px-5 py-4 font-mono font-semibold">{report.reportCode}</td>
                  <td className="px-3">{targetLabels[report.targetType]}</td>
                  <td className="px-3">{report.reasonLabel}</td>
                  <td className="px-3"><AdminStatusBadge label={statusLabels[report.status]} tone={statusTones[report.status]} /></td>
                  <td className="px-3"><RelativeTime createdAt={report.createdAt} /></td>
                  <td className="px-5">
                    <button
                      type="button"
                      aria-label={`${report.reportCode} 내용 ${expandedId === report.id ? '접기' : '보기'}`}
                      aria-expanded={expandedId === report.id}
                      aria-controls={`report-details-${report.id}`}
                      onClick={() => setExpandedId((current) => current === report.id ? null : report.id)}
                      className="whitespace-nowrap font-semibold text-blue-600 hover:underline dark:text-blue-400"
                    >
                      내용 {expandedId === report.id ? '접기' : '보기'}
                    </button>
                  </td>
                </tr>
                {expandedId === report.id ? (
                  <tr id={`report-details-${report.id}`}><td colSpan={6} className="border-b border-zinc-200 bg-zinc-50 px-5 py-5 dark:border-zinc-700 dark:bg-zinc-800">
                    <dl className="space-y-4 text-zinc-700 dark:text-zinc-200">
                      <div><dt className="mb-1 font-semibold">신고 내용</dt><dd className="whitespace-pre-wrap break-words">{report.details?.trim() ? report.details : '정보 없음'}</dd></div>
                      <div><dt className="mb-1 font-semibold">접수 당시 대상 내용</dt><dd className="whitespace-pre-wrap break-words">{report.targetSnippet?.trim() ? report.targetSnippet : '정보 없음'}</dd></div>
                    </dl>
                  </td></tr>
                ) : null}
              </Fragment>
            ))}</tbody>
          </table>
        </div>
      ) : <AdminStatePanel state="empty" title="접수한 신고가 없습니다." description="신고를 접수하면 이곳에서 처리 상태를 확인할 수 있습니다." />}
      {!loading && !error && result ? <AdminPagination currentPage={result.number} totalPages={result.totalPages} totalItems={result.totalElements} pageSize={result.size} itemLabel="건" onPageChange={setCurrentPage} /> : null}
    </section>
  );
}

export function MyReports() {
  const { user, isAuthReady, isLoggingOut } = useAuth();
  if (!isAuthReady || isLoggingOut) return <AdminStatePanel state="loading" title="로그인 정보를 확인하는 중입니다." />;
  if (!user) return null;

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">내 신고</h1><p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">내가 접수한 신고와 현재 처리 상태를 확인합니다.</p></div>
        <Link href="/settings" className="text-sm font-semibold text-zinc-600 hover:underline dark:text-zinc-300">설정으로 돌아가기</Link>
      </div>
      <MyReportsList key={user.id} />
    </main>
  );
}
