import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthController } from '../src/auth/auth.controller.js';
import { PlatformRole } from '@prisma/client';

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuthService: any;

  beforeEach(() => {
    mockAuthService = {
      login: vi.fn(),
      loginWithGoogle: vi.fn(),
      getProfile: vi.fn(),
      changePassword: vi.fn(),
    };
    controller = new AuthController(mockAuthService);
  });

  it('should call authService.login on login endpoint', async () => {
    const loginDto = { email: 'admin@aurea.io', password: 'Password123!' };
    mockAuthService.login.mockResolvedValue({
      accessToken: 'token-123',
      user: { id: 'u1', email: 'admin@aurea.io' },
    });

    const mockResponse: any = { cookie: vi.fn(), clearCookie: vi.fn() };
    const result = await controller.login(loginDto, mockResponse);
    expect(mockAuthService.login).toHaveBeenCalledWith(loginDto);
    expect(result.accessToken).toBe('token-123');
  });

  it('should call authService.loginWithGoogle on google endpoint', async () => {
    const googleDto = {
      idToken: 'google-valid-token-123',
    };
    mockAuthService.loginWithGoogle.mockResolvedValue({
      accessToken: 'token-google',
      user: { id: 'u1', email: 'admin@aurea.io' },
    });

    const mockResponse: any = { cookie: vi.fn(), clearCookie: vi.fn() };
    const result = await controller.googleLogin(googleDto, mockResponse);
    expect(mockAuthService.loginWithGoogle).toHaveBeenCalledWith(googleDto);
    expect(result.accessToken).toBe('token-google');
  });

  it('should call authService.getProfile on me endpoint', async () => {
    const userPayload = {
      sub: 'u1',
      email: 'admin@aurea.io',
      name: 'Admin',
      role: PlatformRole.platform_owner,
      tokenVersion: 1,
      scope: 'platform' as const,
    };
    mockAuthService.getProfile.mockResolvedValue({
      id: 'u1',
      email: 'admin@aurea.io',
      name: 'Admin',
      role: PlatformRole.platform_owner,
      allowedFeatures: [],
    });

    const result = await controller.me(userPayload);
    expect(mockAuthService.getProfile).toHaveBeenCalledWith('u1');
    expect(result.id).toBe('u1');
  });

  it('should call authService.changePassword on change-password endpoint', async () => {
    const userPayload = {
      sub: 'u1',
      email: 'admin@aurea.io',
      name: 'Admin',
      role: PlatformRole.platform_owner,
      tokenVersion: 1,
      scope: 'platform' as const,
    };
    const dto = {
      currentPassword: 'OldPassword123!',
      newPassword: 'NewPassword123!',
    };
    mockAuthService.changePassword.mockResolvedValue({
      message: 'Password updated successfully. Other active sessions have been revoked.',
      tokenVersion: 2,
      accessToken: 'new-token',
    });

    const mockResponse: any = { cookie: vi.fn(), clearCookie: vi.fn() };
    const result = await controller.changePassword(userPayload, dto, mockResponse);
    expect(mockAuthService.changePassword).toHaveBeenCalledWith('u1', dto);
    expect((result as any).tokenVersion).toBe(2);
  });
});
