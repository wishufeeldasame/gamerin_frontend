import { describe, expect, it } from 'vitest';
import { parseMentions } from '../mention-parser';

describe('parseMentions', () => {
  it.each([
    ['@alpha @user.name @squad_1', ['alpha', 'user', 'squad_1']],
    ['안녕 @alpha\n@bravo', ['alpha', 'bravo']],
    ['(@alpha),@bravo', ['alpha', 'bravo']],
    ['@a_b @123 @___', ['a_b', '123', '___']],
    ['@abcdefghijklmnopqrst', ['abcdefghijklmnopqrst']],
    ['@ab @abcdefghijklmnopqrstu @abcdefghijklmnopqrst1', []],
    ['@abcD @ABC @abc한 @abc\u0301 @abcD. @USER.name @abcdefghijklmnopqrstu.', []],
    ['a@alpha 한@alpha 3@alpha _@alpha .@alpha \u0301@alpha', []],
    ['𐐀@alpha', []],
    ['@@alpha #@alpha /@alpha \\@alpha', []],
    ['a@alpha.com https://example.test/@alpha https://example.test?q=@alpha', []],
    ['www.example.test?user=@alpha HTTPS://example.test?q=(@alpha)', []],
    ['@alpha.beta @bravo.', ['alpha', 'bravo']],
    ['#게임 @alpha, @alpha #태그', ['alpha', 'alpha']],
  ])('parses %s without accepting invalid prefixes', (text, expected) => {
    expect(parseMentions(text).map((mention) => mention.handle)).toEqual(expected);
    for (const match of parseMentions(text)) {
      const rawHandle = text.slice(match.start + 1, match.end);
      expect(rawHandle).toBe(match.handle);
    }
  });

  it('keeps UTF-16 ranges after emoji and punctuation', () => {
    expect(parseMentions('🎮 @alpha')).toEqual([{ handle: 'alpha', start: 3, end: 9 }]);
  });

  it('treats dots as punctuation and keeps them outside the mention range', () => {
    expect(parseMentions('@player. @abcdefghijklmnopqrst.')).toEqual([
      { handle: 'player', start: 0, end: 7 },
      { handle: 'abcdefghijklmnopqrst', start: 9, end: 30 },
    ]);
    expect(parseMentions('@user.name @user.한글 @ab.name @.alpha')).toEqual([
      { handle: 'user', start: 0, end: 5 },
      { handle: 'user', start: 11, end: 16 },
    ]);
  });
});
