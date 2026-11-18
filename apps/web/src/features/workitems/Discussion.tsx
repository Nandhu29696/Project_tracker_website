import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { CommentDto, ProjectMemberDto } from '@tracker/shared';
import { Markdown } from '@/components/Markdown';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/form';
import { Avatar, Spinner } from '@/components/ui/misc';
import { api, getErrorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { useComments, useHistory, wiKeys } from './api';
import { timeAgo } from './meta';

/** Textarea that suggests project members after typing "@". */
function MentionInput({
  value,
  onChange,
  members,
  onMention,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  members: ProjectMemberDto[];
  onMention: (userId: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  const matches =
    query === null
      ? []
      : members
          .filter((m) => m.user.isActive && m.user.name.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 6);

  const detect = (text: string, caret: number) => {
    const m = text.slice(0, caret).match(/(?:^|\s)@([\p{L}\d._-]{0,30})$/u);
    setQuery(m ? m[1]! : null);
    setActive(0);
  };

  const pick = (member: ProjectMemberDto) => {
    const el = ref.current!;
    const caret = el.selectionStart;
    const before = value
      .slice(0, caret)
      .replace(/@([\p{L}\d._-]{0,30})$/u, `@${member.user.name} `);
    const next = before + value.slice(caret);
    onChange(next);
    onMention(member.user.id);
    setQuery(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(before.length, before.length);
    });
  };

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        value={value}
        rows={3}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          detect(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={(e) => {
          if (!matches.length) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => (a + 1) % matches.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => (a - 1 + matches.length) % matches.length);
          } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            pick(matches[active]!);
          } else if (e.key === 'Escape') setQuery(null);
        }}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
        aria-label="Comment"
      />
      {matches.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 w-64 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {matches.map((m, i) => (
            <li key={m.user.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(m);
                }}
                className={`flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm ${i === active ? 'bg-brand-50 dark:bg-brand-500/10' : ''}`}
              >
                <Avatar name={m.user.name} src={m.user.avatarUrl} size="sm" />
                <span className="truncate">{m.user.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Only keep mention ids whose "@Name" is still in the text. */
const liveMentions = (body: string, ids: Set<string>, members: ProjectMemberDto[]) =>
  [...ids].filter((id) => {
    const m = members.find((x) => x.user.id === id);
    return m && body.includes(`@${m.user.name}`);
  });

function CommentItem({
  c,
  workItemId,
  members,
}: {
  c: CommentDto;
  workItemId: string;
  members: ProjectMemberDto[];
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(c.body);
  const [mentions, setMentions] = useState(new Set(c.mentions.map((m) => m.id)));
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: wiKeys.comments(workItemId) });

  const save = async () => {
    setBusy(true);
    try {
      await api.patch(`/comments/${c.id}`, {
        body,
        mentions: liveMentions(body, mentions, members),
      });
      setEditing(false);
      await refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex gap-3">
      <Avatar name={c.author?.name ?? '?'} src={c.author?.avatarUrl} />
      <div className="min-w-0 flex-1 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-xs dark:border-slate-800">
          <span>
            <span className="font-medium text-slate-800 dark:text-slate-100">
              {c.author?.name ?? 'Deleted user'}
            </span>{' '}
            <span className="text-slate-500" title={formatDateTime(c.createdAt)}>
              {timeAgo(c.createdAt)}
              {c.editedAt && ' · edited'}
            </span>
          </span>
          <span className="flex gap-1">
            {c.canEdit && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="cursor-pointer rounded p-1 text-slate-400 hover:text-slate-700"
                aria-label="Edit comment"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {c.canDelete && (
              <button
                type="button"
                aria-label="Delete comment"
                className="cursor-pointer rounded p-1 text-slate-400 hover:text-red-600"
                onClick={async () => {
                  if (!confirm('Delete this comment?')) return;
                  try {
                    await api.delete(`/comments/${c.id}`);
                    await refresh();
                  } catch (err) {
                    toast.error(getErrorMessage(err));
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </span>
        </div>
        <div className="px-3 py-2">
          {editing ? (
            <div className="space-y-2">
              <MentionInput
                value={body}
                onChange={setBody}
                members={members}
                onMention={(id) => setMentions((s) => new Set(s).add(id))}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditing(false);
                    setBody(c.body);
                  }}
                >
                  Cancel
                </Button>
                <Button size="sm" loading={busy} disabled={!body.trim()} onClick={save}>
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <Markdown>{c.body}</Markdown>
          )}
        </div>
      </div>
    </li>
  );
}

export function Comments({
  workItemId,
  canComment,
  members,
}: {
  workItemId: string;
  canComment: boolean;
  members: ProjectMemberDto[];
}) {
  const qc = useQueryClient();
  const { data, isLoading } = useComments(workItemId);
  const [body, setBody] = useState('');
  const [mentions, setMentions] = useState<Set<string>>(new Set());
  const [posting, setPosting] = useState(false);

  const post = async () => {
    setPosting(true);
    try {
      await api.post(`/work-items/${workItemId}/comments`, {
        body,
        mentions: liveMentions(body, mentions, members),
      });
      setBody('');
      setMentions(new Set());
      await qc.invalidateQueries({ queryKey: wiKeys.comments(workItemId) });
      await qc.invalidateQueries({ queryKey: ['work-items', 'list'] });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="space-y-4">
      {canComment && (
        <div className="space-y-2">
          <MentionInput
            value={body}
            onChange={setBody}
            members={members}
            onMention={(id) => setMentions((s) => new Set(s).add(id))}
            placeholder="Add a comment. Type @ to mention someone. Markdown supported."
          />
          <div className="flex justify-end">
            <Button size="sm" loading={posting} disabled={!body.trim()} onClick={post}>
              Comment
            </Button>
          </div>
        </div>
      )}
      {isLoading ? (
        <div className="flex justify-center p-6">
          <Spinner />
        </div>
      ) : !data?.length ? (
        <p className="py-4 text-center text-sm text-slate-500">No comments yet.</p>
      ) : (
        <ul className="space-y-4">
          {[...data].reverse().map((c) => (
            <CommentItem key={c.id} c={c} workItemId={workItemId} members={members} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function History({ workItemId }: { workItemId: string }) {
  const { data, isLoading } = useHistory(workItemId, true);
  if (isLoading)
    return (
      <div className="flex justify-center p-6">
        <Spinner />
      </div>
    );
  if (!data?.length)
    return <p className="py-4 text-center text-sm text-slate-500">No history yet.</p>;
  return (
    <ol className="space-y-3">
      {data.map((h) => (
        <li key={h.id} className="flex gap-3 text-sm">
          <Avatar name={h.actor?.name ?? '?'} src={h.actor?.avatarUrl} size="sm" />
          <div className="min-w-0">
            <p>
              <span className="font-medium">{h.actor?.name ?? 'Someone'}</span>{' '}
              {h.field === 'created' ? (
                <>created this {h.newValue?.toLowerCase()}</>
              ) : h.newValue === 'edited' && !h.oldValue ? (
                <>
                  edited <span className="font-medium">{h.field.toLowerCase()}</span>
                </>
              ) : (
                <>
                  changed <span className="font-medium">{h.field}</span>{' '}
                  <span className="inline-flex flex-wrap items-center gap-1 text-slate-600 dark:text-slate-300">
                    <span
                      className={
                        h.oldValue ? 'line-through decoration-slate-400' : 'italic text-slate-400'
                      }
                    >
                      {h.oldValue ?? 'empty'}
                    </span>
                    <ArrowRight className="h-3 w-3" />
                    <span className={h.newValue ? '' : 'italic text-slate-400'}>
                      {h.newValue ?? 'empty'}
                    </span>
                  </span>
                </>
              )}
            </p>
            <p className="text-xs text-slate-500" title={formatDateTime(h.createdAt)}>
              {timeAgo(h.createdAt)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
