'use client';

import { ChevronLeft, ChevronRight, LogOut, Moon, Sun, Trash2, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/context/AuthContext';
import { useConfirm } from '@/app/context/ConfirmContext';
import { useToast } from '@/app/context/ToastContext';
import { deleteMyAccount } from '@/lib/account-api';
import { changePassword } from '@/lib/auth-api';
import { validatePassword } from '@/lib/auth-validation';
import { ThemeMode, loadUserSettings, saveUserSettings, saveThemeToServer } from '@/lib/user-settings';
import { canGoBack } from '@/lib/history-back';
import { RepresentativeGameSetting } from './RepresentativeGameSetting';

type SettingsSection = 'account' | 'appearance';

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg-brand dark:focus-visible:outline-line-focus';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<SettingsSection>('account');
  const [theme, setTheme] = useState<ThemeMode>(() => loadUserSettings().theme);
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [passwordFields, setPasswordFields] = useState({
    current: '',
    next: '',
    confirm: '',
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const handleThemeChange = async (nextTheme: ThemeMode) => {
    setTheme(nextTheme);
    saveUserSettings({ theme: nextTheme });
    if (!user) return;
    setIsSavingTheme(true);
    try {
      await saveThemeToServer(nextTheme);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast.error(error instanceof Error ? error.message : '테마를 저장하지 못했습니다.');
    } finally {
      setIsSavingTheme(false);
    }
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
      await logout({ redirectTo: '/?login=1' });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast.error(error instanceof Error ? error.message : '계정을 삭제하지 못했습니다.');
      setIsDeletingAccount(false);
    }
  };

  const navItems = [
    { id: 'account' as const, icon: User, label: '계정' },
    { id: 'appearance' as const, icon: Moon, label: '테마' },
  ];

  return (
    <>
      {/* 모바일 뒤로 헤더(F15). lg 이상에서는 숨긴다. */}
      <header className="sticky top-0 z-20 flex min-h-[calc(3.5rem+env(safe-area-inset-top))] items-center gap-2 bg-canvas px-2 pt-[env(safe-area-inset-top)] lg:hidden">
        <button
          type="button"
          aria-label="뒤로"
          className={`btn-icon ${FOCUS_RING}`}
          onClick={() => {
            if (canGoBack()) router.back();
            else router.replace('/profile');
          }}
        >
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
        <h1 className="text-heading text-fg-primary">설정</h1>
      </header>

      <div className="mx-4 max-w-[940px] pb-6 pt-1 md:mx-6 lg:pt-6">
        {/* 데스크톱 제목(F15). 모바일에서는 숨긴다. */}
        <header className="mb-5 hidden lg:block">
          <h1 className="text-title text-fg-primary">설정</h1>
        </header>

        <div className="grid gap-4 lg:grid-cols-4 lg:gap-6">
          <div className="lg:col-span-1">
            <nav aria-label="설정 메뉴" className="grid grid-cols-2 gap-1 rounded-control bg-subtle p-1 lg:sticky lg:top-28 lg:block lg:space-y-1 lg:bg-transparent lg:p-0">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;

                return (
                  <button
                    type="button"
                    key={item.id}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setActiveSection(item.id)}
                    className={`flex h-10 w-full items-center justify-center rounded-control px-4 text-label transition-colors lg:h-12 lg:justify-between ${FOCUS_RING} ${
                      active
                        ? 'bg-fg-primary text-canvas lg:bg-transparent lg:text-fg-brand lg:shadow-[inset_3px_0_0_#f5b93d]'
                        : 'text-fg-secondary hover:bg-subtle'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="h-4 w-4 lg:h-5 lg:w-5" />
                      <span className="font-semibold">{item.label}</span>
                    </span>
                    <ChevronRight className="hidden h-4 w-4 lg:block" />
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="lg:col-span-3">
            <div className="rounded-card border border-line-card bg-surface p-4 lg:p-6">
              {activeSection === 'account' && (
                <div className="space-y-6">
                  <Link
                    href="/reports/my"
                    className={`flex h-12 items-center justify-between rounded-control px-4 text-label text-fg-primary transition hover:bg-subtle ${FOCUS_RING}`}
                  >
                    내 신고
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Link>

                  <div>
                    <h3 className="mb-3 text-heading text-fg-primary">계정 정보</h3>
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="account-handle" className="mb-2 block text-label text-fg-secondary">
                          아이디
                        </label>
                        <input
                          id="account-handle"
                          type="text"
                          value={user?.handle ? `@${user.handle}` : ''}
                          readOnly
                          placeholder="아이디 정보가 없습니다"
                          aria-describedby="handle-description"
                          className="input-base cursor-not-allowed opacity-60"
                        />
                        <span id="handle-description" className="mt-1 block text-caption text-fg-tertiary">
                          아이디는 변경할 수 없습니다.
                        </span>
                      </div>
                    </div>
                  </div>

                  <RepresentativeGameSetting />

                  <div className="border-t border-line pt-6">
                    <h3 className="mb-3 text-heading text-fg-primary">비밀번호 변경</h3>
                    {user?.hasPassword === false ? (
                      <p className="text-body text-fg-secondary">소셜 로그인으로 가입한 계정은 비밀번호가 없어 변경할 수 없습니다.</p>
                    ) : (
                      <div className="space-y-4">
                        {[
                          ['current', '현재 비밀번호'],
                          ['next', '새 비밀번호'],
                          ['confirm', '새 비밀번호 확인'],
                        ].map(([key, label]) => (
                          <label key={key} className="block">
                            <span className="mb-2 block text-label text-fg-secondary">{label}</span>
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

                  <div className="border-t border-line pt-6">
                    <button
                      type="button"
                      onClick={() => void logout({ redirectTo: '/?login=1' })}
                      className="btn-secondary w-full sm:w-auto"
                    >
                      <LogOut className="h-4 w-4" />
                      로그아웃
                    </button>
                  </div>

                  <div className="border-t border-line pt-6">
                    <h3 className="mb-3 text-heading text-fg-danger">계정 삭제</h3>
                    <div className="rounded-control border border-line p-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h4 className="mb-1 text-label text-fg-primary">계정 삭제</h4>
                          <p className="text-body text-fg-secondary">
                            계정과 작성한 게시글·댓글이 삭제되며 되돌릴 수 없습니다.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleDeleteAccount}
                          disabled={isDeletingAccount}
                          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-control border border-red-200 bg-surface px-5 text-label text-fg-danger transition hover:border-red-400 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900 dark:bg-transparent dark:hover:bg-red-950/40"
                        >
                          <Trash2 className="h-4 w-4" />
                          계정 삭제
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 border-t border-line pt-6 text-label text-fg-tertiary">
                    <Link href="/terms" className="hover:underline">
                      이용약관
                    </Link>
                    <Link href="/privacy" className="hover:underline">
                      개인정보 처리방침
                    </Link>
                  </div>
                </div>
              )}

              {activeSection === 'appearance' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="mb-2 text-heading text-fg-primary">테마 설정</h3>
                    <p className="mb-4 text-body text-fg-secondary">
                      선택한 테마는 모든 기기에 동일하게 적용됩니다.
                    </p>
                    <fieldset disabled={isSavingTheme} className="space-y-3">
                      <legend className="sr-only">테마 선택</legend>
                      <button
                        type="button"
                        aria-pressed={theme === 'light'}
                        onClick={() => void handleThemeChange('light')}
                        className={`flex w-full items-center gap-4 rounded-card border-2 p-5 text-left transition ${FOCUS_RING} ${
                          theme === 'light'
                            ? 'border-fg-brand bg-brand-subtle'
                            : 'border-line-card bg-surface hover:border-line'
                        }`}
                      >
                        <Sun className="h-8 w-8 shrink-0 text-fg-brand" aria-hidden="true" />
                        <div>
                          <p className="text-heading text-fg-primary">라이트 모드</p>
                          <p className="text-caption text-fg-secondary">밝은 배경에 어두운 글자</p>
                        </div>
                      </button>
                      <button
                        type="button"
                        aria-pressed={theme === 'dark'}
                        onClick={() => void handleThemeChange('dark')}
                        className={`flex w-full items-center gap-4 rounded-card border-2 p-5 text-left transition ${FOCUS_RING} ${
                          theme === 'dark'
                            ? 'border-fg-brand bg-brand-subtle'
                            : 'border-line-card bg-surface hover:border-line'
                        }`}
                      >
                        <Moon className="h-8 w-8 shrink-0 text-fg-brand" aria-hidden="true" />
                        <div>
                          <p className="text-heading text-fg-primary">다크 모드</p>
                          <p className="text-caption text-fg-secondary">어두운 배경에 밝은 글자</p>
                        </div>
                      </button>
                    </fieldset>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}