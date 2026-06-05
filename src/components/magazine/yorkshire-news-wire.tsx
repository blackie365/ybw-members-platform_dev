import React from "react"
import { RSSFeedItem } from "@/lib/rss-service"
import { ExternalLink, Globe } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface NewsWireProps {
  news: RSSFeedItem[]
}

export function YorkshireNewsWire({ news }: NewsWireProps) {
  if (!news || news.length === 0) return null

  return (
    <section className="py-12 bg-stone-50 border-y border-stone-200">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-accent p-2 rounded-lg">
              <Globe className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-serif font-medium text-stone-900">Yorkshire News Wire</h2>
              <p className="text-xs text-stone-500 uppercase tracking-widest font-bold">Regional Business Aggregator</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-white border border-stone-200 rounded-full shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-[10px] font-bold uppercase tracking-tighter text-stone-600">Live Updates</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {news.map((item, i) => (
            <a 
              key={i} 
              href={item.link} 
              target="_blank" 
              rel="noopener noreferrer"
              className="group bg-white p-5 rounded-xl border border-stone-200 hover:border-accent/40 transition-all hover:shadow-xl flex flex-col h-full"
            >
              <div className="flex justify-between items-start mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-accent bg-accent/5 px-2 py-0.5 rounded">
                  {item.source}
                </span>
                <span className="text-[10px] text-stone-400 font-medium">
                  {formatDistanceToNow(new Date(item.pubDate))} ago
                </span>
              </div>
              <h3 className="font-serif text-lg font-medium leading-snug text-stone-900 group-hover:text-accent transition-colors mb-3 line-clamp-2">
                {item.title}
              </h3>
              <p className="text-sm text-stone-600 line-clamp-3 mb-4 flex-1">
                {item.contentSnippet}
              </p>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-stone-400 group-hover:text-accent transition-colors mt-auto pt-4 border-t border-stone-50">
                Read Full Story <ExternalLink className="h-3 w-3" />
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
