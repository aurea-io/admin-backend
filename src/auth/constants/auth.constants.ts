export const BCRYPT_SALT_ROUNDS = 12;

export const DUMMY_TIMING_ATTACK_HASH =
  '$2b$12$invalidhashpaddingtopreventemailenumerationtimingattack';

export const AUTH_ENV_KEYS = {
  JWT_ACCESS_SECRET: 'JWT_ACCESS_SECRET',
  JWT_ACCESS_EXPIRES_IN: 'JWT_ACCESS_EXPIRES_IN',
  JWT_REFRESH_EXPIRES_IN: 'JWT_REFRESH_EXPIRES_IN',
  COOKIE_SECURE: 'COOKIE_SECURE',
  COOKIE_SAME_SITE: 'COOKIE_SAME_SITE',
  GOOGLE_CLIENT_ID: 'GOOGLE_CLIENT_ID',
} as const;

export const AUTH_CONFIG = {
  DEFAULT_JWT_EXPIRES_IN: '1h',
  DEFAULT_REFRESH_EXPIRES_IN: '7d',
  REFRESH_COOKIE_NAME: 'aurea_refresh',
  PLATFORM_SCOPE: 'platform',
  STRATEGY_JWT: 'jwt',
  GOOGLE_TOKENINFO_ENDPOINT: 'https://oauth2.googleapis.com/tokeninfo',
} as const;

export const AUTH_MESSAGES = {
  PASSWORD_UPDATED:
    'Password updated successfully. Other active sessions have been revoked.',
} as const;

export const AUTH_ERRORS = {
  JWT_SECRET_NOT_CONFIGURED:
    'JWT_ACCESS_SECRET must be configured in environment variables',
  INVALID_CREDENTIALS: 'Invalid email address or password',
  USER_INACTIVE_OR_NOT_FOUND: 'Platform user not found or inactive',
  CURRENT_PASSWORD_INCORRECT: 'Current password is incorrect',
  INVALID_OR_MISSING_TOKEN: 'Invalid or missing platform access token',
  INVALID_TOKEN_SCOPE: 'Invalid platform token or invalid token scope',
  SESSION_REVOKED: 'Session has been revoked or expired',
  UNAUTHENTICATED: 'Access denied: platform user is not authenticated',
  UNAUTHORIZED_ROLE: 'Unauthorized user role on platform',
  GOOGLE_TOKEN_NOT_PROVIDED: 'Google ID token was not provided',
  GOOGLE_TOKEN_INVALID_OR_EXPIRED: 'Invalid or expired Google ID token',
  GOOGLE_CLAIMS_MALFORMED: 'Incomplete or malformed claims in Google token',
  GOOGLE_AUDIENCE_MISMATCH: 'Invalid Google token audience',
  GOOGLE_VALIDATION_FAILED: 'Failed to validate credentials with Google',
  GOOGLE_UNAUTHORIZED_USER: 'Platform user not found or not authorized',
  GOOGLE_CLIENT_ID_NOT_CONFIGURED:
    'GOOGLE_CLIENT_ID must be configured in environment variables',
  INVALID_REFRESH_TOKEN: 'Invalid, expired, or revoked refresh session',
} as const;

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
