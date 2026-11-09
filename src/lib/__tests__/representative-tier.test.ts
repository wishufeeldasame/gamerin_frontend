import { describe, expect, it } from 'vitest';
import { tierAltText, tierEmblemSrc, toRepresentativeTier } from '@/lib/representative-tier';

describe('tierEmblemSrc', () => {
  it.each([
    ['LOL', 'GOLD I', '/images/tiers/lol/gold.png'],
    ['LOL', 'GRANDMASTER I', '/images/tiers/lol/grandmaster.png'],
    ['R6', 'EMERALD II', '/images/tiers/r6/emerald-2.png'],
    ['R6', 'Champion V', '/images/tiers/r6/champion-5.png'],
    ['PUBG', 'Gold III', '/images/tiers/pubg/gold-3.webp'],
    ['PUBG', 'Crystal 4', '/images/tiers/pubg/crystal-4.webp'],
    ['PUBG', 'Master', '/images/tiers/pubg/master-1.webp'],
    ['VALORANT', 'Gold 2', '/images/tiers/valorant/gold-2.png'],
    ['VALORANT', 'Immortal 3', '/images/tiers/valorant/immortal-3.png'],
    ['VALORANT', 'Radiant', '/images/tiers/valorant/radiant.png'],
  ] as const)('%s %s → %s', (game, tierLabel, src) => {
    expect(tierEmblemSrc({ game, tierLabel })).toBe(src);
  });

  it('디비전이 없거나 범위를 벗어나면 그 티어의 가장 낮은 디비전 이미지를 쓴다', () => {
    expect(tierEmblemSrc({ game: 'R6', tierLabel: 'Gold' })).toBe('/images/tiers/r6/gold-5.png');
    expect(tierEmblemSrc({ game: 'PUBG', tierLabel: 'Gold V' })).toBe('/images/tiers/pubg/gold-4.webp');
    expect(tierEmblemSrc({ game: 'VALORANT', tierLabel: 'Gold' })).toBe('/images/tiers/valorant/gold-1.png');
    expect(tierEmblemSrc({ game: 'PUBG', tierLabel: 'Survivor 3' })).toBe('/images/tiers/pubg/survivor-1.webp');
  });

  it('이미지가 없는 티어는 표시하지 않는다', () => {
    expect(tierEmblemSrc({ game: 'LOL', tierLabel: 'UNRANKED' })).toBeNull();
    expect(tierEmblemSrc({ game: 'R6', tierLabel: 'Crystal I' })).toBeNull();
    expect(tierEmblemSrc({ game: 'LOL', tierLabel: 'constructor' })).toBeNull();
    expect(tierEmblemSrc({ game: 'VALORANT', tierLabel: 'Unrated' })).toBeNull();
  });
});

describe('toRepresentativeTier', () => {
  it('지원하는 게임과 비어 있지 않은 티어만 받는다', () => {
    expect(toRepresentativeTier({ game: 'LOL', tierLabel: ' GOLD I ' })).toEqual({ game: 'LOL', tierLabel: 'GOLD I' });
    expect(toRepresentativeTier({ game: 'VALORANT', tierLabel: 'Gold 1' })).toEqual({ game: 'VALORANT', tierLabel: 'Gold 1' });
    expect(toRepresentativeTier({ game: 'OVERWATCH', tierLabel: 'Gold 1' })).toBeNull();
    expect(toRepresentativeTier({ game: 'LOL', tierLabel: '' })).toBeNull();
    expect(toRepresentativeTier({ game: 'LOL', tierLabel: 3 })).toBeNull();
    expect(toRepresentativeTier(null)).toBeNull();
  });

  it('대체 텍스트는 게임 약칭과 티어를 붙인다', () => {
    expect(tierAltText({ game: 'LOL', tierLabel: 'GOLD I' })).toBe('LoL GOLD I');
  });
});
