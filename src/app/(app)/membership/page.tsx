'use client';

import { BellRing, Crown, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchPaymentProducts, type PaymentProduct } from '@/lib/payment-api';
import { KakaoPaymentDialog } from '../wallet/_components/KakaoPaymentDialog';

const benefits = [
  { icon: Sparkles, title: '광고 없이 집중', description: '피드와 상세 화면을 더 깔끔하게 이용할 수 있어요.' },
  { icon: Crown, title: '전용 프로필 배지', description: '닉네임 옆 멤버십 왕관으로 존재감을 보여주세요.' },
  { icon: BellRing, title: '빠른 멘토링 알림', description: '새로운 멘토링 모집 소식을 먼저 확인할 수 있어요.' },
];

export default function MembershipPage() {
  const [product, setProduct] = useState<PaymentProduct | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPaymentProducts()
      .then((products) => {
        setProduct(products.find((item) => item.purpose === 'MEMBERSHIP_PASS') ?? null);
        setError(null);
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : '멤버십 상품을 불러오지 못했어요.');
      })
      .finally(() => setLoading(false));
  }, []);

  const price = product?.price ?? 9_900;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-7 sm:px-6 sm:py-10">
      <header>
        <h1 className="text-3xl font-black tracking-tight text-black dark:text-zinc-100">게임 생활을 더 가볍게</h1>
        <p className="mt-2 text-sm font-bold text-zinc-500">멤버십 회원만을 위한 GamerIN 혜택을 만나보세요.</p>
      </header>

      <section className="relative mt-7 overflow-hidden rounded-3xl bg-black p-6 text-white shadow-xl dark:border dark:border-neutral-800 sm:p-9">
        <div className="absolute -right-16 -top-20 size-56 rounded-full bg-[#f5b93d]/20 blur-2xl" />
        <div className="relative max-w-xl">
          <div className="flex items-center gap-2 text-sm font-black text-[#f5b93d]">
            <Crown size={20} /> GAMERIN MEMBER
          </div>
          <p className="mt-6 text-4xl font-black">월 {price.toLocaleString('ko-KR')}원</p>
          <p className="mt-3 text-sm font-bold leading-6 text-zinc-300">
            카카오페이로 간편하게 시작하세요. 이용 기간이 끝나기 전 언제든 결제 정보를 확인할 수 있어요.
          </p>
          {error ? <p className="mt-4 text-sm font-bold text-red-300">{error}</p> : null}
          <button
            type="button"
            disabled={loading || !product}
            onClick={() => setPaymentOpen(true)}
            className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#f5b93d] px-6 text-sm font-black text-black transition hover:bg-[#e7aa2e] disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400 sm:w-auto"
          >
            {loading ? <Loader2 className="animate-spin" size={17} /> : <ShieldCheck size={17} />}
            {loading ? '상품 확인 중' : product ? '카카오페이로 멤버십 시작' : '현재 가입할 수 없어요'}
          </button>
        </div>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        {benefits.map((benefit) => (
          <article key={benefit.title} className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <span className="grid size-10 place-items-center rounded-xl bg-[#fff4d6] text-[#9a6811] dark:bg-[#2a2112] dark:text-[#f5b93d]">
              <benefit.icon size={20} />
            </span>
            <h2 className="mt-4 text-base font-black text-black dark:text-zinc-100">{benefit.title}</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-zinc-500">{benefit.description}</p>
          </article>
        ))}
      </section>

      <p className="mt-5 text-center text-xs font-bold text-zinc-400">
        실제 이용 기간과 해지 정책은 결제 상품 및 운영 정책에 따라 적용됩니다.
      </p>

      {paymentOpen && product ? <KakaoPaymentDialog product={product} onClose={() => setPaymentOpen(false)} /> : null}
    </div>
  );
}
