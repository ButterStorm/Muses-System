import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '4b707dcf025c337cca8d81f26929f781';
const R2_ENDPOINT =
  process.env.R2_ENDPOINT ||
  `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const R2_BUCKET = process.env.R2_BUCKET || 'test';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_MIME_TYPES: string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/mp4',
  'video/mp4',
  'video/mov',
  'video/quicktime',
  'application/pdf',
  'application/json',
];

interface R2Config {
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
}

function getR2Config(): R2Config {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('R2 配置错误：缺少 R2_ACCESS_KEY_ID 或 R2_SECRET_ACCESS_KEY');
  }

  if (!publicBaseUrl) {
    throw new Error('R2 配置错误：缺少 R2_PUBLIC_BASE_URL');
  }

  return { accessKeyId, secretAccessKey, publicBaseUrl };
}

function getR2Client(config: R2Config) {
  return new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

function createObjectKey(ext: string): string {
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'bin';
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `uploads/${timestamp}_${random}.${safeExt}`;
}

export function getPublicObjectUrl(key: string): string {
  const { publicBaseUrl } = getR2Config();
  const base = publicBaseUrl.replace(/\/+$/, '');
  const encodedKey = key
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  return `${base}/${encodedKey}`;
}

export async function uploadBuffer(
  buffer: ArrayBuffer,
  contentType: string,
  ext: string
): Promise<string> {
  if (buffer.byteLength > MAX_FILE_SIZE) {
    throw new Error(`文件大小超过限制（最大 ${MAX_FILE_SIZE / 1024 / 1024}MB）`);
  }

  if (!ALLOWED_MIME_TYPES.includes(contentType)) {
    throw new Error(`不支持的文件类型: ${contentType}`);
  }

  const config = getR2Config();
  const key = createObjectKey(ext);
  const client = getR2Client(config);

  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: Buffer.from(buffer),
      ContentType: contentType,
    })
  );

  return getPublicObjectUrl(key);
}
