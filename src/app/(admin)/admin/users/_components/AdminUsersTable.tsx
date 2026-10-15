'use client';

import { ChevronDown, Search } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { fetchAdminUsers, type AdminUserResponse, type AdminUserStatus } from '@/lib/admin-user-api';
import type { PageResponse } from '@/types/api';
import { AdminPagination } from '../../_components/AdminPagination';
import { AdminStatePanel } from '../../_components/AdminStatePanel';
import { AdminStatusBadge } from '../../_components/AdminStatusBadge';

const PAGE_SIZE = 6;
const statusLabels: Record<AdminUserStatus, string> = { ACTIVE: '활성', SUSPENDED: '정지', DELETED: '탈퇴' };

export function AdminUsersTable() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<AdminUserStatus | ''>('');
  const [sanction, setSanction] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ key: string; data: PageResponse<AdminUserResponse> | null; error: string | null }>({ key: '', data: null, error: null });
  const requestSequence = useRef(0);
  const requestKey = JSON.stringify([query, status, sanction, currentPage, retry]);

  useEffect(() => {
    const controller = new AbortController();
    const sequence = ++requestSequence.current;
    setResult({ key: requestKey, data: null, error: null });
    void fetchAdminUsers({
      query, status: status || undefined,
      hasSanction: sanction ? sanction === 'true' : undefined,
      page: currentPage, size: PAGE_SIZE, sort: 'createdAt,desc',
    }, controller.signal).then((data) => {
      if (!controller.signal.aborted && sequence === requestSequence.current) {
        if (currentPage > 0 && currentPage >= Math.max(data.totalPages, 1)) {
          setCurrentPage(Math.max(data.totalPages - 1, 0));
        } else {
          setResult({ key: requestKey, data, error: null });
        }
      }
    }).catch((error: unknown) => {
      if (!controller.signal.aborted && sequence === requestSequence.current && !(error instanceof Error && error.name === 'AbortError')) {
        setResult({ key: requestKey, data: null, error: error instanceof Error ? error.message : '사용자 목록을 불러오지 못했습니다.' });
      }
    });
    return () => controller.abort();
  }, [query, status, sanction, currentPage, retry, requestKey]);

  const data = result.key === requestKey ? result.data : null;
  const error = result.key === requestKey ? result.error : null;

  return (
    <div className='w-full p-4 sm:p-6 lg:p-8'>
      <section className='rounded-[20px] border border-[#e4e7ec] bg-white p-[17px] shadow-[0_1px_1px_rgba(16,24,40,0.04)]' aria-label='사용자 검색 및 필터'>
        <div className='grid grid-cols-1 gap-3 md:grid-cols-3'>
          <label className='relative'>
            <span className='sr-only'>사용자 검색</span>
            <Search className='pointer-events-none absolute top-3 left-3 size-4 text-[#98a2b3]' aria-hidden='true' />
            <input type='search' value={query} onChange={(event) => { setQuery(event.target.value); setCurrentPage(0); }} placeholder='핸들 · 닉네임 검색' className='h-10 w-full rounded-2xl border border-[#d0d5dd] bg-white pr-[13px] pl-[37px] text-sm text-[#172033] outline-none focus:border-[#315ef5] focus:ring-2 focus:ring-[#315ef5]/10' />
          </label>
          <label className='relative'>
            <span className='sr-only'>현재 상태 필터</span>
            <select value={status} onChange={(event) => { setStatus(event.target.value as AdminUserStatus | ''); setCurrentPage(0); }} className='h-10 w-full appearance-none rounded-2xl border border-[#d0d5dd] bg-white px-[13px] text-sm text-[#667085] outline-none focus:border-[#315ef5]'>
              <option value=''>전체 상태</option><option value='ACTIVE'>활성</option><option value='SUSPENDED'>정지</option><option value='DELETED'>탈퇴</option>
            </select>
            <ChevronDown className='pointer-events-none absolute top-3 right-3 size-4 text-[#98a2b3]' aria-hidden='true' />
          </label>
          <label className='relative'>
            <span className='sr-only'>활성 제재 필터</span>
            <select value={sanction} onChange={(event) => { setSanction(event.target.value); setCurrentPage(0); }} className='h-10 w-full appearance-none rounded-2xl border border-[#d0d5dd] bg-white px-[13px] text-sm text-[#667085] outline-none focus:border-[#315ef5]'>
              <option value=''>전체 제재</option><option value='true'>제재 있음</option><option value='false'>제재 없음</option>
            </select>
            <ChevronDown className='pointer-events-none absolute top-3 right-3 size-4 text-[#98a2b3]' aria-hidden='true' />
          </label>
        </div>
      </section>

      <section className='mt-5 min-h-[540px] overflow-hidden rounded-[20px] border border-[#e4e7ec] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]' aria-label='사용자 목록'>
        {error ? <AdminStatePanel state='error' description={error} onRetry={() => setRetry((value) => value + 1)} /> : !data ? <AdminStatePanel state='loading' /> : data.content.length === 0 ? <AdminStatePanel state='empty' title='조건에 맞는 사용자가 없습니다.' description='검색어나 필터를 변경해보세요.' /> : (
          <div className='overflow-x-auto'>
            <table className='w-full min-w-[1000px] table-fixed border-collapse'>
              <colgroup><col className='w-[32.3%]' /><col className='w-[12.3%]' /><col className='w-[11.3%]' /><col className='w-[12.3%]' /><col className='w-[15%]' /><col className='w-[17.2%]' /></colgroup>
              <thead><tr className='h-[42px] border-b border-[#f2f4f7] bg-[#fcfcfd] text-left text-xs font-bold text-[#667085]'><th className='px-5'>사용자</th><th>현재 상태</th><th title='사용자를 직접 대상으로 한 신고 수'>받은 신고</th><th>활성 제재</th><th>가입일</th><th className='pr-5 text-right'>상세</th></tr></thead>
              <tbody>{data.content.map((user) => (
                <tr key={user.id} className='h-[70.5px] border-b border-[#f2f4f7] last:border-b-0'>
                  <td className='px-5'><div className='flex items-center gap-3'><span className='relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[#315ef5] text-sm font-bold text-white'>{user.profileImageUrl ? <Image src={user.profileImageUrl} alt='' fill unoptimized className='object-cover' /> : user.nickname.slice(0, 1)}</span><span className='min-w-0'><span className='flex items-center gap-1.5'><span className='truncate text-[13px] font-semibold text-[#172033]'>{user.nickname}</span>{user.role === 'ADMIN' ? <span className='rounded bg-[#eef3ff] px-1.5 py-0.5 text-[10px] font-semibold text-[#1d46c7]'>관리자</span> : null}</span><span className='block text-xs text-[#667085]'>@{user.handle}</span></span></div></td>
                  <td><AdminStatusBadge label={statusLabels[user.status] ?? '확인 필요'} tone={user.status === 'ACTIVE' ? 'success' : 'warning'} /></td>
                  <td className='text-[13px] text-[#344054]'>{user.reportsReceivedCount}회</td>
                  <td className='text-[13px] text-[#344054]'>{user.activeSanction || '없음'}</td>
                  <td className='text-[13px] text-[#98a2b3]'>{new Date(user.createdAt).toLocaleDateString('ko-KR')}</td>
                  <td className='pr-5 text-right'><Link href={`/admin/users/${encodeURIComponent(user.handle)}`} className='inline-flex rounded-2xl bg-[#eef3ff] px-2.5 py-1.5 text-xs font-semibold text-[#1d46c7] hover:bg-[#dfe8ff]'>상세 보기</Link></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {data ? <AdminPagination currentPage={data.number} totalPages={data.totalPages} totalItems={data.totalElements} pageSize={data.size} itemLabel='명' onPageChange={setCurrentPage} /> : null}
      </section>
    </div>
  );
}
