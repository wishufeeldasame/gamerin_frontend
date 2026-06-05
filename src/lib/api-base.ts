export function getApiBaseUrl() {
  const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

  if (configuredApiBaseUrl) {
    return configuredApiBaseUrl.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return '';
}
