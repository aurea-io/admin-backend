import { SetMetadata } from '@nestjs/common';

export const REQUIRE_FEATURES_KEY = 'requireFeatures';
export const RequireFeatures = (...features: string[]) =>
  SetMetadata(REQUIRE_FEATURES_KEY, features);
