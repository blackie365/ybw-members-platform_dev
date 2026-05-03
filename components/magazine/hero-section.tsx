import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

export function HeroSection() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-7xl px-4 py-12 lg:px-8 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          {/* Featured Article */}
          <article className="group relative">
            <Link href="#" className="block">
              <div className="relative aspect-[4/5] overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&q=80"
                  alt="Professional businesswoman in modern office"
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-6 lg:p-10">
                <span className="mb-3 inline-block border border-white/40 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-white">
                  Cover Story
                </span>
                <h2 className="font-serif text-2xl font-medium leading-tight text-white lg:text-4xl">
                  <span className="text-balance">
                    The Future of Female Leadership in Tech
                  </span>
                </h2>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-white/80">
                  How a new generation of women executives are reshaping Silicon Valley&apos;s culture and driving innovation.
                </p>
                <div className="mt-6 flex items-center gap-3 text-white/70">
                  <span className="text-xs font-medium uppercase tracking-wider">
                    Read Article
                  </span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </Link>
          </article>

          {/* Secondary Articles */}
          <div className="flex flex-col gap-6">
            <SecondaryArticle
              image="https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=600&q=80"
              category="Finance"
              title="Navigating Venture Capital: A Woman's Guide to Securing Funding"
              description="Insider strategies from founders who have successfully raised millions."
            />
            <SecondaryArticle
              image="https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=600&q=80"
              category="Innovation"
              title="The Rise of Female-Founded Unicorns in 2026"
              description="Meet the entrepreneurs building billion-dollar companies on their own terms."
            />
          </div>
        </div>
      </div>
    </section>
  )
}

function SecondaryArticle({
  image,
  category,
  title,
  description,
}: {
  image: string
  category: string
  title: string
  description: string
}) {
  return (
    <article className="group flex flex-1 flex-col">
      <Link href="#" className="flex h-full flex-col lg:flex-row lg:gap-6">
        <div className="relative aspect-[16/10] overflow-hidden lg:aspect-square lg:w-48 lg:shrink-0">
          <Image
            src={image}
            alt={title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
        <div className="flex flex-1 flex-col justify-center py-4 lg:py-0">
          <span className="mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-accent">
            {category}
          </span>
          <h3 className="font-serif text-lg font-medium leading-snug text-foreground lg:text-xl">
            <span className="text-balance">{title}</span>
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
          <div className="mt-4 flex items-center gap-2 text-foreground/70">
            <span className="text-xs font-medium uppercase tracking-wider">
              Read More
            </span>
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </Link>
    </article>
  )
}
