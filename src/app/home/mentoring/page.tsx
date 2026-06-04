'use client';

import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Clock3,
  CreditCard,
  Loader2,
  MessageCircle,
  Plus,
  Star,
  Trash2,
  UserPlus,
  Wallet,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { fetchConversations, startConversation } from '@/lib/message-api';
import {
  acceptMentoringApplication,
  applyToMentoringProgram,
  cancelMentoringApplication,
  completeMentoringApplication,
  createMentoringProgram,
  createMentoringReview,
  deleteMentoringProgram,
  emptyPage,
  fetchMenteeApplications,
  fetchMentorReviews,
  fetchMentorApplications,
  fetchMentoringProgramDetail,
  fetchMentoringPrograms,
  fetchMentorProfile,
  finishMentoringApplication,
  isMentoringAuthError,
  isMentoringNotFoundError,
  registerMentor,
  rejectMentoringApplication,
  startMentoringApplication,
  type ApplicationStatus,
  type MentoringApplicationResponse,
  type MentoringProgramDetailResponse,
  type MentoringProgramResponse,
  type MentoringReviewResponse,
  type MentorProfileResponse,
  type PageResponse,
  type PaymentStatus,
} from '@/lib/mentoring-api';
import { type MessageRecipient } from '@/lib/message-store';
import {
  chargeMileage,
  fetchMyMileageBalance,
  fetchMyMileageTransactions,
  type MileageTransactionResponse,
  type PageResponse as MileagePageResponse,
} from '@/lib/mileage-api';

type MentoringTab = 'find' | 'mine' | 'programs' | 'become';
type MentoringBannerType = 'auth' | 'mileage' | null;

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
const REVIEW_ALREADY_COMPLETED_MESSAGE = '이미 리뷰 작성이 완료된 멘토링입니다.';

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
  APPLIED: '신청',
  ACCEPTED: '수락',
  REJECTED: '거절',
  ONGOING: '진행중',
  FINISHED: '종료 보고',
  COMPLETED: '완료',
  CANCELLED: '취소',
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

function formatSignedMileage(value: number) {
  const amount = Number(value || 0);
  return `${amount > 0 ? '+' : ''}${amount.toLocaleString()} M`;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function parseTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function buildProgramContent(method: string, content: string) {
  return `[진행 방식]\n${method.trim() || '추후 협의'}\n\n[상세 설명]\n${content.trim()}`;
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
      ? '멘티가 신청했습니다. 수락하면 멘토링을 시작할 수 있습니다.'
      : `멘토의 수락을 기다리는 중입니다. 결제 상태: ${paymentLabel[paymentStatus] ?? paymentStatus}`;
  }

  if (status === 'ACCEPTED') {
    return role === 'mentor'
      ? '시작 버튼을 눌러 진행 상태로 변경해주세요.'
      : '멘토가 요청을 수락했습니다.';
  }

  if (status === 'ONGOING') {
    return role === 'mentor'
      ? '멘토링이 끝나면 종료 보고를 눌러주세요.'
      : '멘토링이 진행 중입니다.';
  }

  if (status === 'FINISHED') {
    return role === 'mentee'
      ? '문제가 없으면 완료 확정을 눌러주세요.'
      : '멘티의 완료 확정을 기다리는 중입니다.';
  }

  if (status === 'COMPLETED') {
    return '정산이 완료된 멘토링입니다.';
  }

  if (status === 'REJECTED') {
    return '거절된 요청입니다. 결제 마일리지는 환불 처리됩니다.';
  }

  if (status === 'CANCELLED') {
    return '취소된 요청입니다.';
  }

  return '';
}

function isMileageShortageError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    message.includes('마일리지') ||
    message.includes('부족') ||
    message.includes('insufficient') ||
    message.includes('balance')
  );
}

function isAuthRequiredError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    message.includes('authentication is required') ||
    message.includes('sign in again') ||
    message.includes('token has expired')
  );
}

function isApplicationBlockingReapply(status: ApplicationStatus) {
  return status === 'APPLIED' || status === 'ACCEPTED' || status === 'ONGOING' || status === 'FINISHED';
}

function canOpenMentoringChat(status: ApplicationStatus) {
  return status === 'ACCEPTED' || status === 'ONGOING' || status === 'FINISHED' || status === 'COMPLETED';
}

function isDuplicateReviewError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    (message.includes('이미') && message.includes('리뷰') && message.includes('작성')) ||
    (message.includes('already') && message.includes('review'))
  );
}

