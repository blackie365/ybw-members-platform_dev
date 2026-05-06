import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'

export type AdSlotType = 'sidebar-mpu' | 'mid-article' | 'leaderboard'

export interface AdSlotProps {
  type: AdSlotType
  /** Direct image ad */
  imageUrl?: string
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
            imageUrl={imageUrl}
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
        <div className="mx-auto max-w-[728px] overflow-hidden ring-1 ring-border">
          <AdContent
            imageUrl={imageUrl}
            linkUrl={linkUrl}
            linkTarget={linkTarget}
            altText={altText}
            placeholderSize="728×90"
            aspectClass="aspect-[728/90]"
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
      <div className="mx-auto max-w-[728px] overflow-hidden ring-1 ring-border">
        <AdContent
          imageUrl={imageUrl}
          linkUrl={linkUrl}
          linkTarget={linkTarget}
          altText={altText}
          placeholderSize="728×90"
          aspectClass="aspect-[728/90]"
        />
      </div>
    </div>
  )
}

function AdContent({
  imageUrl,
  linkUrl,
  linkTarget,
  altText,
  placeholderSize,
  aspectClass,
}: {
  imageUrl?: string
  linkUrl?: string
  linkTarget?: '_blank' | '_self'
  altText: string
  placeholderSize: string
  aspectClass: string
}) {
  const inner = imageUrl ? (
    <div className={cn('relative w-full bg-muted', aspectClass)}>
      <Image
        src={imageUrl}
        alt={altText}
        fill
        className="object-cover"
        sizes="(max-width: 768px) 100vw, 728px"
      />
    </div>
  ) : (
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
  )

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
