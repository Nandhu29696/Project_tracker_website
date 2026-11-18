import { useState, type ComponentProps } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { Textarea } from './ui/form';

/**
 * Renders user-written Markdown. react-markdown never renders raw HTML, so user
 * content cannot inject scripts; links open in a new tab without referrer.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={cn(
        'space-y-2 text-sm leading-relaxed break-words text-slate-700 dark:text-slate-300',
        '[&_a]:text-brand-600 [&_a]:underline [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold',
        '[&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-0.5',
        '[&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em] dark:[&_code]:bg-slate-800',
        '[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-slate-900 [&_pre]:p-3 [&_pre]:text-slate-100 [&_pre_code]:bg-transparent [&_pre_code]:p-0',
        '[&_blockquote]:border-l-4 [&_blockquote]:border-slate-200 [&_blockquote]:pl-3 [&_blockquote]:text-slate-500 dark:[&_blockquote]:border-slate-700',
        '[&_table]:w-full [&_table]:text-left [&_td]:border [&_td]:border-slate-200 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-2 [&_th]:py-1 dark:[&_td]:border-slate-700 dark:[&_th]:border-slate-700 dark:[&_th]:bg-slate-800',
        '[&_input[type=checkbox]]:mr-1.5',
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer nofollow" />
          ),
          img: ({ node: _node, alt }) => <span className="text-slate-400">[image: {alt}]</span>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

/** Textarea with Write / Preview tabs. */
export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  rows = 6,
  id,
  ...rest
}: Omit<ComponentProps<'textarea'>, 'value' | 'onChange'> & {
  value: string;
  onChange: (value: string) => void;
}) {
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  return (
    <div className="rounded-lg border border-slate-300 dark:border-slate-700">
      <div className="flex items-center gap-1 border-b border-slate-200 px-2 pt-1.5 text-xs dark:border-slate-800">
        {(['write', 'preview'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'cursor-pointer rounded-t-md px-3 py-1.5 font-medium capitalize',
              tab === t
                ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                : 'text-slate-500',
            )}
          >
            {t}
          </button>
        ))}
        <span className="ml-auto pr-1 text-slate-400">Markdown supported</span>
      </div>
      {tab === 'write' ? (
        <Textarea
          id={id}
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="rounded-t-none border-0 shadow-none focus:ring-0"
          {...rest}
        />
      ) : (
        <div className="min-h-24 p-3">
          {value.trim() ? (
            <Markdown>{value}</Markdown>
          ) : (
            <p className="text-sm text-slate-400">Nothing to preview</p>
          )}
        </div>
      )}
    </div>
  );
}
