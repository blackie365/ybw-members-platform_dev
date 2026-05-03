import Image from 'next/image'
import Link from 'next/link'
import { format } from 'date-fns'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export function NewsGrid({ posts }: { posts: any[] }) {
  if (!posts || posts.length === 0) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
      {posts.map((post) => (
        <Card key={post.id} className="group overflow-hidden border-border/50 bg-background hover:border-primary/50 transition-colors duration-300">
          <div className="relative aspect-[16/9] overflow-hidden bg-muted">
            {post.feature_image ? (
              <Image
                src={post.feature_image}
                alt={post.title}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
                No image
              </div>
            )}
          </div>
          
          <CardHeader className="p-5 pb-0">
            <time dateTime={post.published_at} className="text-xs font-medium text-muted-foreground mb-2 block">
              {post.published_at ? format(new Date(post.published_at), 'MMMM d, yyyy') : ''}
            </time>
            <CardTitle className="text-xl font-bold leading-tight group-hover:text-primary transition-colors line-clamp-2">
              <Link href={`/news/${post.slug}`}>
                <span className="absolute inset-0" />
                {post.title}
              </Link>
            </CardTitle>
          </CardHeader>
          
          <CardContent className="p-5 pt-3">
            {(post.custom_excerpt || post.excerpt) && (
              <p className="text-sm text-muted-foreground line-clamp-3">
                {post.custom_excerpt || post.excerpt}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}