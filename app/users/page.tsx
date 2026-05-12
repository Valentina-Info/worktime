'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import AppShell from '@/components/AppShell';
import ActionButton from '@/components/ActionButton';
import { can, permissionLabels, rolePermissions } from '@/lib/access-control';

type Role = 'USER' | 'MANAGER' | 'ADMIN';

type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  positionId: string | null;
  position: {
    id: string;
    title: string;
    department: {
      id: string;
      name: string;
      organization: {
        id: string;
        name: string;
      };
    };
  } | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    assignedProjects: number;
    timeEntries: number;
  };
};

type UserForm = {
  name: string;
  email: string;
  password: string;
  role: Role;
  positionId: string;
};

type Position = {
  id: string;
  title: string;
  _count: {
    users: number;
  };
};

type Department = {
  id: string;
  name: string;
  positions: Position[];
};

type Organization = {
  id: string;
  name: string;
  inn: string;
  kpp: string;
  departments: Department[];
};

const roleOptions: Role[] = ['USER', 'MANAGER', 'ADMIN'];

const emptyForm: UserForm = {
  name: '',
  email: '',
  password: '',
  role: 'USER',
  positionId: '',
};

const roleLabels: Record<Role, string> = {
  USER: 'Пользователь',
  MANAGER: 'Менеджер',
  ADMIN: 'Администратор',
};

