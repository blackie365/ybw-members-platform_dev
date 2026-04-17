import { getSinglePost, getPosts } from '@/lib/ghost';
import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';
import { notFound } from 'next/navigation';

export const revalidate = 3600; // 1 hour (Cache is purged instantly by webhook anyway)

// Optional: Helper function to get related posts based on tags
async function getRelatedPosts(currentPostId: string, tags: any[]) {
  if (!tags || tags.length === 0) return [];
  // Try to fetch posts from the primary tag
  const primaryTag = tags[0];
  const related = await getPosts({ limit: 4, filter: `tag:${primaryTag.slug}+id:-${currentPostId}` });
  return related.slice(0, 3); // Return up to 3 related posts
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const post = await getSinglePost(resolvedParams.slug);

  if (!post) {
    notFound();
  }

  const relatedPosts = await getRelatedPosts(post.id, post.tags);

  return (
    <div className="bg-white py-16 sm:py-24 lg:py-32 dark:bg-zinc-900">
      <article className="mx-auto max-w-3xl px-6 lg:px-8">
        <header className="flex flex-col mb-12">
          {post.primary_tag && (
            <Link 
              href={`/news?tag=${post.primary_tag.slug}`}
              className="text-sm font-semibold tracking-wide uppercase text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 mb-4 inline-block"
            >
              {post.primary_tag.name}
            </Link>
          )}
          <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl dark:text-white leading-tight mb-6">
            {post.title}
          </h1>
          {(post.custom_excerpt || post.excerpt) && (
            <p className="text-xl leading-8 text-zinc-500 dark:text-zinc-400 mb-8">
              {post.custom_excerpt || post.excerpt}
            </p>
          )}

          <div className="flex items-center gap-x-4 border-t border-b border-zinc-200 py-6 dark:border-zinc-800">
            {post.primary_author?.profile_image ? (
              <Image
                src={post.primary_author.profile_image}
                alt={post.primary_author.name || 'Author'}
                width={48}
                height={48}
                className="h-12 w-12 rounded-full bg-zinc-100 object-cover dark:bg-zinc-800"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                <span className="text-zinc-500 text-sm font-medium">
                  {post.primary_author?.name?.charAt(0) || 'A'}
                </span>
              </div>
            )}
            <div className="text-sm leading-6">
              <p className="font-semibold text-zinc-900 dark:text-white">
                {post.primary_author?.name || 'Yorkshire Businesswoman'}
              </p>
              <div className="flex gap-x-2 text-zinc-500 dark:text-zinc-400">
                <time dateTime={post.published_at}>
                  {post.published_at ? format(new Date(post.published_at), 'MMMM d, yyyy') : ''}
                </time>
                {post.reading_time && (
                  <>
                    <span>&middot;</span>
                    <span>{post.reading_time} min read</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {post.feature_image && (
          <figure className="mb-14 -mx-6 sm:mx-0">
            <Image
              src={post.feature_image}
              alt={post.title || 'Feature image'}
              width={1200}
              height={800}
              priority
              className="w-full sm:rounded-2xl bg-zinc-50 object-cover aspect-[16/9] shadow-md dark:bg-zinc-800"
            />
            {post.feature_image_caption && (
              <figcaption 
                className="mt-4 text-center text-sm leading-6 text-zinc-500 dark:text-zinc-400" 
                dangerouslySetInnerHTML={{ __html: post.feature_image_caption }} 
              />
            )}
          </figure>
        )}

        {/* Prose automatically styles standard HTML tags (p, h2, a, blockquote) nicely */}
        <div 
          className="prose prose-lg prose-indigo dark:prose-invert max-w-none prose-a:font-semibold prose-img:rounded-xl prose-img:shadow-md"
          dangerouslySetInnerHTML={{ __html: post.html || '' }}
        />

        <div className="mt-16 flex justify-between items-center border-t border-zinc-200 pt-8 dark:border-zinc-800">
          <div className="flex gap-2 flex-wrap">
            {post.tags?.filter((t: any) => t.visibility === 'public').map((tag: any) => (
              <Link 
                key={tag.slug} 
                href={`/news?tag=${tag.slug}`}
                className="inline-flex items-center rounded-full bg-zinc-50 px-3 py-1 text-sm font-medium text-zinc-600 ring-1 ring-inset ring-zinc-500/10 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-white/10 dark:hover:bg-zinc-700"
              >
                {tag.name}
              </Link>
            ))}
          </div>
        </div>
      </article>

      {/* Related Posts Section */}
      {relatedPosts.length > 0 && (
        <div className="mx-auto mt-24 max-w-7xl px-6 lg:px-8 border-t border-zinc-200 pt-16 dark:border-zinc-800">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-8">Related Articles</h2>
          <div className="grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {relatedPosts.map((relatedPost: any) => (
              <article key={relatedPost.id} className="flex flex-col items-start justify-between bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl ring-1 ring-zinc-200 dark:ring-white/10 hover:shadow-md transition-shadow">
                <div className="relative w-full">
                  {relatedPost.feature_image ? (
                    <Image
                      src={relatedPost.feature_image}
                      alt={relatedPost.title}
                      width={600}
                      height={400}
                      className="aspect-[16/9] w-full rounded-xl bg-zinc-100 object-cover dark:bg-zinc-800"
                    />
                  ) : (
                    <div className="aspect-[16/9] w-full rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                      <span className="text-zinc-400 dark:text-zinc-500 text-xs">No image</span>
                    </div>
                  )}
                </div>
                <div className="max-w-xl w-full mt-4">
                  <div className="flex items-center gap-x-4 text-xs">
                    <time dateTime={relatedPost.published_at} className="text-zinc-500 dark:text-zinc-400">
                      {relatedPost.published_at ? format(new Date(relatedPost.published_at), 'MMM d, yyyy') : ''}
                    </time>
                  </div>
                  <h3 className="mt-3 text-base font-semibold leading-6 text-zinc-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
                    <Link href={`/news/${relatedPost.slug}`}>
                      <span className="absolute inset-0" />
                      {relatedPost.title}
                    </Link>
                  </h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                    {relatedPost.custom_excerpt || relatedPost.excerpt}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
