export interface MentionMatch {
  handle: string;
  start: number;
  end: number;
}

const HANDLE = /^[a-z0-9_]{3,20}$/;
const CANDIDATE_CHARACTER = /^[\p{L}\p{N}\p{M}_]$/u;
const BLOCKED_PREFIX = /^[\p{L}\p{N}\p{M}_.@#\\/]$/u;
const URL_PREFIX = /(?:[a-z][a-z0-9+.-]*:\/\/|www\.)/iu;

/** Returns exact, valid mention ranges; dots are punctuation, not handle characters. */
export function parseMentions(text: string): MentionMatch[] {
  const mentions: MentionMatch[] = [];
  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== '@') continue;
    const previous = Array.from(text.slice(Math.max(0, start - 2), start)).at(-1);
    if (previous && BLOCKED_PREFIX.test(previous)) continue;
    const tokenPrefix = text.slice(0, start).match(/\S*$/u)?.[0] ?? '';
    if (URL_PREFIX.test(tokenPrefix)) continue;
    let end = start + 1;
    while (end < text.length) {
      const character = String.fromCodePoint(text.codePointAt(end)!);
      if (!CANDIDATE_CHARACTER.test(character)) break;
      end += character.length;
    }
    const handle = text.slice(start + 1, end);
    if (HANDLE.test(handle)) mentions.push({ handle, start, end });
    start = end - 1;
  }
  return mentions;
}
