'use client';

import { Search } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchAdminReports,
  updateAdminReportStatus,
  type AdminReportReasonCode,
} from '@/lib/admin-report-api';
import { fetchReportReasons, type ReportReason } from '@/lib/report-api';
import { useVisiblePolling } from '@/hooks/useVisiblePolling';
import type { AdminReport, AdminReportStatus, AdminReportTargetType } from '@/types/admin';
import { AdminFilterSelect } from '../../_components/AdminFilterSelect';
import { AdminPagination } from '../../_components/AdminPagination';
import { AdminRefreshStatus } from '../../_components/AdminRefreshStatus';
import { AdminStatePanel } from '../../_components/AdminStatePanel';
import { AdminStatusBadge } from '../../_components/AdminStatusBadge';
import {
  mapAdminReport,
  statusCodeByLabel,
  targetTypeCodeByLabel,
} from '../_utils/report-mapper';

const PAGE_SIZE = 5;

const targetTypeLabels: readonly AdminReportTargetType[] = ['게시글', '댓글', '사용자', '멘토링', '메시지'];


const statusTones: Record<AdminReportStatus, 'warning' | 'info' | 'success' | 'neutral'> = {
  접수: 'warning',
  '검토 중': 'info',
  '처리 완료': 'success',
  반려: 'neutral',
};
const statusLabels = Object.keys(statusCodeByLabel) as AdminReportStatus[];

