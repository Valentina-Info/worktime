import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/permissions';
import { Role } from '@/app/generated/prisma/enums';

type UpdateUserBody = {
  name?: string;
  role?: string;
  password?: string;
  positionId?: string | null;
};

const roles = Object.values(Role);

function isRole(value: string | undefined): value is Role {
  return roles.includes(value as Role);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();

  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const body = (await request.json()) as UpdateUserBody;
  const name = body.name?.trim();
  const password = body.password ?? '';
  const role = isRole(body.role) ? body.role : undefined;
  const positionId = body.positionId || null;

  if (body.role && !role) {
    return NextResponse.json({ error: 'Некорректная роль' }, { status: 400 });
  }

  if (password && password.length < 8) {
    return NextResponse.json({ error: 'Пароль должен быть не короче 8 символов' }, { status: 400 });
  }

  const updateData: {
    name?: string;
    role?: Role;
    password?: string;
    positionId?: string | null;
  } = {};

  if (name) {
    updateData.name = name;
  }

  if (role) {
    updateData.role = role;
  }

  if (password) {
    updateData.password = await bcrypt.hash(password, 10);
  }

  if ('positionId' in body) {
    if (positionId) {
      const position = await prisma.position.findUnique({ where: { id: positionId }, select: { id: true } });

      if (!position) {
        return NextResponse.json({ error: 'Должность не найдена' }, { status: 404 });
      }
    }

    updateData.positionId = positionId;
  }

  if (!Object.keys(updateData).length) {
    return NextResponse.json({ error: 'Нет изменений для сохранения' }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      positionId: true,
      position: {
        select: {
          id: true,
          title: true,
          department: {
            select: {
              id: true,
              name: true,
              organization: { select: { id: true, name: true } },
            },
          },
        },
      },
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          assignedProjects: true,
          timeEntries: true,
        },
      },
    },
  });

  return NextResponse.json({ user });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();

  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;

  if (auth.session?.user?.id === id) {
    return NextResponse.json({ error: 'Нельзя удалить собственную учетную запись' }, { status: 409 });
  }

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          assignedProjects: true,
          expenses: true,
          timeEntries: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
  }

  if (user._count.assignedProjects || user._count.expenses || user._count.timeEntries) {
    return NextResponse.json({ error: 'У пользователя есть связанные записи. Оставьте учетную запись для истории.' }, { status: 409 });
  }

  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
