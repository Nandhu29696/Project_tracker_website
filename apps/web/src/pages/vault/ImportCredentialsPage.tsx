import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, KeyRound, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { CredentialImportResult } from '@tracker/shared';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/form';
import { Alert, Badge, Card, CardHeader } from '@/components/ui/misc';
import { useProjects } from '@/features/projects/api';
import { api, getErrorMessage } from '@/lib/api';

async function send(file: File, dryRun: boolean, map?: Record<string, string>) {
  const res = await api.post<{ data: CredentialImportResult }>(
    `/vault/import?dryRun=${dryRun}`,
    file,
    {
      headers: {
        'Content-Type': 'application/octet-stream',
        ...(map ? { 'X-Import-Map': JSON.stringify(map) } : {}),
      },
    },
  );
  return res.data.data;
}

/** Admin: import credentials from a workbook laid out like Sheet2 of "Project Details.xlsx". */
export function ImportCredentialsPage() {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const projects = useProjects({ pageSize: 100, sort: 'name', order: 'asc' });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CredentialImportResult | null>(null);
  const [map, setMap] = useState<Record<string, string>>({});
  const [done, setDone] = useState<CredentialImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = async (f?: File) => {
    if (!f) return;
    setError(null);
    setDone(null);
    setPreview(null);
    if (!f.name.toLowerCase().endsWith('.xlsx')) return setError('Choose an Excel .xlsx file.');
    setFile(f);
    setBusy(true);
    try {
      const p = await send(f, true);
      setPreview(p);
      setMap(
        Object.fromEntries(p.sections.map((s) => [String(s.index), s.suggestedProjectId ?? ''])),
      );
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
      const r = await send(file, false, map);
      setDone(r);
      setPreview(null);
      await qc.invalidateQueries({ queryKey: ['credentials'] });
      toast.success(`${r.created} credential(s) imported`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const toImport =
    preview?.sections.reduce(
      (n, s) => n + (map[String(s.index)] ? s.entries.filter((e) => !e.duplicate).length : 0),
      0,
    ) ?? 0;

  return (
    <div className="space-y-6">
      <Link
        to="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Projects
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import credentials</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Move logins out of spreadsheets into the encrypted vault. Each block (a title row, a
          header row such as <em>username | password</em>, then data rows) becomes a section you
          assign to a project.
        </p>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={input}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              void choose(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <Button
            variant="outline"
            loading={busy && !preview}
            onClick={() => input.current?.click()}
          >
            <Upload className="h-4 w-4" /> {file ? 'Choose another file' : 'Choose .xlsx file'}
          </Button>
          {file && <span className="text-sm text-slate-600 dark:text-slate-300">{file.name}</span>}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          The preview never shows secrets (only their first character). Nothing is saved until you
          click Import.
        </p>
      </Card>

      {error && <Alert tone="error">{error}</Alert>}
      {done && (
        <Alert tone="success" title="Import finished">
          {done.created} imported, {done.skipped} skipped. <strong>Next step:</strong> change these
          passwords in the systems they belong to (they were stored in a spreadsheet), then rotate
          them here.
        </Alert>
      )}

      {preview && (
        <Card>
          <CardHeader
            title="Preview"
            description={`${preview.sections.length} section(s) found · ${toImport} credential(s) will be imported`}
            action={
              <Button onClick={commit} loading={busy} disabled={!toImport}>
                <CheckCircle2 className="h-4 w-4" /> Import {toImport}
              </Button>
            }
          />
          {!preview.sections.length ? (
            <p className="p-6 text-sm text-slate-500">
              No credential blocks were found in this file.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {preview.sections.map((s) => (
                <li key={s.index} className="space-y-3 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="flex items-center gap-2 font-medium">
                      <KeyRound className="h-4 w-4 text-slate-400" /> {s.title}
                    </h3>
                    <Select
                      value={map[String(s.index)] ?? ''}
                      onChange={(e) => setMap((m) => ({ ...m, [String(s.index)]: e.target.value }))}
                      className="h-9 w-64"
                      aria-label={`Project for ${s.title}`}
                    >
                      <option value="">Skip this section</option>
                      {(projects.data?.data ?? []).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.key} · {p.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {s.entries.map((e, i) => (
                        <tr key={i}>
                          <td className="py-1.5 pr-3 font-medium">{e.label}</td>
                          <td className="py-1.5 pr-3 text-slate-600 dark:text-slate-300">
                            {e.username ?? '—'}
                          </td>
                          <td className="py-1.5 pr-3 font-mono text-xs text-slate-500">
                            {e.secretPreview}
                          </td>
                          <td className="py-1.5 text-right">
                            {e.duplicate && <Badge>Already in vault</Badge>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
