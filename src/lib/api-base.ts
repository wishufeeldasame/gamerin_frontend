export function getApiBaseUrl() {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }

  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    const host = hostname.includes(':') ? `[${hostname}]` : hostname;
    return `${protocol}//${host}:8080`;
  }

  return 'http://localhost:8080';
}
