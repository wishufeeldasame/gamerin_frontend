'use client';

import { ChevronDown, ClipboardList, ShieldCheck, Wrench, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { fetchAdminSettings, updateAdminSettings } from '@/lib/admin-settings-api';
import { AdminShell } from '../../_components/AdminShell';
import { AdminStatePanel } from '../../_components/AdminStatePanel';
import { AdminToast } from '../../_components/AdminToast';
import {
  changedSettings,
  settingsFromApi,
  type AdminSanctionChoice,
  type AdminSettingsState,
} from '../_data/settings';

function SettingsCard({ icon: Icon, title, description, children }: {
  icon: LucideIcon;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[20px] border border-[#e4e7ec] bg-white p-[21px] shadow-[0_1px_1px_rgba(16,24,40,0.04)]">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-[#eef3ff] text-[#315ef5]">
          <Icon className="size-5" strokeWidth={1.7} aria-hidden="true" />
        </span>
        <span>
          <h2 className="text-[15px] font-bold text-[#172033]">{title}</h2>
          <p className="text-[13px] text-[#667085]">{description}</p>
        </span>
      </div>
      <div className="pt-4">{children}</div>
    </section>
  );
}

function SettingsSwitch({ checked, label, description, disabled, onChange }: {
  checked: boolean;
  label: string;
  description: string;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>
        <span className="block text-sm font-semibold text-[#344054]">{label}</span>
        <span className="block text-xs leading-[18px] text-[#667085]">{description}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={'relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#315ef5] disabled:cursor-not-allowed ' + (checked ? 'bg-[#315ef5]' : 'bg-[#d0d5dd]')}
      >
        <span className={'absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ' + (checked ? 'translate-x-5' : 'translate-x-0')} />
      </button>
    </div>
  );
}

const fieldLabelClassName = 'block pb-1.5 text-[13px] font-semibold text-[#344054]';
const fieldClassName = 'h-10 w-full rounded-2xl border border-[#d0d5dd] bg-white px-[13px] text-sm text-[#172033] outline-none focus:border-[#315ef5] focus:ring-2 focus:ring-[#315ef5]/10 disabled:bg-[#f2f4f7]';

export function AdminSettingsScreen() {
  const [settings, setSettings] = useState<AdminSettingsState | null>(null);
  const [savedSettings, setSavedSettings] = useState<AdminSettingsState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(false);
  const saveLock = useRef(false);
  const mutationController = useRef<AbortController | null>(null);
  const dismissToast = useCallback(() => setToast(false), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoadError(null);
    fetchAdminSettings(controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        const loaded = settingsFromApi(response);
        setSettings(loaded);
        setSavedSettings(loaded);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) return;
        setLoadError(error instanceof Error ? error.message : '설정을 불러오지 못했습니다.');
      });
    return () => controller.abort();
  }, [reload]);

  useEffect(() => () => mutationController.current?.abort(), []);

  const updateSetting = <Key extends keyof AdminSettingsState>(key: Key, value: AdminSettingsState[Key]) => {
    setSettings((current) => current ? { ...current, [key]: value } : current);
    setSaveError(null);
    setToast(false);
  };
  const hasChanges = settings !== null && savedSettings !== null
    && (Object.keys(settings) as (keyof AdminSettingsState)[]).some((key) => settings[key] !== savedSettings[key]);

  const save = async () => {
    if (!settings || !savedSettings || saveLock.current) return;
    setSaveError(null);
    let updates;
    try {
      updates = changedSettings(settings, savedSettings);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '설정값을 확인해주세요.');
      return;
    }
    if (Object.keys(updates).length === 0) {
      setSettings(savedSettings);
      return;
    }
    saveLock.current = true;
    setIsSaving(true);
    const controller = new AbortController();
    mutationController.current = controller;
    try {
      const response = await updateAdminSettings(updates, controller.signal);
      if (controller.signal.aborted) return;
      const saved = settingsFromApi(response);
      setSettings(saved);
      setSavedSettings(saved);
      setToast(true);
    } catch (error) {
      if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) return;
      setSaveError(error instanceof Error ? error.message : '설정을 저장하지 못했습니다. 다시 시도해주세요.');
    } finally {
      saveLock.current = false;
      if (!controller.signal.aborted) setIsSaving(false);
    }
  };

  return (
    <AdminShell
      activePage="settings"
      title="시스템 설정"
      description="신고 자동 숨김과 등록된 운영 설정을 관리합니다."
      breadcrumbs={[{ label: '관리자', href: '/admin' }, { label: '시스템 설정' }]}
      showRefresh={false}
      headerActions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!hasChanges || isSaving}
            onClick={() => { setSettings(savedSettings); setSaveError(null); setToast(false); }}
            className="h-10 rounded-2xl border border-[#d0d5dd] bg-white px-4 text-sm font-semibold text-[#344054] disabled:cursor-not-allowed disabled:text-[#98a2b3]"
          >되돌리기</button>
          <button
            type="button"
            disabled={!hasChanges || isSaving}
            onClick={() => void save()}
            className="h-10 rounded-2xl bg-[#315ef5] px-4 text-sm font-semibold text-white hover:bg-[#2448c9] disabled:cursor-not-allowed disabled:bg-[#98a2b3]"
          >{isSaving ? '저장 중…' : '변경사항 저장'}</button>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-[1200px] p-4 sm:p-6 lg:p-8">
        {loadError ? (
          <AdminStatePanel state="error" description={loadError} onRetry={() => setReload((current) => current + 1)} />
        ) : !settings ? (
          <AdminStatePanel state="loading" />
        ) : (
          <>
            <p className="mb-4 rounded-2xl border border-[#fedf89] bg-[#fffaeb] p-4 text-[13px] leading-5 text-[#93370d]">
              새 신고 접수 알림, 기본 제재 수준, 신고 재검토 기한은 현재 설정값 저장만 지원합니다. 저장해도 알림 발송, 제재 기본값 적용, 기한 강조 기능에는 아직 반영되지 않습니다.
            </p>
            {saveError ? <p role="alert" className="mb-4 text-sm text-[#b42318]">{saveError}</p> : null}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <SettingsCard icon={Wrench} title="자동화" description="신고 누적에 따른 콘텐츠 자동 숨김을 설정합니다.">
                <SettingsSwitch
                  checked={settings.autoHideReports}
                  label="신고 누적 시 자동 숨김"
                  description="동일 콘텐츠 신고 수가 임계값에 도달하면 자동으로 숨깁니다."
                  disabled={isSaving}
                  onChange={(value) => updateSetting('autoHideReports', value)}
                />
                <label className="mt-4 block">
                  <span className={fieldLabelClassName}>자동 숨김 임계값 (신고 수)</span>
                  <input type="number" min="1" step="1" disabled={isSaving} value={settings.autoHideThreshold} onChange={(event) => updateSetting('autoHideThreshold', event.target.value)} className={fieldClassName} />
                </label>
                <div className="pt-4">
                  <SettingsSwitch
                    checked={settings.newReportNotification}
                    label="새 신고 접수 알림"
                    description="설정값 저장만 지원하며 알림 발송에는 아직 적용되지 않습니다."
                    disabled={isSaving}
                    onChange={(value) => updateSetting('newReportNotification', value)}
                  />
                </div>
              </SettingsCard>
              <SettingsCard icon={ShieldCheck} title="제재 정책" description="설정값 저장만 지원하며 처리 화면에는 아직 적용되지 않습니다.">
                <label className="relative block">
                  <span className={fieldLabelClassName}>기본 제재 수준</span>
                  <select disabled={isSaving} value={settings.defaultSanction} onChange={(event) => updateSetting('defaultSanction', event.target.value as AdminSanctionChoice)} className={fieldClassName + ' appearance-none pr-10'}>
                    <option value="warning">경고</option>
                    <option value="3-days">3일 정지</option>
                    <option value="7-days">7일 정지</option>
                    <option value="30-days">30일 정지</option>
                    <option value="permanent">영구 정지</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 bottom-3 size-4 text-[#98a2b3]" aria-hidden="true" />
                </label>
                <label className="mt-4 block">
                  <span className={fieldLabelClassName}>신고 재검토 기한 (일)</span>
                  <input type="number" min="1" step="1" aria-label="신고 재검토 기한 (일)" aria-describedby="report-review-description" disabled={isSaving} value={settings.reportReviewDays} onChange={(event) => updateSetting('reportReviewDays', event.target.value)} className={fieldClassName} />
                  <span id="report-review-description" className="block pt-1 text-xs text-[#667085]">설정값 저장만 지원하며 신고 기한 강조에는 아직 적용되지 않습니다.</span>
                </label>
              </SettingsCard>
              <SettingsCard icon={ClipboardList} title="작업 이력" description="관리자의 운영 처리 내역을 확인합니다.">
                <Link href="/admin/audit-logs" className="flex items-center justify-between rounded-2xl border border-[#e4e7ec] px-4 py-3 text-sm font-semibold text-[#344054] hover:bg-[#f9fafb]">
                  <span>작업 이력 보기</span><span className="text-[#315ef5]">바로가기 →</span>
                </Link>
              </SettingsCard>
            </div>
          </>
        )}
      </div>
      {toast ? <AdminToast variant="success" title="설정을 저장했습니다." onDismiss={dismissToast} /> : null}
    </AdminShell>
  );
}
