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
import { useVisiblePolling } from '@/hooks/useVisiblePolling';
import type { AdminReport, AdminReportStatus } from '@/types/admin';
import { dashboardReportReasons, dashboardSummaryCards } from '../_data/dashboard';
import { mapAdminReport } from '../reports/_utils/report-mapper';
import { AdminDemoNotice } from './AdminDemoNotice';
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
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="관리 현황 요약">
      {dashboardSummaryCards.map((card) => {
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
              <strong className="text-[28px] leading-[42px] font-bold text-[#172033]">{card.value}</strong>
              <span className="text-[15px] leading-[22.5px] font-medium text-[#667085]">건</span>
            </p>
            <h2 className="text-sm leading-[21px] font-semibold text-[#344054]">{card.label}</h2>
            <p className="text-xs leading-[18px] font-medium text-[#98a2b3]">{card.description}</p>
          </article>
        );
      })}
    </section>
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
      setReports(response.content.map((report) => mapAdminReport(report)));
      setLoadError(null);
      setRefreshError(null);
      setLastUpdatedAt(new Date());
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      const message = error instanceof Error ? error.message : '최근 신고를 불러오지 못했습니다.';
      if (initial) {
        setReports([]);
        setLoadError(message);
      } else {
        setRefreshError(message);
      }
    } finally {
      requestInFlightRef.current = false;
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadReports(true);
    return () => requestControllerRef.current?.abort();
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

function ReportReasonsCard() {
  const maximumCount = Math.max(...dashboardReportReasons.map((reason) => reason.count));

  return (
    <section className="min-h-[515px] rounded-[20px] border border-[#e4e7ec] bg-white p-[21px] shadow-[0_1px_1px_rgba(16,24,40,0.04)]">
      <h2 className="text-base leading-6 font-bold text-[#172033]">신고 사유 분포</h2>
      <p className="text-xs leading-[18px] text-[#98a2b3]">최근 30일 기준</p>
      <div className="pt-4">
        {dashboardReportReasons.map((reason, index) => (
          <div key={reason.label} className={index === 0 ? '' : 'pt-4'}>
            <div className="flex items-center justify-between text-[13px] leading-[19.5px]">
              <span className="font-medium text-[#344054]">{reason.label}</span>
              <span className="font-semibold text-[#667085]">{reason.count}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#f2f4f7]">
              <div className="h-full rounded-full bg-[#315ef5]" style={{ width: `${(reason.count / maximumCount) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AdminDashboard() {
  return (
    <AdminShell activePage="dashboard" title="대시보드" description="관리자 시스템의 주요 현황을 확인하세요." showRefresh={false}>
      <div className="w-full p-4 sm:p-6 lg:p-8">
        <AdminDemoNotice description="요약 카드와 신고 사유 분포는 통계 API 연결 전 예시 데이터입니다. 최근 신고 목록은 관리자 신고 API에서 불러옵니다." />
        <SummaryCards />
        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.85fr)_minmax(300px,1fr)]">
          <RecentReportsCard />
          <ReportReasonsCard />
        </div>
      </div>
    </AdminShell>
  );
}
