'use client';

import { useEffect, useState } from 'react';
import { fetchAdminAuditLogs, type AdminAuditLog } from '@/lib/admin-audit-api';
import type { PageResponse } from '@/types/api';
import type { ReportTargetType } from '@/types/report';
import { RelativeTime } from '@/app/home/components/RelativeTime';
import { AdminFilterSelect } from '../../_components/AdminFilterSelect';
import { AdminPagination } from '../../_components/AdminPagination';
import { AdminStatePanel } from '../../_components/AdminStatePanel';
import { AdminStatusBadge } from '../../_components/AdminStatusBadge';

const PAGE_SIZE = 20;
const actionLabels: Record<string, string> = {
  REPORT_RECEIVE: '신고 접수 상태 변경',
  REPORT_IN_REVIEW: '신고 검토 시작',
  REPORT_RESOLVE: '신고 처리 완료',
  REPORT_REJECT: '신고 반려',
  CONTENT_HIDE: '콘텐츠 숨김',
  CONTENT_RESTORE: '콘텐츠 복구',
  USER_WARNING: '사용자 경고',
  USER_BAN: '사용자 정지',
  USER_UNBAN: '제재 해제',
  MENTOR_APPROVE: '멘토 승인',
  MENTOR_REJECT: '멘토 반려·비활성화',
  PROGRAM_STATUS_CHANGE: '프로그램 상태 변경',
  PROGRAM_HIDE: '프로그램 숨김',
  FORCE_REFUND: '강제 환불',
  FORCE_SETTLE: '강제 정산',
  SYSTEM_CONFIG_UPDATE: '시스템 설정 변경',
};
const targetLabels: Record<ReportTargetType, string> = {
  POST: '게시글', COMMENT: '댓글', USER: '사용자', MENTORING: '멘토링', MESSAGE: '메시지',
};

function actionTone(action: string) {
  if (['REPORT_RESOLVE', 'CONTENT_RESTORE', 'USER_UNBAN', 'MENTOR_APPROVE'].includes(action)) return 'success' as const;
  if (['REPORT_REJECT', 'USER_BAN', 'USER_WARNING', 'MENTOR_REJECT'].includes(action)) return 'warning' as const;
  if (['CONTENT_HIDE', 'PROGRAM_HIDE'].includes(action)) return 'danger' as const;
  return 'info' as const;
}

export function AdminAuditLogs() {
  const [administrator, setAdministrator] = useState<{ id: string; nickname: string } | null>(null);
  const [action, setAction] = useState('');
  const [targetType, setTargetType] = useState<ReportTargetType | ''>('');
  const [currentPage, setCurrentPage] = useState(0);
  const [result, setResult] = useState<PageResponse<AdminAuditLog> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const adminId = administrator?.id;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void fetchAdminAuditLogs({
      adminId, actionType: action || undefined, targetType: targetType || undefined,
      page: currentPage, size: PAGE_SIZE, sort: 'createdAt,desc',
    }, controller.signal)
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
        setError(failure instanceof Error ? failure.message : '작업 이력을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [adminId, action, targetType, currentPage, revision]);

  return (
    <div className="mx-auto w-full max-w-[1200px] p-4 sm:p-6 lg:p-8">
      <section className="rounded-[20px] border border-[#e4e7ec] bg-white p-[17px]" aria-label="작업 이력 필터">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <AdminFilterSelect label="전체 작업" value={action} onChange={(value) => { setAction(value); setCurrentPage(0); }} options={Object.entries(actionLabels).map(([value, label]) => ({ value, label }))} />
          <AdminFilterSelect label="전체 대상" value={targetType} onChange={(value) => { setTargetType(value as ReportTargetType | ''); setCurrentPage(0); }} options={Object.entries(targetLabels).map(([value, label]) => ({ value, label }))} />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
          {administrator ? (
            <div className="flex flex-wrap items-center gap-2">
              <span>관리자: {administrator.nickname}</span>
              <button type="button" onClick={() => { setAdministrator(null); setCurrentPage(0); }} className="font-semibold text-[#315ef5] hover:underline">관리자 필터 해제</button>
            </div>
          ) : <p className="text-[#667085]">이력의 관리자 이름을 누르면 해당 관리자의 작업만 볼 수 있습니다.</p>}
          <button type="button" disabled={loading} onClick={() => setRevision((current) => current + 1)} className="rounded-xl border border-[#d0d5dd] px-3 py-2 font-semibold text-[#344054] disabled:opacity-50">새로고침</button>
        </div>
      </section>

      <section className="mt-5 min-h-[540px] overflow-hidden rounded-[20px] border border-[#e4e7ec] bg-white">
        {loading ? <AdminStatePanel state="loading" title="작업 이력을 불러오는 중입니다." /> : error ? (
          <AdminStatePanel state="error" title="작업 이력을 불러오지 못했습니다." description={error} onRetry={() => setRevision((current) => current + 1)} />
        ) : result && result.content.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] table-fixed border-collapse">
              <colgroup><col className="w-[15%]" /><col className="w-[12%]" /><col className="w-[15%]" /><col className="w-[8%]" /><col className="w-[15%]" /><col className="w-[23%]" /><col className="w-[12%]" /></colgroup>
              <thead><tr className="h-[42px] border-b border-[#f2f4f7] bg-[#fcfcfd] text-left text-xs font-bold text-[#667085]"><th className="px-5">이력 ID</th><th>관리자</th><th>작업</th><th>대상</th><th>대상 ID</th><th>처리 내용</th><th>처리 시각</th></tr></thead>
              <tbody>{result.content.map((log) => (
                <tr key={log.id} className="border-b border-[#f2f4f7] text-[13px] last:border-b-0">
                  <td className="break-all px-5 py-4 font-mono text-xs text-[#344054]">{log.id}</td>
                  <td className="pr-2"><button type="button" title={log.adminId} onClick={() => { setAdministrator({ id: log.adminId, nickname: log.adminNickname }); setCurrentPage(0); }} className="text-left font-semibold text-[#315ef5] hover:underline">{log.adminNickname}</button></td>
                  <td className="pr-2"><AdminStatusBadge label={actionLabels[log.actionType] ?? log.actionType} tone={actionTone(log.actionType)} /></td>
                  <td className="text-[#667085]">{log.targetType ? targetLabels[log.targetType] ?? log.targetType : '정보 없음'}</td>
                  <td className="break-all pr-3 font-mono text-xs text-[#344054]">{log.targetId ?? '정보 없음'}</td>
                  <td className="whitespace-pre-wrap break-words pr-4 text-[#344054]">{log.details?.trim() ? log.details : '정보 없음'}</td>
                  <td className="pr-4 text-[#98a2b3]"><RelativeTime createdAt={log.createdAt} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <AdminStatePanel state="empty" title="조건에 맞는 작업 이력이 없습니다." description="필터를 변경하거나 나중에 다시 확인해주세요." />}
        {!loading && !error && result ? <AdminPagination currentPage={result.number} totalPages={result.totalPages} totalItems={result.totalElements} pageSize={result.size} itemLabel="건" onPageChange={setCurrentPage} /> : null}
      </section>
    </div>
  );
}
