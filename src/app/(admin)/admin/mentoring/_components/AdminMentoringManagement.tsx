'use client';

import {
  Check,
  EyeOff,
  Gamepad2,
  Pause,
  Play,
  Search,
  Star,
  UserRoundCheck,
  WalletCards,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminDemoNotice } from '../../_components/AdminDemoNotice';
import {
  initialApplications,
  initialPrograms,
  type ApplicationStatus,
  type MentorApplication,
  type MentoringProgram,
  type MentoringTab,
  type ProgramStatus,
} from '../_data/mentoring';
import { MentorApprovalDialog } from './MentorApprovalDialog';
import { ProgramHideDialog } from './ProgramHideDialog';
import { ProgramHiddenToast } from './ProgramHiddenToast';

const baseSummaryCards = [
  {
    label: '승인 대기 신청',
    icon: UserRoundCheck,
    iconClassName: 'bg-[#fef6e7] text-[#d97706]',
  },
  {
    label: '운영 중 프로그램',
    icon: Gamepad2,
    iconClassName: 'bg-[#eef3ff] text-[#315ef5]',
  },
  {
    label: '이번 달 세션',
    icon: Star,
    iconClassName: 'bg-[#e7f6ee] text-[#168a4a]',
  },
  {
    label: '정산 예정액',
    icon: WalletCards,
    iconClassName: 'bg-[#f4ebff] text-[#7f56d9]',
  },
] as const;

function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  const style = {
    '승인 대기': 'bg-[#fef6e7] text-[#b54708] before:bg-[#d97706]',
    '승인 완료': 'bg-[#e7f6ee] text-[#087443] before:bg-[#168a4a]',
    반려: 'bg-[#f2f4f7] text-[#667085] before:bg-[#98a2b3]',
  }[status];

  return <StatusBadge label={status} className={style} />;
}

function ProgramStatusBadge({ status }: { status: ProgramStatus }) {
  const style = {
    '운영 중': 'bg-[#e7f6ee] text-[#087443] before:bg-[#168a4a]',
    일시정지: 'bg-[#fef6e7] text-[#b54708] before:bg-[#d97706]',
    숨김: 'bg-[#f2f4f7] text-[#667085] before:bg-[#98a2b3]',
  }[status];

  return <StatusBadge label={status} className={style} />;
}

