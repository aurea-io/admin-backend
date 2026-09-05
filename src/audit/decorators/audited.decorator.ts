import { SetMetadata } from '@nestjs/common';
import { AUDITED_METADATA_KEY } from '../constants/audit.constants.js';
import type { AuditedOptions } from '../interfaces/audit-entry.interface.js';

export const Audited = (options: AuditedOptions) =>
  SetMetadata(AUDITED_METADATA_KEY, options);
