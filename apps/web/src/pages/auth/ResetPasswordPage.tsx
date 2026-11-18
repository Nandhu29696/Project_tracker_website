import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { passwordSchema } from '@tracker/shared';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/button';
import { Field, PasswordInput } from '@/components/ui/form';
import { Alert } from '@/components/ui/misc';
import { api, getErrorMessage } from '@/lib/api';

const formSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

/** Used for both "forgot password" links and admin invites (?invite=1). */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const isInvite = params.get('invite') === '1';
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async ({ password }) => {
    setError(null);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  });

  const title = isInvite ? 'Set up your account' : 'Choose a new password';

  if (!token) {
    return (
      <AuthLayout title={title}>
        <Alert tone="error">
          This link is missing its token. Please use the link from your email.
        </Alert>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={title}
      subtitle={isInvite ? 'Create a password to activate your account.' : undefined}
    >
      {done ? (
        <>
          <Alert tone="success" title={isInvite ? 'Account activated' : 'Password updated'}>
            You can now sign in with your new password.
          </Alert>
          <Link
            to="/login"
            className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-lg bg-brand-600 text-sm font-medium text-white hover:bg-brand-700"
          >
            Go to sign in
          </Link>
        </>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && <Alert tone="error">{error}</Alert>}
          <Field
            label="New password"
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
            {isInvite ? 'Activate account' : 'Update password'}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
