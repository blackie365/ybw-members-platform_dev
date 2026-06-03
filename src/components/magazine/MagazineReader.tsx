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
    <div className="fixed inset-0 h-[100dvh] bg-[#FFFEF8] text-[#1A1A1A] flex flex-col z-[100] overflow-hidden select-none">
      
      {/* Top Control Bar - Refined */}
      <header className="h-14 sm:h-16 border-b border-[#E8E4DC] flex items-center justify-between px-4 sm:px-6 bg-[#FFFEF8]/95 backdrop-blur-sm z-50 shrink-0">
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/new-edition" className="text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors">
            <X className="h-5 w-5 sm:h-6 sm:w-6" />
          </Link>
          <div className="h-6 w-px bg-[#E8E4DC] mx-1 sm:mx-2" />
          <div className="flex items-center gap-2 sm:gap-3">
            <Logo className="h-6 sm:h-8" />
            <span className="text-[#C9A962] hidden sm:block">|</span>
            <p className="text-[10px] sm:text-sm font-medium tracking-wide uppercase text-[#C9A962] truncate max-w-[100px] sm:max-w-none">
              {(pages[currentPage]?.content as any)?.date || issue?.title || "Edition"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <Badge variant="outline" className="border-[#E8E4DC] text-[#6B6B6B] font-mono text-[9px] sm:text-xs px-1.5 py-0 bg-transparent">
            {currentPage + 1} / {pages.length}
          </Badge>
          <div className="h-6 w-px bg-[#E8E4DC] mx-1 sm:mx-2" />
          <Button variant="ghost" size="icon" className="text-[#6B6B6B] hover:text-[#1A1A1A] hover:bg-[#F5F0E8] h-8 w-8 sm:h-10 sm:w-10">
            <Share2 className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-[#6B6B6B] hover:text-[#1A1A1A] hover:bg-[#F5F0E8] h-8 w-8 sm:h-10 sm:w-10">
            <Download className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-[#6B6B6B] hover:text-[#1A1A1A] hover:bg-[#F5F0E8] lg:hidden h-8 w-8"
            onClick={() => setIsNavOpen(!isNavOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main Reader Stage */}
      <main className="flex-1 relative flex items-center justify-center overflow-hidden touch-none bg-[#F5F0E8]">
        
        {/* Navigation Arrows (Desktop) - Refined */}
        <button 
          onClick={prevPage}
          disabled={currentPage === 0}
          className="absolute left-6 z-40 h-12 w-12 rounded-full bg-white border border-[#E8E4DC] flex items-center justify-center hover:bg-[#F5F0E8] hover:border-[#C9A962] transition-all disabled:opacity-0 disabled:pointer-events-none hidden lg:flex shadow-sm"
        >
          <ChevronLeft className="h-5 w-5 text-[#6B6B6B]" />
        </button>

        <button 
          onClick={nextPage}
          disabled={currentPage === pages.length - 1}
          className="absolute right-6 z-40 h-12 w-12 rounded-full bg-white border border-[#E8E4DC] flex items-center justify-center hover:bg-[#F5F0E8] hover:border-[#C9A962] transition-all disabled:opacity-0 disabled:pointer-events-none hidden lg:flex shadow-sm"
        >
          <ChevronRight className="h-5 w-5 text-[#6B6B6B]" />
        </button>

        {/* Page Viewport */}
        <div className="relative w-full h-full max-w-[1400px] mx-auto overflow-hidden shadow-lg bg-[#FFFEF8]">
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

      {/* Footer - Refined Progress Bar */}
      <footer className="h-16 sm:h-20 bg-[#FFFEF8] border-t border-[#E8E4DC] px-4 sm:px-6 flex items-center gap-4 sm:gap-6 z-50 shrink-0">
        <div className="flex-1 h-1 bg-[#E8E4DC] rounded-full relative group cursor-pointer">
          <div 
            className="absolute h-full bg-[#C9A962] rounded-full transition-all duration-300" 
            style={{ width: `${((currentPage + 1) / pages.length) * 100}%` }}
          />
          <div className="flex justify-between absolute -top-8 w-full">
            {pages.map((_, i) => (
              <button 
                key={i} 
                onClick={() => goToPage(i)}
                className={`text-[9px] sm:text-[10px] font-mono transition-colors ${currentPage === i ? 'text-[#C9A962]' : 'text-[#6B6B6B]/40 hover:text-[#6B6B6B]'}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={prevPage} disabled={currentPage === 0} variant="outline" size="sm" className="bg-transparent border-[#E8E4DC] text-[#6B6B6B] hover:border-[#C9A962] hover:text-[#C9A962] h-8 text-[10px] sm:text-xs">
            PREV
          </Button>
          <Button onClick={nextPage} disabled={currentPage === pages.length - 1} variant="outline" size="sm" className="bg-transparent border-[#E8E4DC] text-[#6B6B6B] hover:border-[#C9A962] hover:text-[#C9A962] h-8 text-[10px] sm:text-xs">
            NEXT
          </Button>
        </div>
      </footer>

      {/* Sidebar Navigation - Refined */}
      <AnimatePresence>
        {isNavOpen && (
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-80 bg-[#FFFEF8] z-[60] border-l border-[#E8E4DC] shadow-xl p-8"
          >
            <div className="flex items-center justify-between mb-12">
              <h3 className="text-xl font-serif text-[#1A1A1A]">Quick Access</h3>
              <Button variant="ghost" size="icon" onClick={() => setIsNavOpen(false)} className="hover:bg-[#F5F0E8]">
                <X className="h-6 w-6 text-[#6B6B6B]" />
              </Button>
            </div>
            <nav className="space-y-6">
              {pages.map((page, i) => (
                <button
                  key={page.id}
                  onClick={() => goToPage(i)}
                  className={`w-full text-left flex items-center gap-4 group ${currentPage === i ? 'text-[#C9A962]' : 'text-[#6B6B6B]'}`}
                >
                  <span className="text-xs font-mono opacity-40 group-hover:opacity-100 transition-opacity">0{page.id}</span>
                  <span className="font-medium text-sm uppercase tracking-widest">{page.type.replace('-', ' ')}</span>
                  {currentPage === i && <motion.div layoutId="activeDot" className="h-1.5 w-1.5 rounded-full bg-[#C9A962] ml-auto" />}
                </button>
              ))}
            </nav>
            <div className="mt-20 p-6 bg-[#F5F0E8] rounded-xl">
              <p className="text-xs text-[#6B6B6B] uppercase tracking-widest mb-2 font-bold">Latest Edition</p>
              <h4 className="text-lg font-serif mb-4 text-[#1A1A1A]">{issue?.title || "Current Issue"}</h4>
              <Button className="w-full bg-[#C9A962] hover:bg-[#B8984F] text-white" asChild>
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
      return <div className="h-full w-full flex items-center justify-center bg-[#FFFEF8] text-[#6B6B6B]">Page coming soon...</div>;
  }
}

// COVER PAGE - Modern Editorial Style
const PageCover = ({ data, imageVersion }: any) => (
  <div className="h-full w-full relative overflow-hidden bg-[#FFFEF8]">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={`${data.image}?v=${imageVersion}`} alt="Cover" className="absolute inset-0 w-full h-full object-cover" />
    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
    
    {/* Brand Overlay - Refined */}
    <div className="absolute top-12 sm:top-16 left-1/2 -translate-x-1/2 text-center w-full px-8">
      <p className="text-white/80 text-[10px] sm:text-xs tracking-[0.4em] sm:tracking-[0.5em] uppercase mb-3 sm:mb-4 font-medium">{data.date} · {data.issue}</p>
      <h2 className="text-white font-serif text-4xl sm:text-6xl lg:text-7xl font-normal tracking-tight leading-none mb-4">
        Yorkshire <br />
        <span className="italic">BusinessWoman</span>
      </h2>
      <div className="h-0.5 w-16 sm:w-24 bg-[#C9A962] mx-auto mt-4 sm:mt-6" />
    </div>

    {/* Issue Badge */}
    <div className="absolute top-12 sm:top-16 right-8 sm:right-16">
      <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full border-2 border-[#C9A962] flex items-center justify-center bg-white/10 backdrop-blur-sm">
        <span className="text-white font-serif text-lg sm:text-xl">{data.issue?.replace(/[^0-9]/g, '') || '01'}</span>
      </div>
    </div>

    {/* Main Headline - Refined */}
    <div className="absolute bottom-16 sm:bottom-24 left-8 sm:left-16 right-8 sm:right-16 max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.8 }}
      >
        <Badge className="bg-[#C9A962] text-white border-none rounded-sm mb-4 sm:mb-6 px-4 sm:px-5 py-1.5 tracking-widest uppercase text-[10px] sm:text-xs">Special Report</Badge>
        <h1 className="text-white text-2xl sm:text-5xl lg:text-6xl font-serif font-normal leading-tight mb-4 sm:mb-6">
          {data.headline}
        </h1>
        <p className="text-white/80 text-sm sm:text-lg font-light max-w-xl border-l-2 border-[#C9A962] pl-4 sm:pl-6 line-clamp-3 sm:line-clamp-none leading-relaxed">
          {data.subheadline}
        </p>
      </motion.div>
    </div>
  </div>
);

// EDITORIAL PAGE - Clean, Sophisticated
const PageEditorial = ({ data, imageVersion }: any) => (
  <div className="h-full w-full p-6 sm:p-12 lg:p-16 flex flex-col lg:flex-row gap-8 lg:gap-16 bg-[#FFFEF8] overflow-hidden">
    <div className="lg:w-2/5 shrink-0 flex flex-col justify-center">
      <div className="relative aspect-[3/4] overflow-hidden max-w-[200px] lg:max-w-[280px] mx-auto lg:mx-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${data.image}?v=${imageVersion}`} alt={data.author} className="absolute inset-0 w-full h-full object-cover" />
      </div>
      <div className="mt-4 lg:mt-6 text-center lg:text-left">
        <p className="font-serif text-xl lg:text-2xl text-[#1A1A1A]">{data.author}</p>
        <p className="text-xs sm:text-sm uppercase tracking-[0.2em] text-[#C9A962] font-medium mt-1">{data.role}</p>
        <div className="mt-4 flex justify-center lg:justify-start">
          <svg className="h-8 w-24 text-[#C9A962]" viewBox="0 0 100 30">
            <path d="M0,15 Q25,5 50,15 T100,15" fill="none" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        </div>
      </div>
    </div>
    <div className="lg:w-3/5 flex flex-col justify-center py-2 overflow-hidden">
      <p className="text-[#C9A962] text-xs tracking-[0.3em] uppercase font-medium mb-3 lg:mb-4">Editor&apos;s Note</p>
      <h2 className="text-2xl lg:text-4xl font-serif mb-4 lg:mb-8 tracking-tight text-[#1A1A1A] leading-tight">{data.title}</h2>
      <div className="space-y-4 lg:space-y-6 text-sm lg:text-base text-[#4A4A4A] leading-relaxed overflow-hidden">
        <p className="first-letter:text-4xl lg:first-letter:text-5xl first-letter:font-serif first-letter:text-[#C9A962] first-letter:float-left first-letter:mr-2 first-letter:leading-[0.8] first-letter:mt-1 line-clamp-6 lg:line-clamp-none">
          {data.text}
        </p>
        {data.quote && (
          <blockquote className="border-l-2 border-[#C9A962] pl-4 lg:pl-6 py-2 italic text-[#6B6B6B] font-serif text-base lg:text-lg leading-relaxed line-clamp-3 lg:line-clamp-none">
            &quot;{data.quote}&quot;
          </blockquote>
        )}
      </div>
    </div>
  </div>
);

// CONTENTS PAGE - Timeline Style
const PageContents = ({ data }: any) => (
  <div className="h-full w-full p-6 sm:p-12 lg:p-16 grid lg:grid-cols-2 gap-8 lg:gap-16 bg-[#FFFEF8] overflow-hidden">
    <div className="flex flex-col justify-center overflow-hidden">
      <p className="text-[#C9A962] text-xs tracking-[0.3em] uppercase font-medium mb-3">Contents</p>
      <h2 className="text-3xl lg:text-5xl font-serif mb-6 lg:mb-10 tracking-tight text-[#1A1A1A]">In This <span className="italic">Issue</span></h2>
      
      {/* Timeline Layout */}
      <div className="relative pl-6 border-l border-[#E8E4DC] overflow-hidden">
        {data.items?.slice(0, 5).map((item: any, i: number) => (
          <div key={i} className="relative group cursor-pointer mb-4 lg:mb-6 last:mb-0">
            {/* Timeline dot */}
            <div className="absolute -left-[25px] top-2 h-2 w-2 rounded-full bg-[#E8E4DC] group-hover:bg-[#C9A962] transition-colors duration-300" />
            <div className="flex items-baseline gap-3">
              <span className="text-[#C9A962] font-mono text-xs opacity-60 group-hover:opacity-100 transition-opacity">{item.page}</span>
              <div>
                <p className="text-[9px] lg:text-[10px] uppercase tracking-[0.2em] text-[#6B6B6B] mb-0.5">{item.category}</p>
                <p className="text-base lg:text-xl font-serif group-hover:text-[#C9A962] transition-colors text-[#1A1A1A]">{item.title}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
    
    <div className="bg-[#F5F0E8] p-6 lg:p-10 rounded-2xl flex flex-col justify-center overflow-hidden">
      <p className="text-[#C9A962] text-xs tracking-[0.3em] uppercase font-medium mb-4 lg:mb-6">Regional News</p>
      <div className="space-y-3 lg:space-y-5 overflow-hidden">
        {data.news?.slice(0, 3).map((n: any, i: number) => (
          <div key={i} className="flex gap-3 lg:gap-4 items-start group">
            <div className="h-1.5 w-1.5 rounded-full bg-[#C9A962] mt-2 shrink-0" />
            <p className="text-sm lg:text-base text-[#4A4A4A] leading-relaxed line-clamp-2">{n}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 lg:mt-10 pt-6 lg:pt-8 border-t border-[#E8E4DC]">
        <p className="text-xs uppercase tracking-[0.3em] font-medium text-[#6B6B6B] mb-4">Stay Connected</p>
        <div className="flex gap-4 lg:gap-6">
          <Star className="h-5 w-5 lg:h-6 lg:w-6 text-[#C9A962] hover:scale-110 transition-transform cursor-pointer" />
          <Award className="h-5 w-5 lg:h-6 lg:w-6 text-[#C9A962] hover:scale-110 transition-transform cursor-pointer" />
          <Users className="h-5 w-5 lg:h-6 lg:w-6 text-[#C9A962] hover:scale-110 transition-transform cursor-pointer" />
        </div>
      </div>
    </div>
  </div>
);

// FEATURE LEFT - Asymmetric Layout with Floating Card
const PageFeatureLeft = ({ data, imageVersion }: any) => (
  <div className="h-full w-full relative flex flex-col lg:grid lg:grid-cols-5 bg-[#FFFEF8] overflow-hidden">
    {/* Image - 60% */}
    <div className="relative h-48 sm:h-64 lg:h-full lg:col-span-3 overflow-hidden shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${data.image}?v=${imageVersion}`} alt={data.name} className="absolute inset-0 w-full h-full object-cover" />
      {/* Caption overlay */}
      <div className="absolute bottom-6 left-6 right-6 lg:right-auto lg:max-w-xs bg-white/95 backdrop-blur-sm p-4 sm:p-5 rounded-lg shadow-lg">
        <p className="text-xs text-[#6B6B6B] uppercase tracking-wider">{data.title}</p>
      </div>
    </div>
    
    {/* Content - 40% */}
    <div className="p-6 sm:p-8 lg:p-12 flex flex-col justify-center lg:col-span-2 bg-[#FFFEF8] overflow-hidden">
      <p className="text-[#C9A962] text-xs tracking-[0.3em] uppercase font-medium mb-3 lg:mb-4">Cover Feature</p>
      <h3 className="text-2xl lg:text-4xl font-serif font-normal mb-4 lg:mb-6 leading-tight tracking-tight text-[#1A1A1A]">{data.name}</h3>
      
      {/* Quote with thin gold bar */}
      <div className="relative pl-4 lg:pl-6 border-l-2 border-[#C9A962]">
        <p className="text-base lg:text-lg text-[#4A4A4A] leading-relaxed italic font-serif line-clamp-4 lg:line-clamp-none">
          {data.intro}
        </p>
      </div>
      
      {/* Author byline */}
      <div className="mt-4 lg:mt-6 flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-[#F5F0E8] flex items-center justify-center">
          <span className="text-[#C9A962] font-serif text-xs">YB</span>
        </div>
        <div>
          <p className="text-xs font-medium text-[#1A1A1A]">Yorkshire BusinessWoman</p>
          <p className="text-[10px] text-[#6B6B6B]">Exclusive Interview</p>
        </div>
      </div>
    </div>
  </div>
);

// FEATURE RIGHT - Quote Focus with Stats
const PageFeatureRight = ({ data, imageVersion }: any) => (
  <div className="h-full w-full relative overflow-hidden p-6 sm:p-10 lg:p-16 flex flex-col justify-center bg-[#FFFEF8]">
    {data.image && (
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${data.image}?v=${imageVersion}`} alt="Background" className="absolute inset-0 w-full h-full object-cover opacity-5" />
      </div>
    )}
    <div className="relative z-10 max-w-3xl mx-auto overflow-hidden">
      <Quote className="h-6 w-6 lg:h-8 lg:w-8 text-[#C9A962]/30 mb-3 lg:mb-4" />
      <h2 className="text-xl lg:text-3xl font-serif italic text-[#1A1A1A] leading-tight mb-6 lg:mb-8 line-clamp-3 lg:line-clamp-none">
        &quot;{data.quote}&quot;
      </h2>
      <div className="grid md:grid-cols-2 gap-6 lg:gap-10 items-start">
        <div className="space-y-3 lg:space-y-4 text-sm lg:text-base text-[#4A4A4A] leading-relaxed">
          <p className="line-clamp-6 lg:line-clamp-none">{data.text}</p>
        </div>
        <div className="bg-[#F5F0E8] p-4 lg:p-6 rounded-xl">
          <p className="text-[10px] lg:text-xs uppercase tracking-[0.2em] font-medium text-[#C9A962] mb-4">Snapshot</p>
          <div className="space-y-3 lg:space-y-4">
            {data.stats?.slice(0, 3).map((stat: any, i: number) => (
              <div key={i} className="flex justify-between items-end border-b border-[#E8E4DC] pb-2">
                <span className="text-[#6B6B6B] uppercase tracking-wider text-[9px] lg:text-[10px]">{stat.label}</span>
                <span className="text-xl lg:text-2xl font-serif text-[#C9A962]">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

// COLUMN PAGE - Light Background
const PageColumn = ({ data, imageVersion }: any) => (
  <div className="h-full w-full relative overflow-hidden bg-[#FFFEF8] flex flex-col justify-center">
    {data.image && (
      <div className="absolute inset-0 shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${data.image}?v=${imageVersion}`} alt={data.title} className="absolute inset-0 w-full h-full object-cover opacity-10" />
      </div>
    )}
    <div className="relative z-10 p-6 sm:p-10 lg:p-16 max-w-4xl overflow-hidden">
      <p className="text-[#C9A962] text-xs tracking-[0.3em] uppercase font-medium mb-3 lg:mb-4">{data.category}</p>
      <h2 className="text-2xl lg:text-4xl font-serif mb-4 lg:mb-6 tracking-tight text-[#1A1A1A]">{data.title}</h2>
      <div className="flex flex-col md:flex-row gap-6 lg:gap-10 items-start">
        <div className="md:w-2/3 space-y-3 lg:space-y-4 text-sm lg:text-base text-[#4A4A4A] leading-relaxed">
          <p className="line-clamp-6 lg:line-clamp-none">{data.text}</p>
          <div className="h-0.5 w-12 bg-[#C9A962] mt-4 lg:mt-6" />
          <p className="font-serif italic text-lg lg:text-xl text-[#1A1A1A]">By {data.author}</p>
        </div>
        {data.tips && data.tips.length > 0 && (
          <div className="md:w-1/3 bg-[#F5F0E8] p-4 lg:p-6 rounded-xl w-full">
            <p className="text-[10px] lg:text-xs uppercase tracking-[0.2em] text-[#C9A962] mb-3 lg:mb-4 font-medium">Key Takeaways</p>
            <ul className="space-y-2 lg:space-y-3">
              {data.tips?.slice(0, 3).map((tip: any, i: number) => (
                <li key={i} className="flex gap-2 items-start">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#C9A962] mt-1.5 shrink-0" />
                  <p className="text-xs lg:text-sm text-[#4A4A4A] line-clamp-2">{tip}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  </div>
);

// LIFESTYLE PAGE
const PageLifestyle = ({ data, imageVersion }: any) => (
  <div className="h-full w-full relative overflow-hidden bg-[#FFFEF8] flex flex-col lg:block">
    <div className="relative lg:absolute top-0 right-0 w-full lg:w-1/2 h-40 sm:h-56 lg:h-full shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${data.image}?v=${imageVersion}`} alt={data.title} className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b lg:bg-gradient-to-r from-[#FFFEF8] via-[#FFFEF8]/60 to-transparent" />
    </div>
    <div className="relative h-full w-full p-6 sm:p-10 lg:p-16 flex flex-col justify-center z-10 overflow-hidden">
      <div className="max-w-lg">
        <p className="text-[#C9A962] text-xs tracking-[0.3em] uppercase font-medium mb-3">Lifestyle</p>
        <h2 className="text-2xl lg:text-4xl font-serif mb-4 lg:mb-6 tracking-tight text-[#1A1A1A]">The <span className="italic text-[#C9A962]">Art</span> of <br />Balance</h2>
        <p className="text-sm lg:text-base text-[#4A4A4A] leading-relaxed mb-6 lg:mb-8 line-clamp-4 lg:line-clamp-none">
          {data.text}
        </p>
        <div className="space-y-2 lg:space-y-3">
          {data.highlights?.slice(0, 4).map((h: any, i: number) => (
            <div key={i} className="flex items-center gap-3 group cursor-pointer">
              <div className="h-px w-6 bg-[#E8E4DC] group-hover:w-10 group-hover:bg-[#C9A962] transition-all duration-300" />
              <p className="text-[10px] lg:text-xs uppercase tracking-[0.2em] text-[#6B6B6B] group-hover:text-[#C9A962] transition-colors">{h}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// SPOTLIGHT PAGE - Clean Frame, Social Links
const PageSpotlight = ({ data, imageVersion }: any) => (
  <div className="h-full w-full p-6 sm:p-10 lg:p-16 bg-[#FFFEF8] flex flex-col justify-center overflow-hidden">
    <div className="max-w-5xl mx-auto flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
      {/* Clean rectangular frame */}
      <div className="relative h-48 sm:h-64 lg:h-[380px] w-full max-w-[280px] lg:max-w-[320px] shrink-0">
        <div className="absolute inset-0 border border-[#C9A962]/30 rounded-lg" />
        <div className="absolute inset-2 overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${data.image}?v=${imageVersion}`} alt={data.name} className="absolute inset-0 w-full h-full object-cover" />
        </div>
      </div>
      
      <div className="text-center lg:text-left flex-1 overflow-hidden">
        <p className="text-[#C9A962] text-xs tracking-[0.3em] uppercase font-medium mb-3 lg:mb-4">Member Spotlight</p>
        <h2 className="text-2xl lg:text-4xl font-serif mb-1 tracking-tight text-[#1A1A1A]">{data.name}</h2>
        <p className="text-sm lg:text-base text-[#C9A962] mb-4 lg:mb-6">{data.role}</p>
        
        {/* Social Links */}
        <div className="flex justify-center lg:justify-start gap-3 mb-4 lg:mb-6">
          <a href="#" className="h-8 w-8 rounded-full border border-[#E8E4DC] flex items-center justify-center hover:border-[#C9A962] hover:text-[#C9A962] transition-colors text-[#6B6B6B]">
            <Linkedin className="h-3.5 w-3.5" />
          </a>
          <a href="#" className="h-8 w-8 rounded-full border border-[#E8E4DC] flex items-center justify-center hover:border-[#C9A962] hover:text-[#C9A962] transition-colors text-[#6B6B6B]">
            <Twitter className="h-3.5 w-3.5" />
          </a>
        </div>
        
        {/* Testimonial Card */}
        <div className="bg-[#F5F0E8] p-4 lg:p-6 rounded-xl mb-4 lg:mb-6">
          <Quote className="h-5 w-5 text-[#C9A962]/40 mb-2" />
          <p className="text-sm lg:text-base text-[#4A4A4A] leading-relaxed italic line-clamp-3">
            &quot;{data.message}&quot;
          </p>
        </div>
        
        <p className="text-xs lg:text-sm text-[#6B6B6B] leading-relaxed max-w-lg mx-auto lg:mx-0 line-clamp-2 lg:line-clamp-3">
          {data.bio}
        </p>
        
        <Button className="mt-4 lg:mt-6 px-6 py-4 h-auto bg-[#1A1A1A] text-white hover:bg-[#333] tracking-wider uppercase text-[10px] lg:text-xs rounded-sm">
          Read Full Profile
        </Button>
      </div>
    </div>
  </div>
);

// PARTNER PAGE
const PagePartner = ({ data, imageVersion }: any) => (
  <div className="h-full w-full relative overflow-hidden bg-[#1A1A1A]">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={`${data.image}?v=${imageVersion}`} alt={data.brand} className="absolute inset-0 w-full h-full object-cover opacity-40" />
    <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1A] via-[#1A1A1A]/40 to-transparent" />
    
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 sm:p-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <p className="text-[#C9A962] text-[10px] sm:text-xs tracking-[0.4em] uppercase mb-6 sm:mb-8 font-medium">Partner Feature</p>
        <h2 className="text-white font-serif text-3xl sm:text-6xl mb-4 sm:mb-6 tracking-tight">{data.brand}</h2>
        <p className="text-white/60 text-base sm:text-xl font-light mb-8 sm:mb-10 max-w-lg mx-auto">{data.headline}</p>
        <div className="bg-[#C9A962] text-white px-8 sm:px-10 py-4 sm:py-5 text-base sm:text-lg font-serif italic inline-block rounded-sm">
          {data.offer}
        </div>
      </motion.div>
    </div>
  </div>
);

// BACK COVER - Subtle, Newsletter Signup
const PageBackCover = ({ data, imageVersion }: any) => (
  <div className="h-full w-full relative overflow-hidden bg-[#FFFEF8] flex flex-col items-center justify-center text-center p-6 sm:p-10">
    {data.image && (
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${data.image}?v=${imageVersion}`} alt="Back Cover" className="absolute inset-0 w-full h-full object-cover opacity-5" />
      </div>
    )}
    <div className="relative z-10 max-w-lg">
      <h2 className="text-[#1A1A1A] font-serif text-2xl lg:text-5xl mb-4 lg:mb-6 tracking-tight">
        Yorkshire <br />
        <span className="italic text-[#C9A962]">BusinessWoman</span>
      </h2>
      <div className="h-px w-12 bg-[#E8E4DC] mx-auto mb-6 lg:mb-10" />
      
      <p className="text-[#6B6B6B] text-xs tracking-[0.3em] uppercase mb-3 font-medium">Next Edition</p>
      <h3 className="text-[#1A1A1A] text-base lg:text-xl font-serif mb-6 lg:mb-10">{data.nextIssue}</h3>
      
      {/* Newsletter Signup */}
      <div className="bg-[#F5F0E8] p-4 lg:p-6 rounded-xl mb-6 lg:mb-8">
        <p className="text-xs lg:text-sm text-[#4A4A4A] mb-3">Stay updated with our latest editions</p>
        <Button className="w-full sm:w-auto px-6 py-4 h-auto bg-[#C9A962] hover:bg-[#B8984F] text-white rounded-sm text-xs" asChild>
          <Link href="/membership">{data.cta}</Link>
        </Button>
      </div>

      {/* Social Grid */}
      <div className="flex justify-center gap-4 lg:gap-6 flex-wrap">
        {data.socials?.map((s: any, i: number) => (
          <span key={i} className="text-[#6B6B6B] text-[9px] lg:text-[10px] tracking-widest uppercase hover:text-[#C9A962] transition-colors cursor-pointer">{s}</span>
        ))}
      </div>
    </div>
  </div>
);