export default function MentoringPage() {
  const router = useRouter();
  const { user, logout, isAuthReady } = useAuth();
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
  const [selectedProgramReviews, setSelectedProgramReviews] = useState<MentoringReviewResponse[]>([]);
  const [selectedProgramReviewsLoading, setSelectedProgramReviewsLoading] = useState(false);
  const [selectedOwnedProgramId, setSelectedOwnedProgramId] = useState<string | null>(null);

  const [menteeApplications, setMenteeApplications] = useState<MentoringApplicationResponse[]>([]);
  const [mentorApplications, setMentorApplications] = useState<MentoringApplicationResponse[]>([]);
  const [reviewedApplicationIds, setReviewedApplicationIds] = useState<Record<string, boolean>>({});
  const [mileageBalance, setMileageBalance] = useState(0);
  const [mileageTransactions, setMileageTransactions] = useState<MileageTransactionResponse[]>([]);
  const [mileagePage, setMileagePage] = useState<MileagePageResponse<MileageTransactionResponse> | null>(null);
  const [mileageLoading, setMileageLoading] = useState(false);
  const [chargeAmount, setChargeAmount] = useState('10000');

  const [reviewTarget, setReviewTarget] = useState<MentoringApplicationResponse | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState('');
  const [reviewHistory, setReviewHistory] = useState<MentoringReviewResponse[]>([]);
  const [mentorReviews, setMentorReviews] = useState<MentoringReviewResponse[]>([]);
  const [mentorReviewsLoading, setMentorReviewsLoading] = useState(false);

  const [notice, setNotice] = useState('');
  const [bannerType, setBannerType] = useState<MentoringBannerType>(null);
  const [authMessage, setAuthMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingAction, setPendingAction] = useState('');

  const totalPages = Math.max(programPage.totalPages || 1, 1);

  const visiblePrograms = useMemo(() => programPage.content, [programPage.content]);

  const selectedProgramApplication = useMemo(() => {
    if (!selectedProgram) {
      return null;
    }

    const latestApplication = menteeApplications
      .filter((application) => application.programId === selectedProgram.id)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];

    if (!latestApplication || !isApplicationBlockingReapply(latestApplication.status)) {
      return null;
    }

    return latestApplication;
  }, [menteeApplications, selectedProgram]);

  const selectedMentorStats = useMemo(() => {
    if (!selectedProgram) {
      return null;
    }

    return mentorStatsById[selectedProgram.mentorId] ?? null;
  }, [mentorStatsById, selectedProgram]);

  const selectedOwnedProgram = useMemo(() => {
    if (!selectedOwnedProgramId) {
      return null;
    }

    return ownedPrograms.find((program) => program.id === selectedOwnedProgramId) ?? null;
  }, [ownedPrograms, selectedOwnedProgramId]);

  const currentUserOwnsProgram = useCallback(
    (mentorId?: string | null) => normalizeId(mentorId) === normalizeId(currentUserId),
    [currentUserId]
  );

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2200);
  }, []);

  const clearMessages = useCallback(() => {
    setNotice('');
    setBannerType(null);
    setAuthMessage('');
    setErrorMessage('');
  }, []);

  const markApplicationReviewed = useCallback((applicationId: string) => {
    setReviewedApplicationIds((current) => ({
      ...current,
      [applicationId]: true,
    }));
  }, []);

  const showError = useCallback((error: unknown) => {
    if (isMileageShortageError(error)) {
      setBannerType('mileage');
      setAuthMessage('마일리지가 부족합니다. 충전 후 다시 멘토링을 신청해주세요.');
      setErrorMessage('');
      return;
    }

    if (isMentoringAuthError(error) || isAuthRequiredError(error)) {
      setBannerType('auth');
      setAuthMessage('세션이 만료되었거나 인증 상태가 올바르지 않습니다. 다시 로그인해주세요.');
      setErrorMessage('');
      return;
    }

    setBannerType(null);
    setAuthMessage('');
    setErrorMessage(error instanceof Error ? error.message : '요청 처리 중 문제가 발생했습니다.');
  }, []);

  const loadPrograms = useCallback(async () => {
    setProgramsLoading(true);
    clearMessages();

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
  }, [clearMessages, gameFilter, programPageNumber, showError]);

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
    } catch (error) {
      setMentorProfile(null);
      setMentorAbout('');

      if (!isMentoringNotFoundError(error)) {
        showError(error);
      }
    } finally {
      setMentorProfileLoading(false);
    }
  }, [currentUserId, showError]);

  const loadMentorReviews = useCallback(async () => {
    if (!currentUserId) {
      setMentorReviews([]);
      return;
    }

    setMentorReviewsLoading(true);
    try {
      const page = await fetchMentorReviews(currentUserId, 0, 20);
      setMentorReviews(page.content ?? []);
    } catch {
      setMentorReviews([]);
    } finally {
      setMentorReviewsLoading(false);
    }
  }, [currentUserId]);

  const loadApplications = useCallback(async () => {
    if (!currentUserId) {
      setMenteeApplications([]);
      setMentorApplications([]);
      return;
    }

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

    const nextMenteeApplications = menteeResult.status === 'fulfilled' ? menteeResult.value.content : [];
    setMenteeApplications(nextMenteeApplications);
    setMentorApplications(mentorResult.status === 'fulfilled' ? mentorResult.value.content : []);

    const completedApplications = nextMenteeApplications.filter((application) => application.status === 'COMPLETED');
    const completedApplicationIds = new Set(completedApplications.map((application) => application.id));
    const reviewedIdsFromMentorReviews = new Set<string>();

    if (completedApplications.length > 0) {
      const mentorIds = Array.from(new Set(completedApplications.map((application) => application.mentorId).filter(Boolean)));
      const reviewResults = await Promise.allSettled(mentorIds.map((mentorId) => fetchMentorReviews(mentorId, 0, 100)));

      reviewResults.forEach((result) => {
        if (result.status !== 'fulfilled') {
          return;
        }

        result.value.content.forEach((review) => {
          if (completedApplicationIds.has(review.applicationId)) {
            reviewedIdsFromMentorReviews.add(review.applicationId);
          }
        });
      });
    }

    setReviewedApplicationIds((current) => {
      const next = { ...current };
      nextMenteeApplications.forEach((application) => {
        if (!next[application.id]) {
          next[application.id] =
            reviewedIdsFromMentorReviews.has(application.id) ||
            reviewHistory.some((review) => review.applicationId === application.id);
        }
      });
      return next;
    });
  }, [currentUserId, reviewHistory, showError]);

  const loadMileageData = useCallback(async () => {
    if (!currentUserId) {
      setMileageBalance(0);
      setMileageTransactions([]);
      setMileagePage(null);
      return;
    }

    setMileageLoading(true);

    try {
      const [balance, transactions] = await Promise.all([
        fetchMyMileageBalance(),
        fetchMyMileageTransactions(0, 10),
      ]);

      setMileageBalance(balance.currentBalance ?? 0);
      setMileageTransactions(transactions.content ?? []);
      setMileagePage(transactions);
    } catch (error) {
      setMileageBalance(0);
      setMileageTransactions([]);
      setMileagePage(null);
      showError(error);
    } finally {
      setMileageLoading(false);
    }
  }, [currentUserId, showError]);

  useEffect(() => {
    if (activeTab === 'find') {
      void loadPrograms();
    }
  }, [activeTab, loadPrograms]);

  useEffect(() => {
    if (activeTab === 'mine' && isAuthReady && currentUserId) {
      void Promise.all([loadApplications(), loadMileageData()]);
    }
  }, [activeTab, currentUserId, isAuthReady, loadApplications, loadMileageData]);

  useEffect(() => {
    if (activeTab === 'programs' && isAuthReady && currentUserId) {
      void Promise.all([loadCurrentMentorProfile(), loadOwnedPrograms(), loadMentorReviews(), loadApplications()]);
    }
  }, [
    activeTab,
    currentUserId,
    isAuthReady,
    loadApplications,
    loadCurrentMentorProfile,
    loadMentorReviews,
    loadOwnedPrograms,
  ]);

  useEffect(() => {
    if (activeTab === 'become' && isAuthReady && currentUserId) {
      void Promise.all([loadCurrentMentorProfile(), loadOwnedPrograms()]);
    }
  }, [activeTab, currentUserId, isAuthReady, loadCurrentMentorProfile, loadOwnedPrograms]);

  useEffect(() => {
    if (ownedPrograms.length === 0) {
      setSelectedOwnedProgramId(null);
      return;
    }

    setSelectedOwnedProgramId((current) =>
      current && ownedPrograms.some((program) => program.id === current) ? current : null
    );
  }, [ownedPrograms]);

  const changeTab = (tab: MentoringTab) => {
    setActiveTab(tab);
    clearMessages();
    setShowMentorForm(false);
  };

  const openProgramDetail = async (programId: string) => {
    setDetailLoading(true);
    setSelectedProgram(null);
    setSelectedProgramReviews([]);
    setErrorMessage('');

    try {
      const detail = await fetchMentoringProgramDetail(programId);
      setSelectedProgram(detail);
      setSelectedProgramReviewsLoading(true);

      try {
        const [reviewPage, mentorProfile] = await Promise.all([
          fetchMentorReviews(detail.mentorId, 0, 50),
          fetchMentorProfile(detail.mentorId),
        ]);
        setSelectedProgramReviews(reviewPage.content ?? []);
        setMentorStatsById((current) => ({
          ...current,
          [detail.mentorId]: mentorProfile,
        }));
      } catch {
        setSelectedProgramReviews([]);
      } finally {
        setSelectedProgramReviewsLoading(false);
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
      await Promise.all([loadCurrentMentorProfile(), loadOwnedPrograms()]);
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
      setSelectedOwnedProgramId((current) => (current === programId ? null : current));
      showNotice('프로그램을 삭제했습니다.');
      await Promise.all([loadCurrentMentorProfile(), loadOwnedPrograms()]);
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
      showNotice('멘토링 요청이 접수되었습니다.');
      await Promise.all([loadApplications(), loadMileageData()]);
      setActiveTab('mine');
    } catch (error) {
      showError(error);
    } finally {
      setPendingAction('');
    }
  };

  const runApplicationAction = async (
    applicationId: string,
    action: 'accept' | 'reject' | 'cancel' | 'start' | 'finish' | 'complete'
  ) => {
    const actionMap = {
      accept: acceptMentoringApplication,
      reject: rejectMentoringApplication,
      cancel: cancelMentoringApplication,
      start: startMentoringApplication,
      finish: finishMentoringApplication,
      complete: completeMentoringApplication,
    };

    const messageMap = {
      accept: '요청을 수락했습니다.',
      reject: '요청을 거절했습니다.',
      cancel: '멘토링 요청을 취소하고 마일리지를 환불받았습니다.',
      start: '멘토링을 시작했습니다.',
      finish: '종료 보고를 완료했습니다.',
      complete: '멘토링 완료를 확정했습니다.',
    };

    setPendingAction(`${action}:${applicationId}`);
    clearMessages();

    try {
      await actionMap[action](applicationId);
      showNotice(messageMap[action]);

      if (action === 'complete') {
        setMenteeApplications((current) =>
          current.map((application) =>
            application.id === applicationId
              ? {
                  ...application,
                  status: 'COMPLETED',
                  paymentStatus: 'SETTLED',
                }
              : application
          )
        );
        return;
      }

      await Promise.all([loadApplications(), loadMileageData()]);
    } catch (error) {
      showError(error);
    } finally {
      setPendingAction('');
    }
  };

  const handleChargeMileage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const amount = Number(chargeAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      setErrorMessage('충전 금액을 올바르게 입력해주세요.');
      return;
    }

    setPendingAction('charge-mileage');
    clearMessages();

    try {
      const result = await chargeMileage(amount);
      setMileageBalance(result.currentBalance ?? 0);
      showNotice('마일리지를 충전했습니다.');
      await loadMileageData();
    } catch (error) {
      showError(error);
    } finally {
      setPendingAction('');
    }
  };

  const openReviewModal = (application: MentoringApplicationResponse) => {
    clearMessages();
    setReviewTarget(application);
    setReviewRating(5);
    setReviewContent('');
  };

  const closeReviewModal = () => {
    if (pendingAction.startsWith('review:')) {
      return;
    }

    setReviewTarget(null);
    setReviewRating(5);
    setReviewContent('');
  };

  const handleSubmitReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!reviewTarget) {
      return;
    }

    const content = reviewContent.trim();
    if (!content) {
      setErrorMessage('후기를 입력해주세요.');
      return;
    }

    setPendingAction(`review:${reviewTarget.id}`);
    clearMessages();

    try {
      const review = await createMentoringReview({
        applicationId: reviewTarget.id,
        rating: reviewRating,
        content,
      });

      setReviewHistory((current) => [review, ...current]);
      markApplicationReviewed(reviewTarget.id);
      showNotice('리뷰를 등록했습니다.');
      closeReviewModal();
    } catch (error) {
      if (isDuplicateReviewError(error)) {
        markApplicationReviewed(reviewTarget.id);
        showNotice(REVIEW_ALREADY_COMPLETED_MESSAGE);
        closeReviewModal();
        return;
      }

      showError(error);
    } finally {
      setPendingAction('');
    }
  };

  const handleOpenChat = async (application: MentoringApplicationResponse, role: 'mentor' | 'mentee') => {
    if (!canOpenMentoringChat(application.status)) {
      setErrorMessage('멘토가 요청을 수락한 뒤에만 채팅을 시작할 수 있습니다.');
      return;
    }

    const recipientId = role === 'mentor' ? application.menteeId : application.mentorId;
    const recipientName = role === 'mentor' ? application.menteeNickname : application.mentorNickname;
    if (!recipientId || !recipientName) {
      setErrorMessage('채팅 상대 정보를 찾을 수 없습니다.');
      return;
    }

    const recipient: MessageRecipient = {
      id: recipientId,
      name: recipientName,
      handle: `@mentoring_${recipientId.slice(0, 8)}`,
      role: role === 'mentor' ? '멘티' : '멘토',
      online: false,
    };

    setPendingAction(`chat:${application.id}`);
    clearMessages();

    try {
      const conversations = await fetchConversations(user?.id);
      await startConversation(user?.id, conversations, recipient);
      router.push(`/home/messages?conversationId=${encodeURIComponent(recipient.id)}`);
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
              ['programs', '내 프로그램'],
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
                  <p className="font-black text-yellow-900">
                    {bannerType === 'mileage' ? '마일리지가 부족합니다' : '인증 확인이 필요합니다'}
                  </p>
                  <p className="mt-1 text-sm font-bold leading-6 text-yellow-800">{authMessage}</p>
                </div>
              </div>

              {bannerType === 'mileage' ? (
                <button
                  type="button"
                  onClick={() => changeTab('mine')}
                  className="rounded-xl bg-black px-4 py-3 text-sm font-black text-white"
                >
                  충전하기
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => logout({ redirectTo: '/login' })}
                  className="rounded-xl bg-black px-4 py-3 text-sm font-black text-white"
                >
                  다시 로그인
                </button>
              )}
            </div>
          </div>
        ) : null}

        {errorMessage ? (
          <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-5 py-3 text-sm font-black text-red-600">
            {errorMessage}
          </div>
        ) : null}

        {activeTab === 'find' ? (
          <section>
            <div>
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Explore Programs</p>
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
                            <span
                              className={`rounded-full px-3 py-1 text-[11px] font-black ${
                                program.status === 'ACTIVE'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-zinc-100 text-zinc-500'
                              }`}
                            >
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
                          <p className="mt-1 text-xs font-bold text-zinc-400">
                            {program.availableTimeDesc || '시간 협의 가능'}
                          </p>
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
          </section>
        ) : null}

        {activeTab === 'mine' ? (
          <section className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-zinc-100 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Mileage</p>
                    <h2 className="mt-1 text-2xl font-black text-black">내 마일리지</h2>
                  </div>
                  <div className="rounded-2xl bg-zinc-100 p-3 text-zinc-700">
                    <Wallet size={20} />
                  </div>
                </div>
                <p className="mt-5 text-3xl font-black text-black">{formatMileage(mileageBalance)}</p>
                <p className="mt-2 text-sm font-bold text-zinc-500">
                  멘토링 결제, 환불, 정산 내역이 여기에 바로 반영됩니다.
                </p>
              </div>

              <form onSubmit={handleChargeMileage} className="rounded-2xl border border-zinc-100 bg-white p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Test Charge</p>
                <h2 className="mt-1 text-2xl font-black text-black">가상 충전</h2>
                <p className="mt-2 text-sm font-bold text-zinc-500">
                  잔액이 부족할 때 테스트용으로 바로 충전할 수 있습니다.
                </p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <input
                    value={chargeAmount}
                    onChange={(event) => setChargeAmount(event.target.value.replace(/[^0-9]/g, ''))}
                    inputMode="numeric"
                    className="h-12 flex-1 rounded-xl border border-zinc-200 px-4 text-sm font-bold outline-none"
                    placeholder="충전 금액"
                  />
                  <button
                    type="submit"
                    disabled={pendingAction === 'charge-mileage'}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-black px-5 text-sm font-black text-white disabled:bg-zinc-200"
                  >
                    <Plus size={16} />
                    {pendingAction === 'charge-mileage' ? '충전 중...' : '충전하기'}
                  </button>
                </div>
              </form>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <ApplicationList
                title="내가 신청한 멘토링"
                role="mentee"
                applications={menteeApplications}
                reviewedApplicationIds={reviewedApplicationIds}
                pendingAction={pendingAction}
                onChat={(application) => handleOpenChat(application, 'mentee')}
                onCancel={(id) => runApplicationAction(id, 'cancel')}
                onComplete={(id) => runApplicationAction(id, 'complete')}
                onReview={(application) => openReviewModal(application)}
                onReviewedClick={() => showNotice(REVIEW_ALREADY_COMPLETED_MESSAGE)}
              />
              <ApplicationList
                title="받은 멘토링 요청"
                role="mentor"
                applications={mentorApplications}
                reviewedApplicationIds={reviewedApplicationIds}
                pendingAction={pendingAction}
                onChat={(application) => handleOpenChat(application, 'mentor')}
                onAccept={(id) => runApplicationAction(id, 'accept')}
                onReject={(id) => runApplicationAction(id, 'reject')}
                onStart={(id) => runApplicationAction(id, 'start')}
                onFinish={(id) => runApplicationAction(id, 'finish')}
              />
            </div>

            <MileageTransactionPanel
              transactions={mileageTransactions}
              loading={mileageLoading}
              totalElements={mileagePage?.totalElements ?? 0}
            />
          </section>
        ) : null}

        {activeTab === 'programs' ? (
          <section>
            {mentorProfileLoading ? (
              <div className="flex h-64 items-center justify-center rounded-2xl bg-zinc-50">
                <Loader2 className="animate-spin text-zinc-400" />
              </div>
            ) : mentorProfile ? (
              <div className="space-y-6">
                <div className="rounded-2xl border border-zinc-100 p-6">
                  <h2 className="text-2xl font-black text-black">{mentorProfile.nickname} 멘토</h2>

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
                      <p className="text-xs font-bold text-zinc-400">신청한 멘티</p>
                    </div>
                  </div>
                </div>

                <div>
                  <section>
                    <div className="mb-5">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Programs</p>
                      <h2 className="mt-1 text-2xl font-black text-black">내 프로그램</h2>
                      <p className="mt-2 text-sm font-bold text-zinc-500">
                        프로그램 이름을 선택하면 리뷰와 별점, 삭제 항목을 자세히 볼 수 있습니다.
                      </p>
                    </div>

                    {ownedPrograms.length > 0 ? (
                      <div className="grid gap-4">
                        {ownedPrograms.map((program) => {
                          const isSelected = selectedOwnedProgram?.id === program.id;

                          return (
                            <button
                              key={program.id}
                              type="button"
                              onClick={() => setSelectedOwnedProgramId(program.id)}
                              className={`rounded-2xl border p-5 text-left transition ${
                                isSelected
                                  ? 'border-black bg-black text-white'
                                  : 'border-zinc-100 bg-white hover:border-black'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-4">
                                <div>
                                  <p
                                    className={`text-xs font-black uppercase tracking-[0.18em] ${
                                      isSelected ? 'text-white/70' : 'text-zinc-400'
                                    }`}
                                  >
                                    {program.gameName}
                                  </p>
                                  <h3 className="mt-2 text-xl font-black">{program.title}</h3>
                                </div>
                                <span
                                  className={`rounded-full px-3 py-1 text-[11px] font-black ${
                                    isSelected
                                      ? 'bg-white/15 text-white'
                                      : program.status === 'ACTIVE'
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-zinc-100 text-zinc-500'
                                  }`}
                                >
                                  {program.status === 'ACTIVE' ? '운영중' : '마감'}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-8 text-center">
                        <p className="font-black text-black">아직 만든 프로그램이 없습니다.</p>
                      </div>
                    )}
                  </section>
                </div>
              </div>
            ) : (
              <section className="rounded-2xl border border-zinc-100 p-8 text-center">
                <button
                  type="button"
                  onClick={() => changeTab('become')}
                  className="mx-auto inline-flex items-center gap-2 rounded-xl bg-black px-6 py-4 text-sm font-black text-white"
                >
                  <Plus size={17} />
                  멘토 되기
                </button>
                <p className="mt-5 text-lg font-black text-black">멘토가 되어보세요!</p>
              </section>
            )}
          </section>
        ) : null}

        {activeTab === 'become' ? (
          <section>
            {mentorProfileLoading ? (
              <div className="flex h-64 items-center justify-center rounded-2xl bg-zinc-50">
                <Loader2 className="animate-spin text-zinc-400" />
              </div>
            ) : mentorProfile ? (
              <section className="rounded-2xl border border-zinc-100 p-6">
                <form onSubmit={handleSubmitProgram}>
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
                      placeholder="가능한 시간대"
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
              </section>
            ) : showMentorForm ? (
              <section className="rounded-2xl border border-zinc-100 p-6">
                <h2 className="text-2xl font-black text-black">멘토 등록 요청</h2>
                <p className="mt-2 text-sm font-bold text-zinc-500">
                  멘토 등록 후 멘토 프로필과 프로그램 작성 기능이 활성화됩니다.
                </p>
                <form onSubmit={handleRegisterMentor} className="mt-6">
                  <textarea
                    value={mentorAbout}
                    onChange={(event) => setMentorAbout(event.target.value)}
                    required
                    rows={7}
                    placeholder="멘토링 경험, 전문 분야, 멘티에게 전하고 싶은 메시지를 적어주세요."
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
                  멘토 등록 후 프로그램을 만들고 멘토링 요청을 받을 수 있습니다.
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

        {detailLoading || selectedProgram ? (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 px-4 py-8"
            onClick={() => {
              if (!detailLoading) {
                setSelectedProgram(null);
                setSelectedProgramReviews([]);
              }
            }}
          >
            <div
              className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              {detailLoading || !selectedProgram ? (
                <div className="flex h-64 items-center justify-center">
                  <Loader2 className="animate-spin text-zinc-400" />
                </div>
              ) : (
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">
                        {selectedProgram.gameName}
                      </p>
                      <h2 className="mt-1 text-2xl font-black text-black">{selectedProgram.title}</h2>
                      <p className="mt-2 text-sm font-bold text-zinc-500">
                        멘토 {programMentorName(selectedProgram)} · {formatMileage(selectedProgram.price)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProgram(null);
                        setSelectedProgramReviews([]);
                      }}
                      className="rounded-full bg-zinc-100 p-2 text-zinc-500"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="mt-5 rounded-2xl border border-zinc-100 p-6">
                    <h3 className="text-2xl font-black text-black">{programMentorName(selectedProgram)} 멘토</h3>

                    <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-xl bg-zinc-50 p-3">
                        <p className="text-lg font-black text-black">{(selectedMentorStats?.ratingAvg ?? 0).toFixed(1)}</p>
                        <p className="text-xs font-bold text-zinc-400">평점</p>
                      </div>
                      <div className="rounded-xl bg-zinc-50 p-3">
                        <p className="text-lg font-black text-black">{selectedMentorStats?.reviewCount ?? 0}</p>
                        <p className="text-xs font-bold text-zinc-400">리뷰</p>
                      </div>
                      <div className="rounded-xl bg-zinc-50 p-3">
                        <p className="text-lg font-black text-black">{selectedMentorStats?.menteeCount ?? 0}</p>
                        <p className="text-xs font-bold text-zinc-400">신청한 멘티</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 rounded-xl bg-zinc-50 p-4 text-sm font-bold leading-6 text-zinc-600">
                    <p className="font-black text-black">진행 방식</p>
                    <p>{splitProgramContent(selectedProgram.content).method || '추후 협의'}</p>
                    <p className="mt-4 font-black text-black">상세 설명</p>
                    <p>{splitProgramContent(selectedProgram.content).content}</p>
                  </div>

                  <div className="mt-6">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Reviews</p>
                        <h3 className="mt-1 text-2xl font-black text-black">멘티 리뷰</h3>
                      </div>
                      <span className="text-sm font-black text-zinc-400">총 {selectedProgramReviews.length}개</span>
                    </div>

                    {selectedProgramReviewsLoading ? (
                      <div className="mt-5 flex h-40 items-center justify-center rounded-2xl bg-zinc-50">
                        <Loader2 className="animate-spin text-zinc-400" />
                      </div>
                    ) : selectedProgramReviews.length > 0 ? (
                      <div className="mt-5 space-y-3">
                        {selectedProgramReviews.map((review) => (
                          <article key={review.id} className="rounded-xl border border-zinc-100 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-black text-black">{review.menteeNickname}</p>
                                <p className="mt-1 text-xs font-bold text-zinc-400">
                                  {formatDateTime(review.createdAt)}
                                </p>
                              </div>
                              <span className="rounded-full bg-yellow-50 px-3 py-1 text-xs font-black text-yellow-700">
                                {review.rating.toFixed(1)}
                              </span>
                            </div>
                            <p className="mt-3 text-sm font-medium leading-6 text-zinc-600">{review.content}</p>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-5 rounded-xl bg-zinc-50 p-6 text-center text-sm font-bold text-zinc-400">
                        아직 등록된 멘티 리뷰가 없습니다.
                      </p>
                    )}
                  </div>

                  {currentUserOwnsProgram(selectedProgram.mentorId) ? (
                    <p className="mt-5 rounded-xl bg-zinc-50 p-4 text-sm font-black text-zinc-500">
                      내가 등록한 프로그램입니다.
                    </p>
                  ) : selectedProgramApplication ? (
                    <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4">
                      <p className="text-sm font-black text-green-800">이미 신청한 프로그램</p>
                      <p className="mt-2 text-xs font-bold leading-5 text-green-700">
                        이미 이 멘토링을 신청했습니다. 내 멘토링 탭에서 진행 상태를 확인해주세요.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-black text-green-700">
                        <span>상태: {statusLabel[selectedProgramApplication.status] ?? selectedProgramApplication.status}</span>
                        <span>결제: {paymentLabel[selectedProgramApplication.paymentStatus] ?? selectedProgramApplication.paymentStatus}</span>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleApplyProgram} className="mt-5">
                      <div className="mb-4 rounded-xl bg-yellow-50 p-4 text-xs font-bold leading-5 text-yellow-800">
                        신청 시 프로그램 가격만큼의 마일리지가 에스크로 보관 상태로 유지됩니다.
                      </div>

                      <label className="block space-y-2">
                        <span className="text-sm font-black text-zinc-700">멘토에게 보낼 메시지</span>
                        <textarea
                          value={applicationMessage}
                          onChange={(event) => setApplicationMessage(event.target.value)}
                          required
                          rows={4}
                          placeholder="원하는 멘토링 방향이나 현재 고민을 적어주세요."
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
              )}
            </div>
          </div>
        ) : null}

        {selectedOwnedProgram ? (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 px-4 py-8"
            onClick={() => setSelectedOwnedProgramId(null)}
          >
            <div
              className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">
                    {selectedOwnedProgram.gameName}
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-black">{selectedOwnedProgram.title}</h2>
                  <p className="mt-2 text-sm font-bold text-zinc-500">{formatMileage(selectedOwnedProgram.price)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOwnedProgramId(null)}
                  className="rounded-full bg-zinc-100 p-2 text-zinc-500"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-zinc-50 p-4">
                  <p className="flex items-center gap-2 text-sm font-black text-black">
                    <Star size={16} className="text-yellow-500" />
                    평균 별점
                  </p>
                  <p className="mt-2 text-2xl font-black text-black">{mentorProfile?.ratingAvg.toFixed(1) ?? '0.0'}</p>
                </div>
                <div className="rounded-xl bg-zinc-50 p-4">
                  <p className="text-sm font-black text-black">리뷰 수</p>
                  <p className="mt-2 text-2xl font-black text-black">{mentorProfile?.reviewCount ?? 0}</p>
                </div>
              </div>

              <div className="mt-5 rounded-xl bg-zinc-50 p-4 text-sm font-bold leading-6 text-zinc-600">
                <p className="font-black text-black">진행 방식</p>
                <p>{splitProgramContent(selectedOwnedProgram.content).method || '추후 협의'}</p>
                <p className="mt-4 font-black text-black">상세 설명</p>
                <p>{splitProgramContent(selectedOwnedProgram.content).content}</p>
              </div>

              <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-zinc-100 p-4">
                <div>
                  <p className="text-sm font-black text-black">프로그램 삭제</p>
                  <p className="mt-1 text-xs font-bold text-zinc-400">
                    더 이상 운영하지 않을 프로그램은 여기서 정리할 수 있습니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteProgram(selectedOwnedProgram.id)}
                  disabled={pendingAction === `delete-program:${selectedOwnedProgram.id}`}
                  className="rounded-lg bg-red-50 p-3 text-red-600 disabled:opacity-40"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Reviews</p>
                    <h3 className="mt-1 text-2xl font-black text-black">멘티 리뷰</h3>
                  </div>
                  <span className="text-sm font-black text-zinc-400">총 {mentorReviews.length.toLocaleString()}개</span>
                </div>

                {mentorReviewsLoading ? (
                  <div className="mt-5 flex h-40 items-center justify-center rounded-2xl bg-zinc-50">
                    <Loader2 className="animate-spin text-zinc-400" />
                  </div>
                ) : mentorReviews.length > 0 ? (
                  <div className="mt-5 space-y-3">
                    {mentorReviews.map((review) => (
                      <article key={review.id} className="rounded-xl border border-zinc-100 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black text-black">{review.menteeNickname}</p>
                            <p className="mt-1 text-xs font-bold text-zinc-400">
                              {formatDateTime(review.createdAt)}
                            </p>
                          </div>
                          <span className="rounded-full bg-yellow-50 px-3 py-1 text-xs font-black text-yellow-700">
                            {review.rating.toFixed(1)}
                          </span>
                        </div>
                        <p className="mt-2 text-xs font-black text-zinc-400">{review.programTitle}</p>
                        <p className="mt-3 text-sm font-medium leading-6 text-zinc-600">{review.content}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="mt-5 rounded-xl bg-zinc-50 p-6 text-center text-sm font-bold text-zinc-400">
                    아직 등록된 누적 리뷰가 없습니다.
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {reviewTarget ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4">
            <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Review</p>
                  <h2 className="mt-1 text-2xl font-black text-black">리뷰 작성</h2>
                  <p className="mt-2 text-sm font-bold text-zinc-500">
                    {reviewTarget.programTitle}에 대한 평점과 후기를 남겨주세요.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeReviewModal}
                  disabled={pendingAction === `review:${reviewTarget.id}`}
                  className="rounded-full bg-zinc-100 p-2 text-zinc-500 disabled:opacity-50"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmitReview} className="mt-6">
                <div>
                  <p className="text-sm font-black text-zinc-700">평점</p>
                  <div className="mt-3 flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((value) => {
                      const active = value <= reviewRating;

                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setReviewRating(value)}
                          className={`rounded-full p-2 transition ${
                            active ? 'bg-yellow-100 text-yellow-500' : 'bg-zinc-100 text-zinc-400'
                          }`}
                        >
                          <Star size={18} fill={active ? 'currentColor' : 'none'} />
                        </button>
                      );
                    })}
                    <span className="ml-2 text-sm font-black text-zinc-500">{reviewRating} / 5</span>
                  </div>
                </div>

                <label className="mt-6 block">
                  <span className="text-sm font-black text-zinc-700">후기</span>
                  <textarea
                    value={reviewContent}
                    onChange={(event) => setReviewContent(event.target.value)}
                    rows={5}
                    maxLength={500}
                    placeholder="멘토링이 어땠는지 자세히 적어주세요."
                    className="mt-3 w-full resize-none rounded-2xl border border-zinc-200 px-4 py-3 text-sm outline-none"
                  />
                </label>

                <div className="mt-2 text-right text-xs font-bold text-zinc-400">
                  {reviewContent.trim().length} / 500
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeReviewModal}
                    disabled={pendingAction === `review:${reviewTarget.id}`}
                    className="rounded-xl border border-zinc-200 px-4 py-3 text-sm font-black text-zinc-600 disabled:opacity-50"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={pendingAction === `review:${reviewTarget.id}`}
                    className="rounded-xl bg-black px-5 py-3 text-sm font-black text-white disabled:bg-zinc-300"
                  >
                    {pendingAction === `review:${reviewTarget.id}` ? '등록 중...' : '리뷰 등록'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function ApplicationList({
  title,
  role,
  applications,
  reviewedApplicationIds,
  pendingAction,
  onChat,
  onAccept,
  onReject,
  onCancel,
  onStart,
  onFinish,
  onComplete,
  onReview,
  onReviewedClick,
}: {
  title: string;
  role: 'mentor' | 'mentee';
  applications: MentoringApplicationResponse[];
  reviewedApplicationIds: Record<string, boolean>;
  pendingAction: string;
  onChat?: (application: MentoringApplicationResponse) => void;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  onCancel?: (id: string) => void;
  onStart?: (id: string) => void;
  onFinish?: (id: string) => void;
  onComplete?: (id: string) => void;
  onReview?: (application: MentoringApplicationResponse) => void;
  onReviewedClick?: (application: MentoringApplicationResponse) => void;
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
              reviewed={Boolean(reviewedApplicationIds[application.id])}
              pendingAction={pendingAction}
              onChat={() => onChat?.(application)}
              onAccept={() => onAccept?.(application.id)}
              onReject={() => onReject?.(application.id)}
              onCancel={() => onCancel?.(application.id)}
              onStart={() => onStart?.(application.id)}
              onFinish={() => onFinish?.(application.id)}
              onComplete={() => onComplete?.(application.id)}
              onReview={() => onReview?.(application)}
              onReviewedClick={() => onReviewedClick?.(application)}
            />
          ))
        ) : (
          <p className="rounded-xl bg-zinc-50 p-6 text-center text-sm font-bold text-zinc-400">
            표시할 요청 내역이 없습니다.
          </p>
        )}
      </div>
    </div>
  );
}

function ApplicationCard({
  application,
  role,
  reviewed,
  pendingAction,
  onChat,
  onAccept,
  onReject,
  onCancel,
  onStart,
  onFinish,
  onComplete,
  onReview,
  onReviewedClick,
}: {
  application: MentoringApplicationResponse;
  role: 'mentor' | 'mentee';
  reviewed: boolean;
  pendingAction: string;
  onChat?: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  onCancel?: () => void;
  onStart?: () => void;
  onFinish?: () => void;
  onComplete?: () => void;
  onReview?: () => void;
  onReviewedClick?: () => void;
}) {
  const actionPending = pendingAction.endsWith(`:${application.id}`);
  const guide = applicationGuide(role, application.status, application.paymentStatus);
  const chatEnabled = canOpenMentoringChat(application.status);

  return (
    <article className="rounded-xl border border-zinc-100 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-black text-black">{application.programTitle}</h3>
          <p className="mt-1 text-xs font-bold text-zinc-400">
            멘토 {application.mentorNickname} · 멘티 {application.menteeNickname}
          </p>
        </div>
        {application.status !== 'CANCELLED' ? (
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-black text-zinc-500">
            {statusLabel[application.status] ?? application.status}
          </span>
        ) : null}
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
          onClick={onChat}
          disabled={actionPending || !chatEnabled}
          title={chatEnabled ? '채팅 시작' : '멘토가 신청을 수락한 뒤에만 채팅할 수 있습니다.'}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-xs font-black text-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <MessageCircle size={14} />
          채팅 시작
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

        {role === 'mentee' && application.status === 'APPLIED' ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={actionPending}
            className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
          >
            <X size={14} />
            요청 취소
          </button>
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

        {role === 'mentee' && application.status === 'COMPLETED' && !reviewed ? (
          <button
            type="button"
            onClick={onReview}
            disabled={actionPending}
            className="inline-flex items-center gap-2 rounded-lg bg-yellow-400 px-3 py-2 text-xs font-black text-black disabled:opacity-50"
          >
            <Star size={14} />
            리뷰 작성
          </button>
        ) : null}

        {role === 'mentee' && application.status === 'COMPLETED' && reviewed ? (
          <button
            type="button"
            onClick={onReviewedClick}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-xs font-black text-zinc-500"
            title={REVIEW_ALREADY_COMPLETED_MESSAGE}
          >
            <Check size={14} />
            리뷰 작성 완료
          </button>
        ) : null}
      </div>
    </article>
  );
}

function MileageTransactionPanel({
  transactions,
  loading,
  totalElements,
}: {
  transactions: MileageTransactionResponse[];
  loading: boolean;
  totalElements: number;
}) {
  return (
    <section className="rounded-2xl border border-zinc-100 bg-white p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Transactions</p>
          <h2 className="mt-1 text-2xl font-black text-black">마일리지 거래 내역</h2>
        </div>
        <p className="text-sm font-bold text-zinc-500">총 {totalElements.toLocaleString()}건</p>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="animate-spin text-zinc-400" />
        </div>
      ) : transactions.length > 0 ? (
        <div className="mt-5 space-y-3">
          {transactions.map((transaction) => {
            const positive = transaction.amount >= 0;

            return (
              <article
                key={transaction.id}
                className="flex flex-col gap-3 rounded-xl border border-zinc-100 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`rounded-xl p-2 ${
                      positive ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-500'
                    }`}
                  >
                    {positive ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                  </div>
                  <div>
                    <p className="font-black text-black">{transaction.typeDescription}</p>
                    <p className="mt-1 text-sm font-bold text-zinc-500">{transaction.description}</p>
                    <p className="mt-1 text-xs font-bold text-zinc-400">{formatDateTime(transaction.createdAt)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-black ${positive ? 'text-blue-600' : 'text-red-500'}`}>
                    {formatSignedMileage(transaction.amount)}
                  </p>
                  <p className="mt-1 text-xs font-bold text-zinc-400">
                    잔액 {formatMileage(transaction.balanceAfter)}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="mt-5 rounded-xl bg-zinc-50 p-6 text-center text-sm font-bold text-zinc-400">
          거래 내역이 아직 없습니다.
        </p>
      )}
    </section>
  );
}
