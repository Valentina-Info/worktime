import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/session';
import { requirePermission } from '@/lib/permissions';

type ActivityBody = {
  name?: string;
  projectId?: string | null;
  rate?: number | null;
  status?: 'ACTIVE' | 'ARCHIVED';
};

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ error: 'Необходим вход в систему' }, { status: 401 });
  }

  const [projects, activities] = await Promise.all([
    prisma.project.findMany({
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        status: true,
        client: { select: { id: true, name: true, currency: true } },
      },
    }),
    prisma.activity.findMany({
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      include: {
        project: {
          select: {
            id: true,
            name: true,
            client: { select: { id: true, name: true, currency: true } },
          },
        },
        _count: { select: { timeEntries: true } },
      },
    }),
  ]);

  return NextResponse.json({ projects, activities });
}

export async function POST(request: Request) {
  const auth = await requirePermission('directories.edit');

  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as ActivityBody;
  const name = body.name?.trim();
  const projectId = body.projectId || null;

  if (!name) {
    return NextResponse.json({ error: 'Укажите название активности' }, { status: 400 });
  }

  if (projectId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Проект не найден' }, { status: 404 });
    }
  }

  const activity = await prisma.activity.create({
    data: {
      name,
      projectId,
      rate: optionalNumber(body.rate),
      status: body.status ?? 'ACTIVE',
    },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          client: { select: { id: true, name: true, currency: true } },
        },
      },
      _count: { select: { timeEntries: true } },
    },
  });

  return NextResponse.json({ activity }, { status: 201 });
}
