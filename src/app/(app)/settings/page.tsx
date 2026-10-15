'use client';

import { ChevronRight, Moon, Settings, Sun, Trash2, User } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/context/AuthContext';
import { useConfirm } from '@/app/context/ConfirmContext';
import { useToast } from '@/app/context/ToastContext';
import { deleteMyAccount } from '@/lib/account-api';
import { changePassword } from '@/lib/auth-api';
import { validatePassword } from '@/lib/auth-validation';
import { ThemeMode, loadUserSettings, saveUserSettings } from '@/lib/user-settings';

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
      toast.error('비밀번호 입력칸을 모두 채워주세요.');
      return;
    }

    if (passwordFields.next !== passwordFields.confirm) {
      toast.error('새 비밀번호 확인이 일치하지 않습니다.');
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
              className="w-full cursor-not-allowed rounded-lg border border-zinc-300 bg-zinc-100 px-4 py-2.5 text-zinc-500 dark:placeholder:!text-zinc-400"
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
              className="w-full cursor-not-allowed rounded-lg border border-zinc-300 bg-zinc-100 px-4 py-2.5 text-zinc-500 dark:placeholder:!text-zinc-400"
            />
            <span id="handle-description" className="mt-1 block text-xs text-zinc-500">
              사용자 이름은 변경할 수 없습니다.
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-200 pt-6">
        <h3 className="mb-4 text-lg font-bold text-black">비밀번호 변경</h3>
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
                  className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-black transition-colors focus:border-black focus:outline-none dark:focus:!border-[#f5b93d] dark:focus:ring-1 dark:focus:ring-[#f5b93d]"
                />
              </label>
            ))}
            <button
              type="button"
              onClick={handlePasswordChange}
              disabled={isChangingPassword}
              className="rounded-lg bg-black px-6 py-2.5 font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              비밀번호 변경
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-zinc-200 pt-6">
        <h3 className="mb-4 text-lg font-bold text-red-600 dark:text-red-300">위험 영역</h3>
        <div className="rounded-lg border-2 border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
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
              className="flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-red-500 px-4 py-2 font-semibold text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-700 dark:hover:bg-red-800"
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
                      active ? 'bg-black text-white dark:bg-[#f5b93d] dark:text-black' : 'text-zinc-700 hover:bg-zinc-100 dark:hover:bg-neutral-800'
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
