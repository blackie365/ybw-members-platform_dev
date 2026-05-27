import { getLatestMarketInsight } from '@/lib/marketInsights';
import { ArrowRight } from 'lucide-react';

export async function HomeEconomicInsights() {
  const marketInsight = await getLatestMarketInsight();
  
  if (!marketInsight || !marketInsight.points || marketInsight.points.length === 0) {
    return null;
  }

  return (
    <section className="bg-zinc-50 dark:bg-zinc-900/50">
      <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8 lg:py-20">
        {/* Header - Streamlined */}
        <div className="mb-10 border-b border-border pb-6">
          <h2 className="font-serif text-2xl font-medium text-foreground md:text-3xl">
            Economic Insights
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Market trends curated for Yorkshire&apos;s business community
          </p>
        </div>
        
        {/* Insights Grid - Lighter cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {marketInsight.points.map((point: any, index: number) => (
            <div 
              key={index} 
              className="group flex flex-col bg-background p-5 border border-border transition-all hover:border-accent/30 hover:shadow-sm"
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">
                {point.sourceName || 'Report'}
              </span>
              
              <h3 className="mt-3 font-serif text-base font-medium leading-snug text-foreground line-clamp-3">
                {point.sourceUrl ? (
                  <a href={point.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">
                    {point.summary}
                  </a>
                ) : (
                  point.summary
                )}
              </h3>
              
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground line-clamp-3 flex-1">
                {point.fullText}
              </p>
              
              {point.sourceUrl && (
                <a 
                  href={point.sourceUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="mt-4 flex items-center gap-1 text-[11px] font-medium text-accent opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Read more
                  <ArrowRight className="h-3 w-3" />
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
