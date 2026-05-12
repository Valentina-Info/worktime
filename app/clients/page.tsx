'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import AppShell from '@/components/AppShell';
import ActionButton from '@/components/ActionButton';
import { can } from '@/lib/access-control';

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

    async function loadClients() {
      const response = await fetch('/api/clients');

      if (!response.ok) {
        setError('Не удалось загрузить клиентов');
        return;
      }

      const data = await response.json();
      setClients(data.clients);
    }

    loadClients().catch(() => setError('Не удалось загрузить клиентов'));
  }, [session]);

  const activeClients = useMemo(() => clients.filter((client) => client.status === 'ACTIVE').length, [clients]);
  const archivedClients = clients.length - activeClients;
  const projectCount = useMemo(
    () => clients.reduce((sum, client) => sum + client._count.projects, 0),
    [clients],
  );
  const visibleClients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return clients;
    }

    return clients.filter((client) =>
      [
        client.name,
        client.email,
        client.phone,
        client.address,
        client.currency,
        client.status === 'ACTIVE' ? 'активный' : 'архивный',
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query)),
    );
  }, [clients, searchQuery]);

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
      setError(data?.error ?? 'Не удалось сохранить клиента');
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
      setError('Не удалось изменить статус клиента');
      return;
    }

    const data = await response.json();
    setClients((current) => current.map((item) => (item.id === client.id ? data.client : item)));
  }

  async function deleteClient(client: Client) {
    if (!window.confirm(`Удалить клиента "${client.name}"?`)) {
      return;
    }

    setIsSaving(true);
    setError('');

    const response = await fetch(`/api/clients/${client.id}`, { method: 'DELETE' });

    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? 'Не удалось удалить клиента');
      return;
    }

    setClients((current) => current.filter((item) => item.id !== client.id));
  }

  if (status === 'loading' || !session) {
    return <div className="flex min-h-screen items-center justify-center">Загрузка...</div>;
  }

  if (!canViewDirectories) {
    return (
      <AppShell
        eyebrow="Справочник"
        subtitle="Ваша роль не дает доступа к справочнику клиентов."
        title="Клиенты"
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
      subtitle="Управляйте карточками клиентов, валютой расчетов, статусом и контактами."
      title="Клиенты"
      userEmail={session.user?.email}
      userRole={session.user?.role}
    >

        {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <section className="grid gap-4 sm:grid-cols-4">
          <div className="ui-card ui-card-compact">
            <div className="text-sm text-slate-500">Всего</div>
            <div className="mt-1 text-2xl font-semibold">{clients.length}</div>
          </div>
          <div className="ui-card ui-card-compact">
            <div className="text-sm text-slate-500">Активные</div>
            <div className="mt-1 text-2xl font-semibold">{activeClients}</div>
          </div>
          <div className="ui-card ui-card-compact">
            <div className="text-sm text-slate-500">Архивные</div>
            <div className="mt-1 text-2xl font-semibold">{archivedClients}</div>
          </div>
          <div className="ui-card ui-card-compact">
            <div className="text-sm text-slate-500">Проекты</div>
            <div className="mt-1 text-2xl font-semibold">{projectCount}</div>
          </div>
        </section>

        {canEditDirectories && (
        <form className="ui-card ui-card-section" onSubmit={saveClient}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold">{editingId ? 'Редактировать клиента' : 'Новый клиент'}</h2>
            {editingId && (
              <button className="text-sm font-medium text-slate-600" type="button" onClick={resetForm}>
                Отменить редактирование
              </button>
            )}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium">
              Название
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
              Телефон
              <input
                className="rounded-md border border-slate-300 px-3 py-2"
                placeholder="+1 555 0100"
                type="tel"
                value={form.phone}
                onChange={(event) => updateForm('phone', event.target.value)}
              />
            </label>

            <label className="grid gap-1 text-sm font-medium">
              Валюта
              <input
                className="rounded-md border border-slate-300 px-3 py-2 uppercase"
                maxLength={8}
                value={form.currency}
                onChange={(event) => updateForm('currency', event.target.value.toUpperCase())}
              />
            </label>

            <label className="grid gap-1 text-sm font-medium">
              Статус
              <select
                className="rounded-md border border-slate-300 px-3 py-2"
                value={form.status}
                onChange={(event) => updateForm('status', event.target.value)}
              >
                <option value="ACTIVE">Активный</option>
                <option value="ARCHIVED">Архивный</option>
              </select>
            </label>

            <label className="grid gap-1 text-sm font-medium">
              Адрес
              <textarea
                className="min-h-24 rounded-md border border-slate-300 px-3 py-2"
                value={form.address}
                onChange={(event) => updateForm('address', event.target.value)}
              />
            </label>
          </div>

          <div className="mt-5 flex justify-end">
            <button className="btn-primary px-4 py-2 disabled:opacity-60" disabled={isSaving} type="submit">
              {editingId ? 'Сохранить клиента' : 'Создать клиента'}
            </button>
          </div>
        </form>
        )}

        <section className="ui-card">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="text-lg font-semibold">Список клиентов</h2>
            <label className="w-full max-w-sm">
              <span className="sr-only">Поиск клиентов</span>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Поиск по клиентам"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] border-collapse text-left text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-5 py-3 font-medium">Название</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Телефон</th>
                  <th className="px-5 py-3 font-medium">Валюта</th>
                  <th className="px-5 py-3 font-medium">Использование</th>
                  <th className="px-5 py-3 font-medium">Статус</th>
                  <th className="px-5 py-3 font-medium">Действия</th>
                </tr>
              </thead>
              <tbody>
                {visibleClients.map((client) => (
                  <tr key={client.id} className="border-t border-slate-100">
                    <td className="px-5 py-3">
                      <div className="font-medium">{client.name}</div>
                      <div className="mt-1 max-w-md truncate text-slate-500">{client.address || '-'}</div>
                    </td>
                    <td className="px-5 py-3">{client.email || '-'}</td>
                    <td className="px-5 py-3">{client.phone || '-'}</td>
                    <td className="px-5 py-3">{client.currency}</td>
                    <td className="px-5 py-3">
                      <div>{client._count.projects} проектов</div>
                      <div className="text-slate-500">
                        {client._count.expenses} расходов, {client._count.invoices} счетов
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
                        {client.status === 'ACTIVE' ? 'Активный' : 'Архивный'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <ActionButton icon="edit" label="Изменить" onClick={() => startEdit(client)} tone="primary" />
                        <ActionButton
                          disabled={isSaving}
                          icon={client.status === 'ACTIVE' ? 'archive' : 'restore'}
                          label={client.status === 'ACTIVE' ? 'В архив' : 'Восстановить'}
                          onClick={() => toggleArchive(client)}
                        />
                        {canDeleteDirectories && (
                          <ActionButton
                            disabled={isSaving}
                            icon="trash"
                            label="Удалить"
                            onClick={() => deleteClient(client)}
                            tone="danger"
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!visibleClients.length && (
                  <tr>
                    <td className="px-5 py-8 text-center text-slate-500" colSpan={7}>
                      {searchQuery ? 'Клиенты не найдены.' : 'Клиентов пока нет.'}
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
