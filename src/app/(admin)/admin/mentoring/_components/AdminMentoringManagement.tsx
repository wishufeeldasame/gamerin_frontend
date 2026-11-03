'use client';

import { Check, EyeOff, Gamepad2, Search, Star, UserRoundCheck, WalletCards } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  approveAdminMentor,
  fetchAdminMentoringPrograms,
  fetchAdminMentoringSummary,
  fetchAdminMentors,
  hideAdminMentoringProgram,
  rejectAdminMentor,
  updateAdminProgramStatus,
  type AdminMentorApiItem,
  type AdminMentorStatus,
  type AdminMentoringProgramApiItem,
  type AdminMentoringSummary,
  type AdminProgramStatus,
} from '@/lib/admin-mentoring-api';
import type { PageResponse } from '@/types/api';
import { AdminDialog } from '../../_components/AdminDialog';
import { AdminFilterSelect } from '../../_components/AdminFilterSelect';
import { AdminPagination } from '../../_components/AdminPagination';
import { AdminStatePanel } from '../../_components/AdminStatePanel';
import { AdminToast } from '../../_components/AdminToast';
import { mentorStatusLabels, programStatusLabels, type MentoringTab } from '../_data/mentoring';
import { MentorApprovalDialog } from './MentorApprovalDialog';
import { MentoringReasonDialog } from './MentoringReasonDialog';
import { ProgramHideDialog } from './ProgramHideDialog';

const PAGE_SIZE = 20;
const summaryCards = [
  { label: '승인 대기 신청', field: 'pendingMentorCount', unit: '건', icon: UserRoundCheck, style: 'bg-[#fef6e7] text-[#d97706]' },
  { label: '운영 중 프로그램', field: 'activeProgramCount', unit: '개', icon: Gamepad2, style: 'bg-[#eef3ff] text-[#315ef5]' },
  { label: '이번 달 신청 건수', field: 'monthlySessionCount', unit: '건', icon: Star, style: 'bg-[#e7f6ee] text-[#168a4a]' },
  { label: '보관 마일리지', field: 'escrowHeldAmount', unit: 'P', icon: WalletCards, style: 'bg-[#f4ebff] text-[#7f56d9]' },
] as const;

type Selection =
  | { action: 'approve' | 'reject'; item: AdminMentorApiItem }
  | { action: 'hide'; item: AdminMentoringProgramApiItem }
  | { action: 'status'; item: AdminMentoringProgramApiItem; status: AdminProgramStatus };

function StatusBadge({ label, active }: { label: string; active: boolean }) {
  return <span className={'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ' + (active ? 'bg-[#e7f6ee] text-[#087443]' : 'bg-[#f2f4f7] text-[#667085]')}>{label}</span>;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('ko-KR');
}

const actionClassName = 'inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#d0d5dd] bg-white px-3 text-xs font-semibold text-[#344054] transition hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:text-[#98a2b3]';

