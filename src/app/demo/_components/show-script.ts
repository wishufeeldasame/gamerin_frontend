import type { Act } from '@/components/stageshow';
import { chapterAt, SHOW_DURATION, SHOW_INITIAL, SHOW_POST, SHOW_REVIEW, type ShowState } from '../_data/story';

export async function exhibitionScript(a: Act<ShowState>) {
  const start = a.now();
  const at = (time: number) => a.wait(Math.max(0, start + time - a.now()));
  const beat = async (time: number, name: string, patch: Partial<ShowState>) => {
    await at(time);
    a.mark(name);
    await a.set({ chapter: chapterAt(time), ...patch });
  };
  const click = (target: string) => a.click({ at: target, x: 0.85, y: 0.5 });

  const progress = async () => {
    while (a.now() - start < SHOW_DURATION) {
      const time = Math.min(SHOW_DURATION, Math.max(0, a.now() - start));
      a.put({ time, chapter: chapterAt(time) });
      await a.wait(100);
    }
  };
  const story = async () => {
    await beat(4_000, 'profile', { cover: null });
    await at(5_000);
    await click('add-game');
    await beat(5_800, 'connect', { connecting: true });
    await click('riot-id');
    await a.type('riotId', 'Dawn#KR1', { interval: 75 });
    await at(8_200);
    await click('connect-game');
    await beat(9_000, 'connecting', {});
    await beat(10_200, 'linked', { linked: true, connecting: false });
    await a.move('rest');

    await beat(13_000, 'composer', { page: 'feed' });
    await at(14_000);
    await click('attach');
    await beat(14_800, 'attached', { attached: true });
    await at(16_000);
    await click('thumbnail-1');
    await a.set({ thumbnail: 1 });
    await at(17_000);
    await click('post-draft');
    await a.type('draft', SHOW_POST, { interval: 30 });
    await at(19_200);
    await click('publish');
    await beat(20_000, 'upload', { upload: 28 });
    await beat(20_500, 'processing', { upload: 72 });
    await beat(21_000, 'published', { upload: 100, posted: true, playing: true });
    await a.move('rest');

    await beat(26_000, 'reactions', { likes: 8 });
    await beat(27_500, 'comment-one', { likes: 16, comments: 1 });
    await beat(29_000, 'comment-two', { playing: false, likes: 24, comments: 2, reposts: 2 });
    await beat(30_500, 'reply', { reply: true, likes: 28, reposts: 3 });
    await beat(32_000, 'followed', { followed: true });
    await at(33_000);
    await click('mentoring-nav');

    await beat(35_000, 'mentoring', { page: 'mentoring' });
    await at(36_000);
    await click('program-open');
    await beat(36_800, 'reviews', { program: true });
    await a.move('rest');
    await at(40_000);
    await click('apply-program');
    await beat(41_000, 'applied', { applied: true });

    await beat(44_000, 'accepted', { accepted: true });
    await at(45_000);
    await click('share-video');
    await beat(46_000, 'shared', { shared: true });
    await beat(47_500, 'feedback', { feedback: true });
    await a.move('rest');
    await beat(49_500, 'finished', { finished: true });
    await at(50_000);
    await click('complete-session');
    await beat(50_800, 'completed', { completed: true });
    await a.type('review', SHOW_REVIEW, { interval: 30 });
    await at(52_500);
    await click('submit-review');
    await beat(53_200, 'reviewed', { reviewed: true });
    await a.move('rest');

    await beat(54_000, 'ending', { cover: 'ending' });
    await at(59_400);
    // 반복 타이틀이 화면을 덮고 있을 때만 데이터를 초기화한다.
    a.mark('loop-seam');
    await a.snap({ ...SHOW_INITIAL, cover: 'ending', time: 59_400 });
    await at(SHOW_DURATION);
  };
  await Promise.all([progress(), story()]);
  await a.snap(SHOW_INITIAL);
}
