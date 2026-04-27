import { NextRequest, NextResponse } from 'next/server';
import { uploadBuffer } from '@/lib/serverStorage';

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

    const ext = getExtensionFromFile(file, formData.get('ext'));
    const contentType = file.type || 'application/octet-stream';
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
