import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

const articles = [
  {
    id: 1,
    category: "Leadership",
    title: "Why Emotional Intelligence Is Your Greatest Business Asset",
    excerpt: "The science-backed skills that separate good leaders from exceptional ones.",
    author: "Dr. Sarah Mitchell",
    date: "May 2, 2026",
    image: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=600&q=80",
    readTime: "5 min read",
  },
  {
    id: 2,
    category: "Entrepreneurship",
    title: "From Side Hustle to $50M Exit: Lessons in Scaling",
    excerpt: "The founder of Luxe Beauty shares her unconventional path to success.",
    author: "Maya Rodriguez",
    date: "May 1, 2026",
    image: "https://images.unsplash.com/photo-1580894732444-8ecded7900cd?w=600&q=80",
    readTime: "8 min read",
  },
  {
    id: 3,
    category: "Work & Life",
    title: "The Art of Strategic Delegation",
    excerpt: "How top executives free up 10+ hours per week without losing control.",
    author: "Jennifer Park",
    date: "April 30, 2026",
    image: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=600&q=80",
    readTime: "4 min read",
  },
  {
    id: 4,
    category: "Finance",
    title: "Building Generational Wealth: An Investment Framework",
    excerpt: "Expert strategies for women looking to secure their financial legacy.",
    author: "Victoria Chen",
    date: "April 29, 2026",
    image: "https://images.unsplash.com/photo-1556157382-97edd2f9e5ee?w=600&q=80",
    readTime: "7 min read",
  },
  {
    id: 5,
    category: "Innovation",
    title: "AI in the Boardroom: Navigating the New Landscape",
    excerpt: "What every executive needs to know about artificial intelligence.",
    author: "Dr. Amara Johnson",
    date: "April 28, 2026",
    image: "https://images.unsplash.com/photo-1551836022-4c4c79ecde51?w=600&q=80",
    readTime: "6 min read",
  },
  {
    id: 6,
    category: "Leadership",
    title: "Mastering the Art of Board Presence",
    excerpt: "Strategies for commanding respect in high-stakes meetings.",
    author: "Rebecca Foster",
    date: "April 27, 2026",
    image: "https://images.unsplash.com/photo-1598550476439-6847785fcea6?w=600&q=80",
    readTime: "5 min read",
  },
]

export function ArticleGrid() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8 lg:py-24">
        <div className="mb-12 flex items-end justify-between">
          <div>
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-accent">
              Latest Stories
            </span>
            <h2 className="mt-2 font-serif text-3xl font-medium text-foreground lg:text-4xl">
              Must-Read Articles
            </h2>
          </div>
          <Link
            href="#"
            className="hidden items-center gap-2 text-xs font-medium uppercase tracking-wider text-foreground transition-colors hover:text-accent md:flex"
          >
            View All Articles
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>

        <div className="mt-12 text-center md:hidden">
          <Link
            href="#"
            className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-foreground transition-colors hover:text-accent"
          >
            View All Articles
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}

function ArticleCard({
  article,
}: {
  article: (typeof articles)[0]
}) {
  return (
    <article className="group flex flex-col">
      <Link href="#">
        <div className="relative aspect-[4/3] overflow-hidden">
          <Image
            src={article.image}
            alt={article.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
        <div className="flex flex-1 flex-col pt-5">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-accent">
              {article.category}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {article.readTime}
            </span>
          </div>
          <h3 className="mt-3 font-serif text-xl font-medium leading-snug text-foreground">
            <span className="text-balance">{article.title}</span>
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {article.excerpt}
          </p>
          <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{article.author}</span>
            <span>·</span>
            <span>{article.date}</span>
          </div>
        </div>
      </Link>
    </article>
  )
}
