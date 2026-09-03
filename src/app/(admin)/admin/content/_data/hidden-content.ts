export type HiddenContent = {
  id: string;
  preview: string;
  author: string;
  avatar: string;
  avatarColor: string;
  reason: string;
  administrator: string;
  processedAt: string;
};

export const hiddenPosts: HiddenContent[] = [
  {
    id: 'post-1',
    preview: '안녕하세요 T1 소속 페이커입니다. 팬미팅 참가비…',
    author: '@faker_fake',
    avatar: 'F',
    avatarColor: '#db2777',
    reason: '기타',
    administrator: '관리자 김민수',
    processedAt: '2026.07.23 15:44',
  },
  {
    id: 'post-2',
    preview: '🎁 무료 스킨 이벤트! bit.ly/free-skin…',
    author: '@spammer_x',
    avatar: 'S',
    avatarColor: '#7c3aed',
    reason: '광고·홍보',
    administrator: '관리자 이서연',
    processedAt: '2026.07.21 14:11',
  },
];

export const hiddenComments: HiddenContent[] = [
  {
    id: 'comment-1',
    preview: 'ㅋㅋ 실화냐 이 정도면 게임 접어야지',
    author: '@toxic99',
    avatar: 'T',
    avatarColor: '#0891b2',
    reason: '욕설·비하·혐오',
    administrator: '관리자 김민수',
    processedAt: '2026.07.22 22:40',
  },
];
