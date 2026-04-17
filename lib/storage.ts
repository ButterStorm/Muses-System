import { supabase } from './supabase';

const BUCKET = 'test';

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
  const ext = 'jpg';
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const path = `uploads/${timestamp}_${random}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, compressed, { upsert: false, contentType: 'image/jpeg' });

  if (error) {
    throw new Error('上传失败: ' + error.message);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function getExtensionFromFile(file: File): string {
  const byName = file.name.split('.').pop()?.toLowerCase();
  if (byName && byName.length <= 8) return byName;

  const byType = file.type.split('/').pop()?.toLowerCase();
  if (byType && byType.length <= 8) return byType;

  return 'bin';
}

export async function uploadFile(file: File): Promise<string> {
  const ext = getExtensionFromFile(file);
  const buffer = await file.arrayBuffer();
  return uploadBuffer(buffer, file.type || 'application/octet-stream', ext);
}

export async function uploadBuffer(buffer: ArrayBuffer, contentType: string, ext: string): Promise<string> {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const path = `uploads/${timestamp}_${random}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { upsert: false, contentType });

  if (error) {
    throw new Error('上传失败: ' + error.message);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
