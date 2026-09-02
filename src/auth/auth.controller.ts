import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { GoogleLoginDto } from './dto/google-login.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { Public } from './decorators/public.decorator.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import type { PlatformJwtPayload } from './interfaces/jwt-payload.interface.js';
import { PlatformJwtAuthGuard } from './guards/platform-jwt-auth.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    return this.respondWithSession(await this.authService.login(dto), response);
  }

  @Public()
  @Post('google')
  @HttpCode(HttpStatus.OK)
  async googleLogin(@Body() dto: GoogleLoginDto, @Res({ passthrough: true }) response: Response) {
    return this.respondWithSession(await this.authService.loginWithGoogle(dto), response);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = request.cookies?.aurea_refresh;
    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new UnauthorizedException('Invalid, expired, or revoked refresh session');
    }
    return this.respondWithSession(await this.authService.refresh(refreshToken), response);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = request.cookies?.aurea_refresh;
    await this.authService.logout(typeof refreshToken === 'string' ? refreshToken : undefined);
    const { maxAge: _maxAge, ...cookieOptions } = this.refreshCookieOptions();
    response.clearCookie('aurea_refresh', cookieOptions);
  }

  @UseGuards(PlatformJwtAuthGuard)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async me(@CurrentUser() user: PlatformJwtPayload) {
    return this.authService.getProfile(user.sub);
  }

  @UseGuards(PlatformJwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: PlatformJwtPayload,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.changePassword(user.sub, dto);
    return this.respondWithSession(result, response);
  }

  private respondWithSession(session: { accessToken: string; user: unknown; refreshToken: string }, response: Response) {
    if (session.refreshToken && response?.cookie) {
      response.cookie('aurea_refresh', session.refreshToken, this.refreshCookieOptions());
    }
    const { refreshToken: _refreshToken, refreshSessionId: _refreshSessionId, ...body } = session as typeof session & { refreshSessionId?: string };
    return body;
  }

  private refreshCookieOptions() {
    const isProduction = process.env.NODE_ENV === 'production';
    const secure = isProduction || process.env.COOKIE_SECURE === 'true';
    const configuredSameSite = process.env.COOKIE_SAME_SITE?.toLowerCase();
    const sameSite = configuredSameSite === 'none' ? 'none' : configuredSameSite === 'strict' ? 'strict' : 'lax';
    if (sameSite === 'none' && !secure) throw new Error('COOKIE_SAME_SITE=none requires COOKIE_SECURE=true');
    return { httpOnly: true, secure, sameSite, path: '/api/v1/auth', maxAge: this.refreshCookieMaxAge() } as const;
  }

  private refreshCookieMaxAge(): number {
    const match = /^(\d+)([smhd])$/.exec(process.env.JWT_REFRESH_EXPIRES_IN || '7d');
    if (!match) return 7 * 86_400_000;
    const multiplier = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]];
    return Number(match[1]) * (multiplier ?? 86_400_000);
  }
}
