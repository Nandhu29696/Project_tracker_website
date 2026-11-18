import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';
import { passwordSchema, ROLE_LABELS, updateProfileSchema, type PublicUser } from '@tracker/shared';
import { Button } from '@/components/ui/button';
import { Field, Input, PasswordInput } from '@/components/ui/form';
import { Avatar, Badge, Card, CardHeader } from '@/components/ui/misc';
import { useAuth } from '@/features/auth/AuthProvider';
import { NotificationSettings } from '@/features/insights/NotificationSettings';
import { api, getErrorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

function ProfileForm({ user }: { user: PublicUser }) {
  const { setUser } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm({ resolver: zodResolver(updateProfileSchema), defaultValues: { name: user.name } });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const res = await api.patch<{ data: PublicUser }>('/auth/me', values);
      setUser(res.data.data);
      reset({ name: res.data.data.name });
      toast.success('Profile updated');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4 p-5" noValidate>
      <Field label="Full name" error={errors.name?.message}>
        {(id, d) => (
          <Input id={id} aria-invalid={!!errors.name} aria-describedby={d} {...register('name')} />
        )}
      </Field>
      <Field label="Email" hint="Contact an administrator to change your email.">
        {(id) => <Input id={id} value={user.email} disabled readOnly />}
      </Field>
      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

const changeSchema = z
  .object({
    currentPassword: z.string().optional(),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

function PasswordForm({ user }: { user: PublicUser }) {
  const { setUser } = useAuth();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(changeSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      await api.post('/auth/change-password', {
        currentPassword: user.hasPassword ? currentPassword : undefined,
        newPassword,
      });
      reset();
      if (!user.hasPassword) setUser({ ...user, hasPassword: true });
      toast.success('Password changed. Other sessions were signed out.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4 p-5" noValidate>
      {user.hasPassword && (
        <Field label="Current password" error={errors.currentPassword?.message}>
          {(id, d) => (
            <PasswordInput
              id={id}
              autoComplete="current-password"
              aria-describedby={d}
              {...register('currentPassword')}
            />
          )}
        </Field>
      )}
      <Field
        label="New password"
        error={errors.newPassword?.message}
        hint="At least 8 characters with a letter and a number."
      >
        {(id, d) => (
          <PasswordInput
            id={id}
            autoComplete="new-password"
            aria-invalid={!!errors.newPassword}
            aria-describedby={d}
            {...register('newPassword')}
          />
        )}
      </Field>
      <Field label="Confirm new password" error={errors.confirmPassword?.message}>
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
      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting}>
          {user.hasPassword ? 'Change password' : 'Set password'}
        </Button>
      </div>
    </form>
  );
}

export function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Profile & security</h1>

      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <Avatar name={user.name} src={user.avatarUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">{user.name}</p>
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone="blue">{ROLE_LABELS[user.role]}</Badge>
            {user.emailVerified ? (
              <Badge tone="green">Email verified</Badge>
            ) : (
              <Badge tone="amber">Email not verified</Badge>
            )}
            {user.googleLinked && <Badge tone="purple">Google linked</Badge>}
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Last sign-in: {formatDateTime(user.lastLoginAt)}
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Personal information" />
          <ProfileForm user={user} />
        </Card>
        <Card>
          <CardHeader
            title={user.hasPassword ? 'Change password' : 'Set a password'}
            description={
              user.hasPassword
                ? 'Changing your password signs out your other sessions.'
                : 'You sign in with Google. Add a password to also sign in with email.'
            }
          />
          <PasswordForm user={user} />
        </Card>
      </div>

      <NotificationSettings />
    </div>
  );
}
