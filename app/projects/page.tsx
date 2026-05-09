'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import AppShell from '@/components/AppShell';

type Client = {
  id: string;
  name: string;
  currency: string;
  status: 'ACTIVE' | 'ARCHIVED';
};

type Project = {
  id: string;
  name: string;
  clientId: string;
  description: string | null;
  budgetHours: number | null;
  budgetMoney: number | null;
  rate: number | null;
  status: 'ACTIVE' | 'ARCHIVED';
  client: {
    id: string;
    name: string;
    currency: string;
  };
  _count: {
    activities: number;
    timeEntries: number;
    users: number;
  };
};

type ProjectForm = {
  name: string;
  clientId: string;
  description: string;
  budgetHours: string;
  budgetMoney: string;
  rate: string;
  status: 'ACTIVE' | 'ARCHIVED';
};

const emptyForm: ProjectForm = {
  name: '',
  clientId: '',
  description: '',
  budgetHours: '',
  budgetMoney: '',
  rate: '',
  status: 'ACTIVE',
};

function projectToForm(project: Project): ProjectForm {
  return {
    name: project.name,
    clientId: project.clientId,
    description: project.description ?? '',
    budgetHours: project.budgetHours?.toString() ?? '',
    budgetMoney: project.budgetMoney?.toString() ?? '',
    rate: project.rate?.toString() ?? '',
    status: project.status,
  };
}

function formToPayload(form: ProjectForm) {
  return {
    name: form.name,
    clientId: form.clientId,
    description: form.description,
    budgetHours: form.budgetHours ? Number(form.budgetHours) : null,
    budgetMoney: form.budgetMoney ? Number(form.budgetMoney) : null,
    rate: form.rate ? Number(form.rate) : null,
    status: form.status,
  };
}

