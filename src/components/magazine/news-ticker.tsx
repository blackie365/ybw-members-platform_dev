"use client"

import Link from "next/link"

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
    <div className="border-y border-border bg-[#f7f5f1] dark:bg-zinc-950 py-2.5 overflow-hidden flex whitespace-nowrap group">
      <div className="animate-marquee inline-block hover:[animation-play-state:paused]">
        {duplicatedPosts.map((post, idx) => (
          <span key={`${post.id}-${idx}`} className="mx-6 text-sm font-medium tracking-wide uppercase">
            <span className="text-primary/60 mr-4">•</span>
            <Link href={`/news/${post.slug}`} className="hover:text-primary/70 transition-colors">
              {post.title}
            </Link>
          </span>
        ))}
      </div>
    </div>
  )
}