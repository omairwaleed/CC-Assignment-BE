import { Injectable, UnauthorizedException } from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class SupabaseAuthService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async verifyAccessToken(accessToken: string): Promise<User> {
    const { data, error } =
      await this.supabaseService.client.auth.getUser(accessToken);

    if (error || !data.user) {
      throw new UnauthorizedException('Invalid or expired access token.');
    }

    return data.user;
  }

  getTokenFromRequest(req: {
    headers: { authorization?: string; cookie?: string };
  }): string | undefined {
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith('Bearer ')) {
      const headerToken = authHeader.split(' ')[1]?.trim();
      if (headerToken) {
        return headerToken;
      }
    }
  }
}
