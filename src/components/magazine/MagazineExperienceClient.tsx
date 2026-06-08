'use client';

import Link from "next/link";
import { ArrowRight, BookOpen, Eye, X, Layers, Palette, Sparkles, Monitor } from "lucide-react";
import { MagazineIssue } from "@/lib/magazine-service";
import { useState, useEffect } from "react";
import { MagazineExperienceSkeleton } from "./MagazineExperienceSkeleton";

interface MagazineExperienceClientProps {
  latestIssue: MagazineIssue;
}

export function MagazineExperienceClient({ latestIssue }: MagazineExperienceClientProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Small delay so the fade-in feels intentional
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  if (!mounted) {
    return <MagazineExperienceSkeleton />;
  }

  const displayDate = new Date(latestIssue.publishDate).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const imageVersion = Date.now().toString();

  return (
    <>
      <section
        className="relative overflow-hidden py-24 md:py-32"
        style={{
          background: 'linear-gradient(160deg, #0c0a09 0%, #1a0d14 45%, #0f0a0d 100%)',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(12px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}
      >
        {/* Ambient blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-[40rem] h-[40rem] rounded-full"
            style={{ background: 'radial-gradient(ellipse, rgba(139,31,63,0.18) 0%, transparent 65%)', filter: 'blur(80px)' }} />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full"
            style={{ background: 'radial-gradient(ellipse, rgba(201,149,106,0.14) 0%, transparent 65%)', filter: 'blur(80px)' }} />
        </div>

        {/* Grain overlay */}
        <div className="grain-overlay absolute inset-0 z-0" />

        {/* Vertical accent line */}
        <div className="absolute left-0 top-0 bottom-0 w-0.5 z-10"
          style={{ background: 'linear-gradient(to bottom, transparent, #c9956a 30%, #8b1f3f 70%, transparent)' }} />

        <div className="relative z-10 mx-auto max-w-7xl px-4 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-16">

            {/* Left: copy */}
            <div className="lg:w-1/2">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#c9956a]/30 bg-[#c9956a]/[0.08] text-[10px] font-bold uppercase tracking-[0.2em] text-[#c9956a] mb-7">
                <span className="w-1.5 h-1.5 rounded-full bg-[#c9956a] animate-pulse" />
                New Digital Experience
              </div>

              <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl font-medium mb-8 leading-tight text-white">
                The{' '}
                <span className="italic cover-gold-shimmer">Digital</span>
                {' '}Edition
              </h2>

              <p className="text-white/60 text-lg mb-10 leading-relaxed max-w-xl">
                Experience Yorkshire BusinessWoman online. Our interactive digital reader brings the physical magazine experience to your screen with smooth page-turning and high-resolution spreads.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href={`/magazine/issue/${latestIssue.id}`}
                  className="inline-flex items-center justify-center gap-2 h-14 px-8 font-semibold text-sm text-[#0c0a09] rounded-none hover:opacity-90 transition-opacity"
                  style={{ background: 'linear-gradient(135deg, #c9956a 0%, #a3413a 100%)' }}
                >
                  <BookOpen className="h-4 w-4" />
                  Launch Digital Edition
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/new-edition"
                  className="inline-flex items-center justify-center gap-2 h-14 px-8 font-medium text-sm text-white/80 border border-white/15 rounded-none hover:bg-white/[0.06] hover:border-white/25 transition-all"
                >
                  View Archive
                </Link>
                <button
                  onClick={() => setPreviewMode(true)}
                  className="inline-flex items-center justify-center gap-2 h-14 px-6 font-medium text-sm text-[#c9956a] border border-[#c9956a]/30 rounded-none hover:bg-[#c9956a]/[0.08] hover:border-[#c9956a]/50 transition-all"
                >
                  <Eye className="h-4 w-4" />
                  Design Preview
                </button>
              </div>
            </div>

            {/* Right: cover image */}
            <div className="lg:w-1/2 relative">
              {/* Glow behind cover */}
              <div className="absolute inset-0 rounded-none"
                style={{ background: 'radial-gradient(ellipse at center, rgba(201,149,106,0.25) 0%, transparent 70%)', filter: 'blur(40px)', transform: 'scale(1.2)' }} />

              <div className="relative z-10 aspect-[3/4] max-w-[380px] mx-auto overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.7)] ring-1 ring-white/[0.08]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${latestIssue.coverImage}${imageVersion ? `?v=${imageVersion}` : ''}`}
                  alt={latestIssue.title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                <div className="absolute inset-0 cover-shimmer-sweep pointer-events-none" />
              </div>

              {/* Floating info card */}
              <div className="absolute top-1/2 -right-6 xl:-right-10 -translate-y-1/2 hidden xl:block">
                <div className="bg-white/[0.06] backdrop-blur-xl border border-white/[0.1] p-5 rounded-none shadow-2xl">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#c9956a] animate-pulse" />
                    <span className="text-[9px] uppercase tracking-[0.2em] text-[#c9956a] font-bold">Interactive Edition</span>
                  </div>
                  <p className="text-sm font-semibold text-white">Real Spreads Sync</p>
                  <p className="text-xs text-white/40 mt-1">{displayDate}</p>
                </div>
              </div>

              {/* Decorative corner accent */}
              <div className="absolute -bottom-4 -left-4 w-20 h-20 border-l-2 border-b-2 border-[#c9956a]/30" />
              <div className="absolute -top-4 -right-4 w-20 h-20 border-r-2 border-t-2 border-[#c9956a]/30" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Design Preview Mode Overlay ── */}
      {previewMode && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-8"
          style={{ background: 'rgba(12,10,9,0.92)', backdropFilter: 'blur(20px)' }}
        >
          {/* Close button */}
          <button
            onClick={() => setPreviewMode(false)}
            className="absolute top-5 right-5 flex items-center justify-center h-10 w-10 rounded-full border border-white/15 text-white/60 hover:text-white hover:border-white/30 transition-all"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="w-full max-w-5xl">
            {/* Header */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#c9956a]/30 bg-[#c9956a]/[0.08] text-[10px] font-bold uppercase tracking-[0.2em] text-[#c9956a] mb-4">
                <Sparkles className="h-3 w-3" />
                Design Preview Mode
              </div>
              <h3 className="font-serif text-3xl md:text-4xl text-white mb-3">
                Digital Edition <span className="italic cover-gold-shimmer">Design System</span>
              </h3>
              <p className="text-white/50 text-sm max-w-lg mx-auto">
                A showcase of the visual language powering the Yorkshire BusinessWoman Digital Edition.
              </p>
            </div>

            {/* Design tokens grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">

              {/* Colour palette */}
              <div className="bg-white/[0.04] border border-white/[0.08] p-5 rounded-none">
                <div className="flex items-center gap-2 mb-4">
                  <Palette className="h-4 w-4 text-[#c9956a]" />
                  <span className="text-xs font-bold uppercase tracking-widest text-white/60">Colour Palette</span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {[
                    { hex: '#0c0a09', label: 'Obsidian' },
                    { hex: '#8b1f3f', label: 'Crimson' },
                    { hex: '#a3413a', label: 'Garnet' },
                    { hex: '#c9956a', label: 'Gold' },
                    { hex: '#e8c49a', label: 'Champagne' },
                  ].map(({ hex, label }) => (
                    <div key={hex} className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-sm ring-1 ring-white/10 shrink-0" style={{ background: hex }} />
                      <div>
                        <p className="text-xs font-medium text-white/80">{label}</p>
                        <p className="text-[10px] text-white/30 font-mono">{hex}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Typography */}
              <div className="bg-white/[0.04] border border-white/[0.08] p-5 rounded-none">
                <div className="flex items-center gap-2 mb-4">
                  <Layers className="h-4 w-4 text-[#c9956a]" />
                  <span className="text-xs font-bold uppercase tracking-widest text-white/60">Typography</span>
                </div>
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="font-serif text-2xl text-white leading-tight">The Digital</p>
                    <p className="font-serif text-2xl italic cover-gold-shimmer leading-tight">Edition</p>
                    <p className="text-[10px] text-white/30 mt-1 font-mono">Serif / Italic shimmer</p>
                  </div>
                  <div className="h-px bg-white/[0.06]" />
                  <div>
                    <p className="text-sm font-semibold text-white">Primary CTA</p>
                    <p className="text-xs text-white/50 mt-0.5">Semi-bold · 14px</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c9956a]">Badge Label</p>
                    <p className="text-[10px] text-white/30 mt-0.5 font-mono">10px · 0.2em tracking</p>
                  </div>
                  <div>
                    <p className="text-sm text-white/60 leading-relaxed">Body copy — white/60 for readability on dark backgrounds.</p>
                  </div>
                </div>
              </div>

              {/* UI Components */}
              <div className="bg-white/[0.04] border border-white/[0.08] p-5 rounded-none">
                <div className="flex items-center gap-2 mb-4">
                  <Monitor className="h-4 w-4 text-[#c9956a]" />
                  <span className="text-xs font-bold uppercase tracking-widest text-white/60">UI Components</span>
                </div>
                <div className="flex flex-col gap-3">
                  {/* Primary button */}
                  <div
                    className="inline-flex items-center justify-center gap-2 h-10 px-5 text-xs font-semibold text-[#0c0a09] rounded-none w-full"
                    style={{ background: 'linear-gradient(135deg, #c9956a 0%, #a3413a 100%)' }}
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    Primary Action
                  </div>
                  {/* Ghost button */}
                  <div className="inline-flex items-center justify-center gap-2 h-10 px-5 text-xs font-medium text-white/80 border border-white/15 rounded-none w-full">
                    Secondary Action
                  </div>
                  {/* Badge */}
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#c9956a]/30 bg-[#c9956a]/[0.08] text-[9px] font-bold uppercase tracking-[0.2em] text-[#c9956a] w-fit">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#c9956a] animate-pulse" />
                    Live Badge
                  </div>
                  {/* Accent line */}
                  <div className="h-px w-full" style={{ background: 'linear-gradient(to right, transparent, #c9956a, #8b1f3f, transparent)' }} />
                  {/* Shimmer skeleton */}
                  <div>
                    <p className="text-[10px] text-white/30 mb-1.5 font-mono">Skeleton shimmer</p>
                    <div className="magazine-skeleton h-3 w-full rounded-sm mb-1.5" />
                    <div className="magazine-skeleton h-3 w-4/5 rounded-sm mb-1.5" />
                    <div className="magazine-skeleton h-3 w-3/5 rounded-sm" />
                  </div>
                  {/* Progress bar */}
                  <div>
                    <p className="text-[10px] text-white/30 mb-1.5 font-mono">Progress bar</p>
                    <div className="w-full h-0.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div className="magazine-skeleton-progress h-full w-2/5 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer note */}
            <p className="text-center text-[11px] text-white/25 tracking-wide">
              Yorkshire BusinessWoman · Digital Edition Design System · {displayDate}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
