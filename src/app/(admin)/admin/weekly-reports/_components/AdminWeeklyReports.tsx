'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '@/lib/api-client';
import { generateAdminValorantWeeklyReport, type AdminWeeklyGameReport } from '@/lib/admin-weekly-report-api';
import type { ValorantRegion } from '@/lib/game-stats-api';
import { AdminFilterSelect } from '../../_components/AdminFilterSelect';
import { AdminShell } from '../../_components/AdminShell';
import { AdminStatePanel } from '../../_components/AdminStatePanel';

export function AdminWeeklyReports() {
  const [region, setRegion] = useState<ValorantRegion | ''>('KR');
  const [riotId, setRiotId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [report, setReport] = useState<AdminWeeklyGameReport | null>(null);
  const [error, setError] = useState<{ message: string; status?: number } | null>(null);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  const generate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (request.current) return;
    setError(null);
    setReport(null);
    const name = riotId.trim();
    if (!region || name.length > 30 || !/^[^#\r\n]+#[^#\s]+$/.test(name)) {
      setError({ message: '리전을 선택하고 닉네임을 이름#태그 형식으로 30자 이내로 입력해 주세요.' });
      return;
    }

    const controller = new AbortController();
    request.current = controller;
    setIsSubmitting(true);
    try {
      const response = await generateAdminValorantWeeklyReport(name, region, controller.signal);
      if (!controller.signal.aborted) setReport(response);
    } catch (failure) {
      if (controller.signal.aborted || (failure instanceof Error && failure.name === 'AbortError')) return;
      setError({
        message: failure instanceof Error ? failure.message : '리포트를 생성하지 못했습니다.',
        status: failure instanceof ApiError && failure.status > 0 ? failure.status : undefined,
      });
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setIsSubmitting(false);
    }
  };

  return (
    <AdminShell
      activePage="weeklyReports"
      title="주간 전적 리포트"
      description="발로란트 계정의 리포트를 수동으로 생성하고 응답을 확인합니다."
      showRefresh={false}
    >
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <section className="overflow-hidden rounded-[20px] border border-[#e4e7ec] bg-white shadow-sm">
          <div className="border-b border-[#e4e7ec] p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-lg bg-[#dcfae6] px-3 py-1 text-xs font-bold text-[#067647]">POST</span>
              <code className="break-all text-sm font-semibold text-[#172033]">/api/v1/admin/weekly-reports/valorant</code>
              <span className="rounded-lg bg-[#eef3ff] px-2 py-1 text-xs font-semibold text-[#315ef5]">ADMIN 전용</span>
            </div>
            <h2 className="mt-4 text-base font-bold text-[#172033]">발로란트 리포트 생성</h2>
            <p className="mt-1 text-sm leading-6 text-[#667085]">
              직전 완료 주(월요일~일요일)의 경쟁전을 수집하고 분석합니다. 같은 계정의 해당 주 리포트가 있으면 덮어씁니다.
            </p>
          </div>

          <form onSubmit={(event) => void generate(event)} className="space-y-5 p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
              <div>
                <p className="mb-1.5 text-[13px] font-semibold text-[#344054]">리전</p>
                <AdminFilterSelect
                  label="리전"
                  value={region}
                  onChange={(value) => setRegion(value as ValorantRegion | '')}
                  options={[{ value: 'KR', label: '한국 (KR)' }, { value: 'AP', label: '아시아 태평양 (AP)' }]}
                  disabled={isSubmitting}
                />
              </div>
              <label className="block text-[13px] font-semibold text-[#344054]">
                닉네임 (이름#태그)
                <input
                  value={riotId}
                  onChange={(event) => setRiotId(event.target.value)}
                  maxLength={30}
                  required
                  disabled={isSubmitting}
                  placeholder="닉네임#KR1"
                  autoComplete="off"
                  spellCheck={false}
                  className="mt-1.5 h-10 w-full rounded-2xl border border-[#d0d5dd] bg-white px-[13px] text-sm font-normal text-[#172033] outline-none focus:border-[#315ef5] focus:ring-2 focus:ring-[#315ef5]/10 disabled:cursor-not-allowed disabled:bg-[#f2f4f7]"
                />
              </label>
            </div>

            <div>
              <h3 className="mb-2 text-[13px] font-semibold text-[#344054]">요청 본문 · application/json</h3>
              <pre aria-label="요청 JSON" className="overflow-x-auto rounded-2xl bg-[#f6f7f9] p-4 text-xs leading-6 text-[#344054]">
                {JSON.stringify({ riotId: riotId.trim(), region }, null, 2)}
              </pre>
            </div>
            <p className="text-xs leading-5 text-[#667085]">
              경기 수집과 분석에 수 분 이상 걸릴 수 있습니다. 완료될 때까지 기다려 주세요.
            </p>
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-10 w-full rounded-2xl bg-[#315ef5] px-5 text-sm font-semibold text-white transition hover:bg-[#244bdb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#315ef5] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {isSubmitting ? '생성 중...' : '실행 · 리포트 생성'}
            </button>
          </form>
        </section>

        <section aria-label="실행 결과" aria-busy={isSubmitting} className="min-w-0 rounded-[20px] border border-[#e4e7ec] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-[#172033]">응답 data</h2>
            {report ? <span className="text-xs font-semibold text-[#067647]">HTTP 200</span> : null}
            {error?.status ? <span className="text-xs font-semibold text-[#d92d20]">HTTP {error.status}</span> : null}
          </div>
          {isSubmitting ? (
            <AdminStatePanel state="loading" title="리포트를 생성하고 있습니다." description="경기 기록을 수집하고 분석 중입니다. 잠시 기다려 주세요." />
          ) : error ? (
            <AdminStatePanel state="error" title="요청을 완료하지 못했습니다." description={error.message} />
          ) : report ? (
            <>
              <p role="status" className="mt-3 text-sm text-[#667085]">
                {report.games.length === 0
                  ? report.notice ? '조회할 수 있는 경기 기록이 없습니다.' : '생성이 완료되었습니다. 대상 주의 경쟁전 기록이 없습니다.'
                  : '리포트 생성이 완료되었습니다.'}
              </p>
              {report.notice ? (
                <div role="status" className="mt-4 space-y-3 rounded-2xl border border-[#fedf89] bg-[#fffaeb] p-4 text-sm text-[#93370d]">
                  <h3 className="font-bold">경기 수집 안내</h3>
                  <p>{report.notice}</p>
                  <p className="text-xs leading-5">아래 진단은 HenrikDev의 최근 최대 20건 랭크 이력과 대조한 결과입니다. 이 범위 밖의 누락은 확인하지 못할 수 있습니다.</p>
                  {report.collectionIssues?.length ? (
                    <ul className="space-y-3 border-t border-[#fedf89] pt-3">
                      {report.collectionIssues.map((issue, index) => (
                        <li key={issue.matchId ?? `history-${index}`} className="space-y-1 break-words">
                          <p className="font-semibold">
                            {issue.startedAt ? new Date(issue.startedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '경기 이력 조회'}
                            {issue.map ? ` · ${issue.map}` : ''}
                            {issue.httpStatus ? ` · HTTP ${issue.httpStatus}` : ''}
                          </p>
                          <p>{issue.reason}</p>
                          {issue.matchId ? <p className="break-all font-mono text-xs">경기 ID: {issue.matchId}</p> : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
              <pre aria-label="응답 JSON" tabIndex={0} className="mt-4 max-h-[600px] overflow-auto rounded-2xl bg-[#102a56] p-4 text-xs leading-6 break-words whitespace-pre-wrap text-[#eef3ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#315ef5]">
                {JSON.stringify(report, null, 2)}
              </pre>
            </>
          ) : (
            <AdminStatePanel state="empty" title="아직 실행한 요청이 없습니다." description="리전과 닉네임을 입력하고 리포트 생성을 실행해 주세요." />
          )}
        </section>
      </div>
    </AdminShell>
  );
}
