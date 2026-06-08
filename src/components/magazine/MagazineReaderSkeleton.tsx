'use client';

import React, { useEffect, useState } from 'react';

export default function MagazineReaderSkeleton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="fixed inset-0 h-[100dvh] bg-[#0c0a09] text-zinc-100 flex flex-col z-[100] overflow-hidden"
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.5s ease',
      }}
    >
      {/* ── Top Control Bar Skeleton ── */}
      <header className="h-12 sm:h-16 border-b border-white/[0.06] flex items-center justify-between px-3 sm:px-6 bg-gradient-to-r from-[#0c0a09]/95 via-[#141210]/95 to-[#0c0a09]/95 backdrop-blur-xl z-50 shrink-0 shadow-[0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Close button skeleton — larger tap target on mobile */}
          <div className="magazine-skeleton h-9 w-9 sm:h-6 sm:w-6 rounded-md" />
          <div className="h-5 w-px bg-white/10 mx-1 sm:mx-2" />
          {/* Logo + title skeleton */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="magazine-skeleton h-5 sm:h-8 w-20 sm:w-32 rounded-sm" />
            <div className="magazine-skeleton hidden sm:block h-3 w-20 rounded-sm" />
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Page counter pill — visible on mobile */}
          <div className="magazine-skeleton flex sm:hidden h-6 w-12 rounded-full" />
          <div className="magazine-skeleton hidden sm:flex h-7 w-16 rounded-full" />
          <div className="h-5 w-px bg-white/10 mx-1 sm:mx-2" />
          {/* Action buttons — larger tap targets on mobile */}
          <div className="magazine-skeleton h-9 w-9 rounded-md" />
          <div className="magazine-skeleton h-9 w-9 rounded-md" />
          {/* Menu button (mobile only) */}
          <div className="magazine-skeleton h-9 w-9 rounded-md lg:hidden" />
        </div>
      </header>

      {/* ── Main Reader Stage Skeleton ── */}
      <main className="flex-1 relative flex items-center justify-center overflow-hidden bg-[#0c0a09]">

        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="w-[60vw] h-[60vh] rounded-full bg-[#a3413a]/8 blur-[120px]" />
        </div>

        {/* Mobile swipe hint arrows */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-between px-3 z-40 lg:hidden pointer-events-none">
          <div className="magazine-skeleton h-10 w-10 rounded-full opacity-40" />
          <div className="magazine-skeleton h-10 w-10 rounded-full opacity-40" />
        </div>

        {/* Desktop nav arrow skeletons */}
        <div className="absolute left-4 xl:left-8 z-40 hidden lg:flex">
          <div className="magazine-skeleton h-11 w-11 rounded-full" />
        </div>
        <div className="absolute right-4 xl:right-8 z-40 hidden lg:flex">
          <div className="magazine-skeleton h-11 w-11 rounded-full" />
        </div>

        {/* Page Viewport Skeleton — Cover style */}
        <div className="relative w-full h-full mx-auto overflow-hidden self-center max-w-none aspect-auto lg:h-[min(92vh,980px)]">
          <div className="absolute inset-0 magazine-skeleton-page">
            {/* Cover page shimmer content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 sm:gap-6 p-4 sm:p-8">
              {/* Masthead area */}
              <div className="flex flex-col items-center gap-3 sm:gap-4 w-full max-w-md">
                <div className="magazine-skeleton h-3 w-24 sm:w-32 rounded-sm opacity-60" />
                <div className="magazine-skeleton h-8 sm:h-10 w-48 sm:w-64 rounded-sm" />
                <div className="magazine-skeleton h-8 sm:h-10 w-36 sm:w-48 rounded-sm" />
                <div className="magazine-skeleton h-1 w-20 sm:w-24 rounded-full mt-2 opacity-40" />
              </div>

              {/* Cover image placeholder — responsive sizing */}
              <div className="magazine-skeleton w-full max-w-[200px] sm:max-w-[340px] aspect-[3/4] rounded-sm" />

              {/* Bottom tagline */}
              <div className="flex flex-col items-center gap-2">
                <div className="magazine-skeleton h-3 w-36 sm:w-48 rounded-sm opacity-50" />
                <div className="magazine-skeleton h-3 w-28 sm:w-36 rounded-sm opacity-40" />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── Bottom Progress Bar & Navigation Skeleton ── */}
      <footer className="border-t border-white/[0.06] bg-gradient-to-r from-[#0c0a09]/95 via-[#141210]/95 to-[#0c0a09]/95 backdrop-blur-xl flex flex-col justify-center shrink-0 gap-2 px-3 sm:px-6 py-2.5 sm:py-3">
        {/* Progress bar skeleton */}
        <div className="w-full h-0.5 bg-white/[0.06] rounded-full overflow-hidden">
          <div className="magazine-skeleton-progress h-full w-1/3 rounded-full" />
        </div>

        {/* Mobile: large prev/next touch buttons + page counter */}
        <div className="flex items-center justify-between gap-2 sm:hidden">
          <div className="magazine-skeleton h-12 w-[38%] rounded-xl" />
          <div className="magazine-skeleton h-6 w-14 rounded-full" />
          <div className="magazine-skeleton h-12 w-[38%] rounded-xl" />
        </div>

        {/* Desktop: dot indicators + slim buttons */}
        <div className="hidden sm:flex items-center justify-between">
          <div className="magazine-skeleton h-7 w-16 rounded-full" />
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
          <div className="magazine-skeleton h-7 w-16 rounded-full" />
        </div>
      </footer>
    </div>
  );
}
