/** 숫자로 변환하고, 유한한 숫자가 아니면 0을 돌려준다. */
export function toNumber(value: unknown) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}
