"use client"

import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import { Calendar, ArrowRight, MapPin } from "lucide-react"
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
    <section className="bg-zinc-950 py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        {/* Header - Streamlined */}
        <div className="flex items-end justify-between mb-10 border-b border-white/10 pb-6">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="font-serif text-2xl font-medium text-white lg:text-3xl">
              Upcoming Events
            </h2>
          </motion.div>

          <Link 
            href="/news?tag=events"
            className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-accent transition-colors"
          >
            View All
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Events Grid - Lighter cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {events.map((event, index) => (
            <motion.article
              key={event.id}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="group"
            >
              <Link href={`/news/${event.slug}`} className="flex flex-col h-full">
                {/* Image */}
                <div className="relative aspect-[16/9] overflow-hidden bg-zinc-900">
                  <Image
                    src={event.feature_image || "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800&q=80"}
                    alt={event.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/60 to-transparent" />
                  
                  {/* Date badge */}
                  <div className="absolute bottom-3 left-3 bg-accent px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                    {event.published_at ? format(new Date(event.published_at), 'MMM d') : 'TBA'}
                  </div>
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col pt-4">
                  <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Yorkshire
                    </span>
                  </div>

                  <h3 className="mt-2 font-serif text-lg font-medium text-white group-hover:text-accent transition-colors line-clamp-2 leading-snug">
                    {event.title}
                  </h3>
                  
                  <p className="mt-2 text-[13px] leading-relaxed text-zinc-400 line-clamp-2 flex-1">
                    {event.custom_excerpt || event.excerpt || "Join us for networking and professional growth."}
                  </p>
                </div>
              </Link>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}
