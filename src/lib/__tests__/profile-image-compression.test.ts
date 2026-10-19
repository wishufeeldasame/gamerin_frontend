import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compressProfileImage, convertImageForUpload } from '@/lib/profile-image-compression';

// jsdom은 이미지 디코딩과 canvas를 구현하지 않으므로 브라우저 동작을 흉내 낸다.
let decodeFails = false;
let naturalSize = { width: 8064, height: 6048 };
const drawImage = vi.fn();

class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = naturalSize.width;
  naturalHeight = naturalSize.height;

  set src(_value: string) {
    queueMicrotask(() => (decodeFails ? this.onerror?.() : this.onload?.()));
  }
}

beforeEach(() => {
  decodeFails = false;
  naturalSize = { width: 8064, height: 6048 };
  drawImage.mockClear();
  vi.stubGlobal('Image', MockImage);
  URL.createObjectURL = vi.fn(() => 'blob:mock');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect: vi.fn(),
    drawImage,
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (callback) {
    callback(new Blob(['jpeg'], { type: 'image/jpeg' }));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('convertImageForUpload', () => {
  it('48MP 사진을 서버 저장 기준(긴 변 2048px) JPEG로 줄인다', async () => {
    const result = await convertImageForUpload(new File(['x'], 'IMG_0001.HEIC', { type: 'image/heic' }));

    expect(result.type).toBe('image/jpeg');
    expect(result.name).toBe('IMG_0001.jpg');
    expect(drawImage).toHaveBeenCalledWith(expect.any(MockImage), 0, 0, 2048, 1536);
  });

  it('작은 사진은 키우지 않는다', async () => {
    naturalSize = { width: 800, height: 1200 };

    await convertImageForUpload(new File(['x'], 'photo.png', { type: 'image/png' }));

    expect(drawImage).toHaveBeenCalledWith(expect.any(MockImage), 0, 0, 800, 1200);
  });

  it('애니메이션 GIF는 변환하지 않는다', async () => {
    const gif = new File(['x'], 'anim.gif', { type: 'image/gif' });

    await expect(convertImageForUpload(gif)).resolves.toBe(gif);
    expect(drawImage).not.toHaveBeenCalled();
  });

  it('HEIC를 디코딩하지 못하는 브라우저에서는 변환 안내를 보여준다', async () => {
    decodeFails = true;

    await expect(
      convertImageForUpload(new File(['x'], 'IMG_0002.heic', { type: '' }))
    ).rejects.toThrow('HEIC 사진을 변환할 수 없습니다');
  });

  it('HEIC가 아닌 이미지의 디코딩 실패는 기존 메시지를 유지한다', async () => {
    decodeFails = true;

    await expect(
      convertImageForUpload(new File(['x'], 'broken.jpg', { type: 'image/jpeg' }))
    ).rejects.toThrow('이미지를 읽을 수 없습니다.');
  });
});

describe('compressProfileImage', () => {
  it('HEIC 프로필 이미지도 JPEG로 압축한다', async () => {
    const result = await compressProfileImage(new File(['x'], 'me.heic', { type: 'image/heic' }), 'PROFILE');

    expect(result.type).toBe('image/jpeg');
  });

  it('JPEG·PNG·HEIC 외 형식은 거절한다', async () => {
    await expect(
      compressProfileImage(new File(['x'], 'me.gif', { type: 'image/gif' }), 'PROFILE')
    ).rejects.toThrow('JPEG 또는 PNG 이미지만 업로드할 수 있습니다.');
  });
});
