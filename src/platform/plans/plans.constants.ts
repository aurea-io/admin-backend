export const PLANS_MESSAGES = {
  NOT_FOUND: 'Plan not found',
  KEY_EXISTS: 'A plan with this key already exists',
  INVALID_KEY: 'Plan key must contain only lowercase letters, numbers, hyphens, or underscores',
  INVALID_STATUS_TRANSITION: 'Invalid plan status transition',
  CREATED: 'Plan created successfully',
  UPDATED: 'Plan updated successfully',
  STATUS_UPDATED: 'Plan status updated successfully',
  ARCHIVED: 'Plan archived successfully',
} as const;

export const PLANS_PAGINATION = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  DEFAULT_OFFSET: 0,
} as const;

export const PLAN_SAFE_SELECT = {
  id: true,
  key: true,
  name: true,
  description: true,
  status: true,
  displayOrder: true,
  includedFeatures: true,
  prices: true,
  credits: true,
  limits: true,
  trialDays: true,
  gracePeriodDays: true,
  isPopular: true,
  version: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

