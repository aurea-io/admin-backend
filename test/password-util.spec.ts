import { describe, it, expect } from 'vitest';
import { PasswordUtil } from '../src/auth/utils/password.util.js';

describe('PasswordUtil', () => {
  const plainPassword = 'MySuperSecretPassword123!';

  it('should hash password and verify successfully', async () => {
    const hash = await PasswordUtil.hash(plainPassword);
    expect(hash).toBeDefined();
    expect(hash).not.toBe(plainPassword);

    const isValid = await PasswordUtil.compare(plainPassword, hash);
    expect(isValid).toBe(true);
  });

  it('should return false for invalid password comparison', async () => {
    const hash = await PasswordUtil.hash(plainPassword);
    const isValid = await PasswordUtil.compare('WrongPassword', hash);
    expect(isValid).toBe(false);
  });

  it('should handle null/undefined hash safely (dummy comparison)', async () => {
    const isValidNull = await PasswordUtil.compare(plainPassword, null);
    expect(isValidNull).toBe(false);

    const isValidUndefined = await PasswordUtil.compare(plainPassword, undefined);
    expect(isValidUndefined).toBe(false);
  });
});
