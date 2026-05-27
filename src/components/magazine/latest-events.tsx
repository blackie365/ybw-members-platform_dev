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
    <section className="relative overflow-hidden bg-zinc-950 py-24 lg:py-32">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-[600px] h-[600px] bg-accent/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px]" />

      <div className="relative mx-auto max-w-7xl px-4 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 mb-16 md:flex-row md:items-end">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl"
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-accent">
              Upcoming Gatherings
            </span>
            <h2 className="mt-4 font-serif text-4xl font-medium text-white lg:text-5xl">
              Latest Events
            </h2>
            <p className="mt-6 text-lg text-zinc-400">
              Connect with like-minded professional women at our upcoming networking events and workshops across Yorkshire.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Link 
              href="/news?tag=events"
              className="group inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white hover:text-accent transition-colors"
            >
              View All Events
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event, index) => (
            <motion.article
              key={event.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group relative flex flex-col bg-zinc-900/50 border border-white/5 overflow-hidden transition-all hover:border-accent/30"
            >
              <Link href={`/news/${event.slug}`} className="flex flex-col h-full">
                <div className="relative aspect-[16/10] overflow-hidden">
                  <Image
                    src={event.feature_image || "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800&q=80"}
                    alt={event.title}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute top-4 left-4">
                    <div className="bg-accent px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-xl">
                      Event
                    </div>
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-accent uppercase tracking-wider">
                      <Calendar className="h-3.5 w-3.5" />
                      {event.published_at ? format(new Date(event.published_at), 'MMM dd, yyyy') : 'TBA'}
                    </div>
                    <div className="h-1 w-1 rounded-full bg-zinc-700" />
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                      <MapPin className="h-3.5 w-3.5" />
                      Yorkshire
                    </div>
                  </div>

                  <h3 className="font-serif text-2xl font-medium text-white group-hover:text-accent transition-colors line-clamp-2">
                    {event.title}
                  </h3>
                  
                  <p className="mt-4 text-sm leading-relaxed text-zinc-400 line-clamp-3 flex-1">
                    {event.custom_excerpt || event.excerpt || "Join us for an inspiring session of networking and professional growth."}
                  </p>

                  <div className="mt-8 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 group-hover:text-accent transition-colors">
                    Book Tickets
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
