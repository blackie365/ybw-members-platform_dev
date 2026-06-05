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
    <div className="border-y border-stone-800 bg-stone-900 py-2 overflow-hidden flex whitespace-nowrap group">
      <div className="animate-marquee inline-block hover:[animation-play-state:paused]">
        {duplicatedPosts.map((post, idx) => (
          <span key={`${post.id}-${idx}`} className="mx-6 font-serif text-sm text-stone-300 font-medium">
            <span className="text-accent mr-4 font-sans font-bold">{"//"}</span>
            <Link href={`/news/${post.slug}`} className="hover:text-accent transition-colors">
              {post.title}
            </Link>
          </span>
        ))}
      </div>
    </div>
  )
}