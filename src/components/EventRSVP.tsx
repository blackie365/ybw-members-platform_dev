'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import Image from 'next/image';
import Link from 'next/link';

interface Attendee {
  uid?: string;
  email?: string;
  name: string;
  image?: string;
  company?: string;
  timestamp: any;
  quantity?: number;
  guestInfo?: string;
  hasTicket?: boolean;
}

function attendeeKeyForCurrentUser(a: Attendee, userId?: string) {
  if (!userId) return false;
  if (a.uid && a.uid === userId) return true;
  return false;
}

export function EventRSVP({ eventSlug, eventTitle }: { eventSlug: string, eventTitle: string }) {
  const { user } = useAuth();
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [isAttending, setIsAttending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchAttendees = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(eventSlug)}/attendees`, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-store' },
      });
      const json = await res.json().catch(() => ({ success: false as const, attendees: [] })) as
        | { success: true; attendees: Attendee[] }
        | { success: false; attendees?: Attendee[]; error?: string };
      const list = (json.attendees ?? []) as Attendee[];
      setAttendees(list);
      const currentUid = user?.uid;
      const mine = currentUid ? list.some((a) => attendeeKeyForCurrentUser(a, currentUid)) : false;
      setIsAttending(mine);
    } catch (err: any) {
      console.error('[EventRSVP] fetchAttendees failed:', err?.message ?? err);
    } finally {
      setLoading(false);
    }
  }, [eventSlug, user?.uid]);

  useEffect(() => {
    void fetchAttendees();
  }, [fetchAttendees]);

  const handleToggleRSVP = async () => {
    if (!user) return;

    setProcessing(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(eventSlug)}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({ success: false })) as
        | { success: true; isAttending: boolean; attendees?: Attendee[] }
        | { success: false; error?: string };
      if (json.success) {
        setIsAttending(json.isAttending);
        if (Array.isArray(json.attendees) && json.attendees.length > 0) {
          setAttendees(json.attendees as Attendee[]);
        } else {
          await fetchAttendees();
        }
      } else {
        if (!res.ok || res.status >= 400) {
          setErrorMessage(
            (json as any).error
              ? String((json as any).error)
              : res.status === 401
                ? 'Please log in to RSVP'
                : 'Something went wrong, please try again',
          );
        }
      }
    } catch (error: any) {
      console.error('[EventRSVP] toggle RSVP failed:', error?.message ?? error);
      setErrorMessage('Something went wrong, please try again');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse h-20 bg-zinc-100 dark:bg-zinc-800 rounded-xl w-full"></div>;
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 lg:p-8 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h3 className="text-xl font-serif font-bold text-zinc-900 dark:text-white mb-2">Are you attending?</h3>
          <p className="text-zinc-600 dark:text-zinc-400 text-sm">
            {attendees.length} {attendees.length === 1 ? 'member is' : 'members are'} going to this event.
          </p>
        </div>
        
        {user ? (
          <div className="flex flex-col items-end gap-2">
            {errorMessage && (
              <p className="text-xs text-[#a3413a] font-medium">{errorMessage}</p>
            )}
            <button
              onClick={handleToggleRSVP}
              disabled={processing}
              className={`shrink-0 inline-flex justify-center items-center rounded-xl px-6 py-3 text-sm font-semibold transition-all shadow-sm ${
                isAttending 
                  ? 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200 ring-1 ring-inset ring-zinc-300 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700 dark:ring-zinc-700' :'bg-accent text-white hover:bg-accent/90'
              } disabled:opacity-50`}
            >
              {processing ? 'Updating...' : (isAttending ? 'Cancel RSVP' : 'RSVP Now')}
            </button>
          </div>
        ) : (
          <Link
            href="/sign-in"
            className="shrink-0 inline-flex justify-center items-center rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-accent/90 transition-colors"
          >
            Log in to RSVP
          </Link>
        )}
      </div>

      {attendees.length > 0 && (
        <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800">
          <h4 className="text-sm font-medium text-zinc-900 dark:text-white mb-4">Members Attending</h4>
          <div className="flex flex-wrap gap-3">
            {attendees.map((attendee, i) => (
              <Link 
                key={attendee.uid ? `${attendee.uid}-${i}` : `${attendee.email ?? attendee.name}-${i}`}
                href={attendee.uid ? `/members/${attendee.uid}` : '#'}
                className={`group relative flex items-center gap-x-3 rounded-full bg-zinc-50 dark:bg-zinc-800/50 pr-3 p-1 ring-1 ring-inset ring-zinc-200 dark:ring-zinc-700/50 transition-colors ${
                  attendee.uid ? 'hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer' : 'cursor-default'
                }`}
                onClick={!attendee.uid ? (e) => e.preventDefault() : undefined}
              >
                {attendee.image ? (
                  <Image
                    src={attendee.image}
                    alt={attendee.name}
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      {attendee.name.charAt(0)}
                    </span>
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-zinc-900 dark:text-white">
                    {attendee.name} {attendee.quantity && attendee.quantity > 1 ? `(+${attendee.quantity - 1})` : ''}
                  </span>
                  {attendee.company && (
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight">{attendee.company}</span>
                  )}
                  {attendee.guestInfo && (
                    <span className="text-[10px] text-zinc-400 mt-0.5 leading-tight truncate max-w-[120px]" title={attendee.guestInfo}>
                      Guests: {attendee.guestInfo}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