export function AdminReportsManagement() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get('keyword')?.trim() ?? '');
  const [status, setStatus] = useState('');
  const [reason, setReason] = useState('');
  const [targetType, setTargetType] = useState('');
  const [sort, setSort] = useState('최신순');
  const [currentPage, setCurrentPage] = useState(0);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingReportId, setPendingReportId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [reasonOptions, setReasonOptions] = useState<ReportReason[]>([]);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [reasonReloadKey, setReasonReloadKey] = useState(0);
  const requestControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const requestInFlightRef = useRef(false);

  const loadReports = useCallback(async (background = false, force = false) => {
    if (background && requestInFlightRef.current && !force) return;

    requestControllerRef.current?.abort();
    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    requestControllerRef.current = controller;
    requestInFlightRef.current = true;

    if (background) {
      setIsRefreshing(true);
      setRefreshError(null);
    } else {
      setLoading(true);
      setLoadError(null);
    }

    try {
      const response = await fetchAdminReports({
        status: status ? statusCodeByLabel[status as AdminReportStatus] : undefined,
        targetType: targetType
          ? targetTypeCodeByLabel[targetType as AdminReportTargetType]
          : undefined,
        reasonCode: reason ? reason as AdminReportReasonCode : undefined,
        keyword: query,
        page: currentPage,
        size: PAGE_SIZE,
        sort: sort === '오래된순' ? 'createdAt,asc' : 'createdAt,desc',
      }, controller.signal);

      if (requestId !== requestIdRef.current) return;

      if (currentPage > 0 && currentPage >= response.totalPages) {
        setCurrentPage(Math.max(response.totalPages - 1, 0));
        return;
      }

      setReports(response.content.map((report) => mapAdminReport(report)));
      setTotalPages(response.totalPages);
      setTotalItems(response.totalElements);
      setLoadError(null);
      setRefreshError(null);
      setLastUpdatedAt(new Date());
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (requestId !== requestIdRef.current) return;

      const message = error instanceof Error ? error.message : '신고 목록을 불러오지 못했습니다.';
      if (background) {
        setRefreshError(message);
      } else {
        setReports([]);
        setTotalPages(0);
        setTotalItems(0);
        setLoadError(message);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        requestInFlightRef.current = false;
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [currentPage, query, reason, sort, status, targetType]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadReports(false);
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      requestControllerRef.current?.abort();
    };
  }, [loadReports]);

  useEffect(() => {
    const controller = new AbortController();
    setReasonError(null);

    void fetchReportReasons(controller.signal)
      .then((reasons) => {
        setReasonOptions(reasons);
        setReason((current) => (
          current && !reasons.some((option) => option.code === current) ? '' : current
        ));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setReasonOptions([]);
        setReasonError(error instanceof Error ? error.message : '신고 사유를 불러오지 못했습니다.');
      });

    return () => controller.abort();
  }, [reasonReloadKey]);

  useVisiblePolling(
    () => loadReports(true),
    { enabled: pendingReportId === null, intervalMs: 30_000 },
  );

  const safePage = Math.min(currentPage, Math.max(totalPages - 1, 0));

  const changeFilter = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setCurrentPage(0);
  };
  const changeReportStatus = async (
    report: AdminReport,
    nextStatus: AdminReportStatus,
  ) => {
    const reportUuid = report.reportUuid;
    if (!reportUuid) {
      setActionError('실제 API에서 조회한 신고만 상태를 변경할 수 있습니다.');
      return;
    }
    if (pendingReportId || nextStatus === report.status) return;

    setPendingReportId(reportUuid);
    setActionError(null);

    try {
      await updateAdminReportStatus(
        reportUuid,
        statusCodeByLabel[nextStatus],
      );
      await loadReports(true, true);
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : '신고 상태를 변경하지 못했습니다.');
    } finally {
      setPendingReportId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] p-4 sm:p-6 lg:p-8">
      <section
        className="rounded-[20px] border border-[#e4e7ec] bg-white p-[17px] shadow-[0_1px_1px_rgba(16,24,40,0.04)]"
        aria-label="신고 검색 및 필터"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(260px,1.6fr)_repeat(3,minmax(150px,1fr))_120px]">
          <label className="relative block min-w-0 sm:col-span-2 xl:col-span-1">
            <span className="sr-only">신고 검색</span>
            <Search className="pointer-events-none absolute top-3 left-3 size-4 text-[#98a2b3]" strokeWidth={1.7} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setCurrentPage(0);
              }}
              placeholder="신고 ID · 상세 내용 · 신고자 닉네임 검색"
              className="h-10 w-full rounded-2xl border border-[#d0d5dd] bg-white pr-[13px] pl-[37px] text-sm text-[#172033] outline-none transition placeholder:text-[rgba(23,32,51,0.5)] focus:border-[#315ef5] focus:ring-2 focus:ring-[#315ef5]/10 dark:!border-[#d0d5dd] dark:!bg-white dark:!text-[#172033]"
            />
          </label>
          <AdminFilterSelect label="전체 상태" value={status} onChange={changeFilter(setStatus)} options={['접수', '검토 중', '처리 완료', '반려']} />
          <AdminFilterSelect
            label={reasonError ? '사유 조회 실패' : '전체 사유'}
            value={reason}
            onChange={changeFilter(setReason)}
            options={reasonOptions.map((option) => ({ value: option.code, label: option.label }))}
            disabled={Boolean(reasonError)}
          />
          <AdminFilterSelect label="전체 유형" value={targetType} onChange={changeFilter(setTargetType)} options={targetTypeLabels} />
          <AdminFilterSelect label="정렬" value={sort} onChange={changeFilter(setSort)} options={['최신순', '오래된순']} />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            {reasonError ? (
              <p className="text-xs text-[#b42318]" role="alert">
                신고 사유를 불러오지 못했습니다.
                <button
                  type="button"
                  onClick={() => setReasonReloadKey((current) => current + 1)}
                  className="ml-2 font-semibold underline underline-offset-2"
                >
                  다시 시도
                </button>
              </p>
            ) : null}
          </div>
          <AdminRefreshStatus
            isRefreshing={isRefreshing}
            lastUpdatedAt={lastUpdatedAt}
            onRefresh={() => void loadReports(true)}
          />
        </div>
      </section>
      {actionError ? (
        <p className="mt-3 rounded-2xl border border-[#fecdca] bg-[#fef3f2] px-4 py-3 text-sm text-[#b42318]" role="alert">
          {actionError}
        </p>
      ) : null}
      {refreshError ? (
        <p className="mt-3 rounded-2xl border border-[#fedf89] bg-[#fffaeb] px-4 py-3 text-sm text-[#b54708]" role="status">
          기존 목록을 유지했습니다. 새 데이터를 확인하지 못했습니다: {refreshError}
        </p>
      ) : null}

      <section className="mt-5 min-h-[500px] overflow-hidden rounded-[20px] border border-[#e4e7ec] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {loading ? (
          <AdminStatePanel state="loading" title="신고 목록을 불러오는 중입니다." />
        ) : loadError ? (
          <AdminStatePanel
            state="error"
            title="신고 목록을 불러오지 못했습니다."
            description={loadError}
            onRetry={() => void loadReports(false)}
          />
        ) : reports.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1134px] table-fixed border-collapse">
              <colgroup>
                <col className="w-[10.66%]" />
                <col className="w-[22.02%]" />
                <col className="w-[12.27%]" />
                <col className="w-[10.71%]" />
                <col className="w-[11.05%]" />
                <col className="w-[10.28%]" />
                <col className="w-[15.29%]" />
                <col className="w-[7.72%]" />
              </colgroup>
              <thead>
                <tr className="h-[42px] border-b border-[#f2f4f7] bg-[#fcfcfd] text-left text-xs leading-[18px] font-bold text-[#667085]">
                  <th className="px-5 font-bold">신고 ID</th>
                  <th className="font-bold">신고 대상</th>
                  <th className="font-bold">신고 사유</th>
                  <th className="font-bold">상태</th>
                  <th className="font-bold">신고자</th>
                  <th className="font-bold">담당 관리자</th>
                  <th className="font-bold">접수 시각</th>
                  <th className="pr-5 text-right font-bold">상태 변경</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.reportUuid} className="h-[77px] border-b border-[#f2f4f7] last:border-b-0">
                    <td className="px-5 font-mono text-xs font-bold text-[#315ef5]">{report.id}</td>
                    <td>
                      <div className="flex flex-col items-start gap-1">
                        <span className="rounded bg-[#f2f4f7] px-1.5 py-0.5 text-[11px] font-semibold text-[#667085]">{report.targetType}</span>
                        <p className="max-w-[220px] truncate text-[13px] font-medium text-[#172033]">{report.target}</p>
                      </div>
                    </td>
                    <td className="truncate text-[13px] text-[#344054]">{report.reason}</td>
                    <td><AdminStatusBadge label={report.status} tone={statusTones[report.status]} /></td>
                    <td className="truncate text-[13px] text-[#667085]">{report.reporter}</td>
                    <td className={`truncate text-[13px] ${report.administrator === '미배정' ? 'text-[#98a2b3]' : 'text-[#667085]'}`}>{report.administrator}</td>
                    <td className="text-[13px] whitespace-nowrap text-[#98a2b3]">{report.receivedAt}</td>
                    <td className="pr-5 text-right">
                      <select
                        aria-label={`${report.id} 상태 변경`}
                        value={report.status}
                        disabled={pendingReportId !== null}
                        onChange={(event) => {
                          void changeReportStatus(report, event.target.value as AdminReportStatus);
                        }}
                        className="h-9 rounded-xl border border-[#d0d5dd] bg-white px-2 text-xs font-semibold text-[#344054] outline-none focus:border-[#315ef5] focus:ring-2 focus:ring-[#315ef5]/10 disabled:cursor-wait disabled:bg-[#f2f4f7]"
                      >
                        {statusLabels.map((label) => (
                          <option key={label} value={label}>{label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <AdminStatePanel
            state="empty"
            title="조건에 맞는 신고가 없습니다."
            description="검색어나 필터를 변경한 뒤 다시 확인해주세요."
          />
        )}

        <AdminPagination
          currentPage={safePage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={PAGE_SIZE}
          itemLabel="건"
          onPageChange={setCurrentPage}
        />
      </section>
    </div>
  );
}
