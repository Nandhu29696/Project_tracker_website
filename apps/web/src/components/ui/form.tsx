import { useId, useState, type ComponentProps, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

const fieldBase =
  'block w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:disabled:bg-slate-800';

const invalidCls = 'border-red-500 focus:border-red-500 focus:ring-red-500/20 dark:border-red-500';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(fieldBase, 'h-10', props['aria-invalid'] && invalidCls, className)}
      {...props}
    />
  );
}

export function PasswordInput({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input type={visible ? 'text' : 'password'} className={cn('pr-10', className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        aria-label={visible ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <select className={cn(fieldBase, 'h-10 cursor-pointer pr-8', className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(fieldBase, 'min-h-24 py-2', props['aria-invalid'] && invalidCls, className)}
      {...props}
    />
  );
}

export function Label({ className, ...props }: ComponentProps<'label'>) {
  return (
    <label
      className={cn(
        'mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300',
        className,
      )}
      {...props}
    />
  );
}

interface FieldProps {
  label: string;
  error?: string;
  hint?: ReactNode;
  action?: ReactNode;
  children: (id: string, describedBy?: string) => ReactNode;
}

/** Label + control + error message wired together for accessibility. */
export function Field({ label, error, hint, action, children }: FieldProps) {
  const id = useId();
  const errId = `${id}-error`;
  return (
    <div>
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        {action}
      </div>
      {children(id, error ? errId : undefined)}
      {error ? (
        <p id={errId} className="mt-1.5 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}
