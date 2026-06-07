'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { claimOfferAction } from '@/app/actions/offerActions';
import { toast } from 'sonner';
import { OfferCard } from './OfferCard';
import { ClaimOfferForm } from './ClaimOfferForm';

export default function MemberOffersClient({ 
  initialOffers, 
  isPublicBoard = false 
}: { 
  initialOffers: any[], 
  isPublicBoard?: boolean 
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimerEmail, setClaimerEmail] = useState('');
  const [claimerName, setClaimerName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      setClaimerEmail(user.email || '');
      setClaimerName(user.displayName || '');
    }
  }, [user]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const handleClaimSubmit = async (e: React.FormEvent, offerId: string) => {
    e.preventDefault();
    if (!claimerEmail) {
      toast.error('Please provide an email address');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await claimOfferAction(offerId, claimerEmail, claimerName);
      if (res.success) {
        toast.success('Interest sent to the offerer!');
        setClaimingId(null);
      } else {
        toast.error(res.error || 'Failed to send interest');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredOffers = (initialOffers || []).filter((offer) => {
    const query = searchQuery.toLowerCase();
    const titleMatch = offer.title?.toLowerCase().includes(query);
    const excerptMatch = offer.custom_excerpt?.toLowerCase().includes(query) || offer.excerpt?.toLowerCase().includes(query);
    const authorMatch = offer.primary_author?.name?.toLowerCase().includes(query);
    
    return titleMatch || excerptMatch || authorMatch;
  });

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-6 lg:p-10 shadow-sm dark:bg-zinc-900/50 dark:border-zinc-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Member Offers</h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400 max-w-2xl">
            Exclusive discounts, perks, and opportunities provided by our partners and fellow Yorkshire Businesswoman members.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex justify-center items-center rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-200 transition-colors disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300"
          >
            <svg className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <Link 
            href="/dashboard/offers/create" 
            className="inline-flex justify-center items-center rounded-lg bg-accent/10 px-4 py-2.5 text-sm font-semibold text-accent hover:bg-accent/20 transition-colors"
          >
            Submit an Offer
          </Link>
        </div>
      </div>

      {initialOffers.length > 0 && (
        <div className="mb-8">
          <div className="relative max-w-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <svg className="h-5 w-5 text-zinc-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              type="text"
              name="search"
              id="search"
              className="block w-full rounded-none border-0 py-2 pl-10 text-zinc-900 ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-accent sm:text-sm sm:leading-6 dark:bg-zinc-800 dark:text-white dark:ring-zinc-700 dark:placeholder:text-zinc-500"
              placeholder="Search offers by title, description, or author..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      )}

      {filteredOffers && filteredOffers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {filteredOffers.map((offer: any) => (
            <div key={offer.id} className="flex flex-col gap-4">
              <OfferCard 
                offer={offer}
                isPublicBoard={isPublicBoard}
                claimingId={claimingId}
                setClaimingId={setClaimingId}
                router={router}
              />
              {claimingId === offer.id && (!offer.isMembersOnly || !isPublicBoard) && (
                <ClaimOfferForm 
                  claimerEmail={claimerEmail}
                  setClaimerEmail={setClaimerEmail}
                  isSubmitting={isSubmitting}
                  handleClaimSubmit={(e) => handleClaimSubmit(e, offer.id)}
                  setClaimingId={setClaimingId}
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 px-6 rounded-none border-2 border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-none bg-accent/10 mb-4">
            <svg className="h-8 w-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="mt-2 text-lg font-semibold text-zinc-900 dark:text-white">
            {initialOffers.length > 0 ? 'No offers match your search' : 'No active offers'}
          </h3>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
            {initialOffers.length > 0 
              ? 'Try adjusting your search terms or clearing the filter.' :'Check back soon for exclusive discounts and perks from our partners.'}
          </p>
          <div className="mt-6">
            {initialOffers.length > 0 ? (
              <button
                onClick={() => setSearchQuery('')}
                className="inline-flex items-center rounded-none bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent/90"
              >
                Clear Search
              </button>
            ) : (
              <Link
                href="/dashboard/offers/create"
                className="inline-flex items-center rounded-none bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent/90"
              >
                Submit an offer
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
