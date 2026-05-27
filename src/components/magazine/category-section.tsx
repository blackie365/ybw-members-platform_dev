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
  accentColor = "accent" 
}: { 
  title: string
  posts: Post[]
  accentColor?: string
}) {
  if (!posts || posts.length === 0) return null

  return (
    <section className="bg-background py-24 lg:py-32 border-t border-border/50">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="flex items-center justify-between mb-16">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <span className={`text-[10px] font-bold uppercase tracking-[0.4em] text-${accentColor}`}>
              In Focus
            </span>
            <h2 className="mt-4 font-serif text-4xl font-medium text-foreground lg:text-5xl">
              {title}
            </h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Link 
              href={`/news?tag=${title.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')}`}
              className="group flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-accent transition-colors"
            >
              See All
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
        </div>

        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, index) => (
            <motion.article
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group flex flex-col"
            >
              <Link href={`/news/${post.slug}`} className="flex flex-col h-full">
                <div className="relative aspect-[16/10] overflow-hidden rounded-sm bg-muted">
                  <Image
                    src={post.feature_image || "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800&q=80"}
                    alt={post.title}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </div>

                <div className="flex flex-1 flex-col pt-8">
                  <h3 className="font-serif text-2xl font-medium text-foreground group-hover:text-accent transition-colors line-clamp-2 leading-tight">
                    {post.title}
                  </h3>
                  
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground line-clamp-3 flex-1">
                    {post.custom_excerpt || post.excerpt || "Read the latest updates and insights from our community."}
                  </p>

                  <div className="mt-8 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-accent opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                    Read Story
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
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
