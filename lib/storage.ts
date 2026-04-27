const TARGET_SIZE_KB = 300;
const MAX_WIDTH = 2048;
const MAX_HEIGHT = 2048;

function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // 限制最大尺寸
      if (width > MAX_WIDTH) {
        height = (height * MAX_WIDTH) / width;
        width = MAX_WIDTH;
      }
      if (height > MAX_HEIGHT) {
        width = (width * MAX_HEIGHT) / height;
        height = MAX_HEIGHT;
      }

      width = Math.round(width);
      height = Math.round(height);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);

      // 先用 0.8 质量导出，再逐步降低直到满足目标大小
      const tryCompress = (quality: number): void => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('图片压缩失败'));
              return;
            }
            if (blob.size <= TARGET_SIZE_KB * 1024 || quality <= 0.1) {
              resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }));
            } else {
              tryCompress(quality - 0.1);
            }
          },
          'image/jpeg',
          quality
        );
      };

      tryCompress(0.8);
    };
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = URL.createObjectURL(file);
  });
}

export async function uploadImage(file: File): Promise<string> {
  const compressed = await compressImage(file);
  return uploadFile(compressed);
}

function getExtensionFromFile(file: File): string {
  const byName = file.name.split('.').pop()?.toLowerCase();
  if (byName && byName.length <= 8) return byName;

  const byType = file.type.split('/').pop()?.toLowerCase();
  if (byType && byType.length <= 8) return byType;

  return 'bin';
}

export async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('ext', getExtensionFromFile(file));

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  const data = await response.json().catch(() => null) as { url?: string; error?: string } | null;

  if (!response.ok || !data?.url) {
    throw new Error(data?.error || '上传失败');
  }

  return data.url;
}

export async function uploadBuffer(buffer: ArrayBuffer, contentType: string, ext: string): Promise<string> {
  const file = new File([buffer], `upload.${ext}`, { type: contentType });
  return uploadFile(file);
}
