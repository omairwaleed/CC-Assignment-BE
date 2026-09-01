import { Test } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { UploadService } from './upload.service';
import { SupabaseService } from '../../supabase/supabase.service';

/**
 * Unlike appointments/doctors/imaging-studies, this route has no id-based
 * duplicate check of its own - "duplicate creation" here means asking for a
 * signed upload URL to a path that already has an object, with upsert not
 * set, which Supabase Storage rejects.
 */
describe('UploadService', () => {
  let service: UploadService;
  let createSignedUploadUrl: jest.Mock;

  beforeEach(async () => {
    createSignedUploadUrl = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        UploadService,
        {
          provide: SupabaseService,
          useValue: {
            client: {
              storage: {
                from: jest.fn().mockReturnValue({ createSignedUploadUrl }),
              },
            },
          },
        },
      ],
    }).compile();

    service = moduleRef.get(UploadService);
  });

  describe('createSignedUploadUrl', () => {
    it('returns a signed URL for a new path', async () => {
      createSignedUploadUrl.mockResolvedValue({
        data: { path: 'studies/2026/09/abc123.dcm', token: 'token' },
        error: null,
      });

      const result = await service.createSignedUploadUrl(
        'studies/2026/09/abc123.dcm',
      );

      expect(result.signedUrl).toBeUndefined(); // not set in the mocked payload
      expect(result.path).toBe('studies/2026/09/abc123.dcm');
      expect(createSignedUploadUrl).toHaveBeenCalledWith(
        'studies/2026/09/abc123.dcm',
        { upsert: false },
      );
    });

    it('rejects a duplicate object path when upsert is not requested', async () => {
      // Supabase Storage's real failure mode for "path already exists,
      // upsert:false" - surfaced through the same generic error branch.
      createSignedUploadUrl.mockResolvedValue({
        data: null,
        error: { message: 'The resource already exists' },
      });

      await expect(
        service.createSignedUploadUrl('studies/2026/09/abc123.dcm'),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('allows overwriting an existing path when upsert is true', async () => {
      createSignedUploadUrl.mockResolvedValue({
        data: { path: 'studies/2026/09/abc123.dcm', token: 'token' },
        error: null,
      });

      await service.createSignedUploadUrl('studies/2026/09/abc123.dcm', true);

      expect(createSignedUploadUrl).toHaveBeenCalledWith(
        'studies/2026/09/abc123.dcm',
        { upsert: true },
      );
    });

    it('resolves two concurrent uploads to the same path with exactly one winner', async () => {
      // Supabase Storage itself is the arbiter for concurrent writes to the
      // same object; simulate that with a shared in-memory store so only the
      // first call to "land" succeeds, regardless of call order.
      const store = new Set<string>();

      createSignedUploadUrl.mockImplementation(async (path: string) => {
        await Promise.resolve();

        if (store.has(path)) {
          return {
            data: null,
            error: { message: 'The resource already exists' },
          };
        }

        store.add(path);
        return { data: { path, token: 'token' }, error: null };
      });

      const results = await Promise.allSettled([
        service.createSignedUploadUrl('studies/2026/09/abc123.dcm'),
        service.createSignedUploadUrl('studies/2026/09/abc123.dcm'),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });
});
