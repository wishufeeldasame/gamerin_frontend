import { PostRecord } from '@/lib/feed-api';

export const BOOKMARK_STORAGE_KEY = 'gamerin_bookmarked_posts';
export const BOOKMARKS_CHANGED_EVENT = 'gamerin-bookmarks-changed';

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

function getBookmarkStorageKey(userKey?: string | null) {
  return userKey ? `${BOOKMARK_STORAGE_KEY}:${userKey}` : `${BOOKMARK_STORAGE_KEY}:guest`;
}

export function getBookmarkedPosts(userKey?: string | null): PostRecord[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(getBookmarkStorageKey(userKey));
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PostRecord[]) : [];
  } catch {
    return [];
  }
}

export function isPostBookmarked(postId: string, userKey?: string | null) {
  return getBookmarkedPosts(userKey).some((post) => post.postId === postId);
}

export function getBookmarkCount(postId: string) {
  if (!canUseStorage()) {
    return 0;
  }

  let count = 0;

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);

    if (!key?.startsWith(`${BOOKMARK_STORAGE_KEY}:`)) {
      continue;
    }

    try {
      const raw = window.localStorage.getItem(key);
      const posts = raw ? JSON.parse(raw) : [];
      if (Array.isArray(posts) && posts.some((post: PostRecord) => post.postId === postId)) {
        count += 1;
      }
    } catch {
      // Ignore broken local bookmark data.
    }
  }

  return count;
}

export function saveBookmarkedPost(post: PostRecord, userKey?: string | null) {
  if (!canUseStorage()) {
    return;
  }

  const current = getBookmarkedPosts(userKey);
  const next = [post, ...current.filter((item) => item.postId !== post.postId)];
  window.localStorage.setItem(getBookmarkStorageKey(userKey), JSON.stringify(next));
  window.dispatchEvent(new Event(BOOKMARKS_CHANGED_EVENT));
}

export function removeBookmarkedPost(postId: string, userKey?: string | null) {
  if (!canUseStorage()) {
    return;
  }

  const next = getBookmarkedPosts(userKey).filter((post) => post.postId !== postId);
  window.localStorage.setItem(getBookmarkStorageKey(userKey), JSON.stringify(next));
  window.dispatchEvent(new Event(BOOKMARKS_CHANGED_EVENT));
}

export function toggleBookmarkedPost(post: PostRecord, userKey?: string | null) {
  if (isPostBookmarked(post.postId, userKey)) {
    removeBookmarkedPost(post.postId, userKey);
    return false;
  }

  saveBookmarkedPost(post, userKey);
  return true;
}
