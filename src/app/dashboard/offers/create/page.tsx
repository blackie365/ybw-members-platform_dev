'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import Image from 'next/image';

export default function CreateOfferPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Handle fake image upload for now (or base64 if needed, but a URL input is easier for MVP)
  // In a full version, we'd use Firebase Storage.
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    if (!user) {
      setError('You must be logged in to submit an offer.');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/offers/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          description,
          link,
          imageUrl,
          userId: user.uid,
          userEmail: user.email,
          userName: user.displayName || 'Yorkshire Businesswoman Member',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit offer');
      }

      // Success
      router.push('/dashboard/offers?success=true');
    } catch (err: any) {
      setError(err.message || 'An error occurred while submitting your offer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-6 lg:p-10 shadow-sm dark:bg-zinc-900/50 dark:border-zinc-800 max-w-3xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Submit a Member Offer</h2>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Create an exclusive discount, perk, or opportunity for fellow Yorkshire Businesswoman members. All submissions are reviewed before going live.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="title" className="block text-sm font-medium leading-6 text-zinc-900 dark:text-white">
            Offer Title
          </label>
          <div className="mt-2">
            <input
              type="text"
              name="title"
              id="title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="block w-full rounded-md border-0 py-2.5 px-3 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-800 dark:text-white dark:ring-zinc-700"
              placeholder="e.g., 20% off all marketing consultations"
            />
          </div>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium leading-6 text-zinc-900 dark:text-white">
            Description
          </label>
          <div className="mt-2">
            <textarea
              id="description"
              name="description"
              rows={4}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="block w-full rounded-md border-0 py-2.5 px-3 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-800 dark:text-white dark:ring-zinc-700"
              placeholder="Describe the offer, any terms and conditions, and how members can claim it."
            />
          </div>
        </div>

        <div>
          <label htmlFor="link" className="block text-sm font-medium leading-6 text-zinc-900 dark:text-white">
            Claim Link / Website (Optional)
          </label>
          <div className="mt-2">
            <input
              type="url"
              name="link"
              id="link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="block w-full rounded-md border-0 py-2.5 px-3 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-800 dark:text-white dark:ring-zinc-700"
              placeholder="https://yourwebsite.com/offer"
            />
          </div>
        </div>

        <div>
          <label htmlFor="imageUrl" className="block text-sm font-medium leading-6 text-zinc-900 dark:text-white">
            Banner Image URL (Optional)
          </label>
          <div className="mt-2">
            <input
              type="url"
              name="imageUrl"
              id="imageUrl"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="block w-full rounded-md border-0 py-2.5 px-3 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-800 dark:text-white dark:ring-zinc-700"
              placeholder="https://example.com/my-banner.jpg"
            />
          </div>
          {imageUrl && (
            <div className="mt-4 relative h-40 w-full max-w-md rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg px-4 py-2.5 text-sm font-semibold text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Submitting...' : 'Submit for Review'}
          </button>
        </div>
      </form>
    </div>
  );
}