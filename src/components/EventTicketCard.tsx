'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';

export function EventTicketCard({ post }: { post: any }) {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  // Extract price from Ghost tags (e.g., "#ticket-price-50" or "ticket-price-50")
  // If no tag is found, we default to £50.00
  let priceAmount = 5000; // in pence
  let displayPrice = '£50';

  if (post.tags) {
    const priceTag = post.tags.find((t: any) => t.slug.startsWith('ticket-price-') || t.slug.startsWith('hash-ticket-price-'));
    if (priceTag) {
      // Extract the number part from the slug
      const priceString = priceTag.slug.split('-').pop();
      if (priceString && !isNaN(parseInt(priceString, 10))) {
        const numericPrice = parseInt(priceString, 10);
        priceAmount = numericPrice * 100; // Stripe expects pence
        displayPrice = `£${numericPrice}`;
      }
    }
  }

  const handleCheckout = async () => {
    // If they aren't logged in, force them to login or register first so we know who bought the ticket!
    if (!user) {
      alert("Please sign in to purchase a ticket.");
      router.push('/login');
      return;
    }

    setLoading(true);
    
    try {
      console.log("Initiating checkout with data:", {
        postId: post.id,
        postSlug: post.slug,
        postTitle: post.title,
        userEmail: user.email,
        userId: user.uid,
        priceAmount: priceAmount, 
      });

      // This will call our Next.js API route, which talks securely to Stripe to create a Checkout Session
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postId: post.id,
          postSlug: post.slug,
          postTitle: post.title,
          userEmail: user.email,
          userId: user.uid,
          priceAmount: priceAmount, 
        }),
      });

      const data = await response.json();
      console.log("Checkout API response:", data);

      if (data.url) {
        // Redirect the user to Stripe's secure hosted checkout page
        window.location.href = data.url;
      } else {
        alert("Failed to initiate checkout. " + (data.error || 'Check console for details.'));
      }
    } catch (error) {
      console.error("Checkout error:", error);
      alert("An error occurred while setting up the payment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-800/80 rounded-2xl p-6 shadow-xl ring-1 ring-zinc-900/5 dark:ring-white/10 sticky top-24">
      <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Attend this Event</h3>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
        Secure your spot today. Tickets are limited and sell out quickly.
      </p>

      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Ticket Price</p>
          <p className="text-3xl font-extrabold text-zinc-900 dark:text-white">{displayPrice}</p>
        </div>
      </div>

      <button
        onClick={handleCheckout}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {loading ? (
          'Redirecting to Stripe...'
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            Purchase Ticket
          </>
        )}
      </button>

      <p className="mt-4 text-xs text-center text-zinc-400 dark:text-zinc-500 flex items-center justify-center gap-1">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-5-5 1.41-1.41L11 14.17l7.59-7.59L20 8l-9 9z"/>
        </svg>
        Payments processed securely by Stripe
      </p>
    </div>
  );
}