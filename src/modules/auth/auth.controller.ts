import {
  Controller,
  Get,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';
import type { AuthenticatedRequest } from './types/authenticated-request';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the authenticated Supabase user' })
  me(@Req() req: AuthenticatedRequest) {
    const authUser = req.authUser;

    if (!authUser) {
      throw new UnauthorizedException('Authentication is required.');
    }

    return {
      id: authUser.id,
      email: authUser.email,
      role: (authUser.user_metadata?.role as string | undefined) ?? null,
      metadata: authUser.user_metadata,
    };
  }
}
