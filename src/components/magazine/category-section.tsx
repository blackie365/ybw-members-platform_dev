"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { motion } from "framer-motion"

interface Post {
  id: string
  title: string
  slug: string
  feature_image?: string
  published_at: string
  custom_excerpt?: string
  excerpt?: string
  primary_tag?: {
    name: string
    slug: string
  }
}

export function CategorySection({ 
  title, 
  posts, 
}: { 
  title: string
  posts: Post[]
}) {
  if (!posts || posts.length === 0) return null

  return (
    <section className="bg-background border-t border-border/50">
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8 lg:py-12">
        {/* Header - Rocket.new style */}
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="font-serif text-2xl font-medium text-foreground md:text-3xl"
          >
            {title}
          </motion.h2>

          <Link 
            href={`/news?tag=${title.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-accent transition-colors"
          >
            View All
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Posts Grid */}
        <div className="grid gap-6 md:grid-cols-3">
          {posts.map((post, index) => (
            <motion.article
              key={post.id}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="group border border-border bg-card transition-all duration-300 hover:shadow-lg dark:hover:shadow-black/20"
            >
              <Link href={`/news/${post.slug}`} className="flex flex-col h-full">
                <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                  <Image
                    src={post.feature_image || "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800&q=80"}
                    alt={post.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                </div>

                <div className="flex flex-1 flex-col p-6">
                  {/* Number */}
                  <span className="font-mono text-xs text-muted-foreground">
                    {String(index + 1).padStart(2, '0')}
                  </span>

                  <h3 className="mt-4 font-serif text-xl font-medium text-foreground group-hover:text-accent transition-colors line-clamp-2 leading-snug">
                    {post.title}
                  </h3>
                  
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground line-clamp-2 flex-1">
                    {post.custom_excerpt || post.excerpt || "Read the latest updates and insights."}
                  </p>

                  {/* Footer */}
                  <div className="mt-6 flex items-center justify-end pt-4 border-t border-border">
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-all group-hover:text-accent group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}
