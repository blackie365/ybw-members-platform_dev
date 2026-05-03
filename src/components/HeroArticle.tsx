import Image from 'next/image'
import Link from 'next/link'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export function HeroArticle({ article }: { article: any }) {
  if (!article) return null

  return (
    <article className="group relative grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
      <div className="relative w-full aspect-[4/3] lg:aspect-[4/3] lg:h-full overflow-hidden rounded-2xl bg-muted order-1 lg:order-2 shadow-lg">
        {article.feature_image ? (
          <Image
            src={article.feature_image}
            alt={article.title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            No image available
          </div>
        )}
      </div>

      <div className="flex flex-col justify-center space-y-6 lg:space-y-8 order-2 lg:order-1 py-4 lg:py-12">
        <div className="flex items-center gap-4">
          <Badge variant="default" className="px-3 py-1 text-xs font-semibold uppercase tracking-wider bg-primary text-primary-foreground">
            Featured
          </Badge>
          <time dateTime={article.published_at} className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
            {article.published_at ? format(new Date(article.published_at), 'MMMM d, yyyy') : ''}
          </time>
        </div>

        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] text-foreground group-hover:text-primary transition-colors duration-300">
          <Link href={`/news/${article.slug}`}>
            <span className="absolute inset-0 z-10" />
            {article.title}
          </Link>
        </h2>

        {(article.custom_excerpt || article.excerpt) && (
          <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed line-clamp-3">
            {article.custom_excerpt || article.excerpt}
          </p>
        )}

        <div className="pt-4 flex items-center">
          <span className="inline-flex items-center text-sm font-bold text-primary uppercase tracking-widest group-hover:translate-x-2 transition-transform duration-300">
            Read Story <span className="ml-2 text-lg leading-none">&rarr;</span>
          </span>
        </div>
      </div>
    </article>
  )
}