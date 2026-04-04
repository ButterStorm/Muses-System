import { supabase } from './supabase';

const BUCKET = 'test';

export async function uploadImage(file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'png';
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const path = `uploads/${timestamp}_${random}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false });

  if (error) {
    throw new Error('上传失败: ' + error.message);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
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
