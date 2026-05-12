import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';

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
  const auth = await requirePermission('directories.edit');

  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const body = (await request.json()) as ClientBody;
  const name = body.name?.trim();

  if (!name) {
    return NextResponse.json({ error: 'Укажите название клиента' }, { status: 400 });
  }

  const exists = await prisma.client.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!exists) {
    return NextResponse.json({ error: 'Клиент не найден' }, { status: 404 });
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

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('directories.delete');

  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
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

  if (!client) {
    return NextResponse.json({ error: 'Клиент не найден' }, { status: 404 });
  }

  if (client._count.projects || client._count.expenses || client._count.invoices) {
    return NextResponse.json({ error: 'У клиента есть связанные записи. Перенесите его в архив.' }, { status: 409 });
  }

  await prisma.client.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
