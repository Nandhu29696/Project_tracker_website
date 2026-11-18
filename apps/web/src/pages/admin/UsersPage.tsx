import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronLeft, ChevronRight, MailPlus, Search, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import {
  createUserSchema,
  ROLE_LABELS,
  ROLES,
  type Paginated,
  type PublicUser,
  type Role,
  type UpdateUserInput,
} from '@tracker/shared';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/form';
import { Avatar, Badge, Card, Spinner } from '@/components/ui/misc';
import { useAuth } from '@/features/auth/AuthProvider';
import { Can } from '@/features/auth/guards';
import { api, getErrorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

const PAGE_SIZE = 20;
const roleTone: Record<Role, 'red' | 'purple' | 'slate'> = {
  ADMIN: 'red',
  MANAGER: 'purple',
  EMPLOYEE: 'slate',
};

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function StatusBadge({ user }: { user: PublicUser }) {
  if (!user.isActive) return <Badge tone="red">Inactive</Badge>;
  if (!user.hasPassword && !user.googleLinked) return <Badge tone="amber">Invited</Badge>;
  if (!user.emailVerified) return <Badge tone="amber">Unverified</Badge>;
  return <Badge tone="green">Active</Badge>;
}

function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(createUserSchema),
    defaultValues: { name: '', email: '', role: 'EMPLOYEE' as Role },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await api.post('/users', values);
      toast.success(`Invite sent to ${values.email}`);
      await qc.invalidateQueries({ queryKey: ['users'] });
      reset();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Invite user"
      description="They'll receive an email with a link to set their password."
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Full name" error={errors.name?.message}>
          {(id, d) => (
            <Input
              id={id}
              aria-invalid={!!errors.name}
              aria-describedby={d}
              {...register('name')}
            />
          )}
        </Field>
        <Field label="Email" error={errors.email?.message}>
          {(id, d) => (
            <Input
              id={id}
              type="email"
              aria-invalid={!!errors.email}
              aria-describedby={d}
              {...register('email')}
            />
          )}
        </Field>
        <Field label="Role" error={errors.role?.message}>
          {(id) => (
            <Select id={id} {...register('role')}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            <MailPlus className="h-4 w-4" /> Send invite
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function UserActions({ user, compact }: { user: PublicUser; compact?: boolean }) {
  const { user: me, can } = useAuth();
  const qc = useQueryClient();
  const isMe = me?.id === user.id;

  const update = useMutation({
    mutationFn: (input: UpdateUserInput) => api.patch(`/users/${user.id}`, input),
    onSuccess: () => {
      toast.success('User updated');
      return qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const resend = useMutation({
    mutationFn: () => api.post(`/users/${user.id}/resend-invite`),
    onSuccess: () => toast.success('Invite sent again'),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (!can('user:update'))
    return <Badge tone={roleTone[user.role]}>{ROLE_LABELS[user.role]}</Badge>;

  return (
    <div
      className={
        compact ? 'flex flex-wrap items-center gap-2' : 'flex items-center justify-end gap-2'
      }
    >
      <Select
        aria-label={`Role for ${user.name}`}
        value={user.role}
        disabled={isMe || update.isPending}
        onChange={(e) => update.mutate({ role: e.target.value as Role })}
        className="h-8 w-32 text-xs"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </Select>
      {!user.hasPassword && !user.googleLinked && user.isActive && (
        <Can permission="user:create">
          <Button
            size="sm"
            variant="ghost"
            loading={resend.isPending}
            onClick={() => resend.mutate()}
          >
            Resend
          </Button>
        </Can>
      )}
      <Button
        size="sm"
        variant={user.isActive ? 'outline' : 'secondary'}
        disabled={isMe}
        loading={update.isPending}
        onClick={() => {
          if (
            user.isActive &&
            !confirm(`Deactivate ${user.name}? They will be signed out immediately.`)
          )
            return;
          update.mutate({ isActive: !user.isActive });
        }}
        className={user.isActive ? 'text-red-600 dark:text-red-400' : ''}
      >
        {user.isActive ? 'Deactivate' : 'Activate'}
      </Button>
    </div>
  );
}

export function UsersPage() {
  const [q, setQ] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [status, setStatus] = useState<'' | 'active' | 'inactive'>('');
  const [page, setPage] = useState(1);
  const [inviteOpen, setInviteOpen] = useState(false);
  const search = useDebounced(q);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['users', { search, role, status, page }],
    queryFn: async () =>
      (
        await api.get<Paginated<PublicUser>>('/users', {
          params: {
            q: search || undefined,
            role: role || undefined,
            status: status || undefined,
            page,
            pageSize: PAGE_SIZE,
          },
        })
      ).data,
    placeholderData: keepPreviousData,
  });

  const total = data?.meta.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage accounts, roles and access.
          </p>
        </div>
        <Can permission="user:create">
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4" /> Invite user
          </Button>
        </Can>
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row dark:border-slate-800">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name or email"
              className="pl-9"
              aria-label="Search users"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <Select
              value={role}
              onChange={(e) => {
                setRole(e.target.value as Role | '');
                setPage(1);
              }}
              aria-label="Filter by role"
              className="sm:w-40"
            >
              <option value="">All roles</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as typeof status);
                setPage(1);
              }}
              aria-label="Filter by status"
              className="sm:w-36"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12">
            <Spinner />
          </div>
        ) : error ? (
          <p className="p-6 text-sm text-red-600">{getErrorMessage(error)}</p>
        ) : !data?.data.length ? (
          <p className="p-12 text-center text-sm text-slate-500">No users match your filters.</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase dark:bg-slate-800/50 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Sign-in</th>
                    <th className="px-4 py-3">Last login</th>
                    <th className="px-4 py-3 text-right">Role & actions</th>
                  </tr>
                </thead>
                <tbody
                  className={`divide-y divide-slate-200 dark:divide-slate-800 ${isFetching ? 'opacity-60' : ''}`}
                >
                  {data.data.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} src={u.avatarUrl} />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{u.name}</p>
                            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                              {u.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge user={u} />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                        {[u.hasPassword && 'Password', u.googleLinked && 'Google']
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                        {formatDateTime(u.lastLoginAt)}
                      </td>
                      <td className="px-4 py-3">
                        <UserActions user={u} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-slate-200 md:hidden dark:divide-slate-800">
              {data.data.map((u) => (
                <li key={u.id} className="space-y-3 p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={u.name} src={u.avatarUrl} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{u.name}</p>
                      <p className="truncate text-xs text-slate-500">{u.email}</p>
                    </div>
                    <StatusBadge user={u} />
                  </div>
                  <UserActions user={u} compact />
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
          <span className="text-slate-500 dark:text-slate-400">
            {total} user{total === 1 ? '' : 's'}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-slate-600 dark:text-slate-300">
              {page} / {pages}
            </span>
            <Button
              size="icon"
              variant="outline"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
