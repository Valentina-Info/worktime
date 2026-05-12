import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { can } from '@/lib/access-control';
import { prisma } from '@/lib/prisma';

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

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Необходим вход в систему' }, { status: 401 });
  }

  if (!can(session.user.role, 'reports.team') && !can(session.user.role, 'reports.all')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId') || undefined;
  const projectId = searchParams.get('projectId') || undefined;
  const userId = searchParams.get('userId') || undefined;
  const from = parseDate(searchParams.get('from') ?? undefined);
  const to = parseDate(searchParams.get('to') ?? undefined);

  const [clients, projects, users, entries] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, currency: true, status: true },
    }),
    prisma.project.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        clientId: true,
        status: true,
        client: { select: { id: true, name: true, currency: true } },
      },
    }),
    prisma.user.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        position: {
          select: {
            id: true,
            title: true,
            department: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.timeEntry.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(projectId ? { projectId } : {}),
        ...(clientId ? { project: { clientId } } : {}),
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
      take: 2000,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            position: {
              select: {
                id: true,
                title: true,
                department: { select: { id: true, name: true } },
              },
            },
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            client: { select: { id: true, name: true, currency: true } },
          },
        },
        activity: { select: { id: true, name: true } },
      },
    }),
  ]);

  return NextResponse.json({ clients, projects, users, entries });
}
