import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LoginDto } from './dto/login.dto';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';
import { SupabaseAuthService } from './supabase-auth.service';
import type { AuthenticatedRequest } from './types/authenticated-request';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly supabaseAuthService: SupabaseAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with email + password via Supabase Auth' })
  @ApiResponse({
    status: 200,
    description: 'The Supabase session and authenticated user.',
    schema: {
      example: {
        accessToken: 'eyJhbGciOi...',
        refreshToken: 'v1.Mr8...',
        expiresAt: 1735689600,
        tokenType: 'bearer',
        user: {
          id: 'a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
          email: 'doctor@example.com',
          role: 'doctor',
        },
      },
    },
  })
  async login(@Body() dto: LoginDto) {
    const { user, session } = await this.supabaseAuthService.signInWithPassword(
      dto.email,
      dto.password,
    );

    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at,
      tokenType: session.token_type,
      user: {
        id: user.id,
        email: user.email,
        role: user.user_metadata?.role ?? null,
      },
    };
  }

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
      role: authUser.user_metadata?.role ?? null,
      metadata: authUser.user_metadata,
    };
  }
}
