import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/session';

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
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json()) as ProjectBody;
  const name = body.name?.trim();

  if (!name || !body.clientId) {
    return NextResponse.json({ error: 'Project name and client are required' }, { status: 400 });
  }

  const [projectExists, clientExists] = await Promise.all([
    prisma.project.findUnique({ where: { id }, select: { id: true } }),
    prisma.client.findUnique({ where: { id: body.clientId }, select: { id: true } }),
  ]);

  if (!projectExists) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  if (!clientExists) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
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
