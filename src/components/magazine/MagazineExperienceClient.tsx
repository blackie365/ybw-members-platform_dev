'use client';

import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { MagazineIssue } from "@/lib/magazine-service";
import { useState, useEffect } from "react";
import { MagazineExperienceSkeleton } from "./MagazineExperienceSkeleton";

interface MagazineExperienceClientProps {
  latestIssue: MagazineIssue;
}

export function MagazineExperienceClient({ latestIssue }: MagazineExperienceClientProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [displayDate, setDisplayDate] = useState('');
  const [imageVersion, setImageVersion] = useState('');

  useEffect(() => {
    setMounted(true);
    setDisplayDate(new Date(latestIssue.publishDate).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }));
    setImageVersion(Date.now().toString());
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, [latestIssue.publishDate]);

  if (!mounted) {
    return <MagazineExperienceSkeleton />;
  }

  return (
    <section
      className="relative overflow-hidden"
      style={{
        background: '#0c0a09',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.8s ease',
        minHeight: '90vh',
      }}
    >
      {/* Full-bleed cover image */}
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${latestIssue.coverImage}${imageVersion ? `?v=${imageVersion}` : ''}`}
          alt={latestIssue.title}
          className="w-full h-full object-cover object-center"
          style={{ opacity: 0.45 }}
        />
        {/* Cinematic gradient layers */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0c0a09] via-[#0c0a09]/75 to-[#0c0a09]/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c0a09] via-transparent to-[#0c0a09]/40" />
      </div>

      {/* Grain texture */}
      <div className="grain-overlay absolute inset-0 z-[1]" />

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-end min-h-[90vh] pb-16 sm:pb-24 px-8 sm:px-14 lg:px-20">

        {/* Top label */}
        <div className="absolute top-10 left-8 sm:left-14 lg:left-20">
          <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-white/30">
            Digital Edition · {displayDate}
          </p>
        </div>

        {/* Main editorial copy */}
        <div className="max-w-2xl">
          <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-[#c9956a] mb-7">
            Now Reading
          </p>

          <h2 className="font-serif text-[clamp(2.5rem,6vw,5.5rem)] font-normal leading-[0.92] tracking-[-0.02em] text-white mb-8">
            {latestIssue.title || (
              <>
                The <em className="italic">Digital</em>
                <br />Edition
              </>
            )}
          </h2>

          {latestIssue.description && (
            <p className="text-white/45 text-base sm:text-lg font-light leading-relaxed max-w-lg mb-10">
              {latestIssue.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-5">
            <Link
              href={`/magazine/issue/${latestIssue.id}`}
              className="group inline-flex items-center gap-3 bg-white text-[#0c0a09] px-8 py-4 text-xs font-bold uppercase tracking-[0.18em] hover:bg-[#c9956a] hover:text-white transition-all duration-300"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Read the Edition
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/new-edition"
              className="inline-flex items-center gap-2 text-white/40 text-xs font-medium uppercase tracking-[0.18em] hover:text-white transition-colors border-b border-white/15 hover:border-white/50 pb-0.5"
            >
              View Archive
            </Link>
          </div>
        </div>

        {/* Cover thumbnail — bottom right */}
        <div className="absolute bottom-16 right-8 sm:right-14 lg:right-20 hidden lg:block">
          <Link href={`/magazine/issue/${latestIssue.id}`} className="group block">
            <div className="relative w-28 aspect-[3/4] overflow-hidden shadow-[0_16px_48px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.08] transition-transform duration-500 group-hover:scale-105">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${latestIssue.coverImage}${imageVersion ? `?v=${imageVersion}` : ''}`}
                alt={latestIssue.title}
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-white/25 mt-2 text-center">
              Current Issue
            </p>
          </Link>
        </div>
      </div>
    </section>
  );
}
