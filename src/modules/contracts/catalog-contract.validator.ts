import type {
  CatalogContract,
  CatalogRole,
  CatalogFunctionContract,
  CatalogModuleContract,
} from './catalog-contract.js';

const KEY_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const SCOPES = new Set(['platform', 'tenant', 'public']);
const LIFECYCLES = new Set(['draft', 'active', 'toBeDeprecated', 'deprecated']);

export function validateCatalogContract(input: unknown): CatalogContract {
  if (!isRecord(input)) throw new Error('Catalog contract must be an object.');
  assertVersion(input.version, 'version');
  if (!Array.isArray(input.modules) || input.modules.length === 0) {
    throw new Error('Catalog contract must contain at least one module.');
  }

  const modules = input.modules.map((module, index) =>
    validateModule(module, `modules[${index}]`),
  );
  const keys = new Set<string>();
  for (const module of modules) {
    assertUniqueKey(keys, module.key);
    for (const fn of module.functions) assertUniqueKey(keys, fn.key);
  }

  const allKeys = new Set(keys);
  for (const module of modules) {
    assertDependencies(module.key, module.dependencies ?? [], allKeys);
    for (const fn of module.functions) {
      assertDependencies(fn.key, fn.dependencies ?? [], allKeys);
    }
  }
  assertAcyclic(modules, allKeys);
  return { version: input.version, modules };
}

function validateModule(input: unknown, path: string): CatalogModuleContract {
  if (!isRecord(input)) throw new Error(`${path} must be an object.`);
  assertKey(input.key, `${path}.key`);
  assertText(input.label, `${path}.label`);
  assertText(input.section, `${path}.section`);
  assertText(input.page, `${path}.page`);
  assertScope(input.scope, `${path}.scope`);
  assertLifecycle(input.status, `${path}.status`);
  assertRole(input.requiredRole, `${path}.requiredRole`);
  const functions = Array.isArray(input.functions)
    ? input.functions.map((fn, index) => validateFunction(fn, `${path}.functions[${index}]`))
    : [];
  if (functions.length === 0) throw new Error(`${path}.functions must not be empty.`);
  return {
    key: input.key,
    label: input.label,
    section: input.section,
    page: input.page,
    scope: input.scope,
    status: input.status,
    requiredRole: input.requiredRole,
    dependencies: assertDependenciesArray(input.dependencies, `${path}.dependencies`),
    compatibility: validateCompatibility(input.compatibility, `${path}.compatibility`),
    functions,
  };
}

function validateFunction(input: unknown, path: string): CatalogFunctionContract {
  if (!isRecord(input)) throw new Error(`${path} must be an object.`);
  assertKey(input.key, `${path}.key`);
  assertText(input.label, `${path}.label`);
  assertScope(input.scope, `${path}.scope`);
  assertLifecycle(input.status, `${path}.status`);
  assertRole(input.requiredRole, `${path}.requiredRole`);
  return {
    key: input.key,
    label: input.label,
    scope: input.scope,
    status: input.status,
    requiredRole: input.requiredRole,
    permissions: assertStringArray(input.permissions, `${path}.permissions`),
    dependencies: assertDependenciesArray(input.dependencies, `${path}.dependencies`),
    compatibility: validateCompatibility(input.compatibility, `${path}.compatibility`),
  };
}

function validateCompatibility(input: unknown, path: string) {
  if (!isRecord(input)) throw new Error(`${path} must be an object.`);
  assertVersion(input.minVersion, `${path}.minVersion`);
  if (input.maxVersion !== undefined) assertVersion(input.maxVersion, `${path}.maxVersion`);
  return { minVersion: input.minVersion, maxVersion: input.maxVersion };
}

function assertAcyclic(modules: CatalogModuleContract[], keys: Set<string>) {
  const graph = new Map<string, string[]>();
  for (const module of modules) {
    graph.set(module.key, module.dependencies ?? []);
    for (const fn of module.functions) graph.set(fn.key, fn.dependencies ?? []);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (key: string) => {
    if (visiting.has(key)) throw new Error(`Catalog dependency cycle detected at '${key}'.`);
    if (visited.has(key)) return;
    visiting.add(key);
    for (const dependency of graph.get(key) ?? []) {
      if (keys.has(dependency)) visit(dependency);
    }
    visiting.delete(key);
    visited.add(key);
  };
  for (const key of graph.keys()) visit(key);
}

function assertDependencies(key: string, dependencies: string[], keys: Set<string>) {
  if (dependencies.includes(key)) throw new Error(`'${key}' cannot depend on itself.`);
  for (const dependency of dependencies) {
    if (!keys.has(dependency)) throw new Error(`Unknown dependency '${dependency}' for '${key}'.`);
  }
}

function assertUniqueKey(keys: Set<string>, key: string) {
  if (keys.has(key)) throw new Error(`Duplicate catalog key '${key}'.`);
  keys.add(key);
}
function assertKey(value: unknown, path: string) {
  if (typeof value !== 'string' || !KEY_PATTERN.test(value)) throw new Error(`${path} must be a stable catalog key.`);
}
function assertText(value: unknown, path: string) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${path} must be a non-empty string.`);
}
function assertVersion(value: unknown, path: string) {
  if (typeof value !== 'string' || !VERSION_PATTERN.test(value)) throw new Error(`${path} must be a semantic version.`);
}
function assertScope(value: unknown, path: string) {
  if (typeof value !== 'string' || !SCOPES.has(value)) throw new Error(`${path} must be platform, tenant, or public.`);
}
function assertLifecycle(value: unknown, path: string) {
  if (typeof value !== 'string' || !LIFECYCLES.has(value)) throw new Error(`${path} has an invalid lifecycle.`);
}
function assertRole(value: unknown, path: string): asserts value is CatalogRole | undefined {
  if (value !== undefined && (typeof value !== 'string' || value.trim() === '')) throw new Error(`${path} must be a non-empty role key.`);
}
function assertStringArray(value: unknown, path: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.trim() === '')) {
    throw new Error(`${path} must contain only non-empty strings.`);
  }
  return value;
}
function assertDependenciesArray(value: unknown, path: string): string[] | undefined {
  const dependencies = assertStringArray(value, path);
  if (dependencies?.some((dependency) => !KEY_PATTERN.test(dependency))) {
    throw new Error(`${path} must contain stable catalog keys.`);
  }
  return dependencies;
}
function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export { KEY_PATTERN };
