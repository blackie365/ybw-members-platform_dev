import { SignIn } from '@clerk/nextjs';
import { Suspense } from 'react';

function SignInContent() {
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
              Welcome Back
            </span>
            <h1 className="mt-4 font-serif text-4xl font-medium text-primary-foreground xl:text-5xl">
              Sign in to your member account
            </h1>
            <p className="mt-6 text-primary-foreground/70 leading-relaxed text-lg">
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
                  <h3 className="font-medium text-primary-foreground text-lg">Exclusive Content</h3>
                  <p className="mt-1 text-sm text-primary-foreground/60 leading-relaxed">Access premium articles and business insights</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10">
                  <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a5.971 5.971 0 00-.941 3.197m0 0A11.944 11.944 0 0112 2.25c2.17 0 4.207.576 5.963 1.584A6.062 6.062 0 0118 6.281" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium text-primary-foreground text-lg">Member Network</h3>
                  <p className="mt-1 text-sm text-primary-foreground/60 leading-relaxed">Connect with 200+ professional women across Yorkshire</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login Form (Matches Contact Page) */}
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:px-12 xl:px-20 bg-background">
        <div className="mx-auto w-full max-w-lg">
          {/* Mobile header */}
          <div className="lg:hidden mb-10 text-center">
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-accent">
              Welcome Back
            </span>
            <h1 className="mt-2 font-serif text-3xl font-medium text-foreground">
              Sign In
            </h1>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Access your member account
            </p>
          </div>

          <SignIn 
            path="/sign-in"
            routing="path"
            signUpUrl="/sign-up"
            forceRedirectUrl="/dashboard"
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

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background">Loading...</div>}>
      <SignInContent />
    </Suspense>
  )
}
