'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

type AppShellProps = {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
  subtitle?: string;
  userEmail?: string | null;
};

const navItems = [
  { href: '/', label: 'Time' },
  { href: '/clients', label: 'Clients' },
  { href: '/projects', label: 'Projects' },
];

export default function AppShell({ children, eyebrow, title, subtitle, userEmail }: AppShellProps) {
  const pathname = usePathname();

  return (
    <main className="min-h-screen bg-[var(--surface-muted)] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col lg:flex-row">
        <aside className="border-b border-sky-100 bg-white/95 px-4 py-4 backdrop-blur lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
          <div className="flex items-center justify-between gap-4 lg:block">
            <Link href="/" className="block">
              <Image
                alt="Инфолинк"
                className="h-auto w-40"
                height={54}
                priority
                src="/infolink-logo.png"
                width={230}
              />
              <div className="mt-3 hidden text-xs font-medium text-slate-500 sm:block">Time, clients, projects</div>
            </Link>
            <button
              className="rounded-md border border-sky-100 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50 lg:hidden"
              onClick={() => signOut()}
              type="button"
            >
              Sign out
            </button>
          </div>

          <nav className="mt-4 flex gap-2 overflow-x-auto lg:mt-8 lg:grid">
            {navItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  className={
                    isActive
                      ? 'rounded-md bg-[var(--brand-blue)] px-3 py-2 text-sm font-medium text-white shadow-sm shadow-blue-200'
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

          <div className="mt-8 hidden rounded-lg border border-cyan-100 bg-cyan-50/70 p-4 lg:block">
            <div className="text-xs font-medium uppercase tracking-wide text-cyan-700">Signed in</div>
            <div className="mt-2 break-words text-sm font-medium text-slate-800">{userEmail ?? 'Workspace user'}</div>
            <button
              className="mt-4 w-full rounded-md bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-cyan-100 transition hover:bg-cyan-50"
              onClick={() => signOut()}
              type="button"
            >
              Sign out
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
