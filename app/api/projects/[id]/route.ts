import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';

type ProjectBody = {
  name?: string;
  clientId?: string;
  description?: string;
  budgetHours?: number | null;
  budgetMoney?: number | null;
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
  const body = (await request.json()) as ProjectBody;
  const name = body.name?.trim();

  if (!name || !body.clientId) {
    return NextResponse.json({ error: 'Укажите название проекта и клиента' }, { status: 400 });
  }

  const [projectExists, clientExists] = await Promise.all([
    prisma.project.findUnique({ where: { id }, select: { id: true } }),
    prisma.client.findUnique({ where: { id: body.clientId }, select: { id: true } }),
  ]);

  if (!projectExists) {
    return NextResponse.json({ error: 'Проект не найден' }, { status: 404 });
  }

  if (!clientExists) {
    return NextResponse.json({ error: 'Клиент не найден' }, { status: 404 });
  }

  const project = await prisma.project.update({
    where: { id },
    data: {
      name,
      clientId: clientExists.id,
      description: body.description?.trim() || null,
      budgetHours: optionalNumber(body.budgetHours),
      budgetMoney: optionalNumber(body.budgetMoney),
      rate: optionalNumber(body.rate),
      status: body.status ?? 'ACTIVE',
    },
    include: {
      client: { select: { id: true, name: true, currency: true } },
      _count: { select: { activities: true, timeEntries: true, users: true } },
    },
  });

  return NextResponse.json({ project });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('directories.delete');

  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      _count: { select: { activities: true, timeEntries: true, expenses: true, users: true } },
    },
  });

  if (!project) {
    return NextResponse.json({ error: 'Проект не найден' }, { status: 404 });
  }

  if (project._count.activities || project._count.timeEntries || project._count.expenses || project._count.users) {
    return NextResponse.json({ error: 'У проекта есть связанные записи. Перенесите его в архив.' }, { status: 409 });
  }

  await prisma.project.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
