"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react"
import useEmblaCarousel from "embla-carousel-react"
import { motion, AnimatePresence } from "framer-motion"

export function HeroSection({ posts }: { posts: any[] }) {
  if (!posts || posts.length === 0) return null;

  const heroPosts = posts.slice(0, 3);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, duration: 30 })
  const [selectedIndex, setSelectedIndex] = React.useState(0)

  const onSelect = React.useCallback(() => {
    if (!emblaApi) return
    setSelectedIndex(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  React.useEffect(() => {
    if (!emblaApi) return
    onSelect()
    emblaApi.on("select", onSelect)
    emblaApi.on("reInit", onSelect)
  }, [emblaApi, onSelect])

  const scrollPrev = React.useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi])
  const scrollNext = React.useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi])

  return (
    <section className="relative bg-primary overflow-hidden">
      {/* Decorative background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent_50%)]" />
      
      <div className="relative mx-auto max-w-7xl px-4 py-12 lg:px-8 lg:py-20">
        {/* Section Label */}
        <div className="mb-10 flex items-center gap-4">
          <div className="h-px flex-1 bg-primary-foreground/20" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary-foreground/60">
            Featured Stories
          </span>
          <div className="h-px flex-1 bg-primary-foreground/20" />
        </div>

        <div className="relative group">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex">
              {heroPosts.map((post) => (
                <div key={post.id} className="relative flex-[0_0_100%] min-w-0">
                  <article className="relative mx-auto max-w-6xl">
                    <Link href={`/news/${post.slug}`} className="block relative aspect-[16/9] lg:aspect-[21/9] w-full overflow-hidden rounded-sm">
                      <Image
                        src={post.feature_image || "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1200&q=80"}
                        alt={post.title}
                        fill
                        className="object-cover transition-transform duration-700 hover:scale-[1.02]"
                        priority
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                      
                      <div className="absolute bottom-0 left-0 right-0 p-8 lg:p-16">
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5 }}
                        >
                          <div className="flex items-center gap-3 mb-4">
                            <span className="inline-block bg-accent px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-foreground">
                              {post.primary_tag?.name || "Featured"}
                            </span>
                            <span className="text-[11px] font-medium text-white/70">
                              {post.reading_time ? `${post.reading_time} min read` : "5 min read"}
                            </span>
                          </div>
                          <h2 className="font-serif text-3xl font-medium leading-[1.15] text-white lg:text-6xl max-w-4xl">
                            <span className="text-balance">
                              {post.title}
                            </span>
                          </h2>
                          <p className="mt-6 max-w-2xl text-[16px] leading-relaxed text-white/80 line-clamp-2">
                            {post.custom_excerpt || post.excerpt || ""}
                          </p>
                          <div className="mt-10 inline-flex items-center gap-3 border-b border-white/40 pb-1 text-white transition-colors hover:border-accent hover:text-accent">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.15em]">
                              Read Article
                            </span>
                            <ArrowRight className="h-4 w-4" />
                          </div>
                        </motion.div>
                      </div>
                    </Link>
                  </article>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation Controls */}
          <button
            onClick={scrollPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black/20 text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/40 lg:left-8"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={scrollNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black/20 text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/40 lg:right-8"
            aria-label="Next slide"
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          {/* Pagination Dots */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-3">
            {heroPosts.map((_, index) => (
              <button
                key={index}
                onClick={() => emblaApi?.scrollTo(index)}
                className={`h-1.5 transition-all duration-300 rounded-full ${
                  selectedIndex === index ? "w-8 bg-accent" : "w-2 bg-white/40"
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
