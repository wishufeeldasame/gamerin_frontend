import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Act } from '@/components/stageshow';
import { exhibitionScript } from '../_components/show-script';
import { chapterAt, SHOW_CHAPTERS, SHOW_DURATION, SHOW_INITIAL, SHOW_POST, SHOW_REVIEW, type ShowState } from '../_data/story';

afterEach(() => vi.useRealTimers());

describe('전시 대본', () => {
  it('챕터 경계를 기준으로 문구를 바꾼다', () => {
    expect(chapterAt(0)).toBe(0);
    SHOW_CHAPTERS.slice(1).forEach((chapter, i) => {
      expect(chapterAt(chapter.at - 1)).toBe(i);
      expect(chapterAt(chapter.at)).toBe(i + 1);
    });
    expect(chapterAt(SHOW_DURATION)).toBe(6);
  });

  it('60초 안에 연결·게시·반응·멘토링을 순서대로 마치고 가려진 채 초기화한다', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    let state = { ...SHOW_INITIAL };
    const marks: { name: string; at: number; state: ShowState }[] = [];
    const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
    const act = {
      now: () => Date.now(),
      wait,
      put: (patch: Partial<ShowState>) => { state = { ...state, ...patch }; },
      set: async (patch: Partial<ShowState>) => { state = { ...state, ...patch }; await wait(32); },
      snap: async (patch: Partial<ShowState>) => { state = { ...state, ...patch }; },
      mark: (name: string) => { marks.push({ name, at: Date.now(), state: { ...state } }); },
      click: () => wait(350),
      move: () => wait(350),
      type: async (key: keyof ShowState, value: string, options: { interval: number }) => {
        await wait(value.length * options.interval);
        state = { ...state, [key]: value };
      },
    } as unknown as Act<ShowState>;
    const done = exhibitionScript(act);
    await vi.runAllTimersAsync();
    await done;
    expect(Date.now()).toBe(SHOW_DURATION);
    expect(marks.map((mark) => mark.name)).toEqual(['profile', 'connect', 'connecting', 'linked', 'composer', 'attached', 'upload', 'processing', 'published', 'reactions', 'comment-one', 'comment-two', 'reply', 'followed', 'mentoring', 'reviews', 'applied', 'accepted', 'shared', 'feedback', 'finished', 'completed', 'reviewed', 'ending', 'loop-seam']);
    const ending = marks.find((mark) => mark.name === 'ending')!;
    expect(ending.at).toBe(54_000);
    expect(ending.state).toMatchObject({ linked: true, posted: true, draft: SHOW_POST, thumbnail: 1, applied: true, accepted: true, shared: true, feedback: true, completed: true, review: SHOW_REVIEW, reviewed: true });
    expect(marks.at(-1)).toMatchObject({ at: 59_400, state: { cover: 'ending' } });
    expect(state).toEqual(SHOW_INITIAL);
  });
});
