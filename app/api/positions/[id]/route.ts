import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';

type PositionBody = {
  title?: string;
  departmentId?: string;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('organization.manage');

  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const body = (await request.json()) as PositionBody;
  const title = body.title?.trim();

  if (!title || !body.departmentId) {
    return NextResponse.json({ error: 'Укажите название должности и подразделение' }, { status: 400 });
  }

  const position = await prisma.position.update({
    where: { id },
    data: {
      title,
      departmentId: body.departmentId,
    },
    include: {
      department: {
        select: {
          id: true,
          name: true,
          organization: { select: { id: true, name: true } },
        },
      },
      _count: { select: { users: true } },
    },
  });

  return NextResponse.json({ position });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('organization.manage');

  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const position = await prisma.position.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });

  if (!position) {
    return NextResponse.json({ error: 'Должность не найдена' }, { status: 404 });
  }

  if (position._count.users) {
    return NextResponse.json({ error: 'К должности привязаны пользователи. Сначала переназначьте их.' }, { status: 409 });
  }

  await prisma.position.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
