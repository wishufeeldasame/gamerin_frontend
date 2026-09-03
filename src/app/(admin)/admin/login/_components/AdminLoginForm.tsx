'use client';

import { Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { AdminToast } from '../../_components/AdminToast';

const inputClassName =
  'h-11 w-full rounded-2xl border border-[#d0d5dd] bg-white px-[15px] text-sm font-normal text-[#172033] outline-none transition placeholder:text-[rgba(23,32,51,0.5)] hover:border-[#98a2b3] focus:border-[#315ef5] focus:ring-2 focus:ring-[#315ef5]/10 dark:!border-[#d0d5dd] dark:!bg-white dark:!text-[#172033]';

type LoginToast = { id: number; variant: 'success' | 'error'; title: string; description: string };

export function AdminLoginForm() {
  const router = useRouter();
  const [adminId, setAdminId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<LoginToast | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!adminId.trim() || !password) {
      setToast({ id: Date.now(), variant: 'error', title: '로그인 정보를 확인해주세요.', description: '아이디와 비밀번호를 모두 입력해야 합니다.' });
      return;
    }

    if (adminId.trim() !== 'admin01' || password !== 'admin') {
      setToast({ id: Date.now(), variant: 'error', title: '로그인에 실패했습니다.', description: '데모 계정 정보를 다시 확인해주세요.' });
      return;
    }

    setIsSubmitting(true);
    setToast({ id: Date.now(), variant: 'success', title: '관리자 로그인에 성공했습니다.', description: '대시보드로 이동합니다.' });
    window.setTimeout(() => router.push('/admin'), 600);
  };

  return (
    <>
      <form className="mt-6 rounded-[20px] border border-[#e4e7ec] bg-white p-6 shadow-[0_1px_1.5px_rgba(16,24,40,0.08)] sm:p-[29px]" onSubmit={handleSubmit} noValidate>
        <div>
          <label htmlFor="admin-id" className="mb-1.5 block text-[13px] font-semibold text-[#344054]">아이디</label>
          <input id="admin-id" name="adminId" type="text" value={adminId} onChange={(event) => setAdminId(event.target.value)} autoComplete="username" placeholder="관리자 아이디" className={inputClassName} />
        </div>
        <div className="mt-4">
          <label htmlFor="admin-password" className="mb-1.5 block text-[13px] font-semibold text-[#344054]">비밀번호</label>
          <div className="relative">
            <input id="admin-password" name="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="비밀번호" className={`${inputClassName} pr-[45px]`} />
            <button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute top-1/2 right-3 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#98a2b3] hover:bg-[#f2f4f7]" aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시하기'} aria-pressed={showPassword}>
              {showPassword ? <EyeOff className="size-5" strokeWidth={1.7} aria-hidden="true" /> : <Eye className="size-5" strokeWidth={1.7} aria-hidden="true" />}
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-4">
          <button type="submit" disabled={isSubmitting} className="flex h-11 w-full items-center justify-center rounded-2xl bg-[#315ef5] px-4 text-sm font-semibold text-white transition hover:bg-[#294fd5] disabled:cursor-wait disabled:bg-[#98a2b3]">{isSubmitting ? '이동 중...' : '로그인'}</button>
          <Link href="/login" className="flex h-11 w-full items-center justify-center rounded-2xl border border-[#d0d5dd] bg-white px-[17px] text-sm font-semibold text-[#344054] transition hover:bg-[#f9fafb]">일반 GamerIN으로 이동</Link>
        </div>
      </form>
      {toast ? <AdminToast key={toast.id} variant={toast.variant} title={toast.title} description={toast.description} onDismiss={() => setToast(null)} /> : null}
    </>
  );
}
