'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  LoaderCircle,
  PenSquare,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  UserRoundPlus,
  Users,
} from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import {
  acceptApplication,
  applyToProgram,
  completeMentoring,
  createMentoringProgram,
  createMentoringReview,
  deleteMentoringProgram,
  fetchMentorProfile,
  fetchMentorReviews,
  fetchMentoringProgramDetail,
  fetchMentoringPrograms,
  fetchMyMenteeApplications,
  fetchMyMentorApplications,
  finishMentoring,
  formatKoreanDate,
  formatMileage,
  MentorProfileResponse,
  MentoringApplicationResponse,
  MentoringProgramDetailResponse,
  MentoringProgramRequest,
  MentoringProgramResponse,
  MentoringProgramUpdateRequest,
  MentoringReviewResponse,
  ProgramStatus,
  registerMentor,
  rejectApplication,
  startMentoring,
  updateMentoringProgram,
} from '@/lib/mentoring-api';

type ViewKey = 'discover' | 'activity' | 'studio';

type ProgramFormState = {
  gameName: string;
  title: string;
  content: string;
  availableTimeDesc: string;
  price: string;
  status: ProgramStatus;
  tags: string;
};

const emptyProgramForm: ProgramFormState = {
  gameName: '',
  title: '',
  content: '',
  availableTimeDesc: '',
  price: '',
  status: 'ACTIVE',
  tags: '',
};

const appStatusStyles: Record<string, string> = {
  APPLIED: 'bg-amber-50 text-amber-700 border-amber-200',
  ACCEPTED: 'bg-sky-50 text-sky-700 border-sky-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
  ONGOING: 'bg-violet-50 text-violet-700 border-violet-200',
  FINISHED: 'bg-orange-50 text-orange-700 border-orange-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-zinc-100 text-zinc-600 border-zinc-200',
};

const paymentStatusStyles: Record<string, string> = {
  PENDING: 'bg-zinc-100 text-zinc-600 border-zinc-200',
  ESCROW_HELD: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  SETTLED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REFUNDED: 'bg-rose-50 text-rose-700 border-rose-200',
};

const programStatusStyles: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CLOSED: 'bg-zinc-100 text-zinc-600 border-zinc-200',
};

