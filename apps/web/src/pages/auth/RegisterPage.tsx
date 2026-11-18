import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { registerSchema, type AuthResponse } from '@tracker/shared';
import { GoogleButton, OrDivider, useAuthProviders } from '@/components/GoogleButton';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/button';
import { Field, Input, PasswordInput } from '@/components/ui/form';
import { Alert, FullPageSpinner } from '@/components/ui/misc';
import { useAuth } from '@/features/auth/AuthProvider';
import { api, getErrorMessage } from '@/lib/api';

const formSchema = registerSchema
  .extend({ confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

type RegisterResponse =
  { data: AuthResponse } | { data: { verificationRequired: true; email: string } };

export function RegisterPage() {
  const providers = useAuthProviders();
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  if (providers.isLoading) return <FullPageSpinner />;
  if (providers.data && !providers.data.selfRegistration) return <Navigate to="/login" replace />;

  const onSubmit = handleSubmit(async ({ name, email, password }) => {
    setError(null);
    try {
      const res = await api.post<RegisterResponse>('/auth/register', { name, email, password });
      const body = res.data.data;
      if ('accessToken' in body) {
        setSession(body);
        toast.success('Account created');
        navigate('/', { replace: true });
      } else {
        setSentTo(body.email);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  });

  if (sentTo) {
    return (
      <AuthLayout title="Check your email">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/10">
            <MailCheck className="h-7 w-7" />
          </span>
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
            We sent a verification link to <strong>{sentTo}</strong>. Click the link to activate
            your account. It expires in 24 hours.
          </p>
          <Button
            variant="outline"
            className="mt-6 w-full"
            loading={resending}
            onClick={async () => {
              setResending(true);
              try {
                await api.post('/auth/resend-verification', { email: sentTo });
                toast.success('Verification email sent again');
              } catch (err) {
                toast.error(getErrorMessage(err));
              } finally {
                setResending(false);
              }
            }}
          >
            Resend email
          </Button>
          <Link
            to="/login"
            className="mt-4 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-500"
          >
            Back to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create your account" subtitle="New accounts start with the Employee role.">
      {error && (
        <Alert tone="error" className="mb-5">
          {error}
        </Alert>
      )}

      {providers.data?.google && (
        <>
          <GoogleButton label="Sign up with Google" />
          <OrDivider />
        </>
      )}

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Full name" error={errors.name?.message}>
          {(id, d) => (
            <Input
              id={id}
              autoComplete="name"
              aria-invalid={!!errors.name}
              aria-describedby={d}
              {...register('name')}
            />
          )}
        </Field>
        <Field label="Work email" error={errors.email?.message}>
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
          hint="At least 8 characters with a letter and a number."
        >
          {(id, d) => (
            <PasswordInput
              id={id}
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              aria-describedby={d}
              {...register('password')}
            />
          )}
        </Field>
        <Field label="Confirm password" error={errors.confirmPassword?.message}>
          {(id, d) => (
            <PasswordInput
              id={id}
              autoComplete="new-password"
              aria-invalid={!!errors.confirmPassword}
              aria-describedby={d}
              {...register('confirmPassword')}
            />
          )}
        </Field>
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Create account
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
        Already have an account?{' '}
        <Link
          to="/login"
          className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-500"
        >
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
