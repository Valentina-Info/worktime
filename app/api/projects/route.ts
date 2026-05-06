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

export async function GET() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [clients, projects] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, currency: true, status: true },
    }),
    prisma.project.findMany({
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      include: {
        client: { select: { id: true, name: true, currency: true } },
        _count: { select: { activities: true, timeEntries: true, users: true } },
      },
    }),
  ]);

  return NextResponse.json({ clients, projects });
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as ProjectBody;
  const name = body.name?.trim();

  if (!name || !body.clientId) {
    return NextResponse.json({ error: 'Project name and client are required' }, { status: 400 });
  }

  const client = await prisma.client.findUnique({
    where: { id: body.clientId },
    select: { id: true },
  });

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  const project = await prisma.project.create({
    data: {
      name,
      clientId: client.id,
      description: body.description?.trim() || null,
      budgetHours: optionalNumber(body.budgetHours),
      budgetMoney: optionalNumber(body.budgetMoney),
      rate: optionalNumber(body.rate),
      status: body.status ?? 'ACTIVE',
      users: { connect: { id: userId } },
      activities: {
        create: {
          name: 'General',
          rate: optionalNumber(body.rate),
          status: 'ACTIVE',
        },
      },
    },
    include: {
      client: { select: { id: true, name: true, currency: true } },
      _count: { select: { activities: true, timeEntries: true, users: true } },
    },
  });

  return NextResponse.json({ project }, { status: 201 });
}
