export const SHOW_DURATION = 60_000;
export const SHOW_CHAPTERS = [
  { at: 0, label: '플레이의 시작', title: '게임 속 나를,\n게임 밖에서도.', detail: '실력과 경험이 연결되는 게이머의 공간.' },
  { at: 5_000, label: '전적 프로필', title: '내 실력을 보여주는\n가장 확실한 프로필.', detail: '이미 연결한 배그에 발로란트 전적까지.' },
  { at: 13_000, label: '영상 공유', title: '멋진 플레이는,\n혼자 보기 아까우니까.', detail: '영상부터 내가 고른 썸네일까지. 플레이를 나눠보세요.' },
  { at: 26_000, label: '게이머들의 반응', title: '하나의 플레이가,\n새로운 대화로.', detail: '좋아요, 댓글, 리포스트. 같은 게임으로 가까워지는 순간.' },
  { at: 35_000, label: '멘토 찾기', title: '다음 플레이를\n바꾸고 싶다면.', detail: '평점과 실제 이용 후기를 살펴보고, 내게 맞는 멘토를 찾아요.' },
  { at: 44_000, label: '1:1 멘토링', title: '일반적인 공략보다,\n내 플레이에 맞는 피드백.', detail: '공유한 영상으로 시작하는 멘토와의 대화.' },
  { at: 54_000, label: '함께 성장하기', title: '실력을 기록하고. 플레이를 나누고.\n함께 성장하세요.', detail: 'GamerIN — 당신의 다음 플레이가 시작되는 곳.' },
] as const;

export const SHOW_REVIEWS = [
  { name: '원탭연습중', text: '왜 그 판단이 필요한지 이해됐어요.' },
  { name: '다음라운드', text: '제 리플레이로 설명해줘서 바로 적용했어요.' },
  { name: '클러치메이트', text: '포지셔닝에서 놓치던 습관을 찾았어요.' },
] as const;

export const SHOW_POST = '오늘의 클러치. 마지막 판단, 어땠나요? #발로란트';
export const SHOW_REVIEW = '다음 플레이에서 무엇을 바꿀지 알겠어요.';
export const SHOW_ASSETS = {
  video: '/demo-assets/valorant-highlight.mp4',
  thumbnails: [1, 2, 3].map((n) => `/demo-assets/valorant-thumb-${n}.jpg`),
  poster: '/demo-assets/valorant-thumb-2.jpg',
} as const;

export type ShowState = {
  time: number;
  chapter: number;
  page: 'profile' | 'feed' | 'mentoring';
  cover: 'intro' | 'ending' | null;
  connecting: boolean;
  riotId: string;
  linked: boolean;
  attached: boolean;
  thumbnail: number;
  draft: string;
  upload: number;
  posted: boolean;
  playing: boolean;
  likes: number;
  comments: number;
  reposts: number;
  reply: boolean;
  followed: boolean;
  program: boolean;
  applied: boolean;
  accepted: boolean;
  shared: boolean;
  feedback: boolean;
  finished: boolean;
  completed: boolean;
  review: string;
  reviewed: boolean;
};

export const SHOW_INITIAL: ShowState = {
  time: 0, chapter: 0, page: 'profile', cover: 'intro', connecting: false, riotId: '', linked: false,
  attached: false, thumbnail: 0, draft: '', upload: 0, posted: false, playing: false,
  likes: 0, comments: 0, reposts: 0, reply: false, followed: false,
  program: false, applied: false, accepted: false, shared: false, feedback: false,
  finished: false, completed: false, review: '', reviewed: false,
};

export const SHOW_POSTER: ShowState = {
  ...SHOW_INITIAL, time: SHOW_DURATION, chapter: 6, cover: 'ending', linked: true,
  posted: true, likes: 28, comments: 2, reposts: 3, completed: true, reviewed: true,
};

export function chapterAt(time: number) {
  let chapter = 0;
  for (let i = 1; i < SHOW_CHAPTERS.length; i++) if (time >= SHOW_CHAPTERS[i].at) chapter = i;
  return chapter;
}
