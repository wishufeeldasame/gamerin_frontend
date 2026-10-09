import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RelativeTime } from '../RelativeTime';

describe('RelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 6, 15, 5));
  });
  afterEach(() => vi.useRealTimers());

  it('정규화된 ISO와 로컬 절대 시각 툴팁을 제공한다', () => {
    const date = new Date(2026, 9, 6, 15, 4);
    render(<RelativeTime createdAt={date.toISOString()} className="text-xs" />);
    const time = screen.getByText('1분 전');
    expect(time.tagName).toBe('TIME');
    expect(time).toHaveAttribute('dateTime', date.toISOString());
    expect(time).toHaveAttribute('title', '2026년 10월 6일 오후 3:04');
    expect(time).toHaveClass('text-xs');
  });

  it('유효한 오프셋 날짜를 ISO로 정규화한다', () => {
    render(<RelativeTime createdAt="2026-10-06T15:05:00+09:00" />);
    expect(document.querySelector('time')).toHaveAttribute('dateTime', '2026-10-06T06:05:00.000Z');
  });

  it.each(['', 'invalid'])('잘못된 날짜 %s는 time 요소나 잘못된 속성을 만들지 않는다', (createdAt) => {
    render(<RelativeTime createdAt={createdAt} className="text-xs" />);
    const label = screen.getByText('시간 정보 없음');
    expect(label.tagName).toBe('SPAN');
    expect(label).toHaveClass('text-xs');
    expect(label).not.toHaveAttribute('dateTime');
    expect(label).not.toHaveAttribute('title');
    expect(document.querySelector('time')).toBeNull();
  });
});
