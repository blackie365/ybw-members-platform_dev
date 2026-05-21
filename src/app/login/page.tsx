'use client';

import { SignIn } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginForm() {
  const searchParams = useSearchParams();
  const fallbackRedirect = searchParams.get('returnUrl') || '/dashboard';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-5xl bg-card rounded-2xl overflow-hidden shadow-xl border border-border">
        {/* Left side - Decorative (Hidden on mobile) */}
        <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden p-12 flex-col justify-center">
          <div className="absolute inset-0 opacity-[0.03]">
            <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-accent" />
            <div className="absolute -bottom-32 right-0 h-[500px] w-[500px] rounded-full bg-accent" />
          </div>
          <div className="relative">
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-accent">
              Welcome Back
            </span>
            <h1 className="mt-4 font-serif text-4xl font-medium text-primary-foreground xl:text-5xl">
              Sign in to your member account
            </h1>
            <p className="mt-6 text-primary-foreground/70 leading-relaxed">
              Access exclusive content, connect with fellow businesswomen, and unlock opportunities designed to help you grow.
            </p>
            
            <div className="mt-12 space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10">
                  <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium text-primary-foreground">Exclusive Content</h3>
                  <p className="mt-1 text-sm text-primary-foreground/60">Access premium articles and insights</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Clerk SignIn */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background min-h-[500px]">
          <SignIn 
            fallbackRedirectUrl={fallbackRedirect}
            signUpUrl="/register"
          />
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
