"use client"

import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import { ArrowRight, MapPin } from "lucide-react"
import { format } from "date-fns"

interface GhostPost {
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

export function LatestEvents({ events }: { events: GhostPost[] }) {
  if (!events || events.length === 0) return null

  return (
    <section className="bg-primary text-primary-foreground">
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8 lg:py-12">
        {/* Header - Rocket.new style */}
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <motion.h2 
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="font-serif text-2xl font-medium leading-tight md:text-3xl"
            >
              Latest Events
            </motion.h2>
            <p className="mt-3 text-base text-primary-foreground/60">
              Connect, learn, and grow with fellow businesswomen across Yorkshire.
            </p>
          </div>

          <Link 
            href="/news?tag=events"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary-foreground/60 hover:text-accent transition-colors"
          >
            View All Events
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Events Grid */}
        <div className="grid gap-6 md:grid-cols-3">
          {events.map((event, index) => (
            <motion.article
              key={event.id}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="group border border-primary-foreground/10 bg-primary-foreground/5 transition-all duration-300 hover:bg-primary-foreground/10"
            >
              <Link href={`/news/${event.slug}`} className="flex flex-col h-full">
                {/* Image */}
                <div className="relative aspect-[16/9] overflow-hidden">
                  <Image
                    src={event.feature_image || "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800&q=80"}
                    alt={event.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col p-6">
                  {/* Number + Date */}
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-primary-foreground/40">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="text-xs font-medium uppercase tracking-wider text-accent">
                      {event.published_at ? format(new Date(event.published_at), 'MMM d, yyyy') : 'TBA'}
                    </span>
                  </div>

                  <h3 className="mt-4 font-serif text-xl font-medium leading-snug group-hover:text-accent transition-colors line-clamp-2">
                    {event.title}
                  </h3>
                  
                  <p className="mt-3 text-sm leading-relaxed text-primary-foreground/60 line-clamp-2 flex-1">
                    {event.custom_excerpt || event.excerpt || "Join us for networking and professional growth."}
                  </p>

                  {/* Footer */}
                  <div className="mt-6 flex items-center justify-between pt-4 border-t border-primary-foreground/10">
                    <span className="flex items-center gap-1.5 text-xs text-primary-foreground/50">
                      <MapPin className="h-3.5 w-3.5" />
                      Yorkshire
                    </span>
                    <ArrowRight className="h-4 w-4 text-primary-foreground/40 transition-all group-hover:text-accent group-hover:translate-x-1" />
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
