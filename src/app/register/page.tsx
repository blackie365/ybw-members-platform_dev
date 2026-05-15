'use client';

import { Suspense, useState } from 'react';
import { createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, updateProfile } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getFriendlyAuthErrorMessage } from '@/lib/authErrors';
import { useAuth } from '@/lib/AuthContext';
import { ArrowRight, Sparkles, Users, BookOpen, Calendar } from 'lucide-react';

async function syncToGhost(email: string, name: string) {
  try {
    await fetch('/api/revalidate/ghost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_member',
        email,
        name,
        labels: ['firebase-synced']
      })
    });
  } catch (err) {
    console.error('Failed to sync to Ghost, but Firebase registration succeeded', err);
  }
}

function RegisterForm() {
  const { user, loading: authLoading } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan');
  const cycle = searchParams.get('cycle') || 'monthly';

  if (!authLoading && user && plan === 'premium' && !loading) {
    setLoading(true);
    fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan: 'premium',
        cycle: cycle,
        userEmail: user.email,
        userId: user.uid,
      }),
    })
    .then(res => res.json())
    .then(data => {
      if (data.url) {
        window.location.href = data.url;
      } else {
        router.push('/dashboard');
      }
    })
    .catch(err => {
      console.error('Failed to initiate checkout for logged in user:', err);
      router.push('/dashboard');
    });
  } else if (!authLoading && user && !loading) {
    router.push('/dashboard');
    return null;
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, {
        displayName: `${firstName} ${lastName}`
      });

      try {
        await setDoc(doc(db, 'newMemberCollection', user.uid), {
          firstName,
          lastName,
          email,
          slug: `${firstName.toLowerCase()}-${lastName.toLowerCase()}-${Date.now().toString().slice(-4)}`,
          status: 'active',
          membershipTier: 'free',
          role: 'member',
          createdAt: new Date().toISOString(),
        });
      } catch (dbErr) {
        console.warn('Could not write to newMemberCollection directly. Using server action fallback.', dbErr);
        await fetch('/api/revalidate/ghost', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_member_admin',
            uid: user.uid,
            email: user.email,
            firstName,
            lastName
          })
        });
      }

      await syncToGhost(email, `${firstName} ${lastName}`.trim());

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
      const baseUrl = siteUrl.replace(/\/$/, '');

      fetch(`${baseUrl}/api/emails/welcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, firstName, plan })
      }).catch(err => console.error('Failed to trigger welcome email API:', err));

      if (plan === 'premium') {
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan: 'premium',
            cycle: cycle,
            userEmail: user.email,
            userId: user.uid,
          }),
        });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
          return;
        }
      }

      router.push('/dashboard');
    } catch (err: unknown) {
      console.error('Registration error:', err);
      setError(getFriendlyAuthErrorMessage(err));
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setLoading(true);
    setError('');
    
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;

      const nameParts = (user.displayName || '').split(' ');
      const fName = nameParts[0] || '';
      const lName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

      try {
        await setDoc(doc(db, 'newMemberCollection', user.uid), {
          firstName: fName,
          lastName: lName,
          email: user.email,
          profileImage: user.photoURL,
          slug: `${fName.toLowerCase()}-${lName.toLowerCase()}-${Date.now().toString().slice(-4)}`,
          status: 'active',
          membershipTier: 'free',
          role: 'member',
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      } catch (dbErr) {
        console.warn('Could not write to newMemberCollection directly. Using server action fallback.', dbErr);
        await fetch('/api/revalidate/ghost', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_member_admin',
            uid: user.uid,
            email: user.email,
            firstName: fName,
            lastName: lName,
            profileImage: user.photoURL
          })
        });
      }

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
      const baseUrl = siteUrl.replace(/\/$/, '');
      
      fetch(`${baseUrl}/api/emails/welcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, firstName: fName, plan })
      }).catch(err => console.error('Failed to trigger welcome email API:', err));

      if (plan === 'premium') {
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan: 'premium',
            cycle: cycle,
            userEmail: user.email,
            userId: user.uid,
          }),
        });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
          return;
        }
      }

      router.push('/dashboard');
    } catch (err: unknown) {
      console.error('Google Registration error:', err);
      setError(getFriendlyAuthErrorMessage(err));
      setLoading(false);
    }
  };

  const benefits = [
    { icon: Users, title: 'Connect', description: 'Network with inspiring businesswomen across Yorkshire' },
    { icon: BookOpen, title: 'Learn', description: 'Access exclusive articles, guides, and resources' },
    { icon: Calendar, title: 'Grow', description: 'Attend events, workshops, and networking opportunities' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="flex min-h-screen">
        {/* Left Panel - Benefits */}
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
                  <Sparkles className="w-3.5 h-3.5" />
                  Join Our Community
                </div>
                <h1 className="font-serif text-4xl lg:text-5xl font-medium text-primary-foreground leading-tight mb-4">
                  Your journey to success starts here
                </h1>
                <p className="text-primary-foreground/70 text-lg leading-relaxed">
                  Join a thriving community of ambitious women building remarkable businesses.
                </p>
              </div>

              <div className="space-y-6 pt-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-white/10 backdrop-blur-sm flex items-center justify-center">
                      <benefit.icon className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <div>
                      <h3 className="font-medium text-primary-foreground mb-1">{benefit.title}</h3>
                      <p className="text-sm text-primary-foreground/60">{benefit.description}</p>
                    </div>
                  </div>
                ))}
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

            <div className="text-center lg:text-left mb-8">
              <h2 className="font-serif text-2xl lg:text-3xl font-medium tracking-tight text-foreground">
                Create your account
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link href="/login" className="font-medium text-accent hover:text-accent/80 transition-colors">
                  Sign in
                </Link>
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleRegister}>
              {error && (
                <div className="rounded-lg bg-destructive/10 p-4 border border-destructive/20">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-destructive" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-destructive">{error}</p>
                      {error.includes('already registered') && (
                        <div className="mt-2">
                          <Link href="/login" className="text-sm font-medium text-accent hover:text-accent/80">
                            Sign in instead
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-foreground mb-1.5">
                    First name
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="block w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground placeholder-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-colors"
                    placeholder="Jane"
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-foreground mb-1.5">
                    Last name
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="block w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground placeholder-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-colors"
                    placeholder="Smith"
                  />
                </div>
              </div>

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

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground placeholder-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-colors"
                  placeholder="At least 6 characters"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-1.5">
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground placeholder-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-colors"
                  placeholder="Confirm your password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-3 px-4 text-sm font-semibold text-accent-foreground shadow-sm hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating account...
                  </>
                ) : (
                  <>
                    Create account
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-background px-4 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              <button
                onClick={handleGoogleRegister}
                disabled={loading}
                className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg bg-card px-4 py-3 text-sm font-medium text-foreground ring-1 ring-inset ring-border hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path d="M12.0003 4.75C13.7703 4.75 15.3553 5.36002 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86002 8.87028 4.75 12.0003 4.75Z" fill="#EA4335" />
                  <path d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z" fill="#4285F4" />
                  <path d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z" fill="#FBBC05" />
                  <path d="M12.0004 24.0001C15.2404 24.0001 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.245 12.0004 19.245C8.8704 19.245 6.21537 17.135 5.26538 14.29L1.27539 17.385C3.25539 21.31 7.3104 24.0001 12.0004 24.0001Z" fill="#34A853" />
                </svg>
                Continue with Google
              </button>
            </div>

            <p className="mt-8 text-center text-xs text-muted-foreground">
              By creating an account, you agree to our{' '}
              <Link href="/terms" className="text-accent hover:text-accent/80">Terms</Link>
              {' '}and{' '}
              <Link href="/privacy" className="text-accent hover:text-accent/80">Privacy Policy</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
