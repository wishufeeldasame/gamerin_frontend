/** 닉네임 옆에 표시하는 대표 게임 티어(백엔드 #179). tierLabel은 서버가 저장한 문자열 그대로다. */
export type RepresentativeGame = 'PUBG' | 'R6' | 'LOL' | 'VALORANT';

export interface RepresentativeTier {
  game: RepresentativeGame;
  tierLabel: string;
}

const GAME_SHORT_NAME: Record<RepresentativeGame, string> = { PUBG: 'PUBG', R6: 'R6', LOL: 'LoL', VALORANT: 'VALORANT' };

// 게임별 보유 엠블럼. 값은 디비전 이미지 개수이며 0이면 디비전 없이 한 장이다.
const EMBLEMS: Record<RepresentativeGame, { dir: string; ext: string; tiers: Record<string, number> }> = {
  LOL: {
    dir: 'lol',
    ext: 'png',
    tiers: {
      iron: 0, bronze: 0, silver: 0, gold: 0, platinum: 0,
      emerald: 0, diamond: 0, master: 0, grandmaster: 0, challenger: 0,
    },
  },
  R6: {
    dir: 'r6',
    ext: 'png',
    tiers: { copper: 5, bronze: 5, silver: 5, gold: 5, platinum: 5, emerald: 5, diamond: 5, champion: 5 },
  },
  PUBG: {
    dir: 'pubg',
    ext: 'webp',
    // 마스터·서바이버는 세부 등급 없이 1번 파일 한 장뿐이다.
    tiers: { bronze: 4, silver: 4, gold: 4, platinum: 4, crystal: 4, diamond: 4, master: 1, survivor: 1 },
  },
  // HenrikDev `current.tier.name`(예: `Gold 2`, `Radiant`) 기준. 연동은 #178에서 구현한다.
  VALORANT: {
    dir: 'valorant',
    ext: 'png',
    tiers: {
      iron: 3, bronze: 3, silver: 3, gold: 3, platinum: 3,
      diamond: 3, ascendant: 3, immortal: 3, radiant: 0,
    },
  },
};

const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5 };

export function isRepresentativeGame(value: unknown): value is RepresentativeGame {
  return value === 'PUBG' || value === 'R6' || value === 'LOL' || value === 'VALORANT';
}

/** API 응답 값을 검증한다. 형식이 맞지 않거나 비어 있으면 null. */
export function toRepresentativeTier(value: unknown): RepresentativeTier | null {
  if (!value || typeof value !== 'object') return null;
  const { game, tierLabel } = value as Record<string, unknown>;
  if (!isRepresentativeGame(game) || typeof tierLabel !== 'string' || !tierLabel.trim()) return null;
  return { game, tierLabel: tierLabel.trim() };
}

/**
 * tierLabel(`GOLD I`, `Gold 3`, `EMERALD II`)을 `/images/tiers/{게임}/{티어}[-{디비전}]` 경로로 바꾼다.
 * 이미지가 없는 티어는 null이다. 디비전을 읽지 못하거나 범위를 벗어나면 그 티어의 1번 이미지를 쓴다.
 */
export function tierEmblemSrc(tier: RepresentativeTier): string | null {
  const emblem = EMBLEMS[tier.game];
  const [tierWord = '', divisionWord = ''] = tier.tierLabel.toLowerCase().split(/\s+/);
  if (!Object.hasOwn(emblem.tiers, tierWord)) return null;
  const divisions = emblem.tiers[tierWord];
  if (divisions === 0) return `/images/tiers/${emblem.dir}/${tierWord}.${emblem.ext}`;

  const parsed = ROMAN[divisionWord] ?? Number(divisionWord);
  const division = Number.isInteger(parsed) && parsed >= 1 && parsed <= divisions ? parsed : 1;
  return `/images/tiers/${emblem.dir}/${tierWord}-${division}.${emblem.ext}`;
}

/** 대체 텍스트·툴팁. 예: `LoL GOLD I` */
export function tierAltText(tier: RepresentativeTier) {
  return `${GAME_SHORT_NAME[tier.game]} ${tier.tierLabel}`;
}

export const REPRESENTATIVE_GAME_LABEL: Record<RepresentativeGame, string> = {
  PUBG: 'PUBG',
  R6: '레인보우 식스 시즈',
  LOL: '리그 오브 레전드',
  VALORANT: '발로란트',
};
