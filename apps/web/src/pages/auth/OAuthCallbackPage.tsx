import { Navigate } from 'react-router-dom';
import { FullPageSpinner } from '@/components/ui/misc';
import { useAuth } from '@/features/auth/AuthProvider';

/**
 * Google redirects back to the API, which sets the refresh cookie and sends the
 * browser here. AuthProvider then restores the session via /auth/refresh.
 */
export function OAuthCallbackPage() {
  const { status } = useAuth();
  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'authenticated') return <Navigate to="/" replace />;
  return <Navigate to="/login?error=google_failed" replace />;
}
