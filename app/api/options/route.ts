import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/session';

export async function GET() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ error: 'Необходим вход в систему' }, { status: 401 });
  }

  const [clients, projects, activities] = await Promise.all([
    prisma.client.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, currency: true },
    }),
    prisma.project.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, clientId: true, rate: true },
    }),
    prisma.activity.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, projectId: true, rate: true },
    }),
  ]);

  return NextResponse.json({ clients, projects, activities });
}
