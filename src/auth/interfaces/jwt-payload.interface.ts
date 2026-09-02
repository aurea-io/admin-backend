import { PlatformRole } from '@prisma/client';

export interface PlatformJwtPayload {
  sub: string;
  email: string;
  name: string;
  role: PlatformRole;
  tokenVersion: number;
  scope: 'platform';
  iat?: number;
  exp?: number;
}
