'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';

export default function SubmitArticlePage() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    setStatus('idle');
    setErrorMsg('');

    try {
      const res = await fetch('/api/articles/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          authorName: user.displayName || 'YBW Member',
          authorEmail: user.email
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit article');

      setStatus('success');
      setTitle('');
      setContent('');
      
      // Optionally redirect after a few seconds
      setTimeout(() => {
        router.push('/dashboard');
      }, 3000);
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-border rounded-none p-8 lg:p-12 shadow-sm dark:bg-zinc-950">
      <div className="mb-8 border-b border-border pb-8">
        <h2 className="font-serif text-3xl font-medium text-foreground">Submit an Article</h2>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          Share your expertise with the Yorkshire Businesswoman community. Submitted articles are sent directly to our editorial team for review before being published.
        </p>
      </div>

      {status === 'success' ? (
        <div className="text-center py-12 border border-dashed border-border bg-zinc-50 dark:bg-zinc-900/50">
          <h3 className="text-xl font-serif font-medium text-foreground mb-2">Article Submitted!</h3>
          <p className="text-zinc-600 dark:text-zinc-400">
            Thank you. Our editorial team will review your submission shortly.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-foreground mb-2">
              Article Title
            </label>
            <input
              type="text"
              id="title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="block w-full rounded-none border-0 py-3 px-4 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-inset focus:ring-accent sm:text-sm dark:bg-zinc-900 dark:text-white dark:ring-zinc-700"
              placeholder="e.g. 5 Leadership Lessons I Learned This Year"
            />
          </div>

          <div>
            <label htmlFor="content" className="block text-sm font-medium text-foreground mb-2">
              Article Content
            </label>
            <textarea
              id="content"
              required
              rows={12}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="block w-full rounded-none border-0 py-3 px-4 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-inset focus:ring-accent sm:text-sm dark:bg-zinc-900 dark:text-white dark:ring-zinc-700"
              placeholder="Write your article here... (Markdown is supported)"
            />
          </div>

          {status === 'error' && (
            <div className="p-4 bg-red-50 text-red-700 text-sm border border-red-200">
              {errorMsg}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || !title || !content}
              className="bg-primary px-8 py-3 text-xs font-medium uppercase tracking-wider text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : 'Submit to Editorial'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}