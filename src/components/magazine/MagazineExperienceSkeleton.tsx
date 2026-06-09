'use client';

import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export function MagazineExperienceSkeleton() {
  const [fading, setFading] = useState(false);
  const [coverExpanded, setCoverExpanded] = useState(false);

  // When this component is about to be unmounted (parent swaps it out),
  // we can't intercept that directly — but we expose a CSS class so the
  // parent can trigger the fade via the `data-fading` attribute pattern.
  // The actual fade-out is driven by the parent's opacity transition.
  useEffect(() => {
    return () => {
      setFading(true);
    };
  }, []);

  return (
    <section
      className="relative overflow-hidden py-16 sm:py-24 md:py-32"
      style={{
        background: 'linear-gradient(160deg, #0c0a09 0%, #1a0d14 45%, #0f0a0d 100%)',
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.4s ease',
      }}
    >
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute top-0 left-1/4 w-[40rem] h-[40rem] rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(163,65,58,0.18) 0%, transparent 65%)', filter: 'blur(80px)' }}
        />
        <div
          className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(201,149,106,0.14) 0%, transparent 65%)', filter: 'blur(80px)' }}
        />
      </div>

      {/* Grain overlay */}
      <div className="grain-overlay absolute inset-0 z-0" />

      {/* Vertical accent line */}
      <div
        className="absolute left-0 top-0 bottom-0 w-0.5 z-10"
        style={{ background: 'linear-gradient(to bottom, transparent, #c9956a 30%, #a3413a 70%, transparent)' }}
      />

      <div className="relative z-10 mx-auto max-w-7xl px-4 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">

          {/* Left: copy skeleton */}
          <div className="lg:w-1/2 flex flex-col gap-4 sm:gap-5 w-full">
            {/* Badge skeleton */}
            <div className="magazine-skeleton h-7 w-40 sm:w-48 rounded-full" />

            {/* Heading skeleton */}
            <div className="flex flex-col gap-2 sm:gap-3 mt-1 sm:mt-2">
              <div className="magazine-skeleton h-9 sm:h-12 md:h-14 w-56 sm:w-72 rounded-sm" />
              <div className="magazine-skeleton h-9 sm:h-12 md:h-14 w-44 sm:w-56 rounded-sm" />
            </div>

            {/* Body text skeleton */}
            <div className="flex flex-col gap-2 mt-1 sm:mt-2">
              <div className="magazine-skeleton h-4 w-full max-w-xl rounded-sm" />
              <div className="magazine-skeleton h-4 w-5/6 max-w-xl rounded-sm" />
              <div className="magazine-skeleton h-4 w-4/6 max-w-xl rounded-sm" />
            </div>

            {/* CTA buttons skeleton — stacked on mobile, row on sm+ */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-3 sm:mt-4">
              <div className="magazine-skeleton h-14 w-full sm:w-56 rounded-none" />
              <div className="magazine-skeleton h-12 sm:h-14 w-full sm:w-36 rounded-none opacity-60" />
              <div className="magazine-skeleton h-12 sm:h-14 w-full sm:w-36 rounded-none opacity-40" />
            </div>
          </div>

          {/* Right: cover image skeleton — collapsible on mobile */}
          <div className="lg:w-1/2 relative w-full">
            {/* Mobile collapsible toggle */}
            <button
              className="flex lg:hidden items-center justify-between w-full py-3 px-1 text-left mb-3 border-b border-white/[0.08]"
              onClick={() => setCoverExpanded(prev => !prev)}
              aria-expanded={coverExpanded}
            >
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c9956a]">Cover Preview</span>
              <ChevronDown
                className="h-4 w-4 text-[#c9956a] transition-transform duration-300"
                style={{ transform: coverExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
            </button>

            {/* Cover image — always visible on lg, collapsible on mobile */}
            <div
              className={`lg:block transition-all duration-500 overflow-hidden ${
                coverExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0 lg:max-h-none lg:opacity-100'
              }`}
            >
              {/* Glow behind cover */}
              <div
                className="absolute inset-0 rounded-none"
                style={{ background: 'radial-gradient(ellipse at center, rgba(201,149,106,0.25) 0%, transparent 70%)', filter: 'blur(40px)', transform: 'scale(1.2)' }}
              />

              <div className="relative z-10 aspect-[3/4] max-w-[280px] sm:max-w-[380px] mx-auto overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.7)] ring-1 ring-white/[0.08]">
                <div className="magazine-skeleton absolute inset-0 w-full h-full" />
                <div className="absolute inset-0 cover-shimmer-sweep pointer-events-none" />
              </div>

              {/* Floating info card skeleton */}
              <div className="absolute top-1/2 -right-6 xl:-right-10 -translate-y-1/2 hidden xl:block">
                <div className="bg-white/[0.06] backdrop-blur-xl border border-white/[0.1] p-5 rounded-none shadow-2xl">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="magazine-skeleton h-1.5 w-1.5 rounded-full" />
                    <div className="magazine-skeleton h-2.5 w-24 rounded-sm" />
                  </div>
                  <div className="magazine-skeleton h-4 w-32 rounded-sm mb-2" />
                  <div className="magazine-skeleton h-3 w-20 rounded-sm opacity-60" />
                </div>
              </div>

              {/* Decorative corner accents */}
              <div className="absolute -bottom-4 -left-4 w-16 sm:w-20 h-16 sm:h-20 border-l-2 border-b-2 border-[#c9956a]/30" />
              <div className="absolute -top-4 -right-4 w-16 sm:w-20 h-16 sm:h-20 border-r-2 border-t-2 border-[#c9956a]/30" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
