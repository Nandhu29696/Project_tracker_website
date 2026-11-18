import type { Role } from './roles';

/**
 * Every protected capability in the system. The API enforces these with
 * `authorize(...)`; the web app uses them to hide UI (`<Can>`).
 * Project-scoped checks (is the user a member / manager of this project?) are
 * applied on top of these inside the services (Phase 2+).
 */
export const PERMISSIONS = [
  // users & admin
  'user:read',
  'user:create',
  'user:update',
  'audit:read',
  'settings:manage',
  // projects
  'project:read',
  'project:create',
  'project:update',
  'project:delete',
  'project:members',
  // planning
  'iteration:manage',
  // work items
  'workitem:read',
  'workitem:create',
  'workitem:create-epic',
  'workitem:update',
  'workitem:assign',
  'workitem:delete',
  'comment:create',
  // vault & data
  'vault:read',
  'vault:reveal',
  'data:import',
  'data:export',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const EMPLOYEE_PERMISSIONS: Permission[] = [
  'project:read',
  'workitem:read',
  'workitem:create',
  'workitem:update',
  'comment:create',
];

const MANAGER_PERMISSIONS: Permission[] = [
  ...EMPLOYEE_PERMISSIONS,
  'user:read',
  'audit:read',
  'project:create',
  'project:update',
  'project:members',
  'iteration:manage',
  'workitem:create-epic',
  'workitem:assign',
  'workitem:delete',
  'vault:read',
  'vault:reveal',
  'data:export',
];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: PERMISSIONS,
  MANAGER: MANAGER_PERMISSIONS,
  EMPLOYEE: EMPLOYEE_PERMISSIONS,
};

export function hasPermission(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function hasAnyPermission(
  role: Role | undefined | null,
  permissions: Permission[],
): boolean {
  return permissions.some((p) => hasPermission(role, p));
}
