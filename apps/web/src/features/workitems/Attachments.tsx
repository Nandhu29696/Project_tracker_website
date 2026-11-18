import { useRef, useState } from 'react';
import { Download, FileText, Paperclip, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  ATTACHMENT_TYPES,
  isImageType,
  MAX_ATTACHMENT_BYTES,
  type AttachmentDto,
} from '@tracker/shared';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/misc';
import { downloadFile } from '@/features/projects/api';
import { api, getErrorMessage } from '@/lib/api';
import { useAttachmentUrl } from './api';
import { formatBytes, timeAgo } from './meta';

function Thumb({ a }: { a: AttachmentDto }) {
  const url = useAttachmentUrl(isImageType(a.mimeType) ? a.id : null);
  if (!isImageType(a.mimeType)) return <FileText className="h-8 w-8 text-slate-400" />;
  if (!url) return <Spinner className="h-5 w-5" />;
  return (
    <a href={url} target="_blank" rel="noreferrer" title="Open full size">
      <img src={url} alt={a.fileName} className="h-full w-full object-cover" />
    </a>
  );
}

export function Attachments({
  workItemId,
  attachments,
  canUpload,
  onChanged,
}: {
  workItemId: string;
  attachments: AttachmentDto[];
  canUpload: boolean;
  onChanged: () => Promise<unknown>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_ATTACHMENT_BYTES) {
          toast.error(`${file.name} is larger than 10 MB`);
          continue;
        }
        try {
          await api.post(`/work-items/${workItemId}/attachments`, file, {
            headers: {
              'Content-Type': 'application/octet-stream',
              'X-File-Name': encodeURIComponent(file.name),
            },
          });
        } catch (err) {
          toast.error(`${file.name}: ${getErrorMessage(err)}`);
        }
      }
      await onChanged();
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      onDragOver={(e) => canUpload && e.preventDefault()}
      onDrop={(e) => {
        if (!canUpload) return;
        e.preventDefault();
        void upload(e.dataTransfer.files);
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Paperclip className="h-4 w-4 text-slate-400" /> Attachments{' '}
          <span className="font-normal text-slate-400">{attachments.length}</span>
        </h3>
        {canUpload && (
          <>
            <input
              ref={input}
              type="file"
              multiple
              className="hidden"
              accept={Object.keys(ATTACHMENT_TYPES)
                .map((e) => `.${e}`)
                .join(',')}
              onChange={(e) => {
                void upload(e.target.files);
                e.target.value = '';
              }}
            />
            <Button
              size="sm"
              variant="outline"
              loading={uploading}
              onClick={() => input.current?.click()}
            >
              Add files
            </Button>
          </>
        )}
      </div>
      {!attachments.length ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500 dark:border-slate-700">
          {canUpload
            ? 'Drop screenshots, logs or documents here (max 10 MB each).'
            : 'No attachments.'}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex gap-3 rounded-lg border border-slate-200 p-2 dark:border-slate-800"
            >
              <div className="flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
                <Thumb a={a} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={a.fileName}>
                  {a.fileName}
                </p>
                <p className="text-xs text-slate-500">
                  {formatBytes(a.size)} · {a.uploadedBy?.name ?? 'Unknown'} · {timeAgo(a.createdAt)}
                </p>
                <div className="mt-1 flex gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      downloadFile(`/attachments/${a.id}`, { download: '1' }, a.fileName).catch(
                        (err) => toast.error(getErrorMessage(err)),
                      )
                    }
                    className="cursor-pointer rounded p-1 text-slate-400 hover:text-slate-700"
                    aria-label={`Download ${a.fileName}`}
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  {a.canDelete && (
                    <button
                      type="button"
                      className="cursor-pointer rounded p-1 text-slate-400 hover:text-red-600"
                      aria-label={`Delete ${a.fileName}`}
                      onClick={async () => {
                        if (!confirm(`Delete ${a.fileName}?`)) return;
                        try {
                          await api.delete(`/attachments/${a.id}`);
                          await onChanged();
                        } catch (err) {
                          toast.error(getErrorMessage(err));
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
