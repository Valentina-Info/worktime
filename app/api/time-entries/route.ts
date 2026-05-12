import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { can } from '@/lib/access-control';

type CreateTimeEntryBody = {
  projectId?: string;
  activityId?: string;
  startTime?: string;
  endTime?: string | null;
  duration?: number;
  description?: string;
  billable?: boolean;
  tags?: string[];
  dateKey?: string;
};

function parseDate(value: string | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Необходим вход в систему' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = parseDate(searchParams.get('from') ?? undefined);
  const to = parseDate(searchParams.get('to') ?? undefined);

  const entries = await prisma.timeEntry.findMany({
    where: {
      userId,
      ...(from || to
        ? {
            startTime: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lt: to } : {}),
            },
          }
        : {}),
    },
    orderBy: { startTime: 'desc' },
    take: 500,
    include: {
      project: {
        select: {
          id: true,
          name: true,
          client: { select: { id: true, name: true, currency: true } },
        },
      },
      activity: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Необходим вход в систему' }, { status: 401 });
  }

  const body = (await request.json()) as CreateTimeEntryBody;
  const startTime = parseDate(body.startTime);
  const endTime = parseDate(body.endTime ?? undefined);
  const duration = Number(body.duration);

  if (!body.projectId || !body.activityId || !startTime || !Number.isFinite(duration) || duration <= 0) {
    return NextResponse.json({ error: 'Некорректные данные записи времени' }, { status: 400 });
  }

  const dateKey = body.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(body.dateKey) ? body.dateKey : toDateKey(startTime);

  if (!can(session.user.role, 'time.lock')) {
    const lock = await prisma.timeDayLock.findUnique({
      where: { dateKey },
      select: { id: true },
    });

    if (lock) {
      return NextResponse.json({ error: 'Эта дата закрыта для редактирования' }, { status: 423 });
    }
  }

  const entryEndTime = endTime ?? new Date(startTime.getTime() + Math.round(duration) * 60000);
  const overlappingEntry = await prisma.timeEntry.findFirst({
    where: {
      userId,
      startTime: { lt: entryEndTime },
      OR: [
        { endTime: { gt: startTime } },
        {
          endTime: null,
          startTime: { gt: new Date(startTime.getTime() - 24 * 60 * 60000) },
        },
      ],
    },
    select: {
      id: true,
      startTime: true,
      endTime: true,
      duration: true,
      project: { select: { name: true } },
    },
  });

  if (overlappingEntry) {
    return NextResponse.json(
      {
        error: 'Запись пересекается с уже внесенной работой',
        conflict: {
          id: overlappingEntry.id,
          startTime: overlappingEntry.startTime,
          endTime: overlappingEntry.endTime,
          duration: overlappingEntry.duration,
          projectName: overlappingEntry.project.name,
        },
      },
      { status: 409 },
    );
  }

  const [project, activity] = await Promise.all([
    prisma.project.findUnique({ where: { id: body.projectId }, select: { id: true, rate: true } }),
    prisma.activity.findUnique({ where: { id: body.activityId }, select: { id: true, projectId: true, rate: true } }),
  ]);

  if (!project || !activity) {
    return NextResponse.json({ error: 'Проект или активность не найдены' }, { status: 404 });
  }

  if (activity.projectId && activity.projectId !== project.id) {
    return NextResponse.json({ error: 'Активность не относится к выбранному проекту' }, { status: 400 });
  }

  const entry = await prisma.timeEntry.create({
    data: {
      userId,
      projectId: project.id,
      activityId: activity.id,
      startTime,
      endTime,
      duration: Math.round(duration),
      description: body.description?.trim() || null,
      billable: body.billable ?? true,
      rate: activity.rate ?? project.rate,
      tags: body.tags ?? [],
    },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          client: { select: { id: true, name: true, currency: true } },
        },
      },
      activity: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ entry }, { status: 201 });
}
