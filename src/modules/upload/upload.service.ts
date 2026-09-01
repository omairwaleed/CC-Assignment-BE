import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class UploadService {
  private readonly bucket =
    process.env.SUPABASE_STORAGE_BUCKET ?? 'imaging-studies';

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Mint a short-lived signed URL the frontend uploads the file to directly,
   * without the file ever passing through this API.
   */
  async createSignedUploadUrl(path: string, upsert = false) {
    const normalizedPath = path.replace(/^\/+/, '');

    const { data, error } = await this.supabase.client.storage
      .from(this.bucket)
      .createSignedUploadUrl(normalizedPath, { upsert });

    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message ?? 'Failed to create signed upload URL.',
      );
    }

    return {
      bucket: this.bucket,
      path: data.path,
      token: data.token,
      signedUrl: data.signedUrl,
    };
  }

  /**
   * Mint a short-lived signed URL the frontend uses to download/view an
   * existing object.
   */
  async createSignedUrl(path: string, expiresIn = 3600) {
    const normalizedPath = path.replace(/^\/+/, '');

    const { data, error } = await this.supabase.client.storage
      .from(this.bucket)
      .createSignedUrl(normalizedPath, expiresIn);

    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message ?? 'Failed to create signed URL.',
      );
    }

    return {
      bucket: this.bucket,
      path: normalizedPath,
      expiresIn,
      signedUrl: data.signedUrl,
    };
  }
}
