'use client';

import { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import Link from 'next/link';
import { getFriendlyAuthErrorMessage } from '@/lib/authErrors';
import { ArrowLeft, ArrowRight, Mail, CheckCircle, KeyRound } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus('loading');
    setMessage('');

    try {
      await sendPasswordResetEmail(auth, email);
      setStatus('success');
      setMessage('Password reset email sent! Check your inbox for further instructions.');
    } catch (err: unknown) {
      console.error('Password reset error:', err);
      setStatus('error');
      setMessage(getFriendlyAuthErrorMessage(err));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex min-h-screen">
        {/* Left Panel - Decorative */}
        <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent_50%)]" />
            <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/20 to-transparent" />
          </div>
          
          <div className="relative z-10 flex flex-col justify-center px-12 lg:px-16 py-12">
            <div className="mb-12">
              <Link href="/" className="inline-block">
                <span className="font-serif text-2xl font-medium text-primary-foreground">
                  Yorkshire Businesswoman
                </span>
              </Link>
            </div>
            
            <div className="space-y-8 max-w-md">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-sm text-primary-foreground/90 text-xs font-medium uppercase tracking-wider mb-6">
                  <KeyRound className="w-3.5 h-3.5" />
                  Account Recovery
                </div>
                <h1 className="font-serif text-4xl lg:text-5xl font-medium text-primary-foreground leading-tight mb-4">
                  Forgot your password?
                </h1>
                <p className="text-primary-foreground/70 text-lg leading-relaxed">
                  No worries. Enter your email and we&apos;ll send you a link to reset your password.
                </p>
              </div>

              <div className="flex items-start gap-4 pt-4">
                <div className="flex-shrink-0 w-10 h-10 bg-white/10 backdrop-blur-sm flex items-center justify-center">
                  <Mail className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-medium text-primary-foreground mb-1">Check your email</h3>
                  <p className="text-sm text-primary-foreground/60">
                    We&apos;ll send you a secure link to reset your password within minutes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Form */}
        <div className="flex flex-1 flex-col justify-center px-6 py-12 lg:px-12 xl:px-20">
          <div className="mx-auto w-full max-w-md">
            {/* Mobile Logo */}
            <div className="lg:hidden text-center mb-8">
              <Link href="/" className="inline-block">
                <span className="font-serif text-xl font-medium text-foreground">
                  Yorkshire Businesswoman
                </span>
              </Link>
            </div>

            {status === 'success' ? (
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 mb-6">
                  <CheckCircle className="h-8 w-8 text-accent" />
                </div>
                <h2 className="font-serif text-2xl lg:text-3xl font-medium tracking-tight text-foreground mb-3">
                  Check your email
                </h2>
                <p className="text-muted-foreground mb-8">
                  {message}
                </p>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:text-accent/80 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Return to sign in
                </Link>
              </div>
            ) : (
              <>
                <div className="text-center lg:text-left mb-8">
                  <h2 className="font-serif text-2xl lg:text-3xl font-medium tracking-tight text-foreground">
                    Reset your password
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Enter your email address and we&apos;ll send you a link to reset your password.
                  </p>
                </div>

                <form className="space-y-6" onSubmit={handleResetPassword}>
                  {status === 'error' && (
                    <div className="rounded-lg bg-destructive/10 p-4 border border-destructive/20">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-destructive" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-destructive">{message}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
                      Email address
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground placeholder-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-colors"
                      placeholder="you@example.com"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-3 px-4 text-sm font-semibold text-accent-foreground shadow-sm hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {status === 'loading' ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Sending...
                      </>
                    ) : (
                      <>
                        Send reset link
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                  
                  <div className="text-center">
                    <Link
                      href="/login"
                      className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:text-accent/80 transition-colors"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to sign in
                    </Link>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
