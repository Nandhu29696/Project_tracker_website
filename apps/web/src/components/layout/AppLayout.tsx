import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Bug,
  ChevronDown,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  ListTodo,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Sun,
  Tags,
  Timer,
  UserCircle,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { ROLE_LABELS, type Permission } from '@tracker/shared';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Avatar, Badge } from '@/components/ui/misc';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

// loaded on first use (it pulls in the Markdown editor)
const CreateWorkItemDialog = lazy(() =>
  import('@/features/workitems/CreateWorkItemDialog').then((m) => ({
    default: m.CreateWorkItemDialog,
  })),
);

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  permission?: Permission;
  soon?: string;
}

const mainNav: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/my-work', label: 'My Work', icon: ListChecks, permission: 'workitem:read' },
  { to: '/projects', label: 'Projects', icon: FolderKanban, permission: 'project:read' },
  { to: '/work-items', label: 'Work Items', icon: ListTodo, permission: 'workitem:read' },
  { to: '/bugs', label: 'Bugs', icon: Bug, permission: 'workitem:read' },
  { to: '/sprints', label: 'Sprints', icon: Timer, permission: 'workitem:read' },
];

const adminNav: NavItem[] = [
  { to: '/admin/users', label: 'Users', icon: Users, permission: 'user:read' },
  { to: '/admin/categories', label: 'Categories', icon: Tags, permission: 'settings:manage' },
];

function NavSection({
  title,
  items,
  onNavigate,
}: {
  title?: string;
  items: NavItem[];
  onNavigate: () => void;
}) {
  const { can } = useAuth();
  const visible = items.filter((i) => !i.permission || can(i.permission));
  if (!visible.length) return null;
  return (
    <div>
      {title && (
        <p className="mb-2 px-3 text-xs font-semibold tracking-wider text-slate-400 uppercase dark:text-slate-500">
          {title}
        </p>
      )}
      <ul className="space-y-0.5">
        {visible.map(({ to, label, icon: Icon, soon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-100'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white',
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {soon && <span className="text-[10px] font-normal text-slate-400">{soon}</span>}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  if (!user) return null;
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex cursor-pointer items-center gap-2 rounded-lg p-1 pr-2 hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar name={user.name} src={user.avatarUrl} size="sm" />
        <span className="hidden max-w-32 truncate text-sm font-medium md:block">{user.name}</span>
        <ChevronDown className="hidden h-4 w-4 text-slate-400 md:block" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="border-b border-slate-200 px-3 py-2.5 dark:border-slate-800">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
            <Badge tone="blue" className="mt-2">
              {ROLE_LABELS[user.role]}
            </Badge>
          </div>
          <Link
            to="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <UserCircle className="h-4 w-4" /> Profile & security
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              await logout();
              navigate('/login', { replace: true });
            }}
            className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const { can } = useAuth();

  const sidebar = (
    <nav className="flex h-full flex-col gap-6 overflow-y-auto px-3 py-4">
      <NavSection items={mainNav} onNavigate={() => setMobileOpen(false)} />
      <NavSection title="Administration" items={adminNav} onNavigate={() => setMobileOpen(false)} />
    </nav>
  );

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex dark:border-slate-800 dark:bg-slate-900">
        <div className="flex h-16 items-center border-b border-slate-200 px-5 dark:border-slate-800">
          <Link to="/">
            <Logo />
          </Link>
        </div>
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-white shadow-xl dark:bg-slate-900">
            <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
              <Logo />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6 dark:border-slate-800 dark:bg-slate-900/90">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="relative hidden max-w-md flex-1 sm:block">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              disabled
              placeholder="Search work items… (coming in Phase 5)"
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pr-3 pl-9 text-sm placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {can('workitem:create') && (
              <Button size="sm" onClick={() => setCreateOpen(true)} aria-label="New work item">
                <Plus className="h-4 w-4" /> <span className="hidden sm:inline">New</span>
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle dark mode">
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <UserMenu />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
      {createOpen && (
        <Suspense fallback={null}>
          <CreateWorkItemDialog open onClose={() => setCreateOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
