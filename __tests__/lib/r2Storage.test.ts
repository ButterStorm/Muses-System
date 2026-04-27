import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getPublicObjectUrl, uploadBuffer } from '@/lib/r2Storage';

jest.mock('@aws-sdk/client-s3', () => {
  const send = jest.fn();
  return {
    PutObjectCommand: jest.fn((input) => ({ input })),
    S3Client: jest.fn(() => ({ send })),
  };
});

const mockedS3Client = jest.mocked(S3Client);
const mockedPutObjectCommand = jest.mocked(PutObjectCommand);

describe('r2Storage', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      R2_ACCESS_KEY_ID: 'access-key',
      R2_SECRET_ACCESS_KEY: 'secret-key',
      R2_PUBLIC_BASE_URL: 'https://assets.example.com',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('builds stable public URLs from the configured public base URL', () => {
    expect(getPublicObjectUrl('uploads/file name.jpg')).toBe('https://assets.example.com/uploads/file%20name.jpg');
  });

  it('uploads buffers to the configured R2 bucket', async () => {
    const client = new S3Client({});
    (jest.mocked(client.send) as jest.Mock).mockResolvedValueOnce({});
    mockedS3Client.mockReturnValueOnce(client);

    const url = await uploadBuffer(new Uint8Array([1, 2, 3]).buffer, 'image/jpeg', 'jpg');

    expect(url).toMatch(/^https:\/\/assets\.example\.com\/uploads\/.+\.jpg$/);
    expect(mockedPutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: 'test',
        ContentType: 'image/jpeg',
      })
    );
    expect(client.send).toHaveBeenCalled();
  });

  it('fails fast when R2 public URL is not configured', async () => {
    delete process.env.R2_PUBLIC_BASE_URL;

    await expect(uploadBuffer(new Uint8Array([1]).buffer, 'image/jpeg', 'jpg')).rejects.toThrow('R2_PUBLIC_BASE_URL');
  });
});
