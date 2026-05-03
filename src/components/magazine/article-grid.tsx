import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

export function ArticleGrid({ posts }: { posts: any[] }) {
  if (!posts || posts.length === 0) return null;

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
            href="/news"
            className="hidden items-center gap-2 text-xs font-medium uppercase tracking-wider text-foreground transition-colors hover:text-accent md:flex"
          >
            View All Articles
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>

        <div className="mt-12 text-center md:hidden">
          <Link
            href="/news"
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
  article: any
}) {
  const publishedDate = article.published_at 
    ? new Date(article.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <article className="group flex flex-col">
      <Link href={`/news/${article.slug}`}>
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <Image
            src={article.feature_image || "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=600&q=80"}
            alt={article.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
        <div className="flex flex-1 flex-col pt-5">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-accent">
              {article.primary_tag?.name || "News"}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {article.reading_time ? `${article.reading_time} min read` : "5 min read"}
            </span>
          </div>
          <h3 className="mt-3 font-serif text-xl font-medium leading-snug text-foreground">
            <span className="text-balance line-clamp-2">{article.title}</span>
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground line-clamp-2">
            {article.custom_excerpt || article.excerpt || ""}
          </p>
          <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{article.primary_author?.name || "Yorkshire Businesswoman"}</span>
            <span>·</span>
            <span>{publishedDate}</span>
          </div>
        </div>
      </Link>
    </article>
  )
}
