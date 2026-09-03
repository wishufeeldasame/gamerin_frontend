'use client';

import { ChevronDown, Search } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AdminPagination } from '../../_components/AdminPagination';
import { AdminStatePanel } from '../../_components/AdminStatePanel';
import { AdminStatusBadge } from '../../_components/AdminStatusBadge';
import { adminUsers } from '../_data/admin-users';

const PAGE_SIZE = 6;

export function AdminUsersTable() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [sanction, setSanction] = useState('');
  const [currentPage, setCurrentPage] = useState(0);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase().replace(/^@/, '');
    return adminUsers.filter((user) => {
      const matchesQuery = !normalizedQuery || user.name.toLowerCase().includes(normalizedQuery) || user.handle.toLowerCase().includes(normalizedQuery);
      const matchesStatus = !status || user.status === status;
      const matchesSanction = !sanction || (sanction === '없음' ? user.sanction === '없음' : user.sanction !== '없음');
      return matchesQuery && matchesStatus && matchesSanction;
    });
  }, [query, sanction, status]);

  const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE);
  const safePage = Math.min(currentPage, Math.max(totalPages - 1, 0));
  const visibleUsers = filteredUsers.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8">
      <section className="rounded-[20px] border border-[#e4e7ec] bg-white p-[17px] shadow-[0_1px_1px_rgba(16,24,40,0.04)]" aria-label="사용자 검색 및 필터">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="relative md:col-span-1">
            <span className="sr-only">사용자 검색</span>
            <Search className="pointer-events-none absolute top-3 left-3 size-4 text-[#98a2b3]" strokeWidth={1.7} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => { setQuery(event.target.value); setCurrentPage(0); }}
              placeholder="Handle · Nickname 검색"
              className="h-10 w-full rounded-2xl border border-[#d0d5dd] bg-white pr-[13px] pl-[37px] text-sm text-[#172033] outline-none transition focus:border-[#315ef5] focus:ring-2 focus:ring-[#315ef5]/10"
            />
          </label>
          <label className="relative">
            <span className="sr-only">현재 상태 필터</span>
            <select value={status} onChange={(event) => { setStatus(event.target.value); setCurrentPage(0); }} className="h-10 w-full appearance-none rounded-2xl border border-[#d0d5dd] bg-white px-[13px] text-sm text-[#667085] outline-none focus:border-[#315ef5]">
              <option value="">전체 상태</option><option value="활성">활성</option><option value="정지">정지</option>
            </select>
            <ChevronDown className="pointer-events-none absolute top-3 right-3 size-4 text-[#98a2b3]" strokeWidth={1.7} aria-hidden="true" />
          </label>
          <label className="relative">
            <span className="sr-only">활성 제재 필터</span>
            <select value={sanction} onChange={(event) => { setSanction(event.target.value); setCurrentPage(0); }} className="h-10 w-full appearance-none rounded-2xl border border-[#d0d5dd] bg-white px-[13px] text-sm text-[#667085] outline-none focus:border-[#315ef5]">
              <option value="">전체 제재</option><option value="있음">제재 있음</option><option value="없음">제재 없음</option>
            </select>
            <ChevronDown className="pointer-events-none absolute top-3 right-3 size-4 text-[#98a2b3]" strokeWidth={1.7} aria-hidden="true" />
          </label>
        </div>
      </section>

      <section className="mt-5 min-h-[540px] overflow-hidden rounded-[20px] border border-[#e4e7ec] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {visibleUsers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] table-fixed border-collapse">
              <colgroup><col className="w-[32.3%]" /><col className="w-[12.3%]" /><col className="w-[11.3%]" /><col className="w-[12.3%]" /><col className="w-[15%]" /><col className="w-[17.2%]" /></colgroup>
              <thead><tr className="h-[42px] border-b border-[#f2f4f7] bg-[#fcfcfd] text-left text-xs font-bold text-[#667085]"><th className="px-5">사용자</th><th>현재 상태</th><th>받은 신고</th><th>활성 제재</th><th>가입일</th><th className="pr-5 text-right">상세</th></tr></thead>
              <tbody>
                {visibleUsers.map((user) => (
                  <tr key={user.handle} className="h-[70.5px] border-b border-[#f2f4f7] last:border-b-0">
                    <td className="px-5"><div className="flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full text-[14.4px] font-bold text-white" style={{ backgroundColor: user.avatarColor }}>{user.initial}</span><span className="min-w-0"><span className="flex items-center gap-1.5"><span className="truncate text-[13px] font-semibold text-[#172033]">{user.name}</span>{user.role === '관리자' ? <span className="rounded bg-[#eef3ff] px-1.5 py-0.5 text-[10px] font-semibold text-[#1d46c7]">관리자</span> : null}</span><span className="block text-xs text-[#667085]">@{user.handle}</span></span></div></td>
                    <td><AdminStatusBadge label={user.status} tone={user.status === '활성' ? 'success' : 'warning'} /></td>
                    <td className={`text-[13px] ${user.reports >= 6 ? 'font-semibold text-[#b42318]' : 'text-[#344054]'}`}>{user.reports}회</td>
                    <td className={`text-[13px] ${user.sanction === '없음' ? 'text-[#98a2b3]' : 'text-[#344054]'}`}>{user.sanction}</td>
                    <td className="text-[13px] text-[#98a2b3]">{user.registeredAt}</td>
                    <td className="pr-5 text-right"><Link href={`/admin/users/${user.handle}`} className="inline-flex rounded-2xl bg-[#eef3ff] px-2.5 py-1.5 text-xs font-semibold text-[#1d46c7] hover:bg-[#dfe8ff]">상세 보기</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <AdminStatePanel state="empty" title="조건에 맞는 사용자가 없습니다." description="검색어나 필터를 변경해보세요." />}

        <AdminPagination currentPage={safePage} totalPages={totalPages} totalItems={filteredUsers.length} pageSize={PAGE_SIZE} itemLabel="명" onPageChange={setCurrentPage} />
      </section>
    </div>
  );
}
