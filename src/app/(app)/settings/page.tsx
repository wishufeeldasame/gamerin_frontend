'use client';

import { ChevronRight, LogOut, Moon, Sun, Trash2, User } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/context/AuthContext';
import { useConfirm } from '@/app/context/ConfirmContext';
import { useToast } from '@/app/context/ToastContext';
import { deleteMyAccount } from '@/lib/account-api';
import { changePassword } from '@/lib/auth-api';
import { validatePassword } from '@/lib/auth-validation';
import { ThemeMode, loadUserSettings, saveUserSettings } from '@/lib/user-settings';
import { RepresentativeGameSetting } from './RepresentativeGameSetting';

type SettingsSection = 'account' | 'appearance';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [activeSection, setActiveSection] = useState<SettingsSection>('account');
  const [theme, setTheme] = useState<ThemeMode>(() => loadUserSettings().theme);
  const [passwordFields, setPasswordFields] = useState({
    current: '',
    next: '',
    confirm: '',
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const handleThemeChange = (nextTheme: ThemeMode) => {
    setTheme(nextTheme);
    saveUserSettings({ theme: nextTheme });
  };

  const handlePasswordChange = async () => {
    if (!passwordFields.current || !passwordFields.next || !passwordFields.confirm) {
      toast.error('비밀번호 입력칸을 모두 채워 주세요.');
      return;
    }

    if (passwordFields.next !== passwordFields.confirm) {
      toast.error('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    const passwordError = validatePassword(passwordFields.next);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    setIsChangingPassword(true);
    try {
      await changePassword(passwordFields.current, passwordFields.next, passwordFields.confirm);
      setPasswordFields({ current: '', next: '', confirm: '' });
      toast.success('비밀번호가 변경되었습니다. 다른 기기에서는 다시 로그인해야 합니다.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast.error(error instanceof Error ? error.message : '비밀번호를 변경하지 못했습니다.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (isDeletingAccount) return;
    const confirmed = await confirm({
      message: [
        '정말 계정을 삭제할까요? 확인하면 즉시 탈퇴되며 되돌릴 수 없습니다.',
        '',
        '· 작성한 게시글·댓글, 팔로우, 북마크, 알림이 삭제됩니다.',
        '· 남은 마일리지는 소멸되며 환급되지 않습니다.',
        '· 진행 중이거나 정산 전인 멘토링이 있으면 탈퇴할 수 없습니다.',
      ].join('\n'),
      confirmLabel: '탈퇴하기',
      danger: true,
    });
    if (!confirmed) return;

    setIsDeletingAccount(true);
    try {
      await deleteMyAccount();
      toast.success('계정이 삭제되었습니다.');
      await logout({ redirectTo: '/login' });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast.error(error instanceof Error ? error.message : '계정을 삭제하지 못했습니다.');
      setIsDeletingAccount(false);
    }
  };

  const renderAccountSection = () => (
    <div className="space-y-6">
      <Link href="/reports/my" className="flex h-12 items-center justify-between rounded-xl border border-zinc-200 px-4 text-sm font-bold text-black dark:border-zinc-700 dark:text-zinc-100">
        내 신고
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Link>
      <div>
        <h3 className="section-title mb-4">계정 정보</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="account-handle" className="mb-2 block text-sm font-semibold text-zinc-700">
              아이디
            </label>
            <input
              id="account-handle"
              type="text"
              value={user?.handle ? `@${user.handle}` : ''}
              readOnly
              placeholder="아이디 정보가 없습니다"
              aria-describedby="handle-description"
              className="input-base cursor-not-allowed bg-zinc-100 text-zinc-500 dark:placeholder:!text-zinc-400"
            />
            <span id="handle-description" className="mt-1 block text-xs text-zinc-500">
              아이디는 변경할 수 없습니다.
            </span>
          </div>
        </div>
      </div>

      <RepresentativeGameSetting />

      <div className="border-t border-zinc-200 pt-6">
        <h3 className="section-title mb-4">비밀번호 변경</h3>
        {user?.hasPassword === false ? (
          <p className="text-sm text-zinc-600">소셜 로그인으로 가입한 계정은 비밀번호가 없어 변경할 수 없습니다.</p>
        ) : (
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
                  className="input-base"
                />
              </label>
            ))}
            <button
              type="button"
              onClick={handlePasswordChange}
              disabled={isChangingPassword}
              className="btn-primary"
            >
              비밀번호 변경
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-zinc-200 pt-6">
        <button type="button" onClick={() => void logout({ redirectTo: '/login' })} className="btn-secondary w-full sm:w-auto">
          <LogOut className="h-4 w-4" />
          로그아웃
        </button>
      </div>

      <div className="border-t border-zinc-200 pt-6">
        <h3 className="mb-4 text-lg font-black text-red-600 dark:text-red-300">계정 삭제</h3>
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-line">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h4 className="mb-1 font-bold text-black">계정 삭제</h4>
              <p className="text-sm text-zinc-600">
                계정과 작성한 게시글·댓글이 삭제되며 되돌릴 수 없습니다.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDeleteAccount}
              disabled={isDeletingAccount}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-5 text-sm font-bold text-red-600 transition hover:border-red-400 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-950/40"
            >
              <Trash2 className="h-4 w-4" />
              계정 삭제
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-4 border-t border-zinc-200 pt-6 text-sm font-semibold text-zinc-500">
        <Link href="/terms" className="hover:underline">
          이용약관
        </Link>
        <Link href="/privacy" className="hover:underline">
          개인정보 처리방침
        </Link>
      </div>
    </div>
  );

  const renderAppearanceSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="section-title mb-2">테마 설정</h3>
        <p className="mb-4 text-sm text-zinc-600">선택한 테마는 즉시 적용됩니다.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            type="button"
            aria-pressed={theme === 'light'}
            onClick={() => handleThemeChange('light')}
            className={`rounded-xl border-2 p-4 transition-all md:p-6 ${
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
            className={`rounded-xl border-2 p-4 transition-all md:p-6 ${
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
    <div className="min-h-screen bg-background">
      <div className="page-container">
        <h1 className="page-title mb-6">설정</h1>
        <div className="grid gap-4 lg:grid-cols-4 lg:gap-6">
          <div className="lg:col-span-1">
            <nav aria-label="설정 메뉴" className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1 lg:sticky lg:top-36 lg:block lg:space-y-1 lg:bg-transparent lg:p-0 dark:bg-surface-elevated lg:dark:bg-transparent">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;

                return (
                  <button
                    type="button"
                    key={item.id}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setActiveSection(item.id)}
                    className={`flex h-10 w-full items-center justify-center rounded-lg px-4 text-sm transition-colors lg:h-12 lg:justify-between ${
                      active ? 'bg-black text-white dark:bg-[#f5b93d] dark:text-black lg:dark:bg-[#f5b93d]/12 lg:dark:text-[#f5b93d] lg:dark:shadow-[inset_3px_0_0_#f5b93d]' : 'text-zinc-700 hover:bg-zinc-100 dark:hover:bg-surface-elevated'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="h-4 w-4 lg:h-5 lg:w-5" />
                      <span className="font-medium">{item.label}</span>
                    </span>
                    <ChevronRight className="hidden h-4 w-4 lg:block" />
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="lg:col-span-3">
            <div className="lg:rounded-xl lg:border lg:border-line lg:bg-surface lg:p-6">
              {activeSection === 'account' && renderAccountSection()}
              {activeSection === 'appearance' && renderAppearanceSection()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
