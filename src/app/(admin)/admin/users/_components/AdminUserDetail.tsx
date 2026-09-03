'use client';

import { ChevronDown, RotateCcw, ShieldCheck, TriangleAlert } from 'lucide-react';
import { FormEvent, useState } from 'react';
import type { AdminSanctionType, AdminUser } from '@/types/admin';
import { AdminDialog } from '../../_components/AdminDialog';
import { AdminStatusBadge } from '../../_components/AdminStatusBadge';
import { AdminToast } from '../../_components/AdminToast';

type DetailTab = '신고 이력' | '제재 이력' | '작성 콘텐츠';
type ConfirmAction = 'sanction' | 'revoke' | null;

const reportHistory = ['받은 신고 7건', 'RPT-1024 · 욕설·비하·혐오 · 접수', 'RPT-1019 · 욕설·비하·혐오 · 처리 완료'];
const contentHistory = ['최근 작성 콘텐츠 18건', '게시글 · 솔로 랭크 같이 하실 분?', '댓글 · 멘토링 후기 감사합니다.'];

const sanctionOptions: Array<{ value: AdminSanctionType; label: string }> = [
  { value: 'warning', label: '경고' },
  { value: '3days', label: '3일 정지' },
  { value: '7days', label: '7일 정지' },
  { value: '30days', label: '30일 정지' },
  { value: 'permanent', label: '영구 정지' },
];

type ToastState = {
  id: number;
  variant: 'success' | 'error';
  title: string;
  description: string;
};

