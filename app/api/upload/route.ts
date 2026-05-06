import { NextRequest, NextResponse } from 'next/server';
import { uploadBuffer } from '@/lib/serverStorage';
import { ALLOWED_UPLOAD_MIME_TYPES, MAX_UPLOAD_FILE_SIZE } from '@/lib/r2Storage';

export const runtime = 'nodejs';

function getExtensionFromFile(file: File, fallback?: FormDataEntryValue | null): string {
  const fromForm = typeof fallback === 'string' ? fallback : '';
  if (fromForm && /^[a-zA-Z0-9]{1,12}$/.test(fromForm)) return fromForm.toLowerCase();

  const byName = file.name.split('.').pop()?.toLowerCase();
  if (byName && /^[a-zA-Z0-9]{1,12}$/.test(byName)) return byName;

  const byType = file.type.split('/').pop()?.toLowerCase();
  if (byType && /^[a-zA-Z0-9]{1,12}$/.test(byType)) return byType;

  return 'bin';
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: '缺少上传文件' }, { status: 400 });
    }

    if (file.size === 0) {
      return NextResponse.json({ error: '上传文件不能为空' }, { status: 400 });
    }

    const ext = getExtensionFromFile(file, formData.get('ext'));
    const contentType = file.type || 'application/octet-stream';

    if (!ALLOWED_UPLOAD_MIME_TYPES.includes(contentType)) {
      return NextResponse.json({ error: `不支持的文件类型: ${contentType}` }, { status: 415 });
    }

    if (file.size > MAX_UPLOAD_FILE_SIZE) {
      return NextResponse.json(
        { error: `文件大小超过限制（最大 ${MAX_UPLOAD_FILE_SIZE / 1024 / 1024}MB）` },
        { status: 413 }
      );
    }

    const url = await uploadBuffer(await file.arrayBuffer(), contentType, ext);

    return NextResponse.json({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : '上传失败';
    console.error('[Upload API] Error:', error instanceof Error ? {
      name: error.name,
      message: error.message,
      code: 'code' in error ? (error as { code?: unknown }).code : undefined,
      statusCode: '$metadata' in error
        ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
        : undefined,
    } : error);
    const status = message.startsWith('不支持的文件类型')
      ? 415
      : message.startsWith('文件大小超过限制')
        ? 413
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
