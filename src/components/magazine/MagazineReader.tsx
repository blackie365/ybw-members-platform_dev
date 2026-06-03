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
    <div className="fixed inset-0 bg-[#050505] text-zinc-100 flex flex-col z-[100] overflow-hidden select-none perspective-1000">
      
      {/* Top Control Bar */}
      <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/50 backdrop-blur-md z-50">
        <div className="flex items-center gap-4">
          <Link href="/new-edition" className="text-zinc-400 hover:text-white transition-colors">
            <X className="h-6 w-6" />
          </Link>
          <div className="h-6 w-px bg-zinc-800 mx-2" />
          <div className="flex items-center gap-3">
            <Logo className="h-8 brightness-0 invert" />
            <span className="text-zinc-500 hidden sm:block">|</span>
            <p className="text-sm font-medium tracking-wide uppercase text-accent hidden sm:block">
              {(pages[currentPage]?.content as any)?.date || issue?.title || "Edition"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-zinc-700 text-zinc-400 font-mono">
            {currentPage + 1} / {pages.length}
          </Badge>
          <div className="h-6 w-px bg-zinc-800 mx-2" />
          <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white">
            <Share2 className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white">
            <Download className="h-5 w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-zinc-400 hover:text-white lg:hidden"
            onClick={() => setIsNavOpen(!isNavOpen)}
          >
            <Menu className="h-6 w-6" />
          </Button>
        </div>
      </header>

      {/* Main Reader Stage */}
      <main className="flex-1 relative flex items-center justify-center overflow-hidden">
        
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
                transition={{
                  x: { type: "spring", stiffness: 300, damping: 30 },
                  opacity: { duration: 0.2 }
                }}
                className="absolute inset-0 w-full h-full"
              >
                {renderPage(pages[currentPage], imageVersion)}
              </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Page Scrubber */}
      <footer className="h-20 bg-zinc-900 border-t border-zinc-800 px-6 flex items-center gap-6 z-50">
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
                className={`text-[10px] font-mono transition-colors ${currentPage === i ? 'text-accent' : 'text-zinc-600 hover:text-zinc-400'}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={prevPage} disabled={currentPage === 0} variant="outline" size="sm" className="bg-transparent border-zinc-700 text-zinc-400">
            PREV
          </Button>
          <Button onClick={nextPage} disabled={currentPage === pages.length - 1} variant="outline" size="sm" className="bg-transparent border-zinc-700 text-zinc-400">
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
    <img src={`${data.image}?v=${imageVersion}`} alt="Cover" className="absolute inset-0 w-full h-full object-cover opacity-80" />
    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
    
    {/* Brand Overlay */}
    <div className="absolute top-12 left-1/2 -translate-x-1/2 text-center w-full px-6">
      <p className="text-white/60 text-xs tracking-[0.4em] uppercase mb-4 font-medium">{data.date} · {data.issue}</p>
      <h2 className="text-white font-serif text-5xl md:text-7xl lg:text-8xl font-medium tracking-tighter leading-none mb-4 drop-shadow-2xl">
        Yorkshire <br />
        <span className="italic">BusinessWoman</span>
      </h2>
      <div className="h-px w-24 bg-accent mx-auto mt-8" />
    </div>

    {/* Main Headline */}
    <div className="absolute bottom-20 left-12 right-12 max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 1 }}
      >
        <Badge className="bg-accent text-white border-none rounded-none mb-6 px-4 py-1 tracking-widest uppercase">Special Report</Badge>
        <h1 className="text-white text-4xl md:text-6xl font-serif font-medium leading-tight mb-6">
          {data.headline}
        </h1>
        <p className="text-white/80 text-xl font-light max-w-xl border-l-2 border-accent pl-6">
          {data.subheadline}
        </p>
      </motion.div>
    </div>
  </div>
);

const PageEditorial = ({ data, imageVersion }: any) => (
  <div className="h-full w-full p-12 md:p-24 flex flex-col lg:flex-row gap-16 bg-[#FAF9F6]">
    <div className="lg:w-1/3">
      <div className="relative aspect-[3/4] rounded-sm overflow-hidden shadow-2xl grayscale hover:grayscale-0 transition-all duration-1000">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${data.image}?v=${imageVersion}`} alt={data.author} className="absolute inset-0 w-full h-full object-cover" />
      </div>
      <div className="mt-8">
        <p className="font-serif text-3xl italic">{data.author}</p>
        <p className="text-xs uppercase tracking-widest text-accent font-bold mt-1">{data.role}</p>
      </div>
    </div>
    <div className="lg:w-2/3 flex flex-col justify-center">
      <Badge variant="outline" className="mb-6 w-fit border-accent text-accent tracking-widest uppercase">Editor&apos;s Note</Badge>
      <h2 className="text-5xl md:text-6xl font-serif mb-12 tracking-tight">{data.title}</h2>
      <div className="space-y-8 text-xl text-zinc-700 leading-relaxed font-light">
        <p className="first-letter:text-7xl first-letter:font-serif first-letter:text-accent first-letter:float-left first-letter:mr-4 first-letter:leading-[0.8]">
          {data.text}
        </p>
        <blockquote className="border-l-4 border-accent/20 pl-8 py-4 italic text-zinc-500 font-serif text-2xl leading-relaxed">
          &quot;{data.quote}&quot;
        </blockquote>
      </div>
    </div>
  </div>
);

