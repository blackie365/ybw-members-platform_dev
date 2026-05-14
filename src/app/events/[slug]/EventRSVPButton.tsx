'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { EventRegistration } from '@/lib/events';

interface EventRSVPButtonProps {
  eventId: string;
  isFree: boolean;
  isFull: boolean;
  isPremiumOnly: boolean;
}

export function EventRSVPButton({ eventId, isFree, isFull, isPremiumOnly }: EventRSVPButtonProps) {
  const { user, profile, loading: authLoading, isPremium } = useAuth();
  const router = useRouter();
  const [registration, setRegistration] = useState<EventRegistration | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Check if user is already registered
  useEffect(() => {
    async function checkRegistration() {
      if (!user?.uid) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/events/${eventId}/rsvp?userId=${user.uid}`);
        const data = await res.json();
        setRegistration(data.registration);
      } catch (err) {
        console.error('Error checking registration:', err);
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      checkRegistration();
    }
  }, [eventId, user?.uid, authLoading]);

  const handleRegister = async () => {
    if (!user || !profile) {
      // Redirect to login
      router.push(`/login?returnUrl=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    // Check premium access
    if (isPremiumOnly && !isPremium) {
      router.push('/membership');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/events/${eventId}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          userEmail: user.email,
          userName: `${profile.firstName} ${profile.lastName}`,
          userImage: profile.profileImage,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to register');
      }

      setRegistration(data.registration);
      setSuccess(data.message);
    } catch (err) {
      console.error('Error registering:', err);
      setError(err instanceof Error ? err.message : 'Failed to register');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!user?.uid) return;

    const confirmed = window.confirm('Are you sure you want to cancel your registration?');
    if (!confirmed) return;

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/events/${eventId}/rsvp?userId=${user.uid}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to cancel registration');
      }

      setRegistration(null);
      setSuccess('Your registration has been cancelled.');
    } catch (err) {
      console.error('Error cancelling:', err);
      setError(err instanceof Error ? err.message : 'Failed to cancel');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <button
        disabled
        className="w-full rounded-lg bg-accent py-3 px-4 text-sm font-semibold text-accent-foreground opacity-50"
      >
        <span className="flex items-center justify-center gap-2">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading...
        </span>
      </button>
    );
  }

  // Already registered
  if (registration) {
    return (
      <div className="space-y-3">
        <div className={`rounded-lg p-3 text-center ${
          registration.status === 'confirmed' 
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-amber-50 text-amber-800 border border-amber-200'
        }`}>
          <div className="flex items-center justify-center gap-2 mb-1">
            {registration.status === 'confirmed' ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span className="font-medium">
              {registration.status === 'confirmed' ? "You're registered!" : "You're on the waitlist"}
            </span>
          </div>
          <p className="text-sm">
            {registration.status === 'confirmed'
              ? "We'll send you a reminder before the event."
              : "We'll notify you if a spot opens up."}
          </p>
        </div>

        <button
          onClick={handleCancel}
          disabled={submitting}
          className="w-full rounded-lg border border-border bg-background py-2.5 px-4 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          {submitting ? 'Cancelling...' : 'Cancel registration'}
        </button>

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}
        {success && (
          <p className="text-sm text-green-600 text-center">{success}</p>
        )}
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div className="space-y-3">
        <Link
          href={`/login?returnUrl=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '')}`}
          className="block w-full rounded-lg bg-accent py-3 px-4 text-center text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors"
        >
          Sign in to register
        </Link>
        <p className="text-xs text-center text-muted-foreground">
          Not a member?{' '}
          <Link href="/register" className="text-accent hover:underline">
            Join now
          </Link>
        </p>
      </div>
    );
  }

  // Premium only check
  if (isPremiumOnly && !isPremium) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-center">
          <p className="text-sm text-amber-800">
            This event is for Premium members only.
          </p>
        </div>
        <Link
          href="/membership"
          className="block w-full rounded-lg bg-accent py-3 px-4 text-center text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors"
        >
          Upgrade to Premium
        </Link>
      </div>
    );
  }

  // Default register button
  return (
    <div className="space-y-3">
      <button
        onClick={handleRegister}
        disabled={submitting}
        className="w-full rounded-lg bg-accent py-3 px-4 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Registering...
          </span>
        ) : isFull ? (
          'Join Waitlist'
        ) : isFree ? (
          'Register for Free'
        ) : (
          'Register Now'
        )}
      </button>

      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-600 text-center">{success}</p>
      )}
    </div>
  );
}

export default EventRSVPButton;
