'use client';
import { useConfirm } from '@/app/context/ConfirmContext';

import {
  AlertCircle,
  Check,
  ChevronLeft,
  Clock3,
  Flag,
  Gamepad2,
  ImagePlus,
  CreditCard,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  Star,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { MembershipBadge } from '@/app/home/components/MembershipBadge';
import { RepresentativeTierBadge } from '@/app/home/components/RepresentativeTierBadge';
import type { RepresentativeTier } from '@/lib/representative-tier';
import { ProgramListSkeleton } from '@/app/home/components/LoadingSkeletons';
import { ChangeEvent, FormEvent, type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { assertCurrentAuthGeneration, getAuthGeneration } from '@/lib/auth-store';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { currentPageReturnTo, requestLogin } from '@/lib/login-prompt';
import { useAuth } from '@/app/context/AuthContext';
import { ReportContentModal } from '@/app/home/components/Report';
import { AUTH_REQUIRED_MESSAGE, isAuthError } from '@/lib/api-client';
import { createConversation } from '@/lib/message-api';
import {
  acceptMentoringApplication,
  applyToMentoringProgram,
  cancelMentoringApplication,
  completeMentoringApplication,
  createMentoringProgram,
  deleteMentoringProgram,
  uploadMentoringProgramImage,
  createMentoringReview,
  emptyPage,
  type GameResponse,
  fetchMenteeApplications,
  fetchMentorReviews,
  fetchMentorApplications,
  fetchMentoringProgramDetail,
  fetchGames,
  fetchMentoringPrograms,
  fetchMyMentorProfile,
  fetchMentorProfile,
  finishMentoringApplication,
  registerMentor,
  rejectMentoringApplication,
  startMentoringApplication,
  updateMentoringProgram,
  type ApplicationStatus,
  type MentoringApplicationResponse,
  type MentoringProgramDetailResponse,
  type MentoringProgramResponse,
  type MentoringReviewResponse,
  type MentorProfileResponse,
  type PaymentStatus,
} from '@/lib/mentoring-api';
import { fetchMyMileageBalance } from '@/lib/mileage-api';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useMileageBalance } from '@/hooks/useMileageBalance';
import { getInitials } from '@/lib/feed-api';
import { toAbsoluteAssetUrl } from '@/lib/asset-url';

import type { PageResponse } from '@/types/api';
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

const GAMES_ERROR_MESSAGE = '게임 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
const REVIEW_ALREADY_COMPLETED_MESSAGE = '이미 리뷰 작성이 완료된 멘토링입니다.';
const DEEP_LINK_HIGHLIGHT_DURATION = 2200;
const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg-brand dark:focus-visible:outline-line-focus';
const PROGRAM_GRID = 'grid gap-3 xl:grid-cols-2 xl:gap-5';
const DIALOG_BACKDROP = 'fixed inset-0 z-50 flex items-end justify-center bg-black/60 lg:items-center lg:p-5';
const DIALOG_PANEL = 'relative max-h-[90dvh] w-full overflow-y-auto overscroll-contain rounded-t-[20px] border border-line-card bg-surface px-4 pt-8 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl lg:rounded-card lg:p-6';

const defaultProgramForm: ProgramForm = {
  gameName: '',
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
  ONGOING: '진행 중',
  FINISHED: '종료 확인 대기',
  COMPLETED: '완료',
  CANCELLED: '취소',
};

const paymentLabel: Record<PaymentStatus, string> = {
  PENDING: '결제 대기',
  ESCROW_HELD: '결제 보류',
  SETTLED: '정산 완료',
  REFUNDED: '환불 완료',
};

function normalizeId(value?: string | null) {
  return value?.toLowerCase() ?? '';
}

function deepLinkElementId(type: 'application' | 'review', id: string) {
  return `mentoring-${type}-${encodeURIComponent(id)}`;
}

function formatMileage(value: number) {
  return `${Number(value || 0).toLocaleString()} M`;
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

const PROGRAM_IMAGE_LINE = /^!\[([^\]]*)\]\((\/uploads\/[^\s)]+)\)$/;

// 상세 설명 안의 `![설명](/uploads/...)` 줄은 이미지로, 나머지는 텍스트로 그린다.
function ProgramDescription({ content, className }: { content: string; className?: string }) {
  const blocks: Array<{ type: 'text'; value: string } | { type: 'image'; alt: string; src: string }> = [];
  for (const line of content.split('\n')) {
    const match = line.trim().match(PROGRAM_IMAGE_LINE);
    if (match) {
      blocks.push({ type: 'image', alt: match[1], src: match[2] });
      continue;
    }
    const last = blocks[blocks.length - 1];
    if (last?.type === 'text') last.value += `\n${line}`;
    else blocks.push({ type: 'text', value: line });
  }

  return (
    <div className={className}>
      {blocks.map((block, index) =>
        block.type === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={index} src={toAbsoluteAssetUrl(block.src) ?? block.src} alt={block.alt || '프로그램 설명 이미지'} loading="lazy" className="my-3 h-auto max-w-[50%] rounded-control" />
        ) : block.value.trim() ? (
          <p key={index} className="whitespace-pre-wrap">{block.value.trim()}</p>
        ) : null,
      )}
    </div>
  );
}

// 상세 설명 중 첫 이미지를 목록 카드 썸네일로 쓴다.
function firstProgramImage(content: string) {
  for (const line of content.split('\n')) {
    const match = line.trim().match(PROGRAM_IMAGE_LINE);
    if (match) return match[2];
  }
  return null;
}

// 카드 설명에는 이미지 줄을 빼고 글만 보여 준다.
function stripProgramImages(content: string) {
  return content.split('\n').filter((line) => !PROGRAM_IMAGE_LINE.test(line.trim())).join('\n').trim();
}

type EditorSegment = { type: 'text'; text: string } | { type: 'image'; alt: string; src: string };

function parseEditorSegments(value: string): EditorSegment[] {
  const segments: EditorSegment[] = [];
  for (const line of value.split('\n')) {
    const match = line.trim().match(PROGRAM_IMAGE_LINE);
    if (match) {
      segments.push({ type: 'image', alt: match[1], src: match[2] });
      continue;
    }
    const last = segments[segments.length - 1];
    if (last?.type === 'text') last.text += `\n${line}`;
    else segments.push({ type: 'text', text: line });
  }
  // 이미지 앞뒤·이미지 사이에는 항상 글을 쓸 수 있는 칸을 둔다.
  const padded: EditorSegment[] = [];
  segments.forEach((segment, index) => {
    if (segment.type === 'image' && (index === 0 || segments[index - 1].type === 'image')) padded.push({ type: 'text', text: '' });
    padded.push(segment);
  });
  if (padded[padded.length - 1]?.type === 'image') padded.push({ type: 'text', text: '' });
  return padded.length ? padded : [{ type: 'text', text: '' }];
}

function serializeEditorSegments(segments: EditorSegment[]) {
  return segments.map((segment) => (segment.type === 'image' ? `![${segment.alt}](${segment.src})` : segment.text)).join('\n');
}

