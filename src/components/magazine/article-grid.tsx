import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

export function ArticleGrid({ posts }: { posts: any[] }) {
  if (!posts || posts.length === 0) return null;

  return (
    <section className="bg-background">
      <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8 lg:py-20">
        {/* Section Header - More refined */}
        <div className="mb-10 flex items-end justify-between border-b border-border pb-6">
          <div>
            <h2 className="font-serif text-2xl font-medium text-foreground lg:text-3xl">
              Latest Stories
            </h2>
          </div>
          <Link
            href="/news"
            className="hidden items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-accent md:flex"
          >
            View All
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Articles Grid - Lighter, more spacious */}
        <div className="grid gap-x-6 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>

        {/* Mobile CTA */}
        <div className="mt-10 text-center md:hidden">
          <Link
            href="/news"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-accent"
          >
            View All Articles
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  )
}

function ArticleCard({ article }: { article: any }) {
  if (!article) return null;
  
  let publishedDate = '';
  try {
    if (article.published_at) {
      publishedDate = new Date(article.published_at).toLocaleDateString('en-GB', { 
        day: 'numeric', 
        month: 'short'
      });
    }
  } catch (e) {
    console.error("Error formatting date:", e);
  }

  return (
    <article className="group flex flex-col">
      <Link href={article.slug ? `/news/${article.slug}` : '#'} className="flex flex-col h-full">
        {/* Image - Cleaner aspect ratio */}
        <div className="relative aspect-[3/2] overflow-hidden bg-muted">
          <Image
            src={article.feature_image || "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=600&q=80"}
            alt={article.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        </div>
        
        {/* Content - More breathing room */}
        <div className="flex flex-1 flex-col pt-4">
          {/* Meta - Simplified */}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="font-medium text-accent">
              {article.primary_tag?.name || "News"}
            </span>
            <span className="text-border">|</span>
            <span>{publishedDate}</span>
          </div>
          
          {/* Title - Cleaner */}
          <h3 className="mt-2.5 font-serif text-lg font-medium leading-snug text-foreground transition-colors group-hover:text-accent">
            <span className="line-clamp-2">{article.title}</span>
          </h3>
          
          {/* Excerpt - Lighter */}
          <p className="mt-2 flex-1 text-[13px] leading-relaxed text-muted-foreground/80 line-clamp-2">
            {article.custom_excerpt || article.excerpt || ""}
          </p>
          
          {/* Author - Minimal */}
          <div className="mt-4 flex items-center gap-2.5">
            <div className="h-7 w-7 overflow-hidden rounded-full bg-muted">
              {article.primary_author?.profile_image ? (
                <Image
                  src={article.primary_author.profile_image}
                  alt={article.primary_author.name || "Author"}
                  width={28}
                  height={28}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-accent/10 text-[10px] font-medium text-accent">
                  {(article.primary_author?.name || "Y")[0]}
                </div>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {article.primary_author?.name || "YBW"}
            </span>
          </div>
        </div>
      </Link>
    </article>
  )
}
