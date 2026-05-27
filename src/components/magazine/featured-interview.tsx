"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { motion } from "framer-motion"

export function FeaturedInterview({ member }: { member?: any }) {
  if (!member || typeof member !== 'object') return null;

  const bio = member.bio || member.description || "";
  const memberBio = typeof bio === 'string' ? bio : "The old playbook for women in business was about fitting in. Today, it's about standing out.";
  const displayQuote = memberBio.length > 200 ? memberBio.substring(0, 200) + "..." : memberBio;

  const memberName = typeof member.name === 'string' ? member.name : (typeof member.displayName === 'string' ? member.displayName : "Featured Member");
  const memberImage = typeof member.image === 'string' ? member.image : (typeof member.profileImage === 'string' ? member.profileImage : "https://images.unsplash.com/photo-1573497019236-17f8177b81e8?w=800&q=80");

  return (
    <section className="bg-secondary/50 dark:bg-secondary">
      <div className="mx-auto max-w-7xl px-4 py-20 lg:px-8 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-20">
          
          {/* Image Column */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            <div className="relative aspect-[4/5] overflow-hidden bg-muted">
              <Image
                src={memberImage}
                alt={memberName}
                fill
                className="object-cover"
                priority
              />
            </div>
            {/* Accent badge */}
            <div className="absolute -bottom-4 -right-4 bg-accent px-6 py-3 shadow-lg md:-right-8">
              <span className="text-xs font-semibold uppercase tracking-wider text-accent-foreground">
                Member Spotlight
              </span>
            </div>
          </motion.div>

          {/* Content Column */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <span className="font-mono text-xs text-muted-foreground">01</span>
            <span className="ml-3 text-xs font-medium uppercase tracking-wider text-accent">
              In Conversation
            </span>
            
            <blockquote className="mt-8">
              <p className="font-serif text-2xl font-medium leading-relaxed text-foreground md:text-3xl lg:text-4xl">
                &ldquo;{displayQuote}&rdquo;
              </p>
            </blockquote>
            
            <div className="mt-8 space-y-1">
              <h3 className="font-serif text-xl font-medium text-foreground">
                {memberName}
              </h3>
              <p className="text-sm text-muted-foreground">
                {String(member.role || member.jobTitle || "CEO")}{(member.company || member.companyName) ? `, ${String(member.company || member.companyName)}` : ""}
              </p>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href={`/members/${member.slug || member.id}`}
                className="inline-flex items-center gap-2 bg-foreground px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-accent"
              >
                Read Full Story
                <ArrowRight className="h-4 w-4" />
              </Link>
              
              <Link
                href="/membership"
                className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-accent transition-colors"
              >
                Join the Network
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
