'use client';

import React from 'react';
import { X, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { fixIssuuEmbedUrl } from '@/lib/magazine-utils';

interface IssuuReaderProps {
  url: string;
  title: string;
}

export default function IssuuReader({ url, title }: IssuuReaderProps) {
  const embedUrl = fixIssuuEmbedUrl(url);

  return (
    <div className="fixed inset-0 bg-[#050505] flex flex-col z-[100]">
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
