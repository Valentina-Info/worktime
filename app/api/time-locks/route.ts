import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/session';
import { requirePermission } from '@/lib/permissions';

type TimeLockBody = {
  dateKey?: string;
  locked?: boolean;
};

function isDateKey(value: string | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(request: Request) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ error: 'Необходим вход в систему' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from') ?? undefined;
  const to = searchParams.get('to') ?? undefined;

  const locks = await prisma.timeDayLock.findMany({
    where: {
      locked: true,
      ...(from || to
        ? {
            dateKey: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lt: to } : {}),
            },
          }
        : {}),
    },
    orderBy: { dateKey: 'asc' },
    include: { lockedBy: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({ locks });
}

export async function POST(request: Request) {
  const auth = await requirePermission('time.lock');

  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as TimeLockBody;

  if (!isDateKey(body.dateKey)) {
    return NextResponse.json({ error: 'Укажите корректную дату' }, { status: 400 });
  }

  const locked = body.locked ?? true;

  if (!locked) {
    await prisma.timeDayLock.deleteMany({ where: { dateKey: body.dateKey } });
    return NextResponse.json({ lock: null });
  }

  const lock = await prisma.timeDayLock.upsert({
    where: { dateKey: body.dateKey },
    update: {
      locked: true,
      lockedById: auth.session!.user.id!,
    },
    create: {
      dateKey: body.dateKey,
      locked: true,
      lockedById: auth.session!.user.id!,
    },
    include: { lockedBy: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({ lock });
}
