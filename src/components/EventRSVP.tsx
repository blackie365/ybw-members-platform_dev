'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, deleteDoc, collection, onSnapshot, query, serverTimestamp } from 'firebase/firestore';
import Image from 'next/image';

interface Attendee {
  uid: string;
  name: string;
  image: string;
  company: string;
  timestamp: any;
}

export function EventRSVP({ eventSlug, eventTitle }: { eventSlug: string, eventTitle: string }) {
  const { user } = useAuth();
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [isAttending, setIsAttending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    // Listen for attendees in real-time
    const attendeesRef = collection(db, 'events', eventSlug, 'attendees');
    const q = query(attendeesRef);
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const atts: Attendee[] = [];
      let userAttending = false;
      
      snapshot.forEach((doc) => {
        const data = doc.data() as Attendee;
        atts.push(data);
        if (user && doc.id === user.uid) {
          userAttending = true;
        }
      });
      
      setAttendees(atts);
      setIsAttending(userAttending);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching attendees:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [eventSlug, user]);

  const handleToggleRSVP = async () => {
    if (!user) return; // User must be logged in, maybe show a login prompt in production

    setProcessing(true);
    try {
      const attendeeRef = doc(db, 'events', eventSlug, 'attendees', user.uid);
      
      if (isAttending) {
        await deleteDoc(attendeeRef);
      } else {
        // Fetch user's profile details to store in the attendee doc
        const profileRef = doc(db, 'newMemberCollection', user.uid);
        const profileSnap = await getDoc(profileRef);
        const profileData = profileSnap.data() || {};
        
        await setDoc(attendeeRef, {
          uid: user.uid,
          name: profileData.firstName ? `${profileData.firstName} ${profileData.lastName || ''}` : (user.displayName || 'Member'),
          image: profileData.profileImage || '',
          company: profileData.companyName || profileData['Company'] || '',
          timestamp: serverTimestamp()
        });
      }
    } catch (error) {
      console.error("Error toggling RSVP:", error);
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
          <button
            onClick={handleToggleRSVP}
            disabled={processing}
            className={`shrink-0 inline-flex justify-center items-center rounded-xl px-6 py-3 text-sm font-semibold transition-all shadow-sm ${
              isAttending 
                ? 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200 ring-1 ring-inset ring-zinc-300 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700 dark:ring-zinc-700' 
                : 'bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600'
            } disabled:opacity-50`}
          >
            {processing ? 'Updating...' : (isAttending ? 'Cancel RSVP' : 'RSVP Now')}
          </button>
        ) : (
          <a
            href="/login"
            className="shrink-0 inline-flex justify-center items-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
          >
            Log in to RSVP
          </a>
        )}
      </div>

      {attendees.length > 0 && (
        <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800">
          <h4 className="text-sm font-medium text-zinc-900 dark:text-white mb-4">Members Attending</h4>
          <div className="flex flex-wrap gap-3">
            {attendees.map((attendee) => (
              <div 
                key={attendee.uid}
                className="group relative flex items-center gap-x-3 rounded-full bg-zinc-50 dark:bg-zinc-800/50 pr-3 p-1 ring-1 ring-inset ring-zinc-200 dark:ring-zinc-700/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                onClick={() => window.location.href = `/members/${attendee.uid}`}
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
                  <span className="text-xs font-semibold text-zinc-900 dark:text-white">{attendee.name}</span>
                  {attendee.company && (
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight">{attendee.company}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}