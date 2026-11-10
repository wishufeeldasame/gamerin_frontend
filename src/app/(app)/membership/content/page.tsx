'use client';

import { ArrowLeft, ArrowRight, ArrowUpRight, BarChart3, ChevronLeft, Crown, Gamepad2, Newspaper, Sparkles, Target } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { canGoBack } from '@/lib/history-back';
import { MEMBERSHIP_CONTENT } from '@/lib/membership-content';

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg-brand dark:focus-visible:outline-line-focus';

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
  const { weeklyReport, patchNotes } = MEMBERSHIP_CONTENT;

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
            <span className="text-caption text-fg-tertiary">미리보기</span>
          </div>
          <h1 className="mt-3 text-display text-fg-primary">한 주의 플레이, 한눈에</h1>
          <p className="mt-2 text-body text-fg-secondary">내 전적을 돌아보고, 다음 플레이에 필요한 패치 소식을 확인하세요.</p>
          <p className="mt-3 text-caption text-fg-tertiary">주간 전적과 AI 분석은 예시 데이터입니다. 패치노트는 공식 발표를 요약했습니다.</p>
        </header>

        <section aria-labelledby="membership-content-weekly" className="overflow-hidden rounded-card border border-line-card bg-surface">
          <div className="border-b border-line-card p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <BarChart3 size={20} className="text-icon-brand" aria-hidden="true" />
              <h2 id="membership-content-weekly" className="text-heading text-fg-primary">주간 전적 요약</h2>
              <span className="rounded-full bg-brand-subtle px-2 py-1 text-caption text-fg-brand">AI 리포트</span>
            </div>
            <p className="mt-3 text-body text-fg-secondary">숫자로 보는 변화와 다음 플레이를 위한 피드백을 함께 정리했어요.</p>
            <p className="mt-1 text-caption text-fg-tertiary">AI 분석 형식의 예시 리포트입니다.</p>
            <p className="mt-3 text-caption text-fg-secondary">
              이번 주 · <time dateTime={weeklyReport.weekStart}>{weeklyReport.weekStart}</time> ~ <time dateTime={weeklyReport.weekEnd}>{weeklyReport.weekEnd}</time>
            </p>
            <p className="mt-1 text-caption text-fg-tertiary">
              지난주 · <time dateTime={weeklyReport.previousWeekStart}>{weeklyReport.previousWeekStart}</time> ~ <time dateTime={weeklyReport.previousWeekEnd}>{weeklyReport.previousWeekEnd}</time>
            </p>
            <div className="mt-5 flex items-end gap-6 sm:gap-10">
              <div>
                <p className="text-caption text-fg-secondary">총 플레이</p>
                <p className="mt-1 text-display tabular-nums text-fg-primary">{weeklyReport.totalMatches}<span className="ml-1 text-body text-fg-secondary">경기</span></p>
              </div>
              <div>
                <p className="text-caption text-fg-secondary">플레이한 게임</p>
                <p className="mt-1 text-display tabular-nums text-fg-primary">{weeklyReport.games.length}<span className="ml-1 text-body text-fg-secondary">개</span></p>
              </div>
            </div>
          </div>
          {weeklyReport.games.length === 0 ? (
            <p className="p-6 text-body text-fg-secondary">이번 주 플레이 기록이 없습니다.</p>
          ) : (
            <ul className="space-y-4 p-4 sm:p-6">
              {weeklyReport.games.map((game) => (
                <li key={game.game} className="min-w-0 overflow-hidden rounded-control border border-line-card bg-canvas">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-card p-4 sm:px-5">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-control bg-brand-subtle text-fg-brand">
                        <Gamepad2 size={20} aria-hidden="true" />
                      </span>
                      <div>
                        <h3 id={`weekly-${game.game}`} className="text-heading text-fg-primary">{game.gameLabel}</h3>
                        <p className="mt-0.5 text-caption text-fg-secondary">지난주 대비 플레이 변화</p>
                      </div>
                    </div>
                    {game.tierLabel ? (
                      <p className="inline-flex items-center gap-2 text-caption">
                        <span className="text-fg-secondary">지난주 {game.previousWeek?.tierLabel ?? '기록 없음'}</span>
                        <ArrowRight size={12} className="text-icon-secondary" aria-hidden="true" />
                        <span className="text-fg-brand">이번 주 {game.tierLabel}</span>
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-4 p-4 sm:p-5">
                    <div>
                      <p className="mb-2 inline-flex items-center gap-1.5 text-caption text-fg-brand"><Sparkles size={14} aria-hidden="true" /> AI 분석 요약</p>
                      <h4 className="text-heading text-fg-primary">{game.analysis.headline}</h4>
                      <p className="mt-2 text-body leading-7 text-fg-secondary">{game.analysis.summary}</p>
                    </div>
                    <div className="rounded-control border border-line-card bg-surface p-4">
                      <h4 className="flex items-center gap-1.5 text-label text-fg-primary"><Target size={16} className="text-icon-brand" aria-hidden="true" /> 다음 주 체크 포인트</h4>
                      <p className="mt-2 text-body text-fg-secondary">{game.analysis.focus}</p>
                    </div>
                  </div>
                  <div className="px-4 pb-2 sm:px-5">
                    <table aria-labelledby={`weekly-${game.game}`} className="w-full table-fixed text-right text-label tabular-nums">
                      <thead className="text-caption text-fg-secondary">
                        <tr>
                          <th scope="col" className="w-1/4 py-3 text-left font-normal">스탯</th>
                          <th scope="col" className="py-3 font-normal">지난주</th>
                          <th scope="col" className="bg-brand-subtle py-3 font-medium text-fg-brand">이번 주</th>
                          <th scope="col" className="py-3 font-normal">변화</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: '경기 수', current: game.matches, previous: game.previousWeek?.matches ?? null, unit: '경기', changeUnit: '경기' },
                          { label: '승률', current: game.winRate, previous: game.previousWeek?.winRate ?? null, unit: '%', changeUnit: '%p' },
                          { label: 'K/D', current: game.kd, previous: game.previousWeek?.kd ?? null, unit: '', changeUnit: '' },
                          ...(game.headshotRate !== undefined ? [{ label: 'HS%', current: game.headshotRate, previous: game.previousWeek?.headshotRate ?? null, unit: '%', changeUnit: '%p' }] : []),
                        ].map((stat) => (
                          <tr key={stat.label} className="border-t border-line-card">
                            <th scope="row" className="py-3 text-left font-normal text-fg-secondary">{stat.label}</th>
                            <td className="py-3 text-fg-secondary">{stat.previous === null ? '—' : `${stat.previous}${stat.unit}`}</td>
                            <td className="bg-brand-subtle py-3 font-medium text-fg-primary">{stat.current === null ? '—' : `${stat.current}${stat.unit}`}</td>
                            <td className="py-3"><StatChange current={stat.current} previous={stat.previous} unit={stat.changeUnit} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {game.headshotRate !== undefined ? <p className="pb-3 pt-2 text-caption text-fg-tertiary">HS% · 헤드샷 비율</p> : null}
                    {!game.previousWeek ? <p className="pb-3 text-caption text-fg-tertiary">지난주 기록이 없어 비교할 수 없습니다.</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

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
