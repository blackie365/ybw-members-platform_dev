"use client";
import Link from"next/link";

interface Post {
  id: string
  title: string
  slug: string
}

export function NewsTicker({ posts }: { posts: Post[] }) {
  if (!posts || posts.length === 0) return null

  // Duplicate posts to ensure the marquee seamlessly loops
  const duplicatedPosts = [...posts, ...posts]

  return (
    <div className="border-y border-stone-800 bg-stone-900 py-2 overflow-hidden flex whitespace-nowrap group">
      <div className="animate-marquee inline-block hover:[animation-play-state:paused]">
        {duplicatedPosts.map((post, idx) => (
          <span key={`${post.id}-${idx}`} className="mx-6 font-sans text-[11px] uppercase tracking-wider text-stone-200 font-bold">
            <span className="text-accent mr-4">{"//"}</span>
            <Link href={`/news/${post.slug}`} className="hover:text-white transition-colors">
              {post.title}
            </Link>
          </span>
        ))}
      </div>
    </div>
  )
}