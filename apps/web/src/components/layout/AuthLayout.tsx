import type { ReactNode } from 'react';
import { Bug, KanbanSquare, ShieldCheck, Timer } from 'lucide-react';
import { Logo } from '@/components/Logo';

const highlights = [
  {
    icon: KanbanSquare,
    title: 'Boards & backlogs',
    text: 'Epics, features, stories and tasks in one hierarchy.',
  },
  { icon: Timer, title: 'Sprint planning', text: 'Plan iterations, track capacity and burndown.' },
  { icon: Bug, title: 'Bug tracking', text: 'Severity, repro steps and environments per project.' },
  {
    icon: ShieldCheck,
    title: 'Role based access',
    text: 'Admin, Manager and Employee permissions.',
  },
];

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-indigo-700 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
          aria-hidden
        />
        <Logo light className="relative" />
        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight">
            Plan, track and ship every project in one place.
          </h2>
          <ul className="mt-10 space-y-6">
            {highlights.map(({ icon: Icon, title: t, text }) => (
              <li key={t} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-medium">{t}</p>
                  <p className="text-sm text-blue-100">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-blue-200">
          © {new Date().getFullYear()} Project Tracker
        </p>
      </aside>

      <main className="flex items-center justify-center bg-white px-4 py-10 sm:px-6 dark:bg-slate-950">
        <div className="w-full max-w-sm">
          <Logo className="mb-8 lg:hidden" />
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          )}
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
