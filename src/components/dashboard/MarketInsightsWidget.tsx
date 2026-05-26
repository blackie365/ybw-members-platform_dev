import { getLatestMarketInsight } from '@/lib/marketInsights';

export async function MarketInsightsWidget() {
  const marketInsight = await getLatestMarketInsight();
  return (
    <div className="bg-white border border-border rounded-none p-8 shadow-sm dark:bg-zinc-950">
      <div className="flex justify-between items-center mb-8 border-b border-border pb-4">
        <h2 className="font-serif text-2xl font-medium text-foreground">Economic Insights</h2>
      </div>
      
      <div className="space-y-6">
        {marketInsight && marketInsight.points && marketInsight.points.length > 0 ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {marketInsight.points.map((point: any, index: number) => (
              <div key={index} className="group relative flex flex-col items-start justify-between bg-muted/50 p-6 border border-border">
                <div className="flex items-center gap-x-4 text-[10px] uppercase tracking-wider mb-4">
                  <span className="inline-flex items-center bg-background px-3 py-1 font-bold text-foreground border border-border">
                    {point.sourceName || 'Report'}
                  </span>
                </div>
                <h3 className="font-serif text-xl font-medium leading-snug text-foreground mb-3">
                  {point.sourceUrl ? (
                    <a href={point.sourceUrl} target="_blank" rel="noopener noreferrer" className="group-hover:text-accent transition-colors">
                      <span className="absolute inset-0" aria-hidden="true" />
                      {point.summary}
                    </a>
                  ) : (
                    point.summary
                  )}
                </h3>
                <p className="mt-auto text-sm leading-relaxed text-muted-foreground line-clamp-4">
                  {point.fullText}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border border-dashed border-border">
            <p className="text-sm text-muted-foreground">
              No economic insights available at the moment.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
