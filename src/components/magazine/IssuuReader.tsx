'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, ExternalLink, Maximize2, Minimize2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { fixIssuuEmbedUrl } from '@/lib/magazine-utils';

interface IssuuReaderProps {
  url: string;
  title: string;
}

export default function IssuuReader({ url, title }: IssuuReaderProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const embedUrl = fixIssuuEmbedUrl(url);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const anyDoc = document as any;
      setIsFullscreen(Boolean(document.fullscreenElement || anyDoc.webkitFullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange as any);
    handleFullscreenChange();

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange as any);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      const anyDoc = document as any;
      if (!(document.fullscreenElement || anyDoc.webkitFullscreenElement)) {
        const el = rootRef.current;
        if (!el) return;
        const anyEl = el as any;
        const request =
          (anyEl.requestFullscreen as undefined | (() => Promise<void>)) ??
          (anyEl.webkitRequestFullscreen as undefined | (() => Promise<void>));
        if (!request) return;
        await request.call(el);
      } else {
        const exit =
          (document.exitFullscreen as undefined | (() => Promise<void>)) ??
          (anyDoc.webkitExitFullscreen as undefined | (() => Promise<void>));
        if (!exit) return;
        await exit.call(document);
      }
    } catch {
      return;
    }
  }, []);

  return (
    <div ref={rootRef} className="fixed inset-0 bg-[#050505] flex flex-col z-[100]">
      {/* Header */}
      <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/50 backdrop-blur-md z-50">
        <div className="flex items-center gap-4">
          <Link href="/admin/magazine" className="text-zinc-400 hover:text-white transition-colors">
            <X className="h-6 w-6" />
          </Link>
          <div className="h-6 w-px bg-zinc-800 mx-2" />
          <div className="flex items-center gap-3">
            <Logo className="h-8 brightness-0 invert" />
            <span className="text-zinc-500 hidden sm:block">|</span>
            <p className="text-sm font-medium tracking-wide uppercase text-accent hidden sm:block">
              {title}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={toggleFullscreen}
            className="text-zinc-300 hover:text-white h-9 w-9 flex items-center justify-center rounded-md hover:bg-zinc-800 transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <Button variant="outline" size="sm" asChild className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              View on Issuu
            </a>
          </Button>
        </div>
      </header>

      {/* Reader Frame */}
      <main className="flex-1 bg-black relative">
        <iframe 
          src={embedUrl}
          className="absolute inset-0 w-full h-full border-none"
          allowFullScreen
          allow="clipboard-write"
        />
      </main>
    </div>
  );
}
