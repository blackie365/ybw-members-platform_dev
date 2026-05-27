import Link from "next/link"
import { ArrowRight, Briefcase, TrendingUp, Lightbulb, Heart, Calendar, Users } from "lucide-react"

const getIconForTag = (tagName: string) => {
  if (!tagName) return Briefcase;
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
    <section className="bg-background">
      <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8 lg:py-20">
        {/* Section Header - Minimal */}
        <div className="mb-10 border-b border-border pb-6">
          <h2 className="font-serif text-2xl font-medium text-foreground lg:text-3xl">
            Browse Topics
          </h2>
        </div>

        {/* Tags Grid - Compact cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {tags.map((tag) => {
            const Icon = getIconForTag(tag.name);
            return (
              <Link
                key={tag.id}
                href={`/news?tag=${tag.slug}`}
                className="group flex items-center gap-4 border border-border bg-card p-4 transition-all hover:border-accent/50 hover:bg-accent/5"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 transition-colors group-hover:bg-accent/20">
                  <Icon className="h-4 w-4 text-accent" />
                </div>
                
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-foreground text-sm truncate group-hover:text-accent transition-colors">
                    {tag.name}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    {tag.count?.posts || 0} articles
                  </p>
                </div>
                
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:text-accent" />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  )
}
