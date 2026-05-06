import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Quote } from "lucide-react"

export function FeaturedInterview({ member }: { member?: any }) {
  if (!member) return null;

  return (
    <section className="bg-primary text-primary-foreground">
      <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="relative">
            <div className="relative aspect-[3/4] overflow-hidden">
              <Image
                src={member.image || member.profileImage || member.photoUrl || member.avatarUrl || "https://images.unsplash.com/photo-1573497019236-17f8177b81e8?w=800&q=80"}
                alt={member.name || member.displayName || "Executive portrait"}
                fill
                className="object-cover"
              />
            </div>
            <div className="absolute -bottom-6 -right-6 hidden bg-accent p-6 lg:block">
              <span className="block font-serif text-4xl font-medium text-accent-foreground">
                Featured
              </span>
              <span className="text-xs uppercase tracking-wider text-accent-foreground/80">
                Yorkshire <br />Businesswoman
              </span>
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <span className="mb-4 text-[10px] font-medium uppercase tracking-[0.2em] text-primary-foreground/60">
              Featured Member
            </span>
            <h2 className="font-serif text-3xl font-medium leading-tight lg:text-4xl">
              <span className="text-balance">
                &ldquo;{member.bio ? `"${member.bio.substring(0, 100)}..."` : "Success Is Not About Breaking Glass Ceilings—It's About Building New Rooms"}&rdquo;
              </span>
            </h2>
            
            <div className="mt-8 border-l-2 border-accent pl-6">
              <Quote className="mb-4 h-8 w-8 text-accent" />
              <p className="text-lg leading-relaxed text-primary-foreground/80">
                {member.bio || "The old playbook for women in business was about fitting in. Today, it's about standing out and creating entirely new paradigms of leadership that work for everyone."}
              </p>
            </div>

            <div className="mt-8">
              <p className="font-serif text-xl font-medium">{member.name || member.displayName || "Dr. Amelia Richardson"}</p>
              <p className="mt-1 text-sm text-primary-foreground/60">
                {member.role || member.jobTitle || "CEO"} {member.company || member.companyName ? `| ${member.company || member.companyName}` : ""}
              </p>
            </div>

            <Link
              href={`/members/${member.slug || member.id}`}
              className="mt-8 inline-flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-accent transition-colors hover:text-accent/80"
            >
              View Profile
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
