import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ALLOWED_PARENTS,
  createWorkItemSchema,
  ENVIRONMENT_TYPE_LABELS,
  ENVIRONMENT_TYPES,
  PLANNING_TYPES,
  PRIORITIES,
  PRIORITY_LABELS,
  SEVERITIES,
  SEVERITY_LABELS,
  WORK_ITEM_TYPE_LABELS,
  WORK_ITEM_TYPES,
  type WorkItemDetail,
  type WorkItemType,
} from '@tracker/shared';
import { MarkdownEditor } from '@/components/Markdown';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { Alert, Spinner } from '@/components/ui/misc';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProject, useProjects } from '@/features/projects/api';
import { api, getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useInvalidateWorkItems, useWorkItems } from './api';
import { TypeIcon } from './meta';

type ParentRef = { id: string; key: string; title: string; type: WorkItemType };

interface Props {
  open: boolean;
  onClose: () => void;
  projectId?: string;
  defaultType?: WorkItemType;
  parent?: ParentRef;
  /** Stay on the current page instead of opening the new item. */
  stay?: boolean;
  /** create the item inside this sprint */
  iterationId?: string;
}

export function CreateWorkItemDialog({ open, onClose, ...rest }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title="New work item">
      {open && <CreateForm {...rest} onDone={onClose} />}
    </Dialog>
  );
}

