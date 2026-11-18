import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  DEPLOYMENT_STATUS_LABELS,
  DEPLOYMENT_STATUSES,
  ENVIRONMENT_TYPE_LABELS,
  ENVIRONMENT_TYPES,
  environmentSchema,
  type EnvironmentDto,
  type EnvironmentType,
} from '@tracker/shared';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { api, getErrorMessage } from '@/lib/api';
import { projectKeys } from './api';

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  environment?: EnvironmentDto;
  usedTypes: EnvironmentType[];
}

export function EnvironmentDialog({ open, onClose, ...rest }: Props) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={rest.environment ? 'Edit environment' : 'Add environment'}
    >
      {open && <EnvironmentForm {...rest} onDone={onClose} />}
    </Dialog>
  );
}

function EnvironmentForm({
  projectId,
  environment,
  usedTypes,
  onDone,
}: Omit<Props, 'open' | 'onClose'> & { onDone: () => void }) {
  const qc = useQueryClient();
  const freeTypes = ENVIRONMENT_TYPES.filter(
    (t) => t === environment?.type || !usedTypes.includes(t),
  );
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(environmentSchema),
    defaultValues: {
      type: environment?.type ?? freeTypes[0] ?? 'DEV',
      displayName: environment?.displayName ?? '',
      url: environment?.url ?? '',
      status: environment?.status ?? 'NOT_DEPLOYED',
      deployedAt: environment?.deployedAt ?? '',
      notes: environment?.notes ?? '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (environment) await api.patch(`/environments/${environment.id}`, values);
      else await api.post(`/projects/${projectId}/environments`, values);
      toast.success(environment ? 'Environment updated' : 'Environment added');
      await qc.invalidateQueries({ queryKey: projectKeys.all });
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Environment">
          {(id) => (
            <Select id={id} {...register('type')}>
              {freeTypes.map((t) => (
                <option key={t} value={t}>
                  {ENVIRONMENT_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Deployment status">
          {(id) => (
            <Select id={id} {...register('status')}>
              {DEPLOYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {DEPLOYMENT_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field label="URL" error={errors.url?.message}>
        {(id, d) => (
          <Input
            id={id}
            type="url"
            placeholder="https://app.example.com"
            aria-invalid={!!errors.url}
            aria-describedby={d}
            {...register('url')}
          />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Display name" error={errors.displayName?.message}>
          {(id, d) => (
            <Input
              id={id}
              placeholder="e.g. MailAI – Email Intake"
              aria-describedby={d}
              {...register('displayName')}
            />
          )}
        </Field>
        <Field label="Deployed on" error={errors.deployedAt?.message}>
          {(id, d) => (
            <Input id={id} type="date" aria-describedby={d} {...register('deployedAt')} />
          )}
        </Field>
      </div>
      <Field label="Notes" error={errors.notes?.message}>
        {(id, d) => (
          <Textarea
            id={id}
            rows={2}
            placeholder="Server, version, release notes…"
            aria-describedby={d}
            {...register('notes')}
          />
        )}
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {environment ? 'Save' : 'Add environment'}
        </Button>
      </div>
    </form>
  );
}
