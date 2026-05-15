import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Quote } from "lucide-react"

export function FeaturedInterview({ member }: { member?: any }) {
  if (!member) return null;

  const memberBio = member.bio || "The old playbook for women in business was about fitting in. Today, it's about standing out and creating entirely new paradigms of leadership that work for everyone.";
  const displayQuote = memberBio.length > 100 ? memberBio.substring(0, 150) + "..." : memberBio;

  return (
    <section className="relative overflow-hidden bg-card">
      {/* Subtle decorative elements */}
      <div className="absolute top-0 right-0 w-1/3 h-full bg-accent/5" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/5 rounded-full -translate-x-1/2 translate-y-1/2" />
      
      <div className="relative mx-auto max-w-7xl px-4 py-20 lg:px-8 lg:py-28">
        {/* Section Label */}
        <div className="mb-12 flex items-center gap-4">
          <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-accent">
            Featured Member
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
          {/* Image Column */}
          <div className="relative">
            <div className="relative aspect-[3/4] overflow-hidden bg-muted">
              <Image
                src={member.image || member.profileImage || member.photoUrl || member.avatarUrl || "https://images.unsplash.com/photo-1573497019236-17f8177b81e8?w=800&q=80"}
                alt={member.name || member.displayName || "Executive portrait"}
                fill
                className="object-cover"
              />
            </div>
            {/* Decorative badge */}
            <div className="absolute -bottom-4 -right-4 bg-primary p-5 lg:-bottom-6 lg:-right-6 lg:p-8">
              <span className="block font-serif text-2xl font-medium text-primary-foreground lg:text-3xl">
                Featured
              </span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-primary-foreground/70">
                Yorkshire<br />Businesswoman
              </span>
            </div>
          </div>

          {/* Content Column */}
          <div className="flex flex-col justify-center">
            <div className="relative">
              <Quote className="absolute -top-2 -left-4 h-16 w-16 text-accent/20 lg:-top-4 lg:-left-8 lg:h-24 lg:w-24" />
              <blockquote className="relative">
                <p className="font-serif text-2xl font-medium leading-relaxed text-foreground lg:text-3xl">
                  <span className="text-balance">
                    &ldquo;{displayQuote}&rdquo;
                  </span>
                </p>
              </blockquote>
            </div>
            
            <div className="mt-10 border-l-2 border-accent pl-6">
              <p className="font-serif text-xl font-medium text-foreground">
                {member.name || member.displayName || "Dr. Amelia Richardson"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {member.role || member.jobTitle || "CEO"}{(member.company || member.companyName) ? ` | ${member.company || member.companyName}` : ""}
              </p>
              {member.location && (
                <p className="mt-1 text-xs text-muted-foreground/70">
                  {member.location}
                </p>
              )}
            </div>

            <Link
              href={`/members/${member.slug || member.id}`}
              className="mt-10 inline-flex items-center gap-3 self-start border-b border-foreground/30 pb-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground transition-all hover:border-accent hover:text-accent"
            >
              View Full Profile
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