// 글과 이미지를 한 칸 안에서 보면서 편집한다. 저장 형식은 기존과 같은 텍스트(`![이미지](/uploads/...)` 줄)다.
function ProgramContentEditor({ value, onChange, onError }: {
  value: string;
  onChange: (value: string) => void;
  onError: (error: unknown) => void;
}) {
  const segments = useMemo(() => parseEditorSegments(value), [value]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const caretRef = useRef<{ index: number; pos: number } | null>(null);
  const [uploading, setUploading] = useState(false);

  const update = (next: EditorSegment[]) => onChange(serializeEditorSegments(next));
  const firstImageIndex = segments.findIndex((segment) => segment.type === 'image');

  // 대표 이미지 = 본문의 첫 이미지. 선택한 이미지를 현재 첫 이미지 바로 앞으로 옮긴다.
  const setRepresentative = (index: number) => {
    const image = segments[index];
    if (image.type !== 'image' || index === firstImageIndex) return;
    const rest = segments.filter((_, i) => i !== index);
    rest.splice(firstImageIndex, 0, image);
    update(rest);
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onError(new Error('이미지 파일만 첨부할 수 있습니다.'));
      return;
    }
    setUploading(true);
    try {
      const { imageUrl } = await uploadMentoringProgramImage(file);
      const image: EditorSegment = { type: 'image', alt: '이미지', src: imageUrl };
      const caret = caretRef.current;
      const index = caret && segments[caret.index]?.type === 'text' ? caret.index : segments.length - 1;
      const target = segments[index];
      if (target.type === 'text') {
        const pos = caret && caret.index === index ? Math.min(caret.pos, target.text.length) : target.text.length;
        const next = [...segments];
        next.splice(index, 1, { type: 'text', text: target.text.slice(0, pos) }, image, { type: 'text', text: target.text.slice(pos) });
        update(next);
      } else {
        update([...segments, image, { type: 'text', text: '' }]);
      }
    } catch (error) {
      onError(error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="input-base h-auto space-y-2 py-3">
      {segments.map((segment, index) =>
        segment.type === 'image' ? (
          <div key={index} className="relative w-fit max-w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={toAbsoluteAssetUrl(segment.src) ?? segment.src} alt={segment.alt} className="h-auto max-h-40 max-w-[50%] rounded-control" />
            {index === firstImageIndex ? (
              <span className="absolute left-2 top-2 rounded-full bg-brand px-2 py-0.5 text-caption text-fg-on-brand">대표</span>
            ) : (
              <button
                type="button"
                onClick={() => setRepresentative(index)}
                className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-caption text-white"
              >
                대표 이미지로 설정
              </button>
            )}
            <button
              type="button"
              aria-label="이미지 삭제"
              onClick={() => update(segments.filter((_, i) => i !== index))}
              className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-black/60 text-white"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <textarea
            key={index}
            value={segment.text}
            rows={Math.max(index === 0 ? 3 : 1, segment.text.split('\n').length)}
            placeholder={segments.length === 1 ? '상세 설명을 입력하세요.' : undefined}
            aria-label="상세 설명"
            className="block w-full resize-none bg-transparent text-body text-fg-primary outline-none"
            onChange={(event) => {
              const next = [...segments];
              next[index] = { type: 'text', text: event.target.value };
              update(next);
            }}
            onSelect={(event) => { caretRef.current = { index, pos: event.currentTarget.selectionStart }; }}
            onFocus={(event) => { caretRef.current = { index, pos: event.currentTarget.selectionStart }; }}
          />
        ),
      )}
      <div className="flex items-center gap-3 pt-1">
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => void handleFile(event)} />
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-secondary">
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
          이미지 추가
        </button>
      </div>
    </div>
  );
}

function splitProgramContent(rawContent?: string | null) {
  const safeContent = rawContent ?? '';
  const methodMatch = safeContent.match(/\[진행 방식\]\s*([\s\S]*?)(?:\n\s*\[상세 설명\]|$)/);
  const contentMatch = safeContent.match(/\[상세 설명\]\s*([\s\S]*)$/);

  return {
    method: methodMatch?.[1]?.trim() ?? '',
    content: contentMatch?.[1]?.trim() ?? safeContent,
  };
}

// 리뷰가 없으면 0.0 대신 리뷰 없음으로 보여 낮은 평점처럼 보이지 않게 한다.
function formatRatingValue(stats: { ratingAvg: number; reviewCount: number } | null | undefined) {
  return stats && stats.reviewCount > 0 ? stats.ratingAvg.toFixed(1) : '-';
}

function formatRatingLabel(stats: { ratingAvg: number; reviewCount: number } | null | undefined) {
  return stats && stats.reviewCount > 0 ? `★ ${stats.ratingAvg.toFixed(1)} · 리뷰 ${stats.reviewCount}` : '리뷰 없음';
}

function MembershipBadgeInline({ active, tier }: { active?: boolean; tier?: RepresentativeTier | null }) {
  return active || tier ? (
    <span className="ml-0.5 inline-flex items-center gap-0.5 align-middle">
      <MembershipBadge active={active} />
      <RepresentativeTierBadge tier={tier} />
    </span>
  ) : null;
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
      ? '시작 버튼을 눌러 진행 상태로 변경해 주세요.'
      : '멘토가 요청을 수락했습니다.';
  }

  if (status === 'ONGOING') {
    return role === 'mentor'
      ? '멘토링이 끝나면 종료 보고를 눌러 주세요.'
      : '멘토링이 진행 중입니다.';
  }

  if (status === 'FINISHED') {
    return role === 'mentee'
      ? '문제가 없으면 완료 확정을 눌러 주세요.'
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
  const hasMileageTerm = message.includes('마일리지');
  const hasShortageTerm = message.includes('부족');

  return hasMileageTerm && hasShortageTerm;
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

  return message.includes('이미') && message.includes('리뷰') && message.includes('작성');
}

export default function MentoringPage() {
  const tabsId = useId();
  const closeProgramLockRef = useRef(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, logout, isAuthReady } = useAuth();
  const requireAuth = useRequireAuth();
  const replace = router.replace;
  const searchString = searchParams.toString();
  const currentUserId = user?.id ?? '';
  const requestedApplicationId = searchParams.get('applicationId')?.trim() || null;
  const requestedReviewId = searchParams.get('reviewId')?.trim() || null;
  const requestedMineTab = searchParams.get('tab') === 'mine';
  const params = useParams<{ programId?: string }>();
  const routeProgramId = typeof params?.programId === 'string' ? params.programId.trim() || null : null;
  const detailPageMode = Boolean(routeProgramId);
  const requestedProgramId = routeProgramId ?? (searchParams.get('programId')?.trim() || null);
  const openedProgramIdRef = useRef<string | null>(null);
  const programReportButtonRef = useRef<HTMLButtonElement>(null);

  const [activeTab, setActiveTab] = useState<MentoringTab>('find');
  const [games, setGames] = useState<GameResponse[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const gamesRequestRef = useRef(0);
  const [gamesError, setGamesError] = useState('');
  const [gameFilter, setGameFilter] = useState(''); // '' = 전체
  const [programPage, setProgramPage] = useState<PageResponse<MentoringProgramResponse>>(emptyPage());
  const [programPageNumber, setProgramPageNumber] = useState(0);
  const [programsLoading, setProgramsLoading] = useState(false);
  const [ownedPrograms, setOwnedPrograms] = useState<MentoringProgramResponse[]>([]);
  const [mentorStatsById, setMentorStatsById] = useState<Record<string, MentorProfileResponse>>({});

  const [mentorProfile, setMentorProfile] = useState<MentorProfileResponse | null>(null);
  const [mentorProfileLoading, setMentorProfileLoading] = useState(false);
  const [mentorAbout, setMentorAbout] = useState('');

  const [programForm, setProgramForm] = useState<ProgramForm>(defaultProgramForm);
  const [editingProgram, setEditingProgram] = useState<(MentoringProgramResponse | MentoringProgramDetailResponse) | null>(null);
  const [editProgramForm, setEditProgramForm] = useState<ProgramForm>(defaultProgramForm);
  const [selectedProgram, setSelectedProgram] = useState<MentoringProgramDetailResponse | null>(null);
  const [programReportOpen, setProgramReportOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [applicationMessage, setApplicationMessage] = useState('');
  const [selectedProgramReviews, setSelectedProgramReviews] = useState<MentoringReviewResponse[]>([]);
  const [selectedProgramReviewsLoading, setSelectedProgramReviewsLoading] = useState(false);
  const [selectedOwnedProgramId, setSelectedOwnedProgramId] = useState<string | null>(null);

  const [menteeApplications, setMenteeApplications] = useState<MentoringApplicationResponse[]>([]);
  const [mentorApplications, setMentorApplications] = useState<MentoringApplicationResponse[]>([]);
  const [applicationsLoaded, setApplicationsLoaded] = useState(false);

  const [reviewTarget, setReviewTarget] = useState<MentoringApplicationResponse | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState('');
  const [mentorReviews, setMentorReviews] = useState<MentoringReviewResponse[]>([]);
  const [mentorReviewsLoading, setMentorReviewsLoading] = useState(false);
  const [mentorProgramDataLoaded, setMentorProgramDataLoaded] = useState(false);
  const [highlightedApplicationId, setHighlightedApplicationId] = useState<string | null>(null);
  const [highlightedReviewId, setHighlightedReviewId] = useState<string | null>(null);

  const [notice, setNotice] = useState('');
  const [bannerType, setBannerType] = useState<MentoringBannerType>(null);
  const [authMessage, setAuthMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showMileageShortageModal, setShowMileageShortageModal] = useState(false);
  const [pendingAction, setPendingAction] = useState('');

  const totalPages = Math.max(programPage.totalPages || 1, 1);

  const gameLabel = (code: string) => games.find((game) => game.code === code)?.name ?? code;
  const gamesNotice = gamesError ? (
    <p className="text-caption text-fg-danger">
      {gamesError}{' '}
      <button type="button" onClick={() => void loadGames()} className="underline">
        다시 시도
      </button>
    </p>
  ) : gamesLoading ? (
    <p className="text-caption text-fg-secondary">게임 목록을 불러오는 중입니다.</p>
  ) : null;
  const programGameCode = programForm.gameName || games[0]?.code || '';
  const gamesReady = !gamesLoading && !gamesError && Boolean(programGameCode);
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

  const selectedProgramContent = splitProgramContent(selectedProgram?.content);
  const selectedOwnedProgram = useMemo(() => {
    if (!selectedOwnedProgramId) {
      return null;
    }

    return ownedPrograms.find((program) => program.id === selectedOwnedProgramId) ?? null;
  }, [ownedPrograms, selectedOwnedProgramId]);
  const confirm = useConfirm(JSON.stringify([
    currentUserId, selectedOwnedProgram?.id, selectedOwnedProgram?.status,
  ]));

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
    setShowMileageShortageModal(false);
  }, []);

  const markApplicationReviewed = useCallback((applicationId: string) => {
    setMenteeApplications((current) =>
      current.map((application) =>
        application.id === applicationId ? { ...application, reviewed: true } : application
      )
    );
  }, []);

  const showError = useCallback((error: unknown) => {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    if (isMileageShortageError(error)) {
      setBannerType('mileage');
      setAuthMessage('마일리지가 부족합니다. 충전 후 다시 멘토링을 신청해 주세요.');
      setErrorMessage('');
      setShowMileageShortageModal(true);
      return;
    }

    if (isAuthError(error)) {
      setBannerType('auth');
      setAuthMessage(error instanceof Error ? error.message : AUTH_REQUIRED_MESSAGE);
      setErrorMessage('');
      return;
    }

    setBannerType(null);
    setAuthMessage('');
    setErrorMessage(error instanceof Error ? error.message : '요청 처리 중 문제가 발생했습니다.');
  }, []);

  const mileageBalance = useMileageBalance(isAuthReady ? user?.id : undefined, undefined, activeTab === 'mine' ? showError : undefined);

  const loadPrograms = useCallback(async () => {
    setProgramsLoading(true);
    clearMessages();

    try {
      const page = await fetchMentoringPrograms({
        gameName: gameFilter || undefined,
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
    if (!currentUserId) {
      setOwnedPrograms([]);
      return;
    }

    try {
      const size = 100;
      const owned: MentoringProgramResponse[] = [];
      const normalizedCurrentUserId = normalizeId(currentUserId);
      let pageIndex = 0;

      while (true) {
        const page = await fetchMentoringPrograms({ page: pageIndex, size });

        owned.push(
          ...page.content.filter((program) => normalizeId(program.mentorId) === normalizedCurrentUserId)
        );

        const isLast =
          page.last === true ||
          (typeof page.totalPages === 'number' && pageIndex >= page.totalPages - 1) ||
          page.content.length < size;

        if (isLast) {
          break;
        }

        pageIndex += 1;
      }

      setOwnedPrograms(owned);
    } catch {
      setOwnedPrograms([]);
    }
  }, [currentUserId]);

  const loadCurrentMentorProfile = useCallback(async () => {
    if (!currentUserId) return;

    setMentorProfileLoading(true);
    try {
      const profile = await fetchMyMentorProfile();
      setMentorProfile(profile);
      setMentorAbout(profile?.about ?? '');
    } catch (error) {
      setMentorProfile(null);
      setMentorAbout('');
      showError(error);
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
    setApplicationsLoaded(false);

    if (!currentUserId) {
      setMenteeApplications([]);
      setMentorApplications([]);
      setApplicationsLoaded(true);
      return;
    }

    const [menteeResult, mentorResult] = await Promise.allSettled([
      fetchMenteeApplications(0, 20),
      fetchMentorApplications(0, 20),
    ]);

    const authFailure = [menteeResult, mentorResult].find(
      (result) => result.status === 'rejected' && isAuthError(result.reason)
    );

    if (authFailure?.status === 'rejected') {
      showError(authFailure.reason);
      setMenteeApplications([]);
      setMentorApplications([]);
      setApplicationsLoaded(true);
      return;
    }

    const nextMenteeApplications = menteeResult.status === 'fulfilled' ? menteeResult.value.content : [];
    setMenteeApplications(nextMenteeApplications);
    setMentorApplications(mentorResult.status === 'fulfilled' ? mentorResult.value.content : []);
    setApplicationsLoaded(true);
  }, [currentUserId, showError]);

  useEffect(() => {
    setHighlightedApplicationId(null);
    setHighlightedReviewId(null);
    setSelectedOwnedProgramId(null);

    if (!currentUserId && (requestedReviewId || requestedMineTab || requestedApplicationId)) {
      setActiveTab('find');
      requestLogin({ returnTo: currentPageReturnTo(), message: '내 멘토링은 로그인 후 볼 수 있어요.' });
      const next = new URLSearchParams(searchString);
      for (const key of ['tab', 'applicationId', 'reviewId']) next.delete(key);
      replace('/mentoring' + (next.size ? `?${next}` : ''), { scroll: false });
      return;
    }
    if (requestedReviewId) {
      setActiveTab('programs');
      return;
    }

    setActiveTab(requestedMineTab || requestedApplicationId ? 'mine' : 'find');
  }, [requestedApplicationId, requestedMineTab, requestedReviewId, currentUserId, replace, searchString]);

  const loadGames = useCallback(async () => {
    const requestId = ++gamesRequestRef.current;
    const isLatest = () => requestId === gamesRequestRef.current;
    setGamesLoading(true);
    setGamesError('');

    try {
      const loaded = await fetchGames();
      if (isLatest()) setGames(loaded);
    } catch {
      if (isLatest()) setGamesError(GAMES_ERROR_MESSAGE);
    } finally {
      if (isLatest()) setGamesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthReady) {
      void loadGames();
    }
  }, [currentUserId, isAuthReady, loadGames]);

  useEffect(() => {
    if (activeTab === 'find') {
      void loadPrograms();
    }
  }, [activeTab, loadPrograms]);

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    if (!currentUserId) {
      setMenteeApplications([]);
      setMentorApplications([]);
      return;
    }

    void loadApplications();
  }, [currentUserId, isAuthReady, loadApplications]);

  useEffect(() => {
    if (activeTab === 'programs' && isAuthReady && currentUserId) {
      let cancelled = false;
      setMentorProgramDataLoaded(false);

      void Promise.all([loadCurrentMentorProfile(), loadOwnedPrograms(), loadMentorReviews()]).finally(() => {
        if (!cancelled) {
          setMentorProgramDataLoaded(true);
        }
      });

      return () => {
        cancelled = true;
      };
    }

    setMentorProgramDataLoaded(false);
  }, [
    activeTab,
    currentUserId,
    isAuthReady,
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

  useEffect(() => {
    if (!requestedApplicationId || activeTab !== 'mine' || !applicationsLoaded) {
      return;
    }

    const application = [...menteeApplications, ...mentorApplications].find(
      (item) => item.id === requestedApplicationId
    );

    if (!application) {
      setHighlightedApplicationId(null);
      setActiveTab('find');
      return;
    }

    setHighlightedApplicationId(application.id);
  }, [
    activeTab,
    applicationsLoaded,
    menteeApplications,
    mentorApplications,
    requestedApplicationId,
  ]);

  useEffect(() => {
    if (!requestedReviewId || activeTab !== 'programs' || !mentorProgramDataLoaded) {
      return;
    }

    const review = mentorReviews.find((item) => item.id === requestedReviewId);
    const program = review ? ownedPrograms.find((item) => item.id === review.programId) : null;

    if (!review || !program) {
      setSelectedOwnedProgramId(null);
      setHighlightedReviewId(null);
      setActiveTab(requestedMineTab || requestedApplicationId ? 'mine' : 'find');
      return;
    }

    setSelectedOwnedProgramId(program.id);
    setHighlightedReviewId(review.id);
  }, [
    activeTab,
    mentorProgramDataLoaded,
    mentorReviews,
    ownedPrograms,
    requestedApplicationId,
    requestedMineTab,
    requestedReviewId,
  ]);

  useEffect(() => {
    const target = highlightedReviewId
      ? { type: 'review' as const, id: highlightedReviewId }
      : highlightedApplicationId
        ? { type: 'application' as const, id: highlightedApplicationId }
        : null;

    if (!target) {
      return;
    }

    const scrollTimer = window.setTimeout(() => {
      document
        .getElementById(deepLinkElementId(target.type, target.id))
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
    const highlightTimer = window.setTimeout(() => {
      if (target.type === 'review') {
        setHighlightedReviewId(null);
      } else {
        setHighlightedApplicationId(null);
      }
    }, DEEP_LINK_HIGHLIGHT_DURATION);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(highlightTimer);
    };
  }, [highlightedApplicationId, highlightedReviewId]);

  const changeTab = (tab: MentoringTab) => {
    if (tab !== 'find' && !requireAuth('멘토링 참여·등록은 로그인 후 이용할 수 있어요.', { returnTo: tab === 'mine' ? '/mentoring?tab=mine' : currentPageReturnTo() })) return;
    setActiveTab(tab);
    clearMessages();
  };

  const closeProgramDetail = useCallback(() => {
    setSelectedProgram(null);
    setProgramReportOpen(false);
    setSelectedProgramReviews([]);
    setSelectedProgramReviewsLoading(false);
    setApplicationMessage('');
  }, []);

  const openProgramDetail = async (programId: string) => {
    setDetailLoading(true);
    closeProgramDetail();
    setErrorMessage('');

    try {
      const detail = await fetchMentoringProgramDetail(programId);
      const sourceProgram = [...programPage.content, ...ownedPrograms].find((program) => program.id === programId || String(program.publicNo) === programId);
      setSelectedProgram({
        ...detail,
        status: detail.status ?? sourceProgram?.status ?? 'CLOSED',
      });
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

  // 목록 카드 클릭: 모달 대신 상세 페이지 URL로 이동한다.
  const goToProgramDetail = (program: { id: string; publicNo?: number }) => router.push(`/mentoring/programs/${program.publicNo ?? encodeURIComponent(program.id)}`);
  // 상세 페이지에서는 목록으로 돌아가고, 기존 딥링크(?programId=) 모달에서는 모달만 닫는다.
  const exitProgramDetail = () => {
    if (detailPageMode) router.push('/mentoring');
    else closeProgramDetail();
  };

  const openProgramDetailRef = useRef(openProgramDetail);
  openProgramDetailRef.current = openProgramDetail;

  const handleRegisterMentor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!requireAuth('멘토링에 참여하려면 로그인이 필요해요.')) return;
    setPendingAction('register-mentor');
    clearMessages();

    try {
      const profile = await registerMentor({ about: mentorAbout.trim() });
      setMentorProfile(profile);
      showNotice('멘토 등록을 요청했습니다. 관리자 승인 후 프로그램을 만들 수 있습니다.');
      await loadOwnedPrograms();
    } catch (error) {
      showError(error);
    } finally {
      setPendingAction('');
    }
  };

  const handleProgramFormChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (!requireAuth('프로그램을 등록하려면 로그인이 필요해요.')) return;
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
    if (!requireAuth('멘토링에 참여하려면 로그인이 필요해요.')) return;
    setPendingAction('save-program');
    clearMessages();

    try {
      if (!gamesReady) {
        throw new Error(gamesLoading ? '게임 목록을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.' : GAMES_ERROR_MESSAGE);
      }

      if (!programForm.content.trim()) {
        throw new Error('상세 설명을 입력해 주세요.');
      }

      const price = Number(programForm.price);
      if (price < 0 || Number.isNaN(price)) {
        throw new Error('가격을 올바르게 입력해 주세요.');
      }

      await createMentoringProgram({
        gameName: programGameCode,
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

  const handleCloseProgram = async (program: MentoringProgramResponse) => {
    if (closeProgramLockRef.current) return;
    if (program.status !== 'ACTIVE') {
      showNotice('이미 마감된 프로그램입니다.');
      return;
    }

    closeProgramLockRef.current = true;
    let requested = false;
    try {
      const ok = await confirm({
        message: '이 프로그램을 마감할까요? 마감 후 새 신청을 받을 수 없습니다.',
        confirmLabel: '마감', danger: true,
      });
      if (!ok) return;
      requested = true;
      setPendingAction(`close-program:${program.id}`);
      clearMessages();
      const { method, content } = splitProgramContent(program.content);
      const closedProgram = await updateMentoringProgram(program.id, {
        title: program.title,
        content: buildProgramContent(method, content),
        availableTimeDesc: program.availableTimeDesc ?? '',
        price: program.price,
        status: 'CLOSED',
        tags: program.tags ?? [],
      });

      setOwnedPrograms((current) =>
        current.map((ownedProgram) => (ownedProgram.id === program.id ? closedProgram : ownedProgram))
      );
      showNotice('프로그램을 마감했습니다.');
      await Promise.all([loadCurrentMentorProfile(), loadOwnedPrograms()]);
    } catch (error) {
      showError(error);
    } finally {
      closeProgramLockRef.current = false;
      if (requested) setPendingAction('');
    }
  };

  const openEditProgramModal = (program: MentoringProgramResponse | MentoringProgramDetailResponse) => {
    clearMessages();
    const { method, content } = splitProgramContent(program.content);
    setEditingProgram(program);
    setEditProgramForm({
      gameName: program.gameName,
      title: program.title,
      method,
      content,
      availableTimeDesc: program.availableTimeDesc ?? '',
      price: String(program.price),
      tags: (program.tags ?? []).join(', '),
    });
  };

  const closeEditProgramModal = () => {
    if (pendingAction.startsWith('edit-program:')) return;
    setEditingProgram(null);
  };

  const handleEditProgramFormChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setEditProgramForm((current) => ({
      ...current,
      [name]: name === 'price' ? value.replace(/[^0-9]/g, '') : value,
    }));
  };

  const handleSubmitEditProgram = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!requireAuth('프로그램을 수정하려면 로그인이 필요해요.')) return;
    if (!editingProgram) return;

    setPendingAction(`edit-program:${editingProgram.id}`);
    clearMessages();
    try {
      if (!editProgramForm.content.trim()) {
        throw new Error('상세 설명을 입력해 주세요.');
      }
      const price = Number(editProgramForm.price);
      if (price < 0 || Number.isNaN(price)) {
        throw new Error('가격을 올바르게 입력해 주세요.');
      }

      const updated = await updateMentoringProgram(editingProgram.id, {
        title: editProgramForm.title.trim(),
        content: buildProgramContent(editProgramForm.method, editProgramForm.content),
        availableTimeDesc: editProgramForm.availableTimeDesc.trim(),
        price,
        status: editingProgram.status,
        tags: parseTags(editProgramForm.tags),
      });

      setOwnedPrograms((current) =>
        current.map((ownedProgram) => (ownedProgram.id === editingProgram.id ? updated : ownedProgram))
      );
      if (selectedProgram?.id === editingProgram.id) {
        setSelectedProgram((current) =>
          current
            ? {
                ...current,
                title: updated.title,
                content: updated.content,
                availableTimeDesc: updated.availableTimeDesc,
                price: updated.price,
                status: updated.status,
                tags: updated.tags,
              }
            : current
        );
      }
      setEditingProgram(null);
      showNotice('프로그램을 수정했습니다.');
      await Promise.all([loadOwnedPrograms(), loadPrograms()]);
    } catch (error) {
      showError(error);
    } finally {
      setPendingAction('');
    }
  };

  const handleDeleteProgram = async (program: { id: string; title: string }) => {
    if (closeProgramLockRef.current) return;

    closeProgramLockRef.current = true;
    let requested = false;
    try {
      const ok = await confirm({
        message: '이 프로그램을 삭제할까요? 삭제 후에는 되돌릴 수 없습니다.',
        confirmLabel: '삭제', danger: true,
      });
      if (!ok) return;
      requested = true;
      setPendingAction(`delete-program:${program.id}`);
      clearMessages();
      await deleteMentoringProgram(program.id);

      setOwnedPrograms((current) => current.filter((ownedProgram) => ownedProgram.id !== program.id));
      setSelectedOwnedProgramId(null);
      if (selectedProgram?.id === program.id) {
        closeProgramDetail();
        if (detailPageMode) {
          router.push('/mentoring?tab=programs');
          return;
        }
      }
      showNotice('프로그램을 삭제했습니다.');
      await Promise.all([loadCurrentMentorProfile(), loadOwnedPrograms(), loadPrograms()]);
    } catch (error) {
      showError(error);
    } finally {
      closeProgramLockRef.current = false;
      if (requested) setPendingAction('');
    }
  };

  const handleApplyProgram = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!requireAuth('멘토링에 참여하려면 로그인이 필요해요.')) return;
    if (!selectedProgram) return;
    const generation = getAuthGeneration();

    setPendingAction(`apply:${selectedProgram.id}`);
    clearMessages();

    try {
      const balance = await fetchMyMileageBalance();
      assertCurrentAuthGeneration(generation);
      const currentBalance = balance.currentBalance ?? 0;

      if (currentBalance < selectedProgram.price) {
        setBannerType('mileage');
        setAuthMessage('마일리지가 부족합니다. 충전 후 다시 멘토링을 신청해 주세요.');
        setErrorMessage('');
        setShowMileageShortageModal(true);
        return;
      }

      await applyToMentoringProgram({
        programId: selectedProgram.id,
        message: applicationMessage.trim(),
      });
      closeProgramDetail();
      if (detailPageMode) {
        router.push('/mentoring?tab=mine');
        return;
      }
      showNotice('멘토링 요청이 접수되었습니다.');
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

      await loadApplications();
    } catch (error) {
      showError(error);
    } finally {
      setPendingAction('');
    }
  };

  // 충전 후 원래 프로그램 상세로 돌아오게 한다. 신청은 사용자가 다시 확정한다.
  const goToMileageCharge = () => {
    if (!requireAuth('마일리지를 충전하려면 로그인이 필요해요.', { returnTo: '/wallet' })) return;
    const returnTo = selectedProgram ? `/mentoring/programs/${selectedProgram.publicNo ?? encodeURIComponent(selectedProgram.id)}` : '/mentoring?tab=mine';
    setShowMileageShortageModal(false);
    closeProgramDetail();
    router.push(`/wallet?returnTo=${encodeURIComponent(returnTo)}`);
  };

  useEffect(() => {
    if (!requestedProgramId || !isAuthReady || openedProgramIdRef.current === requestedProgramId) return;
    openedProgramIdRef.current = requestedProgramId;
    void openProgramDetailRef.current(requestedProgramId);
  }, [isAuthReady, requestedProgramId]);

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

  const closeProgramReport = () => {
    setProgramReportOpen(false);
    programReportButtonRef.current?.focus();
  };

  // 위에 떠 있는 모달부터 하나씩 닫는다.
  useEscapeKey(() => {
    if (programReportOpen) closeProgramReport();
    else if (showMileageShortageModal) setShowMileageShortageModal(false);
    else if (editingProgram) closeEditProgramModal();
    else if (reviewTarget) closeReviewModal();
    else if (selectedOwnedProgramId) setSelectedOwnedProgramId(null);
    else if (selectedProgram && !detailLoading && !detailPageMode) closeProgramDetail();
  }, Boolean(showMileageShortageModal || editingProgram || reviewTarget || selectedOwnedProgramId || selectedProgram));

  const handleSubmitReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!requireAuth('멘토링에 참여하려면 로그인이 필요해요.')) return;

    if (!reviewTarget) {
      return;
    }

    const content = reviewContent.trim();
    if (!content) {
      setErrorMessage('리뷰를 입력해 주세요.');
      return;
    }

    setPendingAction(`review:${reviewTarget.id}`);
    clearMessages();

    try {
      await createMentoringReview({
        applicationId: reviewTarget.id,
        rating: reviewRating,
        content,
      });

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

    setPendingAction(`chat:${application.id}`);
    clearMessages();

    try {
      const conversation = await createConversation({ recipientId });
      router.push(`/messages?conversationId=${encodeURIComponent(conversation.id)}`);
    } catch (error) {
      showError(error);
    } finally {
      setPendingAction('');
    }
  };

  return (
    <div className="px-4 pb-6 pt-2 md:px-6 lg:pt-6 xl:pr-0">
      <div className="mx-auto max-w-[940px] xl:ml-0">
        {detailPageMode ? (
          <div className="sticky top-0 z-20 flex items-center gap-1 bg-canvas px-2 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] lg:static lg:-ml-2 lg:px-0 lg:pb-4 lg:pt-0">
            <Link href="/mentoring" className={`btn-icon text-icon-primary ${FOCUS_RING}`} aria-label="뒤로 가기">
              <ChevronLeft size={24} strokeWidth={1.67} />
            </Link>
            <h1 className="text-title text-fg-primary">멘토링 목록</h1>
          </div>
        ) : null}
        <div hidden={detailPageMode}>
        <header className="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2 lg:items-center">
          <div>
            <h1 className="text-title text-fg-primary">멘토링</h1>
            <p className="page-subtitle hidden lg:block">게임별 멘토에게 1:1로 배워 보세요.</p>
          </div>
          <div className="flex items-center gap-2 rounded-control bg-surface px-3 py-2 text-label">
            <Link href="/wallet" className={`rounded-sm text-fg-primary ${FOCUS_RING}`}>
              <span className="sr-only lg:not-sr-only lg:mr-2 lg:text-caption lg:text-fg-secondary">내 마일리지</span>
              {mileageBalance === null ? '—' : formatMileage(mileageBalance)}
            </Link>
            <button type="button" onClick={goToMileageCharge} className={`rounded-sm text-fg-brand ${FOCUS_RING}`}>충전</button>
          </div>
        </header>

        <div
          role="tablist"
          aria-label="멘토링 메뉴"
          className="mb-5 flex flex-wrap gap-x-4 border-b border-line sm:gap-x-6"
          onKeyDown={(event) => {
            const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
            const index = tabs.findIndex((tab) => tab === event.target);
            if (index === -1) return;
            let nextIndex: number;
            switch (event.key) {
              case 'ArrowLeft': nextIndex = (index + tabs.length - 1) % tabs.length; break;
              case 'ArrowRight': nextIndex = (index + 1) % tabs.length; break;
              case 'Home': nextIndex = 0; break;
              case 'End': nextIndex = tabs.length - 1; break;
              default: return;
            }
            event.preventDefault();
            tabs[nextIndex].focus();
          }}
        >
          {([
            ['find', '멘토 찾기'],
            ['mine', '내 멘토링'],
            ['programs', '내 프로그램'],
            ['become', '멘토 되기'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`${tabsId}-tab-${id}`}
              aria-controls={`${tabsId}-panel-${id}`}
              aria-selected={activeTab === id}
              tabIndex={activeTab === id ? 0 : -1}
              onFocus={() => { if (activeTab !== id) changeTab(id); }}
              onClick={() => changeTab(id)}
              className={`h-11 whitespace-nowrap border-b-2 text-label ${FOCUS_RING} ${
                activeTab === id ? 'border-brand font-semibold text-fg-primary' : 'border-transparent text-fg-secondary hover:text-fg-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {notice ? <div role="status" className="mb-5 rounded-xl bg-success-subtle px-4 py-3 text-body text-fg-primary">{notice}</div> : null}

        {authMessage ? (
          <div className="mb-5 rounded-2xl border border-line bg-brand-subtle p-4 sm:p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex gap-3">
                <AlertCircle className="mt-0.5 shrink-0 text-fg-brand" size={20} />
                <div>
                  <p className="font-semibold text-fg-brand">
                    {bannerType === 'mileage' ? '마일리지가 부족합니다' : '다시 로그인해 주세요'}
                  </p>
                  <p className="mt-1 text-body leading-6 text-fg-secondary">{authMessage}</p>
                </div>
              </div>

              {bannerType === 'mileage' ? (
                <button
                  type="button"
                  onClick={goToMileageCharge}
                  className="btn-primary"
                >
                  카카오페이로 충전
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => logout({ redirectTo: '/?login=1' })}
                  className="btn-primary"
                >
                  다시 로그인
                </button>
              )}
            </div>
          </div>
        ) : null}

        {errorMessage ? (
          <div className="mb-5 rounded-2xl border border-line-danger bg-danger-subtle px-4 py-3 text-body text-fg-danger">
            {errorMessage}
          </div>
        ) : null}

        <div
          role="tabpanel"
          id={`${tabsId}-panel-find`}
          aria-labelledby={`${tabsId}-tab-find`}
          hidden={activeTab !== 'find'}
          tabIndex={0}
          className={FOCUS_RING}
        >
          {activeTab === 'find' ? (
            <section>
              <div>
                <h2 className="sr-only">멘토링 프로그램 탐색</h2>
                <div role="group" aria-label="게임 필터" className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 py-1">
                  {[{ code: '', name: '전체' }, ...games].map(({ code, name }) => (
                    <button
                      key={code}
                      type="button"
                      aria-pressed={gameFilter === code}
                      disabled={gamesLoading || Boolean(gamesError)}
                      onClick={() => {
                        setProgramPageNumber(0);
                        setGameFilter(code);
                      }}
                      className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-2 text-label disabled:opacity-50 ${FOCUS_RING} ${
                        gameFilter === code ? 'border-fg-brand bg-brand-subtle text-fg-brand' : 'border-transparent bg-subtle text-fg-secondary hover:text-fg-primary'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                {gamesNotice}

                {programsLoading ? (
                  <ProgramListSkeleton count={4} />
                ) : visiblePrograms.length > 0 ? (
                  <div className={PROGRAM_GRID}>
                    {visiblePrograms.map((program) => (
                      <ProgramCard
                        key={program.id}
                        program={program}
                        game={gameLabel(program.gameName)}
                        rating={formatRatingLabel(mentorStatsById[program.mentorId])}
                        onOpen={() => goToProgramDetail(program)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-card border border-dashed border-line bg-surface p-8 text-center">
                    <p className="font-semibold text-fg-primary">등록된 프로그램이 없습니다.</p>
                    {gameFilter && (
                      <button
                        type="button"
                        onClick={() => {
                          setProgramPageNumber(0);
                          setGameFilter('');
                        }}
                        className="btn-secondary mt-4"
                      >
                        필터 초기화
                      </button>
                    )}
                  </div>
                )}

                {totalPages > 1 ? (
                <div className="mt-5 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setProgramPageNumber((page) => Math.max(page - 1, 0))}
                    disabled={programPageNumber <= 0}
                    className="btn-secondary"
                  >
                    이전
                  </button>
                  <span className="text-label text-fg-tertiary">
                    {programPageNumber + 1} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setProgramPageNumber((page) => Math.min(page + 1, totalPages - 1))}
                    disabled={programPageNumber >= totalPages - 1}
                    className="btn-secondary"
                  >
                    다음
                  </button>
                </div>
                ) : null}
              </div>
            </section>
          ) : null}
        </div>

        <div
          role="tabpanel"
          id={`${tabsId}-panel-mine`}
          aria-labelledby={`${tabsId}-tab-mine`}
          hidden={activeTab !== 'mine'}
          tabIndex={0}
          className={FOCUS_RING}
        >
          {activeTab === 'mine' ? (
            <section className="space-y-6">
              <div className={PROGRAM_GRID}>
                <ApplicationList
                  title="내가 신청한 멘토링"
                  role="mentee"
                  applications={menteeApplications}
                  highlightedApplicationId={highlightedApplicationId}
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
                  highlightedApplicationId={highlightedApplicationId}
                  pendingAction={pendingAction}
                  onChat={(application) => handleOpenChat(application, 'mentor')}
                  onAccept={(id) => runApplicationAction(id, 'accept')}
                  onReject={(id) => runApplicationAction(id, 'reject')}
                  onStart={(id) => runApplicationAction(id, 'start')}
                  onFinish={(id) => runApplicationAction(id, 'finish')}
                />
              </div>

            </section>
          ) : null}
        </div>

        <div
          role="tabpanel"
          id={`${tabsId}-panel-programs`}
          aria-labelledby={`${tabsId}-tab-programs`}
          hidden={activeTab !== 'programs'}
          tabIndex={0}
          className={FOCUS_RING}
        >
          {activeTab === 'programs' ? (
            <section>
              {mentorProfileLoading ? (
                <div className="flex h-64 items-center justify-center rounded-2xl bg-subtle">
                  <Loader2 className="animate-spin text-fg-tertiary" />
                </div>
              ) : mentorProfile ? (
                <div className="space-y-6">
                  <h2 className="flex flex-wrap items-center gap-1 text-heading text-fg-primary">
                    {mentorProfile.nickname}<MembershipBadgeInline active={mentorProfile.membershipBadge} tier={mentorProfile.representativeTier} /> 멘토
                  </h2>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {[
                      ['평점', formatRatingValue(mentorProfile)],
                      ['리뷰', mentorProfile.reviewCount],
                      ['신청한 멘티', mentorProfile.menteeCount],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-card border border-line-card bg-surface p-4">
                        <p className="text-caption text-fg-secondary">{label}</p>
                        <p className="mt-1 text-heading text-fg-primary">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div>
                    <section>
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                        <h2 className="text-heading text-fg-primary">내 프로그램</h2>
                        {mentorProfile.status === 'ACTIVE' ? (
                          <button type="button" onClick={() => changeTab('become')} className="btn-primary">
                            <Plus size={16} /> 프로그램 만들기
                          </button>
                        ) : null}
                      </div>

                      {ownedPrograms.length > 0 ? (
                        <div className={PROGRAM_GRID}>
                          {ownedPrograms.map((program) => (
                            <ProgramCard
                              key={program.id}
                              program={program}
                              game={gameLabel(program.gameName)}
                              owned
                              deleting={pendingAction === `delete-program:${program.id}`}
                              onEdit={() => openEditProgramModal(program)}
                              onDelete={() => void handleDeleteProgram(program)}
                              onOpen={() => goToProgramDetail(program)}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-card border border-dashed border-line bg-surface p-8 text-center">
                          <p className="font-semibold text-fg-primary">아직 만든 프로그램이 없습니다.</p>
                        </div>
                      )}
                    </section>
                  </div>
                </div>
              ) : (
                <section className="rounded-card border border-line-card bg-surface p-6 sm:p-8 text-center">
                  <button
                    type="button"
                    onClick={() => changeTab('become')}
                    className="btn-primary mx-auto"
                  >
                    <Plus size={17} />
                    멘토 되기
                  </button>
                  <p className="mt-5 text-lg font-semibold text-fg-primary">멘토가 되어보세요!</p>
                </section>
              )}
            </section>
          ) : null}
        </div>

        <div
          role="tabpanel"
          id={`${tabsId}-panel-become`}
          aria-labelledby={`${tabsId}-tab-become`}
          hidden={activeTab !== 'become'}
          tabIndex={0}
          className={FOCUS_RING}
        >
          {activeTab === 'become' ? (
            <section>
              {mentorProfileLoading ? (
                <div className="flex h-64 items-center justify-center rounded-2xl bg-subtle">
                  <Loader2 className="animate-spin text-fg-tertiary" />
                </div>
              ) : mentorProfile && mentorProfile.status !== 'ACTIVE' ? (
                <section role="status" className="rounded-card border border-line-card bg-surface p-6 sm:p-8 text-center">
                  <h2 className="text-title text-fg-primary">
                    {mentorProfile.status === 'PENDING_APPROVAL' ? '멘토 승인 대기 중' : '멘토 등록이 반려되었습니다'}
                  </h2>
                  <p className="mt-4 text-body leading-6 text-fg-secondary">
                    {mentorProfile.status === 'PENDING_APPROVAL'
                      ? '관리자 승인이 완료되면 프로그램을 등록할 수 있습니다.'
                      : '멘토 승인이 완료되지 않아 프로그램을 등록할 수 없습니다.'}
                  </p>
                </section>
              ) : mentorProfile ? (
                <section className="rounded-card border border-line-card bg-surface p-4 sm:p-6">
                  <form onSubmit={handleSubmitProgram}>
                    <h2 className="text-title text-fg-primary">프로그램 만들기</h2>

                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="block space-y-2">
                          <span className="text-label text-fg-secondary">게임</span>
                          <select
                            name="gameName"
                            value={programGameCode}
                            disabled={gamesLoading || Boolean(gamesError)}
                            onChange={handleProgramFormChange}
                            className="input-base"
                          >
                            {games.map((game) => (
                              <option key={game.code} value={game.code}>
                                {game.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        {gamesNotice}
                      </div>

                      <label className="space-y-2">
                        <span className="text-label text-fg-secondary">가격</span>
                        <input
                          name="price"
                          value={programForm.price}
                          onChange={handleProgramFormChange}
                          required
                          inputMode="numeric"
                          className="input-base"
                        />
                      </label>
                    </div>

                    <label className="mt-4 block space-y-2">
                      <span className="text-label text-fg-secondary">프로그램 제목</span>
                      <input
                        name="title"
                        value={programForm.title}
                        onChange={handleProgramFormChange}
                        required
                        className="input-base"
                      />
                    </label>

                    <label className="mt-4 block space-y-2">
                      <span className="text-label text-fg-secondary">진행 방식</span>
                      <input
                        name="method"
                        value={programForm.method}
                        onChange={handleProgramFormChange}
                        required
                        className="input-base"
                      />
                    </label>

                    <div className="mt-4 space-y-2">
                      <span className="text-label text-fg-secondary">상세 설명</span>
                      <ProgramContentEditor
                        value={programForm.content}
                        onChange={(content) => setProgramForm((current) => ({ ...current, content }))}
                        onError={showError}
                      />
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <input
                        name="availableTimeDesc"
                        value={programForm.availableTimeDesc}
                        onChange={handleProgramFormChange}
                        placeholder="가능한 시간대"
                        aria-label="가능한 시간대"
                        className="input-base"
                      />
                      <input
                        name="tags"
                        value={programForm.tags}
                        onChange={handleProgramFormChange}
                        placeholder="태그, 쉼표로 구분"
                        aria-label="태그"
                        className="input-base"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={pendingAction === 'save-program' || !gamesReady}
                      className="btn-primary mt-5 w-full"
                    >
                      <Plus size={17} />
                      {pendingAction === 'save-program' ? '저장 중...' : '프로그램 등록'}
                    </button>
                  </form>
                </section>
              ) : (
                <div className="space-y-5">
                  <div className="rounded-card bg-brand-subtle p-5 lg:p-7">
                    <h2 className="text-title text-fg-primary">멘토가 되어보세요</h2>
                    <p className="mt-2 text-body text-fg-secondary">게임 실력과 경험을 나누고 마일리지로 정산받을 수 있어요. 관리자 승인 후 프로그램을 등록할 수 있습니다.</p>
                  </div>
                  <form onSubmit={handleRegisterMentor} className="rounded-card border border-line-card bg-surface p-4 sm:p-6">
                    <h2 className="text-heading text-fg-primary">멘토 등록 요청</h2>
                    <label className="mt-2 block space-y-2">
                      <span className="text-label text-fg-secondary">자기소개</span>
                      <textarea
                        value={mentorAbout}
                        onChange={(event) => setMentorAbout(event.target.value)}
                        required
                        rows={5}
                        placeholder="멘토링 경험, 전문 분야, 멘티에게 전하고 싶은 메시지를 적어 주세요."
                        className="input-base h-auto resize-y py-3"
                      />
                    </label>
                    <div className="mt-4 flex justify-end">
                      <button type="submit" disabled={pendingAction === 'register-mentor'} className="btn-primary">
                        {pendingAction === 'register-mentor' ? '등록 중...' : '등록 요청'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </section>
          ) : null}
        </div>
        </div>

        {detailPageMode && !detailLoading && !selectedProgram ? (
          <p className="rounded-control bg-subtle p-6 text-center text-body text-fg-tertiary">
            {errorMessage || '프로그램 정보를 불러오지 못했습니다.'}
          </p>
        ) : null}

        {detailLoading || selectedProgram ? (
          <MentoringDialog
            label={selectedProgram?.title ?? '프로그램 상세'}
            width="lg:max-w-[560px]"
            onBackdropClick={detailLoading ? undefined : exitProgramDetail}
            active={!showMileageShortageModal && !programReportOpen}
            inline={detailPageMode}
          >
            {detailLoading || !selectedProgram ? (
              <div className={detailPageMode ? 'flex h-64 items-center justify-center rounded-card border border-line-card bg-surface' : 'flex h-64 items-center justify-center'}>
                <Loader2 className="animate-spin text-fg-tertiary" />
              </div>
            ) : (
              <div className={detailPageMode ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-5' : undefined}>
                <div className={detailPageMode ? 'min-w-0 rounded-card border border-line-card bg-surface p-4 lg:p-6' : undefined}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="inline-block rounded-sm bg-subtle px-2 py-0.5 text-caption text-fg-secondary">
                      {gameLabel(selectedProgram.gameName)}
                    </p>
                    <h2 className="mt-3 break-words text-title text-fg-primary">{selectedProgram.title}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={exitProgramDetail}
                    aria-label="프로그램 상세 닫기"
                    className="btn-icon"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="mt-4">
                  <p className="flex flex-wrap items-center gap-2 text-label text-fg-primary">
                    <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-subtle text-caption text-fg-secondary">{getInitials(programMentorName(selectedProgram))}</span>
                    {programMentorName(selectedProgram)}
                    <MembershipBadgeInline active={selectedProgram.membershipBadge} tier={selectedProgram.representativeTier} />
                  </p>

                  <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="rounded-control bg-subtle p-3">
                      <p className="text-lg font-semibold text-fg-primary">{formatRatingValue(selectedMentorStats)}</p>
                      <p className="text-caption text-fg-secondary">평점</p>
                    </div>
                    <div className="rounded-control bg-subtle p-3">
                      <p className="text-lg font-semibold text-fg-primary">{selectedMentorStats?.reviewCount ?? 0}</p>
                      <p className="text-caption text-fg-secondary">리뷰</p>
                    </div>
                    <div className="rounded-control bg-subtle p-3">
                      <p className="text-lg font-semibold text-fg-primary">{selectedMentorStats?.menteeCount ?? 0}</p>
                      <p className="text-caption text-fg-secondary">신청한 멘티</p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 break-words text-body text-fg-primary">
                  <p className="mb-1 text-label text-fg-secondary">진행 방식</p>
                  <p>{[selectedProgram.availableTimeDesc, selectedProgramContent.method].filter(Boolean).join(' · ') || '추후 협의'}</p>
                  <p className="mt-4 mb-1 text-label text-fg-secondary">상세 설명</p>
                  <ProgramDescription content={selectedProgramContent.content} />
                </div>

                <div className="mt-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-label text-fg-secondary">멘티 리뷰</h3>
                    </div>
                    <span className="text-label text-fg-tertiary">총 {selectedProgramReviews.length}개</span>
                  </div>

                  {selectedProgramReviewsLoading ? (
                    <div className="mt-5 flex h-40 items-center justify-center rounded-2xl bg-subtle">
                      <Loader2 className="animate-spin text-fg-tertiary" />
                    </div>
                  ) : selectedProgramReviews.length > 0 ? (
                    <div className="mt-5 space-y-3">
                      {selectedProgramReviews.map((review) => (
                        <article key={review.id} className="rounded-xl border border-line-card p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="flex items-center gap-1 font-semibold text-fg-primary">{review.menteeNickname}<MembershipBadge active={review.membershipBadge} /><RepresentativeTierBadge tier={review.representativeTier} /></p>
                              <p className="mt-1 text-caption text-fg-secondary">
                                {formatDateTime(review.createdAt)}
                              </p>
                            </div>
                            <span className="rounded-full bg-brand-subtle px-3 py-1 text-caption text-fg-brand">
                              {review.rating.toFixed(1)}
                            </span>
                          </div>
                          <p className="mt-3 text-body leading-6 text-fg-secondary">{review.content}</p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-5 rounded-control bg-subtle p-6 text-center text-body text-fg-tertiary">
                      아직 등록된 멘티 리뷰가 없습니다.
                    </p>
                  )}
                </div>

                {!currentUserOwnsProgram(selectedProgram.mentorId) ? (
                  <button
                    ref={programReportButtonRef}
                    type="button"
                    onClick={() => { if (requireAuth('신고하려면 로그인이 필요해요.')) setProgramReportOpen(true); }}
                    className="mt-5 inline-flex items-center gap-1.5 text-caption text-fg-secondary hover:text-fg-danger"
                  >
                    <Flag size={13} />
                    프로그램 신고
                  </button>
                ) : null}
                {programReportOpen ? (
                  <ReportContentModal
                    targetType="MENTORING"
                    targetId={selectedProgram.id}
                    title="멘토링 프로그램 신고"
                    author={selectedProgram.mentorNickname}
                    authorHandle=""
                    content={selectedProgram.title}
                    emptyContentLabel="제목 없음"
                    onClose={closeProgramReport}
                  />
                ) : null}
                </div>

                <aside className={detailPageMode ? 'mt-5 rounded-card border border-line-card bg-surface p-4 lg:sticky lg:top-6 lg:mt-0 lg:p-5' : 'mt-5'}>
                  {detailPageMode ? (
                    <div className="mb-4 border-b border-line pb-4">
                      <span className="inline-block rounded-sm bg-subtle px-2 py-0.5 text-caption text-fg-secondary">
                        {gameLabel(selectedProgram.gameName)}
                      </span>
                      <p className="mt-2 break-words text-heading text-fg-primary">{selectedProgram.title}</p>
                      <p className="mt-2 flex items-center gap-1.5 text-caption text-fg-secondary">
                        <Star size={14} className="text-fg-brand" />
                        <span>{formatRatingValue(selectedMentorStats)}</span>
                        <span>({selectedMentorStats?.reviewCount ?? 0})</span>
                        <span>· 멘티 {selectedMentorStats?.menteeCount ?? 0}명</span>
                      </p>
                      <p className="mt-3 text-title text-fg-primary">{formatMileage(selectedProgram.price)}</p>
                    </div>
                  ) : null}

                  {currentUserOwnsProgram(selectedProgram.mentorId) ? (
                    <p className="rounded-control bg-subtle p-4 text-label text-fg-secondary">
                      내가 등록한 프로그램입니다.
                    </p>
                  ) : null}
                  {currentUserOwnsProgram(selectedProgram.mentorId) ? (
                    <div className="mt-3 space-y-3">
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-line-card p-4">
                        <div>
                          <p className="text-label text-fg-primary">프로그램 수정</p>
                          <p className="mt-1 text-caption text-fg-secondary">
                            제목, 가격, 진행 방식, 상세 설명을 수정할 수 있습니다.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openEditProgramModal(selectedProgram)}
                          disabled={pendingAction === `edit-program:${selectedProgram.id}`}
                          className="rounded-lg bg-subtle p-3 text-fg-secondary disabled:opacity-40"
                          aria-label="프로그램 수정"
                        >
                          <Pencil size={16} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-line-card p-4">
                        <div>
                          <p className="text-label text-fg-primary">프로그램 마감</p>
                          <p className="mt-1 text-caption text-fg-secondary">
                            더 이상 운영하지 않을 프로그램은 새 신청을 받지 않도록 마감할 수 있습니다.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            await handleCloseProgram(selectedProgram);
                            if (detailPageMode) void openProgramDetailRef.current(selectedProgram.id);
                          }}
                          disabled={selectedProgram.status !== 'ACTIVE' || pendingAction === `close-program:${selectedProgram.id}`}
                          className="rounded-lg bg-subtle p-3 text-fg-secondary disabled:opacity-40"
                          aria-label={selectedProgram.status === 'ACTIVE' ? '프로그램 마감' : '이미 마감된 프로그램'}
                        >
                          <Clock3 size={16} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-line-card p-4">
                        <div>
                          <p className="text-label text-fg-primary">프로그램 삭제</p>
                          <p className="mt-1 text-caption text-fg-secondary">
                            진행 중인 멘토링이 없는 프로그램은 삭제할 수 있습니다.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleDeleteProgram(selectedProgram)}
                          disabled={pendingAction === `delete-program:${selectedProgram.id}`}
                          className="rounded-lg bg-subtle p-3 text-fg-danger disabled:opacity-40"
                          aria-label="프로그램 삭제"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ) : selectedProgramApplication ? (
                    <div className="rounded-xl border border-line bg-success-subtle p-4">
                      <p className="text-label text-fg-primary">이미 신청한 프로그램</p>
                      <p className="mt-2 text-caption leading-5 text-fg-secondary">
                        이미 이 멘토링을 신청했습니다. 내 멘토링 탭에서 진행 상태를 확인해 주세요.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-caption text-fg-secondary">
                        <span>상태: {statusLabel[selectedProgramApplication.status] ?? selectedProgramApplication.status}</span>
                        <span>결제: {paymentLabel[selectedProgramApplication.paymentStatus] ?? selectedProgramApplication.paymentStatus}</span>
                      </div>
                    </div>
                  ) : selectedProgram.status !== 'ACTIVE' ? (
                    <div className="rounded-xl border border-line bg-subtle p-4">
                      <p className="text-label text-fg-secondary">마감된 프로그램</p>
                      <p className="mt-2 text-caption leading-5 text-fg-secondary">
                        이 프로그램은 현재 새 신청을 받지 않습니다. 다른 모집 중 프로그램을 선택해 주세요.
                      </p>
                    </div>
                  ) : !user ? (
                    <button
                      type="button"
                      className="btn-primary w-full"
                      onClick={() => requireAuth('멘토링을 신청하려면 로그인이 필요해요.', { returnTo: `/mentoring/programs/${selectedProgram.publicNo ?? encodeURIComponent(selectedProgram.id)}` })}
                    >
                      로그인하고 신청하기
                    </button>
                  ) : (
                    <form onSubmit={handleApplyProgram}>
                      <div className="mb-4 rounded-xl bg-brand-subtle p-4 text-caption text-fg-secondary">
                        신청 시 프로그램 가격만큼의 마일리지가 멘토링 완료 전까지 보류됩니다.
                      </div>

                      <label className="block space-y-2">
                        <span className="text-label text-fg-secondary">멘토에게 보낼 메시지</span>
                        <textarea
                          value={applicationMessage}
                          onChange={(event) => setApplicationMessage(event.target.value)}
                          required
                          rows={4}
                          placeholder="원하는 멘토링 방향이나 현재 고민을 적어 주세요."
                          className="input-base h-auto resize-y py-3"
                        />
                      </label>

                      {detailPageMode ? (
                        <div className="mt-4 flex flex-col gap-2">
                          <button type="submit" disabled={pendingAction === `apply:${selectedProgram.id}`} className="btn-primary w-full">
                            {pendingAction === `apply:${selectedProgram.id}` ? '신청 중...' : '신청하고 결제하기'}
                          </button>
                          <button type="button" onClick={exitProgramDetail} className="btn-secondary w-full">취소</button>
                        </div>
                      ) : (
                        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                          <div>
                            <p className="text-caption text-fg-secondary">신청 금액</p>
                            <p className="text-heading text-fg-primary">{formatMileage(selectedProgram.price)}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={exitProgramDetail} className="btn-secondary">취소</button>
                            <button type="submit" disabled={pendingAction === `apply:${selectedProgram.id}`} className="btn-primary">
                              {pendingAction === `apply:${selectedProgram.id}` ? '신청 중...' : '신청하고 결제하기'}
                            </button>
                          </div>
                        </div>
                      )}
                    </form>
                  )}
                </aside>
              </div>
            )}
          </MentoringDialog>
        ) : null}

        {showMileageShortageModal ? (
          <MentoringDialog label="마일리지가 부족합니다" width="lg:max-w-md" onBackdropClick={() => setShowMileageShortageModal(false)}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-subtle text-fg-brand">
                  <AlertCircle size={22} />
                </div>
                <div>
                  <p id="mileage-shortage-title" className="text-heading text-fg-primary">
                    마일리지가 부족합니다
                  </p>
                  <p className="mt-2 text-body leading-6 text-fg-secondary">
                    현재 보유 마일리지로는 이 프로그램을 신청할 수 없습니다. 카카오페이로 충전 후 다시 신청해 주세요.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMileageShortageModal(false)}
                className="btn-icon"
                aria-label="닫기"
              >
                <X size={16} />
              </button>
            </div>

            {selectedProgram ? (
              <div className="mt-5 rounded-2xl bg-subtle p-4">
                <p className="text-caption text-fg-secondary">신청 금액</p>
                <p className="mt-1 text-title text-fg-primary">{formatMileage(selectedProgram.price)}</p>
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setShowMileageShortageModal(false)}
                className="btn-secondary flex-1"
              >
                나중에 충전
              </button>
              <button
                type="button"
                onClick={goToMileageCharge}
                className="btn-primary flex-1"
              >
                <Wallet size={16} />
                카카오페이로 충전
              </button>
            </div>
          </MentoringDialog>
        ) : null}

        {selectedOwnedProgram ? (
          <MentoringDialog label={selectedOwnedProgram.title} width="lg:max-w-[560px]" onBackdropClick={() => setSelectedOwnedProgramId(null)}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-caption text-fg-secondary">
                  {gameLabel(selectedOwnedProgram.gameName)}
                </p>
                <h2 className="mt-1 text-title text-fg-primary">{selectedOwnedProgram.title}</h2>
                <p className="mt-2 text-body text-fg-secondary">{formatMileage(selectedOwnedProgram.price)}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOwnedProgramId(null)}
                aria-label="내 프로그램 상세 닫기"
                className="btn-icon"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-control bg-subtle p-4">
                <p className="flex items-center gap-2 text-label text-fg-primary">
                  <Star size={16} className="text-fg-brand" />
                  평균 평점
                </p>
                <p className="mt-2 text-title text-fg-primary">{formatRatingValue(mentorProfile)}</p>
              </div>
              <div className="rounded-control bg-subtle p-4">
                <p className="text-label text-fg-primary">리뷰 수</p>
                <p className="mt-2 text-title text-fg-primary">{mentorProfile?.reviewCount ?? 0}</p>
              </div>
            </div>

            <div className="mt-5 rounded-control bg-subtle p-4 text-body leading-6 text-fg-secondary">
              <p className="font-semibold text-fg-primary">진행 방식</p>
              <p>{splitProgramContent(selectedOwnedProgram.content).method || '추후 협의'}</p>
              <p className="mt-4 font-semibold text-fg-primary">상세 설명</p>
              <ProgramDescription content={splitProgramContent(selectedOwnedProgram.content).content} />
            </div>

            <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-line-card p-4">
              <div>
                <p className="text-label text-fg-primary">프로그램 수정</p>
                <p className="mt-1 text-caption text-fg-secondary">
                  제목, 가격, 진행 방식, 상세 설명을 수정할 수 있습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openEditProgramModal(selectedOwnedProgram)}
                disabled={pendingAction === `edit-program:${selectedOwnedProgram.id}`}
                className="rounded-lg bg-subtle p-3 text-fg-secondary disabled:opacity-40"
                aria-label="프로그램 수정"
              >
                <Pencil size={16} />
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-line-card p-4">
              <div>
                <p className="text-label text-fg-primary">프로그램 마감</p>
                <p className="mt-1 text-caption text-fg-secondary">
                  더 이상 운영하지 않을 프로그램은 새 신청을 받지 않도록 마감할 수 있습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleCloseProgram(selectedOwnedProgram)}
                disabled={
                  selectedOwnedProgram.status !== 'ACTIVE' ||
                  pendingAction === `close-program:${selectedOwnedProgram.id}`
                }
                className="rounded-lg bg-subtle p-3 text-fg-secondary disabled:opacity-40"
                aria-label={selectedOwnedProgram.status === 'ACTIVE' ? '프로그램 마감' : '이미 마감된 프로그램'}
              >
                <Clock3 size={16} />
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-line-card p-4">
              <div>
                <p className="text-label text-fg-primary">프로그램 삭제</p>
                <p className="mt-1 text-caption text-fg-secondary">
                  진행 중인 멘토링이 없는 프로그램은 삭제할 수 있습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleDeleteProgram(selectedOwnedProgram)}
                disabled={pendingAction === `delete-program:${selectedOwnedProgram.id}`}
                className="rounded-lg bg-subtle p-3 text-fg-danger disabled:opacity-40"
                aria-label="프로그램 삭제"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-caption text-fg-secondary">리뷰</p>
                  <h3 className="mt-1 text-title text-fg-primary">멘티 리뷰</h3>
                </div>
                <span className="text-label text-fg-tertiary">총 {mentorReviews.length.toLocaleString()}개</span>
              </div>

              {mentorReviewsLoading ? (
                <div className="mt-5 flex h-40 items-center justify-center rounded-2xl bg-subtle">
                  <Loader2 className="animate-spin text-fg-tertiary" />
                </div>
              ) : mentorReviews.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {mentorReviews.map((review) => (
                    <article
                      key={review.id}
                      id={deepLinkElementId('review', review.id)}
                      className={`rounded-xl border p-4 transition-colors ${
                        highlightedReviewId === review.id
                          ? 'border-fg-brand bg-brand-subtle ring-2 ring-line-focus'
                          : 'border-line-card bg-surface'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="flex items-center gap-1 font-semibold text-fg-primary">{review.menteeNickname}<MembershipBadge active={review.membershipBadge} /><RepresentativeTierBadge tier={review.representativeTier} /></p>
                          <p className="mt-1 text-caption text-fg-secondary">
                            {formatDateTime(review.createdAt)}
                          </p>
                        </div>
                        <span className="rounded-full bg-brand-subtle px-3 py-1 text-caption text-fg-brand">
                          {review.rating.toFixed(1)}
                        </span>
                      </div>
                      <p className="mt-2 text-caption text-fg-secondary">{review.programTitle}</p>
                      <p className="mt-3 text-body leading-6 text-fg-secondary">{review.content}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mt-5 rounded-control bg-subtle p-6 text-center text-body text-fg-tertiary">
                  아직 등록된 리뷰가 없습니다.
                </p>
              )}
            </div>
          </MentoringDialog>
        ) : null}

        {editingProgram ? (
          <MentoringDialog label="프로그램 수정" width="lg:max-w-[640px]" onBackdropClick={closeEditProgramModal}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-caption text-fg-secondary">{gameLabel(editingProgram.gameName)}</p>
                <h2 className="mt-1 text-title text-fg-primary">프로그램 수정</h2>
              </div>
              <button
                type="button"
                onClick={closeEditProgramModal}
                aria-label="프로그램 수정 닫기"
                disabled={pendingAction === `edit-program:${editingProgram.id}`}
                className="btn-icon"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitEditProgram} className="mt-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-label text-fg-secondary">게임</span>
                  <input
                    value={gameLabel(editingProgram.gameName)}
                    disabled
                    className="input-base opacity-60"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-label text-fg-secondary">가격</span>
                  <input
                    name="price"
                    value={editProgramForm.price}
                    onChange={handleEditProgramFormChange}
                    required
                    inputMode="numeric"
                    className="input-base"
                  />
                </label>
              </div>

              <label className="mt-4 block space-y-2">
                <span className="text-label text-fg-secondary">프로그램 제목</span>
                <input
                  name="title"
                  value={editProgramForm.title}
                  onChange={handleEditProgramFormChange}
                  required
                  className="input-base"
                />
              </label>

              <label className="mt-4 block space-y-2">
                <span className="text-label text-fg-secondary">진행 방식</span>
                <input
                  name="method"
                  value={editProgramForm.method}
                  onChange={handleEditProgramFormChange}
                  required
                  className="input-base"
                />
              </label>

              <div className="mt-4 space-y-2">
                <span className="text-label text-fg-secondary">상세 설명</span>
                <ProgramContentEditor
                  value={editProgramForm.content}
                  onChange={(content) => setEditProgramForm((current) => ({ ...current, content }))}
                  onError={showError}
                />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <input
                  name="availableTimeDesc"
                  value={editProgramForm.availableTimeDesc}
                  onChange={handleEditProgramFormChange}
                  placeholder="가능한 시간대"
                  aria-label="가능한 시간대"
                  className="input-base"
                />
                <input
                  name="tags"
                  value={editProgramForm.tags}
                  onChange={handleEditProgramFormChange}
                  placeholder="태그, 쉼표로 구분"
                  aria-label="태그"
                  className="input-base"
                />
              </div>

              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeEditProgramModal}
                  disabled={pendingAction === `edit-program:${editingProgram.id}`}
                  className="btn-secondary"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={pendingAction === `edit-program:${editingProgram.id}`}
                  className="btn-primary"
                >
                  {pendingAction === `edit-program:${editingProgram.id}` ? '저장 중...' : '수정 저장'}
                </button>
              </div>
            </form>
          </MentoringDialog>
        ) : null}

        {reviewTarget ? (
          <MentoringDialog label="리뷰 작성" width="lg:max-w-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-caption text-fg-secondary">리뷰</p>
                <h2 className="mt-1 text-title text-fg-primary">리뷰 작성</h2>
                <p className="mt-2 text-body text-fg-secondary">
                  {reviewTarget.programTitle}에 대한 평점과 리뷰를 남겨 주세요.
                </p>
              </div>
              <button
                type="button"
                onClick={closeReviewModal}
                aria-label="리뷰 작성 닫기"
                disabled={pendingAction === `review:${reviewTarget.id}`}
                className="btn-icon"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitReview} className="mt-6">
              <div>
                <p className="text-label text-fg-secondary">평점</p>
                <div
                  role="radiogroup"
                  aria-label="평점"
                  className="mt-3 flex flex-wrap items-center gap-2"
                  onKeyDown={(event) => {
                    const radios = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
                    const index = radios.findIndex((radio) => radio === event.target);
                    if (index === -1) return;
                    let nextIndex: number;
                    switch (event.key) {
                      case 'ArrowLeft': case 'ArrowUp': nextIndex = (index + radios.length - 1) % radios.length; break;
                      case 'ArrowRight': case 'ArrowDown': nextIndex = (index + 1) % radios.length; break;
                      case 'Home': nextIndex = 0; break;
                      case 'End': nextIndex = radios.length - 1; break;
                      default: return;
                    }
                    event.preventDefault();
                    setReviewRating(nextIndex + 1);
                    radios[nextIndex].focus();
                  }}
                >
                  {[1, 2, 3, 4, 5].map((value) => {
                    const active = value <= reviewRating;

                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        onClick={() => setReviewRating(value)}
                        aria-label={`${value}점`}
                        aria-checked={value === reviewRating}
                        tabIndex={value === reviewRating ? 0 : -1}
                        className={`rounded-full p-2 transition ${FOCUS_RING} ${
                          active ? 'bg-brand-subtle text-fg-brand' : 'bg-subtle text-fg-tertiary'
                        }`}
                      >
                        <Star size={18} fill={active ? 'currentColor' : 'none'} />
                      </button>
                    );
                  })}
                  <span className="ml-2 text-label text-fg-secondary">{reviewRating} / 5</span>
                </div>
              </div>

              <label className="mt-6 block">
                <span className="text-label text-fg-secondary">리뷰</span>
                <textarea
                  value={reviewContent}
                  onChange={(event) => setReviewContent(event.target.value)}
                  rows={5}
                  maxLength={500}
                  placeholder="멘토링이 어땠는지 자세히 적어 주세요."
                  className="input-base mt-3 h-auto resize-y py-3"
                />
              </label>

              <div className="mt-2 text-right text-caption text-fg-secondary">
                {reviewContent.trim().length} / 500
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeReviewModal}
                  disabled={pendingAction === `review:${reviewTarget.id}`}
                  className="btn-secondary"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={pendingAction === `review:${reviewTarget.id}`}
                  className="btn-primary"
                >
                  {pendingAction === `review:${reviewTarget.id}` ? '등록 중...' : '리뷰 등록'}
                </button>
              </div>
            </form>
          </MentoringDialog>
        ) : null}
      </div>
    </div>
  );
}

