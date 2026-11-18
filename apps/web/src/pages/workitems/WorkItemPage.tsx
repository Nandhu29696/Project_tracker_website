import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronRight, Link2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  ALLOWED_PARENTS,
  ENVIRONMENT_TYPE_LABELS,
  ENVIRONMENT_TYPES,
  LINK_LABELS,
  LINK_TYPES,
  nextStates,
  PRIORITIES,
  PRIORITY_LABELS,
  RESOLUTION_LABELS,
  RESOLUTIONS,
  SEVERITIES,
  SEVERITY_LABELS,
  STATE_CATEGORY,
  WORK_ITEM_STATE_LABELS,
  WORK_ITEM_TYPE_LABELS,
  type LinkType,
  type UpdateWorkItemBody,
  type WorkItemDetail,
} from '@tracker/shared';
import { Markdown, MarkdownEditor } from '@/components/Markdown';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/form';
import { Alert, Avatar, Card, FullPageSpinner } from '@/components/ui/misc';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProject } from '@/features/projects/api';
import { ProjectKey } from '@/features/projects/badges';
import { useWorkItem, wiKeys } from '@/features/workitems/api';
import { Attachments } from '@/features/workitems/Attachments';
import { CreateWorkItemDialog } from '@/features/workitems/CreateWorkItemDialog';
import { Comments, History } from '@/features/workitems/Discussion';
import { DEFAULT_CHILD_TYPE, StateLabel, TYPE_META, TypeIcon } from '@/features/workitems/meta';
import { useIterations } from '@/features/planning/api';
import { useProjectLive } from '@/lib/realtime';
import { NotFoundPage } from '@/pages/ErrorPages';
import { api, getErrorMessage } from '@/lib/api';
import { cn, formatDateTime } from '@/lib/utils';

type Patch = (data: UpdateWorkItemBody) => Promise<boolean>;

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] items-center gap-2 py-1.5">
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <div className="min-w-0 text-sm">{children}</div>
    </div>
  );
}

const fieldCls = 'h-8 text-sm';

/** Number input that saves on blur. */
function NumberField({
  value,
  onSave,
  disabled,
  label,
}: {
  value: number | null;
  onSave: (v: number | null) => void;
  disabled: boolean;
  label: string;
}) {
  const [v, setV] = useState(value === null ? '' : String(value));
  return (
    <Input
      type="number"
      min={0}
      step={0.5}
      value={v}
      disabled={disabled}
      aria-label={label}
      className={fieldCls}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        const next = v === '' ? null : Number(v);
        if (next !== value && (next === null || !Number.isNaN(next))) onSave(next);
      }}
    />
  );
}

function TagEditor({
  tags,
  onSave,
  disabled,
}: {
  tags: string[];
  onSave: (t: string[]) => void;
  disabled: boolean;
}) {
  const [input, setInput] = useState('');
  const add = () => {
    const t = input.trim().toLowerCase();
    if (t && !tags.includes(t)) onSave([...tags, t]);
    setInput('');
  };
  return (
    <div className="flex flex-wrap items-center gap-1">
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-0.5 rounded bg-slate-100 py-0.5 pr-0.5 pl-1.5 text-xs dark:bg-slate-800"
        >
          {t}
          {!disabled && (
            <button
              type="button"
              onClick={() => onSave(tags.filter((x) => x !== t))}
              aria-label={`Remove tag ${t}`}
              className="cursor-pointer rounded p-0.5 text-slate-400 hover:text-red-600"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="+ tag"
          aria-label="Add tag"
          maxLength={30}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          className="h-6 w-20 rounded border border-transparent bg-transparent px-1 text-xs outline-none hover:border-slate-300 focus:border-brand-500 dark:hover:border-slate-700"
        />
      )}
      {disabled && !tags.length && <span className="text-xs text-slate-400">—</span>}
    </div>
  );
}

