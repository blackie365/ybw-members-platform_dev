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
  const memberRole = String(member.role || member.jobTitle || "CEO");
  const memberCompany = String(member.company || member.companyName || "");

  // Keywords based on member data or defaults
  const keywords = member.keywords || member.expertise || ["Leadership", "Innovation", "Strategy"];

  return (
    <section className="bg-background">
      <div className="mx-auto max-w-7xl px-4 py-20 lg:px-8 lg:py-28">
        {/* Section Header */}
        <div className="mb-12">
          <span className="text-xs font-medium uppercase tracking-wider text-accent">
            Member Spotlight
          </span>
          <h2 className="mt-2 font-serif text-3xl font-medium text-foreground md:text-4xl">
            Featured Member
          </h2>
        </div>

        {/* Content Grid - Image Left, Text Right */}
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          
          {/* Image Column - 60% height */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-muted">
              <Image
                src={memberImage}
                alt={memberName}
                fill
                className="object-cover"
                priority
              />
            </div>
          </motion.div>

          {/* Content Column */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex flex-col"
          >
            {/* Quote in Italics */}
            <blockquote className="border-l-2 border-accent pl-6">
              <p className="font-serif text-xl italic leading-relaxed text-foreground md:text-2xl lg:text-3xl">
                &ldquo;{displayQuote}&rdquo;
              </p>
            </blockquote>
            
            {/* Keywords - 10pt */}
            <div className="mt-8 flex flex-wrap gap-3">
              {(Array.isArray(keywords) ? keywords.slice(0, 3) : ["Leadership", "Innovation", "Strategy"]).map((keyword: string, index: number) => (
                <span 
                  key={index}
                  className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                >
                  {keyword}
                </span>
              ))}
            </div>

            {/* Author Info with Avatar */}
            <div className="mt-8 flex items-center gap-4">
              <Image
                src={memberImage}
                alt={memberName}
                width={56}
                height={56}
                className="h-14 w-14 rounded-full object-cover"
              />
              <div>
                <h3 className="font-medium text-foreground">
                  {memberName}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {memberRole}{memberCompany ? `, ${memberCompany}` : ""}
                </p>
              </div>
            </div>

            {/* CTA */}
            <div className="mt-10">
              <Link
                href={`/members/${member.slug || member.id}`}
                className="inline-flex items-center gap-2 text-sm font-medium text-accent transition-colors hover:text-accent/80"
              >
                Read Full Story
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
