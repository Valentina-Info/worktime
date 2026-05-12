import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';

type OrganizationBody = {
  id?: string;
  name?: string;
  inn?: string;
  kpp?: string;
};

const includeStructure = {
  departments: {
    orderBy: { name: 'asc' as const },
    include: {
      positions: {
        orderBy: { title: 'asc' as const },
        include: { _count: { select: { users: true } } },
      },
    },
  },
};

export async function GET() {
  const auth = await requirePermission('organization.manage');

  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: 'asc' },
    include: includeStructure,
  });

  return NextResponse.json({ organization: organizations[0] ?? null, organizations });
}

export async function POST(request: Request) {
  const auth = await requirePermission('organization.manage');

  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as OrganizationBody;
  const name = body.name?.trim();
  const inn = body.inn?.trim() ?? '';
  const kpp = body.kpp?.trim() ?? '';

  if (!name) {
    return NextResponse.json({ error: 'Укажите название организации' }, { status: 400 });
  }

  const organization = body.id
    ? await prisma.organization.update({
        where: { id: body.id },
        data: { name, inn, kpp },
        include: includeStructure,
      })
    : await prisma.organization.create({
        data: { name, inn, kpp },
        include: includeStructure,
      });

  return NextResponse.json({ organization }, { status: body.id ? 200 : 201 });
}
