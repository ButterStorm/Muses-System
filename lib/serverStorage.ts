import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BUCKET = 'test';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_MIME_TYPES: string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/mp4',
  'video/mp4',
  'video/webm',
  'application/pdf',
  'application/json',
];

/**
 * 创建服务端 Supabase 客户端
 */
function getServerClient() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase 配置错误：缺少必要的环境变量');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * 上传 Buffer 到 Supabase Storage（服务端专用）
 * @param buffer - 文件内容
 * @param contentType - MIME 类型
 * @param ext - 文件扩展名
 * @returns 公共 URL
 */
export async function uploadBuffer(
  buffer: ArrayBuffer,
  contentType: string,
  ext: string
): Promise<string> {
  // 文件大小检查
  if (buffer.byteLength > MAX_FILE_SIZE) {
    throw new Error(`文件大小超过限制（最大 ${MAX_FILE_SIZE / 1024 / 1024}MB）`);
  }

  // MIME 类型检查
  if (!ALLOWED_MIME_TYPES.includes(contentType)) {
    throw new Error(`不支持的文件类型: ${contentType}`);
  }

  const supabase = getServerClient();
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
