'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { can } from '@/lib/access-control';

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

type TimeLock = {
  id: string;
  dateKey: string;
  locked: boolean;
  lockedBy: {
    id: string;
    name: string;
    email: string;
  };
};

const nowForInput = () => new Date().toISOString().slice(0, 16);

const dateKeyToInputDateTime = (dateKey: string, currentValue = nowForInput()) => {
  const time = currentValue.includes('T') ? currentValue.split('T')[1] : '09:00';

  return `${dateKey}T${time}`;
};

const toLocalDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const dateFromKey = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);

  return new Date(year, month - 1, day);
};

const monthRange = (month: Date) => {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 1);

  return { start, end };
};

const buildCalendarDays = (month: Date) => {
  const { start } = monthRange(month);
  const mondayOffset = (start.getDay() + 6) % 7;
  const firstCell = new Date(start);
  firstCell.setDate(start.getDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstCell);
    date.setDate(firstCell.getDate() + index);
    return date;
  });
};

const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return `${hours} ч ${rest.toString().padStart(2, '0')} мин`;
};

const formatTimeRange = (entry: TimeEntry) => {
  const start = new Date(entry.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const end = entry.endTime
    ? new Date(entry.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'идет';

  return `${start} - ${end}`;
};

function LockIcon({ locked, className = 'h-4 w-4' }: { locked: boolean; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      {locked ? (
        <path d="M7 10V8a5 5 0 0 1 10 0v2M6 10h12a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z" />
      ) : (
        <path d="M7 10V8a5 5 0 0 1 9.3-2.6M6 10h12a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z" />
      )}
    </svg>
  );
}

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const todayKey = toLocalDateKey(new Date());
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [activities, setActivities] = useState<ActivityOption[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [locks, setLocks] = useState<TimeLock[]>([]);
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [activityId, setActivityId] = useState('');
  const [description, setDescription] = useState('');
  const [manualClientId, setManualClientId] = useState('');
  const [manualProjectId, setManualProjectId] = useState('');
  const [manualActivityId, setManualActivityId] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualStart, setManualStart] = useState(nowForInput);
  const [manualHours, setManualHours] = useState(1);
  const [manualMinutes, setManualMinutes] = useState(0);
  const [billable, setBillable] = useState(true);
  const [timerStartedAt, setTimerStartedAt] = useState<number | null>(null);
  const [timerTick, setTimerTick] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const canLockTime = can(session?.user?.role, 'time.lock');

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

    async function loadOptions() {
      const optionsResponse = await fetch('/api/options');

      if (!optionsResponse.ok) {
        setError('Не удалось загрузить данные');
        return;
      }

      const optionsData = await optionsResponse.json();

      setClients(optionsData.clients);
      setProjects(optionsData.projects);
      setActivities(optionsData.activities);

      if (optionsData.clients[0]) {
        setClientId(optionsData.clients[0].id);
        setManualClientId(optionsData.clients[0].id);
      }

      if (optionsData.projects[0]) {
        setProjectId(optionsData.projects[0].id);
        setManualProjectId(optionsData.projects[0].id);
      }

      if (optionsData.activities[0]) {
        setActivityId(optionsData.activities[0].id);
        setManualActivityId(optionsData.activities[0].id);
      }
    }

    loadOptions().catch(() => setError('Не удалось загрузить данные'));
  }, [session]);

  useEffect(() => {
    if (!session) {
      return;
    }

    async function loadCalendarData() {
      const { start, end } = monthRange(calendarMonth);
      const fromKey = toLocalDateKey(start);
      const toKey = toLocalDateKey(end);
      const params = new URLSearchParams({
        from: start.toISOString(),
        to: end.toISOString(),
      });
      const lockParams = new URLSearchParams({ from: fromKey, to: toKey });
      const [entriesResponse, locksResponse] = await Promise.all([
        fetch(`/api/time-entries?${params.toString()}`),
        fetch(`/api/time-locks?${lockParams.toString()}`),
      ]);

      if (!entriesResponse.ok || !locksResponse.ok) {
        setError('Не удалось загрузить записи календаря');
        return;
      }

      const entriesData = await entriesResponse.json();
      const locksData = await locksResponse.json();
      setEntries(entriesData.entries);
      setLocks(locksData.locks);
    }

    loadCalendarData().catch(() => setError('Не удалось загрузить записи календаря'));
  }, [calendarMonth, session]);

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

  const filteredManualProjects = useMemo(
    () => projects.filter((project) => project.clientId === manualClientId),
    [manualClientId, projects],
  );

  const selectedManualProjectId = filteredManualProjects.some((project) => project.id === manualProjectId)
    ? manualProjectId
    : (filteredManualProjects[0]?.id ?? '');

  const filteredManualActivities = useMemo(
    () => activities.filter((activity) => !activity.projectId || activity.projectId === selectedManualProjectId),
    [activities, selectedManualProjectId],
  );

  const selectedManualActivityId = filteredManualActivities.some((activity) => activity.id === manualActivityId)
    ? manualActivityId
    : (filteredManualActivities[0]?.id ?? '');

  const elapsedMinutes = useMemo(() => {
    if (!timerStartedAt) {
      return 0;
    }

    return Math.max(1, Math.round((timerTick - timerStartedAt) / 60000));
  }, [timerStartedAt, timerTick]);

  const todayMinutes = useMemo(() => {
    return entries
      .filter((entry) => toLocalDateKey(new Date(entry.startTime)) === todayKey)
      .reduce((sum, entry) => sum + entry.duration, 0);
  }, [entries, todayKey]);

  const billableMinutes = useMemo(
    () => entries.filter((entry) => entry.billable).reduce((sum, entry) => sum + entry.duration, 0),
    [entries],
  );

  const entriesByDate = useMemo(() => {
    return entries.reduce<Record<string, TimeEntry[]>>((accumulator, entry) => {
      const key = toLocalDateKey(new Date(entry.startTime));
      accumulator[key] = [...(accumulator[key] ?? []), entry];
      return accumulator;
    }, {});
  }, [entries]);

  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth]);
  const locksByDate = useMemo(() => {
    return Object.fromEntries(locks.map((lock) => [lock.dateKey, lock]));
  }, [locks]);

  const selectedDayEntries = entriesByDate[selectedDateKey] ?? [];
  const selectedDayLock = locksByDate[selectedDateKey];
  const selectedDayLocked = !!selectedDayLock;
  const selectedDayMinutes = selectedDayEntries.reduce((sum, entry) => sum + entry.duration, 0);
  const selectedDayBillableMinutes = selectedDayEntries
    .filter((entry) => entry.billable)
    .reduce((sum, entry) => sum + entry.duration, 0);
  const selectedDayLabel = dateFromKey(selectedDateKey).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  async function createTimeEntry(
    startTime: Date,
    duration: number,
    endTime: Date | null,
    entryProjectId: string,
    entryActivityId: string,
    entryDescription: string,
  ) {
    const dateKey = toLocalDateKey(startTime);

    if (locksByDate[dateKey] && !canLockTime) {
      setError('Эта дата закрыта для редактирования');
      return false;
    }

    setIsSaving(true);
    setError('');

    const response = await fetch('/api/time-entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: entryProjectId,
        activityId: entryActivityId,
        startTime: startTime.toISOString(),
        endTime: endTime?.toISOString() ?? null,
        dateKey,
        duration,
        description: entryDescription,
        billable,
      }),
    });

    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? 'Не удалось сохранить запись времени');
      return false;
    }

    const data = await response.json();
    setEntries((current) => [data.entry, ...current]);

    return true;
  }

  async function stopTimer() {
    if (!timerStartedAt) {
      return;
    }

    const startedAt = new Date(timerStartedAt);
    const endedAt = new Date();
    const duration = Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000));
    const saved = await createTimeEntry(startedAt, duration, endedAt, selectedProjectId, selectedActivityId, description);

    if (saved) {
      setDescription('');
      setTimerStartedAt(null);
    }
  }

  async function saveManualEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const startedAt = new Date(manualStart);
    const duration = Math.max(0, Number(manualHours)) * 60 + Math.max(0, Number(manualMinutes));

    if (duration < 1) {
      setError('Укажите длительность работы');
      return;
    }

    const endedAt = new Date(startedAt.getTime() + duration * 60000);

    const saved = await createTimeEntry(
      startedAt,
      duration,
      endedAt,
      selectedManualProjectId,
      selectedManualActivityId,
      manualDescription,
    );

    if (saved) {
      setManualDescription('');
    }
  }

  function startTimer() {
    const now = Date.now();
    setTimerStartedAt(now);
    setTimerTick(now);
  }

  function moveCalendarMonth(offset: number) {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  function selectCalendarDate(date: Date) {
    const dateKey = toLocalDateKey(date);
    setSelectedDateKey(dateKey);
    setManualStart((current) => dateKeyToInputDateTime(dateKey, current));

    if (date.getMonth() !== calendarMonth.getMonth() || date.getFullYear() !== calendarMonth.getFullYear()) {
      setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  }

  function selectToday() {
    const today = new Date();
    setSelectedDateKey(todayKey);
    setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setManualStart((current) => dateKeyToInputDateTime(todayKey, current));
  }

  function setQuickManualDuration(minutes: number) {
    setManualHours(Math.floor(minutes / 60));
    setManualMinutes(minutes % 60);
  }

  async function toggleDateLock(dateKey: string) {
    if (!canLockTime) {
      return;
    }

    const nextLocked = !locksByDate[dateKey];
    setIsSaving(true);
    setError('');

    const response = await fetch('/api/time-locks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dateKey, locked: nextLocked }),
    });

    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? 'Не удалось изменить блокировку даты');
      return;
    }

    const data = await response.json();
    setLocks((current) => {
      const withoutDate = current.filter((lock) => lock.dateKey !== dateKey);
      return data.lock ? [...withoutDate, data.lock].sort((a, b) => a.dateKey.localeCompare(b.dateKey)) : withoutDate;
    });
  }

  if (status === 'loading' || !session) {
    return <div className="flex min-h-screen items-center justify-center">Загрузка...</div>;
  }

  return (
    <AppShell
      eyebrow="Рабочая область"
      subtitle="Запускайте таймер, добавляйте время вручную и просматривайте работы за выбранные даты."
      title="Учет времени"
      userEmail={session.user?.email}
      userRole={session.user?.role}
    >
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="ui-card ui-card-compact">
          <div className="text-sm font-medium text-slate-500">Сегодня</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{formatDuration(todayMinutes)}</div>
        </div>
        <div className="ui-card ui-card-compact">
          <div className="text-sm font-medium text-slate-500">Оплачиваемое время</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{formatDuration(billableMinutes)}</div>
        </div>
        <div className="ui-card ui-card-compact">
          <div className="text-sm font-medium text-slate-500">Записей загружено</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{entries.length}</div>
        </div>
      </section>

        {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <div className="ui-card ui-card-section">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Рабочий календарь</h2>
                <p className="mt-1 text-sm text-slate-500">Выберите дату, чтобы увидеть работы за этот день.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="btn-primary h-9 px-4 text-sm"
                  onClick={selectToday}
                  type="button"
                >
                  Сегодня
                </button>
                <button
                  className="h-9 w-9 rounded-md border border-cyan-100 text-lg font-semibold text-slate-700 transition hover:bg-cyan-50"
                  onClick={() => moveCalendarMonth(-1)}
                  type="button"
                  title="Предыдущий месяц"
                >
                  ‹
                </button>
                <div className="min-w-36 text-center text-sm font-semibold text-slate-800">
                  {calendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                </div>
                <button
                  className="h-9 w-9 rounded-md border border-cyan-100 text-lg font-semibold text-slate-700 transition hover:bg-cyan-50"
                  onClick={() => moveCalendarMonth(1)}
                  type="button"
                  title="Следующий месяц"
                >
                  ›
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase text-slate-500">
              {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-7 gap-2">
              {calendarDays.map((day) => {
                const dateKey = toLocalDateKey(day);
                const dayEntries = entriesByDate[dateKey] ?? [];
                const minutes = dayEntries.reduce((sum, entry) => sum + entry.duration, 0);
                const isCurrentMonth = day.getMonth() === calendarMonth.getMonth();
                const isToday = dateKey === todayKey;
                const isSelected = dateKey === selectedDateKey;
                const isLocked = !!locksByDate[dateKey];
                const hasEntries = dayEntries.length > 0;

                return (
                  <div
                    className={[
                      'relative min-h-24 overflow-hidden rounded-lg border transition',
                      isSelected
                        ? 'state-active shadow-sm'
                        : isLocked
                          ? 'border-slate-300 bg-slate-100'
                          : hasEntries
                            ? 'border-cyan-200 bg-cyan-50/60 hover:border-[var(--brand-cyan)] hover:bg-cyan-50'
                            : 'border-slate-100 bg-white hover:border-cyan-200 hover:bg-cyan-50',
                      isCurrentMonth ? 'text-slate-950' : 'text-slate-400',
                    ].join(' ')}
                    key={dateKey}
                  >
                    {hasEntries && (
                      <div
                        className={
                          isLocked
                            ? 'absolute inset-x-0 top-0 h-1 bg-slate-400'
                            : 'absolute inset-x-0 top-0 h-1 bg-[var(--brand-cyan)]'
                        }
                      />
                    )}
                    <button className="h-full min-h-24 w-full p-2 text-left" onClick={() => selectCalendarDate(day)} type="button">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={
                            isToday
                              ? 'flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand-cyan)] text-sm font-semibold text-white'
                              : 'text-sm font-semibold'
                          }
                        >
                          {day.getDate()}
                        </span>
                        <div className="flex items-center gap-1">
                          {isLocked && (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-slate-700">
                              <LockIcon locked className="h-3.5 w-3.5" />
                            </span>
                          )}
                          {dayEntries.length > 0 && (
                            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-cyan-800 shadow-sm ring-1 ring-cyan-100">
                              {dayEntries.length}
                            </span>
                          )}
                        </div>
                      </div>
                      {minutes > 0 && (
                        <div className="mt-4 text-xs font-medium text-slate-600">
                          <div className="text-sm font-semibold text-[var(--brand-blue)]">{formatDuration(minutes)}</div>
                          <div className="truncate">{dayEntries[0]?.project.name}</div>
                        </div>
                      )}
                    </button>
                    {canLockTime && (
                      <button
                        className={
                          isLocked
                            ? 'absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-sm shadow-sm transition hover:bg-slate-50'
                            : 'absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-md border border-cyan-200 bg-white text-sm shadow-sm transition hover:bg-cyan-50'
                        }
                        disabled={isSaving}
                        onClick={() => toggleDateLock(dateKey)}
                        title={isLocked ? 'Открыть дату для редактирования' : 'Закрыть дату для редактирования'}
                        type="button"
                      >
                        <LockIcon locked={isLocked} className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="ui-card ui-card-section">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Выбранный день</h2>
                <p className="mt-1 text-sm text-slate-500">{selectedDayLabel}</p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <span
                  className={
                    selectedDayLocked
                      ? 'rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700'
                      : selectedDayEntries.length
                        ? 'rounded-full bg-[var(--brand-cyan-soft)] px-3 py-1 text-xs font-semibold text-cyan-800'
                        : 'rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600'
                  }
                >
                  {selectedDayLocked ? 'Закрыто' : selectedDayEntries.length ? 'Есть работы' : 'Нет работ'}
                </span>
                {selectedDateKey === todayKey && (
                  <span className="rounded-full bg-[var(--brand-cyan-soft)] px-3 py-1 text-xs font-semibold text-cyan-800">
                    Сегодня
                  </span>
                )}
                {selectedDayLocked && (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-slate-700">
                    <LockIcon locked className="h-4 w-4" />
                  </span>
                )}
              </div>
            </div>

            {selectedDayLocked && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                Эта дата закрыта для редактирования
                {selectedDayLock?.lockedBy?.name ? ` пользователем ${selectedDayLock.lockedBy.name}` : ''}.
              </div>
            )}

            {canLockTime && (
              <button
                className={
                  selectedDayLocked
                    ? 'btn-secondary mt-4 flex w-full px-4 py-2 text-lg disabled:opacity-60'
                    : 'btn-primary mt-4 flex w-full px-4 py-2 text-lg disabled:opacity-60'
                }
                disabled={isSaving}
                onClick={() => toggleDateLock(selectedDateKey)}
                title={selectedDayLocked ? 'Открыть эту дату для редактирования' : 'Закрыть эту дату для редактирования'}
                type="button"
              >
                <LockIcon locked={selectedDayLocked} className="h-5 w-5" />
              </button>
            )}

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-cyan-100 bg-cyan-50/60 p-3">
                <div className="text-xs font-medium text-slate-500">Всего</div>
                <div className="mt-1 text-xl font-semibold tabular-nums">{formatDuration(selectedDayMinutes)}</div>
              </div>
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                <div className="text-xs font-medium text-slate-500">Оплачиваемое</div>
                <div className="mt-1 text-xl font-semibold tabular-nums">{formatDuration(selectedDayBillableMinutes)}</div>
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
              <div className="text-xs font-medium text-slate-500">Записей</div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{selectedDayEntries.length}</div>
            </div>

            <div className="mt-5 grid gap-3">
              {selectedDayEntries.map((entry) => (
                <div className="rounded-lg border border-slate-100 bg-white p-3 shadow-sm" key={entry.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold tabular-nums text-[var(--brand-blue)]">{formatTimeRange(entry)}</div>
                      <div className="mt-1 font-medium text-slate-950">{entry.project.name}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {entry.project.client.name} · {entry.activity.name}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold tabular-nums text-[var(--brand-blue)]">
                        {formatDuration(entry.duration)}
                      </div>
                      <div
                        className={
                          entry.billable
                            ? 'mt-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700'
                            : 'mt-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600'
                        }
                      >
                        {entry.billable ? 'Оплачиваемое' : 'Не оплачивается'}
                      </div>
                    </div>
                  </div>
                  {entry.description && (
                    <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">{entry.description}</div>
                  )}
                </div>
              ))}
              {!selectedDayEntries.length && (
                <div className="rounded-lg border border-dashed border-cyan-200 bg-cyan-50/40 p-5 text-sm text-slate-600">
                  За эту дату пока нет записей.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="ui-card ui-card-section">
            <h2 className="text-lg font-semibold">Таймер</h2>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-1 text-sm font-medium">
                Клиент
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
                Проект
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
                Активность
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
                Комментарий
                <textarea
                  className="min-h-24 rounded-md border border-slate-300 px-3 py-2"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Что вы делаете?"
                />
              </label>

              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={billable} onChange={(event) => setBillable(event.target.checked)} />
                Оплачиваемое
              </label>

              <div className="rounded-lg border border-cyan-200 bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-cyan)] px-4 py-6 text-center text-white shadow-sm shadow-cyan-100">
                <div className="text-sm text-cyan-50">Текущий таймер</div>
                <div className="mt-1 text-5xl font-semibold tabular-nums">{formatDuration(elapsedMinutes)}</div>
              </div>

              {timerStartedAt ? (
                <button
                  className="rounded-md bg-red-600 px-4 py-3 font-medium text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60"
                  disabled={isSaving}
                  onClick={stopTimer}
                >
                  Остановить и сохранить
                </button>
              ) : (
                <button
                  className="rounded-md bg-[var(--brand-cyan)] px-4 py-3 font-medium text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
                  disabled={!selectedProjectId || !selectedActivityId || (!!locksByDate[todayKey] && !canLockTime)}
                  onClick={startTimer}
                >
                  {locksByDate[todayKey] && !canLockTime ? 'Сегодня закрыто' : 'Запустить таймер'}
                </button>
              )}
            </div>
          </div>

          <form className="ui-card ui-card-section" onSubmit={saveManualEntry}>
            <h2 className="text-lg font-semibold">Ручная запись</h2>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-1 text-sm font-medium">
                Клиент
                <select
                  className="rounded-md border border-slate-300 px-3 py-2"
                  value={manualClientId}
                  onChange={(event) => {
                    setManualClientId(event.target.value);
                    setManualProjectId('');
                    setManualActivityId('');
                  }}
                >
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm font-medium">
                Проект
                <select
                  className="rounded-md border border-slate-300 px-3 py-2"
                  value={selectedManualProjectId}
                  onChange={(event) => {
                    setManualProjectId(event.target.value);
                    setManualActivityId('');
                  }}
                >
                  {filteredManualProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm font-medium">
                Активность
                <select
                  className="rounded-md border border-slate-300 px-3 py-2"
                  value={selectedManualActivityId}
                  onChange={(event) => setManualActivityId(event.target.value)}
                >
                  {filteredManualActivities.map((activity) => (
                    <option key={activity.id} value={activity.id}>
                      {activity.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm font-medium">
                Комментарий
                <textarea
                  className="min-h-24 rounded-md border border-slate-300 px-3 py-2"
                  value={manualDescription}
                  onChange={(event) => setManualDescription(event.target.value)}
                  placeholder="Что вы делаете?"
                />
              </label>

              <label className="grid gap-1 text-sm font-medium">
                Начало
                <input
                  className="rounded-md border border-slate-300 px-3 py-2"
                  type="datetime-local"
                  value={manualStart}
                  onChange={(event) => setManualStart(event.target.value)}
                />
              </label>

              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium">Длительность</div>
                  <div className="flex flex-wrap justify-end gap-1">
                    {[
                      { label: '15 мин', value: 15 },
                      { label: '30 мин', value: 30 },
                      { label: '1 час', value: 60 },
                      { label: '2 часа', value: 120 },
                    ].map((option) => (
                      <button
                        className="btn-secondary px-2 py-1 text-xs"
                        key={option.value}
                        onClick={() => setQuickManualDuration(option.value)}
                        type="button"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1 text-sm font-medium text-slate-600">
                    Часы
                    <input
                      className="rounded-md border border-slate-300 px-3 py-2 text-slate-950"
                      min="0"
                      type="number"
                      value={manualHours}
                      onChange={(event) => setManualHours(Number(event.target.value))}
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-slate-600">
                    Минуты
                    <input
                      className="rounded-md border border-slate-300 px-3 py-2 text-slate-950"
                      max="59"
                      min="0"
                      type="number"
                      value={manualMinutes}
                      onChange={(event) => setManualMinutes(Number(event.target.value))}
                    />
                  </label>
                </div>
              </div>

              <button
                className="btn-primary px-4 py-3 disabled:opacity-60"
                disabled={
                  isSaving ||
                  !selectedManualProjectId ||
                  !selectedManualActivityId ||
                  (!!locksByDate[toLocalDateKey(new Date(manualStart))] && !canLockTime)
                }
                type="submit"
              >
                {locksByDate[toLocalDateKey(new Date(manualStart))] && !canLockTime ? 'Дата закрыта' : 'Сохранить запись'}
              </button>
            </div>
          </form>
        </section>

        <section className="ui-card">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold">Записи за месяц</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-5 py-3 font-medium">Дата</th>
                  <th className="px-5 py-3 font-medium">Клиент</th>
                  <th className="px-5 py-3 font-medium">Проект</th>
                  <th className="px-5 py-3 font-medium">Активность</th>
                  <th className="px-5 py-3 font-medium">Длительность</th>
                  <th className="px-5 py-3 font-medium">Оплачиваемое</th>
                  <th className="px-5 py-3 font-medium">Комментарий</th>
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
                    <td className="px-5 py-3">{entry.billable ? 'Да' : 'Нет'}</td>
                    <td className="px-5 py-3">{entry.description || '-'}</td>
                  </tr>
                ))}
                {!entries.length && (
                  <tr>
                    <td className="px-5 py-8 text-center text-slate-500" colSpan={7}>
                      Записей времени пока нет.
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
