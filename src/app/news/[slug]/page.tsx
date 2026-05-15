import { getSinglePost, getPosts } from '@/lib/ghost';
import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';
import { notFound } from 'next/navigation';
import { EventTicketCard } from '@/components/EventTicketCard';
import { AdSlot } from '@/components/magazine/AdSlot';
import { Metadata } from 'next';
import { EventRSVP } from '@/components/EventRSVP';
import { ArrowLeft } from 'lucide-react';

export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const post = await getSinglePost(resolvedParams.slug);

  if (!post) {
    return { title: 'Not Found' };
  }

  const excerpt = post.custom_excerpt || post.excerpt || 'Read this article on Yorkshire BusinessWoman.';

  return {
    title: post.title,
    description: excerpt,
    alternates: {
      canonical: `/news/${post.slug}`,
    },
    openGraph: {
      title: post.title,
      description: excerpt,
      url: `/news/${post.slug}`,
      type: 'article',
      publishedTime: post.published_at,
      authors: post.primary_author ? [post.primary_author.name] : undefined,
      images: post.feature_image ? [{ url: post.feature_image }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: excerpt,
      images: post.feature_image ? [post.feature_image] : [],
    },
  };
}

async function getRelatedPosts(currentPostId: string, tags: any[]) {
  if (!tags || tags.length === 0) return [];
  const primaryTag = tags[0];
  const related = await getPosts({ limit: 4, filter: `tag:${primaryTag.slug}+id:-${currentPostId}` });
  return related.slice(0, 3);
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const post = await getSinglePost(resolvedParams.slug);

  if (!post) {
    notFound();
  }

  const relatedPosts = await getRelatedPosts(post.id, post.tags);
  const isEvent = post.tags?.some((t: any) => t.slug === 'events');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': isEvent ? 'Event' : 'Article',
    headline: post.title,
    name: post.title,
    image: post.feature_image ? [post.feature_image] : [],
    datePublished: post.published_at,
    dateModified: post.updated_at || post.published_at,
    author: [{
      '@type': 'Person',
      name: post.primary_author?.name || 'Yorkshire Businesswoman',
      url: post.primary_author?.website || `https://yorkshirebusinesswoman.co.uk`
    }],
    ...(isEvent && {
      startDate: post.published_at,
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      eventStatus: 'https://schema.org/EventScheduled',
      location: {
        '@type': 'Place',
        name: 'Yorkshire',
        address: 'Yorkshire, UK'
      }
    })
  };

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      
      {/* Hero Section with Feature Image */}
      {post.feature_image && (
        <div className="relative h-[50vh] min-h-[400px] max-h-[600px] bg-primary">
          <Image
            src={post.feature_image}
            alt={post.title || 'Feature image'}
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        </div>
      )}

      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-12 lg:py-16">
        {/* Back Link */}
        <Link 
          href="/news"
          className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-accent hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to News
        </Link>

        <div className="flex flex-col lg:flex-row gap-16">
          {/* Main Article Content */}
          <article className="flex-1 lg:max-w-[720px]">
            <header className="mb-10">
              {post.primary_tag && (
                <Link 
                  href={`/news?tag=${post.primary_tag.slug}`}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-accent bg-accent/10 mb-6"
                >
                  {post.primary_tag.name}
                </Link>
              )}
              <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-foreground leading-tight mb-6 text-balance">
                {post.title}
              </h1>

              <div className="flex items-center gap-x-4 border-t border-b border-border py-6">
                {post.primary_author?.profile_image ? (
                  <Image
                    src={post.primary_author.profile_image}
                    alt={post.primary_author.name || 'Author'}
                    width={48}
                    height={48}
                    className="h-12 w-12 object-cover bg-muted"
                  />
                ) : (
                  <div className="h-12 w-12 bg-muted flex items-center justify-center">
                    <span className="text-muted-foreground text-sm font-medium">
                      {post.primary_author?.name?.charAt(0) || 'A'}
                    </span>
                  </div>
                )}
                <div>
                  <p className="font-medium text-foreground">
                    {post.primary_author?.name || 'Yorkshire Businesswoman'}
                  </p>
                  <div className="flex gap-x-2 text-sm text-muted-foreground">
                    <time dateTime={post.published_at}>
                      {post.published_at ? format(new Date(post.published_at), 'MMMM d, yyyy') : ''}
                    </time>
                    {post.reading_time && (
                      <>
                        <span>|</span>
                        <span>{post.reading_time} min read</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </header>

            {/* Article body */}
            <div 
              className="prose prose-lg max-w-none
                prose-headings:font-serif prose-headings:font-medium prose-headings:tracking-tight prose-headings:text-foreground
                prose-p:text-muted-foreground prose-p:leading-relaxed
                prose-a:text-accent prose-a:no-underline hover:prose-a:underline prose-a:font-medium
                prose-strong:text-foreground prose-strong:font-semibold
                prose-ul:text-muted-foreground prose-ol:text-muted-foreground
                prose-blockquote:border-l-accent prose-blockquote:text-muted-foreground prose-blockquote:italic
                prose-img:rounded-none
                [&>p:first-of-type]:text-lg [&>p:first-of-type]:font-medium [&>p:first-of-type]:leading-relaxed [&>p:first-of-type]:text-foreground/80 [&>p:first-of-type]:mb-8" 
              dangerouslySetInnerHTML={{ 
                __html: (() => {
                  let html = post.html || '';
                  const customExcerptText = (post.custom_excerpt || '').trim();
                  
                  const firstParaMatch = html.match(/^\s*<p>(.*?)<\/p>/i);
                  if (firstParaMatch && customExcerptText) {
                    const firstParaText = firstParaMatch[1].replace(/<[^>]+>/g, '').trim();
                    
                    if (firstParaText === customExcerptText) {
                      html = html.replace(/^\s*<p>.*?<\/p>\s*/i, '');
                    }
                  }
                  return html;
                })() 
              }} 
            />
            
            <div className="mt-12">
              <AdSlot type="mid-article" />
            </div>

            {isEvent && (
              <div className="mt-12 pt-8 border-t border-border">
                <EventRSVP eventSlug={post.slug} eventTitle={post.title} />
              </div>
            )}
          </article>

          {/* Sidebar */}
          <aside className="w-full lg:w-80 xl:w-96 flex-shrink-0">
            <div className="sticky top-24 flex flex-col gap-8">
              {isEvent && <EventTicketCard post={post} />}
              <AdSlot type="sidebar-mpu" />
            </div>
          </aside>
        </div>
      </div>

      {/* Related Posts Section */}
      {relatedPosts.length > 0 && (
        <div className="bg-muted/50 border-t border-border">
          <div className="mx-auto max-w-7xl px-6 lg:px-8 py-16">
            <h2 className="font-serif text-2xl font-medium text-foreground mb-10">Related Articles</h2>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {relatedPosts.map((relatedPost: any) => (
                <article key={relatedPost.id} className="group flex flex-col bg-card border border-border hover:border-accent/30 transition-colors">
                  <div className="relative w-full overflow-hidden">
                    {relatedPost.feature_image ? (
                      <Image
                        src={relatedPost.feature_image}
                        alt={relatedPost.title}
                        width={600}
                        height={400}
                        className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="aspect-[16/10] w-full bg-muted flex items-center justify-center">
                        <span className="text-muted-foreground text-xs uppercase tracking-wider">No image</span>
                      </div>
                    )}
                  </div>
                  <div className="p-6 flex-1 flex flex-col">
                    <time dateTime={relatedPost.published_at} className="text-xs uppercase tracking-wider text-accent font-medium mb-3">
                      {relatedPost.published_at ? format(new Date(relatedPost.published_at), 'MMMM d, yyyy') : ''}
                    </time>
                    <h3 className="font-serif text-lg font-medium leading-snug text-foreground group-hover:text-accent transition-colors mb-3">
                      <Link href={`/news/${relatedPost.slug}`}>
                        <span className="line-clamp-2">{relatedPost.title}</span>
                      </Link>
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                      {relatedPost.custom_excerpt || relatedPost.excerpt}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
