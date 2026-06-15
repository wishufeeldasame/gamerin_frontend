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

export async function compressProfileImage(file: File, target: ProfileImageUploadTarget) {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    throw new Error('JPEG 또는 PNG 이미지만 업로드할 수 있습니다.');
  }

  const policy = COMPRESSION_POLICIES[target];
  const image = await loadImage(file);

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
