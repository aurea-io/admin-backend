import bcrypt from 'bcrypt';
import { BCRYPT_SALT_ROUNDS, DUMMY_TIMING_ATTACK_HASH } from '../constants/auth.constants.js';

export class PasswordUtil {
  /**
   * Hashes a raw password string with bcrypt using the standard salt rounds.
   */
  static async hash(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  }

  /**
   * Safely compares a candidate password against a hash.
   * If the hash is null or undefined, a dummy comparison is executed to prevent timing attacks.
   */
  static async compare(candidate: string, hash: string | null | undefined): Promise<boolean> {
    const targetHash = hash || DUMMY_TIMING_ATTACK_HASH;
    const isValid = await bcrypt.compare(candidate, targetHash);
    return Boolean(hash && isValid);
  }
}
