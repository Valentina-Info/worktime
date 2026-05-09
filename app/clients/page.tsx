'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import AppShell from '@/components/AppShell';

type Client = {
  id: string;
  name: string;
  contact: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  currency: string;
  status: 'ACTIVE' | 'ARCHIVED';
  _count: {
    projects: number;
    expenses: number;
    invoices: number;
  };
};

type ClientForm = {
  name: string;
  email: string;
  phone: string;
  address: string;
  currency: string;
  status: 'ACTIVE' | 'ARCHIVED';
};

const emptyForm: ClientForm = {
  name: '',
  email: '',
  phone: '',
  address: '',
  currency: 'USD',
  status: 'ACTIVE',
};

function clientToForm(client: Client): ClientForm {
  return {
    name: client.name,
    email: client.email ?? '',
    phone: client.phone ?? '',
    address: client.address ?? '',
    currency: client.currency,
    status: client.status,
  };
}

function formToPayload(form: ClientForm) {
  return {
    name: form.name,
    email: form.email,
    phone: form.phone,
    address: form.address,
    currency: form.currency,
    status: form.status,
  };
}

export default function ClientsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState<ClientForm>(emptyForm);
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

    async function loadClients() {
      const response = await fetch('/api/clients');

      if (!response.ok) {
        setError('Failed to load clients');
        return;
      }

      const data = await response.json();
      setClients(data.clients);
    }

    loadClients().catch(() => setError('Failed to load clients'));
  }, [session]);

  const activeClients = useMemo(() => clients.filter((client) => client.status === 'ACTIVE').length, [clients]);
  const archivedClients = clients.length - activeClients;
  const projectCount = useMemo(
    () => clients.reduce((sum, client) => sum + client._count.projects, 0),
    [clients],
  );

  function updateForm(field: keyof ClientForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startEdit(client: Client) {
    setEditingId(client.id);
    setForm(clientToForm(client));
    setError('');
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
  }

  async function saveClient(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError('');

    const response = await fetch(editingId ? `/api/clients/${editingId}` : '/api/clients', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formToPayload(form)),
    });

    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? 'Failed to save client');
      return;
    }

    const data = await response.json();
    setClients((current) => {
      if (editingId) {
        return current.map((client) => (client.id === editingId ? data.client : client));
      }

      return [data.client, ...current];
    });
    resetForm();
  }

  async function toggleArchive(client: Client) {
    const nextStatus = client.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';
    setIsSaving(true);
    setError('');

    const response = await fetch(`/api/clients/${client.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formToPayload(clientToForm(client)),
        status: nextStatus,
      }),
    });

    setIsSaving(false);

    if (!response.ok) {
      setError('Failed to update client status');
      return;
    }

    const data = await response.json();
    setClients((current) => current.map((item) => (item.id === client.id ? data.client : item)));
  }

  if (status === 'loading' || !session) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <AppShell
      eyebrow="Directory"
      subtitle="Manage client records, billing currency, status, and contact details."
      title="Clients"
      userEmail={session.user?.email}
    >

        {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <section className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">Total</div>
            <div className="mt-1 text-2xl font-semibold">{clients.length}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">Active</div>
            <div className="mt-1 text-2xl font-semibold">{activeClients}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">Archived</div>
            <div className="mt-1 text-2xl font-semibold">{archivedClients}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">Projects</div>
            <div className="mt-1 text-2xl font-semibold">{projectCount}</div>
          </div>
        </section>

        <form className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" onSubmit={saveClient}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold">{editingId ? 'Edit client' : 'New client'}</h2>
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
              Email
              <input
                className="rounded-md border border-slate-300 px-3 py-2"
                placeholder="client@example.com"
                type="email"
                value={form.email}
                onChange={(event) => updateForm('email', event.target.value)}
              />
            </label>

            <label className="grid gap-1 text-sm font-medium">
              Phone
              <input
                className="rounded-md border border-slate-300 px-3 py-2"
                placeholder="+1 555 0100"
                type="tel"
                value={form.phone}
                onChange={(event) => updateForm('phone', event.target.value)}
              />
            </label>

            <label className="grid gap-1 text-sm font-medium">
              Currency
              <input
                className="rounded-md border border-slate-300 px-3 py-2 uppercase"
                maxLength={8}
                value={form.currency}
                onChange={(event) => updateForm('currency', event.target.value.toUpperCase())}
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

            <label className="grid gap-1 text-sm font-medium">
              Address
              <textarea
                className="min-h-24 rounded-md border border-slate-300 px-3 py-2"
                value={form.address}
                onChange={(event) => updateForm('address', event.target.value)}
              />
            </label>
          </div>

          <div className="mt-5 flex justify-end">
            <button className="rounded-md bg-[var(--brand-blue)] px-4 py-2 font-medium text-white shadow-sm transition hover:bg-[var(--brand-blue-dark)] disabled:opacity-60" disabled={isSaving} type="submit">
              {editingId ? 'Save client' : 'Create client'}
            </button>
          </div>
        </form>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold">Client list</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Phone</th>
                  <th className="px-5 py-3 font-medium">Currency</th>
                  <th className="px-5 py-3 font-medium">Usage</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id} className="border-t border-slate-100">
                    <td className="px-5 py-3">
                      <div className="font-medium">{client.name}</div>
                      <div className="mt-1 max-w-md truncate text-slate-500">{client.address || '-'}</div>
                    </td>
                    <td className="px-5 py-3">{client.email || '-'}</td>
                    <td className="px-5 py-3">{client.phone || '-'}</td>
                    <td className="px-5 py-3">{client.currency}</td>
                    <td className="px-5 py-3">
                      <div>{client._count.projects} projects</div>
                      <div className="text-slate-500">
                        {client._count.expenses} expenses, {client._count.invoices} invoices
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={
                          client.status === 'ACTIVE'
                            ? 'rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700'
                            : 'rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600'
                        }
                      >
                        {client.status === 'ACTIVE' ? 'Active' : 'Archived'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <button className="rounded-md border border-slate-300 px-3 py-1.5 font-medium" type="button" onClick={() => startEdit(client)}>
                          Edit
                        </button>
                        <button
                          className="rounded-md border border-slate-300 px-3 py-1.5 font-medium"
                          disabled={isSaving}
                          type="button"
                          onClick={() => toggleArchive(client)}
                        >
                          {client.status === 'ACTIVE' ? 'Archive' : 'Restore'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!clients.length && (
                  <tr>
                    <td className="px-5 py-8 text-center text-slate-500" colSpan={7}>
                      No clients yet.
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
