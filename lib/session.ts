import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function getCurrentUserId() {
  const session = await getServerSession(authOptions);

  return session?.user?.id ?? null;
}
