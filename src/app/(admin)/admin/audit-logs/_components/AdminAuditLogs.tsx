'use client';

import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AdminFilterSelect } from '../../_components/AdminFilterSelect';
import { AdminPagination } from '../../_components/AdminPagination';
import { AdminStatePanel } from '../../_components/AdminStatePanel';
import { AdminStatusBadge } from '../../_components/AdminStatusBadge';
import { auditLogs } from '../_data/audit-logs';

const PAGE_SIZE = 6;

function actionTone(action: string) {
  if (action.includes('완료') || action.includes('복구') || action.includes('해제')) return 'success' as const;
  if (action.includes('반려') || action.includes('정지')) return 'warning' as const;
  if (action.includes('숨김')) return 'danger' as const;
  return 'info' as const;
}

export function AdminAuditLogs() {
  const [query, setQuery] = useState('');
  const [administrator, setAdministrator] = useState('');
  const [action, setAction] = useState('');
  const [targetType, setTargetType] = useState('');
  const [currentPage, setCurrentPage] = useState(0);

  const filteredLogs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return auditLogs.filter((log) => {
      const matchesQuery = !normalizedQuery || [log.id, log.targetId, log.reason].some((value) => value.toLowerCase().includes(normalizedQuery));
      return matchesQuery && (!administrator || log.administrator === administrator) && (!action || log.action === action) && (!targetType || log.targetType === targetType);
    });
  }, [action, administrator, query, targetType]);

  const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE);
  const safePage = Math.min(currentPage, Math.max(totalPages - 1, 0));
  const visibleLogs = filteredLogs.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const updateFilter = (setter: (value: string) => void) => (value: string) => { setter(value); setCurrentPage(0); };

  return (
    <div className="mx-auto w-full max-w-[1200px] p-4 sm:p-6 lg:p-8">
      <section className="rounded-[20px] border border-[#e4e7ec] bg-white p-[17px] shadow-[0_1px_1px_rgba(16,24,40,0.04)]" aria-label="작업 이력 검색 및 필터">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(260px,1.5fr)_repeat(3,minmax(160px,1fr))]">
          <label className="relative sm:col-span-2 xl:col-span-1"><span className="sr-only">작업 이력 검색</span><Search className="pointer-events-none absolute top-3 left-3 size-4 text-[#98a2b3]" strokeWidth={1.7} aria-hidden="true" /><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setCurrentPage(0); }} placeholder="이력 ID · 대상 ID · 사유 검색" className="h-10 w-full rounded-2xl border border-[#d0d5dd] bg-white pr-3 pl-[37px] text-sm outline-none focus:border-[#315ef5]" /></label>
          <AdminFilterSelect label="전체 관리자" value={administrator} onChange={updateFilter(setAdministrator)} options={['관리자 김민수', '관리자 이서연']} />
          <AdminFilterSelect label="전체 작업" value={action} onChange={updateFilter(setAction)} options={['신고 검토 시작', '신고 처리 완료', '신고 반려', '콘텐츠 숨김', '콘텐츠 복구', '사용자 경고', '사용자 정지', '정지 해제']} />
          <AdminFilterSelect label="전체 대상" value={targetType} onChange={updateFilter(setTargetType)} options={['신고', '게시글', '댓글', '사용자']} />
        </div>
      </section>

      <section className="mt-5 min-h-[540px] overflow-hidden rounded-[20px] border border-[#e4e7ec] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {visibleLogs.length > 0 ? <div className="overflow-x-auto"><table className="w-full min-w-[1050px] table-fixed border-collapse"><colgroup><col className="w-[10%]" /><col className="w-[14%]" /><col className="w-[16%]" /><col className="w-[11%]" /><col className="w-[13%]" /><col className="w-[23%]" /><col className="w-[13%]" /></colgroup><thead><tr className="h-[42px] border-b border-[#f2f4f7] bg-[#fcfcfd] text-left text-xs font-bold text-[#667085]"><th className="px-5">이력 ID</th><th>관리자</th><th>작업</th><th>대상</th><th>대상 ID</th><th>사유</th><th>처리 시각</th></tr></thead><tbody>{visibleLogs.map((log) => <tr key={log.id} className="h-[72px] border-b border-[#f2f4f7] last:border-b-0"><td className="px-5 font-mono text-xs font-bold text-[#315ef5]">{log.id}</td><td className="text-[13px] text-[#344054]">{log.administrator}</td><td><AdminStatusBadge label={log.action} tone={actionTone(log.action)} /></td><td className="text-[13px] text-[#667085]">{log.targetType}</td><td className="font-mono text-xs text-[#344054]">{log.targetId}</td><td><p className="max-w-[250px] truncate text-[13px] text-[#344054]" title={log.reason}>{log.reason}</p></td><td className="text-[13px] whitespace-nowrap text-[#98a2b3]">{log.createdAt}</td></tr>)}</tbody></table></div> : <AdminStatePanel state="empty" title="조건에 맞는 작업 이력이 없습니다." description="검색어나 필터를 변경해보세요." />}
        <AdminPagination currentPage={safePage} totalPages={totalPages} totalItems={filteredLogs.length} pageSize={PAGE_SIZE} itemLabel="건" onPageChange={setCurrentPage} />
      </section>
    </div>
  );
}