export default function MentoringPage() {
  const { user } = useAuth();
  const [view, setView] = useState<ViewKey>('discover');
  const [gameFilter, setGameFilter] = useState('');
  const [submittedGameFilter, setSubmittedGameFilter] = useState('');
  const [programs, setPrograms] = useState<MentoringProgramResponse[]>([]);
  const [programPage, setProgramPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [programDetail, setProgramDetail] = useState<MentoringProgramDetailResponse | null>(null);
  const [selectedMentorProfile, setSelectedMentorProfile] = useState<MentorProfileResponse | null>(null);
  const [selectedMentorReviews, setSelectedMentorReviews] = useState<MentoringReviewResponse[]>([]);
  const [myMentorProfile, setMyMentorProfile] = useState<MentorProfileResponse | null>(null);
  const [menteeApplications, setMenteeApplications] = useState<MentoringApplicationResponse[]>([]);
  const [mentorApplications, setMentorApplications] = useState<MentoringApplicationResponse[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [isMentorModalOpen, setIsMentorModalOpen] = useState(false);
  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  const [mentorAbout, setMentorAbout] = useState('');
  const [editingProgram, setEditingProgram] = useState<MentoringProgramResponse | null>(null);
  const [programForm, setProgramForm] = useState<ProgramFormState>(emptyProgramForm);
  const [applyMessage, setApplyMessage] = useState('');
  const [reviewTarget, setReviewTarget] = useState<MentoringApplicationResponse | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState('');

  useEffect(() => {
    void loadPrograms(programPage, submittedGameFilter);
  }, [programPage, submittedGameFilter]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    void loadDashboard(user.id);
  }, [user?.id]);

  useEffect(() => {
    if (!selectedProgramId) {
      setProgramDetail(null);
      setSelectedMentorProfile(null);
      setSelectedMentorReviews([]);
      return;
    }

    void loadProgramDetail(selectedProgramId);
  }, [selectedProgramId]);

  async function loadPrograms(page: number, gameName: string) {
    setLoadingPrograms(true);
    setPageError(null);

    try {
      const response = await fetchMentoringPrograms({
        page,
        size: 9,
        gameName,
      });

      setPrograms(response.content);
      setTotalPages(Math.max(1, response.totalPages || 1));

      setSelectedProgramId((current) => {
        if (response.content.length === 0) {
          return null;
        }
        if (current && response.content.some((program) => program.id === current)) {
          return current;
        }
        return response.content[0].id;
      });
    } catch (error) {
      setPageError(error instanceof Error ? error.message : '멘토링 목록을 불러오지 못했습니다.');
      setPrograms([]);
      setSelectedProgramId(null);
    } finally {
      setLoadingPrograms(false);
    }
  }

  async function loadDashboard(userId: string) {
    setLoadingDashboard(true);

    try {
      const [menteeResult, mentorResult, mentorProfileResult] = await Promise.allSettled([
        fetchMyMenteeApplications(0, 20),
        fetchMyMentorApplications(0, 20),
        fetchMentorProfile(userId),
      ]);

      setMenteeApplications(
        menteeResult.status === 'fulfilled' ? menteeResult.value.content : []
      );
      setMentorApplications(
        mentorResult.status === 'fulfilled' ? mentorResult.value.content : []
      );
      setMyMentorProfile(
        mentorProfileResult.status === 'fulfilled' ? mentorProfileResult.value : null
      );
    } finally {
      setLoadingDashboard(false);
    }
  }

  async function loadProgramDetail(programId: string) {
    setLoadingDetail(true);
    setActionError(null);

    try {
      const detail = await fetchMentoringProgramDetail(programId);
      setProgramDetail(detail);

      const [mentorProfile, reviews] = await Promise.all([
        fetchMentorProfile(detail.mentorId),
        fetchMentorReviews(detail.mentorId, 0, 6),
      ]);

      setSelectedMentorProfile(mentorProfile);
      setSelectedMentorReviews(reviews.content);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '상세 정보를 불러오지 못했습니다.');
      setProgramDetail(null);
      setSelectedMentorProfile(null);
      setSelectedMentorReviews([]);
    } finally {
      setLoadingDetail(false);
    }
  }

  function openProgramCreateModal() {
    setEditingProgram(null);
    setProgramForm(emptyProgramForm);
    setIsProgramModalOpen(true);
  }

  function openProgramEditModal(program: MentoringProgramResponse) {
    setEditingProgram(program);
    setProgramForm({
      gameName: program.gameName,
      title: program.title,
      content: program.content,
      availableTimeDesc: program.availableTimeDesc,
      price: String(program.price),
      status: program.status,
      tags: program.tags.join(', '),
    });
    setIsProgramModalOpen(true);
  }

  async function handleRegisterMentor() {
    if (!mentorAbout.trim()) {
      setActionError('멘토 소개를 입력해 주세요.');
      return;
    }

    setBusyKey('register-mentor');
    setActionError(null);
    setActionMessage(null);

    try {
      const profile = await registerMentor({ about: mentorAbout.trim() });
      setMyMentorProfile(profile);
      setIsMentorModalOpen(false);
      setMentorAbout('');
      setActionMessage('멘토 등록이 완료되었습니다.');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '멘토 등록에 실패했습니다.');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleProgramSubmit() {
    const price = Number(programForm.price);

    if (
      !programForm.gameName.trim() ||
      !programForm.title.trim() ||
      !programForm.content.trim() ||
      !programForm.availableTimeDesc.trim() ||
      Number.isNaN(price)
    ) {
      setActionError('프로그램 정보를 모두 입력해 주세요.');
      return;
    }

    const payloadBase = {
      title: programForm.title.trim(),
      content: programForm.content.trim(),
      availableTimeDesc: programForm.availableTimeDesc.trim(),
      price,
      tags: splitTags(programForm.tags),
    };

    setBusyKey(editingProgram ? 'edit-program' : 'create-program');
    setActionError(null);
    setActionMessage(null);

    try {
      if (editingProgram) {
        const payload: MentoringProgramUpdateRequest = {
          ...payloadBase,
          status: programForm.status,
        };
        await updateMentoringProgram(editingProgram.id, payload);
        setActionMessage('프로그램을 수정했습니다.');
      } else {
        const payload: MentoringProgramRequest = {
          gameName: programForm.gameName.trim(),
          ...payloadBase,
        };
        await createMentoringProgram(payload);
        setActionMessage('프로그램을 등록했습니다.');
      }

      setIsProgramModalOpen(false);
      setProgramForm(emptyProgramForm);
      await loadPrograms(programPage, submittedGameFilter);
      if (user?.id) {
        await loadDashboard(user.id);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '프로그램 저장에 실패했습니다.');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDeleteProgram(program: MentoringProgramResponse) {
    const confirmed = window.confirm(`"${program.title}" 프로그램을 삭제할까요?`);
    if (!confirmed) {
      return;
    }

    setBusyKey(`delete-${program.id}`);
    setActionError(null);
    setActionMessage(null);

    try {
      await deleteMentoringProgram(program.id);
      setActionMessage('프로그램을 삭제했습니다.');
      await loadPrograms(programPage, submittedGameFilter);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '프로그램 삭제에 실패했습니다.');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleApplyToProgram() {
    if (!selectedProgramId || !applyMessage.trim()) {
      setActionError('신청 메시지를 입력해 주세요.');
      return;
    }

    setBusyKey('apply-program');
    setActionError(null);
    setActionMessage(null);

    try {
      await applyToProgram({
        programId: selectedProgramId,
        message: applyMessage.trim(),
      });

      setApplyMessage('');
      setIsApplyModalOpen(false);
      setActionMessage('멘토링 신청이 완료되었습니다.');

      if (user?.id) {
        await loadDashboard(user.id);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '멘토링 신청에 실패했습니다.');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleApplicationAction(
    key: string,
    action: () => Promise<unknown>,
    successMessage: string
  ) {
    setBusyKey(key);
    setActionError(null);
    setActionMessage(null);

    try {
      await action();
      setActionMessage(successMessage);

      if (user?.id) {
        await loadDashboard(user.id);
      }

      if (selectedProgramId) {
        await loadProgramDetail(selectedProgramId);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '상태 변경에 실패했습니다.');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleCreateReview() {
    if (!reviewTarget || !reviewContent.trim()) {
      setActionError('리뷰 내용을 입력해 주세요.');
      return;
    }

    setBusyKey(`review-${reviewTarget.id}`);
    setActionError(null);
    setActionMessage(null);

    try {
      await createMentoringReview({
        applicationId: reviewTarget.id,
        rating: reviewRating,
        content: reviewContent.trim(),
      });

      setReviewTarget(null);
      setReviewContent('');
      setReviewRating(5);
      setIsReviewModalOpen(false);
      setActionMessage('리뷰를 등록했습니다.');

      if (user?.id) {
        await loadDashboard(user.id);
      }

      if (selectedProgramId) {
        await loadProgramDetail(selectedProgramId);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '리뷰 등록에 실패했습니다.');
    } finally {
      setBusyKey(null);
    }
  }

  const isMentor = Boolean(myMentorProfile);
  const selectedProgramSummary = programs.find((program) => program.id === selectedProgramId) ?? null;
  const ownPrograms = programs.filter((program) => program.mentorId === user?.id);

  return (
    <div className="min-h-screen bg-[#f6f4ee]">
      <div className="mx-auto max-w-7xl px-5 py-8 md:px-8">
        <section className="overflow-hidden rounded-[34px] border border-black/10 bg-[radial-gradient(circle_at_top_left,_rgba(255,209,102,0.55),_rgba(255,255,255,0.96)_42%),linear-gradient(135deg,_#151515,_#242424)] p-8 text-white shadow-[0_35px_80px_-45px_rgba(0,0,0,0.75)] md:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.25em] text-amber-100">
                <Sparkles size={14} />
                Mentoring Control Room
              </div>
              <h1
                className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                실전 게이머를 위한 멘토링 허브
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/75 md:text-base">
                백엔드 멘토링 API에 맞춰 프로그램 탐색, 신청, 진행 상태 관리, 리뷰 작성까지 한 곳에서 이어지는 화면입니다.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  onClick={() => setView('discover')}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-black shadow-lg transition hover:translate-y-[-1px]"
                >
                  <Search size={16} />
                  프로그램 탐색
                </button>
                <button
                  onClick={() => setView('activity')}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/16"
                >
                  <CheckCircle2 size={16} />
                  내 신청 내역
                </button>
                {isMentor ? (
                  <button
                    onClick={() => {
                      setView('studio');
                      openProgramCreateModal();
                    }}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/16"
                  >
                    <PenSquare size={16} />
                    프로그램 등록
                  </button>
                ) : (
                  <button
                    onClick={() => setIsMentorModalOpen(true)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/16"
                  >
                    <UserRoundPlus size={16} />
                    멘토 등록
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <MetricCard
                label="열린 프로그램"
                value={String(programs.length)}
                icon={<BookOpen size={18} />}
                hint={submittedGameFilter ? `${submittedGameFilter} 기준 결과` : '전체 프로그램 기준'}
              />
              <MetricCard
                label="내 신청"
                value={String(menteeApplications.length)}
                icon={<CalendarClock size={18} />}
                hint="멘티 기준 진행 상황"
              />
              <MetricCard
                label="멘토 리뷰 평점"
                value={myMentorProfile ? myMentorProfile.ratingAvg.toFixed(1) : '-'}
                icon={<Star size={18} />}
                hint={myMentorProfile ? `${myMentorProfile.reviewCount}개 리뷰` : '멘토 등록 후 집계'}
              />
            </div>
          </div>
        </section>

        <div className="mt-6 flex flex-wrap gap-3">
          {[
            { key: 'discover', label: 'Discover', description: '프로그램 찾기와 상세 보기' },
            { key: 'activity', label: 'My Activity', description: '신청, 완료, 리뷰 관리' },
            { key: 'studio', label: 'Mentor Studio', description: '멘토 등록과 신청 관리' },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setView(item.key as ViewKey)}
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                view === item.key
                  ? 'border-black bg-black text-white shadow-lg'
                  : 'border-black/10 bg-white text-black hover:border-black/25'
              }`}
            >
              <div className="text-sm font-black">{item.label}</div>
              <div className={`mt-1 text-xs ${view === item.key ? 'text-white/70' : 'text-zinc-500'}`}>
                {item.description}
              </div>
            </button>
          ))}
        </div>

        {actionMessage ? (
          <Banner tone="success" className="mt-5">
            {actionMessage}
          </Banner>
        ) : null}
        {actionError ? (
          <Banner tone="danger" className="mt-5">
            {actionError}
          </Banner>
        ) : null}
        {pageError ? (
          <Banner tone="warning" className="mt-5">
            {pageError}
          </Banner>
        ) : null}

        {view === 'discover' ? (
          <section className="mt-6 grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
            <div className="rounded-[28px] border border-black/10 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-600">
                    Program Explorer
                  </div>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-black">
                    멘토링 프로그램 탐색
                  </h2>
                </div>
                <div className="text-xs font-bold text-zinc-500">
                  페이지 {programPage + 1} / {Math.max(1, totalPages)}
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <label className="flex-1 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                  <div className="mb-1 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">
                    Game Filter
                  </div>
                  <input
                    value={gameFilter}
                    onChange={(event) => setGameFilter(event.target.value)}
                    placeholder="예: PUBG, LOL"
                    className="w-full bg-transparent text-sm text-black outline-none placeholder:text-zinc-400"
                  />
                </label>
                <button
                  onClick={() => {
                    setProgramPage(0);
                    setSubmittedGameFilter(gameFilter.trim());
                  }}
                  className="rounded-2xl bg-black px-5 py-3 text-sm font-black text-white transition hover:bg-zinc-800"
                >
                  필터 적용
                </button>
              </div>

              <div className="mt-5 space-y-4">
                {loadingPrograms ? (
                  <CardSkeleton label="프로그램을 불러오는 중입니다..." />
                ) : programs.length === 0 ? (
                  <EmptyState
                    title="표시할 프로그램이 없습니다"
                    description="게임 필터를 바꾸거나 멘토로 등록해서 첫 프로그램을 만들어 보세요."
                  />
                ) : (
                  programs.map((program) => {
                    const isSelected = program.id === selectedProgramId;
                    const isMine = program.mentorId === user?.id;

                    return (
                      <button
                        key={program.id}
                        onClick={() => setSelectedProgramId(program.id)}
                        className={`w-full rounded-[26px] border p-5 text-left transition ${
                          isSelected
                            ? 'border-black bg-black text-white shadow-xl'
                            : 'border-zinc-200 bg-zinc-50 hover:border-black/30 hover:bg-white'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className={`text-[11px] font-black uppercase tracking-[0.18em] ${isSelected ? 'text-amber-200' : 'text-amber-600'}`}>
                              {program.gameName}
                            </div>
                            <h3 className="mt-2 text-xl font-black tracking-tight">
                              {program.title}
                            </h3>
                            <p className={`mt-2 line-clamp-2 text-sm leading-6 ${isSelected ? 'text-white/72' : 'text-zinc-600'}`}>
                              {program.content}
                            </p>
                          </div>
                          <StatusPill
                            label={program.status}
                            className={isSelected ? 'border-white/20 bg-white/10 text-white' : programStatusStyles[program.status]}
                          />
                        </div>

                        <div className={`mt-4 flex flex-wrap gap-2 ${isSelected ? 'text-white/72' : 'text-zinc-600'}`}>
                          {program.tags.map((tag) => (
                            <span
                              key={`${program.id}-${tag}`}
                              className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                                isSelected ? 'bg-white/10 text-white' : 'bg-white text-zinc-500'
                              }`}
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>

                        <div className={`mt-5 grid gap-3 text-sm sm:grid-cols-3 ${isSelected ? 'text-white' : 'text-black'}`}>
                          <MiniInfo label="Mentor" value={program.mentorNickName} />
                          <MiniInfo label="Price" value={`${formatMileage(program.price)} M`} />
                          <MiniInfo label="Created" value={formatKoreanDate(program.createdAt)} />
                        </div>

                        {isMine ? (
                          <div className={`mt-4 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] ${isSelected ? 'text-amber-200' : 'text-black'}`}>
                            <ShieldCheck size={14} />
                            내가 등록한 프로그램
                          </div>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <button
                  onClick={() => setProgramPage((current) => Math.max(0, current - 1))}
                  disabled={programPage === 0}
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-black text-zinc-600 transition disabled:cursor-not-allowed disabled:opacity-45"
                >
                  이전
                </button>
                <button
                  onClick={() => setProgramPage((current) => (current + 1 < totalPages ? current + 1 : current))}
                  disabled={programPage + 1 >= totalPages}
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-black text-zinc-600 transition disabled:cursor-not-allowed disabled:opacity-45"
                >
                  다음
                </button>
              </div>
            </div>

            <div className="rounded-[28px] border border-black/10 bg-white p-5 shadow-sm">
              {loadingDetail ? (
                <CardSkeleton label="프로그램 상세를 불러오는 중입니다..." />
              ) : programDetail && selectedMentorProfile ? (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-600">
                        {programDetail.gameName}
                      </div>
                      <h2 className="mt-2 text-3xl font-black tracking-tight text-black">
                        {programDetail.title}
                      </h2>
                    </div>
                    <StatusPill label={selectedProgramSummary?.status ?? 'ACTIVE'} className={programStatusStyles[selectedProgramSummary?.status ?? 'ACTIVE']} />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {programDetail.tags.map((tag) => (
                      <span
                        key={`${programDetail.id}-${tag}`}
                        className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-black text-zinc-600"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-3">
                    <InfoBlock
                      icon={<CircleDollarSign size={18} />}
                      label="Price"
                      value={`${formatMileage(programDetail.price)} M`}
                    />
                    <InfoBlock
                      icon={<CalendarClock size={18} />}
                      label="Available Time"
                      value={programDetail.availableTimeDesc || '협의 가능'}
                    />
                    <InfoBlock
                      icon={<BookOpen size={18} />}
                      label="Created"
                      value={formatKoreanDate(programDetail.createdAt)}
                    />
                  </div>

                  <div className="mt-6 rounded-[28px] border border-zinc-200 bg-zinc-50 p-5">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
                      Program Brief
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-700">
                      {programDetail.content}
                    </p>
                  </div>

                  <div className="mt-6 rounded-[30px] border border-black bg-black p-6 text-white shadow-xl">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-200">
                          Mentor Profile
                        </div>
                        <h3 className="mt-2 text-2xl font-black">{selectedMentorProfile.nickname}</h3>
                        <p className="mt-3 max-w-2xl text-sm leading-7 text-white/72">
                          {selectedMentorProfile.about || programDetail.mentorAbout}
                        </p>
                      </div>
                      <StatusPill
                        label={selectedMentorProfile.status}
                        className="border-white/20 bg-white/10 text-white"
                      />
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <MetricDark label="평점" value={selectedMentorProfile.ratingAvg.toFixed(1)} icon={<Star size={16} />} />
                      <MetricDark label="리뷰 수" value={String(selectedMentorProfile.reviewCount)} icon={<PenSquare size={16} />} />
                      <MetricDark label="누적 멘티" value={String(selectedMentorProfile.menteeCount)} icon={<Users size={16} />} />
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    {selectedProgramSummary?.mentorId === user?.id ? (
                      <>
                        <button
                          onClick={() => openProgramEditModal(selectedProgramSummary)}
                          className="inline-flex items-center gap-2 rounded-2xl bg-black px-5 py-3 text-sm font-black text-white transition hover:bg-zinc-800"
                        >
                          <PenSquare size={16} />
                          프로그램 수정
                        </button>
                        <button
                          onClick={() => void handleDeleteProgram(selectedProgramSummary)}
                          disabled={busyKey === `delete-${selectedProgramSummary.id}`}
                          className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-black text-rose-700 transition disabled:opacity-50"
                        >
                          <Trash2 size={16} />
                          삭제
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setIsApplyModalOpen(true)}
                        disabled={!selectedProgramSummary || selectedProgramSummary.status !== 'ACTIVE'}
                        className="inline-flex items-center gap-2 rounded-2xl bg-black px-5 py-3 text-sm font-black text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
                      >
                        <ChevronRight size={16} />
                        멘토링 신청하기
                      </button>
                    )}
                  </div>

                  <div className="mt-8">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
                          Reviews
                        </div>
                        <h3 className="mt-2 text-2xl font-black tracking-tight text-black">
                          멘티 후기
                        </h3>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {selectedMentorReviews.length === 0 ? (
                        <EmptyState
                          title="아직 등록된 리뷰가 없습니다"
                          description="첫 멘티 후기가 쌓이면 신뢰도를 한눈에 보여줄 수 있습니다."
                          compact
                        />
                      ) : (
                        selectedMentorReviews.map((review) => (
                          <div
                            key={review.id}
                            className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-black text-black">{review.menteeNickname}</div>
                                <div className="mt-1 text-xs font-bold text-zinc-500">
                                  {formatKoreanDate(review.createdAt)}
                                </div>
                              </div>
                              <div className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-black text-amber-600">
                                <Star size={14} className="fill-amber-400 text-amber-400" />
                                {review.rating}.0
                              </div>
                            </div>
                            <p className="mt-3 text-sm leading-7 text-zinc-700">{review.content}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <EmptyState
                  title="프로그램을 선택해 주세요"
                  description="왼쪽 목록에서 원하는 멘토링 프로그램을 고르면 상세 정보와 리뷰가 표시됩니다."
                />
              )}
            </div>
          </section>
        ) : null}

        {view === 'activity' ? (
          <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
            <div className="rounded-[28px] border border-black/10 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-600">
                    Mentee Dashboard
                  </div>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-black">
                    내가 신청한 멘토링
                  </h2>
                </div>
                {loadingDashboard ? <LoaderCircle className="animate-spin text-zinc-400" size={18} /> : null}
              </div>

              <div className="mt-5 space-y-4">
                {menteeApplications.length === 0 ? (
                  <EmptyState
                    title="아직 신청한 멘토링이 없습니다"
                    description="관심 있는 프로그램을 찾아 바로 신청해 보세요."
                  />
                ) : (
                  menteeApplications.map((application) => (
                    <ApplicationCard
                      key={application.id}
                      application={application}
                      footer={
                        <div className="mt-4 flex flex-wrap gap-2">
                          {application.status === 'ONGOING' ? (
                            <ActionButton
                              label="완료 확정"
                              busy={busyKey === `complete-${application.id}`}
                              onClick={() =>
                                void handleApplicationAction(
                                  `complete-${application.id}`,
                                  () => completeMentoring(application.id),
                                  '멘토링 완료를 확정했습니다.'
                                )
                              }
                            />
                          ) : null}
                          {application.status === 'FINISHED' ? (
                            <ActionButton
                              label="완료 확정 시도"
                              busy={busyKey === `complete-${application.id}`}
                              onClick={() =>
                                void handleApplicationAction(
                                  `complete-${application.id}`,
                                  () => completeMentoring(application.id),
                                  '멘토링 완료를 확정했습니다.'
                                )
                              }
                              secondary
                            />
                          ) : null}
                          {application.status === 'COMPLETED' ? (
                            <ActionButton
                              label="리뷰 작성"
                              busy={false}
                              onClick={() => {
                                setReviewTarget(application);
                                setReviewContent('');
                                setReviewRating(5);
                                setIsReviewModalOpen(true);
                              }}
                            />
                          ) : null}
                        </div>
                      }
                    />
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-black/10 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-600">
                    Journey Notes
                  </div>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-black">
                    상태 가이드
                  </h2>
                </div>
              </div>

              <div className="mt-5 grid gap-4">
                <GuideCard
                  title="신청 후"
                  description="신청하면 마일리지가 임시 보관 상태로 전환됩니다. 결제 상태는 ESCROW_HELD로 표시됩니다."
                />
                <GuideCard
                  title="멘토 수락 후"
                  description="멘토가 신청을 수락하면 ACCEPTED 상태가 되며, 진행 시작 전까지 대기 상태로 볼 수 있습니다."
                />
                <GuideCard
                  title="진행 중과 완료"
                  description="진행 중에는 ONGOING, 멘티가 완료를 확정하면 COMPLETED가 됩니다. 그때 리뷰 작성 버튼을 노출합니다."
                />
                <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-5">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 text-amber-600" size={18} />
                    <div>
                      <div className="text-sm font-black text-amber-900">백엔드 상태 전이 참고</div>
                      <p className="mt-2 text-sm leading-6 text-amber-800">
                        `FINISHED`와 `COMPLETE` 흐름은 백엔드 조건이 엄격해서, 멘티 화면에는 완료 확정 버튼을 `ONGOING`과 `FINISHED` 모두에서 시도 가능하게 두었습니다.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {view === 'studio' ? (
          <section className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[28px] border border-black/10 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-600">
                    Mentor Studio
                  </div>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-black">
                    멘토 셋업
                  </h2>
                </div>
                {isMentor ? (
                  <button
                    onClick={openProgramCreateModal}
                    className="rounded-2xl bg-black px-4 py-2 text-sm font-black text-white transition hover:bg-zinc-800"
                  >
                    프로그램 추가
                  </button>
                ) : null}
              </div>

              {isMentor && myMentorProfile ? (
                <div className="mt-5 rounded-[30px] border border-black bg-black p-6 text-white">
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-200">
                    Active Mentor
                  </div>
                  <h3 className="mt-3 text-2xl font-black">{myMentorProfile.nickname}</h3>
                  <p className="mt-3 text-sm leading-7 text-white/75">{myMentorProfile.about}</p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <MetricDark label="평점" value={myMentorProfile.ratingAvg.toFixed(1)} icon={<Star size={16} />} />
                    <MetricDark label="리뷰 수" value={String(myMentorProfile.reviewCount)} icon={<PenSquare size={16} />} />
                    <MetricDark label="누적 멘티" value={String(myMentorProfile.menteeCount)} icon={<Users size={16} />} />
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-[28px] border border-dashed border-zinc-300 bg-zinc-50 p-6">
                  <div className="text-lg font-black text-black">아직 멘토로 등록되지 않았습니다</div>
                  <p className="mt-2 text-sm leading-7 text-zinc-600">
                    멘토 소개를 등록하면 프로그램 생성과 신청 관리 기능을 사용할 수 있습니다.
                  </p>
                  <button
                    onClick={() => setIsMentorModalOpen(true)}
                    className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-black px-5 py-3 text-sm font-black text-white transition hover:bg-zinc-800"
                  >
                    <UserRoundPlus size={16} />
                    멘토 등록 시작
                  </button>
                </div>
              )}

              <div className="mt-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-lg font-black text-black">내 프로그램</div>
                  <div className="text-xs font-bold text-zinc-500">{ownPrograms.length}개</div>
                </div>

                <div className="mt-4 space-y-3">
                  {ownPrograms.length === 0 ? (
                    <EmptyState
                      title="현재 페이지에 노출된 내 프로그램이 없습니다"
                      description="프로그램을 등록하거나 필터를 비워서 전체 목록에서 찾아보세요."
                      compact
                    />
                  ) : (
                    ownPrograms.map((program) => (
                      <div key={program.id} className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-600">
                              {program.gameName}
                            </div>
                            <div className="mt-2 text-lg font-black text-black">{program.title}</div>
                            <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-600">{program.content}</p>
                          </div>
                          <StatusPill label={program.status} className={programStatusStyles[program.status]} />
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <ActionButton label="수정" onClick={() => openProgramEditModal(program)} />
                          <ActionButton
                            label="삭제"
                            secondary
                            busy={busyKey === `delete-${program.id}`}
                            onClick={() => void handleDeleteProgram(program)}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-black/10 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-600">
                    Mentor Queue
                  </div>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-black">
                    받은 신청 관리
                  </h2>
                </div>
                {loadingDashboard ? <LoaderCircle className="animate-spin text-zinc-400" size={18} /> : null}
              </div>

              <div className="mt-5 space-y-4">
                {mentorApplications.length === 0 ? (
                  <EmptyState
                    title="관리할 신청이 없습니다"
                    description="멘티가 프로그램을 신청하면 이곳에서 수락, 거절, 시작, 종료 보고까지 처리할 수 있습니다."
                  />
                ) : (
                  mentorApplications.map((application) => (
                    <ApplicationCard
                      key={application.id}
                      application={application}
                      footer={
                        <div className="mt-4 flex flex-wrap gap-2">
                          {application.status === 'APPLIED' ? (
                            <>
                              <ActionButton
                                label="수락"
                                busy={busyKey === `accept-${application.id}`}
                                onClick={() =>
                                  void handleApplicationAction(
                                    `accept-${application.id}`,
                                    () => acceptApplication(application.id),
                                    '신청을 수락했습니다.'
                                  )
                                }
                              />
                              <ActionButton
                                label="거절"
                                secondary
                                busy={busyKey === `reject-${application.id}`}
                                onClick={() =>
                                  void handleApplicationAction(
                                    `reject-${application.id}`,
                                    () => rejectApplication(application.id),
                                    '신청을 거절했습니다.'
                                  )
                                }
                              />
                            </>
                          ) : null}
                          {application.status === 'ACCEPTED' ? (
                            <ActionButton
                              label="멘토링 시작"
                              busy={busyKey === `start-${application.id}`}
                              onClick={() =>
                                void handleApplicationAction(
                                  `start-${application.id}`,
                                  () => startMentoring(application.id),
                                  '멘토링을 시작했습니다.'
                                )
                              }
                            />
                          ) : null}
                          {application.status === 'ONGOING' ? (
                            <ActionButton
                              label="종료 보고"
                              busy={busyKey === `finish-${application.id}`}
                              onClick={() =>
                                void handleApplicationAction(
                                  `finish-${application.id}`,
                                  () => finishMentoring(application.id),
                                  '멘토링 종료 보고를 남겼습니다.'
                                )
                              }
                            />
                          ) : null}
                        </div>
                      }
                    />
                  ))
                )}
              </div>
            </div>
          </section>
        ) : null}
      </div>

      <Modal
        open={isMentorModalOpen}
        onClose={() => setIsMentorModalOpen(false)}
        title="멘토 등록"
        description="소개 한 줄만 먼저 등록하면 프로그램을 만들고 신청을 관리할 수 있습니다."
      >
        <textarea
          value={mentorAbout}
          onChange={(event) => setMentorAbout(event.target.value)}
          rows={5}
          placeholder="예: PUBG 경쟁전 운영과 교전 판단 위주로 코칭합니다."
          className="w-full rounded-[22px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-black outline-none placeholder:text-zinc-400"
        />
        <div className="mt-5 flex justify-end gap-3">
          <GhostButton onClick={() => setIsMentorModalOpen(false)}>닫기</GhostButton>
          <PrimaryButton busy={busyKey === 'register-mentor'} onClick={() => void handleRegisterMentor()}>
            멘토 등록 완료
          </PrimaryButton>
        </div>
      </Modal>

      <Modal
        open={isProgramModalOpen}
        onClose={() => setIsProgramModalOpen(false)}
        title={editingProgram ? '프로그램 수정' : '프로그램 등록'}
        description="백엔드 `MentoringProgramRequest`와 `MentoringProgramUpdateRequest` 구조에 맞춘 입력 폼입니다."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <FormField label="게임명">
            <input
              value={programForm.gameName}
              onChange={(event) => setProgramForm((current) => ({ ...current, gameName: event.target.value }))}
              disabled={Boolean(editingProgram)}
              placeholder="PUBG"
              className="w-full rounded-[18px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none disabled:opacity-60"
            />
          </FormField>
          <FormField label="가격">
            <input
              value={programForm.price}
              onChange={(event) => setProgramForm((current) => ({ ...current, price: event.target.value }))}
              placeholder="10000"
              className="w-full rounded-[18px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none"
            />
          </FormField>
        </div>

        <div className="mt-3">
          <FormField label="제목">
            <input
              value={programForm.title}
              onChange={(event) => setProgramForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="배그 경쟁전 실전 코칭"
              className="w-full rounded-[18px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none"
            />
          </FormField>
        </div>

        <div className="mt-3">
          <FormField label="가능 시간">
            <input
              value={programForm.availableTimeDesc}
              onChange={(event) => setProgramForm((current) => ({ ...current, availableTimeDesc: event.target.value }))}
              placeholder="평일 오후 8시 이후"
              className="w-full rounded-[18px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none"
            />
          </FormField>
        </div>

        <div className="mt-3">
          <FormField label="태그">
            <input
              value={programForm.tags}
              onChange={(event) => setProgramForm((current) => ({ ...current, tags: event.target.value }))}
              placeholder="운영, 에임, 리플레이"
              className="w-full rounded-[18px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none"
            />
          </FormField>
        </div>

        {editingProgram ? (
          <div className="mt-3">
            <FormField label="상태">
              <select
                value={programForm.status}
                onChange={(event) =>
                  setProgramForm((current) => ({ ...current, status: event.target.value as ProgramStatus }))
                }
                className="w-full rounded-[18px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="CLOSED">CLOSED</option>
              </select>
            </FormField>
          </div>
        ) : null}

        <div className="mt-3">
          <FormField label="상세 설명">
            <textarea
              value={programForm.content}
              onChange={(event) => setProgramForm((current) => ({ ...current, content: event.target.value }))}
              rows={5}
              placeholder="교전 리플레이와 포지션 선택 중심으로 실전 피드백을 진행합니다."
              className="w-full rounded-[18px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none"
            />
          </FormField>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <GhostButton onClick={() => setIsProgramModalOpen(false)}>닫기</GhostButton>
          <PrimaryButton
            busy={busyKey === 'create-program' || busyKey === 'edit-program'}
            onClick={() => void handleProgramSubmit()}
          >
            {editingProgram ? '수정 저장' : '프로그램 등록'}
          </PrimaryButton>
        </div>
      </Modal>

      <Modal
        open={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
        title="멘토링 신청"
        description="신청 즉시 마일리지가 보관 상태로 전환됩니다. 안내 메시지를 간단히 남겨 주세요."
      >
        <div className="rounded-[22px] border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          예상 차감 마일리지: {programDetail ? `${formatMileage(programDetail.price)} M` : '-'}
        </div>
        <textarea
          value={applyMessage}
          onChange={(event) => setApplyMessage(event.target.value)}
          rows={5}
          placeholder="멘토님께 전달할 요청 내용을 적어 주세요."
          className="mt-4 w-full rounded-[22px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-black outline-none placeholder:text-zinc-400"
        />
        <div className="mt-5 flex justify-end gap-3">
          <GhostButton onClick={() => setIsApplyModalOpen(false)}>취소</GhostButton>
          <PrimaryButton busy={busyKey === 'apply-program'} onClick={() => void handleApplyToProgram()}>
            신청 완료
          </PrimaryButton>
        </div>
      </Modal>

      <Modal
        open={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        title="리뷰 작성"
        description="멘토링이 완료된 뒤 남기는 후기입니다. 별점과 함께 실제 도움이 된 포인트를 적어 주세요."
      >
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((score) => (
            <button
              key={score}
              onClick={() => setReviewRating(score)}
              className={`rounded-full p-2 transition ${score <= reviewRating ? 'bg-amber-100 text-amber-500' : 'bg-zinc-100 text-zinc-400'}`}
            >
              <Star size={18} className={score <= reviewRating ? 'fill-amber-400' : ''} />
            </button>
          ))}
        </div>
        <textarea
          value={reviewContent}
          onChange={(event) => setReviewContent(event.target.value)}
          rows={5}
          placeholder="예: 운영 판단 설명이 명확해서 바로 실전에 적용할 수 있었습니다."
          className="mt-4 w-full rounded-[22px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-black outline-none placeholder:text-zinc-400"
        />
        <div className="mt-5 flex justify-end gap-3">
          <GhostButton onClick={() => setIsReviewModalOpen(false)}>닫기</GhostButton>
          <PrimaryButton busy={busyKey?.startsWith('review-') ?? false} onClick={() => void handleCreateReview()}>
            리뷰 등록
          </PrimaryButton>
        </div>
      </Modal>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  hint: string;
}) {
  return (
    <div className="rounded-[26px] border border-white/12 bg-white/10 p-4 backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div className="text-xs font-black uppercase tracking-[0.2em] text-white/65">{label}</div>
        <div className="text-white/75">{icon}</div>
      </div>
      <div className="mt-3 text-3xl font-black">{value}</div>
      <div className="mt-2 text-xs text-white/60">{hint}</div>
    </div>
  );
}

function Banner({
  children,
  tone,
  className = '',
}: {
  children: ReactNode;
  tone: 'success' | 'danger' | 'warning';
  className?: string;
}) {
  const styles = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    danger: 'border-rose-200 bg-rose-50 text-rose-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
  };

  return (
    <div className={`rounded-[24px] border px-4 py-3 text-sm font-bold ${styles[tone]} ${className}`}>
      {children}
    </div>
  );
}

function CardSkeleton({ label }: { label: string }) {
  return (
    <div className="rounded-[26px] border border-zinc-200 bg-zinc-50 p-6">
      <div className="flex items-center gap-3 text-sm font-bold text-zinc-500">
        <LoaderCircle className="animate-spin" size={16} />
        {label}
      </div>
    </div>
  );
}

function EmptyState({
  title,
  description,
  compact = false,
}: {
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-[26px] border border-dashed border-zinc-300 bg-zinc-50 text-center ${compact ? 'p-5' : 'p-8'}`}>
      <div className="text-lg font-black text-black">{title}</div>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-zinc-600">{description}</p>
    </div>
  );
}

function StatusPill({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${className}`}>
      {label}
    </span>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-black uppercase tracking-[0.16em] opacity-60">{label}</div>
      <div className="mt-1 text-sm font-bold">{value}</div>
    </div>
  );
}

function InfoBlock({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex items-center gap-2 text-zinc-500">{icon}</div>
      <div className="mt-3 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">{label}</div>
      <div className="mt-1 text-sm font-black text-black">{value}</div>
    </div>
  );
}

function MetricDark({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/8 p-4">
      <div className="flex items-center gap-2 text-white/65">{icon}</div>
      <div className="mt-3 text-[11px] font-black uppercase tracking-[0.18em] text-white/60">{label}</div>
      <div className="mt-1 text-xl font-black text-white">{value}</div>
    </div>
  );
}

function ApplicationCard({
  application,
  footer,
}: {
  application: MentoringApplicationResponse;
  footer?: ReactNode;
}) {
  return (
    <div className="rounded-[26px] border border-zinc-200 bg-zinc-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-600">
            {application.mentorNickname} ↔ {application.menteeNickname}
          </div>
          <h3 className="mt-2 text-xl font-black tracking-tight text-black">
            {application.programTitle}
          </h3>
          <p className="mt-2 text-sm leading-6 text-zinc-600">{application.message}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusPill label={application.status} className={appStatusStyles[application.status]} />
          <StatusPill label={application.paymentStatus} className={paymentStatusStyles[application.paymentStatus]} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <MiniInfo label="Applied Mileage" value={`${formatMileage(application.appliedMileage)} M`} />
        <MiniInfo label="Mentor" value={application.mentorNickname} />
        <MiniInfo label="Created" value={formatKoreanDate(application.createdAt)} />
      </div>

      {footer}
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  busy = false,
  secondary = false,
}: {
  label: string;
  onClick: () => void;
  busy?: boolean;
  secondary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
        secondary
          ? 'border border-zinc-200 bg-white text-zinc-700 hover:border-black/20'
          : 'bg-black text-white hover:bg-zinc-800'
      }`}
    >
      {busy ? <LoaderCircle className="animate-spin" size={14} /> : null}
      {label}
    </button>
  );
}

function GuideCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-5">
      <div className="text-lg font-black text-black">{title}</div>
      <p className="mt-2 text-sm leading-7 text-zinc-600">{description}</p>
    </div>
  );
}

function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-8">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[32px] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-600">Mentoring Flow</div>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-black">{title}</h3>
            <p className="mt-2 text-sm leading-7 text-zinc-600">{description}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-zinc-200 px-3 py-1 text-sm font-black text-zinc-500 transition hover:border-black/15 hover:text-black"
          >
            닫기
          </button>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">{label}</div>
      {children}
    </label>
  );
}

function GhostButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-black text-zinc-700 transition hover:border-black/20"
    >
      {children}
    </button>
  );
}

function PrimaryButton({
  children,
  onClick,
  busy,
}: {
  children: ReactNode;
  onClick: () => void;
  busy: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-2xl bg-black px-5 py-3 text-sm font-black text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
    >
      {busy ? <LoaderCircle className="animate-spin" size={16} /> : null}
      {children}
    </button>
  );
}

function splitTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}
