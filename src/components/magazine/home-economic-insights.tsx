import { getLatestMarketInsight } from '@/lib/marketInsights';

export async function HomeEconomicInsights() {
  const marketInsight = await getLatestMarketInsight();
  
  if (!marketInsight || !marketInsight.points || marketInsight.points.length === 0) {
    return null;
  }

  return (
    <section className="py-24 bg-white dark:bg-zinc-950 border-y border-border">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="font-serif text-4xl font-medium text-foreground mb-4 italic">Economic Insights</h2>
          <div className="h-1 w-20 bg-accent mx-auto mb-6"></div>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed">
            Essential market trends and economic briefings curated for Yorkshire&apos;s business community.
          </p>
        </div>
        
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {marketInsight.points.map((point: any, index: number) => (
            <div key={index} className="group relative flex flex-col items-start justify-between bg-zinc-50 dark:bg-zinc-900/50 p-8 border border-border hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="flex items-center gap-x-4 text-[10px] uppercase tracking-widest mb-6">
                <span className="inline-flex items-center bg-white dark:bg-zinc-800 px-4 py-1.5 font-bold text-accent border border-accent/20 shadow-sm">
                  {point.sourceName || 'Report'}
                </span>
              </div>
              
              <h3 className="font-serif text-2xl font-medium leading-tight text-foreground mb-5">
                {point.sourceUrl ? (
                  <a href={point.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">
                    {point.summary}
                  </a>
                ) : (
                  point.summary
                )}
              </h3>
              
              <p className="text-muted-foreground leading-relaxed line-clamp-5 text-sm mb-8">
                {point.fullText}
              </p>
              
              {point.sourceUrl && (
                <div className="mt-auto pt-6 border-t border-border/50 w-full">
                  <a 
                    href={point.sourceUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent hover:text-foreground transition-colors flex items-center gap-2"
                  >
                    Read full briefing
                    <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