function MentoringDialog({ label, width, onBackdropClick, active = true, inline = false, children }: {
  label: string;
  width: string;
  onBackdropClick?: () => void;
  active?: boolean;
  /** true면 모달 오버레이 없이 페이지 본문에 그대로 렌더링한다. */
  inline?: boolean;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trigger = document.activeElement;
    panel.current?.focus();
    return () => {
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);

  return (
    <div className={inline ? undefined : DIALOG_BACKDROP} onClick={inline ? undefined : onBackdropClick}>
      <div
        ref={panel}
        role={inline ? undefined : 'dialog'}
        aria-modal={inline ? undefined : active || undefined}
        aria-label={label}
        tabIndex={-1}
        className={inline ? 'relative' : `${DIALOG_PANEL} ${width}`}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (!active || event.key !== 'Tab') return;
          const controls = event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled)',
          );
          const first = controls[0];
          const last = controls[controls.length - 1];
          const focused = document.activeElement;
          if (!first || focused === event.currentTarget || focused === (event.shiftKey ? first : last)) {
            event.preventDefault();
            (event.shiftKey ? last : first)?.focus();
          }
        }}
      >
        <div aria-hidden="true" className="absolute left-1/2 top-2.5 h-1 w-10 -translate-x-1/2 rounded-full bg-line-strong lg:hidden" />
        {children}
      </div>
    </div>
  );
}