export function AdminMentoringManagement() {
  const [activeTab, setActiveTab] = useState<MentoringTab>('applications');
  const [mentorStatus, setMentorStatus] = useState<AdminMentorStatus | ''>('');
  const [programStatus, setProgramStatus] = useState<AdminProgramStatus | ''>('');
  const [query, setQuery] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(0);
  const [mentorPage, setMentorPage] = useState<PageResponse<AdminMentorApiItem> | null>(null);
  const [programPage, setProgramPage] = useState<PageResponse<AdminMentoringProgramApiItem> | null>(null);
  const [dataKey, setDataKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [summaryReload, setSummaryReload] = useState(0);
  const [summary, setSummary] = useState<AdminMentoringSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const mutationLock = useRef(false);
  const mutationController = useRef<AbortController | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);
  const requestKey = JSON.stringify([activeTab, mentorStatus, programStatus, keyword, page, reload]);

  useEffect(() => {
    const controller = new AbortController();
    setSummaryLoading(true);
    setSummaryError(null);
    fetchAdminMentoringSummary(controller.signal)
      .then((response) => { if (!controller.signal.aborted) setSummary(response); })
      .catch((error: unknown) => {
        if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) return;
        setSummaryError(error instanceof Error ? error.message : '요약 지표를 불러오지 못했습니다.');
      })
      .finally(() => { if (!controller.signal.aborted) setSummaryLoading(false); });
    return () => controller.abort();
  }, [summaryReload]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setListError(null);
    const applyPage = <Item,>(response: PageResponse<Item>, apply: (response: PageResponse<Item>) => void) => {
      if (controller.signal.aborted) return;
      if (page > 0 && page >= response.totalPages) {
        setPage(Math.max(0, response.totalPages - 1));
        return;
      }
      apply(response);
      setDataKey(requestKey);
    };
    const request = activeTab === 'applications'
      ? fetchAdminMentors({ status: mentorStatus || undefined, page, size: PAGE_SIZE, sort: 'createdAt,desc' }, controller.signal).then((response) => applyPage(response, setMentorPage))
      : fetchAdminMentoringPrograms({ status: programStatus || undefined, keyword, page, size: PAGE_SIZE, sort: 'createdAt,desc' }, controller.signal).then((response) => applyPage(response, setProgramPage));
    request.catch((error: unknown) => {
      if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) return;
      setListError(error instanceof Error ? error.message : '멘토링 목록을 불러오지 못했습니다.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [activeTab, mentorStatus, programStatus, keyword, page, reload, requestKey]);

  useEffect(() => () => mutationController.current?.abort(), []);

  const closeDialog = () => {
    if (mutationLock.current) return;
    setSelection(null);
    setMutationError(null);
  };
  const select = (next: Selection) => { setMutationError(null); setSelection(next); };
  const confirm = async (reason?: string) => {
    if (!selection || mutationLock.current) return;
    if ((selection.action === 'reject' || selection.action === 'hide') && !reason?.trim()) {
      setMutationError('조치 사유는 필수입니다.');
      return;
    }
    const selected = selection;
    const controller = new AbortController();
    mutationController.current = controller;
    mutationLock.current = true;
    setIsSubmitting(true);
    setMutationError(null);
    try {
      switch (selected.action) {
        case 'approve': await approveAdminMentor(selected.item.userId, controller.signal); break;
        case 'reject': await rejectAdminMentor(selected.item.userId, reason!.trim(), controller.signal); break;
        case 'hide': await hideAdminMentoringProgram(selected.item.id, reason!.trim(), controller.signal); break;
        case 'status': await updateAdminProgramStatus(selected.item.id, selected.status, controller.signal); break;
      }
      if (controller.signal.aborted) return;
      setSelection(null);
      setToast(selected.action === 'approve' ? '멘토 신청을 승인했습니다.' : selected.action === 'reject' ? '멘토 신청을 반려했습니다.' : selected.action === 'hide' ? '프로그램을 숨김 처리했습니다.' : '프로그램 운영 상태를 변경했습니다.');
      setReload((current) => current + 1);
      setSummaryReload((current) => current + 1);
    } catch (error) {
      if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) return;
      setMutationError(error instanceof Error ? error.message : '처리에 실패했습니다. 다시 시도해주세요.');
    } finally {
      mutationLock.current = false;
      if (!controller.signal.aborted) setIsSubmitting(false);
    }
  };
  const currentPage = activeTab === 'applications' ? mentorPage : programPage;
  const listPending = loading || dataKey !== requestKey;

  return (
    <div className="mx-auto w-full max-w-[1200px] p-4 sm:p-6 lg:p-8">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="멘토링 현황 요약">
        {summaryCards.map((card) => (
          <article key={card.field} className="flex h-[82px] items-center gap-3 rounded-[20px] border border-[#e4e7ec] bg-white p-4 shadow-sm">
            <span className={'grid size-10 shrink-0 place-items-center rounded-2xl ' + card.style}><card.icon className="size-5" aria-hidden="true" /></span>
            <span><span className="block text-xs font-semibold text-[#667085]">{card.label}</span><span className="mt-0.5 block text-lg font-bold text-[#172033]">{summaryLoading ? '불러오는 중…' : summaryError || !summary ? '—' : summary[card.field].toLocaleString('ko-KR') + card.unit}</span></span>
          </article>
        ))}
      </section>
      {summaryError ? <div role="alert" className="mt-3 flex items-center gap-3 text-sm text-[#b42318]"><span>{summaryError}</span><button type="button" disabled={isSubmitting} onClick={() => setSummaryReload((current) => current + 1)} className={actionClassName}>요약 다시 시도</button></div> : null}

      <section className="flex flex-wrap items-center justify-between gap-3 py-4" aria-label="멘토링 관리 보기">
        <div className="flex h-12 items-center rounded-2xl bg-[#f2f4f7] p-1" role="tablist" aria-label="멘토링 관리 메뉴">
          {([{ tab: 'applications', label: '멘토 신청' }, { tab: 'programs', label: '프로그램 관리' }] as const).map(({ tab, label }) => (
            <button type="button" key={tab} role="tab" aria-selected={activeTab === tab} disabled={isSubmitting} onClick={() => { setActiveTab(tab); setPage(0); }} className={'h-10 w-32 rounded-xl text-[13px] ' + (activeTab === tab ? 'bg-white font-bold text-[#172033] shadow-sm' : 'text-[#667085]')}>{label}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AdminFilterSelect
            label="상태 전체"
            value={activeTab === 'applications' ? mentorStatus : programStatus}
            disabled={isSubmitting}
            options={Object.entries(activeTab === 'applications' ? mentorStatusLabels : programStatusLabels).map(([value, label]) => ({ value, label }))}
            onChange={(value) => { if (activeTab === 'applications') setMentorStatus(value as AdminMentorStatus | ''); else setProgramStatus(value as AdminProgramStatus | ''); setPage(0); }}
            className="w-36"
          />
          {activeTab === 'programs' ? (
            <form className="flex items-center gap-2" onSubmit={(event) => { event.preventDefault(); setKeyword(query.trim()); setPage(0); }}>
              <label className="relative">
                <span className="sr-only">프로그램 제목 또는 멘토 닉네임 검색</span>
                <Search className="pointer-events-none absolute top-3 left-3 size-4 text-[#98a2b3]" aria-hidden="true" />
                <input type="search" value={query} disabled={isSubmitting} onChange={(event) => setQuery(event.target.value)} placeholder="제목 · 멘토 닉네임 검색" className="h-10 w-56 rounded-2xl border border-[#d0d5dd] bg-white pr-3 pl-9 text-sm text-[#344054] outline-none focus:border-[#315ef5]" />
              </label>
              <button type="submit" disabled={isSubmitting} className={actionClassName}>검색</button>
            </form>
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-[20px] border border-[#e4e7ec] bg-white shadow-sm">
        {listError ? <AdminStatePanel state="error" description={listError} onRetry={() => setReload((current) => current + 1)} /> : listPending ? <AdminStatePanel state="loading" /> : !currentPage?.content.length ? <AdminStatePanel state="empty" /> : (
          <div className="overflow-x-auto">
            {activeTab === 'applications' ? (
              <table className="w-full min-w-[700px] border-collapse text-left text-[13px] text-[#344054]">
                <thead className="h-11 bg-[#fcfcfd] text-xs text-[#667085]"><tr><th className="px-5">신청자</th><th>신청 시각</th><th>상태</th><th className="px-5 text-right">처리</th></tr></thead>
                <tbody>{mentorPage?.content.map((mentor) => (
                  <tr key={mentor.userId} className="h-24 border-t border-[#f2f4f7]">
                    <td className="max-w-xs px-5 py-3"><span className="block font-semibold text-[#172033]">{mentor.name} <span className="font-normal text-[#667085]">@{mentor.handle}</span></span>{mentor.bio ? <span className="mt-1 block max-w-xs truncate text-xs text-[#98a2b3]">{mentor.bio}</span> : null}</td>
                    <td className="pr-3 text-[#98a2b3]">{formatDate(mentor.appliedAt)}</td>
                    <td><StatusBadge label={mentorStatusLabels[mentor.status]} active={mentor.status === 'ACTIVE'} /></td>
                    <td className="px-5 text-right">{mentor.status === 'PENDING_APPROVAL' ? <span className="inline-flex gap-2"><button type="button" disabled={isSubmitting} onClick={() => select({ action: 'reject', item: mentor })} className={actionClassName}>반려</button><button type="button" disabled={isSubmitting} onClick={() => select({ action: 'approve', item: mentor })} className={actionClassName}><Check className="size-3.5" aria-hidden="true" />승인</button></span> : <span className="text-xs text-[#98a2b3]">처리 완료</span>}</td>
                  </tr>
                ))}</tbody>
              </table>
            ) : (
              <table className="w-full min-w-[900px] border-collapse text-left text-[13px] text-[#344054]">
                <thead className="h-11 bg-[#fcfcfd] text-xs text-[#667085]"><tr><th className="px-5">프로그램</th><th>멘토</th><th>가격 (P)</th><th>신청 건수</th><th>멘토 평점</th><th>상태</th><th className="px-5 text-right">처리</th></tr></thead>
                <tbody>{programPage?.content.map((program) => (
                  <tr key={program.id} className="h-20 border-t border-[#f2f4f7]">
                    <td className="max-w-xs px-5 py-3"><span className="block truncate font-semibold text-[#172033]">{program.title}</span><span className="block text-xs text-[#667085]">{program.game}</span></td>
                    <td className="pr-3"><span className="block">{program.mentorNickname}</span><span className="block text-xs text-[#667085]">@{program.mentorHandle}</span></td>
                    <td className="pr-3">{program.price === null ? '—' : program.price.toLocaleString('ko-KR')}</td>
                    <td className="pr-3">{program.sessions.toLocaleString('ko-KR')}건</td>
                    <td className="pr-3">{program.rating === null ? '—' : program.rating.toFixed(1)}</td>
                    <td className="pr-3"><StatusBadge label={programStatusLabels[program.status]} active={program.status === 'ACTIVE'} />{program.isHidden ? <span className="mt-1 block text-xs text-[#b42318]">숨김</span> : null}</td>
                    <td className="px-5 text-right">{program.isHidden ? <span className="text-xs text-[#98a2b3]">숨김 처리됨</span> : <span className="inline-flex gap-2"><button type="button" disabled={isSubmitting} onClick={() => select({ action: 'status', item: program, status: program.status === 'ACTIVE' ? 'CLOSED' : 'ACTIVE' })} className={actionClassName}>{program.status === 'ACTIVE' ? '종료' : '운영 재개'}</button><button type="button" disabled={isSubmitting} onClick={() => select({ action: 'hide', item: program })} className={actionClassName}><EyeOff className="size-3.5" aria-hidden="true" />숨김</button></span>}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        )}
        {!listPending && !listError && currentPage ? <AdminPagination currentPage={page} totalPages={currentPage.totalPages} totalItems={currentPage.totalElements} pageSize={PAGE_SIZE} itemLabel="건" onPageChange={(next) => { if (!mutationLock.current) setPage(next); }} /> : null}
      </section>

      {selection?.action === 'approve' ? <MentorApprovalDialog applicantName={selection.item.name + ' (@' + selection.item.handle + ')'} isSubmitting={isSubmitting} error={mutationError} onCancel={closeDialog} onConfirm={() => void confirm()} /> : null}
      {selection?.action === 'reject' ? <MentoringReasonDialog key={selection.item.userId} targetName={selection.item.name + ' (@' + selection.item.handle + ')'} action="reject" isSubmitting={isSubmitting} error={mutationError} onCancel={closeDialog} onConfirm={(reason) => void confirm(reason)} /> : null}
      {selection?.action === 'hide' ? <ProgramHideDialog key={selection.item.id} programTitle={selection.item.title} isSubmitting={isSubmitting} error={mutationError} onCancel={closeDialog} onConfirm={(reason) => void confirm(reason)} /> : null}
      {selection?.action === 'status' ? (
        <AdminDialog isOpen titleId="program-status-title" onClose={closeDialog} maxWidthClassName="max-w-[448px]">
          <h2 id="program-status-title" className="text-xl font-bold text-[#172033]">프로그램을 {selection.status === 'CLOSED' ? '종료' : '운영 재개'}하시겠습니까?</h2>
          <p className="mt-3 text-sm text-[#667085]">{selection.item.title}</p>
          {mutationError ? <p role="alert" className="mt-3 text-sm text-[#b42318]">{mutationError}</p> : null}
          <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={isSubmitting} onClick={closeDialog} className={actionClassName}>취소</button><button type="button" autoFocus disabled={isSubmitting} onClick={() => void confirm()} className={actionClassName}>{isSubmitting ? '처리 중…' : '상태 변경 확인'}</button></div>
        </AdminDialog>
      ) : null}
      {toast ? <AdminToast key={toast} variant="success" title={toast} onDismiss={dismissToast} /> : null}
    </div>
  );
}
