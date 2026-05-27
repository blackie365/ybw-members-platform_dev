import Link from "next/link"
import { ArrowRight } from "lucide-react"

export function CategoriesSection({ tags }: { tags?: any[] }) {
  if (!tags || tags.length === 0) return null

  return (
    <section className="bg-background">
      <div className="mx-auto max-w-7xl px-4 py-20 lg:px-8 lg:py-28">
        {/* Section Header - Rocket.new style with multi-line heading */}
        <div className="mb-16 max-w-2xl">
          <h2 className="font-serif text-3xl font-medium leading-tight text-foreground md:text-4xl lg:text-5xl">
            Discover what
            <br />
            inspires you.
          </h2>
          <p className="mt-4 text-base text-muted-foreground lg:text-lg">
            Explore our curated categories. Find stories that resonate with your journey.
          </p>
        </div>

        {/* Categories as numbered cards - Rocket.new style */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {tags.map((tag, index) => (
            <Link
              key={tag.id}
              href={`/news?tag=${tag.slug}`}
              className="group relative flex flex-col border border-border bg-card p-6 transition-all duration-300 hover:border-accent hover:shadow-lg dark:hover:shadow-accent/5"
            >
              {/* Number */}
              <span className="font-mono text-xs text-muted-foreground">
                {String(index + 1).padStart(2, '0')}
              </span>
              
              {/* Tag name */}
              <h3 className="mt-3 font-serif text-xl font-medium text-foreground transition-colors group-hover:text-accent">
                {tag.name}
              </h3>
              
              {/* Article count + Arrow */}
              <div className="mt-4 flex items-center justify-between pt-4 border-t border-border">
                <span className="text-sm text-muted-foreground">
                  {tag.count?.posts || 0} articles
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-all group-hover:text-accent group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>

        {/* View all link */}
        <div className="mt-12 text-center">
          <Link 
            href="/news"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-accent"
          >
            View all topics
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
