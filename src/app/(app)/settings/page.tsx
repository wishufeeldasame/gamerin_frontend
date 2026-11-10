'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/context/AuthContext';
import { useConfirm } from '@/app/context/ConfirmContext';
import { useToast } from '@/app/context/ToastContext';
import { deleteMyAccount } from '@/lib/account-api';
import { changePassword } from '@/lib/auth-api';
import { validatePassword } from '@/lib/auth-validation';
import { canGoBack } from '@/lib/history-back';
import { RepresentativeGameSetting } from './RepresentativeGameSetting';

type SettingsSection = 'account' | 'personalization';

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg-brand dark:focus-visible:outline-line-focus';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<SettingsSection>('account');
  const [passwordFields, setPasswordFields] = useState({
    current: '',
    next: '',
    confirm: '',
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

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
    { id: 'account' as const, label: '계정' },
    { id: 'personalization' as const, label: '개인화' },
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

      <div className="mx-4 max-w-[640px] pb-6 pt-1 lg:ml-6 lg:mr-0 lg:pt-6">
        {/* 데스크톱 제목(F15). 모바일에서는 숨긴다. */}
        <header className="mb-4 hidden lg:block">
          <h1 className="text-title text-fg-primary">설정</h1>
        </header>

        <div>
          <div className="mb-3 lg:mb-4">
            <nav aria-label="설정 메뉴" className="flex gap-6 border-b border-line">
              {navItems.map((item) => {
                const active = activeSection === item.id;

                return (
                  <button
                    type="button"
                    key={item.id}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setActiveSection(item.id)}
                    className={`-mb-px flex h-12 items-center border-b-2 text-body transition-colors ${FOCUS_RING} ${
                      active
                        ? 'border-brand text-fg-primary'
                        : 'border-transparent text-fg-secondary hover:text-fg-primary'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div>
            <div>
              {activeSection === 'account' && (
                <div className="space-y-3 lg:space-y-4">
                  <section aria-labelledby="account-heading" className="rounded-card bg-surface p-6">
                    <h2 id="account-heading" className="mb-4 text-heading text-fg-primary">계정 정보</h2>
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
                          className="input-base"
                        />
                        <span id="handle-description" className="sr-only">
                          아이디는 변경할 수 없습니다.
                        </span>
                      </div>
                    </div>
                    <Link
                      href="/reports/my"
                      className={`mt-3 flex min-h-[50px] items-center justify-between rounded-control border border-line px-3.5 text-body text-fg-primary transition hover:bg-subtle ${FOCUS_RING}`}
                    >
                      내 신고
                      <ChevronRight className="h-4 w-4 text-fg-secondary" aria-hidden="true" />
                    </Link>
                  </section>

                  <section aria-labelledby="password-heading" className="rounded-card bg-surface p-6">
                    <h2 id="password-heading" className="mb-4 text-heading text-fg-primary">비밀번호 변경</h2>
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
                              autoComplete={key === 'current' ? 'current-password' : 'new-password'}
                              placeholder={label}
                              value={passwordFields[key as keyof typeof passwordFields]}
                              onChange={(event) => setPasswordFields({ ...passwordFields, [key]: event.target.value })}
                              className="input-base"
                            />
                          </label>
                        ))}
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={handlePasswordChange}
                            disabled={isChangingPassword}
                            className="btn-primary"
                          >
                            비밀번호 변경
                          </button>
                        </div>
                      </div>
                    )}
                  </section>

                  <section aria-label="로그아웃" className="flex items-center justify-between gap-4 rounded-card bg-surface px-6 py-4">
                    <p className="text-body text-fg-secondary">이 기기에서 로그아웃합니다.</p>
                    <button
                      type="button"
                      onClick={() => void logout({ redirectTo: '/?login=1' })}
                      className="btn-secondary"
                    >
                      로그아웃
                    </button>
                  </section>

                  <section aria-labelledby="danger-heading" className="rounded-card border border-line-danger bg-surface p-6">
                    <h2 id="danger-heading" className="mb-4 text-heading text-fg-danger">위험 영역</h2>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h3 className="mb-1 text-label text-fg-primary">계정 삭제</h3>
                        <p className="text-caption text-fg-secondary">
                          계정과 작성한 게시글·댓글이 삭제되며 되돌릴 수 없습니다.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleDeleteAccount}
                        disabled={isDeletingAccount}
                        className={`inline-flex h-10 shrink-0 items-center justify-center rounded-control bg-danger-subtle px-4 text-label text-fg-danger transition hover:bg-danger-subtle/70 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
                      >
                        계정 삭제
                      </button>
                    </div>
                  </section>

                  <div className="flex gap-4 pt-2 text-label text-fg-tertiary">
                    <Link href="/terms" className="hover:underline">
                      이용약관
                    </Link>
                    <Link href="/privacy" className="hover:underline">
                      개인정보 처리방침
                    </Link>
                  </div>
                </div>
              )}

              {activeSection === 'personalization' && (
                <div className="space-y-3 lg:space-y-4">
                  <RepresentativeGameSetting />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
