'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { can, normalizeRole, roleLabels, type Permission } from '@/lib/access-control';

type AppShellProps = {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
  subtitle?: string;
  userEmail?: string | null;
  userRole?: string | null;
};

const navItems: Array<{ href: string; label: string; permission: Permission }> = [
  { href: '/', label: 'Время', permission: 'time.view' },
  { href: '/clients', label: 'Клиенты', permission: 'directories.view' },
  { href: '/projects', label: 'Проекты', permission: 'directories.view' },
  { href: '/activities', label: 'Активности', permission: 'directories.view' },
  { href: '/reports', label: 'Отчеты', permission: 'reports.team' },
  { href: '/users', label: 'Пользователи', permission: 'users.manage' },
];

export default function AppShell({ children, eyebrow, title, subtitle, userEmail, userRole }: AppShellProps) {
  const pathname = usePathname();
  const visibleNavItems = navItems.filter((item) => can(userRole, item.permission));
  const displayedRole = userRole ? roleLabels[normalizeRole(userRole)] : null;

  return (
    <main className="min-h-screen bg-[var(--surface-muted)] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col lg:flex-row">
        <aside className="border-b border-sky-100 bg-white/95 px-4 py-4 backdrop-blur lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
          <div className="flex items-center justify-between gap-4 lg:block">
            <Link href="/" className="block">
              <Image
                alt="ИнфоЛинк Трудоучет"
                className="h-auto w-40"
                height={54}
                priority
                src="/infolink-logo.png"
                width={230}
              />
              <div className="mt-3 hidden sm:block">
                <div className="text-sm font-semibold text-slate-900">ИнфоЛинк Трудоучет</div>
                <div className="mt-1 text-xs font-medium text-slate-500">Время, клиенты, проекты</div>
              </div>
            </Link>
            <button
              className="btn-secondary px-3 py-2 text-sm lg:hidden"
              onClick={() => signOut()}
              type="button"
            >
              Выйти
            </button>
          </div>

          <nav className="mt-4 flex gap-2 overflow-x-auto lg:mt-8 lg:grid">
            {visibleNavItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  className={
                    isActive
                      ? 'state-active rounded-md px-3 py-2 text-sm font-semibold shadow-sm'
                      : 'rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-cyan-50 hover:text-slate-950'
                  }
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ui-card ui-card-compact mt-8 hidden bg-cyan-50/70 lg:block">
            <div className="text-xs font-medium uppercase tracking-wide text-cyan-700">Вход выполнен</div>
            <div className="mt-2 break-words text-sm font-medium text-slate-800">{userEmail ?? 'Пользователь'}</div>
            {displayedRole && <div className="mt-1 text-xs font-semibold text-[var(--brand-blue)]">{displayedRole}</div>}
            <button
              className="btn-secondary mt-4 w-full px-3 py-2 text-sm"
              onClick={() => signOut()}
              type="button"
            >
              Выйти
            </button>
          </div>
        </aside>

        <section className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-6">
            <header className="flex flex-col gap-2">
              <p className="text-sm font-medium text-cyan-700">{eyebrow}</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h1 className="text-3xl font-semibold text-slate-950">{title}</h1>
                  {subtitle && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{subtitle}</p>}
                </div>
              </div>
            </header>

            {children}

            <footer className="border-t border-cyan-100 py-5 text-xs leading-5 text-slate-500">
              <div>© ООО «ИнфоЛинк», 2026.</div>
              <div>Правообладатель исключительных прав: ООО «ИнфоЛинк».</div>
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
}
