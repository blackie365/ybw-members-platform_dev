'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Menu, 
  Download, 
  Share2, 
  Quote, 
  Star,
  Award,
  Users,
  ArrowRight,
  Linkedin,
  Twitter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Logo } from '@/components/Logo';
import { MagazinePage, MagazineIssue } from '@/lib/magazine-service';

interface MagazineReaderProps {
  issue: MagazineIssue;
  pages: MagazinePage[];
  id: string;
}

export default function MagazineReader({ issue, pages, id }: MagazineReaderProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [direction, setDirection] = useState(0);
  const [imageVersion, setImageVersion] = useState<string>('');

  useEffect(() => {
    setImageVersion(Date.now().toString());
  }, []);

  const nextPage = useCallback(() => {
    if (currentPage < pages.length - 1) {
      setDirection(1);
      setCurrentPage(prev => prev + 1);
    }
  }, [currentPage, pages.length]);

  const prevPage = useCallback(() => {
    if (currentPage > 0) {
      setDirection(-1);
      setCurrentPage(prev => prev - 1);
    }
  }, [currentPage]);

  const goToPage = (index: number) => {
    setDirection(index > currentPage ? 1 : -1);
    setCurrentPage(index);
    setIsNavOpen(false);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') nextPage();
      if (e.key === 'ArrowLeft') prevPage();
      if (e.key === 'Escape') setIsNavOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextPage, prevPage]);

  const variants: any = {
    enter: (direction: number) => ({
      x: direction > 0 ? '100%' : '-100%',
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      transition: {
        x: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.3 },
      }
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? '100%' : '-100%',
      opacity: 0,
      transition: {
        x: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.2 },
      }
    })
  };

  return (
    <div className="fixed inset-0 h-[100dvh] bg-background text-foreground flex flex-col z-[100] overflow-hidden select-none">
      
      {/* Top Control Bar */}
      <header className="h-14 sm:h-16 border-b border-border/60 flex items-center justify-between px-4 sm:px-6 bg-background/95 backdrop-blur-md z-50 shrink-0">
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/new-edition" className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5 sm:h-6 sm:w-6" />
          </Link>
          <div className="h-6 w-px bg-border mx-1 sm:mx-2" />
          <div className="flex items-center gap-2 sm:gap-3">
            <Logo className="h-5 sm:h-6" />
            <span className="text-accent hidden sm:block">|</span>
            <p className="text-[10px] sm:text-xs font-semibold tracking-[0.15em] uppercase text-accent truncate max-w-[100px] sm:max-w-none">
              {(pages[currentPage]?.content as any)?.date || issue?.title || "Edition"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <Badge variant="outline" className="border-border text-muted-foreground font-mono text-[9px] sm:text-xs px-2 py-0.5 bg-transparent rounded-none">
            {currentPage + 1} / {pages.length}
          </Badge>
          <div className="h-6 w-px bg-border mx-1 sm:mx-2" />
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground hover:bg-muted h-8 w-8 sm:h-10 sm:w-10">
            <Share2 className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground hover:bg-muted h-8 w-8 sm:h-10 sm:w-10">
            <Download className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-muted-foreground hover:text-foreground hover:bg-muted lg:hidden h-8 w-8"
            onClick={() => setIsNavOpen(!isNavOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main Reader Stage */}
      <main className="flex-1 relative flex items-center justify-center overflow-hidden touch-none bg-muted/50">
        
        {/* Navigation Arrows (Desktop) */}
        <button 
          onClick={prevPage}
          disabled={currentPage === 0}
          className="absolute left-4 lg:left-8 z-40 h-12 w-12 rounded-full bg-background border border-border flex items-center justify-center hover:bg-muted hover:border-accent transition-all disabled:opacity-0 disabled:pointer-events-none hidden lg:flex shadow-sm"
        >
          <ChevronLeft className="h-5 w-5 text-muted-foreground" />
        </button>

        <button 
          onClick={nextPage}
          disabled={currentPage === pages.length - 1}
          className="absolute right-4 lg:right-8 z-40 h-12 w-12 rounded-full bg-background border border-border flex items-center justify-center hover:bg-muted hover:border-accent transition-all disabled:opacity-0 disabled:pointer-events-none hidden lg:flex shadow-sm"
        >
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </button>

        {/* Page Viewport */}
        <div className="relative w-full h-full max-w-6xl mx-auto overflow-hidden shadow-xl bg-background">
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
                key={currentPage}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={(_, info) => {
                  if (info.offset.x > 100) prevPage();
                  else if (info.offset.x < -100) nextPage();
                }}
                className="absolute inset-0 w-full h-full will-change-transform"
              >
                {renderPage(pages[currentPage], imageVersion)}
              </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Footer Progress Bar */}
      <footer className="h-14 sm:h-16 bg-background border-t border-border/60 px-4 sm:px-6 flex items-center gap-4 sm:gap-6 z-50 shrink-0">
        {/* Progress track */}
        <div className="flex-1 flex items-center gap-1">
          {pages.map((_, i) => (
            <button 
              key={i} 
              onClick={() => goToPage(i)}
              className={`h-1 flex-1 transition-all duration-300 ${
                i <= currentPage ? 'bg-accent' : 'bg-border hover:bg-muted-foreground/30'
              }`}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={prevPage} 
            disabled={currentPage === 0} 
            variant="ghost" 
            size="sm" 
            className="text-muted-foreground hover:text-foreground hover:bg-muted h-8 text-[10px] font-bold uppercase tracking-widest disabled:opacity-30"
          >
            Prev
          </Button>
          <Button 
            onClick={nextPage} 
            disabled={currentPage === pages.length - 1} 
            size="sm" 
            className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-none h-8 text-[10px] font-bold uppercase tracking-widest disabled:opacity-30"
          >
            Next
          </Button>
        </div>
      </footer>

      {/* Sidebar Navigation */}
      <AnimatePresence>
        {isNavOpen && (
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-80 bg-background z-[60] border-l border-border shadow-2xl"
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-6 border-b border-border">
                <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-foreground">Contents</h3>
                <Button variant="ghost" size="icon" onClick={() => setIsNavOpen(false)} className="hover:bg-muted">
                  <X className="h-5 w-5 text-muted-foreground" />
                </Button>
              </div>
              <nav className="flex-1 overflow-y-auto p-6 space-y-1">
                {pages.map((page, i) => (
                  <button
                    key={page.id}
                    onClick={() => goToPage(i)}
                    className={`w-full text-left flex items-center gap-4 p-3 rounded-sm transition-all ${
                      currentPage === i 
                        ? 'bg-accent/10 text-accent' 
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <span className="text-[10px] font-mono w-5">{String(i + 1).padStart(2, '0')}</span>
                    <span className="text-xs font-semibold uppercase tracking-wider flex-1">{page.type.replace('-', ' ')}</span>
                    {currentPage === i && <div className="h-1.5 w-1.5 rounded-full bg-accent" />}
                  </button>
                ))}
              </nav>
              <div className="p-6 border-t border-border bg-muted/30">
                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-bold mb-2">This Edition</p>
                <h4 className="text-base font-serif mb-4 text-foreground">{issue?.title || "Current Issue"}</h4>
                <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90 rounded-none text-[10px] font-bold uppercase tracking-widest" asChild>
                  <Link href="/membership">Become a Member</Link>
                </Button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- PAGE RENDERER ---

function renderPage(page: any, imageVersion: string) {
  switch (page.type) {
    case 'cover':
      return <PageCover data={page.content} imageVersion={imageVersion} />;
    case 'editorial':
      return <PageEditorial data={page.content} imageVersion={imageVersion} />;
    case 'contents':
      return <PageContents data={page.content} />;
    case 'feature-left':
      return <PageFeatureLeft data={page.content} imageVersion={imageVersion} />;
    case 'feature-right':
      return <PageFeatureRight data={page.content} imageVersion={imageVersion} />;
    case 'column':
      return <PageColumn data={page.content} imageVersion={imageVersion} />;
    case 'lifestyle':
      return <PageLifestyle data={page.content} imageVersion={imageVersion} />;
    case 'spotlight':
      return <PageSpotlight data={page.content} imageVersion={imageVersion} />;
    case 'partner':
      return <PagePartner data={page.content} imageVersion={imageVersion} />;
    case 'back-cover':
      return <PageBackCover data={page.content} imageVersion={imageVersion} />;
    default:
      return <div className="h-full w-full flex items-center justify-center bg-background text-muted-foreground">Page coming soon...</div>;
  }
}

// ============================================
// COVER PAGE - Cinematic, full-bleed hero
// ============================================
const PageCover = ({ data, imageVersion }: any) => (
  <div className="h-full w-full relative overflow-hidden bg-primary">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={`${data.image}?v=${imageVersion}`} alt="Cover" className="absolute inset-0 w-full h-full object-cover" />
    <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
    
    {/* Masthead */}
    <div className="absolute top-8 sm:top-12 left-0 right-0 text-center">
      <p className="text-white/60 text-[10px] sm:text-xs tracking-[0.3em] uppercase mb-2 font-medium">{data.date}</p>
      <h2 className="text-white font-serif text-3xl sm:text-5xl lg:text-6xl font-medium tracking-tight">
        Yorkshire<br />
        <span className="italic">BusinessWoman</span>
      </h2>
      <div className="h-px w-16 sm:w-20 bg-accent mx-auto mt-4" />
    </div>

    {/* Issue Badge */}
    <div className="absolute top-8 sm:top-12 right-6 sm:right-12">
      <div className="h-14 w-14 sm:h-16 sm:w-16 bg-accent flex items-center justify-center">
        <span className="text-accent-foreground font-serif text-lg sm:text-xl font-medium">{data.issue?.replace(/[^0-9]/g, '') || '01'}</span>
      </div>
    </div>

    {/* Main Content */}
    <div className="absolute bottom-8 sm:bottom-16 left-6 sm:left-12 right-6 sm:right-12 max-w-3xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        <span className="inline-block bg-accent px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-accent-foreground mb-4 sm:mb-6">
          {data.badge || 'Featured'}
        </span>
        <h1 className="text-white text-2xl sm:text-4xl lg:text-5xl font-serif font-medium leading-[1.1] mb-4">
          {data.headline}
        </h1>
        <p className="text-white/70 text-sm sm:text-base max-w-xl leading-relaxed line-clamp-2 sm:line-clamp-3">
          {data.subheadline}
        </p>
      </motion.div>
    </div>
  </div>
);

// ============================================
// EDITORIAL PAGE - Editor's note with portrait
// ============================================
const PageEditorial = ({ data, imageVersion }: any) => (
  <div className="h-full w-full flex flex-col lg:flex-row bg-background overflow-hidden">
    {/* Portrait side */}
    <div className="lg:w-2/5 h-48 sm:h-64 lg:h-full relative bg-muted shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${data.image}?v=${imageVersion}`} alt={data.author} className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-black/10" />
      
      {/* Author info overlay on mobile */}
      <div className="absolute bottom-4 left-4 lg:hidden">
        <p className="text-white font-serif text-lg">{data.author}</p>
        <p className="text-white/70 text-xs uppercase tracking-wider">{data.role}</p>
      </div>
    </div>
    
    {/* Content side */}
    <div className="lg:w-3/5 p-6 sm:p-10 lg:p-12 flex flex-col justify-center overflow-hidden">
      <p className="text-accent text-[10px] tracking-[0.2em] uppercase font-bold mb-3">Editor&apos;s Note</p>
      <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif mb-6 tracking-tight text-foreground leading-tight">{data.title}</h2>
      
      <div className="space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
        <p className="first-letter:text-4xl first-letter:font-serif first-letter:text-accent first-letter:float-left first-letter:mr-2 first-letter:leading-[0.85] line-clamp-4 lg:line-clamp-none">
          {data.text}
        </p>
        {data.quote && (
          <blockquote className="border-l-2 border-accent pl-5 py-1 italic text-foreground font-serif text-base sm:text-lg line-clamp-2 lg:line-clamp-none">
            &quot;{data.quote}&quot;
          </blockquote>
        )}
      </div>
      
      {/* Author info on desktop */}
      <div className="hidden lg:flex items-center gap-4 mt-8 pt-6 border-t border-border">
        <div className="h-12 w-12 rounded-full overflow-hidden bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${data.image}?v=${imageVersion}`} alt={data.author} className="h-full w-full object-cover" />
        </div>
        <div>
          <p className="font-medium text-foreground">{data.author}</p>
          <p className="text-sm text-muted-foreground">{data.role}</p>
        </div>
      </div>
    </div>
  </div>
);

// ============================================
// CONTENTS PAGE - Clean index layout
// ============================================
const PageContents = ({ data }: any) => (
  <div className="h-full w-full p-6 sm:p-10 lg:p-16 flex flex-col lg:flex-row gap-8 lg:gap-16 bg-background overflow-hidden">
    {/* Main contents */}
    <div className="lg:w-3/5 flex flex-col justify-center">
      <p className="text-accent text-[10px] tracking-[0.2em] uppercase font-bold mb-2">Contents</p>
      <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif mb-8 lg:mb-12 tracking-tight text-foreground">In This Issue</h2>
      
      <div className="space-y-0 border-t border-border">
        {data.items?.slice(0, 6).map((item: any, i: number) => (
          <div key={i} className="flex items-center gap-4 py-3 sm:py-4 border-b border-border group cursor-pointer hover:bg-muted/50 -mx-4 px-4 transition-colors">
            <span className="text-accent font-mono text-sm sm:text-base w-8">{item.page}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-0.5">{item.category}</p>
              <p className="text-sm sm:text-base font-medium text-foreground group-hover:text-accent transition-colors truncate">{item.title}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-accent group-hover:translate-x-1 transition-all shrink-0" />
          </div>
        ))}
      </div>
    </div>
    
    {/* Sidebar */}
    <div className="lg:w-2/5 flex flex-col justify-center">
      <div className="bg-muted p-6 sm:p-8 rounded-lg">
        <p className="text-accent text-[10px] tracking-[0.2em] uppercase font-bold mb-4">Regional Highlights</p>
        <div className="space-y-3">
          {data.news?.slice(0, 4).map((n: any, i: number) => (
            <div key={i} className="flex gap-3 items-start">
              <div className="h-1.5 w-1.5 rounded-full bg-accent mt-2 shrink-0" />
              <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{n}</p>
            </div>
          ))}
        </div>
        
        <div className="mt-6 pt-6 border-t border-border">
          <p className="text-[10px] uppercase tracking-[0.15em] font-bold text-muted-foreground mb-3">Connect With Us</p>
          <div className="flex gap-3">
            <Star className="h-5 w-5 text-accent hover:scale-110 transition-transform cursor-pointer" />
            <Award className="h-5 w-5 text-accent hover:scale-110 transition-transform cursor-pointer" />
            <Users className="h-5 w-5 text-accent hover:scale-110 transition-transform cursor-pointer" />
          </div>
        </div>
      </div>
    </div>
  </div>
);

// ============================================
// FEATURE LEFT - Image dominant with text overlay
// ============================================
const PageFeatureLeft = ({ data, imageVersion }: any) => (
  <div className="h-full w-full flex flex-col lg:flex-row bg-background overflow-hidden">
    {/* Image - 60% on desktop */}
    <div className="lg:w-3/5 h-48 sm:h-64 lg:h-full relative shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${data.image}?v=${imageVersion}`} alt={data.name} className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-black/20" />
      
      {/* Floating caption */}
      <div className="absolute bottom-4 left-4 right-4 lg:bottom-8 lg:left-8 lg:right-auto lg:max-w-xs">
        <div className="bg-background/95 backdrop-blur-sm p-4 shadow-lg">
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-bold">{data.title}</p>
        </div>
      </div>
    </div>
    
    {/* Content - 40% on desktop */}
    <div className="lg:w-2/5 p-6 sm:p-8 lg:p-10 flex flex-col justify-center overflow-hidden">
      <span className="inline-block border border-accent text-accent text-[10px] uppercase tracking-[0.15em] font-bold px-3 py-1 mb-4 w-fit">
        Cover Feature
      </span>
      <h3 className="text-2xl sm:text-3xl lg:text-4xl font-serif mb-4 text-foreground leading-tight">{data.name}</h3>
      
      <div className="border-l-2 border-accent pl-4 mb-6">
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed italic font-serif line-clamp-4">
          {data.intro}
        </p>
      </div>
      
      <div className="flex items-center gap-3 mt-auto">
        <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center">
          <span className="text-accent-foreground font-serif text-sm">YB</span>
        </div>
        <div>
          <p className="text-xs font-medium text-foreground">Yorkshire BusinessWoman</p>
          <p className="text-[10px] text-muted-foreground">Exclusive Interview</p>
        </div>
      </div>
    </div>
  </div>
);

// ============================================
// FEATURE RIGHT - Quote focus with stats
// ============================================
const PageFeatureRight = ({ data, imageVersion }: any) => (
  <div className="h-full w-full relative overflow-hidden p-6 sm:p-10 lg:p-16 flex flex-col justify-center bg-background">
    {data.image && (
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${data.image}?v=${imageVersion}`} alt="Background" className="absolute inset-0 w-full h-full object-cover opacity-5" />
      </div>
    )}
    <div className="relative z-10 max-w-4xl mx-auto">
      <Quote className="h-8 w-8 lg:h-10 lg:w-10 text-accent/30 mb-4" />
      <h2 className="text-xl sm:text-2xl lg:text-3xl font-serif italic text-foreground leading-tight mb-6 lg:mb-8 line-clamp-3">
        &quot;{data.quote}&quot;
      </h2>
      <div className="grid lg:grid-cols-2 gap-6 lg:gap-10 items-start">
        <div className="text-sm sm:text-base text-muted-foreground leading-relaxed">
          <p className="line-clamp-6">{data.text}</p>
        </div>
        <div className="bg-muted p-5 lg:p-6 rounded-lg">
          <p className="text-[10px] uppercase tracking-[0.15em] font-bold text-accent mb-4">Key Numbers</p>
          <div className="space-y-4">
            {data.stats?.slice(0, 3).map((stat: any, i: number) => (
              <div key={i} className="flex justify-between items-end border-b border-border pb-2">
                <span className="text-muted-foreground uppercase tracking-wider text-[10px]">{stat.label}</span>
                <span className="text-xl lg:text-2xl font-serif text-accent">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

// ============================================
// COLUMN PAGE - Expert opinion piece
// ============================================
const PageColumn = ({ data, imageVersion }: any) => (
  <div className="h-full w-full relative overflow-hidden bg-primary">
    {data.image && (
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${data.image}?v=${imageVersion}`} alt={data.title} className="absolute inset-0 w-full h-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary/70 to-primary/50" />
      </div>
    )}
    <div className="relative z-10 h-full p-6 sm:p-10 lg:p-16 flex flex-col lg:flex-row gap-6 lg:gap-12">
      <div className="lg:w-2/3 flex flex-col justify-center">
        <p className="text-accent text-[10px] tracking-[0.2em] uppercase font-bold mb-3">{data.category}</p>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif mb-6 tracking-tight text-primary-foreground leading-tight">{data.title}</h2>
        <div className="text-sm sm:text-base text-primary-foreground/80 leading-relaxed space-y-4">
          <p className="line-clamp-6 lg:line-clamp-none">{data.text}</p>
        </div>
        <div className="mt-6 pt-6 border-t border-primary-foreground/20">
          <p className="font-serif italic text-lg text-primary-foreground">By {data.author}</p>
        </div>
      </div>
      
      {data.tips && data.tips.length > 0 && (
        <div className="lg:w-1/3 flex items-center">
          <div className="bg-primary-foreground/10 backdrop-blur-sm p-5 lg:p-6 rounded-lg w-full">
            <p className="text-[10px] uppercase tracking-[0.15em] text-accent font-bold mb-4">Key Takeaways</p>
            <ul className="space-y-3">
              {data.tips?.slice(0, 4).map((tip: any, i: number) => (
                <li key={i} className="flex gap-2 items-start">
                  <div className="h-1.5 w-1.5 rounded-full bg-accent mt-2 shrink-0" />
                  <p className="text-sm text-primary-foreground/80 line-clamp-2">{tip}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  </div>
);

// ============================================
// LIFESTYLE PAGE - Visual storytelling
// ============================================
const PageLifestyle = ({ data, imageVersion }: any) => (
  <div className="h-full w-full relative overflow-hidden bg-background">
    <div className="absolute top-0 right-0 w-full lg:w-1/2 h-1/3 lg:h-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${data.image}?v=${imageVersion}`} alt={data.title} className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b lg:bg-gradient-to-r from-background via-background/60 to-transparent" />
    </div>
    <div className="relative h-full p-6 sm:p-10 lg:p-16 flex flex-col justify-center z-10">
      <div className="max-w-lg">
        <p className="text-accent text-[10px] tracking-[0.2em] uppercase font-bold mb-3">Lifestyle</p>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif mb-6 tracking-tight text-foreground leading-tight">
          The Art of<br /><span className="italic text-accent">Balance</span>
        </h2>
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-8 line-clamp-4 lg:line-clamp-none">
          {data.text}
        </p>
        <div className="space-y-2">
          {data.highlights?.slice(0, 4).map((h: any, i: number) => (
            <div key={i} className="flex items-center gap-4 group cursor-pointer">
              <div className="h-px w-6 bg-border group-hover:w-10 group-hover:bg-accent transition-all duration-300" />
              <p className="text-[10px] sm:text-xs uppercase tracking-[0.15em] text-muted-foreground group-hover:text-accent transition-colors">{h}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// ============================================
// SPOTLIGHT PAGE - Member profile
// ============================================
const PageSpotlight = ({ data, imageVersion }: any) => (
  <div className="h-full w-full p-6 sm:p-10 lg:p-16 bg-background flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12 overflow-hidden">
    {/* Portrait */}
    <div className="relative w-full max-w-[240px] lg:max-w-[320px] shrink-0">
      <div className="aspect-[3/4] relative overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${data.image}?v=${imageVersion}`} alt={data.name} className="absolute inset-0 w-full h-full object-cover" />
      </div>
      {/* Decorative accent */}
      <div className="absolute -bottom-2 -right-2 h-full w-full border-2 border-accent -z-10" />
    </div>
    
    {/* Content */}
    <div className="text-center lg:text-left flex-1 max-w-md">
      <p className="text-accent text-[10px] tracking-[0.2em] uppercase font-bold mb-3">Member Spotlight</p>
      <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif mb-1 text-foreground">{data.name}</h2>
      <p className="text-sm text-accent mb-4">{data.role}</p>
      
      {/* Social Links */}
      <div className="flex justify-center lg:justify-start gap-2 mb-6">
        <a href="#" className="h-9 w-9 border border-border flex items-center justify-center hover:border-accent hover:text-accent transition-colors text-muted-foreground">
          <Linkedin className="h-4 w-4" />
        </a>
        <a href="#" className="h-9 w-9 border border-border flex items-center justify-center hover:border-accent hover:text-accent transition-colors text-muted-foreground">
          <Twitter className="h-4 w-4" />
        </a>
      </div>
      
      {/* Quote */}
      <div className="bg-muted p-4 lg:p-5 rounded-sm mb-4">
        <Quote className="h-4 w-4 text-accent/40 mb-2" />
        <p className="text-sm text-muted-foreground leading-relaxed italic line-clamp-3">
          &quot;{data.message}&quot;
        </p>
      </div>
      
      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-4">
        {data.bio}
      </p>
      
      <Button className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-none px-6 text-[10px] font-bold uppercase tracking-widest">
        Read Full Profile
      </Button>
    </div>
  </div>
);

// ============================================
// PARTNER PAGE - Sponsor feature
// ============================================
const PagePartner = ({ data, imageVersion }: any) => (
  <div className="h-full w-full flex flex-col lg:flex-row bg-background overflow-hidden">
    <div className="lg:w-1/2 h-48 sm:h-64 lg:h-full relative shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${data.image}?v=${imageVersion}`} alt={data.name} className="absolute inset-0 w-full h-full object-cover" />
    </div>
    <div className="lg:w-1/2 p-6 sm:p-10 lg:p-12 flex flex-col justify-center">
      <span className="inline-block bg-muted text-muted-foreground text-[10px] uppercase tracking-[0.15em] font-bold px-3 py-1 mb-4 w-fit">
        Partner Feature
      </span>
      <h3 className="text-2xl sm:text-3xl lg:text-4xl font-serif mb-4 text-foreground">{data.name}</h3>
      <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-6 line-clamp-4 lg:line-clamp-none">
        {data.description}
      </p>
      {data.offer && (
        <div className="bg-accent/10 border border-accent/20 p-4 rounded-sm">
          <p className="text-[10px] uppercase tracking-[0.15em] text-accent font-bold mb-1">Exclusive Offer</p>
          <p className="text-sm text-foreground">{data.offer}</p>
        </div>
      )}
    </div>
  </div>
);

// ============================================
// BACK COVER - Closing CTA
// ============================================
const PageBackCover = ({ data, imageVersion }: any) => (
  <div className="h-full w-full relative overflow-hidden bg-primary flex flex-col items-center justify-center text-center p-6 sm:p-10">
    {data.image && (
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${data.image}?v=${imageVersion}`} alt="Back Cover" className="absolute inset-0 w-full h-full object-cover opacity-20" />
      </div>
    )}
    <div className="relative z-10 max-w-md">
      <h2 className="text-primary-foreground font-serif text-3xl sm:text-4xl lg:text-5xl mb-4 tracking-tight">
        Yorkshire<br />
        <span className="italic text-accent">BusinessWoman</span>
      </h2>
      <div className="h-px w-16 bg-accent mx-auto mb-8" />
      
      <p className="text-primary-foreground/60 text-[10px] tracking-[0.2em] uppercase font-bold mb-2">Next Edition</p>
      <h3 className="text-primary-foreground text-lg sm:text-xl font-serif mb-8">{data.nextIssue}</h3>
      
      {/* CTA */}
      <div className="bg-primary-foreground/10 backdrop-blur-sm p-5 rounded-sm mb-6">
        <p className="text-sm text-primary-foreground/70 mb-4">Join our community of inspiring businesswomen</p>
        <Button className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-none px-8 text-[10px] font-bold uppercase tracking-widest" asChild>
          <Link href="/membership">{data.cta || 'Become a Member'}</Link>
        </Button>
      </div>

      {/* Social */}
      <div className="flex justify-center gap-6 flex-wrap">
        {data.socials?.map((s: any, i: number) => (
          <span key={i} className="text-primary-foreground/50 text-[10px] tracking-widest uppercase hover:text-accent transition-colors cursor-pointer">{s}</span>
        ))}
      </div>
    </div>
  </div>
);
