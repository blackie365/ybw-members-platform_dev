"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';

export function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if the user has already consented
    const consent = localStorage.getItem('ybw-cookie-consent');
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const acceptCookies = () => {
    localStorage.setItem('ybw-cookie-consent', 'accepted');
    setIsVisible(false);
  };

  const declineCookies = () => {
    // We still set a token so we don't bother them again, but we could use this 
    // flag in the future to disable analytics/tracking scripts
    localStorage.setItem('ybw-cookie-consent', 'declined');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 pb-safe">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
              We value your privacy
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. 
              By clicking "Accept", you consent to our use of cookies. 
              Read our <Link href="/cookies" className="text-emerald-600 dark:text-emerald-400 hover:underline">Cookie Policy</Link> to learn more.
            </p>
          </div>
          <div className="flex flex-row gap-3 shrink-0 w-full sm:w-auto">
            <button
              onClick={declineCookies}
              className="flex-1 sm:flex-none px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-500"
            >
              Decline
            </button>
            <button
              onClick={acceptCookies}
              className="flex-1 sm:flex-none px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
            >
              Accept All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
