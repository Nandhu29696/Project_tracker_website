import type { Role } from '@tracker/shared';

declare global {
  namespace Express {
    interface AuthUser {
      id: string;
      name: string;
      email: string;
      role: Role;
    }
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
