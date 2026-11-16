import type { ArticleEnhancementBlock } from '@/lib/news/article-enhancements';
import { sanitizeHtml } from '@/lib/utils';

export function ArticleEnhancementBlockRenderer({ block }: { block: ArticleEnhancementBlock }) {
  switch (block.type) {
    case 'subhead':
      return (
        <section className="mt-12 border-t border-[hsl(var(--rule-heavy))] pt-5">
          {block.kicker ? (
            <p className="kicker text-[10px] text-[hsl(var(--accent))]">{block.kicker}</p>
          ) : null}
          <h2 className="mt-2 font-serif text-2xl font-bold leading-tight text-[hsl(var(--foreground))] sm:text-3xl">
            {block.text}
          </h2>
        </section>
      );

    case 'pull_quote':
      return (
        <aside className="my-12 border-y-2 border-[hsl(var(--rule-heavy))] bg-[hsl(var(--paper-deep))] px-6 py-8 text-center sm:px-10">
          <blockquote className="font-serif text-2xl leading-tight italic text-[hsl(var(--foreground))]">
            “{block.quote}”
          </blockquote>
          {block.attribution ? (
            <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
              {block.attribution}
            </p>
          ) : null}
        </aside>
      );

    case 'fact_box':
      return (
        <aside className="my-10 border-l-4 border-[hsl(var(--accent))] bg-[hsl(var(--paper))] px-6 py-6 sm:px-7">
          <p className="kicker text-[10px] text-[hsl(var(--accent))]">{block.title}</p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-7 text-[hsl(var(--foreground))]/85 marker:text-[hsl(var(--accent))]">
            {block.items.map((item) => (
              <li
                key={item}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(item, { allowStyles: false }) }}
              />
            ))}
          </ul>
        </aside>
      );

    case 'key_points':
      return (
        <section className="my-12 border-y-2 border-[hsl(var(--rule-heavy))] bg-[linear-gradient(180deg,hsl(var(--paper))_0%,white_100%)] px-6 py-6 sm:px-8">
          <p className="kicker text-[10px] text-[hsl(var(--accent))]">
            {block.title || 'Key points'}
          </p>
          <ul className="mt-4 list-disc space-y-3 pl-5 text-[15px] leading-7 text-[hsl(var(--foreground))]/85 marker:text-[hsl(var(--accent))]">
            {block.points.map((point) => (
              <li
                key={point}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(point, { allowStyles: false }) }}
              />
            ))}
          </ul>
        </section>
      );

    case 'stat_grid':
      return (
        <section className="my-10 border border-[hsl(var(--rule))] bg-[linear-gradient(180deg,hsl(var(--paper))_0%,white_100%)] p-6">
          {block.title ? (
            <p className="kicker mb-4 text-[10px] text-[hsl(var(--accent))]">{block.title}</p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            {block.stats.map((stat) => (
              <div
                key={`${stat.label}-${stat.value}`}
                className="border border-[hsl(var(--rule))] bg-white px-4 py-4"
              >
                <p className="font-serif text-3xl leading-none text-[hsl(var(--foreground))]">
                  {stat.value}
                </p>
                <p className="mt-2 text-[11px] uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))]">
                  {stat.label}
                </p>
                {stat.detail ? (
                  <p
                    className="mt-2 text-sm leading-6 text-[hsl(var(--foreground))]/80"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(stat.detail, { allowStyles: false }) }}
                  />
                ) : null}
              </div>
            ))}
          </div>
        </section>
      );
  }
}
