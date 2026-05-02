'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function MemberOffersClient({ initialOffers }: { initialOffers: any[] }) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredOffers = initialOffers.filter((offer) => {
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
        <Link 
          href="/dashboard/offers/create" 
          className="inline-flex justify-center items-center rounded-lg bg-indigo-50 dark:bg-indigo-900/20 px-4 py-2.5 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
        >
          Submit an Offer
        </Link>
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
              className="block w-full rounded-md border-0 py-2 pl-10 text-zinc-900 ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-800 dark:text-white dark:ring-zinc-700 dark:placeholder:text-zinc-500"
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
            <div key={offer.id} className="group relative flex flex-col items-start justify-between bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-5 shadow-sm ring-1 ring-zinc-900/5 dark:ring-white/10 transition-all hover:shadow-md hover:ring-zinc-900/10 dark:hover:ring-white/20">
              {offer.feature_image && (
                <div className="relative w-full mb-5 overflow-hidden rounded-xl">
                  <Image
                    src={offer.feature_image}
                    alt={offer.title}
                    width={600}
                    height={400}
                    className="aspect-[16/9] w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              )}
              
              <div className="flex-1 w-full">
                <div className="flex items-center gap-x-2 text-xs mb-3">
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-400/10 dark:text-emerald-400 dark:ring-emerald-400/20">
                    Active Offer
                  </span>
                  {offer.primary_author?.name && (
                    <span className="text-zinc-500 dark:text-zinc-400">
                      by {offer.primary_author.name}
                    </span>
                  )}
                </div>
                
                <h3 className="text-xl font-semibold leading-tight text-zinc-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400 mb-3">
                  <Link href={`/news/${offer.slug}`}>
                    <span className="absolute inset-0" />
                    {offer.title}
                  </Link>
                </h3>
                
                <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 line-clamp-3 mb-6">
                  {offer.custom_excerpt || offer.excerpt}
                </p>
              </div>

              <div className="mt-auto w-full pt-4 border-t border-zinc-200 dark:border-zinc-700">
                <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-500 flex items-center gap-1">
                  Claim Offer
                  <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 px-6 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-900/20 mb-4">
            <svg className="h-8 w-8 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="mt-2 text-lg font-semibold text-zinc-900 dark:text-white">
            {initialOffers.length > 0 ? 'No offers match your search' : 'No active offers'}
          </h3>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
            {initialOffers.length > 0 
              ? 'Try adjusting your search terms or clearing the filter.' 
              : 'Check back soon for exclusive discounts and perks from our partners.'}
          </p>
          <div className="mt-6">
            {initialOffers.length > 0 ? (
              <button
                onClick={() => setSearchQuery('')}
                className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                Clear Search
              </button>
            ) : (
              <a
                href="/news?tag=contact"
                className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                Submit an offer
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
