import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

export function ArticleGrid({ posts }: { posts: any[] }) {
  if (!posts || posts.length === 0) return null;

  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8 lg:py-24">
        {/* Section Header */}
        <div className="mb-14 flex items-end justify-between">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-accent">
              Latest Stories
            </span>
            <h2 className="mt-3 font-serif text-3xl font-medium text-foreground lg:text-4xl">
              Must-Read Articles
            </h2>
          </div>
          <Link
            href="/news"
            className="hidden items-center gap-2 border-b border-transparent pb-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground transition-all hover:border-accent hover:text-accent md:flex"
          >
            View All Articles
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Articles Grid */}
        <div className="grid gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>

        {/* Mobile CTA */}
        <div className="mt-14 text-center md:hidden">
          <Link
            href="/news"
            className="inline-flex items-center gap-2 border-b border-accent pb-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground transition-colors hover:text-accent"
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
    ? new Date(article.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <article className="group flex flex-col">
      <Link href={`/news/${article.slug}`}>
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <Image
            src={article.feature_image || "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=600&q=80"}
            alt={article.title}
            fill
            className="object-cover transition-all duration-500 group-hover:scale-[1.03]"
          />
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-foreground/0 transition-colors group-hover:bg-foreground/5" />
        </div>
        
        {/* Content */}
        <div className="flex flex-1 flex-col pt-5">
          {/* Meta */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
              {article.primary_tag?.name || "News"}
            </span>
            <span className="h-1 w-1 rounded-full bg-border" />
            <span className="text-[10px] text-muted-foreground">
              {article.reading_time ? `${article.reading_time} min read` : "5 min read"}
            </span>
          </div>
          
          {/* Title */}
          <h3 className="mt-3 font-serif text-xl font-medium leading-snug text-foreground transition-colors group-hover:text-accent">
            <span className="text-balance line-clamp-2">{article.title}</span>
          </h3>
          
          {/* Excerpt */}
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground line-clamp-2">
            {article.custom_excerpt || article.excerpt || ""}
          </p>
          
          {/* Author & Date */}
          <div className="mt-5 flex items-center gap-3 border-t border-border pt-5">
            <div className="h-8 w-8 overflow-hidden rounded-full bg-muted">
              {article.primary_author?.profile_image ? (
                <Image
                  src={article.primary_author.profile_image}
                  alt={article.primary_author.name || "Author"}
                  width={32}
                  height={32}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-accent/10 text-[10px] font-semibold text-accent">
                  {(article.primary_author?.name || "Y")[0]}
                </div>
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-medium text-foreground">
                {article.primary_author?.name || "Yorkshire Businesswoman"}
              </span>
              <span className="text-[10px] text-muted-foreground">{publishedDate}</span>
            </div>
          </div>
        </div>
      </Link>
    </article>
  )
}
