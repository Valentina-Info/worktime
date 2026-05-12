import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/permissions';
import { Role } from '@/app/generated/prisma/enums';

type CreateUserBody = {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
  positionId?: string | null;
};

const roles = Object.values(Role);

function isRole(value: string | undefined): value is Role {
  return roles.includes(value as Role);
}

export async function GET() {
  const auth = await requireAdmin();

  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
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

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();

  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as CreateUserBody;
  const email = body.email?.trim().toLowerCase();
  const name = body.name?.trim();
  const password = body.password ?? '';
  const role = isRole(body.role) ? body.role : Role.USER;
  const positionId = body.positionId || null;

  if (!email || !name || password.length < 8) {
    return NextResponse.json({ error: 'Укажите имя, почту и пароль не короче 8 символов' }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    return NextResponse.json({ error: 'Пользователь с такой почтой уже существует' }, { status: 409 });
  }

  if (positionId) {
    const position = await prisma.position.findUnique({ where: { id: positionId }, select: { id: true } });

    if (!position) {
      return NextResponse.json({ error: 'Должность не найдена' }, { status: 404 });
    }
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      name,
      password: hashedPassword,
      role,
      positionId,
    },
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

  return NextResponse.json({ user }, { status: 201 });
}
