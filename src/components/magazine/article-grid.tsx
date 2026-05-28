import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

export function ArticleGrid({ posts }: { posts: any[] }) {
  if (!posts || posts.length === 0) return null;

  return (
    <section className="bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8 lg:py-12">
        {/* Section Header - Rocket.new style */}
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <h2 className="font-serif text-2xl font-medium leading-tight text-foreground md:text-3xl">
              Latest Stories
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              Fresh perspectives on business, leadership, and life in Yorkshire.
            </p>
          </div>
          <Link
            href="/news"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-accent"
          >
            View All Stories
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Articles Grid */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((article, index) => (
            <ArticleCard key={article.id} article={article} index={index} />
          ))}
        </div>
      </div>
    </section>
  )
}

function ArticleCard({ article, index }: { article: any; index: number }) {
  if (!article) return null;
  
  let publishedDate = '';
  try {
    if (article.published_at) {
      publishedDate = new Date(article.published_at).toLocaleDateString('en-GB', { 
        day: 'numeric', 
        month: 'short',
        year: 'numeric'
      });
    }
  } catch (e) {
    console.error("Error formatting date:", e);
  }

  return (
    <article className="group flex flex-col border border-border bg-card transition-all duration-300 hover:shadow-lg dark:hover:shadow-black/20">
      <Link href={article.slug ? `/news/${article.slug}` : '#'} className="flex flex-col h-full">
        {/* Image */}
        <div className="relative aspect-[16/10] overflow-hidden bg-muted">
          <Image
            src={article.feature_image || "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=600&q=80"}
            alt={article.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        </div>
        
        {/* Content */}
        <div className="flex flex-1 flex-col p-6">
          {/* Number + Category */}
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-muted-foreground">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="text-xs font-medium uppercase tracking-wider text-accent">
              {article.primary_tag?.name || "News"}
            </span>
          </div>
          
          {/* Title */}
          <h3 className="mt-4 font-serif text-xl font-medium leading-snug text-foreground transition-colors group-hover:text-accent">
            <span className="line-clamp-2">{article.title}</span>
          </h3>
          
          {/* Excerpt */}
          <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground line-clamp-2">
            {article.custom_excerpt || article.excerpt || ""}
          </p>
          
          {/* Footer */}
          <div className="mt-6 flex items-center justify-between pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              {article.primary_author?.profile_image ? (
                <Image
                  src={article.primary_author.profile_image}
                  alt={article.primary_author.name || "Author"}
                  width={24}
                  height={24}
                  className="h-6 w-6 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-[10px] font-medium text-accent">
                  {(article.primary_author?.name || "Y")[0]}
                </div>
              )}
              <span className="text-xs text-muted-foreground">
                {publishedDate}
              </span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-all group-hover:text-accent group-hover:translate-x-1" />
          </div>
        </div>
      </Link>
    </article>
  )
}
