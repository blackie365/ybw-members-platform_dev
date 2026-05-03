import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Quote } from "lucide-react"

export function FeaturedInterview() {
  return (
    <section className="bg-primary text-primary-foreground">
      <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="relative">
            <div className="relative aspect-[3/4] overflow-hidden">
              <Image
                src="https://images.unsplash.com/photo-1573497019236-17f8177b81e8?w=800&q=80"
                alt="Executive portrait"
                fill
                className="object-cover"
              />
            </div>
            <div className="absolute -bottom-6 -right-6 hidden bg-accent p-6 lg:block">
              <span className="block font-serif text-4xl font-medium text-accent-foreground">
                25
              </span>
              <span className="text-xs uppercase tracking-wider text-accent-foreground/80">
                Years of <br />Leadership
              </span>
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <span className="mb-4 text-[10px] font-medium uppercase tracking-[0.2em] text-primary-foreground/60">
              Exclusive Interview
            </span>
            <h2 className="font-serif text-3xl font-medium leading-tight lg:text-4xl">
              <span className="text-balance">
                &ldquo;Success Is Not About Breaking Glass Ceilings—It&apos;s About Building New Rooms&rdquo;
              </span>
            </h2>
            
            <div className="mt-8 border-l-2 border-accent pl-6">
              <Quote className="mb-4 h-8 w-8 text-accent" />
              <p className="text-lg leading-relaxed text-primary-foreground/80">
                The old playbook for women in business was about fitting in. 
                Today, it&apos;s about standing out and creating entirely new paradigms 
                of leadership that work for everyone.
              </p>
            </div>

            <div className="mt-8">
              <p className="font-serif text-xl font-medium">Dr. Amelia Richardson</p>
              <p className="mt-1 text-sm text-primary-foreground/60">
                CEO, Nexus Global Partners | Fortune 50 Board Director
              </p>
            </div>

            <Link
              href="#"
              className="mt-8 inline-flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-accent transition-colors hover:text-accent/80"
            >
              Read Full Interview
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
