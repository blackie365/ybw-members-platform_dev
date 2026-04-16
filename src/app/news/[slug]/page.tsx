import { getSinglePost } from '@/lib/ghost';
import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';
import { notFound } from 'next/navigation';

export const revalidate = 60; // Revalidate every 60 seconds

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const post = await getSinglePost(resolvedParams.slug);

  if (!post) {
    notFound();
  }

  return (
    <div className="bg-white px-6 py-32 lg:px-8 dark:bg-zinc-900">
      <div className="mx-auto max-w-3xl text-base leading-7 text-zinc-700 dark:text-zinc-300">
        <p className="text-base font-semibold leading-7 text-indigo-600 dark:text-indigo-400">
          {post.primary_tag?.name || 'News'}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
          {post.title}
        </h1>
        <p className="mt-6 text-xl leading-8">
          {post.custom_excerpt || post.excerpt}
        </p>

        <div className="mt-8 flex items-center gap-x-4 border-b border-zinc-200 pb-8 dark:border-zinc-800">
          {post.primary_author?.profile_image ? (
            <Image
              src={post.primary_author.profile_image || ''}
              alt={post.primary_author.name || 'Author'}
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
              {post.primary_author?.name || 'Author'}
            </p>
            <p className="text-zinc-500 dark:text-zinc-400">
              {post.published_at ? format(new Date(post.published_at), 'MMM d, yyyy') : ''}
            </p>
          </div>
        </div>

        {post.feature_image && (
          <figure className="mt-10">
            <Image
              src={post.feature_image || ''}
              alt={post.title || 'Feature image'}
              width={1200}
              height={800}
              className="aspect-video rounded-xl bg-zinc-50 object-cover dark:bg-zinc-800"
            />
            {post.feature_image_caption && (
              <figcaption className="mt-4 flex gap-x-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400" dangerouslySetInnerHTML={{ __html: post.feature_image_caption }} />
            )}
          </figure>
        )}

        <div 
          className="mt-10 max-w-2xl prose dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: post.html || '' }}
        />
        
        <div className="mt-16 flex justify-center">
          <Link href="/news" className="text-sm font-semibold leading-6 text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
            &larr; Back to News
          </Link>
        </div>
      </div>
    </div>
  );
}
