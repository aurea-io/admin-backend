export const AUDIT_PAGINATION = {
  DEFAULT_LIMIT: 20,
  DEFAULT_OFFSET: 0,
  MAX_LIMIT: 100,
} as const;

export const AUDIT_PERMISSIONS = {
  READ: 'platform.audit.read',
  READ_ALIAS: 'audit.read',
} as const;

export const AUDIT_SENSITIVE_FIELDS: readonly string[] = [
  'password',
  'passwordHash',
  'token',
  'tokenHash',
  'refreshToken',
  'secret',
  'apiKey',
  'authorization',
  'cookie',
] as const;

export const AUDITED_METADATA_KEY = Symbol('AUDITED_METADATA_KEY');
