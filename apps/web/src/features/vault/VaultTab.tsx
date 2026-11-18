import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Copy,
  Eye,
  EyeOff,
  History,
  KeyRound,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  createCredentialSchema,
  ENVIRONMENT_TYPE_LABELS,
  ENVIRONMENT_TYPES,
  updateCredentialSchema,
  type CredentialAccessEntry,
  type CredentialDto,
  type ProjectDetail,
} from '@tracker/shared';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, PasswordInput, Select, Textarea } from '@/components/ui/form';
import { Alert, Badge, Card, CardHeader, Spinner } from '@/components/ui/misc';
import { Can } from '@/features/auth/guards';
import { useCredentials } from '@/features/planning/api';
import { api, getErrorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

const REVEAL_MS = 30_000;

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  } catch {
    toast.error('Clipboard is not available');
  }
}

function CredentialForm({
  projectId,
  credential,
  onDone,
}: {
  projectId: string;
  credential?: CredentialDto;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [label, setLabel] = useState(credential?.label ?? '');
  const [username, setUsername] = useState(credential?.username ?? '');
  const [secret, setSecret] = useState('');
  const [url, setUrl] = useState(credential?.url ?? '');
  const [environment, setEnvironment] = useState<string>(credential?.environment ?? '');
  const [notes, setNotes] = useState(credential?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const body = {
      label,
      username,
      url,
      environment: environment || null,
      notes,
      ...(secret || !credential ? { secret } : {}),
    };
    const parsed = credential
      ? updateCredentialSchema.safeParse(body)
      : createCredentialSchema.safeParse(body);
    if (!parsed.success)
      return setErrors(
        Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])),
      );
    setSaving(true);
    try {
      if (credential) await api.patch(`/credentials/${credential.id}`, parsed.data);
      else await api.post(`/projects/${projectId}/credentials`, parsed.data);
      toast.success(
        credential ? (secret ? 'Secret rotated' : 'Credential updated') : 'Credential saved',
      );
      await qc.invalidateQueries({ queryKey: ['credentials', projectId] });
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Field label="Label" error={errors.label}>
        {(id) => (
          <Input
            id={id}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Production admin login"
            autoFocus
            maxLength={100}
          />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Username / email" error={errors.username}>
          {(id) => (
            <Input
              id={id}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
            />
          )}
        </Field>
        <Field label="Environment">
          {(id) => (
            <Select id={id} value={environment} onChange={(e) => setEnvironment(e.target.value)}>
              <option value="">Not specified</option>
              {ENVIRONMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ENVIRONMENT_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field
        label={credential ? 'New secret' : 'Password / API key'}
        error={errors.secret}
        hint={
          credential
            ? 'Leave empty to keep the current secret. Entering a value rotates it.'
            : 'Stored encrypted (AES-256-GCM). Only Admins and project managers can reveal it.'
        }
      >
        {(id) => (
          <PasswordInput
            id={id}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            autoComplete="new-password"
          />
        )}
      </Field>
      <Field label="URL" error={errors.url}>
        {(id) => (
          <Input
            id={id}
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://admin.example.com"
          />
        )}
      </Field>
      <Field label="Notes">
        {(id) => (
          <Textarea id={id} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        )}
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button loading={saving} onClick={save}>
          {credential ? 'Save' : 'Save credential'}
        </Button>
      </div>
    </div>
  );
}

function AccessLog({ id }: { id: string }) {
  const [rows, setRows] = useState<CredentialAccessEntry[] | null>(null);
  useEffect(() => {
    let alive = true;
    api
      .get<{ data: CredentialAccessEntry[] }>(`/credentials/${id}/access-log`)
      .then((r) => alive && setRows(r.data.data))
      .catch((err) => toast.error(getErrorMessage(err)));
    return () => {
      alive = false;
    };
  }, [id]);
  if (!rows)
    return (
      <div className="flex justify-center p-6">
        <Spinner />
      </div>
    );
  const label: Record<string, string> = {
    'vault.created': 'created',
    'vault.updated': 'edited details',
    'vault.rotated': 'rotated the secret',
    'vault.revealed': 'revealed the secret',
    'vault.deleted': 'deleted',
  };
  return (
    <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
      {rows.map((r, i) => (
        <li
          key={i}
          className="flex justify-between gap-3 border-b border-slate-100 pb-2 dark:border-slate-800"
        >
          <span>
            <span className="font-medium">{r.actor?.name ?? 'Unknown'}</span>{' '}
            {label[r.action] ?? r.action}
          </span>
          <span className="shrink-0 text-xs text-slate-500" title={r.ip ?? undefined}>
            {formatDateTime(r.createdAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function SecretCell({ credential }: { credential: CredentialDto }) {
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const reveal = async () => {
    if (secret) {
      clearTimeout(timer.current);
      return setSecret(null);
    }
    setBusy(true);
    try {
      const res = await api.post<{ data: { secret: string } }>(
        `/credentials/${credential.id}/reveal`,
      );
      setSecret(res.data.data.secret);
      timer.current = setTimeout(() => setSecret(null), REVEAL_MS); // hide again automatically
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="flex items-center gap-1">
      <code
        className="max-w-48 truncate rounded bg-slate-100 px-2 py-0.5 font-mono text-xs dark:bg-slate-800"
        aria-live="polite"
      >
        {secret ?? '••••••••••'}
      </code>
      <Button
        size="icon"
        variant="ghost"
        loading={busy}
        onClick={reveal}
        aria-label={secret ? 'Hide secret' : `Reveal secret for ${credential.label}`}
        title={secret ? 'Hide' : 'Reveal (logged)'}
      >
        {!busy && (secret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />)}
      </Button>
      {secret && (
        <Button
          size="icon"
          variant="ghost"
          onClick={() => copy(secret, 'Secret')}
          aria-label="Copy secret"
        >
          <Copy className="h-4 w-4" />
        </Button>
      )}
    </span>
  );
}

export function VaultTab({ project }: { project: ProjectDetail }) {
  const qc = useQueryClient();
  const { data, isLoading, error } = useCredentials(project.id);
  const [editing, setEditing] = useState<CredentialDto | undefined>();
  const [formOpen, setFormOpen] = useState(false);
  const [logFor, setLogFor] = useState<CredentialDto | null>(null);
  const canWrite = !project.archivedAt;

  return (
    <div className="space-y-4">
      <Alert tone="info" title="Credentials vault">
        Secrets are encrypted at rest and only visible to Admins and this project's managers. Every
        reveal is recorded in the access log, and revealed values hide again after 30 seconds.
      </Alert>
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> Credentials
            </span>
          }
          description={data ? `${data.length} stored` : undefined}
          action={
            <div className="flex gap-2">
              <Can permission="data:import">
                <Link
                  to="/vault/import"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <Upload className="h-4 w-4" /> Import
                </Link>
              </Can>
              {canWrite && (
                <Button
                  size="sm"
                  onClick={() => {
                    setEditing(undefined);
                    setFormOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" /> Add
                </Button>
              )}
            </div>
          }
        />
        {isLoading ? (
          <div className="flex justify-center p-10">
            <Spinner />
          </div>
        ) : error ? (
          <p className="p-6 text-sm text-red-600">{getErrorMessage(error)}</p>
        ) : !data?.length ? (
          <div className="flex flex-col items-center p-10 text-center">
            <KeyRound className="h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">No credentials stored for {project.key}.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-2">Label</th>
                  <th className="px-4 py-2">Username</th>
                  <th className="px-4 py-2">Secret</th>
                  <th className="px-4 py-2">Rotated</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {data.map((c) => (
                  <tr key={c.id} className="align-middle">
                    <td className="px-4 py-2">
                      <p className="font-medium">{c.label}</p>
                      <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        {c.environment && <Badge>{c.environment}</Badge>}
                        {c.url && (
                          <a
                            href={c.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate text-brand-600 hover:underline"
                          >
                            {c.url}
                          </a>
                        )}
                      </p>
                    </td>
                    <td className="px-4 py-2">
                      {c.username ? (
                        <span className="flex items-center gap-1">
                          <span className="max-w-48 truncate">{c.username}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => copy(c.username!, 'Username')}
                            aria-label="Copy username"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <SecretCell credential={c} />
                    </td>
                    <td className="px-4 py-2 text-xs whitespace-nowrap text-slate-500">
                      {formatDateTime(c.lastRotatedAt)}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setLogFor(c)}
                          aria-label={`Access log for ${c.label}`}
                          title="Access log"
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        {canWrite && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditing(c);
                              setFormOpen(true);
                            }}
                            aria-label={`Edit ${c.label}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canWrite && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-red-600"
                            aria-label={`Delete ${c.label}`}
                            onClick={async () => {
                              if (!confirm(`Delete "${c.label}"? This cannot be undone.`)) return;
                              try {
                                await api.delete(`/credentials/${c.id}`);
                                await qc.invalidateQueries({
                                  queryKey: ['credentials', project.id],
                                });
                                toast.success('Credential deleted');
                              } catch (err) {
                                toast.error(getErrorMessage(err));
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.label}` : 'Add credential'}
      >
        {formOpen && (
          <CredentialForm
            projectId={project.id}
            credential={editing}
            onDone={() => setFormOpen(false)}
          />
        )}
      </Dialog>
      <Dialog
        open={!!logFor}
        onClose={() => setLogFor(null)}
        title={`Access log · ${logFor?.label ?? ''}`}
        description="Who created, changed or revealed this credential."
      >
        {logFor && <AccessLog id={logFor.id} />}
      </Dialog>
    </div>
  );
}
