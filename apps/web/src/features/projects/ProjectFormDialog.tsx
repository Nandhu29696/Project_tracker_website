import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  createProjectSchema,
  DEV_STATUS_LABELS,
  DEV_STATUSES,
  PRIORITIES,
  PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUSES,
  type ProjectDetail,
} from '@tracker/shared';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { api, getErrorMessage } from '@/lib/api';
import { projectKeys, useCategories } from './api';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Edit mode when given. */
  project?: ProjectDetail;
}

export function ProjectFormDialog({ open, onClose, project }: Props) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={project ? `Edit ${project.key}` : 'New project'}
      description={project ? undefined : 'You become the project owner and project manager.'}
    >
      {/* remount the form each time the dialog opens so it shows fresh values */}
      {open && <ProjectForm project={project} onDone={onClose} />}
    </Dialog>
  );
}

function ProjectForm({ project, onDone }: { project?: ProjectDetail; onDone: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const categories = useCategories();
  const isEdit = !!project;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: project?.name ?? '',
      key: '',
      description: project?.description ?? '',
      categoryId: project?.category?.id ?? '',
      priority: project?.priority ?? 'MEDIUM',
      status: project?.status ?? 'ACTIVE',
      devStatus: project?.devStatus ?? 'NOT_STARTED',
      startDate: project?.startDate ?? '',
      targetDate: project?.targetDate ?? '',
    },
  });

  const onSubmit = handleSubmit(async ({ key, ...values }) => {
    try {
      if (isEdit) {
        await api.patch(`/projects/${project.id}`, values);
        toast.success('Project updated');
      } else {
        const res = await api.post<{ data: ProjectDetail }>('/projects', { ...values, key });
        toast.success(`Project ${res.data.data.key} created`);
        navigate(`/projects/${res.data.data.id}`);
      }
      await qc.invalidateQueries({ queryKey: projectKeys.all });
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  });

  // inactive categories stay selectable for projects that already use them
  const categoryOptions = (categories.data ?? []).filter(
    (c) => c.isActive || c.id === project?.category?.id,
  );

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <Field label="Project name" error={errors.name?.message}>
          {(id, d) => (
            <Input
              id={id}
              autoFocus
              aria-invalid={!!errors.name}
              aria-describedby={d}
              {...register('name')}
            />
          )}
        </Field>
        {isEdit ? (
          <Field label="Key" hint="Keys can't change">
            {(id) => <Input id={id} value={project.key} disabled readOnly />}
          </Field>
        ) : (
          <Field label="Key" error={errors.key?.message} hint="Blank = auto">
            {(id, d) => (
              <Input
                id={id}
                placeholder="e.g. BCM"
                className="uppercase"
                maxLength={10}
                aria-invalid={!!errors.key}
                aria-describedby={d}
                {...register('key')}
              />
            )}
          </Field>
        )}
      </div>

      <Field label="Description" error={errors.description?.message}>
        {(id, d) => <Textarea id={id} rows={3} aria-describedby={d} {...register('description')} />}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category">
          {(id) => (
            <Select id={id} {...register('categoryId')}>
              <option value="">No category</option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Priority">
          {(id) => (
            <Select id={id} {...register('priority')}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Status">
          {(id) => (
            <Select id={id} {...register('status')}>
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PROJECT_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Development status">
          {(id) => (
            <Select id={id} {...register('devStatus')}>
              {DEV_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {DEV_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Start date" error={errors.startDate?.message}>
          {(id, d) => <Input id={id} type="date" aria-describedby={d} {...register('startDate')} />}
        </Field>
        <Field label="Target end date" error={errors.targetDate?.message}>
          {(id, d) => (
            <Input
              id={id}
              type="date"
              aria-invalid={!!errors.targetDate}
              aria-describedby={d}
              {...register('targetDate')}
            />
          )}
        </Field>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {isEdit ? 'Save changes' : 'Create project'}
        </Button>
      </div>
    </form>
  );
}
