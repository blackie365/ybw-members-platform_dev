import { getPage } from '@/lib/ghost';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ModernContactForm } from '@/components/ModernContactForm';

export const revalidate = 3600;

export default async function ContactPage() {
  const page = await getPage('contact');

  // If Ghost doesn't have a contact page, we can still render the form fallback
  const title = page?.title || 'Contact Us';

  return (
    <div className="py-16 sm:py-24 dark:bg-zinc-900 min-h-screen">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <ModernContactForm />

        {/* Render Ghost Content below the form if it exists */}
        {page?.html && (
          <div className="mx-auto max-w-3xl mt-24 pt-12 border-t border-zinc-200 dark:border-zinc-800">
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
        )}
      </div>
    </div>
  );
}