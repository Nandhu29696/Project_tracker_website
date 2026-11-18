import { cn } from '@/lib/utils';

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden>
        <rect
          width="32"
          height="32"
          rx="7"
          className={light ? 'fill-white/15' : 'fill-brand-600'}
        />
        <path d="M9 10h6v12H9zM17 10h6v7h-6z" fill="#fff" />
      </svg>
      <span className={cn('text-base font-semibold tracking-tight', light && 'text-white')}>
        Project Tracker
      </span>
    </span>
  );
}
