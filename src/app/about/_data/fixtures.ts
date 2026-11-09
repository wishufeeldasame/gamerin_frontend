// 모두 소개 페이지 전용 예시이며 실제 계정·게임사·결제 데이터가 아니다.
export const demoProfile = {
  name: '새벽의듀오',
  handle: 'dawn_duo',
  bio: '어제보다 나은 플레이, 함께 만들어요.',
  game: '리그 오브 레전드',
  tier: 'DIAMOND II',
  winRate: '62%',
  kda: '4.28',
  games: '128',
} as const;

export const demoPost = {
  author: '미드연구소',
  content: '라인전이 끝난 뒤, 다음 한 수는?',
  detail: '시야부터 사이드 운영까지. 오늘의 플레이를 함께 나눠요.',
  collection: '다시 볼 플레이',
} as const;

export const demoMentoring = {
  mentor: '루트코치',
  title: '내 플레이에 맞는 승리 플랜',
  description: '리플레이로 짚어보는 라인전과 운영',
  duration: '60분 · 1:1 멘토링',
  price: '10,000 M',
} as const;

export const demoConversation = {
  name: '포지션메이트',
  received: '오늘은 어떤 포지션으로 할까요?',
  sent: '저는 서포터요. 같이 한 판 해요!',
} as const;