export default function UsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [organizationForm, setOrganizationForm] = useState({ name: '', inn: '', kpp: '' });
  const [departmentName, setDepartmentName] = useState('');
  const [positionForm, setPositionForm] = useState({ title: '', departmentId: '' });
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [drafts, setDrafts] = useState<Record<string, { name: string; role: Role; positionId: string; password: string }>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    if (!session) {
      router.push('/auth/signin');
    }
  }, [router, session, status]);

  useEffect(() => {
    if (!session || !can(session.user?.role, 'users.manage')) {
      return;
    }

    async function loadUsers() {
      const [usersResponse, organizationResponse] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/organization'),
      ]);

      if (!usersResponse.ok || !organizationResponse.ok) {
        setError('Не удалось загрузить пользователей');
        return;
      }

      const usersData = await usersResponse.json();
      const organizationData = await organizationResponse.json();

      setUsers(usersData.users);
      setOrganizations(organizationData.organizations ?? []);
      setOrganization(organizationData.organization ?? null);
      if (organizationData.organization) {
        setOrganizationForm({
          name: organizationData.organization.name,
          inn: organizationData.organization.inn,
          kpp: organizationData.organization.kpp,
        });
      }
      setDrafts(
        Object.fromEntries(
          usersData.users.map((user: User) => [
            user.id,
            { name: user.name, role: user.role, positionId: user.positionId ?? '', password: '' },
          ]),
        ),
      );
    }

    loadUsers().catch(() => setError('Не удалось загрузить пользователей'));
  }, [session]);

  const totals = useMemo(() => {
    return {
      admins: users.filter((user) => user.role === 'ADMIN').length,
      managers: users.filter((user) => user.role === 'MANAGER').length,
      users: users.filter((user) => user.role === 'USER').length,
    };
  }, [users]);

  const positions = useMemo(() => {
    return organization?.departments.flatMap((department) =>
      department.positions.map((position) => ({
        ...position,
        departmentId: department.id,
        departmentName: department.name,
      })),
    ) ?? [];
  }, [organization]);
  const visibleUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return users;
    }

    return users.filter((user) =>
      [
        user.name,
        user.email,
        roleLabels[user.role],
        user.position?.title,
        user.position?.department.name,
        user.position?.department.organization.name,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query)),
    );
  }, [searchQuery, users]);

  function updateForm(field: keyof UserForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateDraft(userId: string, field: 'name' | 'role' | 'positionId' | 'password', value: string) {
    setDrafts((current) => ({
      ...current,
      [userId]: {
        ...current[userId],
        [field]: value,
      },
    }));
  }

  async function saveOrganization(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError('');

    const response = await fetch('/api/organization', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: organization?.id,
        ...organizationForm,
      }),
    });

    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? 'Не удалось сохранить организацию');
      return;
    }

    const data = await response.json();
    setOrganization(data.organization);
    setOrganizations((current) => {
      const exists = current.some((item) => item.id === data.organization.id);
      const next = exists
        ? current.map((item) => (item.id === data.organization.id ? data.organization : item))
        : [...current, data.organization];

      return next.sort((a, b) => a.name.localeCompare(b.name));
    });
  }

  function selectOrganization(nextOrganization: Organization) {
    setOrganization(nextOrganization);
    setOrganizationForm({
      name: nextOrganization.name,
      inn: nextOrganization.inn,
      kpp: nextOrganization.kpp,
    });
    setDepartmentName('');
    setPositionForm({ title: '', departmentId: '' });
    setError('');
  }

  function startNewOrganization() {
    setOrganization(null);
    setOrganizationForm({ name: '', inn: '', kpp: '' });
    setDepartmentName('');
    setPositionForm({ title: '', departmentId: '' });
    setError('');
  }

  async function deleteOrganization(target: Organization) {
    if (!window.confirm(`Удалить организацию "${target.name}"?`)) {
      return;
    }

    setIsSaving(true);
    setError('');

    const response = await fetch(`/api/organization/${target.id}`, { method: 'DELETE' });

    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? 'Не удалось удалить организацию');
      return;
    }

    setOrganizations((current) => {
      const next = current.filter((item) => item.id !== target.id);
      const fallback = next[0] ?? null;
      setOrganization(fallback);
      setOrganizationForm(fallback ? { name: fallback.name, inn: fallback.inn, kpp: fallback.kpp } : { name: '', inn: '', kpp: '' });
      return next;
    });
  }

  async function createDepartment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!organization) {
      setError('Сначала создайте организацию');
      return;
    }

    setIsSaving(true);
    setError('');

    const response = await fetch('/api/departments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: departmentName,
        organizationId: organization.id,
      }),
    });

    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? 'Не удалось создать подразделение');
      return;
    }

    const data = await response.json();
    setOrganization((current) =>
      current ? { ...current, departments: [...current.departments, data.department].sort((a, b) => a.name.localeCompare(b.name)) } : current,
    );
    setDepartmentName('');
  }

  async function createPosition(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError('');

    const response = await fetch('/api/positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(positionForm),
    });

    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? 'Не удалось создать должность');
      return;
    }

    const data = await response.json();
    setOrganization((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        departments: current.departments.map((department) =>
          department.id === data.position.department.id
            ? {
                ...department,
                positions: [...department.positions, { id: data.position.id, title: data.position.title, _count: data.position._count }]
                  .sort((a, b) => a.title.localeCompare(b.title)),
              }
            : department,
        ),
      };
    });
    setPositionForm({ title: '', departmentId: positionForm.departmentId });
  }

  async function deleteDepartment(department: Department) {
    if (!window.confirm(`Удалить подразделение "${department.name}"?`)) {
      return;
    }

    setIsSaving(true);
    setError('');

    const response = await fetch(`/api/departments/${department.id}`, { method: 'DELETE' });

    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? 'Не удалось удалить подразделение');
      return;
    }

    setOrganization((current) =>
      current
        ? { ...current, departments: current.departments.filter((item) => item.id !== department.id) }
        : current,
    );
  }

  async function deletePosition(position: Position) {
    if (!window.confirm(`Удалить должность "${position.title}"?`)) {
      return;
    }

    setIsSaving(true);
    setError('');

    const response = await fetch(`/api/positions/${position.id}`, { method: 'DELETE' });

    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? 'Не удалось удалить должность');
      return;
    }

    setOrganization((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        departments: current.departments.map((department) => ({
          ...department,
          positions: department.positions.filter((item) => item.id !== position.id),
        })),
      };
    });
  }

  async function deleteUser(user: User) {
    if (!window.confirm(`Удалить пользователя "${user.name}"?`)) {
      return;
    }

    setIsSaving(true);
    setError('');

    const response = await fetch(`/api/users/${user.id}`, { method: 'DELETE' });

    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? 'Не удалось удалить пользователя');
      return;
    }

    setUsers((current) => current.filter((item) => item.id !== user.id));
    setDrafts((current) => {
      const next = { ...current };
      delete next[user.id];
      return next;
    });
  }

  async function createUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError('');

    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? 'Не удалось создать пользователя');
      return;
    }

    const data = await response.json();
    setUsers((current) => [data.user, ...current]);
    setDrafts((current) => ({
      ...current,
      [data.user.id]: { name: data.user.name, role: data.user.role, positionId: data.user.positionId ?? '', password: '' },
    }));
    setForm(emptyForm);
  }

  async function saveUser(user: User) {
    const draft = drafts[user.id];

    if (!draft) {
      return;
    }

    setIsSaving(true);
    setError('');

    const response = await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: draft.name,
        role: draft.role,
        positionId: draft.positionId || null,
        password: draft.password,
      }),
    });

    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? 'Не удалось обновить пользователя');
      return;
    }

    const data = await response.json();
    setUsers((current) => current.map((item) => (item.id === user.id ? data.user : item)));
    setDrafts((current) => ({
      ...current,
      [user.id]: { name: data.user.name, role: data.user.role, positionId: data.user.positionId ?? '', password: '' },
    }));
  }

  if (status === 'loading' || !session) {
    return <div className="flex min-h-screen items-center justify-center">Загрузка...</div>;
  }

  if (!can(session.user?.role, 'users.manage')) {
    return (
      <AppShell
        eyebrow="Администрирование"
        subtitle="Только администраторы могут регистрировать пользователей и менять права."
        title="Пользователи"
        userEmail={session.user?.email}
        userRole={session.user?.role}
      >
        <div className="rounded-lg border border-red-100 bg-red-50 p-5 text-sm text-red-700">
          У вас нет прав на управление пользователями.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      eyebrow="Администрирование"
      subtitle="Регистрируйте пользователей, назначайте роли и при необходимости обновляйте доступ."
      title="Пользователи"
      userEmail={session.user?.email}
      userRole={session.user?.role}
    >
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <section className="ui-card ui-card-section">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Организации</h2>
            <p className="mt-1 text-sm text-slate-500">Выберите организацию или создайте новую.</p>
          </div>
          <button
            className="btn-secondary px-4 py-2 text-sm"
            type="button"
            onClick={startNewOrganization}
          >
            Новая организация
          </button>
        </div>

        <div className="mt-5 grid gap-3">
          {organizations.map((item) => (
            <div
              className={
                item.id === organization?.id
                  ? 'state-active rounded-lg p-3'
                  : 'rounded-lg border border-slate-100 bg-slate-50 p-3'
              }
              key={item.id}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <button className="text-left" type="button" onClick={() => selectOrganization(item)}>
                  <div className="font-medium text-slate-950">{item.name}</div>
                  <div className="mt-1 text-sm text-slate-500">
                    ИНН: {item.inn || '-'} · КПП: {item.kpp || '-'} · {item.departments.length} подразделений
                  </div>
                </button>
                <ActionButton
                  disabled={isSaving}
                  icon="trash"
                  label="Удалить"
                  onClick={() => deleteOrganization(item)}
                  tone="danger"
                />
              </div>
            </div>
          ))}
          {!organizations.length && (
            <div className="rounded-lg border border-dashed border-cyan-200 bg-cyan-50/40 p-4 text-sm text-slate-600">
              Организаций пока нет.
            </div>
          )}
        </div>

        <form className="mt-5 grid gap-4 lg:grid-cols-[1.5fr_1fr_1fr_auto]" onSubmit={saveOrganization}>
          <label className="grid gap-1 text-sm font-medium">
            {organization ? 'Редактировать выбранную организацию' : 'Название новой организации'}
            <input
              className="rounded-md border border-slate-300 px-3 py-2"
              placeholder="ООО «ИнфоЛинк»"
              required
              value={organizationForm.name}
              onChange={(event) => setOrganizationForm((current) => ({ ...current, name: event.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            ИНН
            <input
              className="rounded-md border border-slate-300 px-3 py-2"
              value={organizationForm.inn}
              onChange={(event) => setOrganizationForm((current) => ({ ...current, inn: event.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            КПП
            <input
              className="rounded-md border border-slate-300 px-3 py-2"
              value={organizationForm.kpp}
              onChange={(event) => setOrganizationForm((current) => ({ ...current, kpp: event.target.value }))}
            />
          </label>
          <div className="flex items-end">
            <button
              className="btn-primary w-full px-4 py-2 disabled:opacity-60"
              disabled={isSaving}
              type="submit"
            >
              {organization ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="ui-card ui-card-section">
          <h2 className="text-lg font-semibold">Подразделения</h2>
          <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={createDepartment}>
            <input
              className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2"
              placeholder="Название подразделения"
              required
              value={departmentName}
              onChange={(event) => setDepartmentName(event.target.value)}
            />
            <button
              className="btn-primary px-4 py-2 disabled:opacity-60"
              disabled={isSaving || !organization}
              type="submit"
            >
              Добавить подразделение
            </button>
          </form>

          <div className="mt-5 grid gap-3">
            {organization?.departments.map((department) => (
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3" key={department.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{department.name}</div>
                    <div className="mt-1 text-sm text-slate-500">{department.positions.length} должностей</div>
                  </div>
                  <ActionButton
                    disabled={isSaving}
                    icon="trash"
                    label="Удалить"
                    onClick={() => deleteDepartment(department)}
                    tone="danger"
                  />
                </div>
              </div>
            ))}
            {!organization?.departments.length && (
              <div className="rounded-lg border border-dashed border-cyan-200 bg-cyan-50/40 p-4 text-sm text-slate-600">
                Добавьте первое подразделение после сохранения организации.
              </div>
            )}
          </div>
        </div>

        <div className="ui-card ui-card-section">
          <h2 className="text-lg font-semibold">Должности</h2>
          <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={createPosition}>
            <input
              className="rounded-md border border-slate-300 px-3 py-2"
              placeholder="Название должности"
              required
              value={positionForm.title}
              onChange={(event) => setPositionForm((current) => ({ ...current, title: event.target.value }))}
            />
            <select
              className="rounded-md border border-slate-300 px-3 py-2"
              required
              value={positionForm.departmentId}
              onChange={(event) => setPositionForm((current) => ({ ...current, departmentId: event.target.value }))}
            >
              <option value="">Подразделение</option>
              {organization?.departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
            <button
              className="btn-primary px-4 py-2 disabled:opacity-60"
              disabled={isSaving || !organization?.departments.length}
              type="submit"
            >
              Добавить
            </button>
          </form>

          <div className="mt-5 grid gap-3">
            {organization?.departments.flatMap((department) =>
              department.positions.map((position) => (
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3" key={position.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{position.title}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {department.name} · {position._count.users} пользователей
                      </div>
                    </div>
                    <ActionButton
                      disabled={isSaving}
                      icon="trash"
                      label="Удалить"
                      onClick={() => deletePosition(position)}
                      tone="danger"
                    />
                  </div>
                </div>
              )),
            )}
            {!positions.length && (
              <div className="rounded-lg border border-dashed border-cyan-200 bg-cyan-50/40 p-4 text-sm text-slate-600">
                Добавьте должности, чтобы привязывать к ним пользователей.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="ui-card ui-card-compact">
          <div className="text-sm font-medium text-slate-500">Администраторы</div>
          <div className="mt-2 text-2xl font-semibold">{totals.admins}</div>
        </div>
        <div className="ui-card ui-card-compact">
          <div className="text-sm font-medium text-slate-500">Менеджеры</div>
          <div className="mt-2 text-2xl font-semibold">{totals.managers}</div>
        </div>
        <div className="ui-card ui-card-compact">
          <div className="text-sm font-medium text-slate-500">Пользователи</div>
          <div className="mt-2 text-2xl font-semibold">{totals.users}</div>
        </div>
      </section>

      <section className="ui-card ui-card-section">
        <h2 className="text-lg font-semibold">Права ролей</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-5 py-3 font-medium">Роль</th>
                <th className="px-5 py-3 font-medium">Разрешенные действия</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(rolePermissions).map(([role, permissions]) => (
                <tr className="border-t border-slate-100" key={role}>
                  <td className="px-5 py-3 font-semibold">{roleLabels[role as Role]}</td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-2">
                      {permissions.map((permission) => (
                        <span
                          className="rounded-full bg-[var(--brand-cyan-soft)] px-2 py-1 text-xs font-medium text-cyan-800"
                          key={permission}
                        >
                          {permissionLabels[permission]}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <form className="ui-card ui-card-section" onSubmit={createUser}>
        <h2 className="text-lg font-semibold">Новый пользователь</h2>
        <div className="mt-5 grid gap-4 lg:grid-cols-5">
          <label className="grid gap-1 text-sm font-medium">
            Имя
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
              required
              type="email"
              value={form.email}
              onChange={(event) => updateForm('email', event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Пароль
            <input
              className="rounded-md border border-slate-300 px-3 py-2"
              minLength={8}
              required
              type="password"
              value={form.password}
              onChange={(event) => updateForm('password', event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Роль
            <select
              className="rounded-md border border-slate-300 px-3 py-2"
              value={form.role}
              onChange={(event) => updateForm('role', event.target.value as Role)}
            >
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Должность
            <select
              className="rounded-md border border-slate-300 px-3 py-2"
              value={form.positionId}
              onChange={(event) => updateForm('positionId', event.target.value)}
            >
              <option value="">Не назначена</option>
              {positions.map((position) => (
                <option key={position.id} value={position.id}>
                  {position.title} · {position.departmentName}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            className="btn-primary px-4 py-2 disabled:opacity-60"
            disabled={isSaving}
            type="submit"
          >
            Создать пользователя
          </button>
        </div>
      </form>

      <section className="ui-card">
        <div className="ui-card-header flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-lg font-semibold">Список пользователей</h2>
          <label className="w-full max-w-sm">
            <span className="sr-only">Поиск пользователей</span>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Поиск по пользователям"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-5 py-3 font-medium">Пользователь</th>
                <th className="px-5 py-3 font-medium">Роль</th>
                <th className="px-5 py-3 font-medium">Должность</th>
                <th className="px-5 py-3 font-medium">Использование</th>
                <th className="px-5 py-3 font-medium">Сброс пароля</th>
                <th className="px-5 py-3 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((user) => {
                const draft = drafts[user.id] ?? {
                  name: user.name,
                  role: user.role,
                  positionId: user.positionId ?? '',
                  password: '',
                };

                return (
                  <tr className="border-t border-slate-100" key={user.id}>
                    <td className="px-5 py-3">
                      <input
                        className="w-full rounded-md border border-slate-300 px-3 py-2 font-medium"
                        value={draft.name}
                        onChange={(event) => updateDraft(user.id, 'name', event.target.value)}
                      />
                      <div className="mt-1 text-slate-500">{user.email}</div>
                    </td>
                    <td className="px-5 py-3">
                      <select
                        className="rounded-md border border-slate-300 px-3 py-2"
                        value={draft.role}
                        onChange={(event) => updateDraft(user.id, 'role', event.target.value as Role)}
                      >
                        {roleOptions.map((role) => (
                          <option key={role} value={role}>
                            {roleLabels[role]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-3">
                      <select
                        className="rounded-md border border-slate-300 px-3 py-2"
                        value={draft.positionId}
                        onChange={(event) => updateDraft(user.id, 'positionId', event.target.value)}
                      >
                        <option value="">Не назначена</option>
                        {positions.map((position) => (
                          <option key={position.id} value={position.id}>
                            {position.title} · {position.departmentName}
                          </option>
                        ))}
                      </select>
                      {user.position && (
                        <div className="mt-1 text-xs text-slate-500">
                          {user.position.department.name} · {user.position.department.organization.name}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div>{user._count.timeEntries} записей времени</div>
                      <div className="text-slate-500">{user._count.assignedProjects} назначенных проектов</div>
                    </td>
                    <td className="px-5 py-3">
                      <input
                        className="rounded-md border border-slate-300 px-3 py-2"
                        minLength={8}
                        placeholder="Оставить пустым"
                        type="password"
                        value={draft.password}
                        onChange={(event) => updateDraft(user.id, 'password', event.target.value)}
                      />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                      <ActionButton
                        disabled={isSaving}
                        icon="save"
                        label="Сохранить"
                        onClick={() => saveUser(user)}
                        tone="primary"
                      />
                      {session.user?.id !== user.id && (
                        <ActionButton
                          disabled={isSaving}
                          icon="trash"
                          label="Удалить"
                          onClick={() => deleteUser(user)}
                          tone="danger"
                        />
                      )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!visibleUsers.length && (
                <tr>
                  <td className="px-5 py-8 text-center text-slate-500" colSpan={6}>
                    {searchQuery ? 'Пользователи не найдены.' : 'Пользователей пока нет.'}
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