function ProgramCard({ program, game, rating, owned, deleting, onEdit, onDelete, onOpen }: {
  program: MentoringProgramResponse;
  game: string;
  rating?: string;
  owned?: boolean;
  deleting?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onOpen: () => void;
}) {
  const mentor = programMentorName(program);
  const { method, content } = splitProgramContent(program.content);
  const description = [program.availableTimeDesc, method || stripProgramImages(content)].filter(Boolean).join(' · ');
  const thumbnail = firstProgramImage(content);

  return (
    <div className="relative flex min-w-0 flex-col">
      <button
        type="button"
        onClick={onOpen}
        className={`flex min-w-0 flex-1 flex-col rounded-card border border-line-card bg-surface p-4 text-left transition hover:border-line-strong sm:p-5 ${FOCUS_RING}`}
      >
        {thumbnail ? (
          <span className="-mx-4 -mt-4 mb-3 block aspect-video overflow-hidden rounded-t-card bg-subtle sm:-mx-5 sm:-mt-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={toAbsoluteAssetUrl(thumbnail) ?? thumbnail} alt="" loading="lazy" className="size-full object-cover" />
          </span>
        ) : (
          // 이미지가 없으면 기본 썸네일(게임 아이콘)을 보여 목록 카드 높이를 맞춘다.
          <span aria-hidden="true" className="-mx-4 -mt-4 mb-3 flex aspect-video flex-col items-center justify-center gap-2 overflow-hidden rounded-t-card bg-gradient-to-br from-subtle to-surface text-fg-tertiary sm:-mx-5 sm:-mt-5">
            <Gamepad2 size={40} strokeWidth={1.5} />
          </span>
        )}
        <span className="flex w-full flex-wrap items-baseline justify-between gap-2 text-caption text-fg-secondary">
          <span className="rounded-sm bg-subtle px-2 py-0.5">{game}</span>
          {rating ? <span>{rating}</span> : null}
          {!owned && program.status !== 'ACTIVE' ? <span>마감</span> : null}
        </span>
        <span className="mt-3 block w-full break-words text-heading text-fg-primary">{program.title}</span>
        <span className="mt-3 mb-3 line-clamp-2 break-words text-caption text-fg-secondary">{description || '시간 협의 가능'}</span>
        <span className="mt-auto flex w-full flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-label text-fg-primary">
          {owned ? (
            <span className={program.status === 'ACTIVE' ? 'text-fg-brand' : 'text-fg-secondary'}>
              {program.status === 'ACTIVE' ? '모집 중' : '마감'}
            </span>
          ) : (
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-subtle text-caption text-fg-secondary">{getInitials(mentor)}</span>
              <span className="min-w-0 break-words">{mentor}</span>
              <MembershipBadgeInline active={program.membershipBadge} tier={program.representativeTier} />
            </span>
          )}
          <span className="shrink-0 tabular-nums">{formatMileage(program.price)}</span>
        </span>
      </button>
      {owned && (onEdit || onDelete) ? (
        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          {onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              aria-label={`${program.title} 프로그램 수정`}
              className={`grid size-8 place-items-center rounded-full bg-black/60 text-white transition hover:bg-black/80 ${FOCUS_RING}`}
            >
              <Pencil size={14} />
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              aria-label={`${program.title} 프로그램 삭제`}
              className={`grid size-8 place-items-center rounded-full bg-black/60 text-white transition hover:bg-danger disabled:opacity-40 ${FOCUS_RING}`}
            >
              <Trash2 size={15} />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ApplicationList({
  title,
  role,
  applications,
  highlightedApplicationId,
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
  highlightedApplicationId: string | null;
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
    <section className="min-w-0">
      <h2 className="text-heading text-fg-primary">{title}</h2>
      <div className="mt-3 space-y-3">
        {applications.length > 0 ? (
          applications.map((application) => (
            <ApplicationCard
              key={application.id}
              application={application}
              role={role}
              highlighted={highlightedApplicationId === application.id}
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
          <p className="rounded-control bg-subtle p-6 text-center text-body text-fg-tertiary">
            표시할 요청 내역이 없습니다.
          </p>
        )}
      </div>
    </section>
  );
}

function ApplicationCard({
  application,
  role,
  highlighted,
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
  highlighted: boolean;
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
  const [reportOpen, setReportOpen] = useState(false);
  const actionPending = pendingAction.endsWith(`:${application.id}`);
  const guide = applicationGuide(role, application.status, application.paymentStatus);
  const chatEnabled = canOpenMentoringChat(application.status);

  return (
    <article
      id={deepLinkElementId('application', application.id)}
      className={`min-w-0 rounded-card border p-4 transition-colors sm:p-5 ${
        highlighted
          ? 'border-fg-brand bg-brand-subtle ring-2 ring-line-focus'
          : 'border-line-card bg-surface'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-2">
          <span className="rounded-sm bg-subtle px-2 py-0.5 text-caption text-fg-secondary">
            {statusLabel[application.status] ?? application.status}
          </span>
          <span className="break-words text-caption text-fg-secondary">
            {role === 'mentor' ? '멘티' : '멘토'} {role === 'mentor' ? application.menteeNickname : application.mentorNickname}
            <MembershipBadgeInline
              active={role === 'mentor' ? application.menteeMembershipBadge : application.mentorMembershipBadge}
              tier={role === 'mentor' ? application.menteeRepresentativeTier : application.mentorRepresentativeTier}
            />
          </span>
        </div>
        <span className="shrink-0 text-label text-fg-primary">{formatMileage(application.appliedMileage)}</span>
      </div>
      <h3 className="mt-3 break-words text-heading text-fg-primary">{application.programTitle}</h3>
      <p className="mt-2 whitespace-pre-wrap break-words text-body text-fg-secondary">{application.message}</p>
      <p className="mt-2 text-caption text-fg-secondary">결제: {paymentLabel[application.paymentStatus] ?? application.paymentStatus}</p>

      {role === 'mentor' && application.feeRateBp != null && application.feeAmount != null ? (
        <p className="mt-2 text-caption text-fg-secondary">
          {formatMileage(application.appliedMileage)} 중 수수료 {formatMileage(application.feeAmount)}({application.feeRateBp / 100}%) · 수령{' '}
          {formatMileage(application.payoutAmount ?? application.appliedMileage - application.feeAmount)}
        </p>
      ) : null}
      {role === 'mentor' && application.nonMemberNotice ? (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-caption text-fg-secondary">
          {application.feeNotice || '멤버십이면 수수료 5%'}
          <Link href="/membership" className="font-semibold text-fg-brand underline underline-offset-2">
            멤버십 보기
          </Link>
        </p>
      ) : null}

      {guide ? <p className="mt-4 rounded-xl bg-brand-subtle p-3 text-caption text-fg-secondary">{guide}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onChat}
          disabled={actionPending || !chatEnabled}
          title={chatEnabled ? '채팅 시작' : '멘토가 신청을 수락한 뒤에만 채팅할 수 있습니다.'}
          className="btn-secondary"
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
              className="btn-primary"
            >
              <Check size={14} />
              수락
            </button>
            <button
              type="button"
              onClick={onReject}
              disabled={actionPending}
              className="btn-secondary text-fg-danger"
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
            className="btn-secondary text-fg-danger"
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
            className="btn-primary"
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
            className="btn-primary"
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
            className="btn-primary"
          >
            <CreditCard size={14} />
            완료 확정
          </button>
        ) : null}

        {role === 'mentee' && (application.status === 'ONGOING' || application.status === 'FINISHED') ? (
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="btn-secondary text-fg-danger"
          >
            <Flag size={14} />
            이의제기
          </button>
        ) : null}

        {role === 'mentee' && application.status === 'COMPLETED' && !application.reviewed ? (
          <button
            type="button"
            onClick={onReview}
            disabled={actionPending}
            className="btn-secondary"
          >
            <Star size={14} />
            리뷰 작성
          </button>
        ) : null}

        {role === 'mentee' && application.status === 'COMPLETED' && application.reviewed ? (
          <button
            type="button"
            onClick={onReviewedClick}
            className="btn-secondary"
            title={REVIEW_ALREADY_COMPLETED_MESSAGE}
          >
            <Check size={14} />
            리뷰 작성 완료
          </button>
        ) : null}
      </div>
      {reportOpen ? (
        <ReportContentModal
          targetType="MENTORING"
          targetId={application.id}
          title="멘토링 이의제기"
          author={application.mentorNickname}
          authorHandle=""
          content={application.programTitle}
          emptyContentLabel="제목 없음"
          onClose={() => setReportOpen(false)}
        />
      ) : null}
    </article>
  );
}
