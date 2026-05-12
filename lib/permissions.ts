import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { can, type Permission } from '@/lib/access-control';

export async function requirePermission(permission: Permission) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { session: null, error: 'Необходим вход в систему', status: 401 };
  }

  if (!can(session.user.role, permission)) {
    return { session, error: 'Недостаточно прав', status: 403 };
  }

  return { session, error: null, status: 200 };
}

export async function requireAdmin() {
  return requirePermission('users.manage');
}
