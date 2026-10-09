import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatRelativeTime } from '@/lib/feed-api';
import { formatConversationTime, formatChatTime } from '@/lib/message-store';
import { formatAbsoluteTime, formatRelativeTimeLabel, parseDisplayTime } from '../time-format';

const now = new Date(2026, 9, 6, 15, 5);
const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000).toISOString();

describe.each([
  ['공통 표시', formatRelativeTimeLabel],
  ['게시물 호출 형태', formatRelativeTime],
  ['대화 목록 호출 형태', formatConversationTime],
] as const)('%s', (_name, format) => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });
  afterEach(() => vi.useRealTimers());

  it.each([
    [0, '방금 전'],
    [59, '방금 전'],
    [60, '1분 전'],
    [59 * 60, '59분 전'],
    [60 * 60, '1시간 전'],
    [23 * 60 * 60, '23시간 전'],
    [24 * 60 * 60, '1일 전'],
    [6 * 24 * 60 * 60, '6일 전'],
    [7 * 24 * 60 * 60 - 1, '6일 전'],
    [7 * 24 * 60 * 60, '9월 29일'],
  ])('%i초 경계를 한국어로 표시한다', (seconds, expected) => {
    expect(format(ago(seconds))).toBe(expected);
  });

  it('7일 이상은 로컬 날짜로 표시하고 이전 연도에만 연도를 붙인다', () => {
    expect(format(new Date(2026, 0, 2, 15, 5).toISOString())).toBe('1월 2일');
    expect(format(new Date(2025, 11, 31, 15, 5).toISOString())).toBe('2025년 12월 31일');
  });

  it('연도 경계에서도 7일 미만은 상대 시간을 유지한다', () => {
    vi.setSystemTime(new Date(2027, 0, 2, 15, 5));
    expect(format(new Date(2026, 11, 31, 15, 5).toISOString())).toBe('2일 전');
    expect(format(new Date(2026, 11, 26, 15, 5).toISOString())).toBe('2026년 12월 26일');
  });

  it('미래는 방금 전으로 표시한다', () => {
    expect(format(ago(-1))).toBe('방금 전');
    expect(format(new Date(2027, 0, 1).toISOString())).toBe('방금 전');
  });

  it.each(['', 'not-a-date', '2026-13-99'])('잘못된 입력 %s를 안전하게 표시한다', (value) => {
    expect(format(value)).toBe('시간 정보 없음');
  });
});

describe('절대 시각과 기존 파싱', () => {
  it.each([
    [0, '오전 12:05'],
    [9, '오전 9:05'],
    [12, '오후 12:05'],
    [15, '오후 3:05'],
  ])('로컬 %i시를 한국어 툴팁으로 표시한다', (hour, label) => {
    expect(formatAbsoluteTime(new Date(2026, 9, 6, hour, 5))).toBe(`2026년 10월 6일 ${label}`);
  });

  it('ISO 오프셋을 정규화하고 오프셋 없는 날짜는 기존 Date 파싱을 유지한다', () => {
    expect(parseDisplayTime('2026-10-06T15:05:00+09:00')?.toISOString()).toBe('2026-10-06T06:05:00.000Z');
    expect(parseDisplayTime('2026-10-06T15:05:00')?.getHours()).toBe(15);
    expect(parseDisplayTime('')).toBeNull();
  });

  it('대화 내부 시각 포맷은 변경하지 않는다', () => {
    const value = new Date(2026, 9, 6, 15, 5).toISOString();
    expect(formatChatTime(value)).toBe(new Date(value).toLocaleTimeString('ko-KR', {
      hour: '2-digit', minute: '2-digit',
    }));
  });
});