function ParentPicker({
  projectId,
  type,
  value,
  onChange,
}: {
  projectId: string;
  type: WorkItemType;
  value: ParentRef | null;
  onChange: (v: ParentRef | null) => void;
}) {
  const [q, setQ] = useState('');
  const allowed = ALLOWED_PARENTS[type];
  const results = useWorkItems(
    {
      projectId,
      type: allowed.join(','),
      status: 'all',
      q: q || undefined,
      pageSize: '8',
      sort: 'updatedAt',
    },
    allowed.length > 0 && !value,
  );
  if (!allowed.length)
    return (
      <p className="text-xs text-slate-500">{WORK_ITEM_TYPE_LABELS[type]}s are top-level items.</p>
    );
  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700">
        <span className="truncate">
          <span className="font-mono text-xs text-slate-500">{value.key}</span> {value.title}
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="cursor-pointer text-xs text-brand-600 hover:underline"
        >
          Change
        </button>
      </div>
    );
  }
  return (
    <div>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={`Search ${allowed.map((t) => WORK_ITEM_TYPE_LABELS[t]).join(' / ')} by title or key`}
        aria-label="Search parent"
      />
      <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800">
        {results.isLoading ? (
          <li className="p-3 text-center">
            <Spinner className="h-4 w-4" />
          </li>
        ) : !results.data?.data.length ? (
          <li className="p-3 text-center text-xs text-slate-500">No matching items (optional)</li>
        ) : (
          results.data.data.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                onClick={() => onChange(w)}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <TypeIcon type={w.type} />
                <span className="font-mono text-xs text-slate-500">{w.key}</span>
                <span className="truncate">{w.title}</span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function CreateForm({
  projectId: fixedProjectId,
  defaultType,
  parent: fixedParent,
  stay,
  iterationId,
  onDone,
}: Omit<Props, 'open' | 'onClose'> & { onDone: () => void }) {
  const navigate = useNavigate();
  const invalidate = useInvalidateWorkItems();
  const { user } = useAuth();
  const projects = useProjects({ pageSize: 100, sort: 'name', order: 'asc' });
  const [projectId, setProjectId] = useState(fixedProjectId ?? '');
  const project = useProject(projectId || undefined);
  const access = project.data?.workItemAccess;

  const [type, setType] = useState<WorkItemType>(defaultType ?? 'TASK');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>('MEDIUM');
  const [parent, setParent] = useState<ParentRef | null>(fixedParent ?? null);
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>('S3_MEDIUM');
  const [environment, setEnvironment] = useState('');
  const [reproSteps, setReproSteps] = useState('');
  const [estimate, setEstimate] = useState('');
  const [points, setPoints] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [tags, setTags] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const types = WORK_ITEM_TYPES.filter(
    (t) => access?.canCreatePlanning || !PLANNING_TYPES.includes(t),
  );
  const members = (project.data?.members ?? []).filter(
    (m) => m.role !== 'VIEWER' && m.user.isActive,
  );
  const assignable = access?.canAssignOthers
    ? members
    : members.filter((m) => m.user.id === user?.id);
  const isBug = type === 'BUG';

  const changeType = (t: WorkItemType) => {
    setType(t);
    if (!fixedParent && parent && !ALLOWED_PARENTS[t].includes(parent.type)) setParent(null);
  };

  const submit = async () => {
    const payload = {
      type,
      title,
      description,
      assigneeId,
      priority,
      parentId: parent?.id ?? '',
      dueDate,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      ...(isBug ? { severity, environment: environment || null, reproSteps } : {}),
      ...(iterationId && projectId === fixedProjectId ? { iterationId } : {}),
      ...(type === 'TASK' && estimate ? { originalEstimate: Number(estimate) } : {}),
      ...(type !== 'TASK' && points ? { storyPoints: Number(points) } : {}),
    };
    const parsed = createWorkItemSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const res = await api.post<{ data: WorkItemDetail }>(
        `/projects/${projectId}/work-items`,
        parsed.data,
      );
      toast.success(`${res.data.data.key} created`);
      await invalidate();
      onDone();
      if (!stay) navigate(`/items/${res.data.data.key}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {!fixedProjectId && (
        <Field label="Project">
          {(id) => (
            <Select
              id={id}
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setParent(null);
                setAssigneeId('');
              }}
            >
              <option value="">Select a project…</option>
              {(projects.data?.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.key} · {p.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}

      {projectId && project.isLoading && (
        <div className="flex justify-center p-4">
          <Spinner />
        </div>
      )}
      {project.data && !access?.canCreate && (
        <Alert tone="warning">
          You have read-only access to this project{project.data.archivedAt ? ' (archived)' : ''}.
        </Alert>
      )}

      {project.data && access?.canCreate && (
        <>
          <div role="radiogroup" aria-label="Type" className="flex flex-wrap gap-2">
            {types.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={type === t}
                disabled={!!fixedParent && !ALLOWED_PARENTS[t].includes(fixedParent.type)}
                onClick={() => changeType(t)}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40',
                  type === t
                    ? 'border-brand-500 bg-brand-50 font-medium dark:bg-brand-500/10'
                    : 'border-slate-300 dark:border-slate-700',
                )}
              >
                <TypeIcon type={t} /> {WORK_ITEM_TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          <Field label="Title" error={errors.title}>
            {(id, d) => (
              <Input
                id={id}
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                aria-invalid={!!errors.title}
                aria-describedby={d}
                placeholder={isBug ? 'What is broken?' : 'What needs to be done?'}
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Assigned to"
              hint={access.canAssignOthers ? undefined : 'You can assign items to yourself'}
            >
              {(id) => (
                <Select id={id} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                  <option value="">Unassigned</option>
                  {assignable.map((m) => (
                    <option key={m.user.id} value={m.user.id}>
                      {m.user.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Priority">
              {(id) => (
                <Select
                  id={id}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as typeof priority)}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABELS[p]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {isBug && (
              <>
                <Field label="Severity">
                  {(id) => (
                    <Select
                      id={id}
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value as typeof severity)}
                    >
                      {SEVERITIES.map((s) => (
                        <option key={s} value={s}>
                          {SEVERITY_LABELS[s]}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Found in">
                  {(id) => (
                    <Select
                      id={id}
                      value={environment}
                      onChange={(e) => setEnvironment(e.target.value)}
                    >
                      <option value="">Not specified</option>
                      {ENVIRONMENT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {ENVIRONMENT_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </>
            )}
            {type === 'TASK' ? (
              <Field label="Original estimate (hours)" error={errors.originalEstimate}>
                {(id) => (
                  <Input
                    id={id}
                    type="number"
                    min={0}
                    step={0.5}
                    value={estimate}
                    onChange={(e) => setEstimate(e.target.value)}
                  />
                )}
              </Field>
            ) : (
              <Field label="Story points" error={errors.storyPoints}>
                {(id) => (
                  <Input
                    id={id}
                    type="number"
                    min={0}
                    step={1}
                    value={points}
                    onChange={(e) => setPoints(e.target.value)}
                  />
                )}
              </Field>
            )}
            <Field label="Due date" error={errors.dueDate}>
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              )}
            </Field>
          </div>

          <Field label="Parent">
            {() => (
              <ParentPicker projectId={projectId} type={type} value={parent} onChange={setParent} />
            )}
          </Field>

          {isBug && (
            <Field label="Repro steps">
              {(id) => (
                <Textarea
                  id={id}
                  rows={3}
                  value={reproSteps}
                  onChange={(e) => setReproSteps(e.target.value)}
                  placeholder={'1. Go to…\n2. Click…\n3. See error'}
                />
              )}
            </Field>
          )}

          <Field label="Description">
            {(id) => (
              <MarkdownEditor
                id={id}
                rows={4}
                value={description}
                onChange={setDescription}
                placeholder="Details, acceptance criteria…"
              />
            )}
          </Field>

          <Field label="Tags" error={errors.tags} hint="Comma separated, e.g. frontend, login">
            {(id) => <Input id={id} value={tags} onChange={(e) => setTags(e.target.value)} />}
          </Field>
        </>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={submit} loading={saving} disabled={!project.data || !access?.canCreate}>
          Create {WORK_ITEM_TYPE_LABELS[type].toLowerCase()}
        </Button>
      </div>
    </div>
  );
}
