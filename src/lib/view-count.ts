/**
 * 조회수 표시(#183). 1만 미만은 쉼표(1,234), 1만 이상은 만·억 단위로 줄인다.
 * 10 미만 단위는 소수 한 자리(1.2만), 그 이상은 정수(12만)이며 반올림하지 않고 버린다(실제보다 크게 보이지 않게).
 */
export function formatViewCount(count: number) {
  if (count < 10_000) return count.toLocaleString('ko-KR');
  const [unit, size] = count >= 100_000_000 ? ['억', 100_000_000] : ['만', 10_000];
  // 정수 나눗셈으로 버려 부동소수 오차(5.7 → 5.6999…)를 피한다.
  const tenths = Math.floor(count / (size / 10));
  return `${tenths < 100 ? tenths / 10 : Math.floor(tenths / 10)}${unit}`;
}
