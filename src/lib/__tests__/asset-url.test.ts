import { afterEach, describe, expect, it, vi } from 'vitest';
import { isApiOriginUrl, toAbsoluteAssetUrl } from '@/lib/asset-url';

const jsdom = (globalThis as unknown as { jsdom: { reconfigure: (options: { url: string }) => void } }).jsdom;

function applyConfig(pageUrl: string, apiBaseUrl: string | undefined) {
  jsdom.reconfigure({ url: pageUrl });
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', apiBaseUrl);
}

afterEach(() => {
  vi.unstubAllEnvs();
  jsdom.reconfigure({ url: 'http://localhost:3000/' });
});

describe('toAbsoluteAssetUrl', () => {
  it('문자열이 아니거나 비어 있으면 null이다', () => {
    applyConfig('https://gamerin.test/', 'https://api.gamerin.test');
    for (const value of [null, undefined, '', '   ', 1, {}]) {
      expect(toAbsoluteAssetUrl(value)).toBeNull();
    }
  });

  it('상대경로에는 요청 시점의 API base URL을 붙이고 앞뒤 공백을 지운다', () => {
    applyConfig('https://gamerin.test/', ' https://api.gamerin.test/ ');
    expect(toAbsoluteAssetUrl(' /uploads/a.png ')).toBe('https://api.gamerin.test/uploads/a.png');
    expect(toAbsoluteAssetUrl('uploads/a.png')).toBe('https://api.gamerin.test/uploads/a.png');

    applyConfig('https://gamerin.test/', '');
    expect(toAbsoluteAssetUrl('/uploads/a.png')).toBe('/uploads/a.png');
    expect(toAbsoluteAssetUrl('uploads/a.png')).toBe('/uploads/a.png');

    applyConfig('http://127.0.0.1:3000/', undefined);
    expect(toAbsoluteAssetUrl('/uploads/a.png')).toBe('http://127.0.0.1:8080/uploads/a.png');
  });

  it('http(s)·blob·data 주소는 그대로 두고 // 주소에는 현재 프로토콜을 붙인다', () => {
    applyConfig('https://gamerin.test/', 'https://api.gamerin.test');
    for (const url of ['http://cdn.test/a.png', 'HTTPS://cdn.test/a.png', 'blob:https://gamerin.test/id', 'data:image/png;base64,AA']) {
      expect(toAbsoluteAssetUrl(url)).toBe(url);
    }
    expect(toAbsoluteAssetUrl('//cdn.test/a.png')).toBe('https://cdn.test/a.png');
  });
});

describe('isApiOriginUrl', () => {
  it('명시적 API 주소와 origin이 같은 주소와 경로만 있는 상대경로만 허용한다', () => {
    applyConfig('https://gamerin.test/', 'https://api.gamerin.test/');

    expect(isApiOriginUrl('https://api.gamerin.test/api/v1/messages/attachments/a-1')).toBe(true);
    expect(isApiOriginUrl(' HTTPS://API.gamerin.test:443/x ')).toBe(true);
    expect(isApiOriginUrl('/api/v1/messages/attachments/a-1')).toBe(true);
    expect(isApiOriginUrl('uploads/a.png')).toBe(true);
    // //host는 상대경로가 아니라 현재 프로토콜의 절대 주소로 보고 origin을 비교한다.
    expect(isApiOriginUrl('//api.gamerin.test/x')).toBe(true);

    for (const url of [
      'http://api.gamerin.test/x', // 다른 프로토콜
      'https://api.gamerin.test:8443/x', // 다른 포트
      'https://evil.test/x', // 다른 호스트
      'https://api.gamerin.test.evil.test/x',
      'https://gamerin.test/x', // 프론트 origin은 API origin이 아니다
      '//evil.test/x',
      '/\\evil.test/x',
      'blob:https://api.gamerin.test/id',
      'data:text/plain,x',
      'javascript:alert(1)',
      'https://',
      '',
      '   ',
    ]) {
      expect(isApiOriginUrl(url), url).toBe(false);
    }
  });

  it('nginx(빈 base URL)에서는 현재 페이지 origin을 API origin으로 본다', () => {
    applyConfig('https://gamerin.test/messages', '');

    expect(isApiOriginUrl('https://gamerin.test/api/v1/messages/attachments/a-1')).toBe(true);
    expect(isApiOriginUrl('//gamerin.test/api/v1/messages/attachments/a-1')).toBe(true);
    expect(isApiOriginUrl('http://gamerin.test/x')).toBe(false);
    expect(isApiOriginUrl('https://cdn.gamerin.test/x')).toBe(false);
  });

  it('로컬 개발(3000 → 8080)에서는 같은 호스트의 8080만 API origin이다', () => {
    applyConfig('http://localhost:3000/messages', undefined);

    expect(isApiOriginUrl('http://localhost:8080/api/v1/messages/attachments/a-1')).toBe(true);
    expect(isApiOriginUrl('http://localhost:3000/x')).toBe(false);
    expect(isApiOriginUrl('http://127.0.0.1:8080/x')).toBe(false);
  });

  it('호출 시점의 설정을 쓴다', () => {
    applyConfig('https://gamerin.test/', 'https://api.gamerin.test');
    expect(isApiOriginUrl('https://api2.gamerin.test/x')).toBe(false);

    applyConfig('https://gamerin.test/', 'https://api2.gamerin.test');
    expect(isApiOriginUrl('https://api2.gamerin.test/x')).toBe(true);
  });
});
