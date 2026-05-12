import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('directories.edit');

  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const body = (await request.json()) as ActivityBody;
  const name = body.name?.trim();
  const projectId = body.projectId || null;

  if (!name) {
    return NextResponse.json({ error: 'Укажите название активности' }, { status: 400 });
  }

  const [activityExists, projectExists] = await Promise.all([
    prisma.activity.findUnique({ where: { id }, select: { id: true } }),
    projectId ? prisma.project.findUnique({ where: { id: projectId }, select: { id: true } }) : Promise.resolve(null),
  ]);

  if (!activityExists) {
    return NextResponse.json({ error: 'Активность не найдена' }, { status: 404 });
  }

  if (projectId && !projectExists) {
    return NextResponse.json({ error: 'Проект не найден' }, { status: 404 });
  }

  const activity = await prisma.activity.update({
    where: { id },
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

  return NextResponse.json({ activity });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('directories.delete');

  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const activity = await prisma.activity.findUnique({
    where: { id },
    include: { _count: { select: { timeEntries: true } } },
  });

  if (!activity) {
    return NextResponse.json({ error: 'Активность не найдена' }, { status: 404 });
  }

  if (activity._count.timeEntries) {
    return NextResponse.json({ error: 'У активности есть записи времени. Перенесите ее в архив.' }, { status: 409 });
  }

  await prisma.activity.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
