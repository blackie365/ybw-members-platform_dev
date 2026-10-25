import { SignUp } from '@clerk/nextjs';
import { Suspense } from 'react';
import Link from 'next/link';
import { isPaidSignupIntent } from '@/lib/signup-intent';

/**
 * Master switch for public self-service sign-up.
 *
 * While `false`, the Clerk form is only rendered for genuine paid journeys:
 *   - the visitor arrived with a paid intent param (Premium checkout / ticket booking)
 *   - the visitor is mid-flow on a Clerk sign-up sub-step (/sign-up/verify-email-address …),
 *     which we must keep open so a paid sign-up is never interrupted half way through.
 * Everyone else — i.e. anyone wanting a free account — sees the "not open yet" panel.
 *
 * Flip to `true` to open sign-up to everyone again.
 */
const SIGNUP_OPEN: boolean = false;

function normalizeReturnUrl(value: unknown): string {
  if (typeof value !== 'string') return '/dashboard';
  if (!value.startsWith('/')) return '/dashboard';
  if (value.startsWith('//')) return '/dashboard';
  return value;
}

function SignUpContent({ returnUrl }: { returnUrl: string }) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Left side - Decorative (Matches Contact Page) */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-accent" />
          <div className="absolute -bottom-32 right-0 h-[500px] w-[500px] rounded-full bg-accent" />
        </div>
        <div className="relative flex flex-col justify-center px-12 xl:px-20">
          <div className="max-w-md">
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-accent">
              Join the Network
            </span>
            <h1 className="mt-4 font-serif text-4xl font-medium text-primary-foreground xl:text-5xl">
              Become a member today
            </h1>
            <p className="mt-6 text-primary-foreground/70 leading-relaxed text-lg">
              Join over 200 professional women across Yorkshire. Gain access to exclusive events, premium content, and a supportive business community.
            </p>
            
            <div className="mt-12 space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10">
                  <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium text-primary-foreground text-lg">Growth & Mentorship</h3>
                  <p className="mt-1 text-sm text-primary-foreground/60 leading-relaxed">Unlock opportunities for professional development and networking.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10">
                  <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a5.971 5.971 0 00-.941 3.197m0 0A11.944 11.944 0 0112 2.25c2.17 0 4.207.576 5.963 1.584A6.062 6.062 0 0118 6.281" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium text-primary-foreground text-lg">Yorkshire&apos;s Finest</h3>
                  <p className="mt-1 text-sm text-primary-foreground/60 leading-relaxed">Connect with 200+ professional women across Yorkshire</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - SignUp Form */}
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:px-12 xl:px-20 bg-background">
        <div className="mx-auto w-full max-w-lg">
          {/* Mobile header */}
          <div className="lg:hidden mb-10 text-center">
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-accent">
              Join Us
            </span>
            <h1 className="mt-2 font-serif text-3xl font-medium text-foreground">
              Create Account
            </h1>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Join the professional community
            </p>
          </div>

          <SignUp 
            path="/sign-up"
            routing="path"
            signInUrl="/sign-in"
            forceRedirectUrl={returnUrl}
            appearance={{
              variables: {
                colorPrimary: '#8b3e2f', // Brick Color
                fontFamily: 'var(--font-serif)',
                borderRadius: '0',
                colorBackground: 'transparent',
              },
              elements: {
                rootBox: 'shadow-none w-full border-none bg-transparent cl-internal-ncupfk',
                cardBox: 'shadow-none border-none bg-transparent cl-internal-1h6fgzy',
                card: 'shadow-none border-none bg-transparent w-full max-w-none p-0 sm:p-0 cl-internal-ml9k5m',
                navbar: 'hidden',
                header: 'block mb-8 cl-internal-1f4p2mz',
                headerTitle: 'font-serif text-2xl text-stone-900 font-medium tracking-tight cl-internal-1pio5zx',
                headerSubtitle: 'text-stone-500 text-sm leading-relaxed mt-1 cl-internal-vul4p4',
                main: 'bg-transparent shadow-none border-none cl-internal-vvtys3',
                formButtonPrimary: 'bg-[#8b3e2f] hover:bg-[#722f25] text-white text-[11px] font-semibold uppercase tracking-[0.2em] h-14 px-8 rounded-none transition-all active:scale-95 shadow-none border-none cl-internal-1kp23r1',
                socialButtonsBlockButton: 'border-stone-200 hover:bg-stone-50 text-stone-900 rounded-none h-14 transition-all border mb-4 shadow-none bg-white cl-internal-5sxrl4',
                socialButtonsBlockButtonText: 'font-semibold text-sm cl-internal-kd81fb',
                dividerLine: 'bg-stone-100 cl-internal-1q223lr',
                dividerText: 'text-stone-400 uppercase text-[10px] tracking-[0.2em] font-bold bg-background px-3 cl-internal-1iuhzpo',
                formFieldLabel: 'text-stone-900 font-semibold text-[11px] uppercase tracking-wider mb-2 cl-internal-kq110m',
                formFieldInput: 'bg-white border-stone-200 text-stone-900 rounded-none h-14 px-5 focus:ring-2 focus:ring-[#8b3e2f]/20 focus:border-[#8b3e2f] transition-all border outline-none text-base shadow-none cl-internal-13pcqc9',
                footerActionLink: 'text-[#8b3e2f] hover:text-[#722f25] font-bold transition-colors underline-offset-4 hover:underline cl-internal-j9a5a2',
                footerActionText: 'text-stone-600 font-medium cl-internal-lres0z',
                identityPreviewText: 'text-stone-900 font-medium text-base',
                identityPreviewEditButtonIcon: 'text-[#8b3e2f]',
                formFieldAction: 'text-[#8b3e2f] hover:text-[#722f25] font-bold text-[11px] uppercase tracking-wider hover:underline underline-offset-4',
                footer: 'hidden',
                footerAction: 'bg-transparent border-none shadow-none',
              }
            }}
          />
        </div>
      </div>
    </div>
  )
}

