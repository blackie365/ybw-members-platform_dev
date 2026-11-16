import { getPosts } from '../src/lib/ghost';
import { maybeGenerateAndStoreArticleEnhancement } from '../src/lib/news/article-enhancement-generator';

async function main() {
  const limit = Math.max(1, Number.parseInt(process.env.BACKFILL_ARTICLE_LIMIT || '50', 10) || 50);
  const pageSize = Math.min(15, limit);
  const filter = String(process.env.BACKFILL_GHOST_FILTER || '').trim() || undefined;

  let processed = 0;
  let page = 1;

  console.log(
    `[article-enhancements] backfill start limit=${limit} pageSize=${pageSize} filter=${filter || '(none)'}`,
  );

  while (processed < limit) {
    const remaining = limit - processed;
    const posts = await getPosts({
      limit: Math.min(pageSize, remaining),
      page,
      filter,
      order: 'published_at desc',
    });

    if (!Array.isArray(posts) || posts.length === 0) break;

    for (const post of posts) {
      const result = await maybeGenerateAndStoreArticleEnhancement(post as any);
      processed += 1;
      console.log(
        `[article-enhancements] ${processed}/${limit} slug=${String(post?.slug || '')} stored=${result.stored} mode=${result.mode} blocks=${result.blocks} reason=${result.reason}`,
      );
      if (processed >= limit) break;
    }

    page += 1;
  }

  console.log(`[article-enhancements] backfill complete processed=${processed}`);
}

main().catch((error) => {
  console.error('[article-enhancements] backfill failed:', error);
  process.exitCode = 1;
});
