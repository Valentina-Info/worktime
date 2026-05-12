import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('organization.manage');

  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const organization = await prisma.organization.findUnique({
    where: { id },
    include: { _count: { select: { departments: true } } },
  });

  if (!organization) {
    return NextResponse.json({ error: 'Организация не найдена' }, { status: 404 });
  }

  if (organization._count.departments) {
    return NextResponse.json({ error: 'В организации есть подразделения. Сначала удалите их.' }, { status: 409 });
  }

  await prisma.organization.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
