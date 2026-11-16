import { prepareArticleBodyHtml } from '@/lib/news/article-body';
import type { ArticleEnhancementRecord } from '@/lib/news/article-enhancements';
import { buildArticleBodySegments } from '@/lib/news/article-body-segments';
import { cn } from '@/lib/utils';
import { ArticleEnhancementBlockRenderer } from '@/components/news/ArticleEnhancementBlocks';

type ArticleBodyProps = {
  html: string | null | undefined;
  standfirst?: string | null;
  enhancement?: ArticleEnhancementRecord | null;
  className?: string;
  proseClassName?: string;
};

const BASE_PROSE_CLASSES = [
  'prose prose-lg max-w-none',
  'prose-headings:font-serif prose-headings:font-semibold prose-headings:tracking-tight prose-headings:leading-tight prose-headings:text-foreground',
  'prose-h2:mt-14 prose-h2:mb-6 prose-h2:border-t prose-h2:border-border prose-h2:pt-8 prose-h2:text-[1.95rem]',
  'prose-h3:mt-12 prose-h3:mb-5 prose-h3:text-[1.55rem]',
  'prose-p:my-5 prose-p:text-[18px] prose-p:leading-[1.85] prose-p:text-foreground/88',
  'prose-p:[text-wrap:pretty] prose-li:[text-wrap:pretty]',
  'prose-a:text-accent prose-a:font-medium prose-a:underline prose-a:underline-offset-2 hover:prose-a:text-foreground',
  'prose-strong:text-foreground prose-strong:font-semibold',
  'prose-ul:my-6 prose-ol:my-6 prose-ul:text-foreground/85 prose-ol:text-foreground/85 prose-li:my-2 prose-li:leading-[1.8]',
  'prose-blockquote:my-10 prose-blockquote:border-l-[3px] prose-blockquote:border-l-accent prose-blockquote:bg-accent/5',
  'prose-blockquote:px-7 prose-blockquote:py-6 prose-blockquote:font-serif prose-blockquote:text-[1.15em] prose-blockquote:leading-[1.65] prose-blockquote:italic prose-blockquote:text-foreground/90',
  'prose-img:my-8 prose-img:rounded-none prose-img:border prose-img:border-border prose-img:shadow-sm',
  'prose-figure:my-8 prose-figcaption:mt-3 prose-figcaption:border-t prose-figcaption:border-border prose-figcaption:pt-3 prose-figcaption:text-center prose-figcaption:text-[11px] prose-figcaption:uppercase prose-figcaption:tracking-[0.12em] prose-figcaption:text-muted-foreground',
  'prose-hr:my-10 prose-hr:border-border',
].join(' ');

const LEAD_PROSE_CLASSES = [
  '[&>p:first-of-type]:mb-9',
  '[&>p:first-of-type]:font-serif [&>p:first-of-type]:text-[20px] [&>p:first-of-type]:font-medium [&>p:first-of-type]:leading-[1.72] [&>p:first-of-type]:text-foreground',
].join(' ');

export function ArticleBody({ html, standfirst, enhancement, className, proseClassName }: ArticleBodyProps) {
  const safeHtml = prepareArticleBodyHtml(html, standfirst);
  const segments = buildArticleBodySegments(safeHtml, enhancement);
  const topStatBlocks = segments.filter(
    (segment): segment is Extract<(typeof segments)[number], { kind: 'block' }> =>
      segment.kind === 'block' && segment.block.type === 'stat_grid',
  );
  const contentSegments = segments.filter(
    (segment) => !(segment.kind === 'block' && segment.block.type === 'stat_grid'),
  );
  let seenFirstHtml = false;

  return (
    <div className={cn(className)}>
      {standfirst ? (
        <div className="mb-8 border-b border-border pb-6">
          <p className="font-serif text-[20px] font-medium leading-[1.72] text-foreground sm:text-[22px]">
            {standfirst}
          </p>
        </div>
      ) : null}

      {topStatBlocks.map((segment, index) => (
        <ArticleEnhancementBlockRenderer key={`top-stat-${index}`} block={segment.block} />
      ))}

      {contentSegments.map((segment, index) => {
        if (segment.kind === 'block') {
          return <ArticleEnhancementBlockRenderer key={`block-${index}`} block={segment.block} />;
        }

        const isFirstHtml = !seenFirstHtml;
        seenFirstHtml = true;

        return (
          <div
            key={`html-${index}`}
            className={cn(BASE_PROSE_CLASSES, isFirstHtml && LEAD_PROSE_CLASSES, proseClassName)}
            dangerouslySetInnerHTML={{ __html: segment.html }}
          />
        );
      })}
    </div>
  );
}
