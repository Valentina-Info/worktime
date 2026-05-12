'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import AppShell from '@/components/AppShell';
import ActionButton from '@/components/ActionButton';
import { can } from '@/lib/access-control';

type Status = 'ACTIVE' | 'ARCHIVED';

type Project = {
  id: string;
  name: string;
  status: Status;
  client: {
    id: string;
    name: string;
    currency: string;
  };
};

type Activity = {
  id: string;
  name: string;
  projectId: string | null;
  rate: number | null;
  status: Status;
  project: {
    id: string;
    name: string;
    client: {
      id: string;
      name: string;
      currency: string;
    };
  } | null;
  _count: {
    timeEntries: number;
  };
};

type ActivityForm = {
  name: string;
  projectId: string;
  rate: string;
  status: Status;
};

const emptyForm: ActivityForm = {
  name: '',
  projectId: '',
  rate: '',
  status: 'ACTIVE',
};

function activityToForm(activity: Activity): ActivityForm {
  return {
    name: activity.name,
    projectId: activity.projectId ?? '',
    rate: activity.rate?.toString() ?? '',
    status: activity.status,
  };
}

function formToPayload(form: ActivityForm) {
  return {
    name: form.name,
    projectId: form.projectId || null,
    rate: form.rate ? Number(form.rate) : null,
    status: form.status,
  };
}

