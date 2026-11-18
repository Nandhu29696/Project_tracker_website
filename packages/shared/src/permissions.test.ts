import { describe, expect, it } from 'vitest';
import { PERMISSIONS, hasPermission } from './permissions';

describe('RBAC permissions', () => {
  it('admin has every permission', () => {
    for (const p of PERMISSIONS) expect(hasPermission('ADMIN', p)).toBe(true);
  });

  it('manager can manage projects but not users or settings', () => {
    expect(hasPermission('MANAGER', 'project:create')).toBe(true);
    expect(hasPermission('MANAGER', 'workitem:assign')).toBe(true);
    expect(hasPermission('MANAGER', 'user:create')).toBe(false);
    expect(hasPermission('MANAGER', 'settings:manage')).toBe(false);
  });

  it('employee can work on items but not create projects, epics or assign', () => {
    expect(hasPermission('EMPLOYEE', 'workitem:create')).toBe(true);
    expect(hasPermission('EMPLOYEE', 'project:create')).toBe(false);
    expect(hasPermission('EMPLOYEE', 'workitem:create-epic')).toBe(false);
    expect(hasPermission('EMPLOYEE', 'workitem:assign')).toBe(false);
    expect(hasPermission('EMPLOYEE', 'user:read')).toBe(false);
  });

  it('no role means no permission', () => {
    expect(hasPermission(null, 'project:read')).toBe(false);
  });
});
