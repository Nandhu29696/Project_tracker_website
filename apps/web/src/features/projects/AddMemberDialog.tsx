import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Search } from 'lucide-react';
import { toast } from 'sonner';
import {
  PROJECT_ROLE_LABELS,
  PROJECT_ROLES,
  ROLE_LABELS,
  type Paginated,
  type ProjectRole,
  type PublicUser,
} from '@tracker/shared';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/form';
import { Avatar, Badge, Spinner } from '@/components/ui/misc';
import { api, getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { projectKeys } from './api';

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  memberIds: string[];
}

export function AddMemberDialog({ open, onClose, ...rest }: Props) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add member"
      description="Members can see the project and work on its items."
    >
      {open && <AddMemberForm {...rest} onDone={onClose} />}
    </Dialog>
  );
}

function AddMemberForm({
  projectId,
  memberIds,
  onDone,
}: Omit<Props, 'open' | 'onClose'> & { onDone: () => void }) {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<PublicUser | null>(null);
  const [role, setRole] = useState<ProjectRole>('MEMBER');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearch(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const users = useQuery({
    queryKey: ['users', 'picker', search],
    queryFn: async () =>
      (
        await api.get<Paginated<PublicUser>>('/users', {
          params: { q: search || undefined, status: 'active', pageSize: 8 },
        })
      ).data,
  });
  const candidates = (users.data?.data ?? []).filter((u) => !memberIds.includes(u.id));
  const managerNotAllowed = role === 'MANAGER' && selected?.role === 'EMPLOYEE';

  const submit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.post(`/projects/${projectId}/members`, { userId: selected.id, role });
      toast.success(`${selected.name} added`);
      await qc.invalidateQueries({ queryKey: projectKeys.all });
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search people by name or email"
          className="pl-9"
          aria-label="Search people"
        />
      </div>
      <ul
        className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800"
        role="listbox"
        aria-label="People"
      >
        {users.isLoading ? (
          <li className="flex justify-center p-6">
            <Spinner />
          </li>
        ) : !candidates.length ? (
          <li className="p-6 text-center text-sm text-slate-500">
            No matching people who aren't already members.
          </li>
        ) : (
          candidates.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                role="option"
                aria-selected={selected?.id === u.id}
                onClick={() => setSelected(u)}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50',
                  selected?.id === u.id && 'bg-brand-50 dark:bg-brand-500/10',
                )}
              >
                <Avatar name={u.name} src={u.avatarUrl} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{u.name}</span>
                  <span className="block truncate text-xs text-slate-500">{u.email}</span>
                </span>
                <Badge>{ROLE_LABELS[u.role]}</Badge>
                {selected?.id === u.id && <Check className="h-4 w-4 text-brand-600" />}
              </button>
            </li>
          ))
        )}
      </ul>
      <Field
        label="Project role"
        error={managerNotAllowed ? 'Only Admins and Managers can be project managers.' : undefined}
      >
        {(id) => (
          <Select id={id} value={role} onChange={(e) => setRole(e.target.value as ProjectRole)}>
            {PROJECT_ROLES.map((r) => (
              <option key={r} value={r}>
                {PROJECT_ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!selected || managerNotAllowed} loading={saving}>
          Add {selected ? selected.name.split(' ')[0] : 'member'}
        </Button>
      </div>
    </div>
  );
}
