import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CreditCard,
  Edit3,
  Loader2,
  MessageCircle,
  Plus,
  Search,
  ShieldCheck,
  Star,
  UserPlus,
  X,
} from 'lucide-react';
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import {
  acceptMentoringApplication,
  applyToMentoringProgram,
  completeMentoringApplication,
  createMentoringProgram,
  createMentoringReview,
  deleteMentoringProgram,
  emptyPage,
  fetchMenteeApplications,
  fetchMentorApplications,
  fetchMentoringProgramDetail,
  fetchMentoringPrograms,
  fetchMentorProfile,
  fetchMentorReviews,
  finishMentoringApplication,
  isMentoringAuthError,
  registerMentor,
  rejectMentoringApplication,
  startMentoringApplication,
  updateMentoringProgram,
  type ApplicationStatus,
  type MentoringApplicationResponse,
  type MentoringProgramDetailResponse,
  type MentoringProgramResponse,
  type MentoringProgramUpdateRequest,
  type MentoringReviewResponse,
  type MentorProfileResponse,
  type PageResponse,
  type PaymentStatus,
  type ProgramStatus,
} from '@/lib/mentoring-api';

type MentoringTab = 'find' | 'mine' | 'become';

type ProgramForm = {
  gameName: string;
  title: string;
  method: string;
  content: string;
  availableTimeDesc: string;
  price: string;
  status: ProgramStatus;
  tags: string;
};

type ReviewForm = {
  rating: number;
  content: string;
};

const tabs: { id: MentoringTab; label: string }[] = [
  { id: 'find', label: '멘토 찾기' },
  { id: 'mine', label: '내 멘토링' },
  { id: 'become', label: '멘토 되기' },
];

const mentoringGames = ['전체', 'PUBG', 'League of Legends', 'Valorant', 'Overwatch', 'CS2', 'Other'];

const defaultProgramForm: ProgramForm = {
  gameName: 'PUBG',
  title: '',
  method: '',
  content: '',
  availableTimeDesc: '',
  price: '10000',
  status: 'ACTIVE',
  tags: '',
};

const ratingFilters = [
  { value: 'all', label: '전체 평점' },
  { value: '4', label: '4.0 이상' },
  { value: '4.5', label: '4.5 이상' },
] as const;

const applicationStatusMeta: Record<ApplicationStatus, { label: string; className: string }> = {
  APPLIED: { label: '신청됨', className: 'bg-yellow-100 text-yellow-700' },
  ACCEPTED: { label: '수락됨', className: 'bg-blue-100 text-blue-700' },
  REJECTED: { label: '거절됨', className: 'bg-red-100 text-red-700' },
  ONGOING: { label: '진행중', className: 'bg-violet-100 text-violet-700' },
  FINISHED: { label: '종료 보고', className: 'bg-orange-100 text-orange-700' },
  COMPLETED: { label: '완료', className: 'bg-green-100 text-green-700' },
  CANCELLED: { label: '취소됨', className: 'bg-zinc-100 text-zinc-500' },
};

const paymentStatusMeta: Record<PaymentStatus, string> = {
  PENDING: '결제 대기',
  ESCROW_HELD: '에스크로 보관',
  SETTLED: '정산 완료',
  REFUNDED: '환불 완료',
};

function getApplicationGuide(role: 'mentor' | 'mentee', status: ApplicationStatus, paymentStatus: PaymentStatus) {
  if (status === 'APPLIED') {
    return role === 'mentor'
      ? '멘티의 신청이 들어왔습니다. 수락하면 멘토링을 시작할 수 있고, 거절하면 마일리지가 환불됩니다.'
      : `멘토의 수락을 기다리는 중입니다. 결제 상태: ${paymentStatusMeta[paymentStatus] ?? paymentStatus}`;
  }

  if (status === 'ACCEPTED') {
    return role === 'mentor'
      ? '수락된 신청입니다. 약속된 시간에 맞춰 시작 버튼을 눌러 진행 상태로 바꿔주세요.'
      : '멘토가 신청을 수락했습니다. 약속된 시간과 방식으로 멘토링을 진행하면 됩니다.';
  }

  if (status === 'ONGOING') {
    return role === 'mentor'
      ? '멘토링 진행 중입니다. 수업이 끝나면 종료 보고를 눌러 정산 대기 상태로 넘겨주세요.'
      : '멘토링 진행 중입니다. 멘토가 종료 보고를 하면 완료 확정 후 정산할 수 있습니다.';
  }

  if (status === 'FINISHED') {
    return role === 'mentee'
      ? '멘토가 수업 종료를 보고했습니다. 문제가 없으면 진행 완료를 눌러 정산을 확정해주세요.'
      : '종료 보고가 완료되었습니다. 멘티가 완료 확정하지 않으면 7일 후 자동 정산됩니다.';
  }

  if (status === 'COMPLETED') {
    return role === 'mentee'
      ? '정산이 완료되었습니다. 멘토링 후기를 남길 수 있습니다.'
      : '정산이 완료된 멘토링입니다.';
  }

  if (status === 'REJECTED') return '거절된 신청입니다. 결제 마일리지는 환불 처리됩니다.';
  if (status === 'CANCELLED') return '취소된 신청입니다.';
  return '';
}

function normalizeId(value?: string | null) {
  return value?.toLowerCase() ?? '';
}

