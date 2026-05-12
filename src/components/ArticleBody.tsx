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
    
    // Find all paragraphs, filtering out empty ones or ones inside blockquotes/figures
    const allParagraphs = Array.from(containerRef.current.querySelectorAll('p'));
    const validParagraphs = allParagraphs.filter(p => {
      if (!p.textContent || p.textContent.trim().length < 30) return false;
      if (p.closest('figure') || p.closest('blockquote')) return false;
      return true;
    });
    
    // Create a container for the ad
    const div = document.createElement('div');
    div.className = "my-12 clear-both w-full flex justify-center"; 
    
    if (validParagraphs.length >= 3) {
      // Find the middle paragraph
      const middlePara = validParagraphs[Math.floor(validParagraphs.length / 2)];
      middlePara.after(div);
    } else if (validParagraphs.length > 0) {
      // If short article, put it after the first paragraph
      validParagraphs[0].after(div);
    } else {
      // Fallback: put it at the bottom of the content
      containerRef.current.appendChild(div);
    }
    
    setAdContainer(div);
    
    return () => {
      if (div.parentNode) {
        div.parentNode.removeChild(div);
      }
    };
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