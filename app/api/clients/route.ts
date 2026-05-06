import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/session';

type ClientBody = {
  name?: string;
  contact?: string;
  email?: string;
  phone?: string;
  address?: string;
  currency?: string;
  status?: 'ACTIVE' | 'ARCHIVED';
};

function normalizeCurrency(value: string | undefined) {
  const currency = value?.trim().toUpperCase();

  if (!currency) {
    return 'USD';
  }

  return currency.slice(0, 8);
}

export async function GET() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clients = await prisma.client.findMany({
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
    include: {
      _count: {
        select: {
          projects: true,
          expenses: true,
          invoices: true,
        },
      },
    },
  });

  return NextResponse.json({ clients });
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as ClientBody;
  const name = body.name?.trim();

  if (!name) {
    return NextResponse.json({ error: 'Client name is required' }, { status: 400 });
  }

  const client = await prisma.client.create({
    data: {
      name,
      contact: null,
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      address: body.address?.trim() || null,
      currency: normalizeCurrency(body.currency),
      status: body.status ?? 'ACTIVE',
    },
    include: {
      _count: {
        select: {
          projects: true,
          expenses: true,
          invoices: true,
        },
      },
    },
  });

  return NextResponse.json({ client }, { status: 201 });
}
