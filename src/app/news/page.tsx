import { getPosts } from '@/lib/ghost';
import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';

export const revalidate = 0;

export default async function NewsPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const page = typeof searchParams.page === 'string' ? Number(searchParams.page) : 1;
  const tag = typeof searchParams.tag === 'string' ? searchParams.tag : undefined;
  const limit = 12;

  const filter = tag ? `tag:${tag}+published_at:>='2024-01-01'` : `published_at:>='2024-01-01'`;
  const posts = await getPosts({ limit, page, filter, order: 'published_at DESC' });
  
  const meta = (posts as any).meta;
  const hasNextPage = meta?.next || false;
  const hasPrevPage = meta?.prev || false;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative bg-primary py-20 sm:py-28">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent_50%)]" />
        </div>
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary-foreground/70 mb-4">
              {tag ? 'Filtered by' : 'Stay Informed'}
            </p>
            <h1 className="font-serif text-4xl font-medium tracking-tight text-primary-foreground sm:text-5xl capitalize text-balance">
              {tag ? tag.replace(/-/g, ' ') : 'Latest News'}
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-primary-foreground/70">
              {tag 
                ? `Explore all articles tagged with ${tag.replace(/-/g, ' ')}.`
                : 'Insights, stories, and updates from Yorkshire\'s business community.'}
            </p>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-16 sm:py-20">
        {posts.length > 0 ? (
          <div className="grid grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post: any) => (
              <article key={post.id} className="group flex flex-col">
                <div className="relative w-full overflow-hidden bg-muted mb-6">
                  {post.feature_image ? (
                    <Image
                      src={post.feature_image}
                      alt={post.title}
                      width={800}
                      height={500}
                      className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="aspect-[16/10] w-full bg-muted flex items-center justify-center">
                      <span className="text-muted-foreground text-xs uppercase tracking-wider">No image</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center gap-x-3 text-xs uppercase tracking-wider mb-3">
                    <time dateTime={post.published_at} className="text-accent font-medium">
                      {post.published_at ? format(new Date(post.published_at), 'MMMM d, yyyy') : ''}
                    </time>
                    {post.primary_tag && (
                      <>
                        <span className="text-muted-foreground">|</span>
                        <span className="text-muted-foreground">{post.primary_tag.name}</span>
                      </>
                    )}
                  </div>
                  <h3 className="font-serif text-xl font-medium leading-snug text-foreground group-hover:text-accent transition-colors mb-3">
                    <Link href={`/news/${post.slug}`}>
                      <span className="line-clamp-2">{post.title}</span>
                    </Link>
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 flex-1">
                    {post.custom_excerpt || post.excerpt}
                  </p>
                  <Link 
                    href={`/news/${post.slug}`}
                    className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-accent hover:text-foreground transition-colors mt-4"
                  >
                    Read Article
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <h3 className="font-serif text-2xl text-foreground mb-2">No articles found</h3>
            <p className="text-muted-foreground">Check back later for new content.</p>
          </div>
        )}

        {/* Pagination */}
        {(hasPrevPage || hasNextPage) && (
          <div className="mt-16 flex items-center justify-between border-t border-border pt-8">
            <div className="flex-1">
              {hasPrevPage ? (
                <Link
                  href={`/news?page=${page - 1}${tag ? `&tag=${tag}` : ''}`}
                  className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-accent transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                  </svg>
                  Previous
                </Link>
              ) : (
                <span />
              )}
            </div>
            
            <div className="text-sm text-muted-foreground">
              Page <span className="font-medium text-foreground">{page}</span> of{' '}
              <span className="font-medium text-foreground">{meta?.pages || page}</span>
            </div>
            
            <div className="flex-1 flex justify-end">
              {hasNextPage && (
                <Link
                  href={`/news?page=${page + 1}${tag ? `&tag=${tag}` : ''}`}
                  className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-accent transition-colors"
                >
                  Next
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
