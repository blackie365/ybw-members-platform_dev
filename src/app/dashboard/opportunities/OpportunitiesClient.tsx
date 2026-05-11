'use client';

import Image from 'next/image';

export default function OpportunitiesClient({ initialOpportunities }: { initialOpportunities: any[] }) {
  if (!initialOpportunities || initialOpportunities.length === 0) {
    return (
      <div className="bg-white border border-border rounded-none p-8 lg:p-12 shadow-sm dark:bg-zinc-950 text-center">
        <h2 className="font-serif text-3xl font-medium text-foreground mb-4">Board Roles & Opportunities</h2>
        <p className="text-zinc-600 dark:text-zinc-400">
          We are currently gathering the latest executive roles and opportunities for our members. Check back soon!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-border rounded-none p-8 lg:p-12 shadow-sm dark:bg-zinc-950">
      <div className="mb-10 pb-8 border-b border-border flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-serif text-3xl font-medium text-foreground">Executive Board & Opportunities</h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Exclusive career opportunities, Non-Executive Director roles, and board positions curated for Yorkshire Businesswoman members.
          </p>
        </div>
        <a 
          href="mailto:hello@yorkshirebusinesswoman.co.uk?subject=Post%20an%20Opportunity"
          className="inline-flex items-center justify-center rounded-none bg-primary px-4 py-2 text-xs font-medium uppercase tracking-wider text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
        >
          Post an Opportunity
        </a>
      </div>

      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-2">
        {initialOpportunities.map((post) => (
          <article key={post.id} className="group relative flex flex-col items-start justify-between border border-border bg-white dark:bg-zinc-900 p-6 transition-all hover:shadow-md">
            {post.feature_image && (
              <div className="relative w-full aspect-[16/9] mb-4 overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                <Image
                  src={post.feature_image}
                  alt={post.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
            )}
            
            <div className="flex items-center gap-x-4 text-xs">
              <time dateTime={post.published_at} className="text-zinc-500 dark:text-zinc-400 font-medium">
                {new Date(post.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </time>
              <span className="relative z-10 rounded-full bg-indigo-50 px-3 py-1.5 font-semibold uppercase tracking-wider text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                Opportunity
              </span>
            </div>
            
            <div className="group relative">
              <h3 className="mt-4 font-serif text-xl font-medium leading-tight text-foreground group-hover:text-accent transition-colors">
                <a href={`/news/${post.slug}`}>
                  <span className="absolute inset-0" />
                  {post.title}
                </a>
              </h3>
              <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {post.custom_excerpt || post.excerpt}
              </p>
            </div>
            
            <div className="mt-6 flex items-center gap-x-4 border-t border-border pt-4 w-full">
              <div className="text-sm leading-6">
                <p className="font-semibold text-foreground">
                  <a href={`/news/${post.slug}`} className="text-accent hover:underline">
                    View Details &rarr;
                  </a>
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}