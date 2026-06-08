'use client';

import React from 'react';

export default function MagazineReaderSkeleton() {
  return (
    <div className="fixed inset-0 h-[100dvh] bg-[#0c0a09] text-zinc-100 flex flex-col z-[100] overflow-hidden">
      {/* ── Top Control Bar Skeleton ── */}
      <header className="h-14 sm:h-16 border-b border-white/[0.06] flex items-center justify-between px-4 sm:px-6 bg-gradient-to-r from-[#0c0a09]/95 via-[#141210]/95 to-[#0c0a09]/95 backdrop-blur-xl z-50 shrink-0 shadow-[0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Close button skeleton */}
          <div className="magazine-skeleton h-6 w-6 rounded-md" />
          <div className="h-5 w-px bg-white/10 mx-1 sm:mx-2" />
          {/* Logo + title skeleton */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="magazine-skeleton h-6 sm:h-8 w-24 sm:w-32 rounded-sm" />
            <div className="magazine-skeleton hidden sm:block h-3 w-20 rounded-sm" />
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Page counter pill skeleton */}
          <div className="magazine-skeleton hidden sm:block h-7 w-16 rounded-full" />
          <div className="h-5 w-px bg-white/10 mx-1 sm:mx-2" />
          <div className="magazine-skeleton h-8 w-8 sm:h-9 sm:w-9 rounded-md" />
          <div className="magazine-skeleton h-8 w-8 sm:h-9 sm:w-9 rounded-md" />
          <div className="magazine-skeleton h-8 w-8 rounded-md lg:hidden" />
        </div>
      </header>
      {/* ── Main Reader Stage Skeleton ── */}
      <main className="flex-1 relative flex items-center justify-center overflow-hidden bg-[#0c0a09]">

        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="w-[60vw] h-[60vh] rounded-full bg-[#a3413a]/8 blur-[120px]" />
        </div>

        {/* Left nav arrow skeleton */}
        <div className="absolute left-4 xl:left-8 z-40 hidden lg:flex">
          <div className="magazine-skeleton h-11 w-11 rounded-full" />
        </div>

        {/* Right nav arrow skeleton */}
        <div className="absolute right-4 xl:right-8 z-40 hidden lg:flex">
          <div className="magazine-skeleton h-11 w-11 rounded-full" />
        </div>

        {/* Page Viewport Skeleton — Cover style */}
        <div className="relative w-full h-full mx-auto overflow-hidden self-center max-w-none aspect-auto lg:h-[min(92vh,980px)]">
          <div className="absolute inset-0 magazine-skeleton-page">
            {/* Cover page shimmer content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-8">
              {/* Masthead area */}
              <div className="flex flex-col items-center gap-4 w-full max-w-md">
                <div className="magazine-skeleton h-3 w-32 rounded-sm opacity-60" />
                <div className="magazine-skeleton h-10 w-64 rounded-sm" />
                <div className="magazine-skeleton h-10 w-48 rounded-sm" />
                <div className="magazine-skeleton h-1 w-24 rounded-full mt-2 opacity-40" />
              </div>

              {/* Cover image placeholder */}
              <div className="magazine-skeleton w-full max-w-[340px] aspect-[3/4] rounded-sm" />

              {/* Bottom tagline */}
              <div className="flex flex-col items-center gap-2">
                <div className="magazine-skeleton h-3 w-48 rounded-sm opacity-50" />
                <div className="magazine-skeleton h-3 w-36 rounded-sm opacity-40" />
              </div>
            </div>
          </div>
        </div>
      </main>
      {/* ── Bottom Progress Bar & Navigation Skeleton ── */}
      <footer className="h-16 sm:h-20 border-t border-white/[0.06] bg-gradient-to-r from-[#0c0a09]/95 via-[#141210]/95 to-[#0c0a09]/95 backdrop-blur-xl flex flex-col justify-center px-4 sm:px-6 shrink-0 gap-2.5">
        {/* Progress bar skeleton */}
        <div className="w-full h-0.5 bg-white/[0.06] rounded-full overflow-hidden">
          <div className="magazine-skeleton-progress h-full w-1/3 rounded-full" />
        </div>

        {/* Dot indicators + buttons skeleton */}
        <div className="flex items-center justify-between">
          {/* Prev button skeleton */}
          <div className="magazine-skeleton h-7 w-16 rounded-full" />

          {/* Dot indicators skeleton */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: 7 })?.map((_, i) => (
              <div
                key={i}
                className={`magazine-skeleton rounded-full ${
                  i === 0
                    ? 'h-2 w-8'
                    : i <= 2
                    ? 'h-1.5 w-1.5' :'h-1 w-1 opacity-40'
                }`}
              />
            ))}
          </div>

          {/* Next button skeleton */}
          <div className="magazine-skeleton h-7 w-16 rounded-full" />
        </div>
      </footer>
    </div>
  );
}
