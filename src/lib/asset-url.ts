import { getApiBaseUrl } from '@/lib/api-base';

const SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:/i;
// 스킴·호스트 없이 경로만 있는지 판별할 때 쓰는 기준 주소. 실제로 요청하지 않는다.
const PATH_ONLY_BASE = 'http://path-only.invalid';

/**
 * 응답의 이미지·첨부 주소를 표시·요청할 수 있는 주소로 바꾼다.
 * http(s)·blob·data 주소는 그대로 두고, `//host` 주소에는 현재 프로토콜을, 상대경로에는 요청 시점의 API base URL을 붙인다.
 * 문자열이 아니거나 비어 있으면 null이다.
 */
export function toAbsoluteAssetUrl(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const url = value.trim();
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

  return `${getApiBaseUrl()}/${url.replace(/^\//, '')}`;
}

function getApiOrigin() {
  const baseUrl = getApiBaseUrl();

  // base URL이 비어 있으면(nginx 상대경로 호출) 현재 페이지 origin이 API origin이다.
  if (!baseUrl) {
    return typeof window !== 'undefined' ? window.location.origin : null;
  }

  try {
    return new URL(baseUrl).origin;
  } catch {
    return null;
  }
}

/**
 * 인증 정보를 보내도 되는 주소인지 판별한다.
 * 경로만 있는 상대경로이거나, http(s) 주소의 origin이 요청 시점의 API origin과 같을 때만 true다.
 * `//host`, blob·data, 다른 origin, 해석할 수 없는 주소는 false다.
 */
export function isApiOriginUrl(url: string) {
  const value = url.trim();
  if (!value) {
    return false;
  }

  try {
    // `//host`나 `/\host`처럼 다른 호스트로 해석되는 입력은 경로만 있는 상대경로가 아니다.
    if (!SCHEME_PATTERN.test(value) && new URL(value, PATH_ONLY_BASE).origin === PATH_ONLY_BASE) {
      return true;
    }

    const apiOrigin = getApiOrigin();
    const parsed = new URL(value, typeof window !== 'undefined' ? window.location.href : undefined);
    return (
      apiOrigin !== null &&
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      parsed.origin === apiOrigin
    );
  } catch {
    return false;
  }
}
