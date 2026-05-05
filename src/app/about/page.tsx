import { getPage } from '@/lib/ghost';
import Image from 'next/image';
import { notFound } from 'next/navigation';

export const revalidate = 3600;

export default async function AboutPage() {
  const page = await getPage('about');

  if (!page) {
    notFound();
  }

  return (
    <div className="py-16 sm:py-24 dark:bg-zinc-900">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl dark:text-white mb-8">
            {page.title}
          </h1>
          
          {page.feature_image && (
            <div className="relative mb-12 aspect-[16/9] w-full overflow-hidden rounded-2xl">
              <Image
                src={page.feature_image}
                alt={page.title}
                fill
                className="object-cover"
                priority
              />
            </div>
          )}
          
          <div 
            className="prose prose-lg dark:prose-invert prose-zinc max-w-none"
            dangerouslySetInnerHTML={{ __html: page.html }}
          />
        </div>
      </div>
    </div>
  );
}