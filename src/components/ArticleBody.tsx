'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export function ArticleBody({ 
  html, 
  adComponent 
}: { 
  html: string;
  adComponent: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [adContainer, setAdContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    
    // Find all top-level paragraphs inside the article
    // This avoids messing with nested paragraphs in blockquotes/figures
    const paragraphs = Array.from(containerRef.current.querySelectorAll(':scope > p'));
    
    if (paragraphs.length >= 3) {
      // Find the middle paragraph
      const middlePara = paragraphs[Math.floor(paragraphs.length / 2)];
      
      // Create a container for the ad
      const div = document.createElement('div');
      div.className = "my-8 clear-both"; // add some margin and clear floats
      
      // Insert it right after the middle paragraph safely in the DOM
      middlePara.after(div);
      
      setAdContainer(div);
    }
  }, [html]);

  return (
    <>
      <div 
        ref={containerRef}
        className="prose prose-lg prose-indigo dark:prose-invert max-w-none prose-a:font-semibold prose-img:rounded-xl prose-img:shadow-md [&>p:first-of-type]:text-xl [&>p:first-of-type]:font-medium [&>p:first-of-type]:leading-8 [&>p:first-of-type]:text-zinc-600 dark:[&>p:first-of-type]:text-zinc-300 [&>p:first-of-type]:mb-8" 
        dangerouslySetInnerHTML={{ __html: html }} 
      />
      {/* Teleport the React AdComponent into the DOM container we created */}
      {adContainer && createPortal(adComponent, adContainer)}
    </>
  );
}