function SignUpClosed() {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Left side - Decorative (Matches Contact Page) */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-accent" />
          <div className="absolute -bottom-32 right-0 h-[500px] w-[500px] rounded-full bg-accent" />
        </div>
        <div className="relative flex flex-col justify-center px-12 xl:px-20">
          <div className="max-w-md">
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-accent">
              Membership
            </span>
            <h1 className="mt-4 font-serif text-4xl font-medium text-primary-foreground xl:text-5xl">
              Not open just yet
            </h1>
            <p className="mt-6 text-primary-foreground/70 leading-relaxed text-lg">
              We&apos;re putting the finishing touches to member sign-up. Existing members can sign in as normal.
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Closed notice */}
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:px-12 xl:px-20 bg-background">
        <div className="mx-auto w-full max-w-lg">
          <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-accent">
            Sign-up closed
          </span>
          <h1 className="mt-3 font-serif text-3xl font-medium text-foreground sm:text-4xl">
            Member sign-up isn&apos;t open yet
          </h1>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            We&apos;re not taking new members through the website at the moment. If you already have an account you can
            sign in as usual — for anything else, the team is on email.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/sign-in"
              className="flex items-center justify-center rounded-none bg-[#8b3e2f] px-8 h-14 text-[11px] font-semibold uppercase tracking-[0.2em] text-white transition-all hover:bg-[#722f25] active:scale-95"
            >
              Member sign in
            </Link>
            <Link
              href="/contact"
              className="flex items-center justify-center rounded-none border border-stone-200 bg-white px-8 h-14 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-900 transition-all hover:bg-stone-50 active:scale-95"
            >
              Contact us
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function Page({
  params,
  searchParams,
}: {
  params?: Promise<{ 'sign-up'?: string[] }>;
  searchParams?: Promise<{ returnUrl?: string | string[]; intent?: string | string[] }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const rawReturnUrl = Array.isArray(resolvedSearchParams?.returnUrl)
    ? resolvedSearchParams?.returnUrl[0]
    : resolvedSearchParams?.returnUrl;
  const returnUrl = normalizeReturnUrl(rawReturnUrl);

  // A sign-up sub-path (e.g. /sign-up/verify-email-address) means a sign-up is
  // already in progress — treat it as allowed so the paid journey can finish.
  const inProgressStep = resolvedParams?.['sign-up']?.length ?? 0;

  if (!SIGNUP_OPEN && !isPaidSignupIntent(resolvedSearchParams?.intent) && inProgressStep === 0) {
    return <SignUpClosed />;
  }

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background">Loading...</div>}>
      <SignUpContent returnUrl={returnUrl} />
    </Suspense>
  )
}
