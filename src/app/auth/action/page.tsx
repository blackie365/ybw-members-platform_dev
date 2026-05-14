'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import Link from 'next/link';

export default function AuthActionPage() {
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'verifying' | 'idle' | 'loading' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const mode = searchParams.get('mode');
  const oobCode = searchParams.get('oobCode');

  useEffect(() => {
    if (!mode || !oobCode) {
      setStatus('error');
      setMessage('Invalid or missing authentication code.');
      return;
    }

    if (mode === 'resetPassword') {
      verifyPasswordResetCode(auth, oobCode)
        .then((email) => {
          setEmail(email);
          setStatus('idle');
        })
        .catch((err) => {
          console.error(err);
          setStatus('error');
          setMessage('This password reset link has expired or is invalid. Please request a new one.');
        });
    } else {
      setStatus('error');
      setMessage('Unsupported authentication mode.');
    }
  }, [mode, oobCode]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      setStatus('error');
      setMessage('Password must be at least 6 characters long.');
      return;
    }

    if (!oobCode) return;

    setStatus('loading');
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setStatus('success');
      setMessage('Your password has been successfully reset.');
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setMessage(err.message || 'Failed to reset password. Please try again.');
    }
  };

  return (
    <div className="flex min-h-[80vh] flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
          {status === 'success' ? 'Password Reset Complete' : 'Create New Password'}
        </h2>
        {email && status === 'idle' && (
          <p className="mt-2 text-center text-sm text-zinc-600 dark:text-zinc-400">
            For {email}
          </p>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-zinc-900 py-8 px-4 shadow sm:rounded-2xl sm:px-10 ring-1 ring-zinc-900/5 dark:ring-white/10">
          
          {status === 'verifying' && (
            <div className="text-center py-4">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-emerald-600 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
                <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">Loading...</span>
              </div>
              <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">Verifying link...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <svg className="h-6 w-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <p className="mt-4 text-sm text-zinc-900 dark:text-white font-medium">
                {message}
              </p>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Redirecting you to login...
              </p>
              <div className="mt-6">
                <Link
                  href="/login"
                  className="text-sm font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
                >
                  Click here if not redirected
                </Link>
              </div>
            </div>
          )}

          {(status === 'idle' || status === 'loading' || (status === 'error' && mode === 'resetPassword' && oobCode)) && (
            <form className="space-y-6" onSubmit={handleReset}>
              {status === 'error' && (
                <div className="rounded-md bg-red-50 dark:bg-red-900/30 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400 dark:text-red-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
                      <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                        <p>{message}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  New Password
                </label>
                <div className="mt-1">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full appearance-none rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-emerald-500 sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="flex w-full justify-center rounded-xl border border-transparent bg-indigo-600 py-2.5 px-4 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:focus:ring-offset-zinc-900 transition-colors"
                >
                  {status === 'loading' ? 'Saving...' : 'Save new password'}
                </button>
              </div>
            </form>
          )}

          {status === 'error' && (!mode || !oobCode) && (
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="mt-3 text-sm font-medium text-zinc-900 dark:text-white">Invalid Link</h3>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                {message}
              </p>
              <div className="mt-6">
                <Link
                  href="/forgot-password"
                  className="text-sm font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
                >
                  Request a new reset link
                </Link>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
