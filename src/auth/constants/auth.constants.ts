export const BCRYPT_SALT_ROUNDS = 12;

export const DUMMY_TIMING_ATTACK_HASH =
  '$2b$12$invalidhashpaddingtopreventemailenumerationtimingattack';

export const PLATFORM_USER_SAFE_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  allowedFeatures: true,
  isActive: true,
  tokenVersion: true,
  lastLoginAt: true,
  createdAt: true,
} as const;