function StatusBadge({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs leading-[18px] font-semibold before:size-1.5 before:rounded-full before:content-[''] ${className}`}
    >
      {label}
    </span>
  );
}

type ApplicationsTableProps = {
  applications: MentorApplication[];
  onStatusChange: (id: number, status: ApplicationStatus) => void;
  onApproveRequest: (application: MentorApplication) => void;
};

function ApplicationsTable({ applications, onStatusChange, onApproveRequest }: ApplicationsTableProps) {
  return (
    <section className="min-h-[430px] overflow-hidden rounded-[20px] border border-[#e4e7ec] bg-[#fff] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] table-fixed border-collapse">
          <colgroup>
            <col className="w-[28.75%]" />
            <col className="w-[12.25%]" />
            <col className="w-[17.55%]" />
            <col className="w-[13.33%]" />
            <col className="w-[14.69%]" />
            <col className="w-[13.43%]" />
          </colgroup>
          <thead>
            <tr className="h-[42px] border-b border-[#f2f4f7] bg-[#fcfcfd] text-left text-xs leading-[18px] font-bold text-[#667085]">
              <th className="px-5 font-bold">신청자</th>
              <th className="font-bold">주력 게임</th>
              <th className="font-bold">경력</th>
              <th className="font-bold">신청 시각</th>
              <th className="font-bold">상태</th>
              <th className="pr-5 text-right font-bold">처리</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((application) => (
              <tr
                key={application.id}
                className="h-[96.5px] border-b border-[#f2f4f7] last:border-b-0"
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="grid size-9 shrink-0 place-items-center rounded-full text-[14px] leading-[21px] font-bold text-white"
                      style={{ backgroundColor: application.avatarColor }}
                    >
                      {application.initial}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] leading-[19.5px] font-semibold text-[#172033]">
                          {application.name}
                        </span>
                        <span className="truncate text-xs leading-[18px] text-[#667085]">
                          @{application.handle}
                        </span>
                      </span>
                      <span className="mt-1 block max-w-[250px] truncate text-xs leading-[18px] text-[#98a2b3]">
                        {application.bio}
                      </span>
                    </span>
                  </div>
                </td>
                <td className="pr-3 text-[13px] leading-[19.5px] text-[#344054]">
                  {application.game}
                </td>
                <td className="pr-3 text-[13px] leading-[19.5px] text-[#344054]">
                  {application.experience}
                </td>
                <td className="text-[13px] leading-[19.5px] text-[#98a2b3]">
                  {application.appliedAt}
                </td>
                <td>
                  <ApplicationStatusBadge status={application.status} />
                </td>
                <td className="pr-5 text-right">
                  {application.status === '승인 대기' ? (
                    <span className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        disabled
                        title="멘토 승인 관리 API 연결 후 사용할 수 있습니다."
                        onClick={() => onStatusChange(application.id, '반려')}
                        className="h-8 rounded-xl border border-[#d0d5dd] bg-[#fff] px-3 text-xs leading-[18px] font-semibold text-[#344054] transition hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:bg-[#f2f4f7] disabled:text-[#98a2b3]"
                      >
                        반려
                      </button>
                      <button
                        type="button"
                        disabled
                        title="멘토 승인 관리 API 연결 후 사용할 수 있습니다."
                        onClick={() => onApproveRequest(application)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-[#315ef5] px-3 text-xs leading-[18px] font-semibold text-white transition hover:bg-[#2448c9] disabled:cursor-not-allowed disabled:bg-[#98a2b3]"
                      >
                        <Check className="size-3.5" strokeWidth={2} aria-hidden="true" />
                        승인
                      </button>
                    </span>
                  ) : (
                    <span className="text-xs leading-[18px] font-semibold text-[#98a2b3]">
                      처리 완료
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {applications.length === 0 ? <EmptySearchResult /> : null}
      </div>
    </section>
  );
}

type ProgramsTableProps = {
  programs: MentoringProgram[];
  onStatusChange: (id: number, status: ProgramStatus) => void;
  onHideRequest: (program: MentoringProgram) => void;
};

function ProgramsTable({ programs, onStatusChange, onHideRequest }: ProgramsTableProps) {
  return (
    <section className="min-h-[324px] overflow-hidden rounded-[20px] border border-[#e4e7ec] bg-[#fff] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] table-fixed border-collapse">
          <colgroup>
            <col className="w-[24%]" />
            <col className="w-[13.2%]" />
            <col className="w-[9.3%]" />
            <col className="w-[6.2%]" />
            <col className="w-[7.4%]" />
            <col className="w-[5.7%]" />
            <col className="w-[10.5%]" />
            <col className="w-[23.7%]" />
          </colgroup>
          <thead>
            <tr className="h-11 border-b border-[#f2f4f7] bg-[#fcfcfd] text-left text-xs leading-[18px] font-bold text-[#667085]">
              <th className="px-5 font-bold">프로그램</th>
              <th className="font-bold">멘토</th>
              <th className="font-bold">가격</th>
              <th className="font-bold">세션</th>
              <th className="font-bold">평점</th>
              <th className="font-bold">신고</th>
              <th className="font-bold">상태</th>
              <th className="pr-5 text-right font-bold">처리</th>
            </tr>
          </thead>
          <tbody>
            {programs.map((program) => (
              <tr key={program.id} className="h-[70px] border-b border-[#f2f4f7] last:border-b-0">
                <td className="px-5">
                  <span className="block max-w-[240px] truncate text-[13px] leading-[19.5px] font-semibold text-[#172033]">
                    {program.title}
                  </span>
                  <span className="block text-xs leading-[18px] text-[#667085]">{program.game}</span>
                </td>
                <td className="text-[13px] leading-[19.5px] text-[#344054]">@{program.mentor}</td>
                <td className="text-[13px] leading-[19.5px] text-[#344054]">{program.price}</td>
                <td className="text-[13px] leading-[19.5px] text-[#344054]">{program.sessions}회</td>
                <td className="text-[13px] leading-[19.5px] text-[#344054]">
                  {program.rating === null ? (
                    <span className="text-[#98a2b3]">-</span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Star className="size-3.5 fill-[#f79009] text-[#f79009]" strokeWidth={1.5} />
                      {program.rating.toFixed(1)}
                    </span>
                  )}
                </td>
                <td
                  className={`text-[13px] leading-[19.5px] ${
                    program.reports > 0 ? 'font-semibold text-[#d92d20]' : 'text-[#98a2b3]'
                  }`}
                >
                  {program.reports}건
                </td>
                <td>
                  <ProgramStatusBadge status={program.status} />
                </td>
                <td className="pr-5 text-right">
                  {program.status === '숨김' ? (
                    <span className="text-xs leading-[18px] text-[#98a2b3]">숨김됨</span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        disabled
                        title="멘토링 프로그램 관리 API 연결 후 사용할 수 있습니다."
                        onClick={() =>
                          onStatusChange(
                            program.id,
                            program.status === '운영 중' ? '일시정지' : '운영 중',
                          )
                        }
                        className="inline-flex h-8 items-center gap-1 rounded-2xl border border-[#d0d5dd] bg-[#fff] px-[13px] text-xs leading-[18px] font-semibold text-[#344054] transition hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:bg-[#f2f4f7] disabled:text-[#98a2b3]"
                      >
                        {program.status === '운영 중' ? (
                          <Pause className="size-3.5" strokeWidth={1.7} aria-hidden="true" />
                        ) : (
                          <Play className="size-3.5" strokeWidth={1.7} aria-hidden="true" />
                        )}
                        {program.status === '운영 중' ? '정지' : '재개'}
                      </button>
                      <button
                        type="button"
                        disabled
                        title="멘토링 프로그램 관리 API 연결 후 사용할 수 있습니다."
                        onClick={() => onHideRequest(program)}
                        className="inline-flex h-8 items-center gap-1 rounded-2xl border border-[#fda29b] bg-[#fff] px-[13px] text-xs leading-[18px] font-semibold text-[#b42318] transition hover:bg-[#fff5f4] disabled:cursor-not-allowed disabled:border-[#e4e7ec] disabled:bg-[#f2f4f7] disabled:text-[#98a2b3]"
                      >
                        <EyeOff className="size-3.5" strokeWidth={1.7} aria-hidden="true" />
                        숨김
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {programs.length === 0 ? <EmptySearchResult /> : null}
      </div>
    </section>
  );
}

function EmptySearchResult() {
  return (
    <div className="flex h-[160px] items-center justify-center text-sm text-[#98a2b3]">
      검색 결과가 없습니다.
    </div>
  );
}

export function AdminMentoringManagement() {
  const [activeTab, setActiveTab] = useState<MentoringTab>('applications');
  const [applications, setApplications] = useState(initialApplications);
  const [programs, setPrograms] = useState(initialPrograms);
  const [query, setQuery] = useState('');
  const [selectedProgram, setSelectedProgram] = useState<MentoringProgram | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<MentorApplication | null>(null);
  const [hideToastId, setHideToastId] = useState(0);
  const [isHideToastLeaving, setIsHideToastLeaving] = useState(false);

  useEffect(() => {
    if (hideToastId === 0) return;

    const leavingTimer = window.setTimeout(() => setIsHideToastLeaving(true), 3000);
    const removeTimer = window.setTimeout(() => setHideToastId(0), 3300);

    return () => {
      window.clearTimeout(leavingTimer);
      window.clearTimeout(removeTimer);
    };
  }, [hideToastId]);

  const pendingCount = applications.filter((application) => application.status === '승인 대기').length;
  const runningCount = programs.filter((program) => program.status === '운영 중').length;
  const summaryValues = [`${pendingCount}건`, `${runningCount}개`, '67회', '1,840,000원'];

  const normalizedQuery = query.trim().toLowerCase().replace(/^@/, '');
  const filteredApplications = useMemo(() => {
    if (!normalizedQuery) return applications;

    return applications.filter((application) =>
      [application.name, application.handle, application.game].some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      ),
    );
  }, [applications, normalizedQuery]);

  const filteredPrograms = useMemo(() => {
    if (!normalizedQuery) return programs;

    return programs.filter((program) =>
      [program.title, program.game, program.mentor].some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      ),
    );
  }, [normalizedQuery, programs]);

  const changeTab = (tab: MentoringTab) => {
    setActiveTab(tab);
    setQuery('');
  };

  const confirmMentorApproval = () => {
    if (!selectedApplication) return;

    setApplications((current) =>
      current.map((application) =>
        application.id === selectedApplication.id
          ? { ...application, status: '승인 완료' }
          : application,
      ),
    );
    setSelectedApplication(null);
  };

  const confirmProgramHide = (reason: string) => {
    if (!selectedProgram) return;

    setPrograms((current) =>
      current.map((program) =>
        program.id === selectedProgram.id
          ? { ...program, status: '숨김', hideReason: reason }
          : program,
      ),
    );
    setSelectedProgram(null);
    setIsHideToastLeaving(false);
    setHideToastId((current) => current + 1);
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] p-4 sm:p-6 lg:p-8">
      <AdminDemoNotice description="멘토 승인, 프로그램 상태와 요약 통계는 관리 API 연결 전 예시입니다. 상태 변경 버튼은 비활성화되어 있습니다." />
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="멘토링 현황 요약">
        {baseSummaryCards.map((card, index) => {
          const Icon = card.icon;

          return (
            <article
              key={card.label}
              className="flex h-[82px] items-center gap-3 rounded-[20px] border border-[#e4e7ec] bg-[#fff] p-[17px] shadow-[0_1px_1px_rgba(16,24,40,0.04)]"
            >
              <span className={`grid size-10 shrink-0 place-items-center rounded-2xl ${card.iconClassName}`}>
                <Icon className="size-5" strokeWidth={1.7} aria-hidden="true" />
              </span>
              <span>
                <span className="block text-xs leading-[18px] font-semibold text-[#667085]">
                  {card.label}
                </span>
                <span className="mt-0.5 block text-lg leading-[27px] font-bold tracking-[-0.45px] text-[#172033]">
                  {summaryValues[index]}
                </span>
              </span>
            </article>
          );
        })}
      </section>

      <section className="flex flex-col gap-3 py-4 sm:h-[84px] sm:flex-row sm:items-center sm:justify-between sm:py-0" aria-label="멘토링 관리 보기">
        <div
          className="flex h-12 items-center rounded-2xl bg-[#f2f4f7] p-1"
          role="tablist"
          aria-label="멘토링 관리 메뉴"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'applications'}
            onClick={() => changeTab('applications')}
            className={`h-10 w-32 rounded-xl text-[13px] leading-[19.5px] transition ${
              activeTab === 'applications'
                ? 'bg-[#fff] font-bold text-[#172033] shadow-[0_1px_3px_rgba(16,24,40,0.12)]'
                : 'font-semibold text-[#667085] hover:text-[#344054]'
            }`}
          >
            멘토 승인 요청
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'programs'}
            onClick={() => changeTab('programs')}
            className={`h-10 w-[124px] rounded-xl text-[13px] leading-[19.5px] transition ${
              activeTab === 'programs'
                ? 'bg-[#fff] font-bold text-[#172033] shadow-[0_1px_3px_rgba(16,24,40,0.12)]'
                : 'font-semibold text-[#667085] hover:text-[#344054]'
            }`}
          >
            프로그램 관리
          </button>
        </div>

        <label className="relative w-full sm:w-64">
          <span className="sr-only">
            {activeTab === 'applications' ? '멘토 또는 게임 검색' : '프로그램 또는 멘토 검색'}
          </span>
          <Search
            className="pointer-events-none absolute top-3 left-3 size-4 text-[#98a2b3]"
            strokeWidth={1.7}
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={activeTab === 'applications' ? '멘토·게임 검색' : '프로그램·멘토 검색'}
            className="h-10 w-full rounded-2xl border border-[#d0d5dd] bg-[#fff] pr-[13px] pl-[37px] text-sm text-[#172033] outline-none transition placeholder:text-[#98a2b3] focus:border-[#315ef5] focus:ring-2 focus:ring-[#315ef5]/10"
          />
        </label>
      </section>

      {activeTab === 'applications' ? (
        <ApplicationsTable
          applications={filteredApplications}
          onApproveRequest={setSelectedApplication}
          onStatusChange={(id, status) =>
            setApplications((current) =>
              current.map((application) =>
                application.id === id ? { ...application, status } : application,
              ),
            )
          }
        />
      ) : (
        <ProgramsTable
          programs={filteredPrograms}
          onHideRequest={setSelectedProgram}
          onStatusChange={(id, status) =>
            setPrograms((current) =>
              current.map((program) => (program.id === id ? { ...program, status } : program)),
            )
          }
        />
      )}
      {selectedApplication ? (
        <MentorApprovalDialog
          applicantName={selectedApplication.name}
          onCancel={() => setSelectedApplication(null)}
          onConfirm={confirmMentorApproval}
        />
      ) : null}
      {selectedProgram ? (
        <ProgramHideDialog
          programTitle={selectedProgram.title}
          onCancel={() => setSelectedProgram(null)}
          onConfirm={confirmProgramHide}
        />
      ) : null}
      {hideToastId > 0 ? <ProgramHiddenToast isLeaving={isHideToastLeaving} /> : null}
    </div>
  );
}
