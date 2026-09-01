import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Session, User } from '@supabase/supabase-js';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class SupabaseAuthService {
  constructor(private readonly supabaseService: SupabaseService) { }

  async signInWithPassword(
    email: string,
    password: string,
  ): Promise<{ user: User; session: Session }> {
    const { data, error } =
      await this.supabaseService.client.auth.signInWithPassword({
        email,
        password,
      });

    if (error || !data.session || !data.user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    return { user: data.user, session: data.session };
  }

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
