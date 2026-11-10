export interface PatchNoteSummary {
  id: string;
  game: string;
  gameLabel: string;
  version: string;
  title: string;
  summary: string;
  publishedAt: string;
  sourceUrl: string | null;
}

export interface WeeklyGameStat {
  game: string;
  gameLabel: string;
  matches: number;
  winRate: number;
  kd: number | null;
  headshotRate?: number | null;
  analysis: { headline: string; summary: string; focus: string };
  tierLabel: string | null;
  previousWeek: {
    matches: number;
    winRate: number;
    kd: number | null;
    headshotRate?: number | null;
    tierLabel: string | null;
  } | null;
}

export interface WeeklyGameReport {
  weekStart: string;
  weekEnd: string;
  previousWeekStart: string;
  previousWeekEnd: string;
  totalMatches: number;
  games: WeeklyGameStat[];
  notice?: string | null;
}

export interface MembershipContent {
  patchNotes: PatchNoteSummary[];
  weeklyReport: WeeklyGameReport;
}

// 패치노트는 2026-11-10 기준 공식 발표 요약. 주간 전적·AI 분석은 미리보기용 고정 예시다.
export const MEMBERSHIP_CONTENT: MembershipContent = {
  patchNotes: [
    {
      id: 'valorant-13-09',
      game: 'VALORANT',
      gameLabel: '발로란트',
      version: '13.09',
      title: '신규 요원 허시와 워든 상향',
      summary: '신규 요원 허시가 합류하고 클로브의 활력 회복 이동 속도 증가량이 15%에서 10%로 감소했습니다. 워든의 두 번째 탄환 오차는 0.25에서 0.2로, 세 번째 탄환 오차는 0.6에서 0.5로 줄었습니다.',
      publishedAt: '2026-10-27',
      sourceUrl: 'https://playvalorant.com/ko-kr/news/game-updates/valorant-patch-notes-1309/',
    },
    {
      id: 'lol-26-22',
      game: 'LOL',
      gameLabel: '리그 오브 레전드',
      version: '26.22',
      title: '챔피언 및 아이템 밸런스 조정',
      summary: '코르키 R의 기본 피해량이 90/170/250에서 100/190/280으로, 추가 공격력 계수가 85%에서 90%로 증가했습니다. 로크 W 지속시간은 6초에서 5초로, 도란의 활 공격력은 8에서 7로 감소했습니다.',
      publishedAt: '2026-11-04',
      sourceUrl: 'https://www.leagueoflegends.com/ko-kr/news/game-updates/league-of-legends-patch-26-22-notes/',
    },
    {
      id: 'pubg-44-1',
      game: 'PUBG',
      gameLabel: 'PUBG',
      version: '44.1',
      title: 'LMG 조정 종료와 차량 내구도 개선',
      summary: 'LMG 메타 로테이션이 종료되고 M249와 MG3가 8월 이전 밸런스로 돌아갔습니다. 차량 체력은 종류별로 8%, 10% 또는 15% 증가하고, 쿠페 RB 트렁크 용량은 100에서 120으로 늘었습니다.',
      publishedAt: '2026-11-03',
      sourceUrl: 'https://pubg.com/ko/news/11338',
    },
    {
      id: 'r6-y11s3-3',
      game: 'R6',
      gameLabel: '레인보우 식스 시즈',
      version: 'Y11S3.3',
      title: '오퍼레이터 장비와 무기 조정',
      summary: '에이스 장비의 두 번째 전개 시간을 1.0초에서 1.1초로, 자칼 장비의 사거리를 12m에서 15m로 조정한다고 안내했습니다. 니트로 셀 피해량은 180에서 185로, Commando 9 피해량은 36에서 38로 조정됩니다.',
      publishedAt: '2026-11-03',
      sourceUrl: 'https://www.ubisoft.com/en-us/game/rainbow-six/siege/news-updates/4siIATxV2PVpuSsBbTPB1t/y11s33-patch-notes',
    },
  ],
  weeklyReport: {
    weekStart: '2026-11-02',
    weekEnd: '2026-11-08',
    previousWeekStart: '2026-10-26',
    previousWeekEnd: '2026-11-01',
    totalMatches: 42,
    games: [
      {
        game: 'VALORANT', gameLabel: '발로란트', matches: 12, winRate: 50.0, kd: 1.1, headshotRate: 24.6, tierLabel: '골드 1',
        previousWeek: { matches: 16, winRate: 56.3, kd: 1.3, headshotRate: 22.1, tierLabel: '골드 1' },
        analysis: {
          headline: '헤드샷 비율은 상승, 경기 결과는 아쉬웠던 한 주',
          summary: 'HS%는 22.1%에서 24.6%로 2.5%p 올랐습니다. 반면 승률은 6.3%p, K/D는 0.2 내려갔고 티어는 골드 1을 유지했습니다. 헤드샷 비율의 상승이 경기 성과로 이어지지는 않은 모습입니다. 다만 경기 수가 16경기에서 12경기로 줄어, 한 주의 변화만으로 실력의 추세를 단정하기는 어렵습니다.',
          focus: '패배한 경기의 첫 교전을 돌아보세요. 팀원의 지원을 받을 수 있는 위치였는지, 교전 뒤 안전하게 빠질 수 있었는지 확인해 보세요.',
        },
      },
      {
        game: 'LOL', gameLabel: '리그 오브 레전드', matches: 24, winRate: 58.3, kd: 2.4, tierLabel: '골드 2',
        previousWeek: { matches: 20, winRate: 50.0, kd: 2.1, tierLabel: '골드 3' },
        analysis: {
          headline: '늘어난 플레이 속에서 승률과 K/D가 함께 상승',
          summary: '지난주보다 4경기를 더 플레이하면서 승률은 50%에서 58.3%로, K/D는 2.1에서 2.4로 올랐습니다. 티어도 골드 3에서 골드 2로 상승했습니다. 이번 주에는 플레이량과 경기 성과가 함께 좋아졌습니다.',
          focus: '승리한 경기에서 반복된 챔피언과 초반 운영을 기록해 보세요. 다음 주에도 같은 선택이 통하는지 살펴보면 자신에게 맞는 플레이를 찾는 데 도움이 됩니다.',
        },
      },
      {
        game: 'PUBG', gameLabel: 'PUBG', matches: 6, winRate: 33.3, kd: 1.8, tierLabel: null,
        previousWeek: { matches: 6, winRate: 33.3, kd: 1.6, tierLabel: null },
        analysis: {
          headline: '승률은 유지, K/D는 소폭 상승',
          summary: '경기 수와 승률은 지난주와 같고, K/D는 1.6에서 1.8로 0.2 올랐습니다. 다만 6경기만으로는 안정적인 변화라고 보기 어렵습니다. 다음 주 기록까지 함께 살펴보는 것이 좋겠습니다.',
          focus: '마지막 교전 직전의 위치와 이동 경로를 돌아보세요. 생존 시간을 더 확보할 수 있는 선택이 있었는지 살펴보세요.',
        },
      },
    ],
  },
};
