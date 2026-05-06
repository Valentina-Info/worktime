'use client';

import { useState } from 'react';
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
      setError('Invalid email or password');
      return;
    }

    router.push('/');
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm" onSubmit={handleSubmit}>
        <h1 className="text-2xl font-semibold text-slate-950">Sign in</h1>
        <p className="mt-1 text-sm text-slate-500">Use the demo account to open the MVP workspace.</p>

        {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <label className="mt-5 grid gap-1 text-sm font-medium text-slate-700">
          Email
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-slate-950"
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="mt-4 grid gap-1 text-sm font-medium text-slate-700">
          Password
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-slate-950"
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        <button className="mt-6 w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white" type="submit">
          Sign in
        </button>
      </form>
    </main>
  );
}
