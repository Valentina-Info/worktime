'use client';

import { useState } from 'react';
import Image from 'next/image';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function SignIn() {
  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError('Неверная почта или пароль');
      return;
    }

    router.push('/');
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--surface-muted)] px-4 py-10 text-slate-950">
      <form className="ui-card w-full max-w-md p-7" onSubmit={handleSubmit}>
        <Image
          alt="ИнфоЛинк Трудоучет"
          className="h-auto w-56"
          height={70}
          priority
          src="/infolink-logo.png"
          width={300}
        />
        <h1 className="mt-6 text-3xl font-semibold">ИнфоЛинк Трудоучет</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Используйте учетную запись, чтобы открыть рабочую область учета времени.
        </p>

        {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <label className="mt-5 grid gap-1 text-sm font-medium text-slate-700">
          Почта
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-slate-950"
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="mt-4 grid gap-1 text-sm font-medium text-slate-700">
          Пароль
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-slate-950"
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        <button
          className="btn-primary mt-6 w-full px-4 py-3"
          type="submit"
        >
          Войти
        </button>
      </form>
    </main>
  );
}
