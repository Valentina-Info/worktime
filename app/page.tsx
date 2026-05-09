'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';

type ClientOption = {
  id: string;
  name: string;
  currency: string;
};

type ProjectOption = {
  id: string;
  name: string;
  clientId: string;
  rate: number | null;
};

type ActivityOption = {
  id: string;
  name: string;
  projectId: string | null;
  rate: number | null;
};

type TimeEntry = {
  id: string;
  startTime: string;
  endTime: string | null;
  duration: number;
  description: string | null;
  billable: boolean;
  rate: number | null;
  project: {
    id: string;
    name: string;
    client: ClientOption;
  };
  activity: {
    id: string;
    name: string;
  };
};

const nowForInput = () => new Date().toISOString().slice(0, 16);

const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return `${hours}h ${rest.toString().padStart(2, '0')}m`;
};

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [activities, setActivities] = useState<ActivityOption[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [activityId, setActivityId] = useState('');
  const [description, setDescription] = useState('');
  const [manualStart, setManualStart] = useState(nowForInput);
  const [manualDuration, setManualDuration] = useState(60);
  const [billable, setBillable] = useState(true);
  const [timerStartedAt, setTimerStartedAt] = useState<number | null>(null);
  const [timerTick, setTimerTick] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    if (!session) {
      router.push('/auth/signin');
    }
  }, [session, status, router]);

  useEffect(() => {
    if (!session) {
      return;
    }

    async function loadData() {
      const [optionsResponse, entriesResponse] = await Promise.all([
        fetch('/api/options'),
        fetch('/api/time-entries'),
      ]);

      if (!optionsResponse.ok || !entriesResponse.ok) {
        setError('Failed to load MVP data');
        return;
      }

      const optionsData = await optionsResponse.json();
      const entriesData = await entriesResponse.json();

      setClients(optionsData.clients);
      setProjects(optionsData.projects);
      setActivities(optionsData.activities);
      setEntries(entriesData.entries);

      if (optionsData.clients[0]) {
        setClientId(optionsData.clients[0].id);
      }

      if (optionsData.projects[0]) {
        setProjectId(optionsData.projects[0].id);
      }

      if (optionsData.activities[0]) {
        setActivityId(optionsData.activities[0].id);
      }
    }

    loadData().catch(() => setError('Failed to load MVP data'));
  }, [session]);

  useEffect(() => {
    if (!timerStartedAt) {
      return;
    }

    const interval = window.setInterval(() => {
      setTimerTick(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [timerStartedAt]);

  const filteredProjects = useMemo(
    () => projects.filter((project) => project.clientId === clientId),
    [clientId, projects],
  );

  const selectedProjectId = filteredProjects.some((project) => project.id === projectId)
    ? projectId
    : (filteredProjects[0]?.id ?? '');

  const filteredActivities = useMemo(
    () => activities.filter((activity) => !activity.projectId || activity.projectId === selectedProjectId),
    [activities, selectedProjectId],
  );

  const selectedActivityId = filteredActivities.some((activity) => activity.id === activityId)
    ? activityId
    : (filteredActivities[0]?.id ?? '');

  const elapsedMinutes = useMemo(() => {
    if (!timerStartedAt) {
      return 0;
    }

    return Math.max(1, Math.round((timerTick - timerStartedAt) / 60000));
  }, [timerStartedAt, timerTick]);

  const todayMinutes = useMemo(() => {
    const today = new Date().toDateString();

    return entries
      .filter((entry) => new Date(entry.startTime).toDateString() === today)
      .reduce((sum, entry) => sum + entry.duration, 0);
  }, [entries]);

  const billableMinutes = useMemo(
    () => entries.filter((entry) => entry.billable).reduce((sum, entry) => sum + entry.duration, 0),
    [entries],
  );

  async function createTimeEntry(startTime: Date, duration: number, endTime: Date | null) {
    setIsSaving(true);
    setError('');

    const response = await fetch('/api/time-entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: selectedProjectId,
        activityId: selectedActivityId,
        startTime: startTime.toISOString(),
        endTime: endTime?.toISOString() ?? null,
        duration,
        description,
        billable,
      }),
    });

    setIsSaving(false);

    if (!response.ok) {
      setError('Failed to save time entry');
      return false;
    }

    const data = await response.json();
    setEntries((current) => [data.entry, ...current]);
    setDescription('');

    return true;
  }

  async function stopTimer() {
    if (!timerStartedAt) {
      return;
    }

    const startedAt = new Date(timerStartedAt);
    const endedAt = new Date();
    const duration = Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000));
    const saved = await createTimeEntry(startedAt, duration, endedAt);

    if (saved) {
      setTimerStartedAt(null);
    }
  }

  async function saveManualEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const startedAt = new Date(manualStart);
    const duration = Math.max(1, Number(manualDuration));
    const endedAt = new Date(startedAt.getTime() + duration * 60000);

    await createTimeEntry(startedAt, duration, endedAt);
  }

  function startTimer() {
    const now = Date.now();
    setTimerStartedAt(now);
    setTimerTick(now);
  }

  if (status === 'loading' || !session) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <AppShell
      eyebrow="Workspace"
      subtitle="Start a timer, add manual time, and scan the latest work log from one focused screen."
      title="Time tracking"
      userEmail={session.user?.email}
    >
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-medium text-slate-500">Today</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{formatDuration(todayMinutes)}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-medium text-slate-500">Billable in view</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{formatDuration(billableMinutes)}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-medium text-slate-500">Entries loaded</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{entries.length}</div>
        </div>
      </section>

        {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Timer</h2>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-1 text-sm font-medium">
                Client
                <select
                  className="rounded-md border border-slate-300 px-3 py-2"
                  value={clientId}
                  onChange={(event) => setClientId(event.target.value)}
                >
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm font-medium">
                Project
                <select
                  className="rounded-md border border-slate-300 px-3 py-2"
                  value={selectedProjectId}
                  onChange={(event) => setProjectId(event.target.value)}
                >
                  {filteredProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm font-medium">
                Activity
                <select
                  className="rounded-md border border-slate-300 px-3 py-2"
                  value={selectedActivityId}
                  onChange={(event) => setActivityId(event.target.value)}
                >
                  {filteredActivities.map((activity) => (
                    <option key={activity.id} value={activity.id}>
                      {activity.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm font-medium">
                Comment
                <textarea
                  className="min-h-24 rounded-md border border-slate-300 px-3 py-2"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What are you working on?"
                />
              </label>

              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={billable} onChange={(event) => setBillable(event.target.checked)} />
                Billable
              </label>

              <div className="rounded-lg border border-cyan-200 bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-cyan)] px-4 py-6 text-center text-white shadow-sm shadow-cyan-100">
                <div className="text-sm text-cyan-50">Current timer</div>
                <div className="mt-1 text-5xl font-semibold tabular-nums">{formatDuration(elapsedMinutes)}</div>
              </div>

              {timerStartedAt ? (
                <button
                  className="rounded-md bg-red-600 px-4 py-3 font-medium text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60"
                  disabled={isSaving}
                  onClick={stopTimer}
                >
                  Stop and save
                </button>
              ) : (
                <button
                  className="rounded-md bg-[var(--brand-cyan)] px-4 py-3 font-medium text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
                  disabled={!selectedProjectId || !selectedActivityId}
                  onClick={startTimer}
                >
                  Start timer
                </button>
              )}
            </div>
          </div>

          <form className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" onSubmit={saveManualEntry}>
            <h2 className="text-lg font-semibold">Manual entry</h2>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-1 text-sm font-medium">
                Start
                <input
                  className="rounded-md border border-slate-300 px-3 py-2"
                  type="datetime-local"
                  value={manualStart}
                  onChange={(event) => setManualStart(event.target.value)}
                />
              </label>

              <label className="grid gap-1 text-sm font-medium">
                Duration, minutes
                <input
                  className="rounded-md border border-slate-300 px-3 py-2"
                  min="1"
                  type="number"
                  value={manualDuration}
                  onChange={(event) => setManualDuration(Number(event.target.value))}
                />
              </label>

              <button
                className="rounded-md bg-[var(--brand-blue)] px-4 py-3 font-medium text-white shadow-sm transition hover:bg-[var(--brand-blue-dark)] disabled:opacity-60"
                disabled={isSaving || !selectedProjectId || !selectedActivityId}
                type="submit"
              >
                Save manual entry
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold">Latest entries</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Client</th>
                  <th className="px-5 py-3 font-medium">Project</th>
                  <th className="px-5 py-3 font-medium">Activity</th>
                  <th className="px-5 py-3 font-medium">Duration</th>
                  <th className="px-5 py-3 font-medium">Billable</th>
                  <th className="px-5 py-3 font-medium">Comment</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-t border-slate-100">
                    <td className="px-5 py-3">{new Date(entry.startTime).toLocaleString()}</td>
                    <td className="px-5 py-3">{entry.project.client.name}</td>
                    <td className="px-5 py-3">{entry.project.name}</td>
                    <td className="px-5 py-3">{entry.activity.name}</td>
                    <td className="px-5 py-3">{formatDuration(entry.duration)}</td>
                    <td className="px-5 py-3">{entry.billable ? 'Yes' : 'No'}</td>
                    <td className="px-5 py-3">{entry.description || '-'}</td>
                  </tr>
                ))}
                {!entries.length && (
                  <tr>
                    <td className="px-5 py-8 text-center text-slate-500" colSpan={7}>
                      No time entries yet.
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
