export const CATALOG_CONTRACT_VERSION = '1.0.0';

export type CatalogScope = 'platform' | 'tenant' | 'public';
export type CatalogLifecycle =
  | 'draft'
  | 'active'
  | 'toBeDeprecated'
  | 'deprecated';
export type CatalogRole = string;

export interface CatalogCompatibility {
  minVersion: string;
  maxVersion?: string;
}

export interface CatalogFunctionContract {
  key: string;
  label: string;
  scope: CatalogScope;
  status: CatalogLifecycle;
  requiredRole?: CatalogRole;
  permissions?: string[];
  dependencies?: string[];
  compatibility: CatalogCompatibility;
}

export interface CatalogModuleContract {
  key: string;
  label: string;
  section: string;
  page: string;
  scope: CatalogScope;
  status: CatalogLifecycle;
  requiredRole?: CatalogRole;
  dependencies?: string[];
  compatibility: CatalogCompatibility;
  functions: CatalogFunctionContract[];
}

export interface CatalogContract {
  version: string;
  modules: CatalogModuleContract[];
}
