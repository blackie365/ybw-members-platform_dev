"use client"

import Link from "next/link"
import { Flame } from "lucide-react"

export function NewsTicker({ posts }: { posts?: any[] }) {
  if (!posts || posts.length === 0) return null;

  return (
    <div className="border-y border-border bg-secondary/50">
      <div className="mx-auto flex max-w-7xl items-center gap-8 overflow-x-auto px-4 py-3 lg:px-8">
        <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
          <Flame className="h-3.5 w-3.5" />
          Trending
        </span>
        <div className="flex items-center gap-8">
          {posts.map((post) => (
            <div key={post.id} className="flex shrink-0 items-center gap-2">
              <Link 
                href={`/news/${post.slug}`} 
                className="text-xs font-medium text-foreground transition-colors hover:text-accent"
              >
                {post.title}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
