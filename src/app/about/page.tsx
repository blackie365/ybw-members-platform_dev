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
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative bg-primary py-24 sm:py-32">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent_50%)]" />
        </div>
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary-foreground/70 mb-4">
              Our Story
            </p>
            <h1 className="font-serif text-4xl font-medium tracking-tight text-primary-foreground sm:text-5xl lg:text-6xl text-balance">
              {page.title}
            </h1>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl">
          {page.feature_image && (
            <div className="relative mb-12 aspect-[16/9] w-full overflow-hidden">
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
            className="prose prose-lg max-w-none
              prose-headings:font-serif prose-headings:font-medium prose-headings:tracking-tight prose-headings:text-foreground
              prose-p:text-muted-foreground prose-p:leading-relaxed
              prose-a:text-accent prose-a:no-underline hover:prose-a:underline
              prose-strong:text-foreground prose-strong:font-semibold
              prose-ul:text-muted-foreground prose-ol:text-muted-foreground
              prose-blockquote:border-l-accent prose-blockquote:text-muted-foreground prose-blockquote:italic
              prose-img:rounded-none"
            dangerouslySetInnerHTML={{ __html: page.html }}
          />
        </div>
      </div>
    </div>
  );
}