function formatMileage(value: number) {
  return `${Number(value || 0).toLocaleString()} M`;
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
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

function getProgramMethod(rawContent: string) {
  return splitProgramContent(rawContent).method || '진행 방식 협의';
}

function getProgramDescription(rawContent: string) {
  return splitProgramContent(rawContent).content;
}

function programMentorName(program: MentoringProgramResponse | MentoringProgramDetailResponse) {
  if ('mentorNickname' in program && program.mentorNickname) return program.mentorNickname;
  if ('mentorNickName' in program && program.mentorNickName) return program.mentorNickName;
  return '멘토';
}

function StatusBadge({ status }: { status: ApplicationStatus }) {
  const meta = applicationStatusMeta[status] ?? {
    label: status,
    className: 'bg-zinc-100 text-zinc-500',
  };

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black ${meta.className}`}>
      {meta.label}
    </span>
  );
}

function ProgramStatusBadge({ status }: { status: ProgramStatus }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-[11px] font-black ${
        status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'
      }`}
    >
      {status === 'ACTIVE' ? '모집중' : '마감'}
    </span>
  );
}

export default function MentoringPage() {
  const { user, logout } = useAuth();
  const currentUserId = user?.id ?? '';

  const [activeTab, setActiveTab] = useState<MentoringTab>('find');
  const [gameFilter, setGameFilter] = useState('전체');
  const [ratingFilter, setRatingFilter] = useState<(typeof ratingFilters)[number]['value']>('all');
  const [programPage, setProgramPage] = useState<PageResponse<MentoringProgramResponse>>(emptyPage());
  const [programPageNumber, setProgramPageNumber] = useState(0);
  const [programsLoading, setProgramsLoading] = useState(false);
  const [ownedPrograms, setOwnedPrograms] = useState<MentoringProgramResponse[]>([]);
  const [mentorStatsById, setMentorStatsById] = useState<Record<string, MentorProfileResponse>>({});
  const mentorStatsCacheRef = useRef<Record<string, MentorProfileResponse>>({});

  const [mentorProfile, setMentorProfile] = useState<MentorProfileResponse | null>(null);
  const [mentorProfileLoading, setMentorProfileLoading] = useState(false);
  const [showMentorForm, setShowMentorForm] = useState(false);
  const [mentorAbout, setMentorAbout] = useState('');

  const [programForm, setProgramForm] = useState<ProgramForm>(defaultProgramForm);
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);

  const [selectedProgram, setSelectedProgram] = useState<MentoringProgramDetailResponse | null>(null);
  const [selectedMentor, setSelectedMentor] = useState<MentorProfileResponse | null>(null);
  const [selectedReviews, setSelectedReviews] = useState<MentoringReviewResponse[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [applicationMessage, setApplicationMessage] = useState('');

  const [menteeApplications, setMenteeApplications] = useState<MentoringApplicationResponse[]>([]);
  const [mentorApplications, setMentorApplications] = useState<MentoringApplicationResponse[]>([]);
  const [reviewForms, setReviewForms] = useState<Record<string, ReviewForm>>({});

  const [notice, setNotice] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingAction, setPendingAction] = useState('');

  const currentUserIsMentor = Boolean(mentorProfile);

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
      setAuthMessage(
        error instanceof Error
          ? error.message
          : '세션이 만료되었거나 백엔드가 현재 토큰을 거부했습니다. 다시 로그인 후 멘토링을 이용해주세요.'
      );
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

      const mentorIds = Array.from(new Set(page.content.map((program) => program.mentorId)))
        .filter((mentorId) => !mentorStatsCacheRef.current[mentorId]);

      if (mentorIds.length === 0) {
        return;
      }

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
        mentorStatsCacheRef.current = next;
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
      // API 레벨에서 mentorId로 필터링하도록 수정 (클라이언트 단의 100개 제한 문제 해결)
      // fetchMentoringPrograms 타입에 mentorId 옵션이 추가되어야 합니다.
      const page = await fetchMentoringPrograms({ 
        page: 0, 
        size: 100,
        mentorId: currentUserId 
      } as any); 
      setOwnedPrograms(page.content);
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

    setMenteeApplications(
      menteeResult.status === 'fulfilled' ? menteeResult.value.content : []
    );
    setMentorApplications(
      mentorResult.status === 'fulfilled' ? mentorResult.value.content : []
    );
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

  // 코파일럿 리뷰 반영: currentUserId와 activeTab 의존성을 통합하여 불필요한 이중 호출을 방지합니다.
  useEffect(() => {
    if (activeTab === 'mine') {
      if (!currentUserId) {
        setMenteeApplications([]);
        setMentorApplications([]);
        return;
      }
      void loadApplications();
    }
  }, [activeTab, currentUserId, loadApplications]);

  useEffect(() => {
    if (activeTab === 'become') {
      void Promise.all([loadCurrentMentorProfile(), loadOwnedPrograms()]);
    }
  }, [activeTab, loadCurrentMentorProfile, loadOwnedPrograms]);

  const visiblePrograms = useMemo(() => {
    const minimumRating = ratingFilter === 'all' ? 0 : Number(ratingFilter);

    return programPage.content.filter((program) => {
      if (minimumRating === 0) return true;
      return (mentorStatsById[program.mentorId]?.ratingAvg ?? 0) >= minimumRating;
    });
  }, [mentorStatsById, programPage.content, ratingFilter]);
  const totalPages = Math.max(programPage.totalPages || 1, 1);

  const selectedProgramIsMine = useMemo(
    () => currentUserOwnsProgram(selectedProgram?.mentorId),
    [currentUserOwnsProgram, selectedProgram?.mentorId]
  );

  const programPayload = useMemo(
    () => ({
      gameName: programForm.gameName.trim(),
      title: programForm.title.trim(),
      content: buildProgramContent(programForm.method, programForm.content),
      availableTimeDesc: programForm.availableTimeDesc.trim(),
      price: Number(programForm.price),
      tags: parseTags(programForm.tags),
    }),
    [programForm]
  );

  const changeTab = (tab: MentoringTab) => {
    setActiveTab(tab);
    clearMessages();
    setShowMentorForm(false);

    if (tab !== 'become') {
      setEditingProgramId(null);
    }
  };

  const openProgramDetail = async (programId: string) => {
    setDetailLoading(true);
    setSelectedProgram(null);
    setSelectedMentor(null);
    setSelectedReviews([]);
    setErrorMessage('');

    try {
      const detail = await fetchMentoringProgramDetail(programId);
      setSelectedProgram(detail);

      const [mentorResult, reviewsResult] = await Promise.allSettled([
        fetchMentorProfile(detail.mentorId),
        fetchMentorReviews(detail.mentorId, 0, 5),
      ]);

      if (mentorResult.status === 'fulfilled') {
        setSelectedMentor(mentorResult.value);
      }

      if (reviewsResult.status === 'fulfilled') {
        setSelectedReviews(reviewsResult.value.content);
      }
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

  const handleProgramFormChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setProgramForm((current) => ({
      ...current,
      [name]: name === 'price' ? value.replace(/[^0-9]/g, '') : value,
    }));
  };

  const resetProgramForm = () => {
    setProgramForm(defaultProgramForm);
    setEditingProgramId(null);
  };

  const handleSubmitProgram = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPendingAction('save-program');
    clearMessages();

    try {
      if (programPayload.price < 0 || Number.isNaN(programPayload.price)) {
        throw new Error('가격을 올바르게 입력해주세요.');
      }

      if (editingProgramId) {
        const updatePayload: MentoringProgramUpdateRequest = {
          ...programPayload,
          status: programForm.status,
        };
        await updateMentoringProgram(editingProgramId, updatePayload);
        showNotice('프로그램을 수정했습니다.');
      } else {
        await createMentoringProgram(programPayload);
        showNotice('프로그램을 등록했습니다.');
      }

      resetProgramForm();
      await refreshMentoringData();
    } catch (error) {
      showError(error);
    } finally {
      setPendingAction('');
    }
  };

  const startEditProgram = (program: MentoringProgramResponse) => {
    const parsedContent = splitProgramContent(program.content);

    setProgramForm({
      gameName: program.gameName,
      title: program.title,
      method: parsedContent.method,
      content: parsedContent.content,
      availableTimeDesc: program.availableTimeDesc ?? '',
      price: String(program.price),
      status: program.status,
      tags: (program.tags ?? []).join(', '),
    });
    setEditingProgramId(program.id);
    setShowMentorForm(false);
    setActiveTab('become');
  };

  const handleDeleteProgram = async (programId: string) => {
    const ok = window.confirm('이 프로그램을 삭제할까요?');
    if (!ok) return;

    setPendingAction(`delete-program:${programId}`);
    clearMessages();

    try {
      await deleteMentoringProgram(programId);
      if (selectedProgram?.id === programId) {
        setSelectedProgram(null);
      }
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
      }, currentUserId);
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

    const labelMap = {
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
      showNotice(labelMap[action]);
      await loadApplications();
    } catch (error) {
      showError(error);
    } finally {
      setPendingAction('');
    }
  };

  const updateReviewForm = (applicationId: string, updates: Partial<ReviewForm>) => {
    setReviewForms((current) => ({
      ...current,
      [applicationId]: {
        rating: current[applicationId]?.rating ?? 5,
        content: current[applicationId]?.content ?? '',
        ...updates,
      },
    }));
  };

  const submitReview = async (event: FormEvent<HTMLFormElement>, applicationId: string) => {
    event.preventDefault();
    const review = reviewForms[applicationId] ?? { rating: 5, content: '' };

    setPendingAction(`review:${applicationId}`);
    clearMessages();

    try {
      await createMentoringReview({
        applicationId,
        rating: review.rating,
        content: review.content.trim(),
      });
      setReviewForms((current) => {
        const next = { ...current };
        delete next[applicationId];
        return next;
      });
      showNotice('리뷰를 작성했습니다.');
    } catch (error) {
      showError(error);
    } finally {
      setPendingAction('');
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto min-w-0 max-w-6xl px-6 py-8 lg:px-10">
        <div className="mb-8">
          <h1 className="text-4xl font-black tracking-tight text-black">멘토링</h1>
          <div className="mt-7 flex gap-10 border-b border-zinc-200">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => changeTab(tab.id)}
                className={`relative pb-4 text-lg font-black transition ${
                  activeTab === tab.id ? 'text-black' : 'text-zinc-400 hover:text-black'
                }`}
              >
                {tab.label}
                {activeTab === tab.id ? (
                  <span className="absolute bottom-[-1px] left-0 h-0.5 w-full rounded-full bg-[#f5c400]" />
                ) : null}
              </button>
            ))}
          </div>
        </div>

        {notice ? (
          <div className="mb-5 rounded-2xl bg-black px-5 py-3 text-sm font-black text-white">
            {notice}
          </div>
        ) : null}

        {authMessage ? (
          <div className="mb-5 rounded-[24px] border border-yellow-200 bg-yellow-50 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 shrink-0 text-yellow-700" size={20} />
                <div>
                  <p className="text-base font-black text-yellow-900">세션 확인이 필요합니다</p>
                  <p className="mt-1 text-sm font-bold leading-6 text-yellow-800">{authMessage}</p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => void refreshMentoringData()}
                  className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-yellow-900"
                >
                  다시 시도
                </button>
                <button
                  type="button"
                  onClick={() => logout({ redirectTo: '/login' })}
                  className="rounded-2xl bg-black px-4 py-3 text-sm font-black text-white"
                >
                  다시 로그인
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {errorMessage ? (
          <div className="mb-5 flex items-start gap-3 rounded-2xl bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        {activeTab === 'find' ? (
          <section className="space-y-6">
            <div className="rounded-[28px] border border-zinc-100 bg-zinc-50 p-6">
              <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-sm font-black uppercase tracking-widest text-zinc-400">Explore programs</p>
                  <h2 className="mt-1 text-2xl font-black text-black">멘토링 프로그램 탐색</h2>
                  <p className="mt-2 text-sm font-bold text-zinc-500">
                    게임별 프로그램을 찾고 상세 화면에서 바로 신청할 수 있습니다.
                  </p>
                </div>

                <div className="grid w-full gap-3 md:w-[460px] md:grid-cols-2">
                  <label className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <select
                      value={gameFilter}
                      onChange={(event) => {
                        setGameFilter(event.target.value);
                        setProgramPageNumber(0);
                      }}
                      className="h-12 w-full appearance-none rounded-2xl border border-zinc-100 bg-white pl-11 pr-4 text-sm font-black text-black outline-none transition focus:border-black"
                    >
                      {mentoringGames.map((game) => (
                        <option key={game} value={game}>
                          {game}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="relative">
                    <Star className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <select
                      value={ratingFilter}
                      onChange={(event) => setRatingFilter(event.target.value as typeof ratingFilter)}
                      className="h-12 w-full appearance-none rounded-2xl border border-zinc-100 bg-white pl-11 pr-4 text-sm font-black text-black outline-none transition focus:border-black"
                    >
                      {ratingFilters.map((filter) => (
                        <option key={filter.value} value={filter.value}>
                          {filter.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            </div>

            {programsLoading ? (
              <div className="flex min-h-64 items-center justify-center rounded-[28px] border border-zinc-100">
                <Loader2 className="animate-spin text-zinc-400" size={34} />
              </div>
            ) : visiblePrograms.length > 0 ? (
              <div className="grid gap-5 lg:grid-cols-2">
                {visiblePrograms.map((program) => (
                  <article
                    key={program.id}
                    className="rounded-[28px] border border-zinc-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <ProgramStatusBadge status={program.status} />
                          <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-black text-zinc-500">
                            {program.gameName}
                          </span>
                          {currentUserOwnsProgram(program.mentorId) ? (
                            <span className="rounded-full bg-black px-3 py-1 text-[11px] font-black text-white">
                              내 프로그램
                            </span>
                          ) : null}
                        </div>
                        <h3 className="truncate text-xl font-black text-black">{program.title}</h3>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm font-bold text-zinc-500">
                          <span>{programMentorName(program)}</span>
                          <span>·</span>
                          <span>{formatMileage(program.price)}</span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1 text-yellow-500">
                            <Star size={14} className="fill-yellow-400" />
                            {(mentorStatsById[program.mentorId]?.ratingAvg ?? 0).toFixed(1)}
                          </span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openProgramDetail(program.id)}
                        className="shrink-0 rounded-xl bg-black px-4 py-2 text-sm font-black text-white transition hover:bg-zinc-800"
                      >
                        상세
                      </button>
                    </div>

                    <p className="mt-4 line-clamp-3 text-sm font-medium leading-6 text-zinc-600">
                      {getProgramDescription(program.content)}
                    </p>

                    <p className="mt-3 rounded-xl bg-zinc-50 px-4 py-3 text-xs font-black text-zinc-500">
                      진행 방식: {getProgramMethod(program.content)}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {(program.tags ?? []).map((tag) => (
                        <span key={tag} className="rounded-lg bg-zinc-100 px-2 py-1 text-[11px] font-black text-zinc-500">
                          #{tag}
                        </span>
                      ))}
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t border-zinc-50 pt-4 text-xs font-bold text-zinc-400">
                      <span>{program.availableTimeDesc || '시간 협의 가능'}</span>
                      <span>{formatDateTime(program.createdAt)}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-[28px] border border-dashed border-zinc-200 bg-zinc-50 p-10 text-center">
                <p className="text-lg font-black text-black">조건에 맞는 프로그램이 없습니다.</p>
                <p className="mt-2 text-sm font-bold text-zinc-400">게임이나 평점 필터를 바꿔보세요.</p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setProgramPageNumber((current) => Math.max(0, current - 1))}
                disabled={programPageNumber <= 0}
                className="inline-flex items-center gap-2 rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-black text-black disabled:cursor-not-allowed disabled:text-zinc-300"
              >
                <ChevronLeft size={16} />
                이전
              </button>
              <span className="text-sm font-black text-zinc-400">
                {programPageNumber + 1} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setProgramPageNumber((current) => Math.min(totalPages - 1, current + 1))}
                disabled={programPageNumber >= totalPages - 1}
                className="inline-flex items-center gap-2 rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-black text-black disabled:cursor-not-allowed disabled:text-zinc-300"
              >
                다음
                <ChevronRight size={16} />
              </button>
            </div>

            {detailLoading ? (
              <div className="flex min-h-48 items-center justify-center rounded-[28px] border border-zinc-100">
                <Loader2 className="animate-spin text-zinc-400" size={30} />
              </div>
            ) : selectedProgram ? (
              <section className="rounded-[28px] border border-zinc-200 p-6 md:p-8">
                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#f5c400] px-3 py-1 text-xs font-black text-black">
                        {selectedProgram.gameName}
                      </span>
                      {selectedProgramIsMine ? (
                        <span className="rounded-full bg-black px-3 py-1 text-xs font-black text-white">
                          내 프로그램
                        </span>
                      ) : null}
                    </div>
                    <h2 className="text-3xl font-black text-black">{selectedProgram.title}</h2>
                    <p className="mt-2 text-sm font-black text-zinc-400">
                      {selectedProgram.mentorNickname} · {formatMileage(selectedProgram.price)}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled
                    className="inline-flex cursor-not-allowed items-center gap-2 rounded-2xl bg-zinc-100 px-5 py-3 text-sm font-black text-zinc-400"
                  >
                    <MessageCircle size={17} />
                    1:1 문의 준비중
                  </button>
                </div>

                <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_340px]">
                  <div className="space-y-5">
                    <div className="rounded-2xl bg-zinc-50 p-5">
                      <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Program</p>
                      <p className="mt-3 whitespace-pre-line text-sm font-medium leading-7 text-zinc-700">
                        {getProgramDescription(selectedProgram.content)}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-zinc-50 p-5">
                      <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Method</p>
                      <p className="mt-3 text-sm font-bold text-black">
                        {getProgramMethod(selectedProgram.content)}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-zinc-50 p-5">
                      <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Available time</p>
                      <p className="mt-3 text-sm font-bold text-black">
                        {selectedProgram.availableTimeDesc || '시간 협의 가능'}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(selectedProgram.tags ?? []).map((tag) => (
                        <span key={tag} className="rounded-lg bg-zinc-100 px-3 py-2 text-xs font-black text-zinc-500">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <aside className="space-y-4">
                    <div className="rounded-2xl border border-zinc-100 p-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-sm font-black text-white">
                          {selectedProgram.mentorNickname.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-black text-black">{selectedProgram.mentorNickname}</p>
                          <p className="text-xs font-bold text-zinc-400">멘토 프로필</p>
                        </div>
                      </div>
                      <p className="mt-4 text-sm font-medium leading-6 text-zinc-600">
                        {selectedMentor?.about ?? selectedProgram.mentorAbout}
                      </p>
                      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl bg-zinc-50 p-3">
                          <p className="font-black text-black">{selectedMentor?.ratingAvg?.toFixed(1) ?? '0.0'}</p>
                          <p className="text-[10px] font-black text-zinc-400">평점</p>
                        </div>
                        <div className="rounded-xl bg-zinc-50 p-3">
                          <p className="font-black text-black">{selectedMentor?.reviewCount ?? 0}</p>
                          <p className="text-[10px] font-black text-zinc-400">리뷰</p>
                        </div>
                        <div className="rounded-xl bg-zinc-50 p-3">
                          <p className="font-black text-black">{selectedMentor?.menteeCount ?? 0}</p>
                          <p className="text-[10px] font-black text-zinc-400">멘티</p>
                        </div>
                      </div>
                    </div>

                    {selectedProgramIsMine ? (
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            startEditProgram({
                              ...selectedProgram,
                              mentorNickName: selectedProgram.mentorNickname,
                              status: 'ACTIVE',
                            });
                          }}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-black text-black"
                        >
                          <Edit3 size={16} />
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProgram(selectedProgram.id)}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-600"
                        >
                          <X size={16} />
                          삭제
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleApplyProgram} className="rounded-2xl border border-zinc-100 p-5">
                        <div className="mb-4 rounded-2xl bg-yellow-50 p-4 text-xs font-bold leading-5 text-yellow-800">
                          신청 시 프로그램 가격만큼 마일리지가 에스크로로 보관됩니다. 멘토링 종료 후 멘티가 완료 확정하면 멘토에게 정산됩니다.
                        </div>
                        <label className="block space-y-2">
                          <span className="text-sm font-black text-zinc-700">멘토에게 보낼 메시지</span>
                          <textarea
                            value={applicationMessage}
                            onChange={(event) => setApplicationMessage(event.target.value)}
                            required
                            rows={4}
                            placeholder="원하는 수업 방향이나 현재 고민을 적어주세요."
                            className="w-full resize-none rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-black outline-none focus:border-black"
                          />
                        </label>
                        <button
                          type="submit"
                          disabled={pendingAction === `apply:${selectedProgram.id}` || selectedProgram.price < 0}
                          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-black px-5 py-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-zinc-200"
                        >
                          <CreditCard size={17} />
                          {pendingAction === `apply:${selectedProgram.id}` ? '신청 중...' : '신청하고 결제하기'}
                        </button>
                      </form>
                    )}
                  </aside>
                </div>

                <div className="mt-6 rounded-2xl border border-zinc-100 p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <Star className="fill-yellow-400 text-yellow-400" size={18} />
                    <h3 className="font-black text-black">멘토 리뷰</h3>
                  </div>
                  {selectedReviews.length > 0 ? (
                    <div className="space-y-3">
                      {selectedReviews.map((review) => (
                        <div key={review.id} className="rounded-xl bg-zinc-50 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-black text-black">{review.menteeNickname}</p>
                            <p className="text-sm font-black text-yellow-500">★ {review.rating}</p>
                          </div>
                          <p className="mt-2 text-sm font-medium text-zinc-600">{review.content}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm font-bold text-zinc-400">아직 작성된 리뷰가 없습니다.</p>
                  )}
                </div>
              </section>
            ) : null}
          </section>
        ) : null}

        {activeTab === 'mine' ? (
          <section className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-[28px] border border-zinc-200 p-6">
              <h2 className="text-2xl font-black text-black">내가 신청한 멘토링</h2>
              <div className="mt-5 space-y-4">
                {menteeApplications.length > 0 ? (
                  menteeApplications.map((application) => (
                    <ApplicationCard
                      key={application.id}
                      application={application}
                      pendingAction={pendingAction}
                      role="mentee"
                      reviewForm={reviewForms[application.id] ?? { rating: 5, content: '' }}
                      onComplete={() => runApplicationAction(application.id, 'complete')}
                      onReviewChange={(updates) => updateReviewForm(application.id, updates)}
                      onReviewSubmit={(event) => submitReview(event, application.id)}
                    />
                  ))
                ) : (
                  <EmptyState
                    title="신청한 멘토링이 없습니다."
                    description="멘토 찾기 탭에서 프로그램을 선택해 신청해보세요."
                    actionLabel="멘토 찾기"
                    onAction={() => changeTab('find')}
                  />
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-zinc-200 p-6">
              <h2 className="text-2xl font-black text-black">받은 신청</h2>
              <div className="mt-5 space-y-4">
                {mentorApplications.length > 0 ? (
                  mentorApplications.map((application) => (
                    <ApplicationCard
                      key={application.id}
                      application={application}
                      pendingAction={pendingAction}
                      role="mentor"
                      onAccept={() => runApplicationAction(application.id, 'accept')}
                      onReject={() => runApplicationAction(application.id, 'reject')}
                      onStart={() => runApplicationAction(application.id, 'start')}
                      onFinish={() => runApplicationAction(application.id, 'finish')}
                    />
                  ))
                ) : (
                  <EmptyState
                    title="받은 신청이 없습니다."
                    description={
                      currentUserIsMentor
                        ? '프로그램을 등록하면 멘티 신청을 여기서 관리할 수 있습니다.'
                        : '멘토 등록 후 프로그램을 만들면 받은 신청을 관리할 수 있습니다.'
                    }
                    actionLabel={currentUserIsMentor ? '프로그램 만들기' : '멘토 등록하기'}
                    onAction={() => changeTab('become')}
                  />
                )}
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === 'become' ? (
          <section className="space-y-6">
            {mentorProfileLoading ? (
              <div className="flex min-h-[360px] items-center justify-center rounded-[28px] border border-zinc-100">
                <Loader2 className="animate-spin text-zinc-400" size={34} />
              </div>
            ) : mentorProfile ? (
              <>
                <div className="rounded-[28px] border border-zinc-200 p-6 md:p-8">
                  <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-black text-green-700">
                        <ShieldCheck size={14} />
                        {mentorProfile.status}
                      </div>
                      <h2 className="text-3xl font-black text-black">{mentorProfile.nickname} 멘토</h2>
                      <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-zinc-600">
                        {mentorProfile.about}
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-2xl bg-zinc-50 px-4 py-3">
                        <p className="text-xl font-black text-black">{mentorProfile.ratingAvg.toFixed(1)}</p>
                        <p className="text-[10px] font-black uppercase text-zinc-400">평점</p>
                      </div>
                      <div className="rounded-2xl bg-zinc-50 px-4 py-3">
                        <p className="text-xl font-black text-black">{mentorProfile.reviewCount}</p>
                        <p className="text-[10px] font-black uppercase text-zinc-400">리뷰</p>
                      </div>
                      <div className="rounded-2xl bg-zinc-50 px-4 py-3">
                        <p className="text-xl font-black text-black">{mentorProfile.menteeCount}</p>
                        <p className="text-[10px] font-black uppercase text-zinc-400">멘티</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-zinc-200 p-6 md:p-8">
                  <h2 className="text-2xl font-black text-black">
                    {editingProgramId ? '프로그램 수정' : '프로그램 생성'}
                  </h2>
                  <form onSubmit={handleSubmitProgram} className="mt-6 space-y-5">
                    <div className="grid gap-3 rounded-2xl bg-zinc-50 p-4 text-xs font-bold text-zinc-500 md:grid-cols-4">
                      <span>1. 멘토 프로필 등록</span>
                      <span>2. 프로그램 게시</span>
                      <span>3. 신청/에스크로 결제</span>
                      <span>4. 종료 보고/정산/리뷰</span>
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-sm font-black text-zinc-700">게임 카테고리 *</span>
                        <select
                          name="gameName"
                          value={programForm.gameName}
                          onChange={handleProgramFormChange}
                          className="h-14 w-full rounded-2xl border border-zinc-200 px-4 text-base font-bold text-black outline-none focus:border-black"
                        >
                          {mentoringGames.filter((game) => game !== '전체').map((game) => (
                            <option key={game} value={game}>
                              {game}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-2">
                        <span className="text-sm font-black text-zinc-700">가격 *</span>
                        <input
                          name="price"
                          value={programForm.price}
                          onChange={handleProgramFormChange}
                          inputMode="numeric"
                          required
                          placeholder="10000"
                          className="h-14 w-full rounded-2xl border border-zinc-200 px-4 text-base text-black outline-none focus:border-black"
                        />
                      </label>
                    </div>

                    <label className="block space-y-2">
                      <span className="text-sm font-black text-zinc-700">프로그램 제목 *</span>
                      <input
                        name="title"
                        value={programForm.title}
                        onChange={handleProgramFormChange}
                        required
                        placeholder="상위권 강의"
                        className="h-14 w-full rounded-2xl border border-zinc-200 px-4 text-base text-black outline-none focus:border-black"
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-sm font-black text-zinc-700">진행 방식 *</span>
                      <input
                        name="method"
                        value={programForm.method}
                        onChange={handleProgramFormChange}
                        required
                        placeholder="예: 디스코드 화면공유, 리플레이 분석, 1:1 보이스 코칭"
                        className="h-14 w-full rounded-2xl border border-zinc-200 px-4 text-base text-black outline-none focus:border-black"
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-sm font-black text-zinc-700">상세 설명 *</span>
                      <textarea
                        name="content"
                        value={programForm.content}
                        onChange={handleProgramFormChange}
                        required
                        rows={5}
                        placeholder="강의 방식, 피드백 범위, 준비물 등을 적어주세요."
                        className="w-full resize-none rounded-2xl border border-zinc-200 px-4 py-3 text-base text-black outline-none focus:border-black"
                      />
                    </label>

                    <div className="grid gap-5 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-sm font-black text-zinc-700">가능한 스케줄</span>
                        <input
                          name="availableTimeDesc"
                          value={programForm.availableTimeDesc}
                          onChange={handleProgramFormChange}
                          placeholder="평일 저녁 가능"
                          className="h-14 w-full rounded-2xl border border-zinc-200 px-4 text-base text-black outline-none focus:border-black"
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="text-sm font-black text-zinc-700">태그</span>
                        <input
                          name="tags"
                          value={programForm.tags}
                          onChange={handleProgramFormChange}
                          placeholder="피드백, 리플레이, 초보환영"
                          className="h-14 w-full rounded-2xl border border-zinc-200 px-4 text-base text-black outline-none focus:border-black"
                        />
                      </label>
                    </div>

                    {editingProgramId ? (
                      <label className="block space-y-2">
                        <span className="text-sm font-black text-zinc-700">상태</span>
                        <select
                          name="status"
                          value={programForm.status}
                          onChange={handleProgramFormChange}
                          className="h-14 w-full rounded-2xl border border-zinc-200 px-4 text-base font-bold text-black outline-none focus:border-black"
                        >
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="CLOSED">CLOSED</option>
                        </select>
                      </label>
                    ) : null}

                    <div className="grid gap-4 pt-2 md:grid-cols-2">
                      <button
                        type="button"
                        onClick={resetProgramForm}
                        className="rounded-2xl bg-zinc-100 px-8 py-5 text-lg font-black text-black transition hover:bg-zinc-200"
                      >
                        취소
                      </button>
                      <button
                        type="submit"
                        disabled={pendingAction === 'save-program'}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-black px-8 py-5 text-lg font-black text-white transition hover:bg-zinc-800 disabled:bg-zinc-200"
                      >
                        <Plus size={22} />
                        {pendingAction === 'save-program'
                          ? '저장 중...'
                          : editingProgramId
                            ? '수정 저장'
                            : '프로그램 등록'}
                      </button>
                    </div>
                  </form>
                </div>

                <div className="rounded-[28px] border border-zinc-200 p-6 md:p-8">
                  <h2 className="text-2xl font-black text-black">내 프로그램</h2>
                  <div className="mt-5 space-y-4">
                    {ownedPrograms.length > 0 ? (
                      ownedPrograms.map((program) => (
                        <div key={program.id} className="rounded-2xl border border-zinc-100 p-5">
                          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div>
                              <div className="mb-2 flex flex-wrap gap-2">
                                <ProgramStatusBadge status={program.status} />
                                <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-black text-zinc-500">
                                  {program.gameName}
                                </span>
                              </div>
                              <h3 className="text-lg font-black text-black">{program.title}</h3>
                              <p className="mt-2 text-sm font-bold text-zinc-500">
                                {formatMileage(program.price)} · {program.availableTimeDesc || '시간 협의 가능'}
                              </p>
                              <p className="mt-2 text-xs font-black text-zinc-400">
                                진행 방식: {getProgramMethod(program.content)}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => startEditProgram(program)}
                                className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-4 py-2 text-sm font-black text-black"
                              >
                                <Edit3 size={15} />
                                수정
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteProgram(program.id)}
                                disabled={pendingAction === `delete-program:${program.id}`}
                                className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2 text-sm font-black text-red-600 disabled:opacity-50"
                              >
                                <X size={15} />
                                삭제
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-2xl bg-zinc-50 p-6 text-sm font-bold text-zinc-400">
                        아직 만든 프로그램이 없습니다.
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : showMentorForm ? (
              <section className="rounded-[28px] border border-zinc-200 p-6 md:p-8">
                <h2 className="text-3xl font-black text-black">멘토 등록 신청</h2>
                <p className="mt-3 text-sm font-bold text-zinc-500">
                  멘토 등록 시 멘토 프로필과 마일리지 지갑이 함께 생성됩니다.
                </p>

                <form onSubmit={handleRegisterMentor} className="mt-7 space-y-5">
                  <label className="block space-y-2">
                    <span className="text-sm font-black text-zinc-700">멘토 소개 *</span>
                    <textarea
                      value={mentorAbout}
                      onChange={(event) => setMentorAbout(event.target.value)}
                      required
                      rows={7}
                      placeholder="멘토링 경험, 전문 분야, 멘티들에게 전하고 싶은 말을 작성해주세요."
                      className="w-full resize-none rounded-2xl border border-zinc-200 px-5 py-4 text-base text-black outline-none transition focus:border-black"
                    />
                  </label>

                  <div className="grid gap-4 pt-4 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setShowMentorForm(false)}
                      className="rounded-2xl bg-zinc-100 px-8 py-5 text-lg font-black text-black transition hover:bg-zinc-200"
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      disabled={pendingAction === 'register-mentor'}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-black px-8 py-5 text-lg font-black text-white transition hover:bg-zinc-800 disabled:bg-zinc-200"
                    >
                      <Plus size={22} />
                      {pendingAction === 'register-mentor' ? '등록 중...' : '멘토 등록'}
                    </button>
                  </div>
                </form>
              </section>
            ) : (
              <section className="rounded-[28px] border border-zinc-200 p-8 md:p-14">
                <div className="flex min-h-[520px] flex-col items-center justify-center text-center">
                  <div className="mb-10 flex h-28 w-28 items-center justify-center rounded-full bg-[#f5c400] text-black">
                    <UserPlus size={54} />
                  </div>
                  <h2 className="text-4xl font-black tracking-tight text-black">멘토가 되어보세요</h2>
                  <p className="mt-8 max-w-2xl text-xl leading-9 text-zinc-600">
                    당신의 게임 실력을 공유하고 멘티들을 성장시켜보세요.
                    <br />
                    멘토 등록 후 프로그램을 만들어 신청을 받을 수 있습니다.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowMentorForm(true)}
                    className="mt-12 inline-flex items-center gap-3 rounded-2xl bg-black px-10 py-5 text-xl font-black text-white transition hover:bg-zinc-800"
                  >
                    <Plus size={26} />
                    멘토 등록하기
                  </button>
                </div>
              </section>
            )}
          </section>
        ) : null}
      </main>
    </div>
  );
}

function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-8 text-center">
      <p className="text-lg font-black text-black">{title}</p>
      <p className="mt-2 text-sm font-bold text-zinc-400">{description}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-5 rounded-2xl bg-black px-6 py-3 text-sm font-black text-white"
      >
        {actionLabel}
      </button>
    </div>
  );
}

function ApplicationCard({
  application,
  role,
  pendingAction,
  reviewForm,
  onAccept,
  onReject,
  onStart,
  onFinish,
  onComplete,
  onReviewChange,
  onReviewSubmit,
}: {
  application: MentoringApplicationResponse;
  role: 'mentor' | 'mentee';
  pendingAction: string;
  reviewForm?: ReviewForm;
  onAccept?: () => void;
  onReject?: () => void;
  onStart?: () => void;
  onFinish?: () => void;
  onComplete?: () => void;
  onReviewChange?: (updates: Partial<ReviewForm>) => void;
  onReviewSubmit?: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const actionPending = pendingAction.endsWith(`:${application.id}`);
  const guide = getApplicationGuide(role, application.status, application.paymentStatus);

  return (
    <article className="rounded-2xl border border-zinc-100 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-black text-black">{application.programTitle}</h3>
          <p className="mt-1 text-sm font-bold text-zinc-500">
            멘토 {application.mentorNickname} · 멘티 {application.menteeNickname}
          </p>
        </div>
        <StatusBadge status={application.status} />
      </div>

      <p className="mt-4 rounded-xl bg-zinc-50 p-4 text-sm font-medium leading-6 text-zinc-600">
        {application.message}
      </p>

      <div className="mt-4 grid gap-2 text-sm font-bold text-zinc-500 sm:grid-cols-3">
        <span>금액: {formatMileage(application.appliedMileage)}</span>
        <span>결제: {paymentStatusMeta[application.paymentStatus] ?? application.paymentStatus}</span>
        <span>신청: {formatDateTime(application.createdAt)}</span>
      </div>

      {guide ? (
        <p className="mt-4 rounded-xl bg-yellow-50 px-4 py-3 text-xs font-bold leading-5 text-yellow-800">
          {guide}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled
          className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-zinc-100 px-4 py-2 text-sm font-black text-zinc-400"
        >
          <MessageCircle size={15} />
          채팅 준비중
        </button>

        {role === 'mentor' && application.status === 'APPLIED' ? (
          <>
            <button
              type="button"
              onClick={onAccept}
              disabled={actionPending}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
            >
              <Check size={15} />
              수락
            </button>
            <button
              type="button"
              onClick={onReject}
              disabled={actionPending}
              className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
            >
              <X size={15} />
              거절
            </button>
          </>
        ) : null}

        {role === 'mentor' && application.status === 'ACCEPTED' ? (
          <button
            type="button"
            onClick={onStart}
            disabled={actionPending}
            className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-sm font-black text-white disabled:opacity-50"
          >
            <Clock3 size={15} />
            시작
          </button>
        ) : null}

        {role === 'mentor' && application.status === 'ONGOING' ? (
          <button
            type="button"
            onClick={onFinish}
            disabled={actionPending}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
          >
            <Check size={15} />
            수업 종료 보고
          </button>
        ) : null}

        {role === 'mentee' && application.status === 'FINISHED' ? (
          <button
            type="button"
            onClick={onComplete}
            disabled={actionPending}
            className="inline-flex items-center gap-2 rounded-xl bg-green-500 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
          >
            <CreditCard size={15} />
            완료 확정
          </button>
        ) : null}
      </div>

      {role === 'mentee' && application.status === 'COMPLETED' && onReviewSubmit ? (
        <form onSubmit={onReviewSubmit} className="mt-5 rounded-2xl bg-zinc-50 p-4">
          <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
            <select
              value={reviewForm?.rating ?? 5}
              onChange={(event) => onReviewChange?.({ rating: Number(event.target.value) })}
              className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-black text-black outline-none"
            >
              {[5, 4, 3, 2, 1].map((rating) => (
                <option key={rating} value={rating}>
                  ★ {rating}
                </option>
              ))}
            </select>
            <input
              value={reviewForm?.content ?? ''}
              onChange={(event) => onReviewChange?.({ content: event.target.value })}
              placeholder="후기를 작성해주세요."
              required
              className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-black outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={pendingAction === `review:${application.id}`}
            className="mt-3 rounded-xl bg-black px-4 py-2 text-sm font-black text-white disabled:bg-zinc-200"
          >
            리뷰 작성
          </button>
        </form>
      ) : null}
    </article>
  );
}