export default function ActivitiesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [form, setForm] = useState<ActivityForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const canViewDirectories = can(session?.user?.role, 'directories.view');
  const canEditDirectories = can(session?.user?.role, 'directories.edit');
  const canDeleteDirectories = can(session?.user?.role, 'directories.delete');

  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    if (!session) {
      router.push('/auth/signin');
    }
  }, [router, session, status]);

  useEffect(() => {
    if (!session) {
      return;
    }

    async function loadActivities() {
      const response = await fetch('/api/activities');

      if (!response.ok) {
        setError('Не удалось загрузить активности');
        return;
      }

      const data = await response.json();
      setProjects(data.projects);
      setActivities(data.activities);
    }

    loadActivities().catch(() => setError('Не удалось загрузить активности'));
  }, [session]);

  const activeProjects = useMemo(() => projects.filter((project) => project.status === 'ACTIVE'), [projects]);
  const activeActivities = useMemo(
    () => activities.filter((activity) => activity.status === 'ACTIVE').length,
    [activities],
  );
  const globalActivities = useMemo(
    () => activities.filter((activity) => activity.projectId === null).length,
    [activities],
  );
  const projectActivities = activities.length - globalActivities;
  const visibleActivities = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return activities;
    }

    return activities.filter((activity) =>
      [
        activity.name,
        activity.project?.name,
        activity.project?.client.name,
        activity.project ? 'проектная' : 'общая',
        activity.status === 'ACTIVE' ? 'активная' : 'архивная',
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query)),
    );
  }, [activities, searchQuery]);

  function updateForm(field: keyof ActivityForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startEdit(activity: Activity) {
    setEditingId(activity.id);
    setForm(activityToForm(activity));
    setError('');
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
  }

  async function saveActivity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError('');

    const response = await fetch(editingId ? `/api/activities/${editingId}` : '/api/activities', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formToPayload(form)),
    });

    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? 'Не удалось сохранить активность');
      return;
    }

    const data = await response.json();
    setActivities((current) => {
      if (editingId) {
        return current.map((activity) => (activity.id === editingId ? data.activity : activity));
      }

      return [data.activity, ...current];
    });
    resetForm();
  }

  async function toggleArchive(activity: Activity) {
    const nextStatus = activity.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';
    setIsSaving(true);
    setError('');

    const response = await fetch(`/api/activities/${activity.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formToPayload(activityToForm(activity)),
        status: nextStatus,
      }),
    });

    setIsSaving(false);

    if (!response.ok) {
      setError('Не удалось изменить статус активности');
      return;
    }

    const data = await response.json();
    setActivities((current) => current.map((item) => (item.id === activity.id ? data.activity : item)));
  }

  async function deleteActivity(activity: Activity) {
    if (!window.confirm(`Удалить активность "${activity.name}"?`)) {
      return;
    }

    setIsSaving(true);
    setError('');

    const response = await fetch(`/api/activities/${activity.id}`, { method: 'DELETE' });

    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? 'Не удалось удалить активность');
      return;
    }

    setActivities((current) => current.filter((item) => item.id !== activity.id));
  }

  if (status === 'loading' || !session) {
    return <div className="flex min-h-screen items-center justify-center">Загрузка...</div>;
  }

  if (!canViewDirectories) {
    return (
      <AppShell
        eyebrow="Справочник"
        subtitle="Ваша роль не дает доступа к справочнику активностей."
        title="Активности"
        userEmail={session.user?.email}
        userRole={session.user?.role}
      >
        <div className="rounded-lg border border-red-100 bg-red-50 p-5 text-sm text-red-700">
          У вас нет прав на просмотр этой формы.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      eyebrow="Справочник"
      subtitle="Создавайте общие виды работ или активности для конкретных проектов с отдельными ставками."
      title="Активности"
      userEmail={session.user?.email}
      userRole={session.user?.role}
    >
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <section className="grid gap-4 sm:grid-cols-4">
        <div className="ui-card ui-card-compact">
          <div className="text-sm font-medium text-slate-500">Всего</div>
          <div className="mt-2 text-2xl font-semibold">{activities.length}</div>
        </div>
        <div className="ui-card ui-card-compact">
          <div className="text-sm font-medium text-slate-500">Активные</div>
          <div className="mt-2 text-2xl font-semibold">{activeActivities}</div>
        </div>
        <div className="ui-card ui-card-compact">
          <div className="text-sm font-medium text-slate-500">Общие</div>
          <div className="mt-2 text-2xl font-semibold">{globalActivities}</div>
        </div>
        <div className="ui-card ui-card-compact">
          <div className="text-sm font-medium text-slate-500">Проектные</div>
          <div className="mt-2 text-2xl font-semibold">{projectActivities}</div>
        </div>
      </section>

      {canEditDirectories && (
      <form className="ui-card ui-card-section" onSubmit={saveActivity}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">{editingId ? 'Редактировать активность' : 'Новая активность'}</h2>
          {editingId && (
            <button className="text-sm font-medium text-slate-600" type="button" onClick={resetForm}>
              Отменить редактирование
            </button>
          )}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-4">
          <label className="grid gap-1 text-sm font-medium">
            Название
            <input
              className="rounded-md border border-slate-300 px-3 py-2"
              placeholder="Разработка"
              required
              value={form.name}
              onChange={(event) => updateForm('name', event.target.value)}
            />
          </label>

          <label className="grid gap-1 text-sm font-medium">
            Проект
            <select
              className="rounded-md border border-slate-300 px-3 py-2"
              value={form.projectId}
              onChange={(event) => updateForm('projectId', event.target.value)}
            >
              <option value="">Общая активность</option>
              {(activeProjects.length ? activeProjects : projects).map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} · {project.client.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm font-medium">
            Ставка
            <input
              className="rounded-md border border-slate-300 px-3 py-2"
              min="0"
              step="0.01"
              type="number"
              value={form.rate}
              onChange={(event) => updateForm('rate', event.target.value)}
            />
          </label>

          <label className="grid gap-1 text-sm font-medium">
            Статус
            <select
              className="rounded-md border border-slate-300 px-3 py-2"
              value={form.status}
              onChange={(event) => updateForm('status', event.target.value)}
            >
              <option value="ACTIVE">Активная</option>
              <option value="ARCHIVED">Архивная</option>
            </select>
          </label>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            className="btn-primary px-4 py-2 disabled:opacity-60"
            disabled={isSaving}
            type="submit"
          >
            {editingId ? 'Сохранить активность' : 'Создать активность'}
          </button>
        </div>
      </form>
      )}

      <section className="ui-card">
        <div className="ui-card-header flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-lg font-semibold">Список активностей</h2>
          <label className="w-full max-w-sm">
            <span className="sr-only">Поиск активностей</span>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Поиск по активностям"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-left text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-5 py-3 font-medium">Название</th>
                <th className="px-5 py-3 font-medium">Область</th>
                <th className="px-5 py-3 font-medium">Ставка</th>
                <th className="px-5 py-3 font-medium">Использование</th>
                <th className="px-5 py-3 font-medium">Статус</th>
                <th className="px-5 py-3 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {visibleActivities.map((activity) => (
                <tr key={activity.id} className="border-t border-slate-100">
                  <td className="px-5 py-3 font-medium">{activity.name}</td>
                  <td className="px-5 py-3">
                    {activity.project ? (
                      <div>
                        <div>{activity.project.name}</div>
                        <div className="text-slate-500">{activity.project.client.name}</div>
                      </div>
                    ) : (
                      <span className="rounded-full bg-[var(--brand-cyan-soft)] px-2 py-1 text-xs font-medium text-cyan-800">
                        Общая
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {activity.rate === null
                      ? '-'
                      : `${activity.rate} ${activity.project?.client.currency ?? 'в час'}`}
                  </td>
                  <td className="px-5 py-3">{activity._count.timeEntries} записей</td>
                  <td className="px-5 py-3">
                    <span
                      className={
                        activity.status === 'ACTIVE'
                          ? 'rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700'
                          : 'rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600'
                      }
                    >
                      {activity.status === 'ACTIVE' ? 'Активная' : 'Архивная'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      <ActionButton icon="edit" label="Изменить" onClick={() => startEdit(activity)} tone="primary" />
                      <ActionButton
                        disabled={isSaving}
                        icon={activity.status === 'ACTIVE' ? 'archive' : 'restore'}
                        label={activity.status === 'ACTIVE' ? 'В архив' : 'Восстановить'}
                        onClick={() => toggleArchive(activity)}
                      />
                      {canDeleteDirectories && (
                        <ActionButton
                          disabled={isSaving}
                          icon="trash"
                          label="Удалить"
                          onClick={() => deleteActivity(activity)}
                          tone="danger"
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!visibleActivities.length && (
                <tr>
                  <td className="px-5 py-8 text-center text-slate-500" colSpan={6}>
                    {searchQuery ? 'Активности не найдены.' : 'Активностей пока нет.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
