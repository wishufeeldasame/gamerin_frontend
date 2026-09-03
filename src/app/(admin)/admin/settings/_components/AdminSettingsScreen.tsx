'use client';

import {
  ChevronDown,
  ClipboardList,
  ShieldCheck,
  SlidersHorizontal,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { AdminShell } from '../../_components/AdminShell';
import { initialAdminSettings, type AdminSettingsState } from '../_data/settings';

type SettingsCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  children: React.ReactNode;
};

function SettingsCard({ icon: Icon, title, description, children }: SettingsCardProps) {
  return (
    <section className="min-h-[276px] rounded-[20px] border border-[#e4e7ec] bg-[#fff] p-[21px] shadow-[0_1px_1px_rgba(16,24,40,0.04)]">
      <div className="flex h-[43px] items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-[#eef3ff] text-[#315ef5]">
          <Icon className="size-5" strokeWidth={1.7} aria-hidden="true" />
        </span>
        <span>
          <h2 className="text-[15px] leading-[22.5px] font-bold text-[#172033]">{title}</h2>
          <p className="text-[13px] leading-[19.5px] text-[#667085]">{description}</p>
        </span>
      </div>
      <div className="pt-4">{children}</div>
    </section>
  );
}

type SettingsSwitchProps = {
  checked: boolean;
  label: string;
  description: string;
  onChange: (checked: boolean) => void;
};

