'use client';

import {
  Bell,
  ChevronRight,
  Globe,
  Lock,
  Moon,
  Settings,
  Sun,
  Trash2,
  User,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import {
  AccountSettings,
  LanguageCode,
  NotificationSettings,
  PrivacySettings,
  ThemeMode,
  UserSettings,
  loadUserSettings,
  saveUserSettings,
} from '@/lib/user-settings';

type SettingsSection = 'account' | 'privacy' | 'notifications' | 'appearance';

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="relative inline-flex cursor-pointer items-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span className="h-6 w-11 rounded-full bg-zinc-300 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-black peer-checked:after:translate-x-full" />
    </label>
  );
}

export default function SettingsPage() {
  const { user, updateUser, logout } = useAuth();
  const initialSettings = useMemo(() => loadUserSettings(), []);
  const [activeSection, setActiveSection] = useState<SettingsSection>('account');
  const [accountSettings, setAccountSettings] = useState<AccountSettings>(initialSettings.account);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(
    initialSettings.notifications
  );
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>(initialSettings.privacy);
  const [theme, setTheme] = useState<ThemeMode>(initialSettings.theme);
  const [language, setLanguage] = useState<LanguageCode>(initialSettings.language);
  const [savedTheme, setSavedTheme] = useState<ThemeMode>(initialSettings.theme);
  const [savedLanguage, setSavedLanguage] = useState<LanguageCode>(initialSettings.language);
  const [passwordFields, setPasswordFields] = useState({
    current: '',
    next: '',
    confirm: '',
  });
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    if (!user) return;

    setAccountSettings((current) => ({
      ...current,
      username: current.username === '@user123' && user.handle ? `@${user.handle}` : current.username,
      displayName: current.displayName === 'GamerIN User' ? user.nickname : current.displayName,
    }));
  }, [user]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.lang = language;
  }, [theme, language]);

  useEffect(() => {
    return () => {
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
      document.documentElement.lang = savedLanguage;
    };
  }, [savedLanguage, savedTheme]);

  const currentSettings: UserSettings = {
    account: accountSettings,
    privacy: privacySettings,
    notifications: notificationSettings,
    theme,
    language,
  };

  const showSavedMessage = (message: string) => {
    setSavedMessage(message);
    window.setTimeout(() => setSavedMessage(''), 1800);
  };

  const handleSave = () => {
    saveUserSettings(currentSettings);
    setSavedTheme(theme);
    setSavedLanguage(language);

    const nextHandle = accountSettings.username.trim().replace(/^@/, '');
    const nextName = accountSettings.displayName.trim();

    updateUser({
      handle: nextHandle || user?.handle,
      nickname: nextName || user?.nickname,
      name: nextName || user?.name,
    });

    showSavedMessage('변경사항이 저장되었습니다.');
  };

  const handlePasswordChange = () => {
    if (!passwordFields.current || !passwordFields.next || !passwordFields.confirm) {
      alert('비밀번호 입력칸을 모두 채워주세요.');
      return;
    }

    if (passwordFields.next !== passwordFields.confirm) {
      alert('새 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setPasswordFields({ current: '', next: '', confirm: '' });
    alert('현재는 프론트 미리보기입니다. 비밀번호 변경 API가 연결되면 실제 저장됩니다.');
  };

  const handleDeleteAccount = () => {
    const confirmed = window.confirm('프론트에 저장된 로그인 정보와 설정을 삭제하고 로그아웃할까요?');
    if (!confirmed) return;

    Object.keys(window.localStorage)
      .filter((key) => key.startsWith('gamerin_'))
      .forEach((key) => window.localStorage.removeItem(key));

    logout();
  };

  const renderAccountSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="mb-4 text-lg font-bold text-black">계정 정보</h3>
        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-zinc-700">이메일</span>
            <input
              type="email"
              value={accountSettings.email}
              onChange={(event) => setAccountSettings({ ...accountSettings, email: event.target.value })}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-black transition-colors focus:border-black focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-zinc-700">사용자 이름</span>
            <input
              type="text"
              value={accountSettings.username}
              onChange={(event) => setAccountSettings({ ...accountSettings, username: event.target.value })}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-black transition-colors focus:border-black focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-zinc-700">표시 이름</span>
            <input
              type="text"
              value={accountSettings.displayName}
              onChange={(event) => setAccountSettings({ ...accountSettings, displayName: event.target.value })}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-black transition-colors focus:border-black focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-zinc-700">전화번호</span>
            <input
              type="tel"
              value={accountSettings.phone}
              onChange={(event) => setAccountSettings({ ...accountSettings, phone: event.target.value })}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-black transition-colors focus:border-black focus:outline-none"
            />
          </label>
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
                현재 프론트에 저장된 로그인 정보, 프로필 이미지, 설정값을 삭제합니다.
              </p>
            </div>
            <button
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

  const renderPrivacySection = () => {
    const items = [
      ['profilePublic', '공개 프로필', '프로필 화면에 비공개 표시 여부를 반영합니다'],
      ['showEmail', '이메일 공개', '설정에 저장된 이메일 공개 여부를 저장합니다'],
      ['showStats', '게임 전적 공개', '프로필의 Stats 탭 표시 여부를 바꿉니다'],
      ['allowMessages', '메시지 허용', '메시지 허용 여부를 저장합니다'],
    ] as const;

    return (
      <div className="space-y-6">
        <div>
          <h3 className="mb-4 text-lg font-bold text-black">프라이버시 설정</h3>
          <div className="space-y-4">
            {items.map(([key, title, description]) => (
              <div key={key} className="flex items-center justify-between gap-4 rounded-lg bg-zinc-50 p-4">
                <div>
                  <h4 className="mb-1 font-semibold text-black">{title}</h4>
                  <p className="text-sm text-zinc-600">{description}</p>
                </div>
                <Toggle
                  checked={privacySettings[key]}
                  onChange={(checked) => setPrivacySettings({ ...privacySettings, [key]: checked })}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderNotificationsSection = () => {
    const items = [
      ['likes', '좋아요', '내 게시물에 좋아요가 달렸을 때 알림'],
      ['comments', '댓글', '내 게시물에 댓글이 달렸을 때 알림'],
      ['follows', '팔로우', '새로운 팔로워가 생겼을 때 알림'],
      ['mentions', '멘션', '누군가 나를 언급했을 때 알림'],
      ['messages', '메시지', '새로운 메시지가 도착했을 때 알림'],
    ] as const;

    return (
      <div className="space-y-6">
        <div>
          <h3 className="mb-4 text-lg font-bold text-black">알림 설정</h3>
          <div className="space-y-4">
            {items.map(([key, title, description]) => (
              <div key={key} className="flex items-center justify-between gap-4 rounded-lg bg-zinc-50 p-4">
                <div>
                  <h4 className="mb-1 font-semibold text-black">{title}</h4>
                  <p className="text-sm text-zinc-600">{description}</p>
                </div>
                <Toggle
                  checked={notificationSettings[key]}
                  onChange={(checked) =>
                    setNotificationSettings({ ...notificationSettings, [key]: checked })
                  }
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderAppearanceSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="mb-4 text-lg font-bold text-black">테마 설정</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            onClick={() => setTheme('light')}
            className={`rounded-xl border-2 p-6 transition-all ${
              theme === 'light' ? 'border-black bg-zinc-50' : 'border-zinc-200 hover:border-zinc-300'
            }`}
          >
            <Sun className="mx-auto mb-3 h-8 w-8 text-yellow-500" />
            <p className="font-semibold text-black">라이트 모드</p>
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`rounded-xl border-2 p-6 transition-all ${
              theme === 'dark' ? 'border-black bg-zinc-50' : 'border-zinc-200 hover:border-zinc-300'
            }`}
          >
            <Moon className="mx-auto mb-3 h-8 w-8 text-blue-500" />
            <p className="font-semibold text-black">다크 모드</p>
          </button>
        </div>
      </div>

      <div className="border-t border-zinc-200 pt-6">
        <h3 className="mb-4 text-lg font-bold text-black">언어 설정</h3>
        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value as LanguageCode)}
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-black transition-colors focus:border-black focus:outline-none"
        >
          <option value="ko">한국어</option>
          <option value="en">English</option>
          <option value="ja">日本語</option>
          <option value="zh">中文</option>
        </select>
      </div>
    </div>
  );

  const navItems = [
    { id: 'account' as const, icon: User, label: '계정' },
    { id: 'privacy' as const, icon: Lock, label: '프라이버시' },
    { id: 'notifications' as const, icon: Bell, label: '알림' },
    { id: 'appearance' as const, icon: Globe, label: '테마/언어' },
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
            <nav className="sticky top-36 grid gap-1 sm:grid-cols-2 lg:block lg:space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`flex w-full items-center justify-between rounded-lg px-4 py-3 transition-colors ${
                      active ? 'bg-black text-white' : 'text-zinc-700 hover:bg-zinc-100'
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
              {activeSection === 'privacy' && renderPrivacySection()}
              {activeSection === 'notifications' && renderNotificationsSection()}
              {activeSection === 'appearance' && renderAppearanceSection()}
            </div>

            <div className="mt-6 flex items-center justify-end gap-4">
              {savedMessage ? <p className="text-sm font-bold text-green-600">{savedMessage}</p> : null}
              <button
                onClick={handleSave}
                className="rounded-lg bg-black px-8 py-3 font-semibold text-white transition-colors hover:bg-zinc-800"
              >
                변경사항 저장
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
