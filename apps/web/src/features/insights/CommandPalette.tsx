import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bug,
  FolderKanban,
  ListChecks,
  Plus,
  Search,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/features/auth/AuthProvider';
import { ProjectKey } from '@/features/projects/badges';
import { StateLabel, TypeIcon } from '@/features/workitems/meta';
import { cn } from '@/lib/utils';
import { useSearch } from './api';

/** Renders "a <<match>> b" with the match highlighted - no HTML injection. */
function Snippet({ text }: { text: string }) {
  const parts = text.split(/(<<.*?>>)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('<<') ? (
          <mark key={i} className="rounded bg-amber-100 px-0.5 text-inherit dark:bg-amber-500/30">
            {p.slice(2, -2)}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

interface Entry {
  id: string;
  group: string;
  label: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  run: () => void;
}

export function CommandPalette({
  open,
  onClose,
  onNewItem,
}: {
  open: boolean;
  onClose: () => void;
  onNewItem: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { can } = useAuth();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [active, setActive] = useState(0);
  const { data, isFetching } = useSearch(debounced);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 200);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      requestAnimationFrame(() => input.current?.focus());
    }
    if (!open && el.open) el.close();
  }, [open]);

  const go = (path: string) => () => {
    onClose();
    navigate(path);
  };

  const entries: Entry[] = useMemo(() => {
    const actions: { label: string; icon: LucideIcon; run: () => void; show: boolean }[] = [
      {
        label: 'New work item',
        icon: Plus,
        run: () => {
          onClose();
          onNewItem();
        },
        show: can('workitem:create'),
      },
      { label: 'My work', icon: ListChecks, run: go('/my-work'), show: true },
      { label: 'Projects', icon: FolderKanban, run: go('/projects'), show: can('project:read') },
      { label: 'Bugs', icon: Bug, run: go('/bugs'), show: true },
      { label: 'Sprints', icon: Timer, run: go('/sprints'), show: true },
      { label: 'Reports', icon: BarChart3, run: go('/reports'), show: can('project:read') },
    ];
    const term = q.trim().toLowerCase();
    const list: Entry[] = actions
      .filter((a) => a.show && (!term || a.label.toLowerCase().includes(term)))
      .map((a) => ({
        id: `a:${a.label}`,
        group: 'Actions',
        label: a.label,
        icon: <a.icon className="h-4 w-4 text-slate-400" />,
        run: a.run,
      }));
    if (debounced.length >= 2 && data) {
      for (const p of data.projects) {
        list.push({
          id: `p:${p.id}`,
          group: 'Projects',
          label: p.name,
          icon: <ProjectKey value={p.key} />,
          run: go(`/projects/${p.id}`),
        });
      }
      for (const w of data.workItems) {
        list.push({
          id: `w:${w.id}`,
          group: 'Work items',
          label: (
            <>
              <span className="mr-1.5 font-mono text-xs text-slate-500">{w.key}</span>
              {w.title}
            </>
          ),
          sub: w.snippet ? <Snippet text={w.snippet} /> : undefined,
          icon: <TypeIcon type={w.type} />,
          run: go(`/items/${w.key}`),
        });
      }
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- go/onClose are stable enough for a menu
  }, [q, debounced, data, can]);

  const safeActive = Math.min(active, Math.max(0, entries.length - 1));

  return (
    <dialog
      ref={ref}
      onClose={() => {
        onClose();
        setQ('');
        setActive(0);
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      className="mx-auto mt-[12vh] w-[calc(100%-2rem)] max-w-xl rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
      aria-label="Search and commands"
    >
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 dark:border-slate-800">
        <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(entries.length - 1, a + 1));
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              entries[safeActive]?.run();
            }
          }}
          placeholder="Search work items, projects, or type a command…"
          className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-results"
          aria-activedescendant={entries[safeActive] ? `palette-${safeActive}` : undefined}
        />
        {isFetching && <span className="text-xs text-slate-400">Searching…</span>}
        <kbd className="hidden rounded border border-slate-200 px-1.5 text-[10px] text-slate-400 sm:block dark:border-slate-700">
          Esc
        </kbd>
      </div>
      <ul id="palette-results" role="listbox" className="max-h-[55vh] overflow-y-auto p-2">
        {entries.map((e, i) => {
          const header = i === 0 || entries[i - 1]!.group !== e.group ? e.group : null;
          return (
            <li key={e.id} role="presentation">
              {header && (
                <p className="px-2 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                  {header}
                </p>
              )}
              <button
                id={`palette-${i}`}
                type="button"
                role="option"
                aria-selected={i === safeActive}
                onMouseMove={() => setActive(i)}
                onClick={e.run}
                className={cn(
                  'flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-2 py-2 text-left text-sm',
                  i === safeActive && 'bg-brand-50 dark:bg-brand-500/10',
                )}
              >
                <span className="mt-0.5 shrink-0">{e.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{e.label}</span>
                  {e.sub && (
                    <span className="mt-0.5 block truncate text-xs text-slate-500">{e.sub}</span>
                  )}
                </span>
                {e.group === 'Work items' &&
                  data &&
                  (() => {
                    const w = data.workItems.find((x) => `w:${x.id}` === e.id);
                    return w ? (
                      <StateLabel state={w.state} className="shrink-0 text-slate-500" />
                    ) : null;
                  })()}
              </button>
            </li>
          );
        })}
        {debounced.length >= 2 && data && !data.workItems.length && !data.projects.length && (
          <li className="px-2 py-6 text-center text-sm text-slate-500">
            No results for “{debounced}”.
          </li>
        )}
      </ul>
      <div className="flex gap-4 border-t border-slate-200 px-4 py-2 text-[11px] text-slate-400 dark:border-slate-800">
        <span>↑↓ to move</span>
        <span>Enter to open</span>
        <span>Ctrl K to toggle</span>
      </div>
    </dialog>
  );
}
