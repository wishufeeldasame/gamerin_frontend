export function getApiBaseUrl() {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }

  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    const normalizedHostname =
      hostname === '127.0.0.1' || hostname === '::1' ? 'localhost' : hostname;
    return `${protocol}//${normalizedHostname}:8080`;
  }

  return 'http://localhost:8080';
}
