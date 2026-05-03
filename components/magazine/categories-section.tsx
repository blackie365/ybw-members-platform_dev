import Link from "next/link"
import { ArrowRight, Briefcase, TrendingUp, Lightbulb, Heart, Calendar } from "lucide-react"

const categories = [
  {
    name: "Leadership",
    description: "Executive strategies & management insights",
    icon: Briefcase,
    articleCount: 142,
  },
  {
    name: "Finance",
    description: "Wealth building & investment guidance",
    icon: TrendingUp,
    articleCount: 98,
  },
  {
    name: "Innovation",
    description: "Tech trends & future of business",
    icon: Lightbulb,
    articleCount: 76,
  },
  {
    name: "Lifestyle",
    description: "Work-life balance & wellness",
    icon: Heart,
    articleCount: 124,
  },
  {
    name: "Events",
    description: "Conferences & networking opportunities",
    icon: Calendar,
    articleCount: 45,
  },
]

export function CategoriesSection() {
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
          {categories.map((category) => (
            <Link
              key={category.name}
              href="#"
              className="group flex flex-col border border-border bg-card p-6 transition-all hover:border-accent hover:shadow-lg"
            >
              <category.icon className="h-6 w-6 text-accent" />
              <h3 className="mt-4 font-serif text-lg font-medium text-foreground">
                {category.name}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {category.description}
              </p>
              <div className="mt-auto flex items-center justify-between pt-6">
                <span className="text-xs text-muted-foreground">
                  {category.articleCount} articles
                </span>
                <ArrowRight className="h-4 w-4 text-accent opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
