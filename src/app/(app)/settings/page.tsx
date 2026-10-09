'use client';

import { ChevronRight, Moon, Settings, Sun, Trash2, User } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/context/AuthContext';
import { useToast } from '@/app/context/ToastContext';
import { ThemeMode, loadUserSettings, saveUserSettings } from '@/lib/user-settings';

type SettingsSection = 'account' | 'appearance';

export default function SettingsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [activeSection, setActiveSection] = useState<SettingsSection>('account');
  const [theme, setTheme] = useState<ThemeMode>(() => loadUserSettings().theme);
  const [passwordFields, setPasswordFields] = useState({
    current: '',
    next: '',
    confirm: '',
  });

  const handleThemeChange = (nextTheme: ThemeMode) => {
    setTheme(nextTheme);
    saveUserSettings({ theme: nextTheme });
  };

  const handlePasswordChange = () => {
    if (!passwordFields.current || !passwordFields.next || !passwordFields.confirm) {
      toast.error('비밀번호 입력칸을 모두 채워주세요.');
      return;
    }

    if (passwordFields.next !== passwordFields.confirm) {
      toast.error('새 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setPasswordFields({ current: '', next: '', confirm: '' });
    toast.info('현재는 프론트 미리보기입니다. 비밀번호 변경 API가 연결되면 실제 저장됩니다.');
  };

  const handleDeleteAccount = () => {
    toast.info('계정 삭제 기능은 준비 중입니다. 현재 계정과 저장된 정보는 삭제되지 않습니다.');
  };

  const renderAccountSection = () => (
    <div className="space-y-6">
      <Link href="/reports/my" className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 font-semibold text-black dark:border-zinc-700 dark:text-zinc-100">
        내 신고
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Link>
      <div>
        <h3 className="mb-4 text-lg font-bold text-black">계정 정보</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="account-email" className="mb-2 block text-sm font-semibold text-zinc-700">
              이메일
            </label>
            <input
              id="account-email"
              type="email"
              value=""
              readOnly
              placeholder="제공되는 이메일 정보가 없습니다"
              aria-describedby="email-description"
              className="w-full cursor-not-allowed rounded-lg border border-zinc-300 bg-zinc-100 px-4 py-2.5 text-zinc-500"
            />
            <span id="email-description" className="mt-1 block text-xs text-zinc-500">
              이메일 변경 기능은 제공되지 않습니다.
            </span>
          </div>
          <div>
            <label htmlFor="account-handle" className="mb-2 block text-sm font-semibold text-zinc-700">
              사용자 이름
            </label>
            <input
              id="account-handle"
              type="text"
              value={user?.handle ? `@${user.handle}` : ''}
              readOnly
              placeholder="사용자 이름 정보가 없습니다"
              aria-describedby="handle-description"
              className="w-full cursor-not-allowed rounded-lg border border-zinc-300 bg-zinc-100 px-4 py-2.5 text-zinc-500"
            />
            <span id="handle-description" className="mt-1 block text-xs text-zinc-500">
              사용자 이름은 변경할 수 없습니다.
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-200 pt-6">
        <h3 className="mb-4 text-lg font-bold text-black">비밀번호 변경</h3>
        <div className="space-y-4">
          {[
            ['current', '현재 비밀번호'],
            ['next', '새 비밀번호'],
            ['confirm', '새 비밀번호 확인'],
          ].map(([key, label]) => (
            <label key={key} className="block">
              <span className="mb-2 block text-sm font-semibold text-zinc-700">{label}</span>
              <input
                type="password"
                value={passwordFields[key as keyof typeof passwordFields]}
                onChange={(event) => setPasswordFields({ ...passwordFields, [key]: event.target.value })}
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-black transition-colors focus:border-black focus:outline-none"
              />
            </label>
          ))}
          <button
            type="button"
            onClick={handlePasswordChange}
            className="rounded-lg bg-black px-6 py-2.5 font-semibold text-white transition-colors hover:bg-zinc-800"
          >
            비밀번호 변경
          </button>
        </div>
      </div>

      <div className="border-t border-zinc-200 pt-6">
        <h3 className="mb-4 text-lg font-bold text-red-600">위험 영역</h3>
        <div className="rounded-lg border-2 border-red-200 bg-red-50 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h4 className="mb-1 font-bold text-black">계정 삭제</h4>
              <p className="text-sm text-zinc-600">
                계정 삭제 기능은 준비 중입니다. 현재 이 버튼으로 계정이나 저장된 정보가 삭제되지 않습니다.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDeleteAccount}
              className="flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-red-500 px-4 py-2 font-semibold text-white transition-colors hover:bg-red-600"
            >
              <Trash2 className="h-4 w-4" />
              계정 삭제
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAppearanceSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-lg font-bold text-black">테마 설정</h3>
        <p className="mb-4 text-sm text-zinc-600">선택한 테마는 즉시 적용됩니다.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            type="button"
            aria-pressed={theme === 'light'}
            onClick={() => handleThemeChange('light')}
            className={`rounded-xl border-2 p-6 transition-all ${
              theme === 'light' ? 'border-black bg-zinc-50' : 'border-zinc-200 hover:border-zinc-300'
            }`}
          >
            <Sun className="mx-auto mb-3 h-8 w-8 text-yellow-500" />
            <p className="font-semibold text-black">라이트 모드</p>
          </button>
          <button
            type="button"
            aria-pressed={theme === 'dark'}
            onClick={() => handleThemeChange('dark')}
            className={`rounded-xl border-2 p-6 transition-all ${
              theme === 'dark' ? 'border-black bg-zinc-50' : 'border-zinc-200 hover:border-zinc-300'
            }`}
          >
            <Moon className="mx-auto mb-3 h-8 w-8 text-blue-500" />
            <p className="font-semibold text-black">다크 모드</p>
          </button>
        </div>
      </div>
    </div>
  );

  const navItems = [
    { id: 'account' as const, icon: User, label: '계정' },
    { id: 'appearance' as const, icon: Moon, label: '테마' },
  ];

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-16 z-10 border-b border-zinc-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-black" />
          <h1 className="text-2xl font-bold text-black">설정</h1>
        </div>
      </div>

      <div className="mx-auto max-w-5xl p-6">
        <div className="grid gap-6 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <nav aria-label="설정 메뉴" className="sticky top-36 grid gap-1 sm:grid-cols-2 lg:block lg:space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;

                return (
                  <button
                    type="button"
                    key={item.id}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setActiveSection(item.id)}
                    className={`flex w-full items-center justify-between rounded-lg px-4 py-3 transition-colors ${
                      active ? 'bg-black text-white dark:bg-[#f5b93d] dark:text-black' : 'text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="h-5 w-5" />
                      <span className="font-medium">{item.label}</span>
                    </span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="lg:col-span-3">
            <div className="rounded-xl border border-zinc-200 bg-white p-6">
              {activeSection === 'account' && renderAccountSection()}
              {activeSection === 'appearance' && renderAppearanceSection()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
