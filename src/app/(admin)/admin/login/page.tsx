import type { Metadata } from 'next';
import { Noto_Sans_KR } from 'next/font/google';
import { AdminLoginForm } from './_components/AdminLoginForm';

const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '600', '700', '900'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: '관리자 로그인 | GamerIN',
  description: 'GamerIN 관리자 콘솔 로그인',
};

export default function AdminLoginPage() {
  return (
    <main
      className={`${notoSansKr.className} flex min-h-dvh items-center justify-center bg-[#f6f7f9] px-5 py-8 text-[#172033]`}
    >
      <section className="w-full max-w-[440px]" aria-labelledby="admin-login-title">
        <header className="flex flex-col items-center gap-3 text-center">
          <div
            className="grid size-12 place-items-center rounded-[20px] bg-[linear-gradient(135deg,#315ef5_0%,#102a56_100%)] text-[22px] leading-[33px] font-black text-white"
            aria-hidden="true"
          >
            G
          </div>

          <div>
            <h1 id="admin-login-title" className="text-2xl leading-9 font-bold text-[#172033]">
              관리자 로그인
            </h1>
            <p className="mt-1 text-sm leading-[21px] font-normal text-[#667085]">
              GamerIN 관리자 콘솔에 로그인합니다.
            </p>
          </div>
        </header>

        <AdminLoginForm />

      </section>
    </main>
  );
}
