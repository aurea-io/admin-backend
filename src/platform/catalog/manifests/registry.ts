import type { CatalogContract, CatalogModuleContract } from '../contracts/catalog-contract.js';
import { validateCatalogContract } from '../contracts/catalog-contract.validator.js';

/** Defines a domain manifest and validates it eagerly at registration time. */
export function defineCatalogManifest(
  manifest: CatalogModuleContract,
): CatalogModuleContract {
  validateCatalogContract({ version: '1.0.0', modules: [manifest] });
  return manifest;
}

/** Combines domain manifests into the single snapshot consumed by sync jobs. */
export function buildCatalogContract(
  manifests: readonly CatalogModuleContract[],
  version = '1.0.0',
): CatalogContract {
  return validateCatalogContract({ version, modules: [...manifests] });
}
