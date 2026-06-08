import { getPosts } from '@/lib/ghost';
import { getTotalMembers } from '@/lib/dashboard';

export async function QuickStats() {
  const [events, news, totalMembers] = await Promise.all([
    getPosts({ limit: 3, filter: 'tag:events' }),
    getPosts({ limit: 3, filter: 'tag:news' }),
    getTotalMembers()
  ]);

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mb-8">
      <div className="bg-white border border-border rounded-none p-6 shadow-sm dark:bg-zinc-950 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-accent">Total Members</p>
          <p className="mt-2 font-serif text-4xl font-medium tracking-tight text-foreground">{totalMembers > 0 ? totalMembers : '--'}</p>
        </div>
        <div className="p-3 bg-muted rounded-none border border-border">
          <svg className="w-8 h-8 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
      </div>
      <div className="bg-white border border-border rounded-none p-6 shadow-sm dark:bg-zinc-950 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-accent">Upcoming Events</p>
          <p className="mt-2 font-serif text-4xl font-medium tracking-tight text-foreground">{events?.length}</p>
        </div>
        <div className="p-3 bg-muted rounded-none border border-border">
          <svg className="w-8 h-8 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      </div>
      <div className="bg-white border border-border rounded-none p-6 shadow-sm dark:bg-zinc-950 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-accent">Latest News</p>
          <p className="mt-2 font-serif text-3xl font-medium tracking-tight text-foreground">{news?.length > 0 ? 'Updated' : 'Empty'}</p>
        </div>
        <div className="p-3 bg-muted rounded-none border border-border">
          <svg className="w-8 h-8 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
        </div>
      </div>
    </div>
  );
}
