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

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json()) as ClientBody;
  const name = body.name?.trim();

  if (!name) {
    return NextResponse.json({ error: 'Client name is required' }, { status: 400 });
  }

  const exists = await prisma.client.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!exists) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  const client = await prisma.client.update({
    where: { id },
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

  return NextResponse.json({ client });
}
