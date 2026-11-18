import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Alert, Spinner } from '@/components/ui/misc';
import { api, getErrorMessage } from '@/lib/api';

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [result, setState] = useState<{ status: 'pending' | 'ok' | 'error'; message?: string }>({
    status: 'pending',
  });
  const state = token
    ? result
    : { status: 'error' as const, message: 'This link is missing its token.' };
  const sent = useRef(false); // token is single-use: guard against StrictMode double effects

  useEffect(() => {
    if (sent.current || !token) return;
    sent.current = true;
    api
      .post<{ message: string }>('/auth/verify-email', { token })
      .then((res) => setState({ status: 'ok', message: res.data.message }))
      .catch((err) => setState({ status: 'error', message: getErrorMessage(err) }));
  }, [token]);

  return (
    <AuthLayout title="Email verification">
      {state.status === 'pending' && (
        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          <Spinner /> Verifying your email…
        </div>
      )}
      {state.status === 'ok' && (
        <Alert tone="success" title="Email verified">
          {state.message}
        </Alert>
      )}
      {state.status === 'error' && (
        <Alert tone="error" title="Verification failed">
          {state.message} You can request a new link from the sign-in page.
        </Alert>
      )}
      {state.status !== 'pending' && (
        <Link
          to="/login"
          className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-lg bg-brand-600 text-sm font-medium text-white hover:bg-brand-700"
        >
          Go to sign in
        </Link>
      )}
    </AuthLayout>
  );
}
