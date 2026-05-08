'use client';

import MuxPlayer from '@mux/mux-player-react';

interface MuxVideoPlayerProps {
  playbackId: string;
  title?: string;
  className?: string;
}

export function MuxVideoPlayer({ playbackId, title, className = '' }: MuxVideoPlayerProps) {
  return (
    <div className={`overflow-hidden rounded-2xl bg-zinc-900 shadow-xl ring-1 ring-zinc-900/10 dark:ring-white/10 ${className}`}>
      <MuxPlayer
        streamType="on-demand"
        playbackId={playbackId}
        metadataVideoTitle={title || 'Yorkshire Businesswoman Video'}
        metadataViewerUserId="member"
        primaryColor="#4f46e5" // matches indigo-600
        secondaryColor="#ffffff"
        className="w-full aspect-video"
      />
    </div>
  );
}
