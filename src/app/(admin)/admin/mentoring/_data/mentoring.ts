export type MentoringTab = 'applications' | 'programs';
export type ApplicationStatus = '승인 대기' | '승인 완료' | '반려';
export type ProgramStatus = '운영 중' | '일시정지' | '숨김';

export type MentorApplication = {
  id: number;
  name: string;
  handle: string;
  initial: string;
  avatarColor: string;
  bio: string;
  game: string;
  experience: string;
  appliedAt: string;
  status: ApplicationStatus;
};

export type MentoringProgram = {
  id: number;
  title: string;
  game: string;
  mentor: string;
  price: string;
  sessions: number;
  rating: number | null;
  reports: number;
  status: ProgramStatus;
  hideReason?: string;
};

export const initialApplications: MentorApplication[] = [
  { id: 1, name: '겜돌이', handle: 'gamer01', initial: '겜', avatarColor: '#315ef5', bio: '정글 동선과 오브젝트 운영 위주로 코칭합니다.', game: '리그 오브 레전드', experience: '챌린저 · 프로 연습생 2년', appliedAt: '2026.07.23 18:20', status: '승인 대기' },
  { id: 2, name: '서폿장인', handle: 'support22', initial: '서', avatarColor: '#f79009', bio: '에임보다 운영과 심리전을 가르칩니다.', game: '발로란트', experience: '레디언트 · 대학 대회 우승', appliedAt: '2026.07.23 11:05', status: '승인 대기' },
  { id: 3, name: '매너겐지', handle: 'cleanplayer', initial: '매', avatarColor: '#12b76a', bio: '돌격 조합 이해도와 궁 타이밍을 알려드립니다.', game: '오버워치2', experience: 'top500 · 스트리머', appliedAt: '2026.07.21 09:41', status: '승인 완료' },
  { id: 4, name: '이벤트당첨', handle: 'spammer_x', initial: '이', avatarColor: '#7f56d9', bio: '무조건 1등 시켜드립니다 dm 주세요 bit.ly/...', game: '배틀그라운드', experience: '실적 증빙 불가', appliedAt: '2026.07.20 22:15', status: '반려' },
];

export const initialPrograms: MentoringProgram[] = [
  { id: 1, title: '정글 차이 극복 1:1 코칭', game: '리그 오브 레전드', mentor: 'cleanplayer', price: '30,000원', sessions: 42, rating: 4.9, reports: 0, status: '운영 중' },
  { id: 2, title: '발로란트 에임 & 운영 클래스', game: '발로란트', mentor: 'support22', price: '25,000원', sessions: 18, rating: 4.7, reports: 1, status: '운영 중' },
  { id: 3, title: '오버워치2 탱커 마스터', game: '오버워치2', mentor: 'cleanplayer', price: '28,000원', sessions: 7, rating: 4.5, reports: 0, status: '일시정지' },
  { id: 4, title: '🔥무조건 티어 상승 보장🔥', game: '배틀그라운드', mentor: 'spammer_x', price: '9,900원', sessions: 0, rating: null, reports: 5, status: '숨김' },
];
