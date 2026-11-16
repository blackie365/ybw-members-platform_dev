import { getSinglePost, getPosts } from '@/lib/ghost';
import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';
import { notFound } from 'next/navigation';
import { EventTicketCard } from '@/components/EventTicketCard';
import { AdSlot } from '@/components/magazine/AdSlot';
import { ArticleBody } from '@/components/news/ArticleBody';
import { Metadata } from 'next';
import { EventRSVP } from '@/components/EventRSVP';
import { ArrowLeft, Clock3, Facebook, Linkedin, Lock, Mail, Newspaper, Twitter } from 'lucide-react';
import { auth } from '@clerk/nextjs/server';
import { getEventMetadata } from '@/app/actions/eventActions';
import { getArticleStandfirst } from '@/lib/news/article-standfirst';
import { getStoredArticleEnhancement } from '@/lib/news/article-enhancements';
import { EDITORIAL_IDENTITY } from '@/lib/editorial';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const post = await getSinglePost(resolvedParams.slug);

  if (!post) {
    return { title: 'Not Found' };
  }

  const standfirst = getArticleStandfirst(post);
  const excerpt = standfirst || 'Read this article on Yorkshire BusinessWoman.';

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
      authors: [EDITORIAL_IDENTITY.personName],
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
  // Removed the date filter from related posts as well to ensure they show up correctly.
  const related = await getPosts({ limit: 4, filter: `tag:${primaryTag.slug}+id:-${currentPostId}` });
  return related.slice(0, 3);
}

