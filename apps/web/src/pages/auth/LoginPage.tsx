import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { loginSchema } from '@tracker/shared';
import { GoogleButton, OrDivider, useAuthProviders } from '@/components/GoogleButton';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/button';
import { Field, Input, PasswordInput } from '@/components/ui/form';
import { Alert } from '@/components/ui/misc';
import { useAuth } from '@/features/auth/AuthProvider';
import { api, apiErrorCode, getErrorMessage } from '@/lib/api';

const OAUTH_ERRORS: Record<string, string> = {
  google_cancelled: 'Google sign-in was cancelled.',
  google_state: 'Google sign-in expired or was tampered with. Please try again.',
  google_failed: 'Google sign-in failed. Please try again.',
  google_email_unverified: 'Your Google email address is not verified.',
  google_domain: 'Your Google account domain is not allowed for this workspace.',
  registration_disabled:
    'No account exists for this Google email. Ask an administrator for an invite.',
  account_inactive: 'Your account has been deactivated. Contact your administrator.',
};

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const providers = useAuthProviders();
  const [error, setError] = useState<string | null>(() => {
    const code = params.get('error');
    return code ? (OAUTH_ERRORS[code] ?? 'Sign-in failed.') : null;
  });
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setUnverifiedEmail(null);
    try {
      const user = await login(values);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
      navigate('/', { replace: true });
    } catch (err) {
      if (apiErrorCode(err) === 'EMAIL_NOT_VERIFIED') setUnverifiedEmail(values.email);
      setError(getErrorMessage(err));
    }
  });

  const resend = async () => {
    if (!unverifiedEmail) return;
    setResending(true);
    try {
      await api.post('/auth/resend-verification', { email: unverifiedEmail });
      toast.success('Verification email sent. Check your inbox.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout title="Sign in to your account" subtitle="Welcome back! Please enter your details.">
      {error && (
        <Alert tone="error" className="mb-5">
          {error}
          {unverifiedEmail && (
            <button
              type="button"
              onClick={resend}
              disabled={resending}
              className="mt-1 block cursor-pointer font-medium underline"
            >
              {resending ? 'Sending…' : 'Resend verification email'}
            </button>
          )}
        </Alert>
      )}

      {providers.data?.google && (
        <>
          <GoogleButton />
          <OrDivider />
        </>
      )}

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Email" error={errors.email?.message}>
          {(id, d) => (
            <Input
              id={id}
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              aria-invalid={!!errors.email}
              aria-describedby={d}
              {...register('email')}
            />
          )}
        </Field>
        <Field
          label="Password"
          error={errors.password?.message}
          action={
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-500"
            >
              Forgot password?
            </Link>
          }
        >
          {(id, d) => (
            <PasswordInput
              id={id}
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              aria-describedby={d}
              {...register('password')}
            />
          )}
        </Field>
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Sign in
        </Button>
      </form>

      {providers.data?.selfRegistration !== false && (
        <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
          Don&apos;t have an account?{' '}
          <Link
            to="/register"
            className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-500"
          >
            Create one
          </Link>
        </p>
      )}
    </AuthLayout>
  );
}
