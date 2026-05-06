import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/session';

type CreateTimeEntryBody = {
  projectId?: string;
  activityId?: string;
  startTime?: string;
  endTime?: string | null;
  duration?: number;
  description?: string;
  billable?: boolean;
  tags?: string[];
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

export async function GET() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const entries = await prisma.timeEntry.findMany({
    where: { userId },
    orderBy: { startTime: 'desc' },
    take: 50,
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
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as CreateTimeEntryBody;
  const startTime = parseDate(body.startTime);
  const endTime = parseDate(body.endTime ?? undefined);
  const duration = Number(body.duration);

  if (!body.projectId || !body.activityId || !startTime || !Number.isFinite(duration) || duration <= 0) {
    return NextResponse.json({ error: 'Invalid time entry data' }, { status: 400 });
  }

  const [project, activity] = await Promise.all([
    prisma.project.findUnique({ where: { id: body.projectId }, select: { id: true, rate: true } }),
    prisma.activity.findUnique({ where: { id: body.activityId }, select: { id: true, projectId: true, rate: true } }),
  ]);

  if (!project || !activity) {
    return NextResponse.json({ error: 'Project or activity not found' }, { status: 404 });
  }

  if (activity.projectId && activity.projectId !== project.id) {
    return NextResponse.json({ error: 'Activity does not belong to selected project' }, { status: 400 });
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
