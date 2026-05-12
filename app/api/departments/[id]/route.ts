import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';

type DepartmentBody = {
  name?: string;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('organization.manage');

  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const body = (await request.json()) as DepartmentBody;
  const name = body.name?.trim();

  if (!name) {
    return NextResponse.json({ error: 'Укажите название подразделения' }, { status: 400 });
  }

  const department = await prisma.department.update({
    where: { id },
    data: { name },
    include: {
      positions: {
        orderBy: { title: 'asc' },
        include: { _count: { select: { users: true } } },
      },
    },
  });

  return NextResponse.json({ department });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('organization.manage');

  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const department = await prisma.department.findUnique({
    where: { id },
    include: { _count: { select: { positions: true } } },
  });

  if (!department) {
    return NextResponse.json({ error: 'Подразделение не найдено' }, { status: 404 });
  }

  if (department._count.positions) {
    return NextResponse.json({ error: 'В подразделении есть должности. Сначала удалите или перенесите их.' }, { status: 409 });
  }

  await prisma.department.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
