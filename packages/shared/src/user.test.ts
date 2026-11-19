import { describe, expect, it } from 'vitest';
import { updateUserSchema } from './schemas/user';

describe('updateUserSchema', () => {
  it('accepts and normalizes a changed email', () => {
    expect(
      updateUserSchema.parse({
        name: 'Project Admin',
        email: '  ADMIN@EXAMPLE.COM ',
        role: 'MANAGER',
      }),
    ).toEqual({
      name: 'Project Admin',
      email: 'admin@example.com',
      role: 'MANAGER',
    });
  });

  it('rejects invalid email addresses and empty updates', () => {
    expect(updateUserSchema.safeParse({ email: 'invalid' }).success).toBe(false);
    expect(updateUserSchema.safeParse({}).success).toBe(false);
  });
});
