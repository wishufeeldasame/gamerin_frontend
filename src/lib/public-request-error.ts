export function getPublicRequestErrorMessage(error: unknown, fallback: string) {
  if (error instanceof TypeError) return fallback;
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

export async function readPublicResponseErrorMessage(response: Response, fallback: string) {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const data = await response.json().catch(() => null) as Record<string, unknown> | null;
    const message = [data?.message, data?.error]
      .find((value): value is string => typeof value === 'string' && Boolean(value.trim()));
    return message?.trim() || fallback;
  }

  // 프록시의 HTML 오류 페이지(502 등)는 화면에 보여줄 문구가 아니므로 일반 텍스트만 쓴다.
  if (!contentType.includes('text/plain')) return fallback;
  const text = await response.text().catch(() => '');
  return text.trim() || fallback;
}
