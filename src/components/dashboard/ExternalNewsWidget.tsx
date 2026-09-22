import { getExternalNews } from '@/lib/externalNews';
import { format } from 'date-fns';
import { ArrowUpRight, Newspaper } from 'lucide-react';

export async function ExternalNewsWidget() {
  const externalNews = await getExternalNews(6);
  return (
    <div className="bg-white border border-border rounded-none p-8 shadow-sm dark:bg-zinc-950">
      <div className="flex justify-between items-center mb-8 border-b border-border pb-4">
        <h2 className="font-serif text-2xl font-medium text-foreground">Regional Women in Business News</h2>
      </div>
      
      <div className="mt-6 flow-root">
        {externalNews && externalNews.length > 0 ? (
          <ul role="list" className="-my-5 divide-y divide-border">
            {externalNews.map((item: any) => (
              <li key={item.id} className="py-6 group">
                <div className="relative">
                  <div className="flex items-start gap-x-4">
                    <div
                      aria-hidden="true"
                      className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-none border border-border bg-muted text-muted-foreground"
                    >
                      <Newspaper className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-serif text-xl font-medium text-foreground group-hover:text-accent transition-colors">
                        <a href={item.link} target="_blank" rel="noopener noreferrer">
                          <span className="absolute inset-0" aria-hidden="true" />
                          {item.title}
                        </a>
                      </h3>
                      {item.excerpt && (
                        <p className="mt-3 text-sm leading-relaxed text-muted-foreground line-clamp-2">
                          {item.excerpt}
                        </p>
                      )}
                      <div className="mt-4 flex items-center gap-x-3 text-[10px] uppercase tracking-wider">
                        <span className="font-bold text-foreground">{item.source || 'News'}</span>
                        <span className="text-muted-foreground">•</span>
                        <time dateTime={item.published_at} className="text-accent font-medium">
                          {item.published_at ? format(new Date(item.published_at), 'MMMM d, yyyy') : ''}
                        </time>
                      </div>
                      <p
                        className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                        aria-label="Opens an external link in a new tab"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        <span>Opens an external site</span>
                      </p>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-16 border border-dashed border-border">
            <p className="text-sm text-muted-foreground">
              No external insights available at the moment.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
