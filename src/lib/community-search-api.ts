import { clearStoredAuth, ensureAccessToken, refreshAccessToken } from '@/lib/auth-store';
import { getApiBaseUrl } from '@/lib/api-base';
import {
  type CursorPage,
  type PostRecord,
  normalizeCursorPage,
  normalizePostRecord,
} from '@/lib/feed-api';

const API_BASE = getApiBaseUrl();

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  message?: string;
};

type RequestOptions = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string>;
};

type SearchRequestOptions = {
  signal?: AbortSignal;
};

export interface HashtagSummary {
  hashtagId: string;
  name: string;
  postCount: number;
}

export interface SimpleUserProfile {
  userId: string;
  handle: string;
  nickname: string;
  bio: string | null;
  profileImageUrl: string | null;
  verifiedBadge: boolean;
  isFollowing?: boolean;
}

export interface SearchSection<T> {
  items: T[];
  hasMore: boolean;
}

export interface SearchOverview {
  query: string;
  accounts: SearchSection<SimpleUserProfile>;
  posts: SearchSection<PostRecord>;
  hashtags: SearchSection<HashtagSummary>;
}

function createAuthError() {
  return new Error('Authentication is required or the token has expired.');
}

function normalizeAssetUrl(value?: string | null) {
  const url = value?.trim();
  if (!url) {
    return null;
  }

  if (/^(https?:|blob:|data:)/i.test(url)) {
    return url;
  }

  if (url.startsWith('//')) {
    const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:';
    return `${protocol}${url}`;
  }

  return `${API_BASE.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
}

function toNumber(value: unknown) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function normalizeHashtag(hashtag: HashtagSummary): HashtagSummary {
  return {
    ...hashtag,
    postCount: toNumber(hashtag.postCount),
  };
}

function normalizeUserProfile(profile: SimpleUserProfile): SimpleUserProfile {
  return {
    ...profile,
    bio: profile.bio ?? null,
    profileImageUrl: normalizeAssetUrl(profile.profileImageUrl),
    verifiedBadge: Boolean(profile.verifiedBadge),
  };
}

async function communityRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const send = async (accessToken: string) => {
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);

    if (!(options.body instanceof FormData) && options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | { message?: string } | null;
    return { response, payload };
  };

  let accessToken = await ensureAccessToken();
  if (!accessToken) {
    throw createAuthError();
  }

  let result = await send(accessToken);

  if (result.response.status === 401) {
    accessToken = await refreshAccessToken();
    if (!accessToken) {
      throw createAuthError();
    }

    result = await send(accessToken);
  }

  if (!result.response.ok) {
    if (result.response.status === 401) {
      clearStoredAuth();
      throw createAuthError();
    }

    throw new Error(result.payload?.message ?? 'Community search request failed.');
  }

  return (result.payload as ApiEnvelope<T>).data;
}

function appendQuery(search: URLSearchParams, query: string) {
  search.set('q', query.trim());
}

export async function fetchHashtagSuggestions(query: string, size = 10, options: SearchRequestOptions = {}) {
  const search = new URLSearchParams({
    query: query.trim(),
    size: String(size),
  });

  const hashtags = await communityRequest<HashtagSummary[]>(`/api/v1/hashtags?${search.toString()}`, {
    signal: options.signal,
  });
  return Array.isArray(hashtags) ? hashtags.map(normalizeHashtag) : [];
}

export async function fetchHashtagPosts(
  name: string,
  cursor?: string | null,
  size = 20,
  options: SearchRequestOptions = {},
) {
  const search = new URLSearchParams({
    size: String(size),
  });

  if (cursor) {
    search.set('cursor', cursor);
  }

  const page = await communityRequest<CursorPage<PostRecord>>(
    `/api/v1/hashtags/${encodeURIComponent(name.replace(/^#/, ''))}/posts?${search.toString()}`,
    {
      signal: options.signal,
    },
  );
  return normalizeCursorPage(page, normalizePostRecord);
}

export async function fetchSearchOverview(query: string, size = 5, options: SearchRequestOptions = {}) {
  const search = new URLSearchParams({
    size: String(size),
  });
  appendQuery(search, query);

  const overview = await communityRequest<SearchOverview>(`/api/v1/search?${search.toString()}`, {
    signal: options.signal,
  });
  return {
    ...overview,
    accounts: {
      ...overview.accounts,
      items: Array.isArray(overview.accounts.items)
        ? overview.accounts.items.map(normalizeUserProfile)
        : [],
    },
    posts: {
      ...overview.posts,
      items: Array.isArray(overview.posts.items)
        ? overview.posts.items.map(normalizePostRecord)
        : [],
    },
    hashtags: {
      ...overview.hashtags,
      items: Array.isArray(overview.hashtags.items)
        ? overview.hashtags.items.map(normalizeHashtag)
        : [],
    },
  };
}

export async function fetchSearchAccounts(
  query: string,
  cursor?: string | null,
  size = 20,
  options: SearchRequestOptions = {},
) {
  const search = new URLSearchParams({
    size: String(size),
  });
  appendQuery(search, query);

  if (cursor) {
    search.set('cursor', cursor);
  }

  const page = await communityRequest<CursorPage<SimpleUserProfile>>(
    `/api/v1/search/accounts?${search.toString()}`,
    {
      signal: options.signal,
    },
  );
  return normalizeCursorPage(page, normalizeUserProfile);
}

export async function fetchSearchPosts(
  query: string,
  cursor?: string | null,
  size = 20,
  options: SearchRequestOptions = {},
) {
  const search = new URLSearchParams({
    size: String(size),
  });
  appendQuery(search, query);

  if (cursor) {
    search.set('cursor', cursor);
  }

  const page = await communityRequest<CursorPage<PostRecord>>(`/api/v1/search/posts?${search.toString()}`, {
    signal: options.signal,
  });
  return normalizeCursorPage(page, normalizePostRecord);
}

export async function fetchSearchHashtags(query: string, size = 20, options: SearchRequestOptions = {}) {
  const search = new URLSearchParams({
    size: String(size),
  });
  appendQuery(search, query);

  const hashtags = await communityRequest<HashtagSummary[]>(`/api/v1/search/hashtags?${search.toString()}`, {
    signal: options.signal,
  });
  return Array.isArray(hashtags) ? hashtags.map(normalizeHashtag) : [];
}
