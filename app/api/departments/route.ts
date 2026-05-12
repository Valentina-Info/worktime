import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';

type DepartmentBody = {
  name?: string;
  organizationId?: string;
};

export async function POST(request: Request) {
  const auth = await requirePermission('organization.manage');

  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as DepartmentBody;
  const name = body.name?.trim();

  if (!name || !body.organizationId) {
    return NextResponse.json({ error: 'Укажите название подразделения и организацию' }, { status: 400 });
  }

  const department = await prisma.department.create({
    data: {
      name,
      organizationId: body.organizationId,
    },
    include: {
      positions: {
        orderBy: { title: 'asc' },
        include: { _count: { select: { users: true } } },
      },
    },
  });

  return NextResponse.json({ department }, { status: 201 });
}
