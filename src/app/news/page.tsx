import { getPosts } from '@/lib/ghost';
import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';

export const revalidate = 60; // Revalidate every 60 seconds

export default async function NewsPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const page = typeof searchParams.page === 'string' ? Number(searchParams.page) : 1;
  const limit = 12;

  // We can pass `page` and `limit` to getPosts
  const posts = await getPosts({ limit, page });
  
  // getPosts now attaches .meta to the array if it exists
  const meta = (posts as any).meta;
  const hasNextPage = meta?.next || false;
  const hasPrevPage = meta?.prev || false;

  return (
    <div className="bg-white py-12 sm:py-16 dark:bg-zinc-900">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
            Latest Posts
          </h2>
          <p className="mt-4 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Read all our chronological posts, news, and updates.
          </p>
        </div>
        
        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 lg:mx-0 lg:max-w-none lg:grid-cols-3">
          {posts.map((post: any) => (
            <article key={post.id} className="flex flex-col items-start justify-between bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl p-6 shadow-sm ring-1 ring-zinc-900/5 dark:ring-white/10 hover:shadow-md transition-shadow">
              <div className="relative w-full">
                {post.feature_image ? (
                  <Image
                    src={post.feature_image}
                    alt={post.title}
                    width={800}
                    height={500}
                    className="aspect-[16/9] w-full rounded-2xl bg-zinc-100 object-cover dark:bg-zinc-800"
                  />
                ) : (
                  <div className="aspect-[16/9] w-full rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    <span className="text-zinc-400 dark:text-zinc-500">No image available</span>
                  </div>
                )}
              </div>
              <div className="max-w-xl w-full mt-6">
                <div className="flex items-center gap-x-4 text-xs">
                  <time dateTime={post.published_at} className="text-zinc-500 dark:text-zinc-400">
                    {post.published_at ? format(new Date(post.published_at), 'MMM d, yyyy') : ''}
                  </time>
                  {post.primary_tag && (
                    <span className="relative z-10 rounded-full bg-zinc-200/50 px-3 py-1.5 font-medium text-zinc-700 dark:bg-zinc-700/50 dark:text-zinc-300">
                      {post.primary_tag.name}
                    </span>
                  )}
                </div>
                <div className="group relative mt-4">
                  <h3 className="text-lg font-semibold leading-6 text-zinc-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
                    <Link href={`/news/${post.slug}`}>
                      <span className="absolute inset-0" />
                      {post.title}
                    </Link>
                  </h3>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                    {post.custom_excerpt || post.excerpt}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* Pagination Controls */}
        <div className="mt-16 flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 pt-6">
          <div className="flex flex-1 justify-between sm:hidden">
            {hasPrevPage ? (
              <Link
                href={`/news?page=${page - 1}`}
                className="relative inline-flex items-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700/50"
              >
                Previous
              </Link>
            ) : (
              <span className="opacity-0 px-4 py-2">Previous</span> // Spacer
            )}
            {hasNextPage && (
              <Link
                href={`/news?page=${page + 1}`}
                className="relative ml-3 inline-flex items-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700/50"
              >
                Next
              </Link>
            )}
          </div>
          
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-zinc-700 dark:text-zinc-400">
                Showing page <span className="font-semibold text-zinc-900 dark:text-white">{page}</span> of{' '}
                <span className="font-semibold text-zinc-900 dark:text-white">{meta?.pages || page}</span>
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                {hasPrevPage ? (
                  <Link
                    href={`/news?page=${page - 1}`}
                    className="relative inline-flex items-center rounded-l-md px-4 py-2 text-sm font-semibold text-zinc-900 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50 focus:z-20 focus:outline-offset-0 dark:text-white dark:ring-zinc-700 dark:hover:bg-zinc-800"
                  >
                    Previous
                  </Link>
                ) : (
                  <span className="relative inline-flex items-center rounded-l-md px-4 py-2 text-sm font-semibold text-zinc-400 ring-1 ring-inset ring-zinc-300 dark:text-zinc-600 dark:ring-zinc-800 cursor-not-allowed">
                    Previous
                  </span>
                )}
                
                {hasNextPage ? (
                  <Link
                    href={`/news?page=${page + 1}`}
                    className="relative inline-flex items-center rounded-r-md px-4 py-2 text-sm font-semibold text-zinc-900 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50 focus:z-20 focus:outline-offset-0 dark:text-white dark:ring-zinc-700 dark:hover:bg-zinc-800"
                  >
                    Next
                  </Link>
                ) : (
                  <span className="relative inline-flex items-center rounded-r-md px-4 py-2 text-sm font-semibold text-zinc-400 ring-1 ring-inset ring-zinc-300 dark:text-zinc-600 dark:ring-zinc-800 cursor-not-allowed">
                    Next
                  </span>
                )}
              </nav>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
