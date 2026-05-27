"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { motion } from "framer-motion"

export function FeaturedInterview({ member }: { member?: any }) {
  if (!member || typeof member !== 'object') return null;

  const bio = member.bio || member.description || "";
  const memberBio = typeof bio === 'string' ? bio : "The old playbook for women in business was about fitting in. Today, it's about standing out.";
  const displayQuote = memberBio.length > 180 ? memberBio.substring(0, 180) + "..." : memberBio;

  const memberName = typeof member.name === 'string' ? member.name : (typeof member.displayName === 'string' ? member.displayName : "Featured Member");
  const memberImage = typeof member.image === 'string' ? member.image : (typeof member.profileImage === 'string' ? member.profileImage : "https://images.unsplash.com/photo-1573497019236-17f8177b81e8?w=800&q=80");

  return (
    <section className="bg-[#fdfcfb] dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-5 lg:items-center lg:gap-16">
          
          {/* Image Column - Compact */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-2"
          >
            <div className="relative aspect-[4/5] overflow-hidden bg-zinc-100 dark:bg-zinc-900">
              <Image
                src={memberImage}
                alt={memberName}
                fill
                className="object-cover"
                priority
              />
              {/* Accent corner */}
              <div className="absolute bottom-0 right-0 bg-accent px-4 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white">
                  Member Spotlight
                </span>
              </div>
            </div>
          </motion.div>

          {/* Content Column */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-3"
          >
            <span className="text-[11px] font-medium uppercase tracking-wider text-accent">
              In Conversation
            </span>
            
            <blockquote className="mt-5">
              <p className="font-serif text-2xl font-medium leading-relaxed text-foreground lg:text-3xl">
                &ldquo;{displayQuote}&rdquo;
              </p>
            </blockquote>
            
            <div className="mt-6 space-y-0.5">
              <h3 className="font-serif text-xl font-medium text-foreground">
                {memberName}
              </h3>
              <p className="text-sm text-muted-foreground">
                {String(member.role || member.jobTitle || "CEO")}{(member.company || member.companyName) ? `, ${String(member.company || member.companyName)}` : ""}
              </p>
            </div>

            <div className="mt-8 flex items-center gap-6">
              <Link
                href={`/members/${member.slug || member.id}`}
                className="inline-flex items-center gap-2 bg-foreground px-5 py-2.5 text-[11px] font-medium uppercase tracking-wider text-background transition-colors hover:bg-accent"
              >
                Read More
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              
              <Link
                href="/membership"
                className="text-xs font-medium text-muted-foreground hover:text-accent transition-colors"
              >
                Join the Network
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
