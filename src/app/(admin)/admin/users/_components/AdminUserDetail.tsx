'use client';

import { RotateCcw, ShieldCheck, TriangleAlert } from 'lucide-react';
import Image from 'next/image';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { isAdminRole } from '@/lib/admin-auth';
import type { AdminPenaltyType } from '@/lib/admin-report-api';
import {
  createAdminUserPenalty, fetchAdminUser, fetchAdminUserByHandle, fetchAdminUserPenalties,
  revokeAdminUserPenalty, type AdminUserResponse, type UserPenaltyResponse,
} from '@/lib/admin-user-api';
import type { PageResponse } from '@/types/api';
import { AdminDialog } from '../../_components/AdminDialog';
import { AdminPagination } from '../../_components/AdminPagination';
import { AdminStatePanel } from '../../_components/AdminStatePanel';
import { AdminStatusBadge } from '../../_components/AdminStatusBadge';
import { AdminToast } from '../../_components/AdminToast';

const PAGE_SIZE = 10;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const statusLabels = { ACTIVE: '활성', SUSPENDED: '정지', DELETED: '탈퇴' };
const sanctionOptions: Array<{ value: AdminPenaltyType; label: string; days?: number }> = [
  { value: 'WARNING', label: '경고' },
  { value: 'SUSPENSION_3D', label: '3일 정지', days: 3 },
  { value: 'SUSPENSION_7D', label: '7일 정지', days: 7 },
  { value: 'SUSPENSION_30D', label: '30일 정지', days: 30 },
  { value: 'PERMANENT_BAN', label: '영구 정지' },
];
type ConfirmAction = 'sanction' | 'revoke' | null;
type Snapshot = { key: string; user: AdminUserResponse | null; penalties: PageResponse<UserPenaltyResponse> | null; error: string | null };
type Toast = { id: number; variant: 'success' | 'error'; title: string; description?: string };

function penaltyLabel(penalty: UserPenaltyResponse) {
  return sanctionOptions.find((option) => option.value === penalty.penaltyType)?.label ?? '확인 필요';
}

function penaltyPeriod(penalty: UserPenaltyResponse) {
  if (penalty.penaltyType === 'WARNING') return '경고 · 종료일 없음';
  if (penalty.penaltyType === 'PERMANENT_BAN') return '영구 정지';
  return penalty.endAt ? new Date(penalty.endAt).toLocaleString('ko-KR') + '까지' : '종료일 확인 필요';
}