export default function ProjectsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState<ProjectForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

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

    async function loadProjects() {
      const response = await fetch('/api/projects');

      if (!response.ok) {
        setError('Failed to load projects');
        return;
      }

      const data = await response.json();
      setClients(data.clients);
      setProjects(data.projects);
      setForm((current) => ({
        ...current,
        clientId: current.clientId || data.clients[0]?.id || '',
      }));
    }

    loadProjects().catch(() => setError('Failed to load projects'));
  }, [session]);

  const activeClients = useMemo(() => clients.filter((client) => client.status === 'ACTIVE'), [clients]);
  const activeProjects = useMemo(() => projects.filter((project) => project.status === 'ACTIVE').length, [projects]);
  const archivedProjects = projects.length - activeProjects;

  function updateForm(field: keyof ProjectForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startEdit(project: Project) {
    setEditingId(project.id);
    setForm(projectToForm(project));
    setError('');
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...emptyForm, clientId: activeClients[0]?.id || clients[0]?.id || '' });
    setError('');
  }

  async function saveProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError('');

    const response = await fetch(editingId ? `/api/projects/${editingId}` : '/api/projects', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formToPayload(form)),
    });

    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? 'Failed to save project');
      return;
    }

    const data = await response.json();
    setProjects((current) => {
      if (editingId) {
        return current.map((project) => (project.id === editingId ? data.project : project));
      }

      return [data.project, ...current];
    });
    resetForm();
  }

  async function toggleArchive(project: Project) {
    const nextStatus = project.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';
    setIsSaving(true);
    setError('');

    const response = await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formToPayload(projectToForm(project)),
        status: nextStatus,
      }),
    });

    setIsSaving(false);

    if (!response.ok) {
      setError('Failed to update project status');
      return;
    }

    const data = await response.json();
    setProjects((current) => current.map((item) => (item.id === project.id ? data.project : item)));
  }

  if (status === 'loading' || !session) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <AppShell
      eyebrow="Directory"
      subtitle="Keep project budgets, rates, activity usage, and archive state in one place."
      title="Projects"
      userEmail={session.user?.email}
    >

        {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">Total</div>
            <div className="mt-1 text-2xl font-semibold">{projects.length}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">Active</div>
            <div className="mt-1 text-2xl font-semibold">{activeProjects}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">Archived</div>
            <div className="mt-1 text-2xl font-semibold">{archivedProjects}</div>
          </div>
        </section>

        <form className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" onSubmit={saveProject}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold">{editingId ? 'Edit project' : 'New project'}</h2>
            {editingId && (
              <button className="text-sm font-medium text-slate-600" type="button" onClick={resetForm}>
                Cancel editing
              </button>
            )}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium">
              Name
              <input
                className="rounded-md border border-slate-300 px-3 py-2"
                required
                value={form.name}
                onChange={(event) => updateForm('name', event.target.value)}
              />
            </label>

            <label className="grid gap-1 text-sm font-medium">
              Client
              <select
                className="rounded-md border border-slate-300 px-3 py-2"
                required
                value={form.clientId}
                onChange={(event) => updateForm('clientId', event.target.value)}
              >
                {(activeClients.length ? activeClients : clients).map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm font-medium">
              Rate
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
              Budget hours
              <input
                className="rounded-md border border-slate-300 px-3 py-2"
                min="0"
                step="0.25"
                type="number"
                value={form.budgetHours}
                onChange={(event) => updateForm('budgetHours', event.target.value)}
              />
            </label>

            <label className="grid gap-1 text-sm font-medium">
              Budget money
              <input
                className="rounded-md border border-slate-300 px-3 py-2"
                min="0"
                step="0.01"
                type="number"
                value={form.budgetMoney}
                onChange={(event) => updateForm('budgetMoney', event.target.value)}
              />
            </label>

            <label className="grid gap-1 text-sm font-medium">
              Status
              <select
                className="rounded-md border border-slate-300 px-3 py-2"
                value={form.status}
                onChange={(event) => updateForm('status', event.target.value)}
              >
                <option value="ACTIVE">Active</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </label>

            <label className="grid gap-1 text-sm font-medium lg:col-span-2">
              Description
              <textarea
                className="min-h-24 rounded-md border border-slate-300 px-3 py-2"
                value={form.description}
                onChange={(event) => updateForm('description', event.target.value)}
              />
            </label>
          </div>

          <div className="mt-5 flex justify-end">
            <button className="rounded-md bg-[var(--brand-blue)] px-4 py-2 font-medium text-white shadow-sm transition hover:bg-[var(--brand-blue-dark)] disabled:opacity-60" disabled={isSaving} type="submit">
              {editingId ? 'Save project' : 'Create project'}
            </button>
          </div>
        </form>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold">Project list</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Client</th>
                  <th className="px-5 py-3 font-medium">Rate</th>
                  <th className="px-5 py-3 font-medium">Budget</th>
                  <th className="px-5 py-3 font-medium">Usage</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id} className="border-t border-slate-100">
                    <td className="px-5 py-3">
                      <div className="font-medium">{project.name}</div>
                      <div className="mt-1 max-w-md truncate text-slate-500">{project.description || '-'}</div>
                    </td>
                    <td className="px-5 py-3">{project.client.name}</td>
                    <td className="px-5 py-3">{project.rate === null ? '-' : `${project.rate} ${project.client.currency}/h`}</td>
                    <td className="px-5 py-3">
                      <div>{project.budgetHours === null ? '-' : `${project.budgetHours}h`}</div>
                      <div className="text-slate-500">
                        {project.budgetMoney === null ? '-' : `${project.budgetMoney} ${project.client.currency}`}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div>{project._count.timeEntries} entries</div>
                      <div className="text-slate-500">{project._count.activities} activities</div>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={
                          project.status === 'ACTIVE'
                            ? 'rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700'
                            : 'rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600'
                        }
                      >
                        {project.status === 'ACTIVE' ? 'Active' : 'Archived'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <button className="rounded-md border border-slate-300 px-3 py-1.5 font-medium" type="button" onClick={() => startEdit(project)}>
                          Edit
                        </button>
                        <button
                          className="rounded-md border border-slate-300 px-3 py-1.5 font-medium"
                          disabled={isSaving}
                          type="button"
                          onClick={() => toggleArchive(project)}
                        >
                          {project.status === 'ACTIVE' ? 'Archive' : 'Restore'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!projects.length && (
                  <tr>
                    <td className="px-5 py-8 text-center text-slate-500" colSpan={7}>
                      No projects yet.
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
