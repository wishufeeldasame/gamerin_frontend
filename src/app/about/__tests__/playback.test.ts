import { afterEach, describe, expect, it, vi } from 'vitest';
import { Playback } from '@/components/stageshow/kit/playback';

afterEach(() => vi.useRealTimers());

describe('데모별 재생 시계', () => {
  it('정지 시간은 제외하고 남은 대기 시간부터 재개한다', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    const playback = new Playback();
    const complete = vi.fn();
    const signal = new AbortController().signal;
    const pending = playback.wait(1000, signal).then(complete);
    await vi.advanceTimersByTimeAsync(300);
    playback.setPaused(true);
    const stoppedAt = playback.now();
    await vi.advanceTimersByTimeAsync(5000);
    expect(playback.now()).toBe(stoppedAt);
    expect(complete).not.toHaveBeenCalled();
    playback.setPaused(false);
    await vi.advanceTimersByTimeAsync(699);
    expect(complete).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(complete).toHaveBeenCalledOnce();
  });

  it('정지 중 중단하면 타이머와 재개 대기를 취소한다', async () => {
    vi.useFakeTimers();
    const playback = new Playback();
    playback.setPaused(true);
    const controller = new AbortController();
    const waiting = playback.wait(1000, controller.signal);
    const ready = playback.ready(controller.signal);
    const results = Promise.allSettled([waiting, ready]);
    controller.abort();
    expect((await results).map((result) => result.status)).toEqual(['rejected', 'rejected']);
    playback.setPaused(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('한 장면의 정지는 다른 장면과 일반 타이머에 영향을 주지 않는다', async () => {
    vi.useFakeTimers();
    const first = new Playback();
    const second = new Playback();
    const done = vi.fn();
    first.setPaused(true);
    second.timeout(done, 100);
    window.setTimeout(done, 100);
    await vi.advanceTimersByTimeAsync(100);
    expect(done).toHaveBeenCalledTimes(2);
  });
});
