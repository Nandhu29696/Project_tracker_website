import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { CategoryDto } from '@tracker/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form';
import { Badge, Card, CardHeader, Spinner } from '@/components/ui/misc';
import { useCategories } from '@/features/projects/api';
import { api, getErrorMessage } from '@/lib/api';

function CategoryRow({ c, onChanged }: { c: CategoryDto; onChanged: () => Promise<void> }) {
  const [name, setName] = useState(c.name);
  const [busy, setBusy] = useState(false);

  const save = async (data: Partial<CategoryDto>, ok: string) => {
    setBusy(true);
    try {
      await api.patch(`/categories/${c.id}`, data);
      toast.success(ok);
      await onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
      setName(c.name);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3">
      <input
        type="color"
        value={c.color}
        aria-label={`Colour for ${c.name}`}
        onChange={(e) => save({ color: e.target.value }, 'Colour updated')}
        className="h-8 w-8 cursor-pointer rounded border border-slate-200 bg-transparent dark:border-slate-700"
      />
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() !== c.name && save({ name: name.trim() }, 'Category renamed')}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        aria-label="Category name"
        className="h-9 max-w-xs flex-1"
      />
      <span className="text-xs text-slate-500">{c.projectCount ?? 0} projects</span>
      {!c.isActive && <Badge>Inactive</Badge>}
      <div className="ml-auto flex gap-2">
        <Button
          size="sm"
          variant="outline"
          loading={busy}
          onClick={() =>
            save(
              { isActive: !c.isActive },
              c.isActive ? 'Category deactivated' : 'Category activated',
            )
          }
        >
          {c.isActive ? 'Deactivate' : 'Activate'}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="text-red-600"
          aria-label={`Delete ${c.name}`}
          disabled={(c.projectCount ?? 0) > 0}
          title={(c.projectCount ?? 0) > 0 ? 'In use - deactivate instead' : 'Delete'}
          onClick={async () => {
            if (!confirm(`Delete category "${c.name}"?`)) return;
            try {
              await api.delete(`/categories/${c.id}`);
              toast.success('Category deleted');
              await onChanged();
            } catch (err) {
              toast.error(getErrorMessage(err));
            }
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}

export function CategoriesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useCategories(true);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#2563eb');
  const [adding, setAdding] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ['categories'] });

  const add = async () => {
    if (name.trim().length < 2) return toast.error('Name must be at least 2 characters');
    setAdding(true);
    try {
      await api.post('/categories', { name: name.trim(), color });
      setName('');
      toast.success('Category added');
      await refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Group projects by type. Deactivated categories stay on existing projects.
        </p>
      </div>
      <Card>
        <CardHeader title="Project categories" />
        <form
          className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            aria-label="New category colour"
            className="h-9 w-9 cursor-pointer rounded border border-slate-200 bg-transparent dark:border-slate-700"
          />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New category name"
            aria-label="New category name"
            className="h-9 max-w-xs flex-1"
            maxLength={50}
          />
          <Button type="submit" size="sm" loading={adding}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </form>
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Spinner />
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {(data ?? []).map((c) => (
              <CategoryRow key={`${c.id}-${c.name}`} c={c} onChanged={refresh} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
