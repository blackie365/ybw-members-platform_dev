'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toggleFeaturedStatus } from '@/app/actions/adminActions';

export function AdminFeatureToggle({ memberId, isCurrentlyFeatured }: { memberId: string, isCurrentlyFeatured: boolean }) {
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  const handleToggle = async () => {
    setIsPending(true);
    try {
      const res = await toggleFeaturedStatus(memberId, !isCurrentlyFeatured);
      if (res.success) {
        router.refresh();
      } else {
        alert(res.error || 'Failed to update featured status');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700">
      <div className="flex-1">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Admin Control: Featured Member</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Toggle this switch to feature this member on the homepage.</p>
      </div>
      <button
        onClick={handleToggle}
        disabled={isPending}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
          isCurrentlyFeatured ? 'bg-indigo-600' : 'bg-zinc-200 dark:bg-zinc-700'
        } ${isPending ? 'opacity-50' : ''}`}
        role="switch"
        aria-checked={isCurrentlyFeatured}
      >
        <span className="sr-only">Feature Member</span>
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            isCurrentlyFeatured ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}