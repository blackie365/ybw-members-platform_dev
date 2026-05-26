import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import { getPosts } from '@/lib/ghost';

export async function RecentNews() {
  const news = await getPosts({ limit: 3, filter: 'tag:news' });
  return (
    <div className="bg-white border border-border rounded-none p-8 shadow-sm dark:bg-zinc-950">
      <div className="flex justify-between items-center mb-8 border-b border-border pb-4">
        <h2 className="font-serif text-2xl font-medium text-foreground">Recent News</h2>
        <Link href="/news" className="text-[10px] font-medium uppercase tracking-wider text-accent hover:text-foreground transition-colors">
          View All
        </Link>
      </div>
      
      <div className="space-y-6">
        {news.length > 0 ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {news.map((item: any) => (
              <div key={item.id} className="group relative flex flex-col items-start justify-between">
                <div className="relative w-full mb-5 overflow-hidden">
                  {item.feature_image ? (
                    <Image
                      src={item.feature_image}
                      alt={item.title}
                      width={400}
                      height={250}
                      className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="aspect-[4/3] w-full bg-muted flex items-center justify-center">
                      <span className="text-muted-foreground text-xs uppercase tracking-wider">No image</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-x-3 text-[10px] uppercase tracking-wider mb-3">
                  <time dateTime={item.published_at} className="text-accent font-medium">
                    {item.published_at ? format(new Date(item.published_at), 'MMMM d, yyyy') : ''}
                  </time>
                </div>
                <h3 className="font-serif text-xl font-medium leading-snug text-foreground group-hover:text-accent transition-colors">
                  <Link href={`/news/${item.slug}`}>
                    <span className="absolute inset-0" />
                    <span className="line-clamp-2">{item.title}</span>
                  </Link>
                </h3>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border border-dashed border-border">
            <p className="text-sm text-muted-foreground mb-4">
              Catch up on the latest Yorkshire Businesswoman news.
            </p>
            <Link href="/news" className="inline-flex items-center bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-wider text-primary-foreground hover:bg-primary/90 transition-colors">
              Read News
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
