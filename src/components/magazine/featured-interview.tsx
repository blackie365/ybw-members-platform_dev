"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Quote } from "lucide-react"
import { motion } from "framer-motion"

export function FeaturedInterview({ member }: { member?: any }) {
  if (!member || typeof member !== 'object') return null;

  const bio = member.bio || member.description || "";
  const memberBio = typeof bio === 'string' ? bio : "The old playbook for women in business was about fitting in. Today, it's about standing out and creating entirely new paradigms of leadership that work for everyone.";
  const displayQuote = memberBio.length > 200 ? memberBio.substring(0, 250) + "..." : memberBio;

  const memberName = typeof member.name === 'string' ? member.name : (typeof member.displayName === 'string' ? member.displayName : "Featured Member");
  const memberImage = typeof member.image === 'string' ? member.image : (typeof member.profileImage === 'string' ? member.profileImage : "https://images.unsplash.com/photo-1573497019236-17f8177b81e8?w=800&q=80");

  return (
    <section className="relative overflow-hidden bg-[#fdfcfb] dark:bg-zinc-950 border-y border-border/50">
      <div className="mx-auto max-w-7xl px-4 py-24 lg:px-8 lg:py-32">
        <div className="grid gap-16 lg:grid-cols-2 lg:items-center lg:gap-24">
          
          {/* Image Column - Left Side */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative"
          >
            <div className="relative aspect-[4/5] overflow-hidden bg-zinc-100 dark:bg-zinc-900 rounded-sm shadow-2xl">
              <Image
                src={memberImage}
                alt={memberName}
                fill
                className="object-cover transition-transform duration-1000 hover:scale-105"
                priority
              />
              <div className="absolute inset-0 ring-1 ring-inset ring-black/10" />
            </div>
            
            {/* Signature Floating Badge */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="absolute -bottom-8 -right-8 bg-accent p-8 lg:p-10 shadow-2xl"
            >
              <span className="block font-serif text-3xl font-medium text-white lg:text-4xl">
                Featured
              </span>
              <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.3em] text-white/70">
                Member Spotlight
              </span>
            </motion.div>
          </motion.div>

          {/* Content Column - Right Side */}
          <div className="flex flex-col">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-accent">
                In Conversation With
              </span>
              
              <div className="mt-10 relative">
                <Quote className="absolute -top-10 -left-6 h-20 w-20 text-accent/10 lg:-top-14 lg:-left-12 lg:h-32 lg:w-32" />
                <blockquote className="relative">
                  <p className="font-serif text-3xl font-medium leading-[1.3] text-foreground lg:text-4xl xl:text-5xl">
                    <span className="text-balance italic">
                      &ldquo;{displayQuote}&rdquo;
                    </span>
                  </p>
                </blockquote>
              </div>
              
              <div className="mt-12 space-y-2">
                <h3 className="font-serif text-2xl font-medium text-foreground lg:text-3xl">
                  {memberName}
                </h3>
                <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground/80">
                  {String(member.role || member.jobTitle || "CEO")}{(member.company || member.companyName) ? ` — ${String(member.company || member.companyName)}` : ""}
                </p>
              </div>

              <div className="mt-12 flex flex-col sm:flex-row items-start gap-8 border-t border-border pt-12">
                <Link
                  href={`/members/${member.slug || member.id}`}
                  className="group inline-flex items-center gap-4 bg-zinc-950 dark:bg-white px-8 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-white dark:text-zinc-950 transition-all hover:bg-accent hover:text-white"
                >
                  Read Full Interview
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
                
                <Link
                  href="/membership"
                  className="inline-flex items-center gap-3 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/60 hover:text-accent transition-colors"
                >
                  Join the Network
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
