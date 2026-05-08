import { MuxVideoPlayer } from "@/components/MuxVideoPlayer"

export function FeaturedVideoSection() {
  return (
    <section className="border-t border-border bg-zinc-50 dark:bg-zinc-900/50 py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 flex flex-col items-center justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <span className="mb-3 inline-block text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
              YBW TV
            </span>
            <h2 className="font-serif text-3xl font-medium leading-tight text-foreground sm:text-4xl">
              Featured Broadcast
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              Watch exclusive interviews, masterclasses, and highlights from our latest Yorkshire Businesswoman events.
            </p>
          </div>
        </div>

        {/* Elegant Wrapper for the Player */}
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-black/5 dark:ring-white/10">
          <MuxVideoPlayer 
            playbackId="v100H28u2p004fB14Q3p6b8uT32m2vN4n3eEwH01Q8cI" // Using the sample ID for now
            title="Yorkshire Businesswoman Featured Video"
            className="w-full aspect-video rounded-none" // Override default rounding so it fits the wrapper perfectly
          />
        </div>
      </div>
    </section>
  )
}
