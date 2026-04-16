import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';

export function CategorySection({ tag, posts }: { tag: any, posts: any[] }) {
  if (!posts || posts.length === 0) return null;

  return (
    <section className="mb-16">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white capitalize">{tag.name}</h2>
        <Link href={`/news?tag=${tag.slug}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
          View all <span aria-hidden="true">&rarr;</span>
        </Link>
      </div>
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {posts.map((post: any) => (
          <div key={post.id} className="group relative flex flex-col items-start justify-between bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-4 shadow-sm ring-1 ring-zinc-900/5 dark:ring-white/10 transition-shadow hover:shadow-md hover:ring-zinc-900/10 dark:hover:ring-white/20">
            <div className="relative w-full mb-4">
              {post.feature_image ? (
                <Image
                  src={post.feature_image}
                  alt={post.title}
                  width={400}
                  height={250}
                  className="aspect-[16/9] w-full rounded-lg bg-zinc-100 object-cover dark:bg-zinc-800"
                />
              ) : (
                <div className="aspect-[16/9] w-full rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  <span className="text-zinc-400 dark:text-zinc-500 text-xs">No image</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-x-4 text-xs mb-2">
              <time dateTime={post.published_at} className="text-zinc-500 dark:text-zinc-400">
                {post.published_at ? format(new Date(post.published_at), 'MMM d, yyyy') : ''}
              </time>
            </div>
            <h3 className="text-sm font-semibold leading-6 text-zinc-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
              <Link href={`/news/${post.slug}`}>
                <span className="absolute inset-0" />
                {post.title}
              </Link>
            </h3>
            {(post.custom_excerpt || post.excerpt) && (
              <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-zinc-400 line-clamp-2">
                {post.custom_excerpt || post.excerpt}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
