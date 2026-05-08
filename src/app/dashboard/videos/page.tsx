import { MuxVideoPlayer } from '@/components/MuxVideoPlayer';

// In a real application, you might fetch these from a database (like Firestore) or CMS (like Ghost)
const videos = [
  {
    id: '1',
    title: 'Yorkshire Businesswoman Launch Event Highlights',
    playbackId: 'qA1T4lR1n8xM7t02H6T01S7vM9s9i31S5mB8K01j4kKWY', // Example Mux Playback ID
    description: 'Highlights from our recent networking and launch event in Leeds.',
    date: '2025-05-15',
  },
  {
    id: '2',
    title: 'Masterclass: Scaling Your Small Business',
    playbackId: 'v100H28u2p004fB14Q3p6b8uT32m2vN4n3eEwH01Q8cI', // Example Mux Playback ID
    description: 'An exclusive masterclass for members on how to secure funding and scale operations.',
    date: '2025-04-20',
  }
];

export default function VideoLibraryPage() {
  return (
    <div className="space-y-12">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-3xl mb-4">
          Video Library
        </h2>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Exclusive video content, masterclasses, and event replays for Yorkshire Businesswoman members.
        </p>
      </div>

      <div className="grid gap-12">
        {videos.map((video) => (
          <div key={video.id} className="bg-white dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700/50 overflow-hidden">
            <MuxVideoPlayer 
              playbackId={video.playbackId} 
              title={video.title} 
              className="w-full rounded-none rounded-t-2xl border-b border-zinc-200 dark:border-zinc-700/50" 
            />
            <div className="p-6 sm:p-8">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-semibold text-zinc-900 dark:text-white">{video.title}</h3>
                <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10 dark:bg-indigo-400/10 dark:text-indigo-400 dark:ring-indigo-400/30">
                  {new Date(video.date).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                </span>
              </div>
              <p className="text-zinc-600 dark:text-zinc-400">
                {video.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