/** Large text block (description / repro steps ...) with view + edit modes. */
function TextSection({
  title,
  value,
  onSave,
  canEdit,
  markdown = true,
  placeholder,
}: {
  title: string;
  value: string | null;
  onSave: (v: string | null) => Promise<boolean>;
  canEdit: boolean;
  markdown?: boolean;
  placeholder: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [saving, setSaving] = useState(false);
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {canEdit && !editing && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft(value ?? '');
              setEditing(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          {markdown ? (
            <MarkdownEditor value={draft} onChange={setDraft} rows={8} autoFocus />
          ) : (
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} autoFocus />
          )}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              loading={saving}
              onClick={async () => {
                setSaving(true);
                if (await onSave(draft.trim() ? draft : null)) setEditing(false);
                setSaving(false);
              }}
            >
              Save
            </Button>
          </div>
        </div>
      ) : value ? (
        markdown ? (
          <Markdown>{value}</Markdown>
        ) : (
          <p className="text-sm whitespace-pre-line text-slate-700 dark:text-slate-300">{value}</p>
        )
      ) : (
        <p className="text-sm text-slate-400">{placeholder}</p>
      )}
    </section>
  );
}

function LinksSection({
  item,
  patchDone,
}: {
  item: WorkItemDetail;
  patchDone: () => Promise<unknown>;
}) {
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState<LinkType>('RELATES');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const canEdit = item.access.canEdit && !item.projectArchived;

  const add = async () => {
    setBusy(true);
    try {
      await api.post(`/work-items/${item.id}/links`, { type, targetKey: key });
      setKey('');
      setAdding(false);
      await patchDone();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Link2 className="h-4 w-4 text-slate-400" /> Related work{' '}
          <span className="font-normal text-slate-400">{item.links.length}</span>
        </h3>
        {canEdit && !adding && (
          <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" /> Add link
          </Button>
        )}
      </div>
      {adding && (
        <div className="mb-3 flex flex-wrap gap-2">
          <Select
            value={type}
            onChange={(e) => setType(e.target.value as LinkType)}
            className="h-9 w-40"
            aria-label="Link type"
          >
            {LINK_TYPES.map((t) => (
              <option key={t} value={t}>
                {LINK_LABELS[t].outgoing}
              </option>
            ))}
          </Select>
          <Input
            value={key}
            onChange={(e) => setKey(e.target.value.toUpperCase())}
            placeholder="Item key, e.g. BCM-12"
            className="h-9 w-44"
            aria-label="Item key"
            onKeyDown={(e) => e.key === 'Enter' && key && add()}
            autoFocus
          />
          <Button size="sm" loading={busy} disabled={!key} onClick={add}>
            Link
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
            Cancel
          </Button>
        </div>
      )}
      {!item.links.length ? (
        <p className="text-sm text-slate-400">No linked items.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {item.links.map((l) => (
            <li key={l.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="w-24 shrink-0 text-xs text-slate-500">
                {LINK_LABELS[l.type][l.direction]}
              </span>
              <TypeIcon type={l.item.type} />
              <Link to={`/items/${l.item.key}`} className="truncate hover:text-brand-700">
                <span className="font-mono text-xs text-slate-500">{l.item.key}</span>{' '}
                {l.item.title}
              </Link>
              <StateLabel state={l.item.state} className="ml-auto" />
              {canEdit && (
                <button
                  type="button"
                  aria-label="Remove link"
                  className="cursor-pointer rounded p-1 text-slate-400 hover:text-red-600"
                  onClick={async () => {
                    try {
                      await api.delete(`/work-item-links/${l.id}`);
                      await patchDone();
                    } catch (err) {
                      toast.error(getErrorMessage(err));
                    }
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ParentField({ item, patch }: { item: WorkItemDetail; patch: Patch }) {
  const [editing, setEditing] = useState(false);
  const [key, setKey] = useState('');
  const allowed = ALLOWED_PARENTS[item.type];
  const canEdit = item.access.canEdit && !item.projectArchived && allowed.length > 0;
  if (editing) {
    return (
      <div className="flex gap-1">
        <Input
          value={key}
          onChange={(e) => setKey(e.target.value.toUpperCase())}
          placeholder={`${item.project.key}-…`}
          className={fieldCls}
          autoFocus
          aria-label="Parent key"
          onKeyDown={async (e) => {
            if (e.key === 'Escape') setEditing(false);
            if (e.key !== 'Enter') return;
            try {
              const res = await api.get<{ data: WorkItemDetail }>(`/work-items/key/${key}`);
              if (await patch({ parentId: res.data.data.id })) setEditing(false);
            } catch (err) {
              toast.error(getErrorMessage(err));
            }
          }}
        />
        <Button size="icon" variant="ghost" onClick={() => setEditing(false)} aria-label="Cancel">
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1">
      {item.parent ? (
        <Link
          to={`/items/${item.parent.key}`}
          className="flex min-w-0 items-center gap-1 hover:text-brand-700"
        >
          <TypeIcon type={item.parent.type} />
          <span className="truncate">
            {item.parent.key} {item.parent.title}
          </span>
        </Link>
      ) : (
        <span className="text-slate-400">{allowed.length ? 'None' : 'Top level'}</span>
      )}
      {canEdit && (
        <>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="cursor-pointer rounded p-1 text-slate-400 hover:text-slate-700"
            aria-label="Change parent"
            title={`Parent can be a ${allowed.map((t) => WORK_ITEM_TYPE_LABELS[t]).join(' or ')}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {item.parent && (
            <button
              type="button"
              onClick={() => patch({ parentId: null })}
              className="cursor-pointer rounded p-1 text-slate-400 hover:text-red-600"
              aria-label="Remove parent"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </>
      )}
    </div>
  );
}

export function WorkItemPage() {
  const { key } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: item, isLoading, error } = useWorkItem(key);
  const project = useProject(item?.project.id);
  const sprints = useIterations(item?.project.id);
  const openSprints = (sprints.data ?? []).filter((s) => s.state !== 'COMPLETED');
  useProjectLive(item?.project.id);
  const [tab, setTab] = useState<'discussion' | 'history'>('discussion');
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState('');
  const [addChild, setAddChild] = useState(false);

  if (isLoading) return <FullPageSpinner />;
  if (error || !item) return <NotFoundPage />;

  const canEdit = item.access.canEdit && !item.projectArchived;
  const isBug = item.type === 'BUG';
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: wiKeys.detail(key!) }),
      qc.invalidateQueries({ queryKey: wiKeys.history(item.id) }),
      qc.invalidateQueries({ queryKey: ['work-items', 'list'] }),
      qc.invalidateQueries({ queryKey: ['work-items', 'backlog'] }),
    ]);
  const patch: Patch = async (data) => {
    try {
      const res = await api.patch<{ data: WorkItemDetail }>(`/work-items/${item.id}`, data);
      qc.setQueryData(wiKeys.detail(key!), res.data.data);
      await refresh();
      return true;
    } catch (err) {
      toast.error(getErrorMessage(err));
      return false;
    }
  };

  const members = (project.data?.members ?? []).filter(
    (m) => m.role !== 'VIEWER' && m.user.isActive,
  );
  const assignable = item.access.canAssignOthers
    ? members
    : members.filter((m) => m.user.id === user?.id);
  const assigneeMissing = item.assignee && !assignable.some((m) => m.user.id === item.assignee!.id);
  const states = [item.state, ...nextStates(item.type, item.state)];
  const showResolution = isBug && ['resolved', 'completed'].includes(STATE_CATEGORY[item.state]);
  const childType = DEFAULT_CHILD_TYPE[item.type];

  return (
    <div className="space-y-5">
      {/* breadcrumb */}
      <nav
        className="flex flex-wrap items-center gap-1 text-sm text-slate-500"
        aria-label="Breadcrumb"
      >
        <Link
          to={`/projects/${item.project.id}?tab=work-items`}
          className="inline-flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white"
        >
          <ProjectKey value={item.project.key} /> {item.project.name}
        </Link>
        {item.parent && (
          <>
            <ChevronRight className="h-4 w-4" />
            <Link
              to={`/items/${item.parent.key}`}
              className="inline-flex max-w-xs items-center gap-1 truncate hover:text-slate-900 dark:hover:text-white"
            >
              <TypeIcon type={item.parent.type} /> {item.parent.key}
            </Link>
          </>
        )}
      </nav>

      {item.projectArchived && (
        <Alert tone="info">This project is archived. Work items are read-only.</Alert>
      )}

      {/* header */}
      <div
        className={cn(
          'rounded-xl border-l-4 bg-white p-4 shadow-sm sm:p-5 dark:bg-slate-900',
          TYPE_META[item.type].border,
        )}
      >
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <TypeIcon type={item.type} />
          <span className="font-semibold tracking-wide uppercase">
            {WORK_ITEM_TYPE_LABELS[item.type]}
          </span>
          <span className="font-mono">{item.key}</span>
        </div>
        {editingTitle ? (
          <div className="mt-2 flex gap-2">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              className="h-10 text-lg font-semibold"
              aria-label="Title"
              maxLength={255}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && (await patch({ title }))) setEditingTitle(false);
                if (e.key === 'Escape') setEditingTitle(false);
              }}
            />
            <Button
              size="icon"
              onClick={async () => (await patch({ title })) && setEditingTitle(false)}
              aria-label="Save title"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setEditingTitle(false)}
              aria-label="Cancel"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <h1 className="group mt-1 flex items-start gap-2 text-xl font-semibold tracking-tight wrap-break-word sm:text-2xl">
            <span className={cn(item.state === 'REMOVED' && 'line-through')}>{item.title}</span>
            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  setTitle(item.title);
                  setEditingTitle(true);
                }}
                className="mt-1 cursor-pointer rounded p-1 text-slate-400 opacity-100 hover:text-slate-700 sm:opacity-0 sm:group-hover:opacity-100"
                aria-label="Edit title"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </h1>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Select
            value={item.state}
            disabled={!canEdit}
            onChange={(e) => patch({ state: e.target.value as WorkItemDetail['state'] })}
            aria-label="State"
            className="h-9 w-44"
          >
            {states.map((s) => (
              <option key={s} value={s}>
                {WORK_ITEM_STATE_LABELS[s]}
              </option>
            ))}
          </Select>
          <span className="text-xs text-slate-500">Updated {formatDateTime(item.updatedAt)}</span>
          {item.access.canDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto text-red-600"
              onClick={async () => {
                if (
                  prompt(
                    `This permanently deletes ${item.key}${item.children.length ? ` and unparents ${item.children.length} child item(s)` : ''}. Type ${item.key} to confirm.`,
                  ) !== item.key
                )
                  return;
                try {
                  await api.delete(`/work-items/${item.id}`);
                  toast.success(`${item.key} deleted`);
                  await qc.invalidateQueries({ queryKey: wiKeys.all });
                  navigate(`/projects/${item.project.id}?tab=work-items`, { replace: true });
                } catch (err) {
                  toast.error(getErrorMessage(err));
                }
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          )}
        </div>
        {!item.access.canEdit && !item.projectArchived && (
          <p className="mt-3 text-xs text-slate-500">
            Read-only: you can change items assigned to you or created by you.
          </p>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card className="space-y-6 p-5">
            <TextSection
              title="Description"
              value={item.description}
              canEdit={canEdit}
              placeholder="No description."
              onSave={(v) => patch({ description: v })}
            />
            {isBug && (
              <>
                <TextSection
                  title="Repro steps"
                  value={item.reproSteps}
                  canEdit={canEdit}
                  placeholder="How to reproduce the bug."
                  onSave={(v) => patch({ reproSteps: v })}
                />
                <div className="grid gap-6 sm:grid-cols-2">
                  <TextSection
                    title="Expected result"
                    value={item.expectedResult}
                    canEdit={canEdit}
                    markdown={false}
                    placeholder="—"
                    onSave={(v) => patch({ expectedResult: v })}
                  />
                  <TextSection
                    title="Actual result"
                    value={item.actualResult}
                    canEdit={canEdit}
                    markdown={false}
                    placeholder="—"
                    onSave={(v) => patch({ actualResult: v })}
                  />
                </div>
              </>
            )}
          </Card>

          {(childType || item.children.length > 0) && (
            <Card className="p-5">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  Child items{' '}
                  <span className="font-normal text-slate-400">{item.children.length}</span>
                </h3>
                {childType && project.data?.workItemAccess.canCreate && (
                  <Button size="sm" variant="ghost" onClick={() => setAddChild(true)}>
                    <Plus className="h-3.5 w-3.5" /> Add child
                  </Button>
                )}
              </div>
              {!item.children.length ? (
                <p className="text-sm text-slate-400">Break this down into smaller items.</p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                  {item.children.map((c) => (
                    <li key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <TypeIcon type={c.type} />
                      <Link
                        to={`/items/${c.key}`}
                        className="min-w-0 flex-1 truncate hover:text-brand-700"
                      >
                        <span className="font-mono text-xs text-slate-500">{c.key}</span> {c.title}
                      </Link>
                      <StateLabel state={c.state} />
                      {c.assignee ? (
                        <Avatar name={c.assignee.name} src={c.assignee.avatarUrl} size="sm" />
                      ) : (
                        <span className="w-7" />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          <Card className="space-y-6 p-5">
            <LinksSection item={item} patchDone={refresh} />
            <Attachments
              workItemId={item.id}
              attachments={item.attachments}
              canUpload={item.access.canComment && !item.projectArchived}
              onChanged={refresh}
            />
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex gap-5 border-b border-slate-200 dark:border-slate-800">
              {(['discussion', 'history'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  aria-current={tab === t ? 'page' : undefined}
                  className={cn(
                    '-mb-px cursor-pointer border-b-2 pb-2 text-sm font-medium capitalize',
                    tab === t
                      ? 'border-brand-600 text-brand-700 dark:text-brand-100'
                      : 'border-transparent text-slate-500',
                  )}
                >
                  {t}
                  {t === 'discussion' && item.commentCount > 0 && (
                    <span className="ml-1.5 text-xs text-slate-400">{item.commentCount}</span>
                  )}
                </button>
              ))}
            </div>
            {tab === 'discussion' ? (
              <Comments
                workItemId={item.id}
                canComment={item.access.canComment && !item.projectArchived}
                members={project.data?.members ?? []}
              />
            ) : (
              <History workItemId={item.id} />
            )}
          </Card>
        </div>

        {/* details sidebar */}
        <Card className="h-fit p-5 lg:sticky lg:top-20">
          <h3 className="mb-2 text-sm font-semibold">Details</h3>
          <Row label="Assigned to">
            <Select
              value={item.assignee?.id ?? ''}
              disabled={!canEdit}
              onChange={(e) => patch({ assigneeId: e.target.value || null })}
              className={fieldCls}
              aria-label="Assigned to"
            >
              <option value="">Unassigned</option>
              {assigneeMissing && <option value={item.assignee!.id}>{item.assignee!.name}</option>}
              {assignable.map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.name}
                </option>
              ))}
            </Select>
          </Row>
          <Row label="Priority">
            <Select
              value={item.priority}
              disabled={!canEdit}
              onChange={(e) => patch({ priority: e.target.value as WorkItemDetail['priority'] })}
              className={fieldCls}
              aria-label="Priority"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </Select>
          </Row>
          {isBug && (
            <>
              <Row label="Severity">
                <Select
                  value={item.severity ?? ''}
                  disabled={!canEdit}
                  onChange={(e) =>
                    patch({ severity: (e.target.value || null) as WorkItemDetail['severity'] })
                  }
                  className={fieldCls}
                  aria-label="Severity"
                >
                  {SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {SEVERITY_LABELS[s]}
                    </option>
                  ))}
                </Select>
              </Row>
              {showResolution && (
                <Row label="Resolution">
                  <Select
                    value={item.resolution ?? 'FIXED'}
                    disabled={!canEdit}
                    onChange={(e) =>
                      patch({ resolution: e.target.value as WorkItemDetail['resolution'] })
                    }
                    className={fieldCls}
                    aria-label="Resolution"
                  >
                    {RESOLUTIONS.map((r) => (
                      <option key={r} value={r}>
                        {RESOLUTION_LABELS[r]}
                      </option>
                    ))}
                  </Select>
                </Row>
              )}
              <Row label="Found in">
                <Select
                  value={item.environment ?? ''}
                  disabled={!canEdit}
                  onChange={(e) =>
                    patch({
                      environment: (e.target.value || null) as WorkItemDetail['environment'],
                    })
                  }
                  className={fieldCls}
                  aria-label="Found in"
                >
                  <option value="">Not specified</option>
                  {ENVIRONMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {ENVIRONMENT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </Row>
            </>
          )}
          {item.type !== 'TASK' && (
            <Row label="Story points">
              <NumberField
                key={`sp-${item.storyPoints}`}
                label="Story points"
                value={item.storyPoints}
                disabled={!canEdit}
                onSave={(v) => patch({ storyPoints: v })}
              />
            </Row>
          )}
          {(item.type === 'TASK' || isBug) && (
            <>
              <Row label="Original est. (h)">
                <NumberField
                  key={`oe-${item.originalEstimate}`}
                  label="Original estimate"
                  value={item.originalEstimate}
                  disabled={!canEdit}
                  onSave={(v) => patch({ originalEstimate: v })}
                />
              </Row>
              <Row label="Remaining (h)">
                <NumberField
                  key={`rw-${item.remainingWork}`}
                  label="Remaining work"
                  value={item.remainingWork}
                  disabled={!canEdit}
                  onSave={(v) => patch({ remainingWork: v })}
                />
              </Row>
              <Row label="Completed (h)">
                <NumberField
                  key={`cw-${item.completedWork}`}
                  label="Completed work"
                  value={item.completedWork}
                  disabled={!canEdit}
                  onSave={(v) => patch({ completedWork: v })}
                />
              </Row>
            </>
          )}
          <Row label="Start date">
            <Input
              type="date"
              value={item.startDate ?? ''}
              disabled={!canEdit}
              onChange={(e) => patch({ startDate: e.target.value || null })}
              className={fieldCls}
              aria-label="Start date"
            />
          </Row>
          <Row label="Due date">
            <Input
              type="date"
              value={item.dueDate ?? ''}
              disabled={!canEdit}
              onChange={(e) => patch({ dueDate: e.target.value || null })}
              className={fieldCls}
              aria-label="Due date"
            />
          </Row>
          <Row label="Parent">
            <ParentField item={item} patch={patch} />
          </Row>
          <Row label="Sprint">
            <Select
              value={item.iteration?.id ?? ''}
              disabled={!canEdit}
              onChange={(e) => patch({ iterationId: e.target.value || null })}
              className={fieldCls}
              aria-label="Sprint"
            >
              <option value="">Backlog (no sprint)</option>
              {/* a completed sprint stays visible for items that were finished in it */}
              {item.iteration && !openSprints.some((s) => s.id === item.iteration!.id) && (
                <option value={item.iteration.id}>{item.iteration.name} (completed)</option>
              )}
              {openSprints.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.state === 'ACTIVE' ? ' (active)' : ''}
                </option>
              ))}
            </Select>
          </Row>
          <Row label="Tags">
            <TagEditor tags={item.tags} disabled={!canEdit} onSave={(tags) => patch({ tags })} />
          </Row>
          <div className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-800">
            <p>
              Created by {item.createdBy?.name ?? 'unknown'} · {formatDateTime(item.createdAt)}
            </p>
            <p>State changed {formatDateTime(item.stateChangedAt)}</p>
            {item.closedAt && <p>Closed {formatDateTime(item.closedAt)}</p>}
          </div>
        </Card>
      </div>

      {childType && (
        <CreateWorkItemDialog
          open={addChild}
          onClose={() => setAddChild(false)}
          projectId={item.project.id}
          defaultType={childType}
          parent={item}
          stay
        />
      )}
    </div>
  );
}
