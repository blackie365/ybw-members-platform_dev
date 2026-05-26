import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import { getPosts } from '@/lib/ghost';

export async function UpcomingEvents() {
  const events = await getPosts({ limit: 3, filter: 'tag:events' });
  return (
    <div className="bg-white border border-border rounded-none p-8 shadow-sm dark:bg-zinc-950">
      <div className="flex justify-between items-center mb-8 border-b border-border pb-4">
        <h2 className="font-serif text-2xl font-medium text-foreground">Upcoming Events</h2>
        <Link href="/news?tag=events" className="text-[10px] font-medium uppercase tracking-wider text-accent hover:text-foreground transition-colors">
          View All
        </Link>
      </div>

      <div className="space-y-6">
        {events.length > 0 ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event: any) => (
              <div key={event.id} className="group relative flex flex-col items-start justify-between">
                <div className="relative w-full mb-5 overflow-hidden">
                  {event.feature_image ? (
                    <Image
                      src={event.feature_image}
                      alt={event.title}
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
                  <time dateTime={event.published_at} className="text-accent font-medium">
                    {event.published_at ? format(new Date(event.published_at), 'MMMM d, yyyy') : ''}
                  </time>
                </div>
                <h3 className="font-serif text-xl font-medium leading-snug text-foreground group-hover:text-accent transition-colors">
                  <Link href={`/news/${event.slug}`}>
                    <span className="absolute inset-0" />
                    <span className="line-clamp-2">{event.title}</span>
                  </Link>
                </h3>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border border-dashed border-border">
            <h3 className="mt-2 font-serif text-xl text-foreground">No upcoming events</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Check back later for new events from the community.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
