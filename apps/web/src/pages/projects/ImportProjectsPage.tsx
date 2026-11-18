import { useRef, useState, type DragEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, FileSpreadsheet, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { ImportResult } from '@tracker/shared';
import { Button } from '@/components/ui/button';
import { Alert, Badge, Card, CardHeader } from '@/components/ui/misc';
import { projectKeys } from '@/features/projects/api';
import { ProjectKey } from '@/features/projects/badges';
import { api, getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

const MAX_BYTES = 5 * 1024 * 1024;
const actionTone = { create: 'green', skip: 'slate', error: 'red' } as const;
const actionLabel = { create: 'Will create', skip: 'Skip', error: 'Error' } as const;

async function upload(file: File, dryRun: boolean) {
  const res = await api.post<{ data: ImportResult }>(`/projects/import?dryRun=${dryRun}`, file, {
    headers: { 'Content-Type': 'application/octet-stream' },
  });
  return res.data.data;
}

export function ImportProjectsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [done, setDone] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    setDone(null);
    setPreview(null);
    if (!f.name.toLowerCase().endsWith('.xlsx')) return setError('Choose an Excel .xlsx file.');
    if (f.size > MAX_BYTES) return setError('The file is larger than 5 MB.');
    setFile(f);
    setBusy(true);
    try {
      setPreview(await upload(f, true));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const result = await upload(file, false);
      setDone(result);
      setPreview(null);
      await qc.invalidateQueries({ queryKey: projectKeys.all });
      await qc.invalidateQueries({ queryKey: ['categories'] });
      toast.success(
        `${result.totals.create} project${result.totals.create === 1 ? '' : 's'} imported`,
      );
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void choose(e.dataTransfer.files[0]);
  };

  const result = done ?? preview;

  return (
    <div className="space-y-6">
      <Link
        to="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Projects
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import projects</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Upload a spreadsheet like <em>Project Details.xlsx</em>. You'll see a preview before
          anything is saved.
        </p>
      </div>

      <Card className="p-5">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex flex-col items-center rounded-xl border-2 border-dashed p-8 text-center transition-colors',
            dragging
              ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
              : 'border-slate-300 dark:border-slate-700',
          )}
        >
          <FileSpreadsheet className="h-10 w-10 text-emerald-600" />
          <p className="mt-3 text-sm font-medium">
            {file ? file.name : 'Drag & drop an .xlsx file here'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Needs a header row with <strong>Project Name</strong>. Recognised columns: Category,
            Description, Priority, Final Status, Dev Status, Deployment, Start Date, End Date,
            Website URL.
          </p>
          <input
            ref={input}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              void choose(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            loading={busy && !preview}
            onClick={() => input.current?.click()}
          >
            <Upload className="h-4 w-4" /> {file ? 'Choose another file' : 'Choose file'}
          </Button>
        </div>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-slate-500 dark:text-slate-400">
          <li>
            Projects whose name already exists are skipped, so re-importing the same file is safe.
          </li>
          <li>
            Unknown categories are created. Missing priority becomes Medium. Out-of-order dates are
            kept and flagged for you to fix.
          </li>
          <li>
            Login credentials are never imported. They will go into the Credentials Vault (Phase 4).
          </li>
        </ul>
      </Card>

      {error && <Alert tone="error">{error}</Alert>}

      {done && (
        <Alert tone="success" title="Import finished">
          {done.totals.create} created, {done.totals.skip} skipped, {done.totals.error} with errors.{' '}
          <button
            type="button"
            className="cursor-pointer font-medium underline"
            onClick={() => navigate('/projects')}
          >
            View projects
          </button>
        </Alert>
      )}

      {result && (
        <Card>
          <CardHeader
            title={done ? 'Import result' : 'Preview'}
            description={`Sheet "${result.sheet}" · ${result.totals.create} to create · ${result.totals.skip} skipped · ${result.totals.error} errors`}
            action={
              !done && (
                <Button onClick={commit} loading={busy} disabled={!result.totals.create}>
                  <CheckCircle2 className="h-4 w-4" /> Import {result.totals.create} project
                  {result.totals.create === 1 ? '' : 's'}
                </Button>
              )
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Row</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Key</th>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {result.rows.map((r) => (
                  <tr key={r.row} className="align-top">
                    <td className="px-4 py-3 text-slate-500">{r.row}</td>
                    <td className="px-4 py-3">
                      <Badge tone={actionTone[r.action]}>
                        {done && r.action === 'create' ? 'Created' : actionLabel[r.action]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{r.key ? <ProjectKey value={r.key} /> : '—'}</td>
                    <td className="px-4 py-3 font-medium">
                      {r.name ?? <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {r.messages.length ? (
                        <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                          {r.messages.map((m) => (
                            <li key={m}>• {m}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
