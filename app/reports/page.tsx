'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import AppShell from '@/components/AppShell';
import { can } from '@/lib/access-control';

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
  status: 'ACTIVE' | 'ARCHIVED';
  client: {
    id: string;
    name: string;
    currency: string;
  };
};

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  position: {
    id: string;
    title: string;
    department: {
      id: string;
      name: string;
    };
  } | null;
};

type ReportEntry = {
  id: string;
  startTime: string;
  endTime: string | null;
  duration: number;
  description: string | null;
  billable: boolean;
  user: User;
  project: {
    id: string;
    name: string;
    client: {
      id: string;
      name: string;
      currency: string;
    };
  };
  activity: {
    id: string;
    name: string;
  };
};

type UserSummary = {
  user: User;
  minutes: number;
  billableMinutes: number;
  entries: ReportEntry[];
};

type ProjectSummary = {
  project: ReportEntry['project'];
  minutes: number;
  billableMinutes: number;
  users: Record<string, UserSummary>;
};

type ClientSummary = {
  client: ReportEntry['project']['client'];
  minutes: number;
  billableMinutes: number;
  projects: Record<string, ProjectSummary>;
};

const today = new Date();
const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString().slice(0, 10);

const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return `${hours} ч ${rest.toString().padStart(2, '0')} мин`;
};

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildReport(entries: ReportEntry[]) {
  return entries.reduce<Record<string, ClientSummary>>((clients, entry) => {
    const clientId = entry.project.client.id;
    const projectId = entry.project.id;
    const userId = entry.user.id;

    clients[clientId] ??= {
      client: entry.project.client,
      minutes: 0,
      billableMinutes: 0,
      projects: {},
    };

    clients[clientId].projects[projectId] ??= {
      project: entry.project,
      minutes: 0,
      billableMinutes: 0,
      users: {},
    };

    clients[clientId].projects[projectId].users[userId] ??= {
      user: entry.user,
      minutes: 0,
      billableMinutes: 0,
      entries: [],
    };

    const billableMinutes = entry.billable ? entry.duration : 0;
    clients[clientId].minutes += entry.duration;
    clients[clientId].billableMinutes += billableMinutes;
    clients[clientId].projects[projectId].minutes += entry.duration;
    clients[clientId].projects[projectId].billableMinutes += billableMinutes;
    clients[clientId].projects[projectId].users[userId].minutes += entry.duration;
    clients[clientId].projects[projectId].users[userId].billableMinutes += billableMinutes;
    clients[clientId].projects[projectId].users[userId].entries.push(entry);

    return clients;
  }, {});
}

function countProjectEntries(project: ProjectSummary) {
  return Object.values(project.users).reduce((sum, summary) => sum + summary.entries.length, 0);
}

function countClientEntries(client: ClientSummary) {
  return Object.values(client.projects).reduce((sum, project) => sum + countProjectEntries(project), 0);
}

function formatBillableShare(minutes: number, billableMinutes: number) {
  if (!minutes) {
    return '0%';
  }

  return `${Math.round((billableMinutes / minutes) * 100)}%`;
}

function formatUserPosition(user: User) {
  return user.position ? `${user.position.title} - ${user.position.department.name}` : user.email;
}

