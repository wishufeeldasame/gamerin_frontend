import Link from 'next/link';

export default function AdminForbiddenPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#f6f7f9] px-5 py-8 text-[#172033]">
      <section className="w-full max-w-md rounded-[20px] border border-[#e4e7ec] bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold text-[#d92d20]">403 · 접근 권한 없음</p>
        <h1 className="mt-2 text-2xl font-bold">관리자 권한이 필요합니다.</h1>
        <p className="mt-3 text-sm leading-6 text-[#667085]">
          현재 계정은 관리자 콘솔을 사용할 수 없습니다.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/" className="rounded-2xl border border-[#d0d5dd] px-4 py-2 text-sm font-semibold">서비스로 이동</Link>
          <Link href="/admin/login" className="rounded-2xl bg-[#315ef5] px-4 py-2 text-sm font-semibold text-white">다른 계정으로 로그인</Link>
        </div>
      </section>
    </main>
  );
}
