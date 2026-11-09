import { describe, expect, it } from 'vitest';
import { chapterAt, SHOW_CHAPTERS, SHOW_DURATION } from '../_data/story';

describe('실제 화면 녹화의 챕터', () => {
  it('60초 영상의 경계에 맞춰 소개 문구를 바꾼다', () => {
    expect(chapterAt(0)).toBe(0);
    SHOW_CHAPTERS.slice(1).forEach((chapter, i) => {
      expect(chapterAt(chapter.at - 1)).toBe(i);
      expect(chapterAt(chapter.at)).toBe(i + 1);
    });
    expect(chapterAt(SHOW_DURATION)).toBe(6);
  });
});
