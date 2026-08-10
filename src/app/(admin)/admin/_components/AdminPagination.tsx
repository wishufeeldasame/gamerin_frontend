import { ChevronLeft, ChevronRight } from 'lucide-react';

type AdminPaginationProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
};

export function AdminPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  itemLabel,
  onPageChange,
}: AdminPaginationProps) {
  const safeTotalPages = Math.max(totalPages, 1);
  const start = totalItems === 0 ? 0 : currentPage * pageSize + 1;
  const end = Math.min((currentPage + 1) * pageSize, totalItems);

  return (
    <footer className="flex min-h-[62px] flex-wrap items-center justify-between gap-3 border-t border-[#f2f4f7] px-4 py-3 sm:px-5">
      <p className="text-[13px] leading-[19.5px] text-[#667085]">
        전체 <strong className="font-bold text-[#172033]">{totalItems}</strong>{itemLabel}
        {totalItems > 0 ? ` 중 ${start}–${end}` : ''}
      </p>
      <div className="flex items-center gap-1.5" aria-label={`${itemLabel} 페이지 이동`}>
        <button
          type="button"
          disabled={currentPage === 0}
          onClick={() => onPageChange(currentPage - 1)}
          className="flex h-9 items-center gap-1 rounded-2xl border border-[#e4e7ec] px-3 text-[13px] font-semibold text-[#344054] transition hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:text-[#98a2b3]"
        >
          <ChevronLeft className="size-4" strokeWidth={1.7} aria-hidden="true" />
          <span className="hidden sm:inline">이전</span>
        </button>
        {Array.from({ length: safeTotalPages }, (_, index) => (
          <button
            key={index}
            type="button"
            aria-current={currentPage === index ? 'page' : undefined}
            onClick={() => onPageChange(index)}
            className={`size-9 rounded-xl text-[13px] font-semibold transition ${
              currentPage === index
                ? 'bg-[#315ef5] text-white'
                : 'border border-[#e4e7ec] bg-white text-[#667085] hover:bg-[#f9fafb]'
            }`}
          >
            {index + 1}
          </button>
        ))}
        <button
          type="button"
          disabled={currentPage >= safeTotalPages - 1}
          onClick={() => onPageChange(currentPage + 1)}
          className="flex h-9 items-center gap-1 rounded-2xl border border-[#e4e7ec] px-3 text-[13px] font-semibold text-[#344054] transition hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:text-[#98a2b3]"
        >
          <span className="hidden sm:inline">다음</span>
          <ChevronRight className="size-4" strokeWidth={1.7} aria-hidden="true" />
        </button>
      </div>
    </footer>
  );
}
