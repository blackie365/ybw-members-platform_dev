import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

export function CategoriesSection({ tags }: { tags?: any[] }) {
  if (!tags || tags.length === 0) return null

  return (
    <section className="bg-secondary/30 dark:bg-secondary/50">
      <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8 lg:py-20">
        {/* Section Header */}
        <div className="mb-12 flex items-end justify-between">
          <div>
            <span className="mb-2 block text-xs font-medium uppercase tracking-widest text-accent">
              Explore
            </span>
            <h2 className="font-serif text-3xl font-medium text-foreground lg:text-4xl">
              Topics by Category
            </h2>
          </div>
          <Link 
            href="/news"
            className="hidden items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-accent sm:flex"
          >
            View all
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Tags as elegant pills/chips */}
        <div className="flex flex-wrap gap-3">
          {tags.map((tag, index) => (
            <Link
              key={tag.id}
              href={`/news?tag=${tag.slug}`}
              className="group relative overflow-hidden"
            >
              <div className="flex items-center gap-3 border border-border bg-card px-5 py-3 transition-all duration-300 hover:border-accent hover:bg-accent hover:shadow-lg dark:hover:shadow-accent/10">
                {/* Number indicator */}
                <span className="font-mono text-xs text-muted-foreground transition-colors group-hover:text-accent-foreground/70">
                  {String(index + 1).padStart(2, '0')}
                </span>
                
                {/* Tag name */}
                <span className="font-medium text-foreground transition-colors group-hover:text-accent-foreground">
                  {tag.name}
                </span>
                
                {/* Article count */}
                <span className="ml-1 rounded-full bg-muted/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-all group-hover:bg-accent-foreground/20 group-hover:text-accent-foreground/80 dark:bg-muted">
                  {tag.count?.posts || 0}
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* Mobile view all link */}
        <Link 
          href="/news"
          className="mt-8 flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-accent sm:hidden"
        >
          View all topics
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  )
}
