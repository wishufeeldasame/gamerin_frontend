'use client';

import { ArrowLeft, ArrowRight, ArrowUpRight, BarChart3, ChevronLeft, Crown, Gamepad2, Newspaper, Sparkles, Target } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { ApiError } from '@/lib/api-client';
import { canGoBack } from '@/lib/history-back';
import { requestLogin } from '@/lib/login-prompt';
import { MEMBERSHIP_CONTENT, type WeeklyGameReport } from '@/lib/membership-content';
import { fetchMyWeeklyReport } from '@/lib/membership-api';

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg-brand dark:focus-visible:outline-line-focus';

const formatDate = (date: string) => date.slice(5).replace('-', '.');

function StatChange({ current, previous, unit }: { current: number | null; previous: number | null; unit: string }) {
  if (current === null || previous === null) return <span className="text-fg-tertiary">비교 없음</span>;
  const difference = Number((current - previous).toFixed(1));
  if (difference === 0) return <span className="text-fg-tertiary">동일</span>;
  return (
    <span className={unit === '경기' ? 'text-fg-secondary' : difference > 0 ? 'text-fg-success' : 'text-fg-danger'}>
      {difference > 0 ? '+' : ''}{difference}{unit}
    </span>
  );
}

export default function MembershipContentPage() {
  const router = useRouter();
  const preview = usePathname() === '/membership/content-preview';
  const { user, isAuthReady } = useAuth();
  const userId = user?.id;
  const { patchNotes } = MEMBERSHIP_CONTENT;
  const [loaded, setLoaded] = useState<{ userId: string; report: WeeklyGameReport } | null>(null);
  const [loadError, setLoadError] = useState<{ userId: string; message: string; forbidden: boolean } | null>(null);
  const [reload, setReload] = useState(0);
  const weeklyReport = preview ? MEMBERSHIP_CONTENT.weeklyReport : loaded && loaded.userId === userId ? loaded.report : null;
  const error = loadError?.userId === userId ? loadError : null;

  useEffect(() => {
    if (preview || !isAuthReady || !userId) return;
    const controller = new AbortController();
    setLoaded(null);
    setLoadError(null);
    fetchMyWeeklyReport(controller.signal)
      .then((report) => {
        if (!controller.signal.aborted) setLoaded({ userId, report });
      })
      .catch((failure: unknown) => {
        if (controller.signal.aborted || (failure instanceof Error && failure.name === 'AbortError')) return;
        setLoadError({
          userId,
          message: failure instanceof Error ? failure.message : '주간 리포트를 불러오지 못했습니다.',
          forbidden: failure instanceof ApiError && failure.status === 403,
        });
      });
    return () => controller.abort();
  }, [preview, isAuthReady, userId, reload]);

  return (
    <>
      <header className="sticky top-0 z-20 flex min-h-[calc(3.5rem+env(safe-area-inset-top))] items-center gap-2 bg-canvas px-2 pt-[env(safe-area-inset-top)] lg:hidden">
        <button
          type="button"
          aria-label="뒤로"
          className={`btn-icon ${FOCUS_RING}`}
          onClick={() => {
            if (canGoBack()) router.back();
            else router.replace('/membership');
          }}
        >
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
        <span className="text-heading text-fg-primary">멤버십 콘텐츠</span>
      </header>

      <div className="mx-4 max-w-[940px] space-y-6 pb-8 pt-4 md:mx-6 lg:pt-6 xl:mr-0">
        <header>
          <Link href="/membership" className={`mb-5 hidden w-fit items-center gap-1.5 text-caption text-fg-secondary hover:text-fg-primary lg:inline-flex ${FOCUS_RING}`}>
            <ArrowLeft size={14} aria-hidden="true" /> 멤버십으로 돌아가기
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-subtle px-3 py-1 text-caption text-fg-brand">
              <Crown size={14} aria-hidden="true" /> 멤버십 전용
            </span>
            {preview ? <span className="text-caption text-fg-tertiary">미리보기</span> : null}
          </div>
          <h1 className="mt-3 text-display text-fg-primary">한 주의 플레이, 한눈에</h1>
          <p className="mt-2 text-body text-fg-secondary">내 전적을 돌아보고, 다음 플레이에 필요한 패치 소식을 확인하세요.</p>
          <p className="mt-3 text-caption text-fg-tertiary">{preview ? '주간 전적과 AI 분석은 예시 데이터입니다. ' : ''}패치노트는 공식 발표를 요약했습니다.</p>
          <Link href={preview ? '/membership/content' : '/membership/content-preview'} className={`mt-3 inline-flex min-h-10 items-center text-label text-fg-brand hover:underline ${FOCUS_RING}`}>
            {preview ? '내 주간 리포트 보기' : '예시 리포트 미리보기'}
          </Link>
        </header>

        {!weeklyReport ? (
          <section aria-label="주간 전적 요약" className="rounded-card border border-line-card bg-surface p-6">
            {isAuthReady && !userId ? (
              <>
                <p className="text-body text-fg-secondary">로그인하면 내 주간 리포트를 확인할 수 있어요.</p>
                <button type="button" onClick={() => requestLogin({ returnTo: '/membership/content' })} className={`btn-secondary mt-4 ${FOCUS_RING}`}>로그인하고 확인하기</button>
              </>
            ) : error ? (
              <>
                <p role="alert" className="text-body text-fg-secondary">{error.forbidden ? '주간 리포트는 멤버십 이용 중에 볼 수 있어요.' : error.message}</p>
                {error.forbidden ? (
                  <Link href="/membership" className={`btn-secondary mt-4 inline-flex ${FOCUS_RING}`}>멤버십 안내 보기</Link>
                ) : (
                  <button type="button" onClick={() => setReload((value) => value + 1)} className={`btn-secondary mt-4 ${FOCUS_RING}`}>다시 시도</button>
                )}
              </>
            ) : <p role="status" className="text-body text-fg-secondary">주간 리포트를 불러오는 중입니다.</p>}
          </section>
        ) : <section aria-labelledby="membership-content-weekly" className="overflow-hidden rounded-card border border-line-card bg-surface">
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5 border-b border-line-card p-5 sm:p-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <BarChart3 size={20} className="text-icon-brand" aria-hidden="true" />
                <h2 id="membership-content-weekly" className="text-heading text-fg-primary">주간 전적 요약</h2>
                <span className="rounded-full bg-brand-subtle px-2 py-1 text-caption text-fg-brand">AI 리포트</span>
              </div>
              <p className="mt-3 text-body text-fg-secondary">숫자로 보는 변화와 다음 플레이를 위한 피드백을 함께 정리했어요.</p>
              <p className="mt-2 text-caption text-fg-tertiary">
                <time dateTime={weeklyReport.weekStart}>{formatDate(weeklyReport.weekStart)}</time> ~ <time dateTime={weeklyReport.weekEnd}>{formatDate(weeklyReport.weekEnd)}</time>
                {' · 지난주('}
                <time dateTime={weeklyReport.previousWeekStart}>{formatDate(weeklyReport.previousWeekStart)}</time> ~ <time dateTime={weeklyReport.previousWeekEnd}>{formatDate(weeklyReport.previousWeekEnd)}</time>
                {') 대비'}
              </p>
              {preview ? <p className="mt-1 text-caption text-fg-tertiary">AI 분석 형식의 예시 리포트입니다.</p> : null}
            </div>
            <dl className="flex gap-8">
              <div>
                <dt className="text-caption text-fg-secondary">{weeklyReport.notice ? '확인된 경기' : '총 플레이'}</dt>
                <dd className="mt-1 text-display tabular-nums text-fg-primary">{weeklyReport.totalMatches}<span className="ml-1 text-body text-fg-secondary">경기</span></dd>
              </div>
              <div>
                <dt className="text-caption text-fg-secondary">플레이한 게임</dt>
                <dd className="mt-1 text-display tabular-nums text-fg-primary">{weeklyReport.games.length}<span className="ml-1 text-body text-fg-secondary">개</span></dd>
              </div>
            </dl>
          </div>
          {weeklyReport.notice ? (
            <p role="status" className="mx-4 mt-4 rounded-control border border-line-card bg-brand-subtle p-4 text-body text-fg-secondary sm:mx-6">
              {weeklyReport.notice}
            </p>
          ) : null}
          {weeklyReport.games.length === 0 ? (
            <p className="p-6 text-body text-fg-secondary">{weeklyReport.notice ? '불러올 수 있는 경기 기록이 없습니다.' : preview ? '이번 주 플레이 기록이 없습니다.' : '아직 표시할 주간 리포트가 없습니다. 게임 연동 여부와 리포트 생성 일정을 확인해 주세요.'}</p>
          ) : (
            <ul className="space-y-4 p-4 sm:p-6">
              {weeklyReport.games.map((game) => (
                <li key={game.game} className="min-w-0 space-y-5 rounded-control border border-line-card bg-canvas p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-control bg-brand-subtle text-fg-brand">
                        <Gamepad2 size={18} aria-hidden="true" />
                      </span>
                      <h3 id={`weekly-${game.game}`} className="text-heading text-fg-primary">{game.gameLabel}</h3>
                    </div>
                    {game.tierLabel ? (
                      <p className="inline-flex items-center gap-2 text-caption">
                        <span className="text-fg-tertiary">티어</span>
                        {game.previousWeek?.tierLabel && game.previousWeek.tierLabel !== game.tierLabel ? (
                          <>
                            <span className="text-fg-secondary">{game.previousWeek.tierLabel}</span>
                            <ArrowRight size={12} className="text-icon-secondary" aria-label="에서" />
                          </>
                        ) : null}
                        <span className="text-fg-brand">{game.tierLabel}</span>
                        {game.previousWeek?.tierLabel === game.tierLabel ? <span className="text-fg-secondary">유지</span> : null}
                      </p>
                    ) : null}
                  </div>
                  <dl aria-labelledby={`weekly-${game.game}`} className={`grid gap-2 ${game.headshotRate !== undefined ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
                    {[
                      { label: '경기 수', current: game.matches, previous: game.previousWeek?.matches ?? null, unit: '경기', changeUnit: '경기' },
                      { label: '승률', current: game.winRate, previous: game.previousWeek?.winRate ?? null, unit: '%', changeUnit: '%p' },
                      { label: 'K/D', current: game.kd, previous: game.previousWeek?.kd ?? null, unit: '', changeUnit: '' },
                      ...(game.headshotRate !== undefined ? [{ label: '헤드샷(HS%)', current: game.headshotRate, previous: game.previousWeek?.headshotRate ?? null, unit: '%', changeUnit: '%p' }] : []),
                    ].map((stat) => (
                      <div key={stat.label} className="min-w-0 rounded-control bg-surface p-2.5 sm:p-4">
                        <dt className="text-caption text-fg-secondary">{stat.label}</dt>
                        <dd className="mt-1 text-heading tabular-nums text-fg-primary">{stat.current === null ? '—' : `${stat.current}${stat.unit}`}</dd>
                        <dd className="mt-1 flex flex-wrap gap-x-2 text-caption tabular-nums">
                          <StatChange current={stat.current} previous={stat.previous} unit={stat.changeUnit} />
                          <span className="whitespace-nowrap text-fg-tertiary">지난주 {stat.previous === null ? '—' : `${stat.previous}${stat.unit}`}</span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {!game.previousWeek ? <p className="text-caption text-fg-tertiary">지난주 기록이 없어 비교할 수 없습니다.</p> : null}
                  <div>
                    <p className="mb-2 inline-flex items-center gap-1.5 text-caption text-fg-brand"><Sparkles size={14} aria-hidden="true" /> AI 분석 요약</p>
                    <h4 className="text-label text-fg-primary">{game.analysis.headline}</h4>
                    <p className="mt-2 text-body text-fg-secondary">{game.analysis.summary}</p>
                  </div>
                  <div className="border-t border-line-card pt-4">
                    <h4 className="flex items-center gap-1.5 text-label text-fg-primary"><Target size={16} className="text-icon-brand" aria-hidden="true" /> 다음 주 체크 포인트</h4>
                    <p className="mt-2 text-body text-fg-secondary">{game.analysis.focus}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>}

        <section aria-labelledby="membership-content-patch-notes" className="rounded-card border border-line-card bg-surface p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Newspaper size={20} className="text-icon-brand" aria-hidden="true" />
            <h2 id="membership-content-patch-notes" className="text-heading text-fg-primary">패치노트 요약</h2>
          </div>
          <p className="mt-2 text-caption text-fg-secondary">2026.11.10 기준 · PC 패치 · 공식 발표 요약</p>
          {patchNotes.length === 0 ? (
            <p className="mt-5 text-body text-fg-secondary">아직 요약된 패치노트가 없습니다.</p>
          ) : (
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {patchNotes.map((note) => (
                <li key={note.id} className="flex flex-col rounded-control border border-line-card bg-canvas p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-brand-subtle px-2 py-1 text-caption text-fg-brand">{note.gameLabel}</span>
                    <span className="text-caption text-fg-tertiary">{note.version}</span>
                  </div>
                  <h3 className="mt-4 text-heading text-fg-primary">{note.title}</h3>
                  <p className="mb-4 mt-2 text-body text-fg-secondary">{note.summary}</p>
                  {note.statusNote ? <p className="mb-4 text-caption text-fg-secondary">{note.statusNote}</p> : null}
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line-card pt-3">
                    <time dateTime={note.publishedAt} className="text-caption text-fg-tertiary">게시 {note.publishedAt}</time>
                    {note.sourceUrl ? (
                      <a href={note.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`${note.gameLabel} 공식 패치노트 원문 (새 탭)`} className={`inline-flex min-h-10 items-center gap-1 text-label text-fg-brand hover:underline ${FOCUS_RING}`}>
                        공식 원문 <ArrowUpRight size={14} aria-hidden="true" />
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
