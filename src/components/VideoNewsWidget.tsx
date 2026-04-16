import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import { getVideoNews } from '@/lib/videoNews';

// Using BBC News as a reliable UK news source (Sky News actively blocks API access)
// BBC News Channel ID: UC16niRr50-MSBwiO3YDb3RA
export default async function VideoNewsWidget() {
  const videos = await getVideoNews('UC16niRr50-MSBwiO3YDb3RA', 3);

  return (
    <section>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Video News</h2>
        <a href="https://www.youtube.com/channel/UC16niRr50-MSBwiO3YDb3RA" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
          View channel <span aria-hidden="true">&rarr;</span>
        </a>
      </div>

      {(!videos || videos.length === 0) ? (
        <div className="text-center py-12 border-2 border-dashed border-zinc-200 rounded-lg dark:border-zinc-800 mb-8">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Video feed is currently unavailable or blocked. 
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Featured Video */}
          <div className="lg:col-span-2 group relative flex flex-col bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-4 shadow-sm ring-1 ring-zinc-900/5 dark:ring-white/10 transition-shadow hover:shadow-md hover:ring-zinc-900/10 dark:hover:ring-white/20">
            <div className="relative w-full mb-4 aspect-video rounded-lg overflow-hidden bg-black">
              <iframe 
                src={`https://www.youtube.com/embed/${videos[0].videoId}?rel=0`} 
                title={videos[0].title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
                className="absolute inset-0 w-full h-full border-0"
              ></iframe>
            </div>
            <div className="flex items-center gap-x-4 text-xs mb-2">
              <time dateTime={videos[0].published_at} className="text-zinc-500 dark:text-zinc-400">
                {videos[0].published_at ? format(new Date(videos[0].published_at), 'MMM d, yyyy') : ''}
              </time>
              <span className="text-zinc-500 dark:text-zinc-400 font-medium">{videos[0].channelName}</span>
            </div>
            <h3 className="text-lg sm:text-xl font-semibold leading-7 text-zinc-900 dark:text-white">
              <a href={videos[0].link} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 dark:hover:text-indigo-400">
                {videos[0].title}
              </a>
            </h3>
          </div>

          {/* Side Stacked Videos */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            {videos.slice(1).map((video) => (
              <div key={video.id} className="group relative flex flex-col items-start justify-between bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-4 shadow-sm ring-1 ring-zinc-900/5 dark:ring-white/10 transition-shadow hover:shadow-md hover:ring-zinc-900/10 dark:hover:ring-white/20 flex-1">
                <div className="relative w-full mb-3 aspect-video rounded-lg overflow-hidden bg-black group-hover:opacity-90 transition-opacity">
                  {video.thumbnail ? (
                    <Image
                      src={video.thumbnail}
                      alt={video.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                      <span className="text-zinc-500 text-xs">No Thumbnail</span>
                    </div>
                  )}
                  {/* Play button overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 bg-black/60 rounded-full flex items-center justify-center backdrop-blur-sm group-hover:bg-indigo-600/80 transition-colors">
                      <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col justify-end flex-1 w-full">
                  <div className="flex items-center gap-x-4 text-xs mb-1">
                    <time dateTime={video.published_at} className="text-zinc-500 dark:text-zinc-400">
                      {video.published_at ? format(new Date(video.published_at), 'MMM d, yyyy') : ''}
                    </time>
                  </div>
                  <h3 className="text-sm font-semibold leading-6 text-zinc-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400 line-clamp-3">
                    <a href={video.link} target="_blank" rel="noopener noreferrer">
                      <span className="absolute inset-0" />
                      {video.title}
                    </a>
                  </h3>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
