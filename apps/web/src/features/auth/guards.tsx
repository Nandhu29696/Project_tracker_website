import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Permission } from '@tracker/shared';
import { FullPageSpinner } from '@/components/ui/misc';
import { ForbiddenPage } from '@/pages/ErrorPages';
import { useAuth } from './AuthProvider';

/** Only signed-in users. */
export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'guest') return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

/** Only signed-out users (login, register ...). */
export function GuestRoute() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'authenticated') {
    const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;
    return <Navigate to={from ?? '/'} replace />;
  }
  return <Outlet />;
}

/** Route-level permission check. The API enforces the same rule. */
export function RequirePermission({ permission }: { permission: Permission }) {
  const { can } = useAuth();
  return can(permission) ? <Outlet /> : <ForbiddenPage />;
}

/** Hide UI the user is not allowed to use. */
export function Can({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { can } = useAuth();
  return <>{can(permission) ? children : fallback}</>;
}
