import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseAuthService } from '../supabase-auth.service';
import { AuthenticatedRequest } from '../types/authenticated-request';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly supabaseAuthService: SupabaseAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.supabaseAuthService.getTokenFromRequest(request);

    if (!token) {
      throw new UnauthorizedException('Missing access token.');
    }

    const user = await this.supabaseAuthService.verifyAccessToken(token);
    request.authToken = token;
    request.authUser = user;

    return true;
  }
}
