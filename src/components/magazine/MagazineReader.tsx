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
  ArrowRight
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
      scale: 0.9,
      rotateY: direction > 0 ? 45 : -45,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1,
      rotateY: 0,
      transition: {
        x: { type: "spring", stiffness: 200, damping: 30 },
        opacity: { duration: 0.4 },
        rotateY: { duration: 0.6, ease: "easeOut" }
      }
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? '100%' : '-100%',
      opacity: 0,
      scale: 1.1,
      rotateY: direction < 0 ? 45 : -45,
      transition: {
        x: { type: "spring", stiffness: 200, damping: 30 },
        opacity: { duration: 0.4 },
        rotateY: { duration: 0.6, ease: "easeIn" }
      }
    })
  };

  return (
    <div className="fixed inset-0 h-[100dvh] bg-[#050505] text-zinc-100 flex flex-col z-[100] overflow-hidden select-none perspective-1000">
      
      {/* Top Control Bar */}
      <header className="h-14 sm:h-16 border-b border-zinc-800 flex items-center justify-between px-4 sm:px-6 bg-zinc-900/50 backdrop-blur-md z-50 shrink-0">
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/new-edition" className="text-zinc-400 hover:text-white transition-colors">
            <X className="h-5 w-5 sm:h-6 sm:w-6" />
          </Link>
          <div className="h-6 w-px bg-zinc-800 mx-1 sm:mx-2" />
          <div className="flex items-center gap-2 sm:gap-3">
            <Logo className="h-6 sm:h-8 brightness-0 invert" />
            <span className="text-zinc-500 hidden sm:block">|</span>
            <p className="text-[10px] sm:text-sm font-medium tracking-wide uppercase text-accent truncate max-w-[100px] sm:max-w-none">
              {(pages[currentPage]?.content as any)?.date || issue?.title || "Edition"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <Badge variant="outline" className="border-zinc-700 text-zinc-400 font-mono text-[9px] sm:text-xs px-1.5 py-0">
            {currentPage + 1} / {pages.length}
          </Badge>
          <div className="h-6 w-px bg-zinc-800 mx-1 sm:mx-2" />
          <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white h-8 w-8 sm:h-10 sm:w-10">
            <Share2 className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white h-8 w-8 sm:h-10 sm:w-10">
            <Download className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-zinc-400 hover:text-white lg:hidden h-8 w-8"
            onClick={() => setIsNavOpen(!isNavOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main Reader Stage */}
      <main className="flex-1 relative flex items-center justify-center overflow-hidden touch-none">
        
        {/* Navigation Arrows (Desktop) */}
        <button 
          onClick={prevPage}
          disabled={currentPage === 0}
          className="absolute left-6 z-40 h-12 w-12 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center justify-center hover:bg-zinc-800 hover:scale-110 transition-all disabled:opacity-0 disabled:pointer-events-none hidden lg:flex shadow-2xl"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        <button 
          onClick={nextPage}
          disabled={currentPage === pages.length - 1}
          className="absolute right-6 z-40 h-12 w-12 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center justify-center hover:bg-zinc-800 hover:scale-110 transition-all disabled:opacity-0 disabled:pointer-events-none hidden lg:flex shadow-2xl"
        >
          <ChevronRight className="h-6 w-6" />
        </button>

        {/* Page Viewport */}
        <div className="relative w-full h-full max-w-[1400px] mx-auto overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] bg-white text-zinc-900">
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
                transition={{
                  x: { type: "spring", stiffness: 300, damping: 30 },
                  opacity: { duration: 0.2 }
                }}
                className="absolute inset-0 w-full h-full will-change-transform"
              >
                {renderPage(pages[currentPage], imageVersion)}
              </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Page Scrubber */}
      <footer className="h-16 sm:h-20 bg-zinc-900 border-t border-zinc-800 px-4 sm:px-6 flex items-center gap-4 sm:gap-6 z-50 shrink-0">
        <div className="flex-1 h-1 bg-zinc-800 rounded-full relative group cursor-pointer">
          <div 
            className="absolute h-full bg-accent rounded-full transition-all duration-300" 
            style={{ width: `${((currentPage + 1) / pages.length) * 100}%` }}
          />
          <div className="flex justify-between absolute -top-8 w-full">
            {pages.map((_, i) => (
              <button 
                key={i} 
                onClick={() => goToPage(i)}
                className={`text-[9px] sm:text-[10px] font-mono transition-colors ${currentPage === i ? 'text-accent' : 'text-zinc-600 hover:text-zinc-400'}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={prevPage} disabled={currentPage === 0} variant="outline" size="sm" className="bg-transparent border-zinc-700 text-zinc-400 h-8 text-[10px] sm:text-xs">
            PREV
          </Button>
          <Button onClick={nextPage} disabled={currentPage === pages.length - 1} variant="outline" size="sm" className="bg-transparent border-zinc-700 text-zinc-400 h-8 text-[10px] sm:text-xs">
            NEXT
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
            className="fixed right-0 top-0 bottom-0 w-full sm:w-80 bg-zinc-900 z-[60] border-l border-zinc-800 shadow-2xl p-8"
          >
            <div className="flex items-center justify-between mb-12">
              <h3 className="text-xl font-serif">Quick Access</h3>
              <Button variant="ghost" size="icon" onClick={() => setIsNavOpen(false)}>
                <X className="h-6 w-6" />
              </Button>
            </div>
            <nav className="space-y-6">
              {pages.map((page, i) => (
                <button
                  key={page.id}
                  onClick={() => goToPage(i)}
                  className={`w-full text-left flex items-center gap-4 group ${currentPage === i ? 'text-accent' : 'text-zinc-400'}`}
                >
                  <span className="text-xs font-mono opacity-40 group-hover:opacity-100 transition-opacity">0{page.id}</span>
                  <span className="font-medium text-sm uppercase tracking-widest">{page.type.replace('-', ' ')}</span>
                  {currentPage === i && <motion.div layoutId="activeDot" className="h-1.5 w-1.5 rounded-full bg-accent ml-auto" />}
                </button>
              ))}
            </nav>
            <div className="mt-20 p-6 bg-zinc-800/50 rounded-xl">
              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2 font-bold">Latest Edition</p>
              <h4 className="text-lg font-serif mb-4">{issue?.title || "Current Issue"}</h4>
              <Button className="w-full bg-accent hover:bg-accent/90" asChild>
                <Link href="/membership">Become a Member</Link>
              </Button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- PAGE RENDERER HELPERS ---

function renderPage(page: any, imageVersion: string) {
  switch (page.type) {
    case 'cover':
      return <PageCover data={page.content} imageVersion={imageVersion} />;
    case 'editorial':
      return <PageEditorial data={page.content} imageVersion={imageVersion} />;
    case 'contents':
      return <PageContents data={page.content} imageVersion={imageVersion} />;
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
      return <div>Page coming soon...</div>;
  }
}

const PageCover = ({ data, imageVersion }: any) => (
  <div className="h-full w-full relative overflow-hidden bg-zinc-900">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={`${data.image}?v=${imageVersion}`} alt="Cover" className="absolute inset-0 w-full h-full object-cover opacity-90 brightness-[0.8]" />
    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40" />
    
    {/* Brand Overlay */}
    <div className="absolute top-12 sm:top-16 left-1/2 -translate-x-1/2 text-center w-full px-8">
      <p className="text-white/70 text-[10px] sm:text-xs tracking-[0.4em] sm:tracking-[0.5em] uppercase mb-3 sm:mb-6 font-semibold drop-shadow-md">{data.date} · {data.issue}</p>
      <h2 className="text-white font-serif text-5xl sm:text-8xl lg:text-9xl font-medium tracking-tighter leading-none mb-4 drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]">
        Yorkshire <br />
        <span className="italic">BusinessWoman</span>
      </h2>
      <div className="h-0.5 w-20 sm:w-32 bg-accent mx-auto mt-6 sm:mt-10 shadow-lg" />
    </div>

    {/* Main Headline */}
    <div className="absolute bottom-16 sm:bottom-24 left-8 sm:left-16 right-8 sm:right-16 max-w-5xl">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 1 }}
      >
        <Badge className="bg-accent text-white border-none rounded-none mb-6 sm:mb-8 px-4 sm:px-6 py-1.5 sm:py-2 tracking-widest uppercase text-[10px] sm:text-sm shadow-xl">Special Report</Badge>
        <h1 className="text-white text-3xl sm:text-7xl font-serif font-medium leading-tight mb-6 sm:mb-8 drop-shadow-lg">
          {data.headline}
        </h1>
        <p className="text-white/90 text-base sm:text-2xl font-light max-w-2xl border-l-4 border-accent pl-6 sm:pl-10 line-clamp-3 sm:line-clamp-none leading-relaxed drop-shadow-md">
          {data.subheadline}
        </p>
      </motion.div>
    </div>
  </div>
);

const PageEditorial = ({ data, imageVersion }: any) => (
  <div className="h-full w-full p-8 sm:p-16 md:p-32 flex flex-col lg:flex-row gap-12 sm:gap-24 bg-[#FAF9F6] overflow-y-auto lg:overflow-hidden">
    <div className="lg:w-1/3 shrink-0">
      <div className="relative aspect-[3/4] rounded-sm overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] grayscale hover:grayscale-0 transition-all duration-1000 max-w-[300px] lg:max-w-none mx-auto lg:mx-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${data.image}?v=${imageVersion}`} alt={data.author} className="absolute inset-0 w-full h-full object-cover" />
      </div>
      <div className="mt-8 sm:mt-12 text-center lg:text-left">
        <p className="font-serif text-3xl sm:text-4xl italic text-zinc-900">{data.author}</p>
        <p className="text-xs sm:text-sm uppercase tracking-[0.2em] text-accent font-bold mt-2">{data.role}</p>
      </div>
    </div>
    <div className="lg:w-2/3 flex flex-col justify-center py-8">
      <Badge variant="outline" className="mb-8 sm:mb-12 w-fit border-accent text-accent tracking-[0.3em] uppercase text-[10px] sm:text-xs px-4 py-1.5">Editor&apos;s Note</Badge>
      <h2 className="text-4xl sm:text-7xl font-serif mb-10 sm:mb-16 tracking-tight text-zinc-900 leading-none">{data.title}</h2>
      <div className="space-y-8 sm:space-y-12 text-lg sm:text-2xl text-zinc-800 leading-relaxed font-light">
        <p className="first-letter:text-6xl sm:first-letter:text-9xl first-letter:font-serif first-letter:text-accent first-letter:float-left first-letter:mr-4 sm:first-letter:mr-6 first-letter:leading-[0.7] first-letter:mt-2">
          {data.text}
        </p>
        {data.quote && (
          <blockquote className="border-l-[6px] border-accent/30 pl-8 sm:pl-12 py-4 sm:py-6 italic text-zinc-600 font-serif text-xl sm:text-3xl leading-relaxed bg-accent/5 pr-8">
            &quot;{data.quote}&quot;
          </blockquote>
        )}
      </div>
    </div>
  </div>
);

const PageContents = ({ data }: any) => (
  <div className="h-full w-full p-8 sm:p-16 md:p-32 grid lg:grid-cols-2 gap-12 sm:gap-24 bg-white overflow-y-auto lg:overflow-hidden">
    <div className="flex flex-col justify-center">
      <h2 className="text-5xl sm:text-8xl font-serif mb-12 sm:mb-20 tracking-tighter text-zinc-900">In This <span className="italic">Issue</span></h2>
      <div className="space-y-8 sm:space-y-12">
        {data.items?.map((item: any, i: number) => (
          <div key={i} className="group cursor-pointer flex items-end gap-6 sm:gap-10 border-b border-zinc-100 pb-6 sm:pb-8 hover:border-accent/60 transition-all duration-500">
            <span className="text-accent font-mono text-xl sm:text-3xl opacity-30 group-hover:opacity-100 transition-all duration-500 transform group-hover:scale-110">{item.page}</span>
            <div className="flex-1">
              <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-accent/60 mb-2 font-bold">{item.category}</p>
              <p className="text-2xl sm:text-4xl font-serif group-hover:text-accent transition-colors truncate text-zinc-900">{item.title}</p>
            </div>
            <ArrowRight className="h-6 w-6 sm:h-10 sm:w-10 text-zinc-200 group-hover:text-accent group-hover:translate-x-4 transition-all duration-500" />
          </div>
        ))}
      </div>
    </div>
    <div className="bg-zinc-50 p-8 sm:p-16 rounded-[2rem] flex flex-col justify-center shadow-inner border border-zinc-100">
      <Badge className="bg-accent text-white mb-10 sm:mb-16 w-fit tracking-[0.3em] uppercase text-[10px] sm:text-sm px-6 py-2 shadow-lg">Regional News</Badge>
      <div className="space-y-10 sm:space-y-16">
        {data.news?.map((n: any, i: number) => (
          <div key={i} className="flex gap-6 sm:gap-10 items-start group">
            <div className="h-2 w-2 sm:h-3 sm:w-3 rounded-full bg-accent mt-3 shrink-0 shadow-[0_0_10px_rgba(163,65,58,0.5)] group-hover:scale-150 transition-transform duration-500" />
            <p className="text-xl sm:text-3xl font-light text-zinc-800 leading-tight group-hover:text-zinc-900 transition-colors">{n}</p>
          </div>
        ))}
      </div>
      <div className="mt-16 sm:mt-24 pt-12 sm:pt-16 border-t-2 border-zinc-200/50">
        <p className="text-xs sm:text-sm uppercase tracking-[0.5em] font-black text-zinc-400 mb-8 sm:mb-12">Stay Connected</p>
        <div className="flex gap-10 sm:gap-16">
          <Star className="h-8 w-8 sm:h-12 sm:w-12 text-accent fill-current drop-shadow-md hover:scale-110 transition-transform" />
          <Award className="h-8 w-8 sm:h-12 sm:w-12 text-accent drop-shadow-md hover:scale-110 transition-transform" />
          <Users className="h-8 w-8 sm:h-12 sm:w-12 text-accent drop-shadow-md hover:scale-110 transition-transform" />
        </div>
      </div>
    </div>
  </div>
);

const PageFeatureLeft = ({ data, imageVersion }: any) => (
  <div className="h-full w-full relative flex flex-col lg:grid lg:grid-cols-2 bg-[#FAF9F6] overflow-y-auto lg:overflow-hidden">
    <div className="relative h-80 sm:h-[50vh] lg:h-full overflow-hidden group shrink-0 shadow-2xl">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${data.image}?v=${imageVersion}`} alt={data.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-[2000ms] group-hover:scale-110 brightness-[0.9]" />
      <div className="absolute inset-0 bg-accent/20 mix-blend-overlay" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent" />
    </div>
    <div className="p-10 sm:p-20 md:p-32 flex flex-col justify-center bg-[#FAF9F6]">
      <Badge variant="outline" className="mb-8 sm:mb-12 w-fit border-accent text-accent tracking-[0.4em] uppercase text-[10px] sm:text-sm px-6 py-2 border-2">Cover Feature</Badge>
      <h2 className="text-xl sm:text-3xl uppercase tracking-[0.4em] sm:tracking-[0.6em] text-zinc-400 mb-4 sm:mb-6 font-medium">{data.title}</h2>
      <h3 className="text-5xl sm:text-9xl font-serif font-medium mb-10 sm:mb-16 leading-none tracking-tighter text-zinc-900">{data.name}</h3>
      <div className="relative">
        <Quote className="absolute -left-10 -top-10 h-20 w-20 text-accent/5 hidden sm:block" />
        <p className="text-2xl sm:text-4xl text-zinc-800 font-light leading-relaxed border-l-[6px] border-accent pl-10 sm:pl-16 italic relative z-10 bg-white/40 py-8 pr-8 shadow-sm">
          {data.intro}
        </p>
      </div>
    </div>
  </div>
);

const PageFeatureRight = ({ data, imageVersion }: any) => (
  <div className="h-full w-full relative overflow-hidden p-8 sm:p-12 md:p-24 flex flex-col justify-center bg-white overflow-y-auto">
    {data.image && (
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${data.image}?v=${imageVersion}`} alt="Background" className="absolute inset-0 w-full h-full object-cover opacity-5 sm:opacity-10" />
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-transparent" />
      </div>
    )}
    <div className="relative z-10 max-w-3xl mx-auto">
      <Quote className="h-8 w-8 sm:h-16 sm:w-16 text-accent/10 mb-4 sm:mb-8" />
      <h2 className="text-2xl sm:text-5xl font-serif italic text-black leading-tight mb-8 sm:mb-16">
        &quot;{data.quote}&quot;
      </h2>
      <div className="grid md:grid-cols-2 gap-8 sm:gap-16 items-start">
        <div className="space-y-4 sm:space-y-6 text-base sm:text-lg text-zinc-600 leading-relaxed font-light">
          <p>{data.text}</p>
        </div>
        <div className="bg-zinc-50 p-6 sm:p-10 rounded-2xl">
          <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] font-bold text-accent mb-6 sm:mb-8">Snapshot</p>
          <div className="space-y-6 sm:space-y-8">
            {data.stats?.map((stat: any, i: number) => (
              <div key={i} className="flex justify-between items-end border-b border-zinc-200 pb-3 sm:pb-4">
                <span className="text-zinc-400 uppercase tracking-widest text-[10px] sm:text-xs font-medium">{stat.label}</span>
                <span className="text-2xl sm:text-4xl font-serif text-accent">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

const PageColumn = ({ data, imageVersion }: any) => (
  <div className="h-full w-full relative overflow-hidden bg-zinc-900 text-white flex flex-col justify-center overflow-y-auto">
    {data.image && (
      <div className="absolute inset-0 shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${data.image}?v=${imageVersion}`} alt={data.title} className="absolute inset-0 w-full h-full object-cover opacity-20 sm:opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-900 via-zinc-900/80 to-transparent" />
      </div>
    )}
    <div className="relative z-10 p-8 sm:p-12 md:p-24 max-w-4xl">
      <Badge className="bg-accent text-white rounded-none mb-6 sm:mb-8 tracking-widest uppercase px-4 sm:px-6 py-1.5 sm:py-2 text-[9px] sm:text-xs">{data.category}</Badge>
      <h2 className="text-3xl sm:text-6xl font-serif mb-8 sm:mb-12 tracking-tight">{data.title}</h2>
      <div className="flex flex-col md:flex-row gap-8 sm:gap-16 items-start">
        <div className="md:w-2/3 space-y-6 sm:space-y-8 text-base sm:text-xl text-zinc-300 leading-relaxed font-light">
          <p>{data.text}</p>
          <div className="h-0.5 sm:h-1 w-16 sm:w-24 bg-accent mt-8 sm:mt-12" />
          <p className="font-serif italic text-2xl sm:text-3xl text-white">By {data.author}</p>
        </div>
        {data.tips && data.tips.length > 0 && (
          <div className="md:w-1/3 bg-white/5 p-6 sm:p-8 rounded-xl backdrop-blur-sm border border-white/10 w-full">
            <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-accent mb-4 sm:mb-6 font-bold">Key Takeaways</p>
            <ul className="space-y-4 sm:space-y-6">
              {data.tips?.map((tip: any, i: number) => (
                <li key={i} className="flex gap-3 sm:gap-4 items-start">
                  <div className="h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full bg-accent mt-2 shrink-0" />
                  <p className="text-xs sm:text-sm font-light text-zinc-400">{tip}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  </div>
);

const PageLifestyle = ({ data, imageVersion }: any) => (
  <div className="h-full w-full relative overflow-hidden bg-[#FAF9F6] flex flex-col lg:block overflow-y-auto lg:overflow-hidden">
    <div className="relative lg:absolute top-0 right-0 w-full lg:w-1/2 h-64 sm:h-80 lg:h-full shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${data.image}?v=${imageVersion}`} alt={data.title} className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b lg:bg-gradient-to-r from-[#FAF9F6] to-transparent" />
    </div>
    <div className="relative h-full w-full p-8 sm:p-12 md:p-24 flex flex-col justify-center z-10">
      <div className="max-w-xl">
        <Badge variant="outline" className="mb-4 sm:mb-6 border-zinc-300 text-zinc-500 tracking-widest uppercase text-[9px] sm:text-xs">Lifestyle</Badge>
        <h2 className="text-4xl sm:text-7xl font-serif mb-6 sm:mb-8 tracking-tighter">The <span className="italic text-accent">Art</span> of <br />Balance</h2>
        <p className="text-lg sm:text-xl text-zinc-600 leading-relaxed font-light mb-8 sm:mb-12">
          {data.text}
        </p>
        <div className="space-y-4 sm:space-y-6">
          {data.highlights?.map((h: any, i: number) => (
            <div key={i} className="flex items-center gap-4 sm:gap-6 group cursor-pointer">
              <div className="h-px w-8 sm:w-12 bg-zinc-300 group-hover:w-20 group-hover:bg-accent transition-all duration-500" />
              <p className="text-[10px] sm:text-sm uppercase tracking-[0.3em] sm:tracking-[0.4em] font-medium group-hover:text-accent transition-colors">{h}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const PageSpotlight = ({ data, imageVersion }: any) => (
  <div className="h-full w-full p-6 sm:p-12 md:p-24 bg-white flex flex-col justify-center overflow-y-auto">
    <div className="max-w-5xl mx-auto flex flex-col lg:flex-row items-center gap-12 sm:gap-20">
      <div className="relative h-64 sm:h-[500px] w-full lg:w-[400px] shrink-0">
        <div className="absolute -inset-2 sm:-inset-4 border-2 border-accent/20 rounded-2xl -rotate-3" />
        <div className="relative h-full w-full rounded-2xl overflow-hidden shadow-2xl rotate-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${data.image}?v=${imageVersion}`} alt={data.name} className="absolute inset-0 w-full h-full object-cover" />
        </div>
      </div>
      <div className="text-center lg:text-left">
        <Badge className="bg-accent text-white mb-6 sm:mb-8 tracking-widest uppercase text-[9px] sm:text-xs">Member Spotlight</Badge>
        <h2 className="text-3xl sm:text-6xl font-serif mb-2 sm:mb-4 tracking-tight">{data.name}</h2>
        <p className="text-lg sm:text-xl text-accent font-medium mb-8 sm:mb-12 tracking-wide">{data.role}</p>
        <p className="text-lg sm:text-2xl text-zinc-600 leading-relaxed font-light italic mb-8 sm:mb-12">
          &quot;{data.message}&quot;
        </p>
        <p className="text-base sm:text-lg text-zinc-500 leading-relaxed max-w-xl">
          {data.bio}
        </p>
        <Button className="mt-8 sm:mt-12 rounded-none px-8 sm:px-12 py-5 sm:py-7 h-auto bg-black text-white hover:bg-zinc-800 tracking-widest uppercase text-[10px] sm:text-xs">Read Full Profile</Button>
      </div>
    </div>
  </div>
);

const PagePartner = ({ data, imageVersion }: any) => (
  <div className="h-full w-full relative overflow-hidden bg-black">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={`${data.image}?v=${imageVersion}`} alt={data.brand} className="absolute inset-0 w-full h-full object-cover opacity-50" />
    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
    
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 sm:p-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1 }}
      >
        <p className="text-accent text-[10px] sm:text-xs tracking-[0.4em] sm:tracking-[0.6em] uppercase mb-6 sm:mb-8 font-bold">Partner Feature</p>
        <h2 className="text-white font-serif text-3xl sm:text-7xl mb-4 sm:mb-6 tracking-tight">{data.brand}</h2>
        <p className="text-white/60 text-lg sm:text-2xl font-light mb-8 sm:mb-12 tracking-wide">{data.headline}</p>
        <div className="bg-accent text-white px-8 sm:px-12 py-4 sm:py-6 text-lg sm:text-2xl font-serif italic shadow-2xl inline-block">
          {data.offer}
        </div>
      </motion.div>
    </div>
  </div>
);

const PageBackCover = ({ data, imageVersion }: any) => (
  <div className="h-full w-full relative overflow-hidden bg-[#050505] flex flex-col items-center justify-center text-center p-8 sm:p-12">
    {data.image && (
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${data.image}?v=${imageVersion}`} alt="Back Cover" className="absolute inset-0 w-full h-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent" />
      </div>
    )}
    <div className="relative z-10 max-w-2xl">
      <h2 className="text-white font-serif text-4xl sm:text-8xl mb-8 sm:mb-12 tracking-tighter">
        Yorkshire <br />
        <span className="italic text-accent">BusinessWoman</span>
      </h2>
      <div className="h-px w-16 sm:w-24 bg-white/20 mx-auto mb-12 sm:mb-16" />
      
      <p className="text-white/60 text-[10px] sm:text-xs tracking-[0.3em] sm:tracking-[0.4em] uppercase mb-6 sm:mb-8 font-bold">Next Edition</p>
      <h3 className="text-white text-xl sm:text-3xl font-serif mb-12 sm:mb-16">{data.nextIssue}</h3>
      
      <Button className="rounded-full px-8 sm:px-12 py-5 sm:py-8 h-auto text-base sm:text-xl bg-accent hover:bg-accent/90 mb-8 sm:mb-12" asChild>
        <Link href="/membership">{data.cta}</Link>
      </Button>

      <div className="flex justify-center gap-8 sm:gap-12 pt-8 sm:pt-12 border-t border-white/10">
        {data.socials?.map((s: any, i: number) => (
          <span key={i} className="text-white/40 text-[9px] sm:text-xs tracking-widest uppercase hover:text-white transition-colors cursor-pointer">{s}</span>
        ))}
      </div>
    </div>
  </div>
);