function SettingsSwitch({ checked, label, description, onChange }: SettingsSwitchProps) {
  return (
    <div className="flex h-[39px] items-center justify-between">
      <span>
        <span className="block text-sm leading-[21px] font-semibold text-[#344054]">{label}</span>
        <span className="block text-xs leading-[18px] text-[#667085]">{description}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#315ef5] ${
          checked ? 'bg-[#315ef5]' : 'bg-[#d0d5dd]'
        }`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-[#fff] shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.1)] transition-transform ${
            checked ? 'left-0.5 translate-x-5' : 'left-0.5 translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

const fieldLabelClassName =
  'block h-[26px] pb-1.5 text-[13px] leading-[19.5px] font-semibold text-[#344054]';
const fieldClassName =
  'h-10 w-full rounded-2xl border border-[#d0d5dd] bg-[#fff] px-[13px] text-sm leading-[21px] text-[#172033] outline-none transition focus:border-[#315ef5] focus:ring-2 focus:ring-[#315ef5]/10';

export function AdminSettingsScreen() {
  const [settings, setSettings] = useState(initialAdminSettings);
  const [savedSettings, setSavedSettings] = useState(initialAdminSettings);

  const updateSetting = <Key extends keyof AdminSettingsState>(
    key: Key,
    value: AdminSettingsState[Key],
  ) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  return (
    <AdminShell
      activePage="settings"
      title="시스템 설정"
      description="서비스 운영 정책과 자동화, 보안 설정을 관리합니다."
      breadcrumbs={[{ label: '관리자', href: '/admin' }, { label: '시스템 설정' }]}
      showRefresh={false}
      headerActions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSettings(savedSettings)}
            className="h-10 rounded-2xl border border-[#d0d5dd] bg-[#fff] px-[17px] text-sm leading-[21px] font-semibold text-[#344054] transition hover:bg-[#f9fafb]"
          >
            되돌리기
          </button>
          <button
            type="button"
            onClick={() => setSavedSettings(settings)}
            className="h-10 rounded-2xl bg-[#315ef5] px-4 text-sm leading-[21px] font-semibold text-white transition hover:bg-[#2448c9]"
          >
            변경사항 저장
          </button>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-[1200px] p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <SettingsCard
            icon={SlidersHorizontal}
            title="서비스 정책"
            description="서비스 기본 운영 상태를 설정합니다."
          >
            <label>
              <span className={fieldLabelClassName}>서비스 이름</span>
              <input
                type="text"
                value={settings.serviceName}
                onChange={(event) => updateSetting('serviceName', event.target.value)}
                className={fieldClassName}
              />
            </label>
            <div className="pt-4">
              <SettingsSwitch
                checked={settings.allowSignup}
                label="신규 회원가입 허용"
                description="끄면 새로운 사용자의 가입이 제한됩니다."
                onChange={(checked) => updateSetting('allowSignup', checked)}
              />
            </div>
            <div className="pt-4">
              <SettingsSwitch
                checked={settings.maintenanceMode}
                label="점검 모드"
                description="켜면 일반 사용자에게 점검 안내가 표시됩니다."
                onChange={(checked) => updateSetting('maintenanceMode', checked)}
              />
            </div>
          </SettingsCard>

          <SettingsCard
            icon={ShieldCheck}
            title="제재 정책"
            description="위반 처리 기본값을 설정합니다."
          >
            <label className="relative block">
              <span className={fieldLabelClassName}>기본 제재 수준</span>
              <select
                value={settings.defaultSanction}
                onChange={(event) => updateSetting('defaultSanction', event.target.value)}
                className={`${fieldClassName} appearance-none pr-10`}
              >
                <option value="" aria-label="선택되지 않음" />
                <option value="warning">경고</option>
                <option value="3-days">3일 정지</option>
                <option value="7-days">7일 정지</option>
                <option value="30-days">30일 정지</option>
                <option value="permanent">영구 정지</option>
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3 bottom-3 size-4 text-[#98a2b3]"
                strokeWidth={1.7}
                aria-hidden="true"
              />
            </label>
            <label className="mt-4 block">
              <span className={fieldLabelClassName}>신고 재검토 기한 (일)</span>
              <input
                type="number"
                min="1"
                value={settings.reportReviewDays}
                onChange={(event) => updateSetting('reportReviewDays', event.target.value)}
                className={fieldClassName}
              />
              <span className="block pt-1 text-xs leading-[18px] text-[#667085]">
                기한 내 미처리 신고는 대시보드에서 강조 표시됩니다.
              </span>
            </label>
          </SettingsCard>

          <SettingsCard
            icon={Wrench}
            title="자동화"
            description="반복 작업을 자동으로 처리합니다."
          >
            <SettingsSwitch
              checked={settings.autoHideReports}
              label="신고 누적 시 자동 숨김"
              description="동일 콘텐츠 신고가 임계값을 넘으면 자동으로 숨깁니다."
              onChange={(checked) => updateSetting('autoHideReports', checked)}
            />
            <label className="mt-4 block">
              <span className={fieldLabelClassName}>자동 숨김 임계값 (신고 수)</span>
              <input
                type="number"
                min="1"
                value={settings.autoHideThreshold}
                onChange={(event) => updateSetting('autoHideThreshold', event.target.value)}
                className={fieldClassName}
              />
            </label>
            <div className="pt-4">
              <SettingsSwitch
                checked={settings.newReportNotification}
                label="새 신고 접수 알림"
                description="신고가 접수되면 담당 관리자에게 알림을 보냅니다."
                onChange={(checked) => updateSetting('newReportNotification', checked)}
              />
            </div>
          </SettingsCard>

          <SettingsCard
            icon={ClipboardList}
            title="운영 · 보안"
            description="관리자 계정 보안과 감사 기록을 관리합니다."
          >
            <SettingsSwitch
              checked={settings.requireTwoFactor}
              label="관리자 2단계 인증 필수"
              description="모든 관리자 로그인 시 2단계 인증을 요구합니다."
              onChange={(checked) => updateSetting('requireTwoFactor', checked)}
            />
            <Link
              href="/admin/audit-logs"
              className="mt-4 flex h-[65px] w-full items-center justify-between rounded-2xl border border-[#e4e7ec] bg-[#fff] px-[17px] py-[13px] text-left transition hover:bg-[#f9fafb]"
            >
              <span>
                <span className="block text-sm leading-[21px] font-semibold text-[#344054]">작업 이력 보기</span>
                <span className="block text-xs leading-[18px] text-[#667085]">모든 관리자 처리 내역을 확인합니다. (읽기 전용)</span>
              </span>
              <span className="text-[13px] leading-[19.5px] font-semibold text-[#315ef5]">바로가기 →</span>
            </Link>
            <p className="pt-4 text-xs leading-[18px] text-[#98a2b3]">
              비밀번호·토큰 등 민감 정보는 기록되지 않으며, 권한은 서버에서 최종 확인됩니다.
            </p>
          </SettingsCard>
        </div>
      </div>
    </AdminShell>
  );
}
