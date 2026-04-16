import { getPosts } from '@/lib/ghost';
import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';

export const revalidate = 60; // Revalidate every 60 seconds

export default async function NewsPage() {
  const posts = await getPosts();

  return (
    <div className="bg-white py-24 sm:py-32 dark:bg-zinc-900">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
            From the Blog
          </h2>
          <p className="mt-2 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Learn how to grow your business with our expert advice.
          </p>
        </div>
        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-20 lg:mx-0 lg:max-w-none lg:grid-cols-3">
          {posts.map((post: any) => (
            <article key={post.id} className="flex flex-col items-start justify-between">
              <div className="relative w-full">
                {post.feature_image ? (
                  <Image
                    src={post.feature_image}
                    alt={post.title}
                    width={800}
                    height={500}
                    className="aspect-[16/9] w-full rounded-2xl bg-zinc-100 object-cover sm:aspect-[2/1] lg:aspect-[3/2] dark:bg-zinc-800"
                  />
                ) : (
                  <div className="aspect-[16/9] w-full rounded-2xl bg-zinc-100 sm:aspect-[2/1] lg:aspect-[3/2] dark:bg-zinc-800 flex items-center justify-center">
                    <span className="text-zinc-400 dark:text-zinc-500">No image available</span>
                  </div>
                )}
                <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-zinc-900/10 dark:ring-white/10" />
              </div>
              <div className="max-w-xl">
                <div className="mt-8 flex items-center gap-x-4 text-xs">
                  <time dateTime={post.published_at} className="text-zinc-500 dark:text-zinc-400">
                    {post.published_at ? format(new Date(post.published_at), 'MMM d, yyyy') : ''}
                  </time>
                  {post.primary_tag && (
                    <span className="relative z-10 rounded-full bg-zinc-50 px-3 py-1.5 font-medium text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700">
                      {post.primary_tag.name}
                    </span>
                  )}
                </div>
                <div className="group relative">
                  <h3 className="mt-3 text-lg font-semibold leading-6 text-zinc-900 group-hover:text-zinc-600 dark:text-white dark:group-hover:text-zinc-300">
                    <Link href={`/news/${post.slug}`}>
                      <span className="absolute inset-0" />
                      {post.title}
                    </Link>
                  </h3>
                  <p className="mt-5 line-clamp-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                    {post.custom_excerpt || post.excerpt}
                  </p>
                </div>
                <div className="relative mt-8 flex items-center gap-x-4">
                  {post.primary_author?.profile_image ? (
                    <Image
                      src={post.primary_author.profile_image}
                      alt={post.primary_author.name}
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-800"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                      <span className="text-zinc-500 text-xs font-medium">
                        {post.primary_author?.name?.charAt(0) || 'A'}
                      </span>
                    </div>
                  )}
                  <div className="text-sm leading-6">
                    <p className="font-semibold text-zinc-900 dark:text-white">
                      <span className="absolute inset-0" />
                      {post.primary_author?.name || 'Author'}
                    </p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
