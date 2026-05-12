import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';

type PositionBody = {
  title?: string;
  departmentId?: string;
};

export async function POST(request: Request) {
  const auth = await requirePermission('organization.manage');

  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as PositionBody;
  const title = body.title?.trim();

  if (!title || !body.departmentId) {
    return NextResponse.json({ error: 'Укажите название должности и подразделение' }, { status: 400 });
  }

  const position = await prisma.position.create({
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

  return NextResponse.json({ position }, { status: 201 });
}