const PageContents = ({ data }: any) => (
  <div className="h-full w-full p-12 md:p-24 grid lg:grid-cols-2 gap-20 bg-white">
    <div className="flex flex-col justify-center">
      <h2 className="text-6xl font-serif mb-16 tracking-tighter">In This <span className="italic">Issue</span></h2>
      <div className="space-y-10">
        {data.items?.map((item: any, i: number) => (
          <div key={i} className="group cursor-pointer flex items-end gap-6 border-b border-zinc-100 pb-6 hover:border-accent/40 transition-colors">
            <span className="text-accent font-mono text-xl opacity-40 group-hover:opacity-100 transition-opacity">{item.page}</span>
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-widest text-zinc-400 mb-1">{item.category}</p>
              <p className="text-2xl font-serif group-hover:text-accent transition-colors">{item.title}</p>
            </div>
            <ArrowRight className="h-6 w-6 text-zinc-200 group-hover:text-accent group-hover:translate-x-2 transition-all" />
          </div>
        ))}
      </div>
    </div>
    <div className="bg-zinc-50 p-12 rounded-2xl flex flex-col justify-center">
      <Badge className="bg-black text-white mb-8 w-fit tracking-widest uppercase">Regional News</Badge>
      <div className="space-y-12">
        {data.news?.map((n: any, i: number) => (
          <div key={i} className="flex gap-6">
            <div className="h-2 w-2 rounded-full bg-accent mt-3 shrink-0" />
            <p className="text-xl font-light text-zinc-700 leading-snug">{n}</p>
          </div>
        ))}
      </div>
      <div className="mt-16 pt-12 border-t border-zinc-200">
        <p className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-400 mb-6">Stay Connected</p>
        <div className="flex gap-8">
          <Star className="h-6 w-6 text-accent fill-current" />
          <Award className="h-6 w-6 text-accent" />
          <Users className="h-6 w-6 text-accent" />
        </div>
      </div>
    </div>
  </div>
);