function pickAdFromSlotConfig(slot: any): { imageUrl?: string; linkUrl?: string; altText?: string } | undefined {
  if (!slot || slot.enabled === false) return undefined;

  const altText = slot.altText || 'Advertisement';

  const rotationEnabled = slot.rotation?.enabled === true;
  const rawItems = Array.isArray(slot.rotation?.items) ? slot.rotation.items : [];
  const intervalSecondsRaw = typeof slot.rotation?.intervalSeconds === 'number' ? slot.rotation.intervalSeconds : 30;
  const intervalSeconds = Math.min(3600, Math.max(5, Math.floor(intervalSecondsRaw || 30)));
  const intervalMs = intervalSeconds * 1000;

  if (rotationEnabled && rawItems.length > 0) {
    const now = new Date();
    const eligible = rawItems
      .filter((item: any) => item && item.enabled !== false)
      .filter((item: any) => Boolean(item.imageUrl))
      .filter((item: any) => {
        const startAt = item.startAt ? new Date(item.startAt) : null;
        const endAt = item.endAt ? new Date(item.endAt) : null;
        if (startAt && Number.isFinite(startAt.getTime()) && now < startAt) return false;
        if (endAt && Number.isFinite(endAt.getTime()) && now > endAt) return false;
        return true;
      });

    if (eligible.length > 0) {
      const bucket = Math.floor(Date.now() / intervalMs);
      const item = eligible[bucket % eligible.length];
      return {
        imageUrl: item.imageUrl,
        linkUrl: item.linkUrl || slot.linkUrl || '',
        altText: item.altText || altText,
      };
    }
  }

  if (!slot.imageUrl) return undefined;
  return {
    imageUrl: slot.imageUrl,
    linkUrl: slot.linkUrl || '',
    altText,
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const post = await getSinglePost(resolvedParams.slug);

  if (!post) {
    notFound();
  }

  const relatedPosts = await getRelatedPosts(post.id, post.tags);
  const isEvent = post.tags?.some((t: any) => t.slug === 'events');

  // Check event access level if it's an event
  let accessLevel = 'public';
  let ticketCardEnabled = false; // Hidden by default as requested
  if (isEvent) {
    const metadataRes = await getEventMetadata(post.slug);
    if (metadataRes.success && metadataRes.data) {
      ticketCardEnabled = metadataRes.data.ticketCardEnabled === true;
      if (metadataRes.data.accessLevel === 'members-only') {
        accessLevel = 'members-only';
      }
    }
  }

  const session = accessLevel === 'members-only' ? await auth() : null;
  const isLocked = accessLevel === 'members-only' && !session?.userId;
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://yorkshirebusinesswoman.co.uk').replace(/\/$/, '');
  const canonicalUrl = `${baseUrl}/news/${post.slug}`;
  const shareUrl = encodeURIComponent(canonicalUrl);
  const shareTitle = encodeURIComponent(post.title || 'Yorkshire BusinessWoman');
  const standfirst = getArticleStandfirst(post);
  const enhancement = await getStoredArticleEnhancement(post.slug, post.html);
  const shareBody = encodeURIComponent(`${canonicalUrl}\n\n${standfirst}`);
  const pub = post.published_at ? new Date(post.published_at) : null;
  const storyMeta = [
    pub ? format(pub, 'MMMM d, yyyy') : null,
    post.reading_time ? `${post.reading_time} min read` : null,
    canonicalUrl ? 'YorkshireBusinessWoman.co.uk' : null,
  ].filter(Boolean);
  const shareLinks = [
    {
      href: `https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareTitle}`,
      label: 'Share on X',
      tip: 'Share on X',
      icon: Twitter,
      external: true,
    },
    {
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`,
      label: 'Share on LinkedIn',
      tip: 'Share on LinkedIn',
      icon: Linkedin,
      external: true,
    },
    {
      href: `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`,
      label: 'Share on Facebook',
      tip: 'Share on Facebook',
      icon: Facebook,
      external: true,
    },
    {
      href: `mailto:?subject=${shareTitle}&body=${shareBody}`,
      label: 'Share by email',
      tip: 'Email a link',
      icon: Mail,
      external: false,
    },
  ];

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
      name: EDITORIAL_IDENTITY.personName,
      url: EDITORIAL_IDENTITY.siteUrl,
    }],
    publisher: {
      '@type': 'Organization',
      name: 'Yorkshire BusinessWoman',
      url: 'https://yorkshirebusinesswoman.co.uk',
      logo: {
        '@type': 'ImageObject',
        url: 'https://yorkshirebusinesswoman.co.uk/images/logo-nav-v3.png',
      },
    },
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

  let adsConfig: any = {};
  try {
    const { getSystemSettingData } = await import('@/features/system/server/system-store');
    adsConfig = await getSystemSettingData('system:ads');
  } catch (e) {}

  const midArticleAd = pickAdFromSlotConfig(adsConfig?.midArticle);
  const sidebarMpuAd = pickAdFromSlotConfig(adsConfig?.sidebarMpu);

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      
      <section
        className={[
          'relative isolate overflow-hidden border-b border-border',
          post.feature_image ? 'bg-primary' : 'paper-grad',
        ].join(' ')}
      >
        {post.feature_image ? (
          <div className="absolute inset-0">
            <div className="relative h-full w-full min-h-[420px]">
              <Image
                src={post.feature_image}
                alt={post.title || 'Feature image'}
                fill
                priority
                sizes="100vw"
                className="object-cover"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-black/20" />
          </div>
        ) : null}

        <div
          className={[
            'mx-auto max-w-7xl px-6 lg:px-8 relative',
            post.feature_image
              ? 'min-h-[420px] py-12 sm:min-h-[500px] sm:py-16 lg:min-h-[600px] lg:py-24 flex items-end'
              : 'py-12 lg:py-16',
          ].join(' ')}
        >
          <div className={post.feature_image ? 'max-w-4xl text-white' : 'max-w-4xl'}>
            <Link
              href="/news"
              className={[
                'inline-flex items-center gap-2 kicker text-[10px] mb-6',
                post.feature_image ? 'text-white/80 hover:text-white' : 'text-accent hover:text-foreground',
              ].join(' ')}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to News
            </Link>

            {post.primary_tag ? (
              <Link
                href={`/news?tag=${post.primary_tag.slug}`}
                className={[
                  'inline-flex items-center px-3 py-1.5 kicker text-[10px] mb-5 border',
                  post.feature_image
                    ? 'border-white/30 bg-white/10 text-white backdrop-blur-sm'
                    : 'border-accent/20 bg-accent text-white',
                ].join(' ')}
              >
                {post.primary_tag.name}
              </Link>
            ) : null}

            <h1
              className={[
                'font-serif text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-balance',
                post.feature_image ? 'leading-[1.02] text-white' : 'leading-[1.08] text-foreground',
              ].join(' ')}
            >
              {post.title}
            </h1>

            <div
              className={[
                'mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm',
                post.feature_image ? 'text-white/72' : 'text-muted-foreground',
              ].join(' ')}
            >
              <span className="inline-flex items-center gap-2">
                <Image
                  src={EDITORIAL_IDENTITY.imageUrl}
                  alt={EDITORIAL_IDENTITY.personName}
                  width={34}
                  height={34}
                  className="h-8 w-8 rounded-full object-cover bg-white/10"
                />
                <span className="font-medium">{EDITORIAL_IDENTITY.displayName}</span>
              </span>

              {storyMeta.map((item) => (
                <span key={item} className="inline-flex items-center gap-3">
                  <span aria-hidden className="hidden sm:inline">•</span>
                  <span>{item}</span>
                </span>
              ))}
            </div>
          </div>

          {post.feature_image ? (
            <div className="absolute right-4 top-4 hidden lg:flex items-center gap-2 border border-white/15 bg-black/20 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-white/78 backdrop-blur-sm">
              <Newspaper className="h-4 w-4" />
              Designed for reading, not just scrolling
            </div>
          ) : null}
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-10 lg:py-14">
        <div className="grid gap-10 xl:grid-cols-[200px_minmax(0,1fr)_320px]">
          <aside className="hidden xl:block">
            <div className="sticky top-24 space-y-5">
              <div className="border border-border bg-card p-5">
                <p className="kicker text-[10px] text-accent mb-4">Story details</p>
                <dl className="grid gap-4 text-sm">
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-1">Author</dt>
                    <dd className="font-medium text-foreground">{EDITORIAL_IDENTITY.displayName}</dd>
                  </div>
                  {pub ? (
                    <div>
                      <dt className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-1">Published</dt>
                      <dd className="font-medium text-foreground">{format(pub, 'MMMM d, yyyy')}</dd>
                    </div>
                  ) : null}
                  {post.reading_time ? (
                    <div>
                      <dt className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-1">Reading time</dt>
                      <dd className="inline-flex items-center gap-2 font-medium text-foreground">
                        <Clock3 className="h-4 w-4 text-accent" />
                        {post.reading_time} min
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>

              <div className="border border-border bg-card p-5">
                <p className="kicker text-[10px] text-muted-foreground mb-4">Share</p>
                <div className="grid grid-cols-2 gap-2">
                  {shareLinks.map((item) => {
                    const Icon = item.icon;
                    return (
                      <a
                        key={item.label}
                        href={item.href}
                        target={item.external ? '_blank' : undefined}
                        rel={item.external ? 'noreferrer noopener' : undefined}
                        aria-label={item.label}
                        data-tip={item.tip}
                        className="share-btn !w-full"
                      >
                        <Icon className="h-4 w-4" />
                      </a>
                    );
                  })}
                </div>
              </div>
            </div>
          </aside>

          <article className="min-w-0 max-w-[780px]">
            <div className="hero-frame bg-card p-5 sm:p-8 lg:p-10">
              {isLocked ? (
                <div className="bg-accent/5 border border-accent/20 rounded-none p-12 text-center my-6">
                  <div className="mx-auto w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-6">
                    <Lock className="w-8 h-8 text-accent" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-foreground mb-4">Members Only Event</h2>
                  <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                    This event details and ticket booking are reserved for registered members of Yorkshire BusinessWoman.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link
                      href={`/login?redirect=/news/${post.slug}`}
                      className="w-full sm:w-auto px-8 py-3 bg-accent text-white font-semibold rounded-none hover:bg-accent/90 transition-colors"
                    >
                      Login to View
                    </Link>
                    <Link
                      href="/membership"
                      className="w-full sm:w-auto px-8 py-3 border border-accent text-accent font-semibold rounded-none hover:bg-accent/5 transition-colors"
                    >
                      Become a Member
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  <ArticleBody html={post.html} standfirst={standfirst} enhancement={enhancement} />

                  <div className="mt-12">
                    <AdSlot
                      type="mid-article"
                      imageUrl={midArticleAd?.imageUrl}
                      linkUrl={midArticleAd?.linkUrl}
                      altText={midArticleAd?.altText}
                    />
                  </div>

                  {isEvent ? (
                    <div className="mt-12 pt-8 border-t border-border">
                      <EventRSVP eventSlug={post.slug} eventTitle={post.title} />
                    </div>
                  ) : null}
                </>
              )}
            </div>

            <div className="mt-10 border-t border-border pt-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="min-w-0 max-w-full">
                  <p className="kicker text-[10px] text-muted-foreground">Share this article</p>
                  <p className="text-sm text-muted-foreground mt-1 break-all font-mono text-[12px]">
                    {canonicalUrl}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {shareLinks.map((item) => {
                    const Icon = item.icon;
                    return (
                      <a
                        key={item.label}
                        href={item.href}
                        target={item.external ? '_blank' : undefined}
                        rel={item.external ? 'noreferrer noopener' : undefined}
                        aria-label={item.label}
                        data-tip={item.tip}
                        className="share-btn"
                      >
                        <Icon className="h-4 w-4" />
                      </a>
                    );
                  })}
                </div>
              </div>
            </div>
          </article>

          <aside className="w-full lg:w-80 shrink-0">
            <div className="lg:sticky lg:top-20 flex flex-col gap-6">
              <div className="border border-border bg-card p-6 xl:hidden">
                <p className="kicker text-[10px] text-accent mb-3">Story details</p>
                <div className="grid gap-3 text-sm text-ink-soft">
                  <p><span className="text-muted-foreground">Author:</span> {EDITORIAL_IDENTITY.displayName}</p>
                  {pub ? <p><span className="text-muted-foreground">Published:</span> {format(pub, 'MMMM d, yyyy')}</p> : null}
                  {post.reading_time ? <p><span className="text-muted-foreground">Reading time:</span> {post.reading_time} min</p> : null}
                </div>
              </div>

              {isEvent && !isLocked && ticketCardEnabled ? <EventTicketCard post={post} /> : null}

              <AdSlot
                type="sidebar-mpu"
                imageUrl={sidebarMpuAd?.imageUrl}
                linkUrl={sidebarMpuAd?.linkUrl}
                altText={sidebarMpuAd?.altText}
              />

              {relatedPosts.length > 0 ? (
                <div className="border border-border bg-card p-6">
                  <div className="kicker text-[10px] text-accent mb-2 flex items-center gap-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent pulse-wire" />
                    Related Articles
                  </div>
                  <p className="font-serif text-xl mb-4">Continue the story</p>
                  <ul className="divide-y divide-border">
                    {relatedPosts.map((relatedPost: any, index: number) => (
                      <li key={relatedPost.id}>
                        <Link href={`/news/${relatedPost.slug}`} className="group flex gap-3 py-3 items-start">
                          <span className="pillar-num text-[1.6rem] leading-none mt-0.5">{String(index + 1).padStart(2, '0')}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                              {relatedPost.primary_tag?.name || 'News'}
                            </span>
                            <span className="font-serif block text-[0.95rem] font-medium leading-snug group-hover:text-accent line-clamp-3">
                              {relatedPost.title}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