export default function ReportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [entries, setEntries] = useState<ReportEntry[]>([]);
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [userId, setUserId] = useState('');
  const [from, setFrom] = useState(startOfMonth);
  const [to, setTo] = useState(tomorrow);
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
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
    if (!session || (!can(session.user?.role, 'reports.team') && !can(session.user?.role, 'reports.all'))) {
      return;
    }

    async function loadReport() {
      setIsLoading(true);
      setError('');

      const params = new URLSearchParams();
      if (clientId) params.set('clientId', clientId);
      if (projectId) params.set('projectId', projectId);
      if (userId) params.set('userId', userId);
      if (from) params.set('from', new Date(from).toISOString());
      if (to) params.set('to', new Date(to).toISOString());

      const response = await fetch(`/api/reports/time?${params.toString()}`);
      setIsLoading(false);

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? 'Не удалось загрузить отчет');
        return;
      }

      const data = await response.json();
      setClients(data.clients);
      setProjects(data.projects);
      setUsers(data.users);
      setEntries(data.entries);
    }

    loadReport().catch(() => {
      setIsLoading(false);
      setError('Не удалось загрузить отчет');
    });
  }, [clientId, from, projectId, session, to, userId]);

  const filteredProjects = useMemo(
    () => projects.filter((project) => !clientId || project.clientId === clientId),
    [clientId, projects],
  );

  const report = useMemo(() => buildReport(entries), [entries]);
  const totalMinutes = entries.reduce((sum, entry) => sum + entry.duration, 0);
  const billableMinutes = entries.filter((entry) => entry.billable).reduce((sum, entry) => sum + entry.duration, 0);
  const userCount = new Set(entries.map((entry) => entry.user.id)).size;
  const projectCount = new Set(entries.map((entry) => entry.project.id)).size;

  function exportExcel() {
    const summaryRows = Object.values(report).flatMap((client) => [
      ['Клиент', client.client.name, '', '', '', countClientEntries(client), client.minutes, formatDuration(client.minutes), formatDuration(client.billableMinutes), formatBillableShare(client.minutes, client.billableMinutes)],
      ...Object.values(client.projects).flatMap((project) => [
        ['Проект', client.client.name, project.project.name, '', '', countProjectEntries(project), project.minutes, formatDuration(project.minutes), formatDuration(project.billableMinutes), formatBillableShare(project.minutes, project.billableMinutes)],
        ...Object.values(project.users).map((summary) => [
          'Пользователь',
          client.client.name,
          project.project.name,
          summary.user.name,
          formatUserPosition(summary.user),
          summary.entries.length,
          summary.minutes,
          formatDuration(summary.minutes),
          formatDuration(summary.billableMinutes),
          formatBillableShare(summary.minutes, summary.billableMinutes),
        ]),
      ]),
    ]);
    const rows = entries.map((entry) => [
      new Date(entry.startTime).toLocaleString(),
      entry.project.client.name,
      entry.project.name,
      entry.user.name,
      entry.user.position?.title ?? '',
      entry.user.position?.department.name ?? '',
      entry.activity.name,
      entry.duration,
      formatDuration(entry.duration),
      entry.billable ? 'Да' : 'Нет',
      entry.description ?? '',
    ]);
    const html = `<!doctype html>
<html>
<head><meta charset="utf-8" /></head>
<body>
<h2>Управленческая сводка</h2>
<table>
<thead>
<tr>
<th>Уровень</th><th>Клиент</th><th>Проект</th><th>Пользователь</th><th>Должность / подразделение</th><th>Записи</th><th>Минуты</th><th>Всего</th><th>Оплачиваемое</th><th>Доля</th>
</tr>
</thead>
<tbody>
${summaryRows
  .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
  .join('')}
</tbody>
</table>
<h2>Детализация работ</h2>
<table>
<thead>
<tr>
<th>Дата</th><th>Клиент</th><th>Проект</th><th>Пользователь</th><th>Должность</th><th>Подразделение</th><th>Активность</th><th>Минуты</th><th>Длительность</th><th>Оплачиваемое</th><th>Комментарий</th>
</tr>
</thead>
<tbody>
${rows
  .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
  .join('')}
</tbody>
</table>
</body>
</html>`;

    downloadFile(`time-report-${from || 'start'}-${to || 'end'}.xls`, html, 'application/vnd.ms-excel;charset=utf-8');
  }

  function exportPdf() {
    const reportHtml = Object.values(report)
      .map((client) => {
        const clientEntries = countClientEntries(client);

        return `
        <section>
          <h2>${escapeHtml(client.client.name)}</h2>
          <table>
            <thead>
              <tr><th>Уровень</th><th>Проект</th><th>Пользователь</th><th>Должность / подразделение</th><th>Записи</th><th>Всего</th><th>Оплачиваемое</th><th>Доля</th></tr>
            </thead>
            <tbody>
              <tr class="client-total">
                <td>Клиент</td><td colspan="3">${escapeHtml(client.client.name)}</td><td>${escapeHtml(clientEntries)}</td><td>${escapeHtml(formatDuration(client.minutes))}</td><td>${escapeHtml(formatDuration(client.billableMinutes))}</td><td>${escapeHtml(formatBillableShare(client.minutes, client.billableMinutes))}</td>
              </tr>
              ${Object.values(client.projects)
                .map((project) => `
                  <tr class="project-total">
                    <td>Проект</td><td colspan="3">${escapeHtml(project.project.name)}</td><td>${escapeHtml(countProjectEntries(project))}</td><td>${escapeHtml(formatDuration(project.minutes))}</td><td>${escapeHtml(formatDuration(project.billableMinutes))}</td><td>${escapeHtml(formatBillableShare(project.minutes, project.billableMinutes))}</td>
                  </tr>
                  ${Object.values(project.users)
                    .map((summary) => `
                      <tr>
                        <td>Пользователь</td>
                        <td>${escapeHtml(project.project.name)}</td>
                        <td>${escapeHtml(summary.user.name)}</td>
                        <td>${escapeHtml(formatUserPosition(summary.user))}</td>
                        <td>${escapeHtml(summary.entries.length)}</td>
                        <td>${escapeHtml(formatDuration(summary.minutes))}</td>
                        <td>${escapeHtml(formatDuration(summary.billableMinutes))}</td>
                        <td>${escapeHtml(formatBillableShare(summary.minutes, summary.billableMinutes))}</td>
                      </tr>
                    `)
                    .join('')}
                `)
                .join('')}
            </tbody>
          </table>
        </section>
      `;
      })
      .join('');

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setError('Разрешите всплывающие окна для выгрузки PDF');
      return;
    }

    printWindow.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Отчет по времени</title>
  <style>
    body { color: #0f172a; font-family: Arial, sans-serif; margin: 32px; }
    h1 { font-size: 24px; margin: 0 0 8px; }
    h2 { border-top: 1px solid #cbd5e1; font-size: 18px; margin-top: 24px; padding-top: 16px; }
    h3 { font-size: 15px; margin-top: 18px; }
    span { float: right; }
    .meta { color: #475569; font-size: 12px; margin-bottom: 20px; }
    table { border-collapse: collapse; margin-top: 8px; width: 100%; }
    th, td { border: 1px solid #cbd5e1; font-size: 11px; padding: 6px; text-align: left; vertical-align: top; }
    th { background: #e0f7fa; }
    .client-total { background: #ecfeff; font-weight: 700; }
    .project-total { background: #f8fafc; font-weight: 700; }
    .details th { background: #f1f5f9; }
    @media print { button { display: none; } }
  </style>
</head>
<body>
  <button onclick="window.print()">Сохранить как PDF</button>
  <h1>Отчет по времени</h1>
  <div class="meta">Период: ${escapeHtml(from || 'начало')} - ${escapeHtml(to || 'конец')} · Всего: ${escapeHtml(formatDuration(totalMinutes))} · Оплачиваемое: ${escapeHtml(formatDuration(billableMinutes))}</div>
  ${reportHtml || '<p>Нет данных по выбранным фильтрам.</p>'}
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
  }

  if (status === 'loading' || !session) {
    return <div className="flex min-h-screen items-center justify-center">Загрузка...</div>;
  }

  if (!can(session.user?.role, 'reports.team') && !can(session.user?.role, 'reports.all')) {
    return (
      <AppShell
        eyebrow="Отчеты"
        subtitle="Ваша роль не дает доступа к отчетам команды."
        title="Отчеты"
        userEmail={session.user?.email}
        userRole={session.user?.role}
      >
        <div className="rounded-lg border border-red-100 bg-red-50 p-5 text-sm text-red-700">
          У вас нет прав на просмотр отчетов.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      eyebrow="Отчеты"
      subtitle="Фильтруйте рабочее время по клиенту, проекту и пользователю, затем раскрывайте детализацию по работам."
      title="Отчеты по времени"
      userEmail={session.user?.email}
      userRole={session.user?.role}
    >
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <section className="ui-card ui-card-section">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">Фильтры</h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              className="btn-secondary px-4 py-2 text-sm disabled:opacity-50"
              disabled={!entries.length}
              onClick={exportExcel}
              type="button"
            >
              Выгрузить Excel
            </button>
            <button
              className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
              disabled={!entries.length}
              onClick={exportPdf}
              type="button"
            >
              Выгрузить PDF
            </button>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-5">
          <label className="grid gap-1 text-sm font-medium">
            С
            <input className="rounded-md border border-slate-300 px-3 py-2" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            По
            <input className="rounded-md border border-slate-300 px-3 py-2" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Клиент
            <select className="rounded-md border border-slate-300 px-3 py-2" value={clientId} onChange={(event) => { setClientId(event.target.value); setProjectId(''); }}>
              <option value="">Все клиенты</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Проект
            <select className="rounded-md border border-slate-300 px-3 py-2" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              <option value="">Все проекты</option>
              {filteredProjects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Пользователь
            <select className="rounded-md border border-slate-300 px-3 py-2" value={userId} onChange={(event) => setUserId(event.target.value)}>
              <option value="">Все пользователи</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-4">
        <div className="ui-card ui-card-compact">
          <div className="text-sm font-medium text-slate-500">Всего времени</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{formatDuration(totalMinutes)}</div>
        </div>
        <div className="ui-card ui-card-compact">
          <div className="text-sm font-medium text-slate-500">Оплачиваемое</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{formatDuration(billableMinutes)}</div>
        </div>
        <div className="ui-card ui-card-compact">
          <div className="text-sm font-medium text-slate-500">Проекты</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{projectCount}</div>
        </div>
        <div className="ui-card ui-card-compact">
          <div className="text-sm font-medium text-slate-500">Пользователи</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{userCount}</div>
        </div>
      </section>

      <section className="grid gap-4">
        {isLoading && <div className="ui-card ui-card-section text-sm text-slate-600">Отчет загружается...</div>}
        {Object.values(report).map((client) => {
          const clientEntries = countClientEntries(client);

          return (
            <div className="ui-card" key={client.client.id}>
              <div className="ui-card-header">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{client.client.name}</h2>
                    <div className="mt-1 text-sm text-slate-500">Итог по клиенту: {clientEntries} записей</div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-right text-sm">
                    <div>
                      <div className="text-slate-500">Всего</div>
                      <div className="font-semibold tabular-nums text-[var(--brand-blue)]">{formatDuration(client.minutes)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Оплачиваемое</div>
                      <div className="font-semibold tabular-nums">{formatDuration(client.billableMinutes)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Доля</div>
                      <div className="font-semibold tabular-nums">{formatBillableShare(client.minutes, client.billableMinutes)}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto p-5">
                <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
                  <thead className="table-head">
                    <tr>
                      <th className="px-3 py-2 font-medium">Уровень</th>
                      <th className="px-3 py-2 font-medium">Проект</th>
                      <th className="px-3 py-2 font-medium">Пользователь</th>
                      <th className="px-3 py-2 font-medium">Должность / подразделение</th>
                      <th className="px-3 py-2 text-right font-medium">Записи</th>
                      <th className="px-3 py-2 text-right font-medium">Всего</th>
                      <th className="px-3 py-2 text-right font-medium">Оплачиваемое</th>
                      <th className="px-3 py-2 text-right font-medium">Доля</th>
                      <th className="px-3 py-2 text-right font-medium">Детали</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="state-active border-t font-semibold">
                      <td className="px-3 py-3">Клиент</td>
                      <td className="px-3 py-3" colSpan={3}>{client.client.name}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{clientEntries}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatDuration(client.minutes)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatDuration(client.billableMinutes)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatBillableShare(client.minutes, client.billableMinutes)}</td>
                      <td className="px-3 py-3" />
                    </tr>

                    {Object.values(client.projects).map((project) => {
                      const projectEntries = countProjectEntries(project);

                      return (
                        <Fragment key={project.project.id}>
                          <tr className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-900">
                            <td className="px-3 py-3 text-[var(--brand-cyan-dark)]">Проект</td>
                            <td className="px-3 py-3" colSpan={3}>{project.project.name}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{projectEntries}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{formatDuration(project.minutes)}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{formatDuration(project.billableMinutes)}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{formatBillableShare(project.minutes, project.billableMinutes)}</td>
                            <td className="px-3 py-3" />
                          </tr>

                          {Object.values(project.users).map((summary) => {
                            const key = `${client.client.id}:${project.project.id}:${summary.user.id}`;
                            const expanded = !!expandedUsers[key];

                            return (
                              <Fragment key={key}>
                                <tr className="border-t border-slate-100 bg-white">
                                  <td className="px-3 py-3">
                                    <span className="rounded-full bg-cyan-50 px-2 py-1 text-xs font-medium text-[var(--brand-blue)]">Пользователь</span>
                                  </td>
                                  <td className="px-3 py-3">{project.project.name}</td>
                                  <td className="px-3 py-3">
                                    <div className="font-medium text-slate-950">{summary.user.name}</div>
                                    <div className="mt-0.5 text-xs text-slate-500">{summary.user.email}</div>
                                  </td>
                                  <td className="px-3 py-3 text-slate-600">{formatUserPosition(summary.user)}</td>
                                  <td className="px-3 py-3 text-right tabular-nums">{summary.entries.length}</td>
                                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-[var(--brand-blue)]">{formatDuration(summary.minutes)}</td>
                                  <td className="px-3 py-3 text-right tabular-nums">{formatDuration(summary.billableMinutes)}</td>
                                  <td className="px-3 py-3 text-right tabular-nums">{formatBillableShare(summary.minutes, summary.billableMinutes)}</td>
                                  <td className="px-3 py-3 text-right">
                                    <button
                                      className="btn-secondary px-3 py-2 text-sm"
                                      onClick={() => setExpandedUsers((current) => ({ ...current, [key]: !expanded }))}
                                      type="button"
                                    >
                                      {expanded ? 'Скрыть' : 'Подробнее'}
                                    </button>
                                  </td>
                                </tr>

                                {expanded && (
                                  <tr className="border-t border-slate-100 bg-slate-50/70">
                                    <td className="px-3 py-3" />
                                    <td className="px-3 py-3" colSpan={8}>
                                      <table className="w-full min-w-[760px] border-collapse text-left text-xs">
                                        <thead className="bg-white text-slate-600">
                                          <tr>
                                            <th className="px-3 py-2 font-medium">Дата</th>
                                            <th className="px-3 py-2 font-medium">Активность</th>
                                            <th className="px-3 py-2 text-right font-medium">Длительность</th>
                                            <th className="px-3 py-2 font-medium">Оплачиваемое</th>
                                            <th className="px-3 py-2 font-medium">Комментарий</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {summary.entries.map((entry) => (
                                            <tr className="border-t border-slate-200 bg-white" key={entry.id}>
                                              <td className="px-3 py-2">{new Date(entry.startTime).toLocaleString()}</td>
                                              <td className="px-3 py-2">{entry.activity.name}</td>
                                              <td className="px-3 py-2 text-right tabular-nums">{formatDuration(entry.duration)}</td>
                                              <td className="px-3 py-2">{entry.billable ? 'Да' : 'Нет'}</td>
                                              <td className="px-3 py-2">{entry.description || '-'}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
        {!isLoading && !entries.length && (
          <div className="rounded-lg border border-dashed border-cyan-200 bg-cyan-50/40 p-6 text-center text-sm text-slate-600">
            По выбранным фильтрам записей времени нет.
          </div>
        )}
      </section>
    </AppShell>
  );
}
