import { Info } from 'lucide-react';

type AdminDemoNoticeProps = {
  description: string;
};

export function AdminDemoBadge() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-[#fef6e7] px-2.5 py-1 text-xs font-bold text-[#b54708]">
      데모
    </span>
  );
}

export function AdminDemoNotice({ description }: AdminDemoNoticeProps) {
  return (
    <aside
      className="mb-4 flex items-start gap-3 rounded-2xl border border-[#fedf89] bg-[#fffaeb] px-4 py-3"
      aria-label="데모 기능 안내"
    >
      <Info className="mt-0.5 size-4 shrink-0 text-[#b54708]" strokeWidth={1.8} aria-hidden="true" />
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <AdminDemoBadge />
        <p className="text-[13px] leading-5 text-[#7a2e0e]">{description}</p>
      </div>
    </aside>
  );
}