const PageFeatureLeft = ({ data, imageVersion }: any) => (
  <div className="h-full w-full relative grid lg:grid-cols-2 bg-[#FAF9F6]">
    <div className="relative h-full overflow-hidden group">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${data.image}?v=${imageVersion}`} alt={data.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" />
      <div className="absolute inset-0 bg-accent/10 mix-blend-overlay" />
    </div>
    <div className="p-12 md:p-24 flex flex-col justify-center">
      <Badge variant="outline" className="mb-6 w-fit border-accent text-accent tracking-widest uppercase">Cover Feature</Badge>
      <h2 className="text-2xl uppercase tracking-[0.5em] text-zinc-400 mb-4">{data.title}</h2>
      <h3 className="text-7xl md:text-8xl font-serif font-medium mb-8 leading-none tracking-tighter">{data.name}</h3>
      <p className="text-2xl text-zinc-700 font-light leading-relaxed border-l-4 border-accent pl-10 italic">
        {data.intro}
      </p>
    </div>
  </div>
);

const PageFeatureRight = ({ data, imageVersion }: any) => (
  <div className="h-full w-full relative overflow-hidden p-12 md:p-24 flex flex-col justify-center bg-white">
    {data.image && (
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${data.image}?v=${imageVersion}`} alt="Background" className="absolute inset-0 w-full h-full object-cover opacity-10" />
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-transparent" />
      </div>
    )}
    <div className="relative z-10 max-w-3xl mx-auto">
      <Quote className="h-16 w-16 text-accent/10 mb-8" />
      <h2 className="text-4xl md:text-5xl font-serif italic text-black leading-tight mb-16">
        &quot;{data.quote}&quot;
      </h2>
      <div className="grid md:grid-cols-2 gap-16 items-start">
        <div className="space-y-6 text-lg text-zinc-600 leading-relaxed font-light">
          <p>{data.text}</p>
        </div>
        <div className="bg-zinc-50 p-10 rounded-2xl">
          <p className="text-xs uppercase tracking-[0.3em] font-bold text-accent mb-8">Snapshot</p>
          <div className="space-y-8">
            {data.stats?.map((stat: any, i: number) => (
              <div key={i} className="flex justify-between items-end border-b border-zinc-200 pb-4">
                <span className="text-zinc-400 uppercase tracking-widest text-xs font-medium">{stat.label}</span>
                <span className="text-4xl font-serif text-accent">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

const PageColumn = ({ data, imageVersion }: any) => (
  <div className="h-full w-full relative overflow-hidden bg-zinc-900 text-white flex flex-col justify-center">
    {data.image && (
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${data.image}?v=${imageVersion}`} alt={data.title} className="absolute inset-0 w-full h-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-900 via-zinc-900/80 to-transparent" />
      </div>
    )}
    <div className="relative z-10 p-12 md:p-24 max-w-4xl">
      <Badge className="bg-accent text-white rounded-none mb-8 tracking-widest uppercase px-6 py-2">{data.category}</Badge>
      <h2 className="text-6xl font-serif mb-12 tracking-tight">{data.title}</h2>
      <div className="flex flex-col md:flex-row gap-16 items-start">
        <div className="md:w-2/3 space-y-8 text-xl text-zinc-300 leading-relaxed font-light">
          <p>{data.text}</p>
          <div className="h-1 w-24 bg-accent mt-12" />
          <p className="font-serif italic text-3xl text-white">By {data.author}</p>
        </div>
        <div className="md:w-1/3 bg-white/5 p-8 rounded-xl backdrop-blur-sm border border-white/10">
          <p className="text-xs uppercase tracking-[0.3em] text-accent mb-6 font-bold">Key Takeaways</p>
          <ul className="space-y-6">
            {data.tips?.map((tip: any, i: number) => (
              <li key={i} className="flex gap-4 items-start">
                <div className="h-1.5 w-1.5 rounded-full bg-accent mt-2 shrink-0" />
                <p className="text-sm font-light text-zinc-400">{tip}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  </div>
);

const PageLifestyle = ({ data, imageVersion }: any) => (
  <div className="h-full w-full relative overflow-hidden bg-[#FAF9F6]">
    <div className="absolute top-0 right-0 w-1/2 h-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${data.image}?v=${imageVersion}`} alt={data.title} className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#FAF9F6] to-transparent" />
    </div>
    <div className="relative h-full w-full p-12 md:p-24 flex flex-col justify-center z-10">
      <div className="max-w-xl">
        <Badge variant="outline" className="mb-6 border-zinc-300 text-zinc-500 tracking-widest uppercase">Lifestyle</Badge>
        <h2 className="text-7xl font-serif mb-8 tracking-tighter">The <span className="italic text-accent">Art</span> of <br />Balance</h2>
        <p className="text-xl text-zinc-600 leading-relaxed font-light mb-12">
          {data.text}
        </p>
        <div className="space-y-6">
          {data.highlights?.map((h: any, i: number) => (
            <div key={i} className="flex items-center gap-6 group cursor-pointer">
              <div className="h-px w-12 bg-zinc-300 group-hover:w-20 group-hover:bg-accent transition-all duration-500" />
              <p className="text-sm uppercase tracking-[0.4em] font-medium group-hover:text-accent transition-colors">{h}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const PageSpotlight = ({ data, imageVersion }: any) => (
  <div className="h-full w-full p-12 md:p-24 bg-white flex flex-col justify-center">
    <div className="max-w-5xl mx-auto flex flex-col lg:flex-row items-center gap-20">
      <div className="relative h-[500px] w-full lg:w-[400px] shrink-0">
        <div className="absolute -inset-4 border-2 border-accent/20 rounded-2xl -rotate-3" />
        <div className="relative h-full w-full rounded-2xl overflow-hidden shadow-2xl rotate-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${data.image}?v=${imageVersion}`} alt={data.name} className="absolute inset-0 w-full h-full object-cover" />
        </div>
      </div>
      <div>
        <Badge className="bg-accent text-white mb-8 tracking-widest uppercase">Member Spotlight</Badge>
        <h2 className="text-6xl font-serif mb-4 tracking-tight">{data.name}</h2>
        <p className="text-xl text-accent font-medium mb-12 tracking-wide">{data.role}</p>
        <p className="text-2xl text-zinc-600 leading-relaxed font-light italic mb-12">
          &quot;{data.message}&quot;
        </p>
        <p className="text-lg text-zinc-500 leading-relaxed max-w-xl">
          {data.bio}
        </p>
        <Button className="mt-12 rounded-none px-12 py-7 h-auto bg-black text-white hover:bg-zinc-800 tracking-widest uppercase">Read Full Profile</Button>
      </div>
    </div>
  </div>
);

const PagePartner = ({ data, imageVersion }: any) => (
  <div className="h-full w-full relative overflow-hidden bg-black">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={`${data.image}?v=${imageVersion}`} alt={data.brand} className="absolute inset-0 w-full h-full object-cover opacity-50" />
    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
    
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1 }}
      >
        <p className="text-accent text-xs tracking-[0.6em] uppercase mb-8 font-bold">Partner Feature</p>
        <h2 className="text-white font-serif text-5xl md:text-7xl mb-6 tracking-tight">{data.brand}</h2>
        <p className="text-white/60 text-2xl font-light mb-12 tracking-wide">{data.headline}</p>
        <div className="bg-accent text-white px-12 py-6 text-2xl font-serif italic shadow-2xl inline-block">
          {data.offer}
        </div>
      </motion.div>
    </div>
  </div>
);

const PageBackCover = ({ data, imageVersion }: any) => (
  <div className="h-full w-full relative overflow-hidden bg-primary flex flex-col items-center justify-center text-center p-12">
    {data.image && (
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${data.image}?v=${imageVersion}`} alt="Back Cover" className="absolute inset-0 w-full h-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/80 to-transparent" />
      </div>
    )}
    <div className="relative z-10 max-w-2xl">
      <h2 className="text-white font-serif text-6xl md:text-8xl mb-12 tracking-tighter">
        Yorkshire <br />
        <span className="italic text-accent">BusinessWoman</span>
      </h2>
      <div className="h-px w-24 bg-white/20 mx-auto mb-16" />
      
      <p className="text-white/60 text-xs tracking-[0.4em] uppercase mb-8 font-bold">Next Edition</p>
      <h3 className="text-white text-3xl font-serif mb-16">{data.nextIssue}</h3>
      
      <Button className="rounded-full px-12 py-8 h-auto text-xl bg-accent hover:bg-accent/90 mb-12" asChild>
        <Link href="/membership">{data.cta}</Link>
      </Button>

      <div className="flex justify-center gap-12 pt-12 border-t border-white/10">
        {data.socials?.map((s: any, i: number) => (
          <span key={i} className="text-white/40 text-xs tracking-widest uppercase hover:text-white transition-colors cursor-pointer">{s}</span>
        ))}
      </div>
    </div>
  </div>
);
