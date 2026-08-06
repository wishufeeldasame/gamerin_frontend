'use client';

import { Search } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { AdminReportReason, AdminReportStatus } from '@/types/admin';
import { AdminFilterSelect } from '../../_components/AdminFilterSelect';
import { AdminPagination } from '../../_components/AdminPagination';
import { AdminStatePanel } from '../../_components/AdminStatePanel';
import { AdminStatusBadge } from '../../_components/AdminStatusBadge';
import { reports } from '../_data/reports';

const PAGE_SIZE = 5;

const reportReasons: readonly AdminReportReason[] = [
  '광고·홍보',
  '욕설·비하·혐오',
  '음란·성적 콘텐츠',
  '도배·시스템 악용',
  '사기·거래 피해',
  '기타',
];

const statusTones: Record<AdminReportStatus, 'warning' | 'info' | 'success' | 'neutral'> = {
  접수: 'warning',
  '검토 중': 'info',
  '처리 완료': 'success',
  반려: 'neutral',
};

export function AdminReportsManagement() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [reason, setReason] = useState('');
  const [targetType, setTargetType] = useState('');
  const [sort, setSort] = useState('최신순');
  const [currentPage, setCurrentPage] = useState(0);

  const filteredReports = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const result = reports.filter((report) => {
      const matchesQuery =
        !normalizedQuery ||
        report.id.toLowerCase().includes(normalizedQuery) ||
        report.target.toLowerCase().includes(normalizedQuery) ||
        report.reporter.toLowerCase().includes(normalizedQuery);

      return (
        matchesQuery &&
        (!status || report.status === status) &&
        (!reason || report.reason === reason) &&
        (!targetType || report.targetType === targetType)
      );
    });

    return sort === '오래된순' ? [...result].reverse() : result;
  }, [query, reason, sort, status, targetType]);

  const totalPages = Math.ceil(filteredReports.length / PAGE_SIZE);
  const safePage = Math.min(currentPage, Math.max(totalPages - 1, 0));
  const paginatedReports = filteredReports.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const changeFilter = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setCurrentPage(0);
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
              placeholder="신고 ID · 대상 · 신고자 검색"
              className="h-10 w-full rounded-2xl border border-[#d0d5dd] bg-white pr-[13px] pl-[37px] text-sm text-[#172033] outline-none transition placeholder:text-[rgba(23,32,51,0.5)] focus:border-[#315ef5] focus:ring-2 focus:ring-[#315ef5]/10 dark:!border-[#d0d5dd] dark:!bg-white dark:!text-[#172033]"
            />
          </label>
          <AdminFilterSelect label="전체 상태" value={status} onChange={changeFilter(setStatus)} options={['접수', '검토 중', '처리 완료', '반려']} />
          <AdminFilterSelect label="전체 사유" value={reason} onChange={changeFilter(setReason)} options={reportReasons} />
          <AdminFilterSelect label="전체 유형" value={targetType} onChange={changeFilter(setTargetType)} options={['게시글', '댓글', '사용자', '메시지']} />
          <AdminFilterSelect label="정렬" value={sort} onChange={changeFilter(setSort)} options={['최신순', '오래된순']} />
        </div>
      </section>

      <section className="mt-5 min-h-[500px] overflow-hidden rounded-[20px] border border-[#e4e7ec] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {paginatedReports.length > 0 ? (
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
                  <th className="pr-5 text-right font-bold">상세</th>
                </tr>
              </thead>
              <tbody>
                {paginatedReports.map((report) => (
                  <tr key={report.id} className="h-[77px] border-b border-[#f2f4f7] last:border-b-0">
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
                      <Link href={`/admin/reports/${report.id}`} className="inline-flex rounded-2xl bg-[#eef3ff] px-2.5 py-1.5 text-xs font-semibold text-[#1d46c7] transition hover:bg-[#dfe8ff]">
                        상세 보기
                      </Link>
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
          totalItems={filteredReports.length}
          pageSize={PAGE_SIZE}
          itemLabel="건"
          onPageChange={setCurrentPage}
        />
      </section>
    </div>
  );
}
