import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

export function HeroSection({ posts }: { posts: any[] }) {
  if (!posts || posts.length === 0) return null;

  const coverStory = posts[0];
  const secondaryStories = posts.slice(1, 3);

  return (
    <section className="relative">
      <div className="mx-auto max-w-7xl px-4 py-12 lg:px-8 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          {/* Featured Article */}
          <article className="group relative">
            <Link href={`/news/${coverStory.slug}`} className="block h-full">
              <div className="relative h-full min-h-[500px] w-full overflow-hidden bg-muted">
                <Image
                  src={coverStory.feature_image || "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&q=80"}
                  alt={coverStory.title}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-6 lg:p-10">
                <span className="mb-3 inline-block border border-white/40 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-white">
                  Cover Story
                </span>
                <h2 className="font-serif text-2xl font-medium leading-tight text-white lg:text-4xl">
                  <span className="text-balance">
                    {coverStory.title}
                  </span>
                </h2>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-white/80 line-clamp-2">
                  {coverStory.custom_excerpt || coverStory.excerpt || ""}
                </p>
                <div className="mt-6 flex items-center gap-3 text-white/70">
                  <span className="text-xs font-medium uppercase tracking-wider">
                    Read Article
                  </span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </Link>
          </article>

          {/* Secondary Articles */}
          <div className="flex flex-col gap-6">
            {secondaryStories.map((post) => (
              <SecondaryArticle
                key={post.id}
                image={post.feature_image || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=600&q=80"}
                category={post.primary_tag?.name || "News"}
                title={post.title}
                description={post.custom_excerpt || post.excerpt || ""}
                slug={post.slug}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function SecondaryArticle({
  image,
  category,
  title,
  description,
  slug,
}: {
  image: string
  category: string
  title: string
  description: string
  slug: string
}) {
  return (
    <article className="group flex flex-1 flex-col">
      <Link href={`/news/${slug}`} className="flex h-full flex-col lg:flex-row lg:gap-6">
        <div className="relative aspect-[16/10] overflow-hidden bg-muted lg:aspect-square lg:w-48 lg:shrink-0">
          <Image
            src={image}
            alt={title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
        <div className="flex flex-1 flex-col justify-center py-4 lg:py-0">
          <span className="mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-accent">
            {category}
          </span>
          <h3 className="font-serif text-lg font-medium leading-snug text-foreground lg:text-xl">
            <span className="text-balance line-clamp-2">{title}</span>
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground line-clamp-2">
            {description}
          </p>
          <div className="mt-4 flex items-center gap-2 text-foreground/70">
            <span className="text-xs font-medium uppercase tracking-wider">
              Read More
            </span>
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </Link>
    </article>
  )
}
