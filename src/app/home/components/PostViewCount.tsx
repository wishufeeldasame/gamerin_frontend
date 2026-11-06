import { Eye } from 'lucide-react';
import { formatViewCount } from '@/lib/view-count';

/**
 * 액션 줄의 조회수(#183). 값이 없으면 그리지 않는다. 누를 수 있는 버튼이 아니다.
 * 360px 미만에서는 액션 줄이 넘쳐 공유 버튼이 잘리므로 숨긴다(F24).
 */
export function PostViewCount({ count }: { count?: number | null }) {
  if (count == null) return null;
  const exact = count.toLocaleString('ko-KR');
  return (
    <span className="flex min-h-11 items-center gap-1.5 whitespace-nowrap px-1 max-[359px]:hidden md:px-2" title={`조회수 ${exact}회`}>
      <Eye size={20} strokeWidth={1.67} aria-hidden="true" />
      <span className="sr-only">조회수 {exact}회</span>
      <span aria-hidden="true" className="text-label text-fg-secondary">{formatViewCount(count)}</span>
    </span>
  );
}
