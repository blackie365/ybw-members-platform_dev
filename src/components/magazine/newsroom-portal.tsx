import React from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, ExternalLink, Globe, Zap, Radio, Clock, TrendingUp } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { RSSFeedItem } from "@/lib/rss-service"

interface NewsroomPortalProps {
  ghostPosts: any[]
  rssNews: RSSFeedItem[]
}

export function NewsroomPortal({ ghostPosts, rssNews }: NewsroomPortalProps) {
  const featuredPost = ghostPosts[0]
  const otherPosts = ghostPosts.slice(1, 4) // Taking 3 posts for the main grid
  const sidePosts = ghostPosts.slice(4, 7) // Taking 3 more for side integration

  return (
    <section className="bg-white border-y border-stone-200 overflow-hidden">
      {/* Dynamic News Ticker - The "Bustling" Entry */}
      <div className="bg-stone-900 py-2 overflow-hidden border-b border-stone-800">
        <div className="flex whitespace-nowrap animate-marquee">
          {[...rssNews, ...rssNews].map((item, i) => (
            <div key={i} className="flex items-center gap-4 px-8 border-r border-stone-700">
              <span className="text-[9px] font-black uppercase tracking-tighter text-accent flex items-center gap-1">
                <Radio className="h-2 w-2" /> {item.source}
              </span>
              <span className="text-[10px] font-medium text-stone-300">
                {item.title}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 lg:px-8 py-12">
        {/* Main Header with dynamic stats */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 border-b border-stone-100 pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="bg-accent h-6 w-1"></div>
              <h2 className="text-3xl font-serif font-black text-stone-900 tracking-tight italic">
                The Newsroom
              </h2>
            </div>
            <p className="text-stone-500 text-xs font-medium uppercase tracking-widest">
              Live from across the Yorkshire Region • {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          
          <div className="flex gap-4">
            <div className="flex flex-col items-end border-r border-stone-100 pr-4">
              <span className="text-[10px] font-bold text-stone-400 uppercase">Live Updates</span>
              <span className="text-sm font-mono font-bold text-green-600">Active</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-stone-400 uppercase">Region</span>
              <span className="text-sm font-bold text-stone-900 italic underline decoration-accent">Yorkshire</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* Column 1: Featured & Main Grid (7 Cols) */}
          <div className="lg:col-span-7 space-y-12">
            {/* Featured Post - More "Heroic" but Newsy */}
            {featuredPost && (
              <article className="group relative space-y-6">
                <div className="relative aspect-[16/9] overflow-hidden rounded-sm ring-1 ring-stone-200">
                  <Image
                    src={featuredPost.feature_image || "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=1000&q=80"}
                    alt={featuredPost.title}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute top-0 right-0 bg-stone-900/90 backdrop-blur-sm p-3 text-white">
                    <TrendingUp className="h-4 w-4 text-accent" />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="bg-accent text-white px-2 py-0.5 text-[9px] font-black uppercase tracking-widest">
                      {featuredPost.primary_tag?.name || "Featured"}
                    </span>
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {featuredPost.published_at ? formatDistanceToNow(new Date(featuredPost.published_at)) + ' ago' : ''}
                    </span>
                  </div>
                  
                  <h3 className="text-4xl font-serif font-bold leading-tight text-stone-900 group-hover:text-accent transition-colors">
                    <Link href={`/news/${featuredPost.slug}`}>
                      {featuredPost.title}
                    </Link>
                  </h3>
                  
                  <p className="text-stone-600 text-lg leading-relaxed font-serif italic">
                    {featuredPost.custom_excerpt || featuredPost.excerpt}
                  </p>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-stone-50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-stone-100 border border-stone-200 overflow-hidden">
                        {featuredPost.primary_author?.profile_image && (
                          <Image src={featuredPost.primary_author.profile_image} alt="" width={32} height={32} />
                        )}
                      </div>
                      <span className="text-xs font-bold text-stone-900 uppercase tracking-wider">{featuredPost.primary_author?.name}</span>
                    </div>
                    <Link 
                      href={`/news/${featuredPost.slug}`}
                      className="text-[10px] font-black uppercase tracking-widest text-accent hover:underline flex items-center gap-1"
                    >
                      Full Report <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </article>
            )}

            {/* Secondary Stories Grid */}
            <div className="grid md:grid-cols-2 gap-x-8 gap-y-12 pt-12 border-t border-stone-100">
              {otherPosts.map((post) => (
                <article key={post.id} className="group flex flex-col gap-4">
                  <div className="relative aspect-video overflow-hidden rounded-sm bg-stone-50 border border-stone-100">
                    <Image
                      src={post.feature_image || "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=600&q=80"}
                      alt={post.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="space-y-2">
                    <span className="text-[9px] font-black text-accent uppercase tracking-[0.2em]">
                      {post.primary_tag?.name || "News"}
                    </span>
                    <h4 className="text-xl font-serif font-bold leading-snug text-stone-900 group-hover:text-accent transition-colors line-clamp-2">
                      <Link href={`/news/${post.slug}`}>{post.title}</Link>
                    </h4>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* Column 2: The "Wire" Desk (5 Cols) - Now more integrated */}
          <div className="lg:col-span-5 flex flex-col gap-10">
            
            {/* Yorkshire Wire - Dynamic Feed */}
            <div className="bg-stone-50 p-6 rounded-sm border border-stone-100 space-y-6">
              <div className="flex items-center justify-between border-b border-stone-200 pb-4">
                <div className="flex items-center gap-2">
                  <Radio className="h-5 w-5 text-accent animate-pulse" />
                  <h2 className="text-xl font-serif font-bold text-stone-900 italic">Regional Wire</h2>
                </div>
                <div className="flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded border border-green-100">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                  <span className="text-[9px] font-black uppercase text-green-700">Live Feed</span>
                </div>
              </div>

              <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {rssNews.map((item, i) => (
                  <a 
                    key={i} 
                    href={item.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block group border-b border-stone-200/50 pb-6 last:border-0"
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-black uppercase tracking-widest text-accent flex items-center gap-1.5">
                          <Globe className="h-3 w-3" /> {item.source}
                        </span>
                        <span className="text-[8px] text-stone-400 font-bold uppercase">
                          {formatDistanceToNow(new Date(item.pubDate))} ago
                        </span>
                      </div>
                      {item.imageUrl && (
                        <div className="relative w-16 h-12 rounded overflow-hidden shrink-0 border border-stone-100">
                          <Image src={item.imageUrl} alt="" fill className="object-cover grayscale group-hover:grayscale-0 transition-all" />
                        </div>
                      )}
                    </div>
                    <h5 className="text-sm font-bold leading-tight text-stone-800 group-hover:text-accent transition-colors mb-2">
                      {item.title}
                    </h5>
                    <div className="flex items-center gap-1 text-[9px] font-bold uppercase text-stone-400 group-hover:text-accent transition-colors">
                      View Wire Report <ExternalLink className="h-2 w-2" />
                    </div>
                  </a>
                ))}
              </div>
              
              <Link 
                href="/news?source=wire" 
                className="flex items-center justify-center w-full py-3 bg-stone-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-accent transition-colors"
              >
                Enter the Wire Desk <ArrowRight className="ml-2 h-3 w-3" />
              </Link>
            </div>

            {/* Integrated "Briefs" - More Ghost Posts but styled differently */}
            <div className="space-y-6">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-stone-400 flex items-center gap-2">
                <Zap className="h-3 w-3 text-accent" /> Editor&apos;s Briefs
              </h3>
              <div className="space-y-8">
                {sidePosts.map((post) => (
                  <article key={post.id} className="group border-l-2 border-stone-100 pl-4 hover:border-accent transition-colors">
                    <Link href={`/news/${post.slug}`}>
                      <h4 className="text-sm font-serif font-bold text-stone-900 group-hover:text-accent transition-colors leading-tight mb-2">
                        {post.title}
                      </h4>
                      <div className="flex items-center gap-2 text-[9px] font-bold text-stone-400 uppercase tracking-wider">
                        <span>{post.primary_tag?.name}</span>
                        <span>•</span>
                        <span>{formatDistanceToNow(new Date(post.published_at))} ago</span>
                      </div>
                    </Link>
                  </article>
                ))}
              </div>
            </div>

            {/* Newsletter/Action Card */}
            <div className="mt-auto bg-accent p-8 text-white relative overflow-hidden">
              <div className="relative z-10">
                <h4 className="text-2xl font-serif font-bold italic mb-2 leading-tight">Join the Inner Circle.</h4>
                <p className="text-white/80 text-sm mb-6 font-medium leading-relaxed">
                  Exclusive networking, premium events, and regional business insights.
                </p>
                <Link 
                  href="/membership"
                  className="inline-flex items-center gap-2 bg-white text-accent px-6 py-3 rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-stone-900 hover:text-white transition-all"
                >
                  Join Today <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="absolute -bottom-10 -right-10 opacity-10">
                <Globe className="w-40 h-40" />
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
