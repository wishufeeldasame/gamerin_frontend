export const UNKNOWN_TIME = '시간 정보 없음';

export function parseDisplayTime(value: string): Date | null {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function formatRelativeTimeLabel(createdAt: string): string {
  const date = parseDisplayTime(createdAt);
  if (!date) return UNKNOWN_TIME;

  const now = new Date();
  const seconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (seconds < 60) return '방금 전';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}일 전`;

  const monthDay = `${date.getMonth() + 1}월 ${date.getDate()}일`;
  return date.getFullYear() === now.getFullYear()
    ? monthDay
    : `${date.getFullYear()}년 ${monthDay}`;
}

export function formatAbsoluteTime(date: Date): string {
  const hour = date.getHours();
  const period = hour < 12 ? '오전' : '오후';
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${period} ${hour % 12 || 12}:${minute}`;
}
