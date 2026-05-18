'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import Link from 'next/link';
import { KeyRound, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';

function AuthActionContent() {
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
      setMessage('The link appears to be incomplete. Please request a new password reset.');
      return;
    }

    if (mode === 'resetPassword') {
      verifyPasswordResetCode(auth, oobCode)
        .then((email) => {
          setEmail(email);
          setStatus('idle');
        })
        .catch((err) => {
          console.error('Verification Error:', err);
          setStatus('error');
          setMessage('This password reset link has expired or is invalid. Please request a new one.');
        });
    } else {
      setStatus('error');
      setMessage('This link is for a service that is not yet supported.');
    }
  }, [mode, oobCode]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 8) {
      setStatus('error');
      setMessage('For your security, passwords must be at least 8 characters long.');
      return;
    }

    if (!oobCode) return;

    setStatus('loading');
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setStatus('success');
      setMessage('Your password has been successfully updated. You can now sign in with your new credentials.');
      
      setTimeout(() => {
        router.push('/login');
      }, 4000);
    } catch (err: any) {
      console.error('Reset Error:', err);
      setStatus('error');
      setMessage(err.message || 'Failed to update your password. Please try requesting a new link.');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
        <Link href="/" className="inline-block mb-6">
          <img
            src="/images/logo-nav-v3.png"
            alt="Yorkshire Businesswoman"
            className="h-12 w-auto"
          />
        </Link>
        <h2 className="text-3xl font-serif font-medium tracking-tight text-foreground">
          {status === 'success' ? 'Update Successful' : 'Secure Your Account'}
        </h2>
        {email && status === 'idle' && (
          <p className="mt-2 text-sm text-muted-foreground">
            Setting a new password for <span className="text-foreground font-medium">{email}</span>
          </p>
        )}
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-card py-10 px-8 shadow-xl rounded-2xl border border-border">
          
          {status === 'verifying' && (
            <div className="text-center py-6">
              <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-accent border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
                <span className="sr-only">Verifying...</span>
              </div>
              <p className="mt-6 text-muted-foreground font-medium">Verifying your secure link...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center animate-in fade-in zoom-in duration-500">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 mb-6">
                <CheckCircle className="h-8 w-8 text-accent" />
              </div>
              <p className="text-foreground text-lg mb-8 leading-relaxed">
                {message}
              </p>
              <div className="space-y-4">
                <Link
                  href="/login"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-4 px-6 text-sm font-semibold text-accent-foreground shadow-lg shadow-accent/20 hover:bg-accent/90 transition-all"
                >
                  Sign in to your account
                </Link>
              </div>
            </div>
          )}

          {(status === 'idle' || status === 'loading' || (status === 'error' && mode === 'resetPassword' && oobCode)) && (
            <form className="space-y-6" onSubmit={handleReset}>
              {status === 'error' && (
                <div className="rounded-xl bg-destructive/10 p-4 border border-destructive/20 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                    <p className="text-sm font-medium text-destructive">{message}</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-foreground/70 ml-1"
                >
                  Choose a New Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <KeyRound className="h-5 w-5 text-muted-foreground group-focus-within:text-accent transition-colors" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className="block w-full rounded-xl border border-input bg-background pl-11 pr-4 py-3.5 text-foreground placeholder-muted-foreground focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/5 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={status === 'loading'}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-4 px-6 text-sm font-semibold text-accent-foreground shadow-lg shadow-accent/20 hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                {status === 'loading' ? (
                  <>
                    <svg className="h-5 w-5 animate-spin mr-2" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Updating Password...
                  </>
                ) : (
                  'Update Password'
                )}
              </button>
            </form>
          )}

          {status === 'error' && (!mode || !oobCode) && (
            <div className="text-center animate-in fade-in duration-500">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-6">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">Invalid Link</h3>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                {message}
              </p>
              <Link
                href="/forgot-password"
                className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:text-accent/80 transition-colors bg-accent/5 px-6 py-3 rounded-full"
              >
                <ArrowLeft className="h-4 w-4" />
                Request a new link
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default function AuthActionPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[80vh] flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-emerald-600 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
            <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">Loading...</span>
          </div>
        </div>
      </div>
    }>
      <AuthActionContent />
    </Suspense>
  );
}
