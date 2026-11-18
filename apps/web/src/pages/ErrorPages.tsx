import { Link } from 'react-router-dom';
import { Construction, FileQuestion, ShieldX, type LucideIcon } from 'lucide-react';

function Message({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800">
        <Icon className="h-7 w-7" />
      </span>
      <h1 className="mt-4 text-xl font-semibold">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">{text}</p>
      <Link
        to="/"
        className="mt-6 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-500"
      >
        Back to dashboard
      </Link>
    </div>
  );
}

export const NotFoundPage = () => (
  <Message
    icon={FileQuestion}
    title="Page not found"
    text="The page you are looking for does not exist or was moved."
  />
);

export const ForbiddenPage = () => (
  <Message
    icon={ShieldX}
    title="Access denied"
    text="Your role does not have permission to view this page. Contact an administrator if you need access."
  />
);

export const ComingSoonPage = ({ title, phase }: { title: string; phase: string }) => (
  <Message
    icon={Construction}
    title={title}
    text={`This module is planned for ${phase}. See PROJECT_PLAN.md for the roadmap.`}
  />
);