export function AdminUserDetail({ user }: { user: AdminUser }) {
  const [activeTab, setActiveTab] = useState<DetailTab>('신고 이력');
  const [currentStatus, setCurrentStatus] = useState(user.status);
  const [currentSanction, setCurrentSanction] = useState(user.sanction);
  const [sanctionType, setSanctionType] = useState<AdminSanctionType | ''>('');
  const [sanctionReason, setSanctionReason] = useState('');
  const [sanctionTypeError, setSanctionTypeError] = useState(false);
  const [sanctionReasonError, setSanctionReasonError] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeReasonError, setRevokeReasonError] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [sanctionHistory, setSanctionHistory] = useState([
    '누적 제재 없음',
    '2026.02.13 · 운영 정책 안내',
    '2025.11.08 · 주의 조치 완료',
  ]);
  const [toast, setToast] = useState<ToastState | null>(null);

  const isProtectedAdmin = user.role === '관리자';
  const selectedSanctionLabel = sanctionOptions.find((option) => option.value === sanctionType)?.label;

  const showToast = (variant: ToastState['variant'], title: string, description: string) => {
    setToast({ id: Date.now(), variant, title, description });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isProtectedAdmin) {
      showToast('error', '제재할 수 없는 계정입니다.', '관리자 계정은 이 화면에서 제재할 수 없습니다.');
      return;
    }

    const hasTypeError = !sanctionType;
    const hasReasonError = !sanctionReason.trim();
    setSanctionTypeError(hasTypeError);
    setSanctionReasonError(hasReasonError);
    if (hasTypeError || hasReasonError) return;

    setConfirmAction('sanction');
  };

  const confirmSanction = () => {
    if (!selectedSanctionLabel) return;

    setCurrentSanction(selectedSanctionLabel);
    setCurrentStatus(sanctionType === 'warning' ? '활성' : '정지');
    setSanctionHistory((current) => [
      `방금 전 · ${selectedSanctionLabel} · ${sanctionReason.trim()}`,
      ...current.filter((item) => item !== '누적 제재 없음'),
    ]);
    setConfirmAction(null);
    setSanctionType('');
    setSanctionReason('');
    setActiveTab('제재 이력');
    showToast('success', '사용자 제재를 적용했습니다.', '제재 사유가 작업 이력에 기록되었습니다.');
  };

  const confirmRevoke = () => {
    if (!revokeReason.trim()) {
      setRevokeReasonError(true);
      return;
    }

    setCurrentSanction('없음');
    setCurrentStatus('활성');
    setSanctionHistory((current) => [`방금 전 · 정지 해제 · ${revokeReason.trim()}`, ...current]);
    setConfirmAction(null);
    setRevokeReason('');
    setRevokeReasonError(false);
    setActiveTab('제재 이력');
    showToast('success', '사용자 정지를 해제했습니다.', '해제 사유가 작업 이력에 기록되었습니다.');
  };

  const visibleHistory =
    activeTab === '신고 이력'
      ? reportHistory.map((item, index) => (index === 0 ? `받은 신고 ${user.reports}건` : item))
      : activeTab === '제재 이력'
        ? sanctionHistory
        : contentHistory;

  return (
    <div className="mx-auto w-full max-w-[1200px] p-4 sm:p-6 lg:p-8">
      <section className="flex min-h-[125px] flex-col items-start justify-between gap-6 rounded-[20px] border border-[#e4e7ec] bg-white p-5 shadow-[0_1px_1px_rgba(16,24,40,0.04)] md:flex-row md:p-[25px]">
        <div className="flex items-center gap-4">
          <div className="grid size-14 shrink-0 place-items-center rounded-full text-xl font-bold text-white sm:size-16 sm:text-[25.6px]" style={{ backgroundColor: user.avatarColor }}>
            {user.initial}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl leading-[30px] font-bold text-[#172033]">{user.name}</h2>
              <AdminStatusBadge label={currentStatus} tone={currentStatus === '활성' ? 'success' : 'warning'} />
              {user.role ? <span className="rounded-full bg-[#f2f4f7] px-2 py-0.5 text-xs font-medium text-[#667085]">{user.role}</span> : null}
            </div>
            <p className="mt-0.5 text-sm text-[#667085]">@{user.handle} · {user.id}</p>
            <p className="mt-0.5 text-[13px] text-[#98a2b3]">가입일 {user.registeredAt}</p>
          </div>
        </div>

        <dl className="grid w-full grid-cols-3 gap-3 md:w-auto md:gap-6">
          <div className="min-w-[58px] text-center"><dd className="text-xl font-bold text-[#172033]">{user.reports}</dd><dt className="text-xs text-[#667085]">받은 신고</dt></div>
          <div className="min-w-[58px] text-center"><dd className="text-xl font-bold text-[#172033]">{user.confirmedViolations}</dd><dt className="text-xs text-[#667085]">확인된 위반</dt></div>
          <div className="min-w-[58px] text-center"><dd className="text-base font-bold text-[#172033] sm:text-xl">{currentSanction}</dd><dt className="text-xs text-[#667085]">활성 제재</dt></div>
        </dl>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,1fr)]">
        <section className="min-h-[419px] rounded-[20px] border border-[#e4e7ec] bg-white p-4 shadow-[0_1px_1px_rgba(16,24,40,0.04)] sm:p-[21px]">
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-[#f2f4f7] p-1" role="tablist">
            {(['신고 이력', '제재 이력', '작성 콘텐츠'] as DetailTab[]).map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button key={tab} type="button" role="tab" aria-selected={isActive} onClick={() => setActiveTab(tab)} className={`min-h-10 rounded-[14px] px-2 text-sm font-medium transition sm:text-base ${isActive ? 'bg-white text-[#172033] shadow-[0_1px_2px_rgba(0,0,0,0.1)]' : 'text-[#667085] hover:text-[#344054]'}`}>
                  {tab}
                </button>
              );
            })}
          </div>
          <div className="pt-4" role="tabpanel">
            {visibleHistory.map((item, index) => <div key={`${item}-${index}`} className={`rounded-2xl bg-[#f9fafb] px-3 py-2.5 text-[13px] text-[#344054] ${index > 0 ? 'mt-2' : ''}`}>{item}</div>)}
          </div>
        </section>

        <section className="min-h-[419px] rounded-[20px] border border-[#e4e7ec] bg-white p-4 shadow-[0_1px_1px_rgba(16,24,40,0.04)] sm:p-[21px]">
          <h2 className="text-base font-bold text-[#172033]">제재 관리</h2>
          <form className="pt-4" onSubmit={handleSubmit} noValidate>
            <label htmlFor="sanction-type" className="mb-1.5 block text-[13px] font-semibold text-[#344054]">제재 유형</label>
            <div className="relative">
              <select
                id="sanction-type"
                value={sanctionType}
                disabled={isProtectedAdmin}
                aria-invalid={sanctionTypeError}
                onChange={(event) => {
                  setSanctionType(event.target.value as AdminSanctionType | '');
                  if (event.target.value) setSanctionTypeError(false);
                }}
                className={`h-10 w-full appearance-none rounded-2xl border bg-white px-[13px] text-sm text-[#667085] outline-none transition disabled:bg-[#f2f4f7] ${sanctionTypeError ? 'border-[#f04438]' : 'border-[#d0d5dd] focus:border-[#315ef5] focus:ring-2 focus:ring-[#315ef5]/10'}`}
              >
                <option value="">제재 유형 선택</option>
                {sanctionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute top-3 right-3 size-4 text-[#98a2b3]" strokeWidth={1.7} aria-hidden="true" />
            </div>
            {sanctionTypeError ? <p className="mt-1.5 text-xs text-[#f04438]" role="alert">제재 유형을 선택해주세요.</p> : null}

            <label htmlFor="sanction-reason" className="mt-4 mb-1.5 block text-[13px] font-semibold text-[#344054]">제재 사유 <span className="text-[#d92d20]">*</span></label>
            <textarea
              id="sanction-reason"
              value={sanctionReason}
              disabled={isProtectedAdmin}
              aria-invalid={sanctionReasonError}
              onChange={(event) => {
                setSanctionReason(event.target.value);
                if (event.target.value.trim()) setSanctionReasonError(false);
              }}
              placeholder="제재 근거를 구체적으로 작성해주세요."
              className={`h-[89px] w-full resize-none rounded-2xl border bg-white p-[13px] text-sm text-[#172033] outline-none transition disabled:bg-[#f2f4f7] ${sanctionReasonError ? 'border-[#f04438]' : 'border-[#d0d5dd] focus:border-[#315ef5] focus:ring-2 focus:ring-[#315ef5]/10'}`}
            />
            {sanctionReasonError ? <p className="mt-1.5 text-xs text-[#f04438]" role="alert">제재 사유는 필수입니다.</p> : null}

            <button type="submit" disabled={isProtectedAdmin} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-2xl bg-[#315ef5] px-4 text-sm font-semibold text-white transition hover:bg-[#294fd5] disabled:cursor-not-allowed disabled:bg-[#98a2b3]">
              <ShieldCheck className="size-4" strokeWidth={1.7} aria-hidden="true" /> 조치 내용 확인
            </button>

            {currentStatus === '정지' && !isProtectedAdmin ? (
              <button type="button" onClick={() => setConfirmAction('revoke')} className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-[#d0d5dd] bg-white px-4 text-sm font-semibold text-[#344054] transition hover:bg-[#f9fafb]">
                <RotateCcw className="size-4" strokeWidth={1.7} aria-hidden="true" /> 정지 해제
              </button>
            ) : null}

            <p className="mt-4 rounded-2xl bg-[#f9fafb] p-3 text-xs leading-5 text-[#98a2b3]">
              {isProtectedAdmin ? '관리자 계정은 이 화면에서 제재할 수 없습니다.' : '모든 제재와 해제에는 사유가 필요하며 작업 이력에 기록됩니다.'}
            </p>
          </form>
        </section>
      </div>

      <AdminDialog isOpen={confirmAction === 'sanction'} titleId="user-sanction-confirm-title" descriptionId="user-sanction-confirm-description" onClose={() => setConfirmAction(null)} maxWidthClassName="max-w-[448px]">
        <div className="grid size-11 place-items-center rounded-2xl bg-[#feeceb]"><TriangleAlert className="size-6 text-[#d92d20]" strokeWidth={1.8} aria-hidden="true" /></div>
        <h2 id="user-sanction-confirm-title" className="mt-4 text-xl font-bold text-[#172033]">사용자를 제재하시겠습니까?</h2>
        <p id="user-sanction-confirm-description" className="mt-1.5 text-[13px] text-[#667085]">아래 내용으로 목업 상태가 변경되고 작업 이력에 표시됩니다.</p>
        <dl className="mt-4 space-y-2 rounded-2xl bg-[#f9fafb] p-4 text-[13px]">
          <div className="flex justify-between gap-4"><dt className="text-[#667085]">대상</dt><dd className="font-semibold text-[#172033]">@{user.handle}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-[#667085]">제재</dt><dd className="font-semibold text-[#172033]">{selectedSanctionLabel}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-[#667085]">사유</dt><dd className="max-w-[260px] text-right text-[#172033]">{sanctionReason.trim()}</dd></div>
        </dl>
        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setConfirmAction(null)} className="h-10 rounded-2xl border border-[#d0d5dd] px-4 text-sm font-semibold text-[#344054]">취소</button><button type="button" onClick={confirmSanction} className="h-10 rounded-2xl bg-[#d92d20] px-4 text-sm font-semibold text-white">제재 적용</button></div>
      </AdminDialog>

      <AdminDialog isOpen={confirmAction === 'revoke'} titleId="user-revoke-confirm-title" descriptionId="user-revoke-confirm-description" onClose={() => { setConfirmAction(null); setRevokeReasonError(false); }} maxWidthClassName="max-w-[448px]">
        <div className="grid size-11 place-items-center rounded-2xl bg-[#eef3ff]"><RotateCcw className="size-6 text-[#315ef5]" strokeWidth={1.8} aria-hidden="true" /></div>
        <h2 id="user-revoke-confirm-title" className="mt-4 text-xl font-bold text-[#172033]">사용자 정지를 해제하시겠습니까?</h2>
        <p id="user-revoke-confirm-description" className="mt-1.5 text-[13px] text-[#667085]">현재 제재는 {currentSanction}입니다. 해제 사유는 작업 이력에 기록됩니다.</p>
        <label className="mt-4 block text-[13px] font-semibold text-[#344054]">해제 사유 <span className="text-[#d92d20]">*</span></label>
        <textarea value={revokeReason} onChange={(event) => { setRevokeReason(event.target.value); if (event.target.value.trim()) setRevokeReasonError(false); }} aria-invalid={revokeReasonError} placeholder="정지 해제 근거를 입력해주세요." className={`mt-1.5 h-24 w-full resize-none rounded-2xl border p-3 text-sm outline-none ${revokeReasonError ? 'border-[#f04438]' : 'border-[#d0d5dd] focus:border-[#315ef5]'}`} />
        {revokeReasonError ? <p className="mt-1.5 text-xs text-[#f04438]" role="alert">해제 사유는 필수입니다.</p> : null}
        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => { setConfirmAction(null); setRevokeReasonError(false); }} className="h-10 rounded-2xl border border-[#d0d5dd] px-4 text-sm font-semibold text-[#344054]">취소</button><button type="button" onClick={confirmRevoke} className="h-10 rounded-2xl bg-[#315ef5] px-4 text-sm font-semibold text-white">정지 해제</button></div>
      </AdminDialog>

      {toast ? <AdminToast key={toast.id} variant={toast.variant} title={toast.title} description={toast.description} onDismiss={() => setToast(null)} /> : null}
    </div>
  );
}
