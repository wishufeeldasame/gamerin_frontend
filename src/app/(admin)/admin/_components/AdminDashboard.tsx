'use client';

import {
  ArrowUpRight,
  CircleCheck,
  Clock3,
  Eye,
  UserRoundX,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAdminReports } from '@/lib/admin-report-api';
import { fetchAdminDashboardStats, type AdminDashboardStats } from '@/lib/admin-dashboard-api';
import { useVisiblePolling } from '@/hooks/useVisiblePolling';
import type { AdminReport, AdminReportStatus } from '@/types/admin';
import { mapAdminReport } from '../reports/_utils/report-mapper';
import { AdminRefreshStatus } from './AdminRefreshStatus';
import { AdminStatusBadge } from './AdminStatusBadge';
import { AdminStatePanel } from './AdminStatePanel';
import { AdminShell } from './AdminShell';

const summaryIcons = {
  clock: Clock3,
  review: Eye,
  complete: CircleCheck,
  suspended: UserRoundX,
};

const statusTones: Record<AdminReportStatus, 'warning' | 'info' | 'success' | 'neutral'> = {
  접수: 'warning',
  '검토 중': 'info',
  '처리 완료': 'success',
  반려: 'neutral',
};

function SummaryCards() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void fetchAdminDashboardStats(controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        setStats(response);
        setLastUpdatedAt(new Date());
      })
      .catch((failure: unknown) => {
        if (controller.signal.aborted || (failure instanceof Error && failure.name === 'AbortError')) return;
        setError(failure instanceof Error ? failure.message : '관리 현황을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision]);

  useVisiblePolling(() => setRevision((current) => current + 1), { enabled: !loading });

  if (!stats) {
    return <AdminStatePanel state={loading ? 'loading' : 'error'} title={loading ? '관리 현황을 불러오는 중입니다.' : '관리 현황을 불러오지 못했습니다.'} description={error ?? undefined} onRetry={() => setRevision((current) => current + 1)} />;
  }

  const cards = [
    { label: '접수 대기 신고', value: stats.receivedReportsCount, icon: 'clock' as const, description: '접수 상태인 신고', unit: '건', iconBackground: '#fff4ed', iconColor: '#f79009' },
    { label: '검토 중 신고', value: stats.inReviewReportsCount, icon: 'review' as const, description: '관리자가 검토 중인 신고', unit: '건', iconBackground: '#eef4ff', iconColor: '#315ef5' },
    { label: '처리 완료 상태 신고', value: stats.resolvedReportsCount, icon: 'complete' as const, description: '현재 처리 완료 상태인 신고 수', unit: '건', iconBackground: '#ecfdf3', iconColor: '#12b76a' },
    { label: '활성 제재 사용자', value: stats.activePenaltiesCount, icon: 'suspended' as const, description: '경고를 포함한 활성 제재 사용자', unit: '명', iconBackground: '#fef3f2', iconColor: '#f04438' },
  ];

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <AdminRefreshStatus isRefreshing={loading} lastUpdatedAt={lastUpdatedAt} onRefresh={() => setRevision((current) => current + 1)} />
      </div>
      {error ? <p className="mb-3 text-sm text-[#b54708]" role="status">기존 현황을 유지했습니다. {error}</p> : null}
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="관리 현황 요약">
      {cards.map((card) => {
        const Icon = summaryIcons[card.icon];

        return (
          <article
            key={card.label}
            className="flex min-h-[160px] flex-col justify-center rounded-[20px] border border-[#e4e7ec] bg-white p-[21px] shadow-[0_1px_1px_rgba(16,24,40,0.04)] xl:min-h-[181px]"
          >
            <div className="flex items-center justify-between">
              <div
                className="grid size-10 place-items-center rounded-2xl"
                style={{ backgroundColor: card.iconBackground, color: card.iconColor }}
              >
                <Icon className="size-5" strokeWidth={1.7} aria-hidden="true" />
              </div>
              <ArrowUpRight className="size-4 text-[#98a2b3]" strokeWidth={1.7} aria-hidden="true" />
            </div>
            <p className="mt-4 flex items-baseline gap-0.5 tracking-[-0.7px]">
              <strong className="text-[28px] leading-[42px] font-bold text-[#172033]">{card.value.toLocaleString('ko-KR')}</strong>
              <span className="text-[15px] leading-[22.5px] font-medium text-[#667085]">{card.unit}</span>
            </p>
            <h2 className="text-sm leading-[21px] font-semibold text-[#344054]">{card.label}</h2>
            <p className="text-xs leading-[18px] font-medium text-[#98a2b3]">{card.description}</p>
          </article>
        );
      })}
    </section>
    </div>
  );
}

function RecentReportsCard() {
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const requestControllerRef = useRef<AbortController | null>(null);
  const requestInFlightRef = useRef(false);

  const loadReports = useCallback(async (initial = false) => {
    if (requestInFlightRef.current) return;

    const controller = new AbortController();
    requestControllerRef.current = controller;
    requestInFlightRef.current = true;
    if (initial) {
      setLoading(true);
      setLoadError(null);
    } else {
      setIsRefreshing(true);
      setRefreshError(null);
    }

    try {
      const response = await fetchAdminReports(
        { page: 0, size: 10, sort: 'createdAt,desc' },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setReports(response.content.map((report) => mapAdminReport(report)));
      setLoadError(null);
      setRefreshError(null);
      setLastUpdatedAt(new Date());
    } catch (error: unknown) {
      if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) return;
      const message = error instanceof Error ? error.message : '최근 신고를 불러오지 못했습니다.';
      if (initial) {
        setReports([]);
        setLoadError(message);
      } else {
        setRefreshError(message);
      }
    } finally {
      if (requestControllerRef.current === controller) {
        requestInFlightRef.current = false;
        if (!controller.signal.aborted) {
          setLoading(false);
          setIsRefreshing(false);
        }
      }
    }
  }, []);

  useEffect(() => {
    void loadReports(true);
    return () => {
      requestControllerRef.current?.abort();
      requestInFlightRef.current = false;
    };
  }, [loadReports]);

  useVisiblePolling(() => loadReports(false), { intervalMs: 30_000 });

  return (
    <section className="overflow-hidden rounded-[20px] border border-[#e4e7ec] bg-white shadow-[0_1px_1px_rgba(16,24,40,0.04)]">
      <div className="flex min-h-[58px] flex-wrap items-center justify-between gap-3 border-b border-[#f2f4f7] px-5 py-2">
        <h2 className="text-base leading-6 font-bold text-[#172033]">최근 신고</h2>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <AdminRefreshStatus
            isRefreshing={isRefreshing}
            lastUpdatedAt={lastUpdatedAt}
            onRefresh={() => void loadReports(false)}
          />
          <Link
            href="/admin/reports"
            className="text-[13px] leading-[19.5px] font-semibold text-[#315ef5] hover:underline"
          >
            전체 보기
          </Link>
        </div>
      </div>

      {loading ? (
        <AdminStatePanel state="loading" title="최근 신고를 불러오는 중입니다." compact />
      ) : loadError ? (
        <AdminStatePanel
          state="error"
          title="최근 신고를 불러오지 못했습니다."
          description={loadError}
          onRetry={() => void loadReports(true)}
          compact
        />
      ) : refreshError && reports.length === 0 ? (
        <AdminStatePanel
          state="error"
          title="최근 신고를 새로 확인하지 못했습니다."
          description={refreshError}
          onRetry={() => void loadReports(false)}
          compact
        />
      ) : reports.length === 0 ? (
        <AdminStatePanel state="empty" title="접수된 신고가 없습니다." compact />
      ) : (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[709px] table-fixed border-collapse">
          <colgroup>
            <col className="w-[34.44%]" />
            <col className="w-[16.98%]" />
            <col className="w-[14.82%]" />
            <col className="w-[16.86%]" />
            <col className="w-[16.9%]" />
          </colgroup>
          <thead>
            <tr className="h-[42px] border-b border-[#f2f4f7] text-left text-xs leading-[18px] font-bold text-[#667085]">
              <th className="px-5 font-bold">신고 대상</th>
              <th className="font-bold">신고 사유</th>
              <th className="font-bold">상태</th>
              <th className="font-bold">신고자</th>
              <th className="pr-5 text-right font-bold">접수 시각</th>
            </tr>
          </thead>
          <tbody>
            {reports.slice(0, 10).map((report) => (
              <tr key={report.id} className="h-[69px] border-b border-[#f2f4f7] last:border-b-0">
                <td className="px-5">
                  <div className="flex min-w-0 flex-col items-start gap-0.5">
                    <span className="rounded bg-[#f2f4f7] px-1.5 py-0.5 text-[11px] leading-[16.5px] font-semibold text-[#667085]">
                      {report.targetType}
                    </span>
                    <p className="w-full truncate text-[13px] leading-[19.5px] font-medium text-[#172033]">
                      {report.target}
                    </p>
                  </div>
                </td>
                <td className="truncate text-[13px] leading-[19.5px] text-[#344054]">{report.reason}</td>
                <td><AdminStatusBadge label={report.status} tone={statusTones[report.status]} /></td>
                <td className="truncate text-[13px] leading-[19.5px] text-[#667085]">{report.reporter}</td>
                <td className="pr-5 text-right text-[13px] leading-[19.5px] whitespace-nowrap text-[#98a2b3]">
                  {report.receivedAt}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
      {refreshError && reports.length > 0 ? (
        <p className="border-t border-[#fedf89] bg-[#fffaeb] px-5 py-2 text-xs text-[#b54708]" role="status">
          기존 목록을 유지했습니다. 새 데이터를 확인하지 못했습니다.
        </p>
      ) : null}
    </section>
  );
}

export function AdminDashboard() {
  return (
    <AdminShell activePage="dashboard" title="대시보드" description="관리자 시스템의 주요 현황을 확인하세요." showRefresh={false}>
      <div className="w-full p-4 sm:p-6 lg:p-8">
        <SummaryCards />
        <div className="mt-6">
          <RecentReportsCard />
        </div>
      </div>
    </AdminShell>
  );
}
