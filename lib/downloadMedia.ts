'use client';

const IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
  'image/svg+xml': 'svg',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

export async function downloadImageUrl(imageUrl: string, fallbackName = 'generated-image') {
  const blob = await fetchImageBlob(imageUrl);
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  try {
    link.href = objectUrl;
    link.download = getDownloadFileName(imageUrl, blob.type, fallbackName);
    document.body.appendChild(link);
    link.click();
  } finally {
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
  }
}

async function fetchImageBlob(imageUrl: string): Promise<Blob> {
  try {
    const directResponse = await fetch(imageUrl, { mode: 'cors' });
    if (directResponse.ok) return directResponse.blob();
  } catch {
    // Cross-origin image hosts often block browser fetch. Fall through to the server proxy.
  }

  const proxyResponse = await fetch(`/api/media/proxy?url=${encodeURIComponent(imageUrl)}`);
  if (!proxyResponse.ok) {
    throw new Error('图片下载失败');
  }
  return proxyResponse.blob();
}

function getDownloadFileName(imageUrl: string, mimeType: string, fallbackName: string) {
  const urlName = getFileNameFromUrl(imageUrl);
  if (urlName) return urlName;

  const ext = IMAGE_EXTENSION_BY_MIME[mimeType.toLowerCase()] || 'png';
  return `${fallbackName}.${ext}`;
}

function getFileNameFromUrl(imageUrl: string) {
  try {
    const pathname = new URL(imageUrl).pathname;
    const name = decodeURIComponent(pathname.split('/').pop() || '');
    return /\.(svg|png|jpe?g|webp|gif|avif)$/i.test(name) ? name : '';
  } catch {
    return '';
  }
}
