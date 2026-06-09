"use client";

import React, { useState, useEffect } from 'react';
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

export function HeroSection({ posts, recentPosts }: { posts: any[], recentPosts?: any[] }) {
  const [mounted, setMounted] = React.useState(false);
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, duration: 40 },
    [Autoplay({ delay: 6000, stopOnInteraction: false, stopOnMouseEnter: true })]
  );
  const [currentIndex, setCurrentIndex] = React.useState(0);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setCurrentIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi]);

  if (!mounted || !posts || posts.length === 0) {
    return (
      <div className="w-full h-[90vh] min-h-[640px] bg-zinc-950 animate-pulse flex">
        <div className="w-full lg:w-[45%] h-full bg-zinc-900" />
        <div className="hidden lg:block lg:w-[55%] h-full bg-zinc-800" />
      </div>
    );
  }

  const carouselPosts = posts.slice(0, 5);
  const latestArticles = recentPosts || posts.slice(0, 3);
  const current = carouselPosts[currentIndex];

  const scrollPrev = () => emblaApi?.scrollPrev();
  const scrollNext = () => emblaApi?.scrollNext();

  return (
    <section
      className="relative w-full overflow-hidden bg-zinc-950"
      style={{ minHeight: "640px", height: "90vh", maxHeight: "960px" }}
    >
      {/* ── SPREAD LEFT GRID ── */}
      <div className="absolute inset-0 flex flex-col lg:flex-row">

        {/* ── LEFT PANEL ── editorial content spread */}
        <div
          className="relative z-10 flex flex-col justify-between bg-zinc-950 px-8 py-10 lg:px-12 lg:py-14"
          style={{ flex: "0 0 100%", maxWidth: "100%" }}
        >
          {/* Mobile: full-width overlay image behind left panel */}
          <div className="absolute inset-0 lg:hidden">
            <Image
              src={current?.feature_image || "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1200&q=80"}
              alt={current?.title || "Featured article"}
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/90 via-zinc-950/80 to-zinc-950/95" />
          </div>

          {/* Desktop: constrain left panel width */}
          <div className="relative z-10 flex flex-col h-full lg:hidden">
            {/* Mobile layout */}
            <MobileContent
              current={current}
              carouselPosts={carouselPosts}
              currentIndex={currentIndex}
              latestArticles={latestArticles}
              scrollPrev={scrollPrev}
              scrollNext={scrollNext}
            />
          </div>
        </div>

        {/* ── DESKTOP LAYOUT ── */}
        <div className="hidden lg:flex absolute inset-0">
          {/* Left editorial panel */}
          <div
            className="relative z-10 flex flex-col justify-between bg-zinc-950 px-12 py-14"
            style={{ width: "44%", flexShrink: 0 }}
          >
            {/* Top: issue label + nav controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className="text-[9px] font-bold uppercase tracking-[0.35em] text-zinc-400"
                  style={{ letterSpacing: "0.35em" }}
                >
                  Yorkshire BusinessWoman
                </span>
                <span className="h-px w-8 bg-accent" />
                <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-accent">
                  {current?.primary_tag?.name || "Featured"}
                </span>
              </div>
              {/* Carousel nav */}
              <div className="flex items-center gap-2">
                <button
                  onClick={scrollPrev}
                  aria-label="Previous article"
                  className="flex h-8 w-8 items-center justify-center border border-zinc-700 text-zinc-400 transition-all hover:border-accent hover:text-accent"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={scrollNext}
                  aria-label="Next article"
                  className="flex h-8 w-8 items-center justify-center border border-zinc-700 text-zinc-400 transition-all hover:border-accent hover:text-accent"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Center: headline block */}
            <div className="flex flex-col gap-6 py-8">
              {/* Slide counter */}
              <div className="flex items-center gap-2">
                <span className="font-serif text-5xl font-medium text-white/10 leading-none select-none">
                  {String(currentIndex + 1).padStart(2, "0")}
                </span>
                <span className="text-zinc-600 text-lg">/</span>
                <span className="font-serif text-lg font-medium text-zinc-600 leading-none select-none">
                  {String(carouselPosts.length).padStart(2, "0")}
                </span>
              </div>

              {/* Headline */}
              <h1
                className="font-serif font-medium text-white leading-[1.05]"
                style={{ fontSize: "clamp(2rem, 3.2vw, 3.5rem)" }}
              >
                {current?.title}
              </h1>

              {/* Excerpt */}
              <p className="text-zinc-400 leading-relaxed line-clamp-3" style={{ fontSize: "0.9375rem" }}>
                {current?.custom_excerpt || current?.excerpt || ""}
              </p>

              {/* Meta + CTA row */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  href={`/news/${current?.slug}`}
                  className="group inline-flex items-center gap-3 bg-accent px-6 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-accent-foreground transition-all hover:opacity-90"
                >
                  Read Article
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  href="/new-edition"
                  className="group inline-flex items-center gap-3 border border-zinc-700 px-6 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-300 transition-all hover:border-zinc-400 hover:text-white"
                >
                  New Edition
                  <BookOpen className="h-3.5 w-3.5" />
                </Link>
                <span className="text-[10px] font-medium text-zinc-500 ml-auto">
                  {current?.reading_time ? `${current.reading_time} min read` : "5 min read"}
                </span>
              </div>
            </div>

            {/* Bottom: progress dots + latest articles */}
            <div className="flex flex-col gap-6">
              {/* Progress bar dots */}
              <div className="flex gap-1.5">
                {carouselPosts.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => emblaApi?.scrollTo(i)}
                    aria-label={`Go to slide ${i + 1}`}
                    className="relative h-0.5 flex-1 max-w-12 overflow-hidden bg-zinc-800 transition-all"
                  >
                    <span
                      className="absolute inset-y-0 left-0 bg-accent transition-all duration-500"
                      style={{ width: i === currentIndex ? "100%" : i < currentIndex ? "100%" : "0%" }}
                    />
                  </button>
                ))}
              </div>

              {/* Divider */}
              <div className="flex items-center gap-4">
                <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-zinc-500">
                  Latest Articles
                </span>
                <span className="flex-1 h-px bg-zinc-800" />
                <Link
                  href="/news"
                  className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 hover:text-accent transition-colors"
                >
                  View All
                </Link>
              </div>

              {/* Latest articles list */}
              <div className="flex flex-col gap-1">
                {latestArticles.slice(0, 3).map((article, i) => (
                  <LatestArticleRow
                    key={article.id}
                    article={article}
                    index={i}
                    isActive={i === currentIndex}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right: full-bleed image panel */}
          <div className="relative flex-1 overflow-hidden">
            {/* Carousel */}
            <div ref={emblaRef} className="absolute inset-0 overflow-hidden">
              <div className="flex h-full">
                {carouselPosts.map((post, i) => (
                  <div key={post.id} className="relative flex-none w-full h-full">
                    <Image
                      src={post.feature_image || "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1600&q=80"}
                      alt={post.title}
                      fill
                      className="object-cover"
                      priority={i === 0}
                    />
                    {/* Subtle left-edge fade into the dark panel */}
                    <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/60 via-transparent to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/40 via-transparent to-transparent" />
                  </div>
                ))}
              </div>
            </div>

            {/* Tag badge on image */}
            <div className="absolute top-8 right-8 z-10">
              <span className="bg-accent px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.25em] text-accent-foreground">
                {current?.primary_tag?.name || "Featured"}
              </span>
            </div>

            {/* Vertical issue number watermark */}
            <div
              className="absolute bottom-12 right-6 z-10 select-none"
              style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
            >
              <span className="font-serif text-[80px] font-bold text-white/5 leading-none">
                {String(currentIndex + 1).padStart(2, "0")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Mobile Content ── */
function MobileContent({
  current,
  carouselPosts,
  currentIndex,
  latestArticles,
  scrollPrev,
  scrollNext,
}: {
  current: any;
  carouselPosts: any[];
  currentIndex: number;
  latestArticles: any[];
  scrollPrev: () => void;
  scrollNext: () => void;
}) {
  return (
    <div className="flex flex-col h-full justify-between">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-zinc-400">
          Yorkshire BusinessWoman
        </span>
        <div className="flex gap-2">
          <button onClick={scrollPrev} aria-label="Previous" className="flex h-7 w-7 items-center justify-center border border-zinc-700 text-zinc-400">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button onClick={scrollNext} aria-label="Next" className="flex h-7 w-7 items-center justify-center border border-zinc-700 text-zinc-400">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Headline */}
      <div className="flex flex-col gap-4 py-6">
        <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-accent">
          {current?.primary_tag?.name || "Featured"}
        </span>
        <h1 className="font-serif text-3xl font-medium text-white leading-[1.1]">
          {current?.title}
        </h1>
        <p className="text-zinc-400 text-sm leading-relaxed line-clamp-2">
          {current?.custom_excerpt || current?.excerpt || ""}
        </p>
        <div className="flex gap-3 pt-2">
          <Link
            href={`/news/${current?.slug}`}
            className="inline-flex items-center gap-2 bg-accent px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-accent-foreground"
          >
            Read Article <ArrowRight className="h-3 w-3" />
          </Link>
          <Link
            href="/new-edition"
            className="inline-flex items-center gap-2 border border-zinc-700 px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-300"
          >
            New Edition
          </Link>
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1.5 mb-4">
        {carouselPosts.map((_, i) => (
          <span
            key={i}
            className="h-0.5 flex-1 max-w-10"
            style={{ background: i === currentIndex ? "var(--accent)" : "rgba(255,255,255,0.15)" }}
          />
        ))}
      </div>

      {/* Latest articles */}
      <div className="flex flex-col gap-1 border-t border-zinc-800 pt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-zinc-500">Latest</span>
          <Link href="/news" className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 hover:text-accent transition-colors">View All</Link>
        </div>
        {latestArticles.slice(0, 2).map((article, i) => (
          <LatestArticleRow key={article.id} article={article} index={i} isActive={i === currentIndex} />
        ))}
      </div>
    </div>
  );
}

/* ── Latest Article Row ── */
function LatestArticleRow({
  article,
  index,
  isActive,
}: {
  article: any;
  index: number;
  isActive: boolean;
}) {
  return (
    <Link
      href={`/news/${article.slug}`}
      className={`group flex items-start gap-4 px-3 py-3 transition-all ${
        isActive ? "bg-white/5 border-l-2 border-accent" : "border-l-2 border-transparent hover:bg-white/[0.03] hover:border-zinc-700"
      }`}
    >
      {/* Thumbnail */}
      {article.feature_image && (
        <div className="relative flex-shrink-0 w-14 h-10 overflow-hidden bg-zinc-800">
          <Image
            src={article.feature_image}
            alt={article.title}
            fill
            className="object-cover opacity-80 group-hover:opacity-100 transition-opacity"
          />
        </div>
      )}

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-accent">
            {article.primary_tag?.name || "News"}
          </span>
          <span className="text-[8px] text-zinc-600">
            {article.reading_time ? `${article.reading_time} min` : "5 min"}
          </span>
        </div>
        <h3
          className={`font-serif text-[13px] font-medium leading-snug line-clamp-2 transition-colors ${
            isActive ? "text-white" : "text-zinc-400 group-hover:text-zinc-200"
          }`}
        >
          {article.title}
        </h3>
      </div>

      {/* Arrow */}
      <ArrowRight
        className={`flex-shrink-0 self-center h-3.5 w-3.5 transition-all ${
          isActive ? "text-accent opacity-100" : "text-zinc-600 opacity-0 group-hover:opacity-100"
        }`}
      />
    </Link>
  );
}
