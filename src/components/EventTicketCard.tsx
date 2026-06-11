'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { getEventMetadata } from '@/app/actions/eventActions';

export function EventTicketCard({ post }: { post: any }) {
  const [loading, setLoading] = useState(false);
  const [priceData, setPriceData] = useState({
    amount: 5000, // Default £50
    display: '£50',
    isFree: false,
    source: 'default'
  });
  
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    async function resolvePrice() {
      // 1. Try to get price from Firestore first (The Robust Way)
      const metadata = await getEventMetadata(post.slug);
      
      if (metadata.success && metadata.data?.price !== undefined) {
        const price = metadata.data.price;
        setPriceData({
          amount: price * 100,
          display: price === 0 ? 'Free' : `£${price}`,
          isFree: price === 0,
          source: 'firestore'
        });
        return;
      }

      // 2. Fallback to Ghost Tags (The Easy Way)
      if (post.tags) {
        const priceTag = post.tags.find((t: any) => 
          t.slug.includes('ticket-price') || 
          t.name.toLowerCase().includes('ticket price')
        );

        if (priceTag) {
          const slugMatch = priceTag.slug.match(/ticket-price-([a-z0-9]+)/i);
          const nameMatch = priceTag.name.match(/ticket price ([a-z0-9]+)/i);
          const priceString = (slugMatch?.[1] || nameMatch?.[1] || priceTag.slug.split('-').pop())?.toLowerCase();

          if (priceString === 'free') {
            setPriceData({ amount: 0, display: 'Free', isFree: true, source: 'tag' });
          } else if (priceString) {
            const digits = priceString.match(/\d+/);
            if (digits) {
              const numericPrice = parseInt(digits[0], 10);
              setPriceData({
                amount: numericPrice * 100,
                display: `£${numericPrice}`,
                isFree: false,
                source: 'tag'
              });
            }
          }
        }
      }
    }

    resolvePrice();
  }, [post.slug, post.tags]);

  const { amount: priceAmount, display: displayPrice, isFree } = priceData;

  const handleCheckout = async () => {
    // If they aren't logged in, force them to login or register first so we know who bought the ticket!
    if (!user) {
      alert("Please sign in to purchase a ticket.");
      router.push('/sign-in');
      return;
    }

    setLoading(true);
    
    try {
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

      if (data.free && data.success) {
        // It was a free ticket and successfully registered.
        // No need to redirect, just show success and let the real-time RSVP list update.
        alert("You have successfully registered for this free event!");
        // We can just stop loading, the RSVP component will update automatically via Firebase snapshot.
      } else if (data.url) {
        // Redirect the user to Stripe's secure hosted checkout page (or mock url)
        if (data.url.includes('mock_stripe')) {
           alert("Warning: Stripe is running in Mock Mode because the STRIPE_SECRET_KEY is missing from Vercel.");
        }
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
    <div className="bg-white dark:bg-zinc-800/80 rounded-2xl p-6 shadow-xl ring-1 ring-zinc-900/5 dark:ring-white/10 sticky top-24 z-10">
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
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleCheckout();
        }}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all relative z-20"
      >
        {loading ? (
          'Processing...'
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            {isFree ? 'Register for Free' : 'Purchase Ticket'}
          </>
        )}
      </button>

      {!isFree && (
        <p className="mt-4 text-xs text-center text-zinc-400 dark:text-zinc-500 flex items-center justify-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-5-5 1.41-1.41L11 14.17l7.59-7.59L20 8l-9 9z"/>
          </svg>
          Payments processed securely by Stripe
        </p>
      )}
    </div>
  );
}
