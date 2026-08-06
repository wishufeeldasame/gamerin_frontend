import { CircleCheck } from 'lucide-react';

export function ProgramHiddenToast({ isLeaving }: { isLeaving: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed top-6 right-6 z-[60] flex w-[356px] items-center gap-1.5 rounded-lg border border-[#003d1c] bg-[#001f0f] p-[17px] shadow-[0_4px_6px_rgba(0,0,0,0.1)] transition-all duration-300 ease-in ${
        isLeaving ? '-translate-y-28 opacity-0' : 'translate-y-0 opacity-100'
      }`}
    >
      <CircleCheck className="size-5 shrink-0 text-[#59f3a6]" strokeWidth={2.2} aria-hidden="true" />
      <div className="text-[13px] text-[#59f3a6]">
        <p className="leading-[19.5px] font-medium">프로그램을 숨김 처리했습니다.</p>
        <p className="mt-0.5 leading-[18.2px]">숨김 사유가 작업 이력에 기록되었습니다.</p>
      </div>
    </div>
  );
}
