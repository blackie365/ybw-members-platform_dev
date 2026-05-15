import Link from "next/link"
import { ArrowRight, Briefcase, TrendingUp, Lightbulb, Heart, Calendar, Users } from "lucide-react"

// Map Ghost tags to specific Lucide icons
const getIconForTag = (tagName: string) => {
  const name = tagName.toLowerCase();
  if (name.includes('leadership') || name.includes('business') || name.includes('career')) return Briefcase;
  if (name.includes('finance') || name.includes('money') || name.includes('wealth')) return TrendingUp;
  if (name.includes('innovation') || name.includes('tech') || name.includes('digital')) return Lightbulb;
  if (name.includes('lifestyle') || name.includes('health') || name.includes('wellbeing')) return Heart;
  if (name.includes('event') || name.includes('networking')) return Calendar;
  if (name.includes('community') || name.includes('member')) return Users;
  return Briefcase;
};

export function CategoriesSection({ tags }: { tags?: any[] }) {
  if (!tags || tags.length === 0) return null;

  return (
    <section className="relative bg-background">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />
      
      <div className="relative mx-auto max-w-7xl px-4 py-20 lg:px-8 lg:py-28">
        {/* Section Header */}
        <div className="mb-14 text-center">
          <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-accent">
            Explore Topics
          </span>
          <h2 className="mt-3 font-serif text-3xl font-medium text-foreground lg:text-4xl">
            Browse by Category
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Discover insights across leadership, finance, lifestyle and more from Yorkshire&apos;s leading businesswomen
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {tags.map((tag) => {
            const Icon = getIconForTag(tag.name);
            return (
              <Link
                key={tag.id}
                href={`/news?tag=${tag.slug}`}
                className="group relative flex flex-col overflow-hidden border border-border bg-card p-6 transition-all duration-300 hover:border-accent/50 hover:shadow-lg hover:-translate-y-1"
              >
                {/* Hover accent bar */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-accent scale-x-0 transition-transform duration-300 group-hover:scale-x-100" />
                
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 transition-colors group-hover:bg-accent/20">
                  <Icon className="h-5 w-5 text-accent" />
                </div>
                
                <h3 className="mt-5 font-serif text-lg font-medium text-foreground transition-colors group-hover:text-accent">
                  {tag.name}
                </h3>
                
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground line-clamp-2">
                  {tag.description || `Explore articles about ${tag.name.toLowerCase()}`}
                </p>
                
                <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                  <span className="text-xs font-medium text-muted-foreground">
                    {tag.count?.posts || 0} articles
                  </span>
                  <div className="flex items-center gap-1 text-accent opacity-0 transition-all duration-300 group-hover:opacity-100">
                    <span className="text-[10px] font-semibold uppercase tracking-wider">
                      Explore
                    </span>
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  )
}
