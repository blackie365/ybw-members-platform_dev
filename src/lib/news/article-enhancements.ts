import { createHash } from 'crypto';
import { z } from 'zod';

const ArticleEnhancementBlockBaseSchema = z.object({
  type: z.string().min(1),
});

const SubheadBlockSchema = ArticleEnhancementBlockBaseSchema.extend({
  type: z.literal('subhead'),
  text: z.string().min(1).max(140),
  kicker: z.string().min(1).max(48).optional(),
});

const PullQuoteBlockSchema = ArticleEnhancementBlockBaseSchema.extend({
  type: z.literal('pull_quote'),
  quote: z.string().min(1).max(320),
  attribution: z.string().min(1).max(120).optional(),
});

const FactBoxBlockSchema = ArticleEnhancementBlockBaseSchema.extend({
  type: z.literal('fact_box'),
  title: z.string().min(1).max(60),
  items: z.array(z.string().min(1).max(240)).min(2).max(5),
});

const KeyPointsBlockSchema = ArticleEnhancementBlockBaseSchema.extend({
  type: z.literal('key_points'),
  title: z.string().min(1).max(60).optional(),
  points: z.array(z.string().min(1).max(240)).min(2).max(5),
});

const StatItemSchema = z.object({
  label: z.string().min(1).max(40),
  value: z.string().min(1).max(40),
  detail: z.string().min(1).max(220).optional(),
});

const StatGridBlockSchema = ArticleEnhancementBlockBaseSchema.extend({
  type: z.literal('stat_grid'),
  title: z.string().min(1).max(60).optional(),
  stats: z.array(StatItemSchema).min(1).max(4),
});

export const ArticleEnhancementBlockSchema = z.discriminatedUnion('type', [
  SubheadBlockSchema,
  PullQuoteBlockSchema,
  FactBoxBlockSchema,
  KeyPointsBlockSchema,
  StatGridBlockSchema,
]);

export type ArticleEnhancementBlock = z.infer<typeof ArticleEnhancementBlockSchema>;

export const ArticleEnhancementInsertionSchema = z.object({
  afterParagraph: z.number().int().min(1).max(24),
  blocks: z.array(ArticleEnhancementBlockSchema).min(1).max(3),
});

export const ArticleEnhancementRecordSchema = z.object({
  slug: z.string().min(1),
  sourceHash: z.string().min(1),
  generatedAt: z.string().min(1),
  generator: z.object({
    mode: z.enum(['heuristic', 'openai']),
    model: z.string().min(1).optional(),
  }),
  insertions: z.array(ArticleEnhancementInsertionSchema).max(6),
});

export type ArticleEnhancementRecord = z.infer<typeof ArticleEnhancementRecordSchema>;
export type ArticleEnhancementInsertion = z.infer<typeof ArticleEnhancementInsertionSchema>;

export function getArticleEnhancementKey(slug: string): string {
  return `article-enhancement:${String(slug || '').trim().toLowerCase()}`;
}

export function createArticleSourceHash(input: string | null | undefined): string {
  return createHash('sha256').update(String(input || '')).digest('hex');
}

export async function getStoredArticleEnhancement(
  slug: string,
  sourceHtml?: string | null,
): Promise<ArticleEnhancementRecord | null> {
  if (!slug) return null;

  const { getSystemStore } = await import('@/features/system/server/system-store');
  const record = await getSystemStore().get(getArticleEnhancementKey(slug));
  const parsed = ArticleEnhancementRecordSchema.safeParse(record?.data);
  if (!parsed.success) return null;

  if (typeof sourceHtml === 'string') {
    const currentHash = createArticleSourceHash(sourceHtml);
    if (parsed.data.sourceHash !== currentHash) return null;
  }

  return parsed.data;
}

export async function saveArticleEnhancement(record: ArticleEnhancementRecord): Promise<void> {
  const parsed = ArticleEnhancementRecordSchema.parse(record);
  const { getSystemStore } = await import('@/features/system/server/system-store');
  await getSystemStore().set(getArticleEnhancementKey(parsed.slug), parsed, { merge: false });
}
