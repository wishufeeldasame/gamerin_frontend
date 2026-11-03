export function getApiBaseUrl() {
  const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

  if (configuredApiBaseUrl) {
    return configuredApiBaseUrl.replace(/\/$/, '');
  }

  if (typeof window === 'undefined') {
    return '';
  }

  const { hostname, protocol, port } = window.location;
  const isLocalDevFrontend = (hostname === 'localhost' || hostname === '127.0.0.1') && port === '3000';

  if (isLocalDevFrontend) {
    return `${protocol}//${hostname}:8080`;
  }

  return '';
}
