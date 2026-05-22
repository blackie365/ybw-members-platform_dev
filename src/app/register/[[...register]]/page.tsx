'use client';

import { SignUp } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Sparkles, Users, BookOpen, Calendar } from 'lucide-react';

function RegisterForm() {
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan');
  const cycle = searchParams.get('cycle') || 'monthly';
  
  // If they have a plan, redirect them to a checkout session after sign up
  // Otherwise, go to the dashboard
  const afterSignUpUrl = plan === 'premium' 
    ? `/api/stripe/checkout?plan=premium&cycle=${cycle}`
    : '/dashboard';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 py-12">
      <div className="flex w-full max-w-6xl bg-card rounded-2xl overflow-hidden shadow-xl border border-border">
        {/* Left side - Benefits (Hidden on mobile) */}
        <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden p-12 flex-col justify-center">
          <div className="absolute inset-0 opacity-[0.03]">
            <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-accent" />
            <div className="absolute -bottom-32 right-0 h-[500px] w-[500px] rounded-full bg-accent" />
          </div>
          
          <div className="relative">
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-accent">
              Join the Community
            </span>
            <h1 className="mt-4 font-serif text-4xl font-medium text-primary-foreground xl:text-5xl">
              Elevate your business journey
            </h1>
            <p className="mt-6 text-primary-foreground/70 leading-relaxed">
              Become part of a powerful network of businesswomen. Access tools, connections, and insights designed for your success.
            </p>

            <div className="mt-12 grid grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                  <Users className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-medium text-primary-foreground">Network</h3>
                  <p className="text-xs text-primary-foreground/60 leading-relaxed">Connect with hundreds of like-minded professionals.</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                  <BookOpen className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-medium text-primary-foreground">Resources</h3>
                  <p className="text-xs text-primary-foreground/60 leading-relaxed">Exclusive articles, toolkits, and business templates.</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                  <Calendar className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-medium text-primary-foreground">Events</h3>
                  <p className="text-xs text-primary-foreground/60 leading-relaxed">Priority access to networking mixers and workshops.</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                  <Sparkles className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-medium text-primary-foreground">Growth</h3>
                  <p className="text-xs text-primary-foreground/60 leading-relaxed">Accelerate your career and business objectives.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Clerk SignUp */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
          <SignUp 
            path="/register"
            appearance={{
              variables: {
                colorPrimary: '#b79c65', // Yorkshire Gold
                fontFamily: 'var(--font-serif)',
                borderRadius: '0.2rem',
              },
              elements: {
                formButtonPrimary: 'bg-[#1c1917] hover:bg-[#292524] text-white text-sm font-semibold h-12 px-4 py-2 rounded-none transition-all shadow-md active:scale-95',
                card: 'shadow-none border-none bg-transparent',
                headerTitle: 'font-serif text-3xl text-stone-900 font-medium tracking-tight',
                headerSubtitle: 'text-stone-500 text-base leading-relaxed',
                socialButtonsBlockButton: 'border-stone-200 hover:bg-stone-50 text-stone-900 rounded-none h-12 transition-all border shadow-sm',
                socialButtonsBlockButtonText: 'font-semibold text-sm',
                dividerLine: 'bg-stone-100',
                dividerText: 'text-stone-400 uppercase text-[10px] tracking-[0.2em] font-bold bg-background px-3',
                formFieldLabel: 'text-stone-900 font-semibold text-sm mb-2',
                formFieldInput: 'bg-white border-stone-200 text-stone-900 rounded-none h-12 focus:ring-2 focus:ring-[#b79c65]/20 focus:border-[#b79c65] transition-all border',
                footerActionLink: 'text-[#b79c65] hover:text-[#a08b57] font-bold transition-colors underline-offset-4 hover:underline',
              }
            }}
            signInUrl="/login"
            fallbackRedirectUrl={afterSignUpUrl}
          />
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <RegisterForm />
    </Suspense>
  );
}
