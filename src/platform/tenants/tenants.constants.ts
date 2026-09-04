export const TENANTS_MESSAGES = {
  NOT_FOUND: 'Tenant not found',
  SLUG_EXISTS: 'A tenant with this slug already exists',
  INVALID_SLUG: 'Tenant slug must contain only lowercase letters, numbers, and hyphens',
  CREATED: 'Tenant created successfully',
  UPDATED: 'Tenant updated successfully',
  STATUS_UPDATED: 'Tenant status updated successfully',
  ENTITLEMENTS_UPDATED: 'Tenant entitlements and overrides updated successfully',
  INVALID_STATUS: 'Status must be active or suspended',
} as const;

export const TENANTS_PAGINATION = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  DEFAULT_OFFSET: 0,
} as const;

export const TENANT_SAFE_SELECT = {
  id: true,
  slug: true,
  name: true,
  vertical: true,
  status: true,
  planKey: true,
  isActive: true,
  maintenanceMode: true,
  maintenanceMessage: true,
  createdAt: true,
  updatedAt: true,
} as const;
