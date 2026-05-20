'use client';

import {
  AlertCircle,
  Check,
  Clock3,
  CreditCard,
  Loader2,
  MessageCircle,
  Plus,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import {
  acceptMentoringApplication,
  applyToMentoringProgram,
  completeMentoringApplication,
  createMentoringProgram,
  deleteMentoringProgram,
  emptyPage,
  fetchMenteeApplications,
  fetchMentorApplications,
  fetchMentoringProgramDetail,
  fetchMentoringPrograms,
  fetchMentorProfile,
  finishMentoringApplication,
  isMentoringAuthError,
  registerMentor,
  rejectMentoringApplication,
  startMentoringApplication,
  type ApplicationStatus,
  type MentoringApplicationResponse,
  type MentoringProgramDetailResponse,
  type MentoringProgramResponse,
  type MentorProfileResponse,
  type PageResponse,
  type PaymentStatus,
} from '@/lib/mentoring-api';

type MentoringTab = 'find' | 'mine' | 'become';

type ProgramForm = {
  gameName: string;
  title: string;
  method: string;
  content: string;
  availableTimeDesc: string;
  price: string;
  tags: string;
};

const mentoringGames = ['전체', 'PUBG', 'League of Legends', 'Valorant', 'Overwatch', 'CS2', 'Other'];

const defaultProgramForm: ProgramForm = {
  gameName: 'PUBG',
  title: '',
  method: '',
  content: '',
  availableTimeDesc: '',
  price: '10000',
  tags: '',
};

const statusLabel: Record<ApplicationStatus, string> = {
  APPLIED: '신청됨',
  ACCEPTED: '수락됨',
  REJECTED: '거절됨',
  ONGOING: '진행중',
  FINISHED: '종료 보고',
  COMPLETED: '완료',
  CANCELLED: '취소됨',
};

const paymentLabel: Record<PaymentStatus, string> = {
  PENDING: '결제 대기',
  ESCROW_HELD: '에스크로 보관',
  SETTLED: '정산 완료',
  REFUNDED: '환불 완료',
};

function normalizeId(value?: string | null) {
  return value?.toLowerCase() ?? '';
}

function formatMileage(value: number) {
  return `${Number(value || 0).toLocaleString()} M`;
}

function parseTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function buildProgramContent(method: string, content: string) {
  return `[진행 방식]\n${method.trim() || '협의 후 진행'}\n\n[상세 설명]\n${content.trim()}`;
}

function splitProgramContent(rawContent: string) {
  const methodMatch = rawContent.match(/\[진행 방식\]\s*([\s\S]*?)(?:\n\s*\[상세 설명\]|$)/);
  const contentMatch = rawContent.match(/\[상세 설명\]\s*([\s\S]*)$/);

  return {
    method: methodMatch?.[1]?.trim() ?? '',
    content: contentMatch?.[1]?.trim() ?? rawContent,
  };
}

function programMentorName(program: MentoringProgramResponse | MentoringProgramDetailResponse) {
  if ('mentorNickname' in program && program.mentorNickname) return program.mentorNickname;
  if ('mentorNickName' in program && program.mentorNickName) return program.mentorNickName;
  return '멘토';
}

function applicationGuide(role: 'mentor' | 'mentee', status: ApplicationStatus, paymentStatus: PaymentStatus) {
  if (status === 'APPLIED') {
    return role === 'mentor'
      ? '멘티의 신청이 들어왔습니다. 수락하면 멘토링을 시작할 수 있습니다.'
      : `멘토의 수락을 기다리는 중입니다. 결제 상태: ${paymentLabel[paymentStatus] ?? paymentStatus}`;
  }
  if (status === 'ACCEPTED') return role === 'mentor' ? '시작 버튼을 눌러 진행 상태로 바꿔주세요.' : '멘토가 신청을 수락했습니다.';
  if (status === 'ONGOING') return role === 'mentor' ? '수업이 끝나면 종료 보고를 눌러주세요.' : '멘토링 진행 중입니다.';
  if (status === 'FINISHED') return role === 'mentee' ? '문제가 없으면 완료 확정을 눌러주세요.' : '멘티의 완료 확정을 기다리는 중입니다.';
  if (status === 'COMPLETED') return '정산이 완료된 멘토링입니다.';
  if (status === 'REJECTED') return '거절된 신청입니다. 결제 마일리지는 환불 처리됩니다.';
  if (status === 'CANCELLED') return '취소된 신청입니다.';
  return '';
}

export default function MentoringPage() {
  const { user, logout } = useAuth();
  const currentUserId = user?.id ?? '';

  const [activeTab, setActiveTab] = useState<MentoringTab>('find');
  const [gameFilter, setGameFilter] = useState('전체');
  const [programPage, setProgramPage] = useState<PageResponse<MentoringProgramResponse>>(emptyPage());
  const [programPageNumber, setProgramPageNumber] = useState(0);
  const [programsLoading, setProgramsLoading] = useState(false);
  const [ownedPrograms, setOwnedPrograms] = useState<MentoringProgramResponse[]>([]);
  const [mentorStatsById, setMentorStatsById] = useState<Record<string, MentorProfileResponse>>({});

  const [mentorProfile, setMentorProfile] = useState<MentorProfileResponse | null>(null);
  const [mentorProfileLoading, setMentorProfileLoading] = useState(false);
  const [showMentorForm, setShowMentorForm] = useState(false);
  const [mentorAbout, setMentorAbout] = useState('');

  const [programForm, setProgramForm] = useState<ProgramForm>(defaultProgramForm);
  const [selectedProgram, setSelectedProgram] = useState<MentoringProgramDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [applicationMessage, setApplicationMessage] = useState('');

  const [menteeApplications, setMenteeApplications] = useState<MentoringApplicationResponse[]>([]);
  const [mentorApplications, setMentorApplications] = useState<MentoringApplicationResponse[]>([]);

  const [notice, setNotice] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingAction, setPendingAction] = useState('');

  const totalPages = Math.max(programPage.totalPages || 1, 1);

  const visiblePrograms = useMemo(() => programPage.content, [programPage.content]);

  const currentUserOwnsProgram = useCallback(
    (mentorId?: string | null) => normalizeId(mentorId) === normalizeId(currentUserId),
    [currentUserId]
  );

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2200);
  }, []);

  const showError = useCallback((error: unknown) => {
    if (isMentoringAuthError(error)) {
      setAuthMessage('세션이 만료되었거나 백엔드가 현재 토큰을 거부했습니다. 다시 로그인 후 멘토링을 이용해주세요.');
      setErrorMessage('');
      return;
    }

    setAuthMessage('');
    setErrorMessage(error instanceof Error ? error.message : '요청 처리 중 문제가 발생했습니다.');
  }, []);

  const clearMessages = () => {
    setNotice('');
    setAuthMessage('');
    setErrorMessage('');
  };

  const loadPrograms = useCallback(async () => {
    setProgramsLoading(true);
    setAuthMessage('');
    setErrorMessage('');

    try {
      const page = await fetchMentoringPrograms({
        gameName: gameFilter === '전체' ? undefined : gameFilter,
        page: programPageNumber,
        size: 10,
      });
      setProgramPage(page);

      const mentorIds = Array.from(new Set(page.content.map((program) => program.mentorId)));
      const mentorResults = await Promise.allSettled(
        mentorIds.map(async (mentorId) => ({
          mentorId,
          profile: await fetchMentorProfile(mentorId),
        }))
      );

      setMentorStatsById((current) => {
        const next = { ...current };
        mentorResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            next[result.value.mentorId] = result.value.profile;
          }
        });
        return next;
      });
    } catch (error) {
      setProgramPage(emptyPage(programPageNumber, 10));
      showError(error);
    } finally {
      setProgramsLoading(false);
    }
  }, [gameFilter, programPageNumber, showError]);

  const loadOwnedPrograms = useCallback(async () => {
    if (!currentUserId) return;

    try {
      const page = await fetchMentoringPrograms({ page: 0, size: 100 });
      setOwnedPrograms(
        page.content.filter((program) => normalizeId(program.mentorId) === normalizeId(currentUserId))
      );
    } catch {
      setOwnedPrograms([]);
    }
  }, [currentUserId]);

  const loadCurrentMentorProfile = useCallback(async () => {
    if (!currentUserId) return;

    setMentorProfileLoading(true);
    try {
      const profile = await fetchMentorProfile(currentUserId);
      setMentorProfile(profile);
      setMentorAbout(profile.about ?? '');
    } catch {
      setMentorProfile(null);
      setMentorAbout('');
    } finally {
      setMentorProfileLoading(false);
    }
  }, [currentUserId]);

  const loadApplications = useCallback(async () => {
    const [menteeResult, mentorResult] = await Promise.allSettled([
      fetchMenteeApplications(0, 20),
      fetchMentorApplications(0, 20),
    ]);

    const authFailure = [menteeResult, mentorResult].find(
      (result) => result.status === 'rejected' && isMentoringAuthError(result.reason)
    );

    if (authFailure?.status === 'rejected') {
      showError(authFailure.reason);
      setMenteeApplications([]);
      setMentorApplications([]);
      return;
    }

    setMenteeApplications(menteeResult.status === 'fulfilled' ? menteeResult.value.content : []);
    setMentorApplications(mentorResult.status === 'fulfilled' ? mentorResult.value.content : []);
  }, [showError]);

  const refreshMentoringData = useCallback(async () => {
    if (activeTab === 'find') {
      await loadPrograms();
      return;
    }

    if (activeTab === 'mine') {
      await loadApplications();
      return;
    }

    await Promise.all([loadCurrentMentorProfile(), loadOwnedPrograms()]);
  }, [activeTab, loadApplications, loadCurrentMentorProfile, loadOwnedPrograms, loadPrograms]);

  useEffect(() => {
    if (activeTab === 'find') {
      void loadPrograms();
    }
  }, [activeTab, loadPrograms]);

  useEffect(() => {
    if (activeTab === 'mine') {
      void loadApplications();
    }
  }, [activeTab, loadApplications]);

  useEffect(() => {
    if (activeTab === 'become') {
      void Promise.all([loadCurrentMentorProfile(), loadOwnedPrograms()]);
    }
  }, [activeTab, loadCurrentMentorProfile, loadOwnedPrograms]);

  const changeTab = (tab: MentoringTab) => {
    setActiveTab(tab);
    clearMessages();
    setShowMentorForm(false);
  };

  const openProgramDetail = async (programId: string) => {
    setDetailLoading(true);
    setSelectedProgram(null);
    setErrorMessage('');

    try {
      const detail = await fetchMentoringProgramDetail(programId);
      setSelectedProgram(detail);
    } catch (error) {
      showError(error);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleRegisterMentor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPendingAction('register-mentor');
    clearMessages();

    try {
      const profile = await registerMentor({ about: mentorAbout.trim() });
      setMentorProfile(profile);
      setShowMentorForm(false);
      showNotice('멘토 등록이 완료되었습니다. 이제 프로그램을 만들 수 있습니다.');
      await loadOwnedPrograms();
    } catch (error) {
      showError(error);
    } finally {
      setPendingAction('');
    }
  };

  const handleProgramFormChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setProgramForm((current) => ({
      ...current,
      [name]: name === 'price' ? value.replace(/[^0-9]/g, '') : value,
    }));
  };

  const resetProgramForm = () => {
    setProgramForm(defaultProgramForm);
  };

  const handleSubmitProgram = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPendingAction('save-program');
    clearMessages();

    try {
      const price = Number(programForm.price);
      if (price < 0 || Number.isNaN(price)) {
        throw new Error('가격을 올바르게 입력해주세요.');
      }

      await createMentoringProgram({
        gameName: programForm.gameName.trim(),
        title: programForm.title.trim(),
        content: buildProgramContent(programForm.method, programForm.content),
        availableTimeDesc: programForm.availableTimeDesc.trim(),
        price,
        tags: parseTags(programForm.tags),
      });

      resetProgramForm();
      showNotice('프로그램을 등록했습니다.');
      await refreshMentoringData();
    } catch (error) {
      showError(error);
    } finally {
      setPendingAction('');
    }
  };

  const handleDeleteProgram = async (programId: string) => {
    const ok = window.confirm('이 프로그램을 삭제할까요?');
    if (!ok) return;

    setPendingAction(`delete-program:${programId}`);
    clearMessages();

    try {
      await deleteMentoringProgram(programId);
      showNotice('프로그램을 삭제했습니다.');
      await refreshMentoringData();
    } catch (error) {
      showError(error);
    } finally {
      setPendingAction('');
    }
  };

  const handleApplyProgram = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedProgram) return;

    setPendingAction(`apply:${selectedProgram.id}`);
    clearMessages();

    try {
      await applyToMentoringProgram({
        programId: selectedProgram.id,
        message: applicationMessage.trim(),
      });
      setApplicationMessage('');
      showNotice('멘토링 신청이 접수되었습니다.');
      await loadApplications();
      setActiveTab('mine');
    } catch (error) {
      showError(error);
    } finally {
      setPendingAction('');
    }
  };

  const runApplicationAction = async (
    applicationId: string,
    action: 'accept' | 'reject' | 'start' | 'finish' | 'complete'
  ) => {
    const actionMap = {
      accept: acceptMentoringApplication,
      reject: rejectMentoringApplication,
      start: startMentoringApplication,
      finish: finishMentoringApplication,
      complete: completeMentoringApplication,
    };

    const messageMap = {
      accept: '신청을 수락했습니다.',
      reject: '신청을 거절했습니다.',
      start: '멘토링을 시작했습니다.',
      finish: '수업 종료를 보고했습니다.',
      complete: '멘토링 완료를 확정했습니다.',
    };

    setPendingAction(`${action}:${applicationId}`);
    clearMessages();

    try {
      await actionMap[action](applicationId);
      showNotice(messageMap[action]);
      await loadApplications();
    } catch (error) {
      showError(error);
    } finally {
      setPendingAction('');
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-6xl px-5 py-10">
        <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-zinc-400">Mentoring</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-black">멘토링</h1>
          </div>
          <div className="flex rounded-2xl border border-zinc-200 bg-white p-1">
            {[
              ['find', '멘토 찾기'],
              ['mine', '내 멘토링'],
              ['become', '멘토 되기'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => changeTab(id as MentoringTab)}
                className={`rounded-xl px-4 py-2 text-sm font-black ${
                  activeTab === id ? 'bg-black text-white' : 'text-zinc-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {notice ? <div className="mb-5 rounded-2xl bg-black px-5 py-3 text-sm font-black text-white">{notice}</div> : null}

        {authMessage ? (
          <div className="mb-5 rounded-2xl border border-yellow-200 bg-yellow-50 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex gap-3">
                <AlertCircle className="mt-0.5 shrink-0 text-yellow-700" size={20} />
                <div>
                  <p className="font-black text-yellow-900">세션 확인이 필요합니다</p>
                  <p className="mt-1 text-sm font-bold leading-6 text-yellow-800">{authMessage}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => logout({ redirectTo: '/login' })}
                className="rounded-xl bg-black px-4 py-3 text-sm font-black text-white"
              >
                다시 로그인
              </button>
            </div>
          </div>
        ) : null}

        {errorMessage ? (
          <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-5 py-3 text-sm font-black text-red-600">
            {errorMessage}
          </div>
        ) : null}

        {activeTab === 'find' ? (
          <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
            <div>
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Explore programs</p>
                  <h2 className="mt-1 text-2xl font-black text-black">멘토링 프로그램 탐색</h2>
                  <p className="mt-2 text-sm font-bold text-zinc-500">
                    게임별 프로그램을 찾고 상세 화면에서 바로 신청할 수 있습니다.
                  </p>
                </div>
                <select
                  value={gameFilter}
                  onChange={(event) => {
                    setProgramPageNumber(0);
                    setGameFilter(event.target.value);
                  }}
                  className="h-11 rounded-xl border border-zinc-200 px-3 text-sm font-black outline-none"
                >
                  {mentoringGames.map((game) => (
                    <option key={game} value={game}>
                      {game}
                    </option>
                  ))}
                </select>
              </div>

              {programsLoading ? (
                <div className="flex h-56 items-center justify-center rounded-2xl bg-zinc-50">
                  <Loader2 className="animate-spin text-zinc-400" />
                </div>
              ) : visiblePrograms.length > 0 ? (
                <div className="grid gap-4">
                  {visiblePrograms.map((program) => (
                    <button
                      key={program.id}
                      type="button"
                      onClick={() => openProgramDetail(program.id)}
                      className="rounded-2xl border border-zinc-100 p-5 text-left transition hover:border-black"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="mb-2 flex flex-wrap gap-2">
                            <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-black text-zinc-500">
                              {program.gameName}
                            </span>
                            <span className="rounded-full bg-green-100 px-3 py-1 text-[11px] font-black text-green-700">
                              {program.status === 'ACTIVE' ? '모집중' : '마감'}
                            </span>
                          </div>
                          <h3 className="text-xl font-black text-black">{program.title}</h3>
                          <p className="mt-2 line-clamp-2 text-sm font-bold leading-6 text-zinc-500">
                            {splitProgramContent(program.content).content}
                          </p>
                          <p className="mt-3 text-xs font-black text-zinc-400">
                            멘토 {programMentorName(program)} · 평점 {(mentorStatsById[program.mentorId]?.ratingAvg ?? 0).toFixed(1)}
                          </p>
                        </div>
                        <div className="text-left md:text-right">
                          <p className="text-xl font-black text-black">{formatMileage(program.price)}</p>
                          <p className="mt-1 text-xs font-bold text-zinc-400">{program.availableTimeDesc || '시간 협의 가능'}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-8 text-center">
                  <p className="font-black text-black">등록된 프로그램이 없습니다.</p>
                </div>
              )}

              <div className="mt-5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setProgramPageNumber((page) => Math.max(page - 1, 0))}
                  disabled={programPageNumber <= 0}
                  className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-black text-black disabled:opacity-40"
                >
                  이전
                </button>
                <span className="text-sm font-black text-zinc-400">
                  {programPageNumber + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setProgramPageNumber((page) => Math.min(page + 1, totalPages - 1))}
                  disabled={programPageNumber >= totalPages - 1}
                  className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-black text-black disabled:opacity-40"
                >
                  다음
                </button>
              </div>
            </div>

            <aside className="rounded-2xl border border-zinc-100 p-5">
              {detailLoading ? (
                <div className="flex h-56 items-center justify-center">
                  <Loader2 className="animate-spin text-zinc-400" />
                </div>
              ) : selectedProgram ? (
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">{selectedProgram.gameName}</p>
                  <h2 className="mt-2 text-2xl font-black text-black">{selectedProgram.title}</h2>
                  <p className="mt-2 text-sm font-bold text-zinc-500">
                    {programMentorName(selectedProgram)} · {formatMileage(selectedProgram.price)}
                  </p>
                  <div className="mt-5 rounded-xl bg-zinc-50 p-4 text-sm font-bold leading-6 text-zinc-600">
                    <p className="font-black text-black">진행 방식</p>
                    <p>{splitProgramContent(selectedProgram.content).method || '협의 후 진행'}</p>
                    <p className="mt-4 font-black text-black">상세 설명</p>
                    <p>{splitProgramContent(selectedProgram.content).content}</p>
                  </div>

                  {currentUserOwnsProgram(selectedProgram.mentorId) ? (
                    <p className="mt-5 rounded-xl bg-zinc-50 p-4 text-sm font-black text-zinc-500">
                      내가 등록한 프로그램입니다.
                    </p>
                  ) : (
                    <form onSubmit={handleApplyProgram} className="mt-5">
                      <div className="mb-4 rounded-xl bg-yellow-50 p-4 text-xs font-bold leading-5 text-yellow-800">
                        신청 시 프로그램 가격만큼 마일리지가 에스크로로 보관됩니다.
                      </div>
                      <label className="block space-y-2">
                        <span className="text-sm font-black text-zinc-700">멘토에게 보낼 메시지</span>
                        <textarea
                          value={applicationMessage}
                          onChange={(event) => setApplicationMessage(event.target.value)}
                          required
                          rows={4}
                          placeholder="원하는 수업 방향이나 현재 고민을 적어주세요."
                          className="w-full resize-none rounded-xl border border-zinc-200 px-4 py-3 text-sm outline-none focus:border-black"
                        />
                      </label>
                      <button
                        type="submit"
                        disabled={pendingAction === `apply:${selectedProgram.id}`}
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-black px-5 py-4 text-sm font-black text-white disabled:bg-zinc-200"
                      >
                        <CreditCard size={17} />
                        {pendingAction === `apply:${selectedProgram.id}` ? '신청 중...' : '신청하고 결제하기'}
                      </button>
                    </form>
                  )}
                </div>
              ) : (
                <div className="flex h-56 items-center justify-center text-center text-sm font-black text-zinc-400">
                  프로그램을 선택하면 상세 정보를 볼 수 있습니다.
                </div>
              )}
            </aside>
          </section>
        ) : null}

        {activeTab === 'mine' ? (
          <section className="grid gap-6 lg:grid-cols-2">
            <ApplicationList
              title="내가 신청한 멘토링"
              role="mentee"
              applications={menteeApplications}
              pendingAction={pendingAction}
              onComplete={(id) => runApplicationAction(id, 'complete')}
            />
            <ApplicationList
              title="받은 멘토링 신청"
              role="mentor"
              applications={mentorApplications}
              pendingAction={pendingAction}
              onAccept={(id) => runApplicationAction(id, 'accept')}
              onReject={(id) => runApplicationAction(id, 'reject')}
              onStart={(id) => runApplicationAction(id, 'start')}
              onFinish={(id) => runApplicationAction(id, 'finish')}
            />
          </section>
        ) : null}

        {activeTab === 'become' ? (
          <section>
            {mentorProfileLoading ? (
              <div className="flex h-64 items-center justify-center rounded-2xl bg-zinc-50">
                <Loader2 className="animate-spin text-zinc-400" />
              </div>
            ) : mentorProfile ? (
              <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
                <form onSubmit={handleSubmitProgram} className="rounded-2xl border border-zinc-100 p-6">
                  <h2 className="text-2xl font-black text-black">프로그램 만들기</h2>
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-sm font-black text-zinc-700">게임</span>
                      <select
                        name="gameName"
                        value={programForm.gameName}
                        onChange={handleProgramFormChange}
                        className="h-12 w-full rounded-xl border border-zinc-200 px-3 text-sm font-bold outline-none"
                      >
                        {mentoringGames.filter((game) => game !== '전체').map((game) => (
                          <option key={game} value={game}>
                            {game}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-black text-zinc-700">가격</span>
                      <input
                        name="price"
                        value={programForm.price}
                        onChange={handleProgramFormChange}
                        required
                        inputMode="numeric"
                        className="h-12 w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none"
                      />
                    </label>
                  </div>
                  <label className="mt-4 block space-y-2">
                    <span className="text-sm font-black text-zinc-700">프로그램 제목</span>
                    <input
                      name="title"
                      value={programForm.title}
                      onChange={handleProgramFormChange}
                      required
                      className="h-12 w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none"
                    />
                  </label>
                  <label className="mt-4 block space-y-2">
                    <span className="text-sm font-black text-zinc-700">진행 방식</span>
                    <input
                      name="method"
                      value={programForm.method}
                      onChange={handleProgramFormChange}
                      required
                      className="h-12 w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none"
                    />
                  </label>
                  <label className="mt-4 block space-y-2">
                    <span className="text-sm font-black text-zinc-700">상세 설명</span>
                    <textarea
                      name="content"
                      value={programForm.content}
                      onChange={handleProgramFormChange}
                      required
                      rows={5}
                      className="w-full resize-none rounded-xl border border-zinc-200 px-3 py-3 text-sm outline-none"
                    />
                  </label>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <input
                      name="availableTimeDesc"
                      value={programForm.availableTimeDesc}
                      onChange={handleProgramFormChange}
                      placeholder="가능한 스케줄"
                      className="h-12 rounded-xl border border-zinc-200 px-3 text-sm outline-none"
                    />
                    <input
                      name="tags"
                      value={programForm.tags}
                      onChange={handleProgramFormChange}
                      placeholder="태그, 쉼표로 구분"
                      className="h-12 rounded-xl border border-zinc-200 px-3 text-sm outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={pendingAction === 'save-program'}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-black px-5 py-4 text-sm font-black text-white disabled:bg-zinc-200"
                  >
                    <Plus size={17} />
                    {pendingAction === 'save-program' ? '저장 중...' : '프로그램 등록'}
                  </button>
                </form>

                <div className="rounded-2xl border border-zinc-100 p-6">
                  <h2 className="text-2xl font-black text-black">{mentorProfile.nickname} 멘토</h2>
                  <p className="mt-2 text-sm font-bold leading-6 text-zinc-500">{mentorProfile.about}</p>
                  <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-xl bg-zinc-50 p-3">
                      <p className="text-lg font-black text-black">{mentorProfile.ratingAvg.toFixed(1)}</p>
                      <p className="text-xs font-bold text-zinc-400">평점</p>
                    </div>
                    <div className="rounded-xl bg-zinc-50 p-3">
                      <p className="text-lg font-black text-black">{mentorProfile.reviewCount}</p>
                      <p className="text-xs font-bold text-zinc-400">리뷰</p>
                    </div>
                    <div className="rounded-xl bg-zinc-50 p-3">
                      <p className="text-lg font-black text-black">{mentorProfile.menteeCount}</p>
                      <p className="text-xs font-bold text-zinc-400">멘티</p>
                    </div>
                  </div>
                  <h3 className="mt-8 font-black text-black">내 프로그램</h3>
                  <div className="mt-3 space-y-3">
                    {ownedPrograms.length > 0 ? (
                      ownedPrograms.map((program) => (
                        <div key={program.id} className="rounded-xl border border-zinc-100 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-black text-black">{program.title}</p>
                              <p className="mt-1 text-xs font-bold text-zinc-400">{formatMileage(program.price)}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteProgram(program.id)}
                              disabled={pendingAction === `delete-program:${program.id}`}
                              className="rounded-lg bg-red-50 p-2 text-red-600 disabled:opacity-40"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-xl bg-zinc-50 p-4 text-sm font-bold text-zinc-400">
                        아직 만든 프로그램이 없습니다.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : showMentorForm ? (
              <section className="rounded-2xl border border-zinc-100 p-6">
                <h2 className="text-2xl font-black text-black">멘토 등록 신청</h2>
                <p className="mt-2 text-sm font-bold text-zinc-500">
                  멘토 등록 시 멘토 프로필과 마일리지 지갑이 함께 생성됩니다.
                </p>
                <form onSubmit={handleRegisterMentor} className="mt-6">
                  <textarea
                    value={mentorAbout}
                    onChange={(event) => setMentorAbout(event.target.value)}
                    required
                    rows={7}
                    placeholder="멘토링 경험, 전문 분야, 멘티들에게 전하고 싶은 말을 작성해주세요."
                    className="w-full resize-none rounded-xl border border-zinc-200 px-4 py-3 text-sm outline-none"
                  />
                  <button
                    type="submit"
                    disabled={pendingAction === 'register-mentor'}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-black px-5 py-4 text-sm font-black text-white disabled:bg-zinc-200"
                  >
                    <Plus size={17} />
                    {pendingAction === 'register-mentor' ? '등록 중...' : '멘토 등록'}
                  </button>
                </form>
              </section>
            ) : (
              <section className="rounded-2xl border border-zinc-100 p-8 text-center">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#f5c400] text-black">
                  <UserPlus size={38} />
                </div>
                <h2 className="text-3xl font-black text-black">멘토가 되어보세요</h2>
                <p className="mt-4 text-sm font-bold leading-6 text-zinc-500">
                  멘토 등록 후 프로그램을 만들어 신청을 받을 수 있습니다.
                </p>
                <button
                  type="button"
                  onClick={() => setShowMentorForm(true)}
                  className="mt-7 inline-flex items-center gap-2 rounded-xl bg-black px-6 py-4 text-sm font-black text-white"
                >
                  <Plus size={17} />
                  멘토 등록하기
                </button>
              </section>
            )}
          </section>
        ) : null}
      </main>
    </div>
  );
}

function ApplicationList({
  title,
  role,
  applications,
  pendingAction,
  onAccept,
  onReject,
  onStart,
  onFinish,
  onComplete,
}: {
  title: string;
  role: 'mentor' | 'mentee';
  applications: MentoringApplicationResponse[];
  pendingAction: string;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  onStart?: (id: string) => void;
  onFinish?: (id: string) => void;
  onComplete?: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-zinc-100 p-5">
      <h2 className="text-2xl font-black text-black">{title}</h2>
      <div className="mt-5 space-y-4">
        {applications.length > 0 ? (
          applications.map((application) => (
            <ApplicationCard
              key={application.id}
              application={application}
              role={role}
              pendingAction={pendingAction}
              onAccept={() => onAccept?.(application.id)}
              onReject={() => onReject?.(application.id)}
              onStart={() => onStart?.(application.id)}
              onFinish={() => onFinish?.(application.id)}
              onComplete={() => onComplete?.(application.id)}
            />
          ))
        ) : (
          <p className="rounded-xl bg-zinc-50 p-6 text-center text-sm font-bold text-zinc-400">
            표시할 신청 내역이 없습니다.
          </p>
        )}
      </div>
    </div>
  );
}

function ApplicationCard({
  application,
  role,
  pendingAction,
  onAccept,
  onReject,
  onStart,
  onFinish,
  onComplete,
}: {
  application: MentoringApplicationResponse;
  role: 'mentor' | 'mentee';
  pendingAction: string;
  onAccept?: () => void;
  onReject?: () => void;
  onStart?: () => void;
  onFinish?: () => void;
  onComplete?: () => void;
}) {
  const actionPending = pendingAction.endsWith(`:${application.id}`);
  const guide = applicationGuide(role, application.status, application.paymentStatus);

  return (
    <article className="rounded-xl border border-zinc-100 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-black text-black">{application.programTitle}</h3>
          <p className="mt-1 text-xs font-bold text-zinc-400">
            멘토 {application.mentorNickname} · 멘티 {application.menteeNickname}
          </p>
        </div>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-black text-zinc-500">
          {statusLabel[application.status] ?? application.status}
        </span>
      </div>

      <p className="mt-4 rounded-xl bg-zinc-50 p-4 text-sm font-medium leading-6 text-zinc-600">
        {application.message}
      </p>

      <div className="mt-4 grid gap-2 text-xs font-bold text-zinc-500 sm:grid-cols-2">
        <span>금액: {formatMileage(application.appliedMileage)}</span>
        <span>결제: {paymentLabel[application.paymentStatus] ?? application.paymentStatus}</span>
      </div>

      {guide ? <p className="mt-4 rounded-xl bg-yellow-50 p-3 text-xs font-bold text-yellow-800">{guide}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled
          className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-xs font-black text-zinc-400"
        >
          <MessageCircle size={14} />
          채팅 준비중
        </button>

        {role === 'mentor' && application.status === 'APPLIED' ? (
          <>
            <button
              type="button"
              onClick={onAccept}
              disabled={actionPending}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
            >
              <Check size={14} />
              수락
            </button>
            <button
              type="button"
              onClick={onReject}
              disabled={actionPending}
              className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
            >
              <X size={14} />
              거절
            </button>
          </>
        ) : null}

        {role === 'mentor' && application.status === 'ACCEPTED' ? (
          <button
            type="button"
            onClick={onStart}
            disabled={actionPending}
            className="inline-flex items-center gap-2 rounded-lg bg-black px-3 py-2 text-xs font-black text-white disabled:opacity-50"
          >
            <Clock3 size={14} />
            시작
          </button>
        ) : null}

        {role === 'mentor' && application.status === 'ONGOING' ? (
          <button
            type="button"
            onClick={onFinish}
            disabled={actionPending}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
          >
            <Check size={14} />
            종료 보고
          </button>
        ) : null}

        {role === 'mentee' && application.status === 'FINISHED' ? (
          <button
            type="button"
            onClick={onComplete}
            disabled={actionPending}
            className="inline-flex items-center gap-2 rounded-lg bg-green-500 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
          >
            <CreditCard size={14} />
            완료 확정
          </button>
        ) : null}
      </div>
    </article>
  );
}
