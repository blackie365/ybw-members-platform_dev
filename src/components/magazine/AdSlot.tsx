'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from'next/image';
import { cn } from '@/lib/utils';

export type AdSlotType = 'sidebar-mpu' | 'mid-article' | 'leaderboard'

const LEADERBOARD_WIDTH = 780
const LEADERBOARD_HEIGHT = 90
const LEADERBOARD_ASPECT_CLASS = 'aspect-[780/90]'
const LEADERBOARD_MAX_WIDTH_CLASS = 'max-w-[780px]'
const LEADERBOARD_PLACEHOLDER = '780×90'

export interface AdSlotProps {
  type: AdSlotType
  /** Direct image ad */
  imageUrl?: string
  /** HTML5 / Iframe ad */
  iframeUrl?: string
  /** Where the ad links to */
  linkUrl?: string
  linkTarget?: '_blank' | '_self'
  altText?: string
  className?: string
}

/**
 * AdSlot — drop an image + link directly, or replace the inner div
 * with a Google Ad Manager / programmatic tag when you're ready to
 * integrate a third-party ad server.
 */
export function AdSlot({
  type,
  imageUrl,
  iframeUrl,
  linkUrl,
  linkTarget = '_blank',
  altText = 'Advertisement',
  className,
}: AdSlotProps) {
  if (type === 'sidebar-mpu') {
    return (
      <div className={cn('w-full', className)}>
        <span className="mb-2 block text-right text-[9px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60">
          Sponsored
        </span>
        <div className="overflow-hidden ring-1 ring-border">
          <AdContent
            type={type}
            imageUrl={imageUrl}
            iframeUrl={iframeUrl}
            linkUrl={linkUrl}
            linkTarget={linkTarget}
            altText={altText}
            placeholderSize="300×250"
            aspectClass="aspect-[6/5]"
          />
        </div>
      </div>
    )
  }

  if (type === 'mid-article') {
    return (
      <div className={cn('my-12 border-t border-b border-border py-8', className)}>
        <span className="mb-4 block text-center text-[9px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60">
          Sponsored
        </span>
        <div className={cn('mx-auto overflow-hidden ring-1 ring-border', LEADERBOARD_MAX_WIDTH_CLASS)}>
          <AdContent
            type={type}
            imageUrl={imageUrl}
            iframeUrl={iframeUrl}
            linkUrl={linkUrl}
            linkTarget={linkTarget}
            altText={altText}
            placeholderSize={LEADERBOARD_PLACEHOLDER}
            aspectClass={LEADERBOARD_ASPECT_CLASS}
          />
        </div>
      </div>
    )
  }

  // leaderboard
  return (
    <div className={cn('w-full', className)}>
      <span className="mb-2 block text-right text-[9px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60">
        Sponsored
      </span>
      <div className={cn('mx-auto overflow-hidden ring-1 ring-border', LEADERBOARD_MAX_WIDTH_CLASS)}>
        <AdContent
          type={type}
          imageUrl={imageUrl}
          iframeUrl={iframeUrl}
          linkUrl={linkUrl}
          linkTarget={linkTarget}
          altText={altText}
          placeholderSize={LEADERBOARD_PLACEHOLDER}
          aspectClass={LEADERBOARD_ASPECT_CLASS}
        />
      </div>
    </div>
  )
}

function AdContent({
  type,
  imageUrl,
  iframeUrl,
  linkUrl,
  linkTarget,
  altText,
  placeholderSize,
  aspectClass,
}: {
  type: AdSlotType
  imageUrl?: string
  iframeUrl?: string
  linkUrl?: string
  linkTarget?: '_blank' | '_self'
  altText: string
  placeholderSize: string
  aspectClass: string
}) {
  // The upload APIs already return browser-safe public URLs.
  // Re-encoding them here turns `%20` into `%2520`, which breaks
  // HTML5 banner iframe paths and some image assets.
  const safeIframeUrl = iframeUrl?.trim() || undefined
  const safeImageUrl = imageUrl?.trim() || undefined

  let inner;

  if (safeIframeUrl) {
    inner = (
      <ResponsiveIframeFrame
        src={safeIframeUrl}
        title={altText}
        aspectClass={aspectClass}
        linkUrl={linkUrl}
        nativeWidth={type === 'sidebar-mpu' ? 300 : LEADERBOARD_WIDTH}
        nativeHeight={type === 'sidebar-mpu' ? 250 : LEADERBOARD_HEIGHT}
      />
    );
  } else if (safeImageUrl) {
    inner = (
      <div className={cn('relative w-full bg-muted', aspectClass)}>
        <Image
          src={safeImageUrl}
          alt={altText}
          fill
          className="object-cover"
          sizes={`(max-width: 768px) 100vw, ${LEADERBOARD_WIDTH}px`}
        />
      </div>
    );
  } else {
    inner = (
      <div
        className={cn(
          'flex w-full items-center justify-center bg-muted/40',
          aspectClass
        )}
      >
        <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/40">
          {placeholderSize}
        </span>
      </div>
    );
  }

  if (linkUrl) {
    return (
      <Link
        href={linkUrl}
        target={linkTarget}
        rel="noopener noreferrer nofollow"
        aria-label={altText}
      >
        {inner}
      </Link>
    )
  }

  return <>{inner}</>
}

function ResponsiveIframeFrame({
  src,
  title,
  aspectClass,
  linkUrl,
  nativeWidth,
  nativeHeight,
}: {
  src: string
  title: string
  aspectClass: string
  linkUrl?: string
  nativeWidth: number
  nativeHeight: number
}) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const element = frameRef.current
    if (!element) return

    const updateScale = () => {
      const nextScale = element.clientWidth / nativeWidth
      setScale(nextScale > 0 ? Math.min(1, nextScale) : 1)
    }

    updateScale()

    const observer = new ResizeObserver(() => updateScale())
    observer.observe(element)

    return () => observer.disconnect()
  }, [nativeWidth])

  return (
    <div ref={frameRef} className={cn('relative w-full overflow-hidden bg-muted', aspectClass)}>
      <iframe
        src={src}
        title={title}
        className={cn('absolute left-1/2 top-1/2 border-0', linkUrl && 'pointer-events-none')}
        scrolling="no"
        style={{
          width: nativeWidth,
          height: nativeHeight,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: 'center center',
        }}
      />
    </div>
  )
}
