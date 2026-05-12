'use client';

import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';

export function ArticleBody({ 
  html, 
  adComponent 
}: { 
  html: string;
  adComponent: React.ReactNode;
}) {
  const [adTarget, setAdTarget] = useState<HTMLElement | null>(null);
  
  // Generate a unique ID so we can safely find the target div in the DOM
  const targetId = useMemo(() => `ad-target-${Math.random().toString(36).substring(2, 9)}`, []);

  const htmlWithAdTarget = useMemo(() => {
    // Split the raw HTML by paragraph closing tags (case insensitive)
    // This allows us to inject the ad safely without breaking any open HTML tags
    const parts = html.split(/(<\/p>)/i);
    
    // parts array looks like: ["<p>Text", "</p>", "<p>Text 2", "</p>", ""]
    // Every valid </p> is located at an odd index in this array.
    const pCount = Math.floor(parts.length / 2);
    const adDiv = `<div id="${targetId}" class="my-12 clear-both w-full flex justify-center"></div>`;
    
    if (pCount >= 3) {
      // Find the middle paragraph
      const middleIndex = Math.floor(pCount / 2);
      const targetPartIndex = (middleIndex * 2) + 1;
      
      let result = '';
      for (let i = 0; i < parts.length; i++) {
        result += parts[i];
        if (i === targetPartIndex) {
          result += adDiv;
        }
      }
      return result;
    } else if (pCount > 0) {
       // Short article: insert after first paragraph
       let result = '';
       for (let i = 0; i < parts.length; i++) {
         result += parts[i];
         if (i === 1) { // First </p>
           result += adDiv;
         }
       }
       return result;
    }
    
    // Fallback: append at the very bottom
    return html + adDiv;
  }, [html, targetId]);

  useEffect(() => {
    // After the HTML string is rendered by dangerouslySetInnerHTML,
    // find the empty div we injected and save it to state.
    const target = document.getElementById(targetId);
    if (target) {
      setAdTarget(target);
    }
  }, [htmlWithAdTarget, targetId]);

  return (
    <>
      <div 
        className="prose prose-lg prose-indigo dark:prose-invert max-w-none prose-a:font-semibold prose-img:rounded-xl prose-img:shadow-md [&>p:first-of-type]:text-xl [&>p:first-of-type]:font-medium [&>p:first-of-type]:leading-8 [&>p:first-of-type]:text-zinc-600 dark:[&>p:first-of-type]:text-zinc-300 [&>p:first-of-type]:mb-8" 
        dangerouslySetInnerHTML={{ __html: htmlWithAdTarget }} 
      />
      {/* Teleport the React AdComponent directly into the injected div */}
      {adTarget && createPortal(adComponent, adTarget)}
    </>
  );
}