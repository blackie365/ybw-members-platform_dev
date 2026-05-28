"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import { Quote } from "lucide-react"

const testimonials = [
  {
    quote: "I still cannot say enough great things about this group and I’m so grateful that I am a part of such an outstanding community of incredible women!",
    name: "Zoe Hands",
    role: "Member",
    company: "Yorkshire BusinessWoman",
    avatar: "/images/testimonials/zoe-hands.png",
    keywords: ["Community", "Inspiration", "Support"]
  },
  {
    quote: "Being part of this network has transformed how I approach business. The connections I've made are invaluable.",
    name: "Sarah Mitchell",
    role: "Founder & CEO",
    company: "Northern Tech Solutions",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&q=80",
    keywords: ["Leadership", "Innovation", "Growth"]
  },
  {
    quote: "The support and mentorship from fellow members helped me scale my business beyond what I thought possible.",
    name: "Emma Richardson",
    role: "Managing Director",
    company: "Yorkshire Creative Agency",
    avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&q=80",
    keywords: ["Mentorship", "Scaling", "Community"]
  }
]

export function TestimonialsSection() {
  return (
    <section className="bg-secondary/30 dark:bg-secondary/50">
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8 lg:py-12">
        {/* Section Header */}
        <div className="mb-10 max-w-2xl">
          <motion.h2 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="font-serif text-2xl font-medium leading-tight text-foreground md:text-3xl"
          >
            What Yorkshire Says
          </motion.h2>
          <p className="mt-4 text-base text-muted-foreground lg:text-lg">
            Hear from the businesswomen shaping Yorkshire&apos;s future.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid gap-8 md:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="group relative flex flex-col bg-card border border-border p-8 transition-all duration-300 hover:shadow-lg dark:hover:shadow-black/20"
            >
              {/* Quote Icon */}
              <Quote className="h-8 w-8 text-accent/20 mb-6" />
              
              {/* Quote Text */}
              <blockquote className="flex-1">
                <p className="font-serif text-lg italic leading-relaxed text-foreground">
                  &ldquo;{testimonial.quote}&rdquo;
                </p>
              </blockquote>

              {/* Keywords */}
              <div className="mt-6 flex flex-wrap gap-2">
                {testimonial.keywords.map((keyword) => (
                  <span 
                    key={keyword}
                    className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                  >
                    {keyword}
                  </span>
                ))}
              </div>

              {/* Author */}
              <div className="mt-6 flex items-center gap-4 pt-6 border-t border-border">
                <div className="relative h-12 w-12 flex-shrink-0">
                  <Image
                    src={testimonial.avatar}
                    alt={testimonial.name}
                    fill
                    className="rounded-full object-cover"
                  />
                </div>
                <div>
                  <h4 className="font-medium text-foreground">
                    {testimonial.name}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {testimonial.role}, {testimonial.company}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Placeholder Disclaimer */}
        <div className="mt-12 text-center text-balance">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/40">
            Placeholder text only.
          </p>
        </div>
      </div>
    </section>
  )
}