export function AdminUserDetail({ handle }: { handle: string }) {
  const { user: signedInUser, isAuthReady, isLoggingOut } = useAuth();
  const [penaltyPage, setPenaltyPage] = useState(0);
  const [retry, setRetry] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot>({ key: '', user: null, penalties: null, error: null });
  const [sanctionType, setSanctionType] = useState<AdminPenaltyType | ''>('');
  const [sanctionReason, setSanctionReason] = useState('');
  const [validationError, setValidationError] = useState('');
  const [selectedPenaltyId, setSelectedPenaltyId] = useState('');
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [mutationPending, setMutationPending] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const mutationLock = useRef(false);
  const mutationController = useRef<AbortController | null>(null);
  const loadSequence = useRef(0);
  const scopeKey = JSON.stringify([handle, signedInUser?.id, signedInUser?.role, isAuthReady, isLoggingOut]);
  const currentScope = useRef(scopeKey);
  currentScope.current = scopeKey;
  const requestKey = JSON.stringify([scopeKey, penaltyPage, retry]);
  const currentRequest = useRef(requestKey);
  currentRequest.current = requestKey;

  useEffect(() => {
    const controller = new AbortController();
    const sequence = ++loadSequence.current;
    setSnapshot({ key: requestKey, user: null, penalties: null, error: null });
    void (async () => {
      try {
        const user = await fetchAdminUserByHandle(handle, controller.signal);
        if (controller.signal.aborted || sequence !== loadSequence.current) return;
        if (!UUID.test(user.id)) throw new Error('사용자 식별자를 확인할 수 없습니다.');
        const penalties = await fetchAdminUserPenalties(user.id, { page: penaltyPage, size: PAGE_SIZE, sort: 'createdAt,desc' }, controller.signal);
        if (controller.signal.aborted || sequence !== loadSequence.current) return;
        if (penaltyPage > 0 && penaltyPage >= Math.max(penalties.totalPages, 1)) {
          setPenaltyPage(Math.max(penalties.totalPages - 1, 0));
          return;
        }
        setSnapshot({ key: requestKey, user, penalties, error: null });
        const active = penalties.content.filter((item) => item.isActive && item.userId === user.id && UUID.test(item.id));
        setSelectedPenaltyId(active.find((item) => item.id === user.activePenaltyId)?.id ?? active[0]?.id ?? '');
      } catch (error) {
        if (!controller.signal.aborted && sequence === loadSequence.current && !(error instanceof Error && error.name === 'AbortError')) {
          setSnapshot({ key: requestKey, user: null, penalties: null, error: error instanceof Error ? error.message : '사용자 정보를 불러오지 못했습니다.' });
        }
      }
    })();
    return () => controller.abort();
  }, [handle, scopeKey, penaltyPage, retry, requestKey]);

  useEffect(() => {
    setPenaltyPage(0);
    setConfirmAction(null);
    setSanctionType('');
    setSanctionReason('');
    setValidationError('');
    setSelectedPenaltyId('');
    setToast(null);
    setMutationPending(false);
    mutationLock.current = false;
    return () => mutationController.current?.abort();
  }, [scopeKey]);

  const user = snapshot.key === requestKey ? snapshot.user : null;
  const penalties = snapshot.key === requestKey ? snapshot.penalties : null;
  const error = snapshot.key === requestKey ? snapshot.error : null;
  const activePenalties = penalties?.content.filter((item) => item.isActive && item.userId === user?.id && UUID.test(item.id)) ?? [];
  const selectedPenalty = activePenalties.find((item) => item.id === selectedPenaltyId);
  const selectedSanction = sanctionOptions.find((option) => option.value === sanctionType);
  const protectionReason = !user || !UUID.test(user.id) || !isAuthReady || isLoggingOut || !signedInUser?.id || !isAdminRole(signedInUser.role)
    ? '대상 사용자와 관리자 정보를 확인한 후 조치할 수 있습니다.'
    : user.id === signedInUser.id
      ? '관리자 본인 계정에는 조치할 수 없습니다.'
      : user.role === 'ADMIN'
        ? '관리자 계정에는 조치할 수 없습니다.'
        : user.status === 'DELETED'
          ? '탈퇴한 계정에는 조치할 수 없습니다.'
          : user.role !== 'USER' || !['ACTIVE', 'SUSPENDED'].includes(user.status)
            ? '계정 상태를 확인할 수 없어 조치할 수 없습니다.'
            : null;
  const controlsDisabled = Boolean(protectionReason) || mutationPending;

  const closeDialog = () => { if (!mutationLock.current) setConfirmAction(null); };
  const submitSanction = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (controlsDisabled || mutationLock.current) return;
    if (!selectedSanction || !sanctionReason.trim()) {
      setValidationError(!selectedSanction ? '제재 유형을 선택해주세요.' : '제재 사유는 필수입니다.');
      return;
    }
    setValidationError('');
    setConfirmAction('sanction');
  };

  const confirmMutation = async () => {
    if (controlsDisabled || mutationLock.current || !user || !penalties) return;
    if (confirmAction === 'sanction' && (!selectedSanction || !sanctionReason.trim())) return;
    if (confirmAction === 'revoke' && !selectedPenalty) return;
    const action = confirmAction;
    if (!action) return;
    const operationScope = scopeKey;
    const operationKey = requestKey;
    const controller = new AbortController();
    mutationController.current = controller;
    mutationLock.current = true;
    setMutationPending(true);
    let applied = false;
    const stillCurrent = () => !controller.signal.aborted && currentScope.current === operationScope && currentRequest.current === operationKey;
    try {
      if (action === 'sanction' && selectedSanction) {
        await createAdminUserPenalty(user.id, {
          penaltyType: selectedSanction.value, reason: sanctionReason.trim(),
          ...(selectedSanction.days ? { durationDays: selectedSanction.days } : {}),
        }, controller.signal);
      } else if (selectedPenalty) {
        await revokeAdminUserPenalty(user.id, selectedPenalty.id, controller.signal);
      }
      applied = true;
      if (!stillCurrent()) return;
      setConfirmAction(null);
      const [refreshedUser, refreshedPenalties] = await Promise.all([
        fetchAdminUser(user.id, controller.signal),
        fetchAdminUserPenalties(user.id, { page: penaltyPage, size: PAGE_SIZE, sort: 'createdAt,desc' }, controller.signal),
      ]);
      if (!stillCurrent()) return;
      if (refreshedUser.id !== user.id) throw new Error('다시 조회한 사용자 식별자가 일치하지 않습니다.');
      setSnapshot({ key: operationKey, user: refreshedUser, penalties: refreshedPenalties, error: null });
      const active = refreshedPenalties.content.filter((item) => item.isActive && item.userId === user.id && UUID.test(item.id));
      setSelectedPenaltyId(active.find((item) => item.id === refreshedUser.activePenaltyId)?.id ?? active[0]?.id ?? '');
      setSanctionType('');
      setSanctionReason('');
      setToast({ id: Date.now(), variant: 'success', title: action === 'sanction' ? '사용자 제재를 적용했습니다.' : '선택한 제재를 해제했습니다.', description: action === 'revoke' ? '다른 활성 정지가 남아 있으면 계정 정지는 유지됩니다.' : undefined });
    } catch (cause) {
      if (!stillCurrent() || (cause instanceof Error && cause.name === 'AbortError')) return;
      const message = cause instanceof Error ? cause.message : '요청을 처리하지 못했습니다.';
      if (applied) {
        setSnapshot({ key: operationKey, user: null, penalties: null, error: '조치는 완료되었지만 최신 상태를 불러오지 못했습니다. 다시 조회해주세요. ' + message });
      }
      setToast({ id: Date.now(), variant: 'error', title: applied ? '최신 상태 조회에 실패했습니다.' : '사용자 조치에 실패했습니다.', description: message });
    } finally {
      if (currentScope.current === operationScope && mutationController.current === controller) {
        mutationLock.current = false;
        setMutationPending(false);
      }
    }
  };

  if (error || !user || !penalties) {
    return <div className='p-4 sm:p-6 lg:p-8'><AdminStatePanel state={error ? 'error' : 'loading'} description={error ?? undefined} onRetry={error ? () => setRetry((value) => value + 1) : undefined} />{toast ? <AdminToast key={toast.id} {...toast} onDismiss={() => setToast(null)} /> : null}</div>;
  }

  return (
    <div className='mx-auto w-full max-w-[1200px] p-4 sm:p-6 lg:p-8'>
      <section className='flex flex-col items-start justify-between gap-6 rounded-[20px] border border-[#e4e7ec] bg-white p-5 md:flex-row md:p-[25px]'>
        <div className='flex items-center gap-4'>
          <span className='relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-[#315ef5] text-2xl font-bold text-white'>{user.profileImageUrl ? <Image src={user.profileImageUrl} alt='' fill unoptimized className='object-cover' /> : user.nickname.slice(0, 1)}</span>
          <div className='min-w-0'>
            <div className='flex flex-wrap items-center gap-2'><h2 className='text-xl font-bold text-[#172033]'>{user.nickname}</h2><AdminStatusBadge label={statusLabels[user.status] ?? '확인 필요'} tone={user.status === 'ACTIVE' ? 'success' : 'warning'} /><span className='rounded-full bg-[#f2f4f7] px-2 py-0.5 text-xs text-[#667085]'>{user.role === 'ADMIN' ? '관리자' : '사용자'}</span></div>
            <p className='mt-1 break-all text-sm text-[#667085]'>@{user.handle} · {user.id}</p>
            <p className='mt-1 text-[13px] text-[#98a2b3]'>가입일 {new Date(user.createdAt).toLocaleDateString('ko-KR')}</p>
          </div>
        </div>
        <dl className='grid w-full grid-cols-2 gap-6 md:w-auto'><div className='text-center'><dd className='text-xl font-bold text-[#172033]'>{user.reportsReceivedCount}</dd><dt className='text-xs text-[#667085]' title='사용자를 직접 대상으로 한 신고 수'>받은 신고</dt></div><div className='text-center'><dd className='text-xl font-bold text-[#172033]'>{user.activeSanction || '없음'}</dd><dt className='text-xs text-[#667085]'>활성 제재</dt></div></dl>
      </section>
      <p className='mt-2 text-xs text-[#667085]'>받은 신고는 사용자를 직접 대상으로 한 신고 수입니다.</p>

      <div className='mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,1fr)]'>
        <section className='overflow-hidden rounded-[20px] border border-[#e4e7ec] bg-white' aria-label='제재 이력'>
          <h2 className='px-5 pt-5 text-base font-bold text-[#172033]'>제재 이력</h2>
          {penalties.content.length === 0 ? <AdminStatePanel state='empty' title='제재 이력이 없습니다.' compact /> : (
            <ul className='space-y-3 p-5'>{penalties.content.map((penalty) => (
              <li key={penalty.id} className='rounded-2xl bg-[#f9fafb] p-3 text-[13px] text-[#344054]'>
                <div className='flex flex-wrap items-center justify-between gap-2'><span className='font-semibold'>{penaltyLabel(penalty)}</span><AdminStatusBadge label={penalty.isActive ? '활성' : '해제·만료'} tone={penalty.isActive ? 'warning' : 'neutral'} /></div>
                <p className='mt-2 whitespace-pre-wrap break-words'>{penalty.reason}</p>
                <p className='mt-2 text-xs text-[#667085]'>{new Date(penalty.startAt).toLocaleString('ko-KR')} · {penaltyPeriod(penalty)}</p>
                <p className='mt-1 text-xs text-[#667085]'>처리 관리자: {penalty.administeredByAdminNickname || '확인할 수 없음'}</p>
              </li>
            ))}</ul>
          )}
          <div inert={mutationPending}><AdminPagination currentPage={penalties.number} totalPages={penalties.totalPages} totalItems={penalties.totalElements} pageSize={penalties.size} itemLabel='건' onPageChange={setPenaltyPage} /></div>
        </section>

        <section className='rounded-[20px] border border-[#e4e7ec] bg-white p-5'>
          <h2 className='text-base font-bold text-[#172033]'>제재 관리</h2>
          <form className='pt-4' onSubmit={submitSanction} noValidate>
            <fieldset disabled={controlsDisabled} className='min-w-0 border-0 p-0'>
              <label htmlFor='sanction-type' className='mb-1.5 block text-[13px] font-semibold text-[#344054]'>제재 유형</label>
              <select id='sanction-type' value={sanctionType} onChange={(event) => { setSanctionType(event.target.value as AdminPenaltyType | ''); setValidationError(''); }} className='h-10 w-full rounded-2xl border border-[#d0d5dd] bg-white px-3 text-sm text-[#667085] disabled:bg-[#f2f4f7]'><option value=''>제재 유형 선택</option>{sanctionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
              <label htmlFor='sanction-reason' className='mt-4 mb-1.5 block text-[13px] font-semibold text-[#344054]'>제재 사유</label>
              <textarea id='sanction-reason' value={sanctionReason} onChange={(event) => { setSanctionReason(event.target.value); setValidationError(''); }} placeholder='제재 근거를 구체적으로 작성해주세요.' className='h-[89px] w-full resize-none rounded-2xl border border-[#d0d5dd] bg-white p-3 text-sm text-[#172033] disabled:bg-[#f2f4f7]' />
              {validationError ? <p role='alert' className='mt-2 text-xs text-[#d92d20]'>{validationError}</p> : null}
              <button type='submit' className='mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-2xl bg-[#315ef5] px-4 text-sm font-semibold text-white disabled:bg-[#98a2b3]'><ShieldCheck className='size-4' aria-hidden='true' />조치 내용 확인</button>
              <label htmlFor='revoke-penalty' className='mt-5 mb-1.5 block text-[13px] font-semibold text-[#344054]'>해제할 활성 제재</label>
              <select id='revoke-penalty' value={selectedPenaltyId} disabled={activePenalties.length === 0} onChange={(event) => setSelectedPenaltyId(event.target.value)} className='h-10 w-full rounded-2xl border border-[#d0d5dd] bg-white px-3 text-sm text-[#667085] disabled:bg-[#f2f4f7]'><option value=''>활성 제재 선택</option>{activePenalties.map((penalty) => <option key={penalty.id} value={penalty.id}>{penaltyLabel(penalty)} · {penalty.reason}</option>)}</select>
              <button type='button' disabled={!selectedPenalty} onClick={() => setConfirmAction('revoke')} className='mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-[#d0d5dd] bg-white px-4 text-sm font-semibold text-[#344054] disabled:text-[#98a2b3]'><RotateCcw className='size-4' aria-hidden='true' />선택한 제재 해제</button>
            </fieldset>
          </form>
          <p className='mt-4 rounded-2xl bg-[#f9fafb] p-3 text-xs leading-5 text-[#667085]'>{protectionReason ?? '현재 이력 페이지의 활성 제재 한 건을 선택해 해제합니다. 다른 정지가 남아 있으면 계정 정지는 유지됩니다.'}</p>
        </section>
      </div>

      <AdminDialog isOpen={confirmAction !== null} titleId='user-action-title' descriptionId='user-action-description' onClose={closeDialog} maxWidthClassName='max-w-[448px]'>
        <TriangleAlert className='size-8 text-[#d92d20]' aria-hidden='true' />
        <h2 id='user-action-title' className='mt-3 text-lg font-bold text-[#172033]'>{confirmAction === 'sanction' ? '사용자 제재 확인' : '선택한 제재 해제 확인'}</h2>
        <p id='user-action-description' className='mt-2 text-sm text-[#667085]'>@{user.handle} · {confirmAction === 'sanction' ? selectedSanction?.label : selectedPenalty ? penaltyLabel(selectedPenalty) : '활성 제재를 확인해주세요.'}</p>
        <p className='mt-3 whitespace-pre-wrap break-words rounded-2xl bg-[#f9fafb] p-3 text-sm text-[#344054]'>{confirmAction === 'sanction' ? sanctionReason.trim() : selectedPenalty?.reason}</p>
        {confirmAction === 'revoke' ? <p className='mt-3 text-xs text-[#667085]'>선택한 제재 한 건만 해제합니다. 계정 상태는 서버에서 다시 확인합니다.</p> : null}
        <div className='mt-5 flex justify-end gap-2'><button type='button' disabled={mutationPending} onClick={closeDialog} className='h-10 rounded-2xl border border-[#d0d5dd] px-4 text-sm font-semibold text-[#344054]'>취소</button><button type='button' disabled={controlsDisabled || (confirmAction === 'revoke' && !selectedPenalty)} onClick={() => void confirmMutation()} className='h-10 rounded-2xl bg-[#315ef5] px-4 text-sm font-semibold text-white disabled:bg-[#98a2b3]'>{mutationPending ? '처리 중…' : confirmAction === 'sanction' ? '제재 적용' : '제재 해제'}</button></div>
      </AdminDialog>
      {toast ? <AdminToast key={toast.id} {...toast} onDismiss={() => setToast(null)} /> : null}
    </div>
  );
}
