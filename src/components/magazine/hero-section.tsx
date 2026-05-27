"use client"

// Full-width hero carousel with latest articles overlay
import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { motion } from "framer-motion"
import useEmblaCarousel from "embla-carousel-react"
import Autoplay from "embla-carousel-autoplay"

export function HeroSection({ posts }: { posts: any[] }) {
  const [mounted, setMounted] = React.useState(false)
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, duration: 40 },
    [Autoplay({ delay: 5000, stopOnInteraction: false, stopOnMouseEnter: true })]
  )

  const [currentIndex, setCurrentIndex] = React.useState(0)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (!emblaApi) return

    const onSelect = () => {
      setCurrentIndex(emblaApi.selectedScrollSnap())
    }

    emblaApi.on("select", onSelect)
    onSelect()

    return () => {
      emblaApi.off("select", onSelect)
    }
  }, [emblaApi])

  if (!mounted || !posts || posts.length === 0) {
    // Render a placeholder or nothing during SSR to avoid hydration mismatches
    return <div className="w-full h-[85vh] bg-zinc-900 animate-pulse" />
  }

  // Use first 5 posts for carousel slides
  const carouselPosts = posts.slice(0, 5)
  // Use first 3 posts for the overlaid articles menu
  const latestArticles = posts.slice(0, 3)

  return (
    <section className="relative w-full h-[85vh] min-h-[600px] max-h-[900px] overflow-hidden bg-primary">
      {/* Full Width Carousel */}
      <div ref={emblaRef} className="absolute inset-0 overflow-hidden">
        <div className="flex h-full">
          {carouselPosts.map((post, index) => (
            <div
              key={post.id}
              className="relative flex-none w-full h-full"
            >
              <Image
                src={post.feature_image || "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1600&q=80"}
                alt={post.title}
                fill
                className="object-cover"
                priority={index === 0}
              />
              {/* Gradient overlay for readability */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
            </div>
          ))}
        </div>
      </div>

      {/* Content Overlay */}
      <div className="relative h-full mx-auto max-w-7xl px-4 lg:px-8">
        <div className="flex h-full items-end pb-16 lg:pb-24">
          <div className="grid w-full gap-8 lg:grid-cols-12 lg:gap-12 items-end">
            
            {/* Left Side - Current Slide Info */}
            <div className="lg:col-span-7 space-y-6">
              {/* Progress Indicators */}
              <div className="flex gap-2">
                {carouselPosts.map((_, index) => (
                  <div
                    key={index}
                    className="relative h-1 flex-1 max-w-16 bg-white/20 overflow-hidden"
                  >
                    <motion.div
                      className="absolute inset-y-0 left-0 bg-accent"
                      initial={{ width: "0%" }}
                      animate={{ 
                        width: index === currentIndex ? "100%" : index < currentIndex ? "100%" : "0%" 
                      }}
                      transition={{ 
                        duration: index === currentIndex ? 5 : 0.5,
                        ease: "linear"
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Current Slide Content */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="inline-block bg-accent px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-foreground">
                    {carouselPosts[currentIndex]?.primary_tag?.name || "Featured"}
                  </span>
                  <span className="text-[11px] font-medium text-white/70">
                    {carouselPosts[currentIndex]?.reading_time ? `${carouselPosts[currentIndex].reading_time} min read` : "5 min read"}
                  </span>
                </div>

                <h1 className="font-serif text-3xl font-medium leading-[1.1] text-white md:text-4xl lg:text-5xl xl:text-6xl">
                  <span className="text-balance">
                    {carouselPosts[currentIndex]?.title}
                  </span>
                </h1>

                <p className="max-w-xl text-base leading-relaxed text-white/80 line-clamp-2 lg:text-lg">
                  {carouselPosts[currentIndex]?.custom_excerpt || carouselPosts[currentIndex]?.excerpt || ""}
                </p>

                <Link
                  href={`/news/${carouselPosts[currentIndex]?.slug}`}
                  className="group mt-4 inline-flex items-center gap-3 border-b border-white/40 pb-1 text-white transition-colors hover:border-accent hover:text-accent"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-[0.15em]">
                    Read Article
                  </span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>

            {/* Right Side - Latest Articles Menu (Superposed) */}
            <div className="hidden lg:col-span-5 lg:flex lg:flex-col lg:items-end">
              <div className="w-full max-w-md backdrop-blur-md bg-black/30 border border-white/10 p-6 space-y-1">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-accent">
                    Latest Articles
                  </span>
                  <Link 
                    href="/news" 
                    className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/60 hover:text-accent transition-colors"
                  >
                    View All
                  </Link>
                </div>

                {latestArticles.map((article, index) => (
                  <LatestArticleItem
                    key={article.id}
                    article={article}
                    index={index}
                    isActive={index === currentIndex}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function LatestArticleItem({ 
  article, 
  index, 
  isActive 
}: { 
  article: any
  index: number
  isActive: boolean 
}) {
  return (
    <Link
      href={`/news/${article.slug}`}
      className={`group flex gap-4 p-3 transition-all rounded-sm ${
        isActive 
          ? "bg-white/10" 
          : "hover:bg-white/5"
      }`}
    >
      {/* Number indicator */}
      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
        <span className={`font-serif text-2xl font-medium ${isActive ? "text-accent" : "text-white/30"}`}>
          {index + 1}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-accent">
            {article.primary_tag?.name || "News"}
          </span>
          <span className="h-0.5 w-0.5 rounded-full bg-white/30" />
          <span className="text-[9px] text-white/50">
            {article.reading_time ? `${article.reading_time} min` : "5 min"}
          </span>
        </div>
        <h3 className={`font-serif text-sm font-medium leading-snug transition-colors line-clamp-2 ${
          isActive ? "text-white" : "text-white/70 group-hover:text-white"
        }`}>
          {article.title}
        </h3>
      </div>

      {/* Arrow */}
      <div className="flex-shrink-0 self-center">
        <ArrowRight className={`h-4 w-4 transition-all ${
          isActive 
            ? "text-accent translate-x-0 opacity-100" 
            : "text-white/40 -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
        }`} />
      </div>
    </Link>
  )
}
