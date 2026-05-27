"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

export function HeroSection({ posts }: { posts: any[] }) {
  if (!posts || posts.length === 0) return null;

  const coverStory = posts[0];
  const secondaryStories = posts.slice(1, 3);

  return (
    <section className="relative bg-primary">
      {/* Decorative background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.05),transparent_50%)]" />
      
      <div className="relative mx-auto max-w-7xl px-4 py-16 lg:px-8 lg:py-24">
        {/* Section Label */}
        <div className="mb-10 flex items-center gap-4">
          <div className="h-px flex-1 bg-primary-foreground/20" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary-foreground/60">
            This Week&apos;s Features
          </span>
          <div className="h-px flex-1 bg-primary-foreground/20" />
        </div>

        <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
          {/* Featured Article - Takes 7 columns */}
          <article className="group relative lg:col-span-7">
            <Link href={`/news/${coverStory.slug}`} className="block h-full">
              <div className="relative h-full min-h-[520px] w-full overflow-hidden">
                <Image
                  src={coverStory.feature_image || "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&q=80"}
                  alt={coverStory.title}
                  fill
                  className="object-cover transition-all duration-700 group-hover:scale-[1.02]"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-8 lg:p-12">
                <div className="flex items-center gap-3 mb-4">
                  <span className="inline-block bg-accent px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-foreground">
                    Cover Story
                  </span>
                  <span className="text-[11px] font-medium text-white/70">
                    {coverStory.reading_time ? `${coverStory.reading_time} min read` : "5 min read"}
                  </span>
                </div>
                <h2 className="font-serif text-3xl font-medium leading-[1.15] text-white lg:text-5xl">
                  <span className="text-balance">
                    {coverStory.title}
                  </span>
                </h2>
                <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-white/80 line-clamp-2">
                  {coverStory.custom_excerpt || coverStory.excerpt || ""}
                </p>
                <div className="mt-8 inline-flex items-center gap-3 border-b border-white/40 pb-1 text-white transition-colors group-hover:border-accent group-hover:text-accent">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.15em]">
                    Read Article
                  </span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </Link>
          </article>

          {/* Secondary Articles - Takes 5 columns */}
          <div className="flex flex-col gap-6 lg:col-span-5">
            {secondaryStories.map((post, index) => (
              <SecondaryArticle
                key={post.id}
                image={post.feature_image || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=600&q=80"}
                category={post.primary_tag?.name || "News"}
                title={post.title}
                description={post.custom_excerpt || post.excerpt || ""}
                slug={post.slug}
                readingTime={post.reading_time}
                isLast={index === secondaryStories.length - 1}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function SecondaryArticle({
  image,
  category,
  title,
  description,
  slug,
  readingTime,
  isLast,
}: {
  image: string
  category: string
  title: string
  description: string
  slug: string
  readingTime?: number
  isLast?: boolean
}) {
  return (
    <article className={`group flex flex-1 flex-col ${!isLast ? 'border-b border-primary-foreground/20 pb-6' : ''}`}>
      <Link href={`/news/${slug}`} className="flex h-full flex-col lg:flex-row lg:gap-6">
        <div className="relative aspect-[16/10] overflow-hidden lg:aspect-[4/3] lg:w-44 lg:shrink-0">
          <Image
            src={image}
            alt={title}
            fill
            className="object-cover transition-all duration-500 group-hover:scale-[1.03]"
          />
        </div>
        <div className="flex flex-1 flex-col justify-center py-4 lg:py-0">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
              {category}
            </span>
            <span className="h-1 w-1 rounded-full bg-primary-foreground/30" />
            <span className="text-[10px] text-primary-foreground/60">
              {readingTime ? `${readingTime} min` : "5 min"}
            </span>
          </div>
          <h3 className="mt-3 font-serif text-xl font-medium leading-snug text-primary-foreground transition-colors group-hover:text-accent">
            <span className="text-balance line-clamp-2">{title}</span>
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-primary-foreground/70 line-clamp-2">
            {description}
          </p>
          <div className="mt-4 flex items-center gap-2 text-primary-foreground/60 transition-colors group-hover:text-accent">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em]">
              Read More
            </span>
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </Link>
    </article>
  )
}
