import Link from "next/link"
import { ArrowRight, Briefcase, TrendingUp, Lightbulb, Heart, Calendar } from "lucide-react"

// Map Ghost tags to specific Lucide icons, or fallback to Briefcase
const getIconForTag = (tagName: string) => {
  const name = tagName.toLowerCase();
  if (name.includes('leadership') || name.includes('business') || name.includes('career')) return Briefcase;
  if (name.includes('finance') || name.includes('money') || name.includes('wealth')) return TrendingUp;
  if (name.includes('innovation') || name.includes('tech') || name.includes('digital')) return Lightbulb;
  if (name.includes('lifestyle') || name.includes('health') || name.includes('wellbeing')) return Heart;
  if (name.includes('event') || name.includes('networking')) return Calendar;
  return Briefcase;
};

export function CategoriesSection({ tags }: { tags?: any[] }) {
  if (!tags || tags.length === 0) return null;

  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8 lg:py-24">
        <div className="mb-12 text-center">
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-accent">
            Explore Topics
          </span>
          <h2 className="mt-2 font-serif text-3xl font-medium text-foreground lg:text-4xl">
            Browse by Category
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {tags.map((tag) => {
            const Icon = getIconForTag(tag.name);
            return (
              <Link
                key={tag.id}
                href={`/news?tag=${tag.slug}`}
                className="group flex flex-col border border-border bg-card p-6 transition-all hover:border-accent hover:shadow-lg"
              >
                <Icon className="h-6 w-6 text-accent" />
                <h3 className="mt-4 font-serif text-lg font-medium text-foreground">
                  {tag.name}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                  {tag.description || `Explore articles about ${tag.name}`}
                </p>
                <div className="mt-auto flex items-center justify-between pt-6">
                  <span className="text-xs text-muted-foreground">
                    {tag.count?.posts || 0} articles
                  </span>
                  <ArrowRight className="h-4 w-4 text-accent opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  )
}
