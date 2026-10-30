export type ProfileImageUploadTarget = 'PROFILE' | 'COVER';

type CompressionPolicy = {
  maxDimension: number;
  minDimension: number;
  maxBytes: number;
  qualities: number[];
  filename: string;
};

const COMPRESSION_POLICIES: Record<ProfileImageUploadTarget, CompressionPolicy> = {
  PROFILE: {
    maxDimension: 512,
    minDimension: 256,
    maxBytes: 700 * 1024,
    qualities: [0.82, 0.74, 0.66],
    filename: 'profile-avatar.jpg',
  },
  COVER: {
    maxDimension: 1920,
    minDimension: 960,
    maxBytes: 2 * 1024 * 1024,
    qualities: [0.82, 0.74, 0.66],
    filename: 'profile-cover.jpg',
  },
};

const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);

// 서버가 게시물·DM 이미지를 긴 변 2048px로 저장하므로 그 이상은 보내지 않는다.
const UPLOAD_IMAGE_MAX_DIMENSION = 2048;
const UPLOAD_IMAGE_QUALITY = 0.9;
const HEIC_DECODE_ERROR = '이 브라우저에서는 HEIC 사진을 변환할 수 없습니다. JPEG로 변환한 뒤 다시 올려주세요.';

export function isHeicFile(file: File) {
  return /^image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

function isGifFile(file: File) {
  return file.type.toLowerCase() === 'image/gif' || /\.gif$/i.test(file.name);
}

/**
 * 게시물·DM 업로드 전 정적 이미지를 JPEG로 다시 그린다.
 * canvas가 EXIF 회전을 반영해 그리므로 서버 재인코딩 뒤에도 방향이 유지되고,
 * 48MP처럼 서버 해상도 한도를 넘는 사진도 줄여서 보낸다. 애니메이션 GIF는 그대로 둔다.
 */
export async function convertImageForUpload(file: File): Promise<File> {
  if (isGifFile(file)) {
    return file;
  }

  const image = await loadImage(file).catch((error: unknown) => {
    throw isHeicFile(file) ? new Error(HEIC_DECODE_ERROR) : error;
  });
  const blob = await canvasToJpegBlob(drawImageToCanvas(image, UPLOAD_IMAGE_MAX_DIMENSION), UPLOAD_IMAGE_QUALITY);
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';

  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}

// 고해상도 사진을 한꺼번에 디코딩하면 iOS 탭이 메모리 부족으로 다시 로드되므로 한 장씩 변환한다.
export async function convertImagesForUpload(files: File[]): Promise<File[]> {
  const converted: File[] = [];
  for (const file of files) {
    converted.push(await convertImageForUpload(file));
  }
  return converted;
}

export async function compressProfileImage(file: File, target: ProfileImageUploadTarget) {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type) && !isHeicFile(file)) {
    throw new Error('JPEG 또는 PNG 이미지만 업로드할 수 있습니다.');
  }

  const policy = COMPRESSION_POLICIES[target];
  const image = await loadImage(file).catch((error: unknown) => {
    throw isHeicFile(file) ? new Error(HEIC_DECODE_ERROR) : error;
  });

  let maxDimension = policy.maxDimension;
  while (maxDimension >= policy.minDimension) {
    const canvas = drawImageToCanvas(image, maxDimension);

    for (const quality of policy.qualities) {
      const blob = await canvasToJpegBlob(canvas, quality);
      if (blob.size <= policy.maxBytes) {
        return new File([blob], policy.filename, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
      }
    }

    maxDimension = Math.floor(maxDimension / 2);
  }

  throw new Error('이미지를 충분히 압축할 수 없습니다. 더 작은 이미지를 선택해주세요.');
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('이미지를 읽을 수 없습니다.'));
    };
    image.src = objectUrl;
  });
}

function drawImageToCanvas(image: HTMLImageElement, maxDimension: number) {
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = longestSide > maxDimension ? maxDimension / longestSide : 1;
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('이미지를 압축할 수 없습니다.');
  }

  canvas.width = width;
  canvas.height = height;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);

  return canvas;
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('이미지를 압축할 수 없습니다.'));
          return;
        }

        resolve(blob);
      },
      'image/jpeg',
      quality
    );
  });
}
