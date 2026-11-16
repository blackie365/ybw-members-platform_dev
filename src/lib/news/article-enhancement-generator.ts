import { getArticleStandfirst } from '@/lib/news/article-standfirst';
import {
  type ArticleEnhancementBlock,
  ArticleEnhancementInsertionSchema,
  ArticleEnhancementRecordSchema,
  createArticleSourceHash,
  getStoredArticleEnhancement,
  saveArticleEnhancement,
} from '@/lib/news/article-enhancements';

type GhostPostLike = {
  slug: string;
  title?: string | null;
  html?: string | null;
  plaintext?: string | null;
  primary_tag?: { name?: string | null } | null;
};

type EnhancementDraft = {
  insertions: Array<{
    afterParagraph: number;
    blocks: ArticleEnhancementBlock[];
  }>;
};

type ArticleEnhancementGeneratorMode = 'heuristic' | 'openai' | 'gemini';

type GeneratedEnhancementDraft = {
  draft: EnhancementDraft;
  generator: {
    mode: Exclude<ArticleEnhancementGeneratorMode, 'heuristic'>;
    model: string;
  };
};

const EnhancementDraftSchema = ArticleEnhancementRecordSchema.pick({ insertions: true });

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/responses';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';
const DEFAULT_GEMINI_MODEL = 'gemini-1.5-flash';

export async function maybeGenerateAndStoreArticleEnhancement(post: GhostPostLike) {
  const slug = String(post?.slug || '').trim();
  const html = String(post?.html || '');
  if (!slug || !html) {
    return { stored: false, mode: 'heuristic' as const, blocks: 0, reason: 'missing-post-html' };
  }

  const existing = await getStoredArticleEnhancement(slug, html);
  if (existing) {
    return {
      stored: false,
      mode: existing.generator.mode,
      blocks: countBlocks(existing.insertions),
      reason: 'up-to-date',
    };
  }

  const aiDraft = await generateAiEnhancementDraft(post, slug);
  const fallbackDraft = generateHeuristicEnhancementDraft(post);

  const validated = validateEnhancementDraft(post, aiDraft?.draft || fallbackDraft, aiDraft?.generator || {
    mode: 'heuristic',
  });

  await saveArticleEnhancement(validated);

  return {
    stored: true,
    mode: validated.generator.mode,
    blocks: countBlocks(validated.insertions),
    reason: 'saved',
  };
}

export function generateHeuristicEnhancementDraft(post: GhostPostLike): EnhancementDraft {
  const paragraphs = extractParagraphs(post.html);
  const lead = getArticleStandfirst(post as never) || paragraphs[0] || post.title || '';
  const sentences = splitSentences(extractSourceText(post));
  const pullQuote = extractQuotedPassages(extractSourceText(post))[0];
  const insertions: EnhancementDraft['insertions'] = [];

  if (paragraphs.length >= 2 && lead) {
    insertions.push({
      afterParagraph: 2,
      blocks: [
        {
          type: 'subhead',
          kicker: cleanShortLabel(post.primary_tag?.name) || 'In focus',
          text: trimSentence(lead, 110),
        },
      ],
    });
  }

  if (pullQuote) {
    insertions.push({
      afterParagraph: Math.min(Math.max(3, paragraphs.length >= 4 ? 4 : 3), Math.max(paragraphs.length, 1)),
      blocks: [
        {
          type: 'pull_quote',
          quote: pullQuote,
        },
      ],
    });
  }

  const factualPoints = sentences
    .filter((sentence) => sentence.length >= 45 && sentence.length <= 220)
    .slice(0, 4);

  if (factualPoints.length >= 2) {
    insertions.push({
      afterParagraph: Math.min(Math.max(4, paragraphs.length >= 6 ? 6 : 4), Math.max(paragraphs.length, 1)),
      blocks: [
        {
          type: 'key_points',
          title: 'At a glance',
          points: factualPoints.slice(0, 3),
        },
      ],
    });
  }

  return { insertions };
}

function validateEnhancementDraft(
  post: GhostPostLike,
  draft: EnhancementDraft,
  generator: { mode: ArticleEnhancementGeneratorMode; model?: string },
) {
  const html = String(post.html || '');
  const slug = String(post.slug || '').trim();
  const paragraphCount = Math.max(extractParagraphs(html).length, 1);
  const sourceText = extractSourceText(post);
  const sourceComparable = normalizeComparableText(sourceText);
  const usedFingerprints = new Set<string>();
  let blockBudget = 5;

  const insertions = EnhancementDraftSchema.parse(draft).insertions
    .map((insertion) => {
      const blocks: ArticleEnhancementBlock[] = [];

      for (const candidate of insertion.blocks) {
        if (blockBudget <= 0) break;
        const normalized = normalizeBlock(candidate, sourceComparable);
        if (!normalized) continue;
        const fingerprint = JSON.stringify(normalized);
        if (usedFingerprints.has(fingerprint)) continue;
        usedFingerprints.add(fingerprint);
        blocks.push(normalized);
        blockBudget -= 1;
      }

      if (blocks.length === 0) return null;

      return {
        afterParagraph: Math.min(Math.max(insertion.afterParagraph, 1), paragraphCount),
        blocks,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .slice(0, 6);

  return ArticleEnhancementRecordSchema.parse({
    slug,
    sourceHash: createArticleSourceHash(html),
    generatedAt: new Date().toISOString(),
    generator,
    insertions,
  });
}

async function generateAiEnhancementDraft(
  post: GhostPostLike,
  slug: string,
): Promise<GeneratedEnhancementDraft | null> {
  const provider = getArticleEnhancementProvider();
  const attempts: Array<() => Promise<GeneratedEnhancementDraft | null>> = [];

  if (provider === 'gemini' || provider === 'auto') {
    attempts.push(() => generateGeminiEnhancementDraft(post));
  }

  if (provider === 'openai' || provider === 'auto') {
    attempts.push(() => generateOpenAiEnhancementDraft(post));
  }

  for (const attempt of attempts) {
    try {
      const result = await attempt();
      if (result) return result;
    } catch (error) {
      console.warn(`[article-enhancements] AI draft failed for ${slug}:`, error);
    }
  }

  return null;
}

function normalizeBlock(
  block: ArticleEnhancementBlock,
  sourceComparable: string,
): ArticleEnhancementBlock | null {
  switch (block.type) {
    case 'subhead':
      return {
        ...block,
        text: trimSentence(block.text, 140),
        kicker: cleanShortLabel(block.kicker),
      };

    case 'pull_quote': {
      if (!containsComparableFragment(sourceComparable, block.quote)) return null;
      const attribution =
        block.attribution && containsComparableFragment(sourceComparable, block.attribution)
          ? block.attribution.trim()
          : undefined;
      return {
        type: 'pull_quote',
        quote: block.quote.trim(),
        attribution,
      };
    }

    case 'fact_box': {
      const items = block.items.filter((item) => containsComparableFragment(sourceComparable, item)).slice(0, 5);
      if (items.length < 2) return null;
      return {
        type: 'fact_box',
        title: trimSentence(block.title, 60),
        items,
      };
    }

    case 'key_points': {
      const points = block.points.filter((point) => containsComparableFragment(sourceComparable, point)).slice(0, 5);
      if (points.length < 2) return null;
      return {
        type: 'key_points',
        title: block.title ? trimSentence(block.title, 60) : undefined,
        points,
      };
    }

    case 'stat_grid': {
      const stats = block.stats
        .filter((stat) => containsComparableFragment(sourceComparable, stat.value))
        .map((stat) => ({
          label: trimSentence(stat.label, 40),
          value: stat.value.trim(),
          detail:
            stat.detail && containsComparableFragment(sourceComparable, stat.detail)
              ? stat.detail.trim()
              : undefined,
        }))
        .slice(0, 4);

      if (stats.length === 0) return null;
      return {
        type: 'stat_grid',
        title: block.title ? trimSentence(block.title, 60) : undefined,
        stats,
      };
    }
  }
}

async function generateOpenAiEnhancementDraft(post: GhostPostLike): Promise<GeneratedEnhancementDraft | null> {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) return null;

  const sourceText = extractSourceText(post);
  if (!sourceText) return null;

  const model = getOpenAiEnhancementModel();
  const requestPayload = {
    title: post.title || '',
    slug: post.slug,
    primaryTag: post.primary_tag?.name || '',
    standfirst: getArticleStandfirst(post as never) || '',
    paragraphCount: extractParagraphs(post.html).length,
    articleText: trimForModel(sourceText, 12_000),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const payload = {
      model,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: getArticleEnhancementSystemPrompt(),
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify(requestPayload),
            },
          ],
        },
      ],
      max_output_tokens: 1600,
    };

    const response = await fetch(OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`OpenAI responded ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    const rawText = extractResponseText(json);
    if (!rawText) return null;

    const parsed = parseJsonObject(rawText);
    const validated = EnhancementDraftSchema.safeParse(parsed);
    return validated.success
      ? {
          draft: validated.data,
          generator: {
            mode: 'openai',
            model,
          },
        }
      : null;
  } finally {
    clearTimeout(timeout);
  }
}

async function generateGeminiEnhancementDraft(post: GhostPostLike): Promise<GeneratedEnhancementDraft | null> {
  const apiKey = String(process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || '').trim();
  if (!apiKey) return null;

  const sourceText = extractSourceText(post);
  if (!sourceText) return null;

  const model = getGeminiEnhancementModel();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const payload = {
      systemInstruction: {
        parts: [
          {
            text: getArticleEnhancementSystemPrompt(),
          },
        ],
      },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: JSON.stringify({
                title: post.title || '',
                slug: post.slug,
                primaryTag: post.primary_tag?.name || '',
                standfirst: getArticleStandfirst(post as never) || '',
                paragraphCount: extractParagraphs(post.html).length,
                articleText: trimForModel(sourceText, 12_000),
              }),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1600,
        responseMimeType: 'application/json',
      },
    };

    const response = await fetch(
      `${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new Error(`Gemini responded ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    const rawText = extractGeminiResponseText(json);
    if (!rawText) return null;

    const parsed = parseJsonObject(rawText);
    const validated = EnhancementDraftSchema.safeParse(parsed);
    return validated.success
      ? {
          draft: validated.data,
          generator: {
            mode: 'gemini',
            model,
          },
        }
      : null;
  } finally {
    clearTimeout(timeout);
  }
}

function getArticleEnhancementProvider(): 'auto' | 'openai' | 'gemini' {
  const provider = String(process.env.ARTICLE_ENHANCEMENT_PROVIDER || 'auto')
    .trim()
    .toLowerCase();

  if (provider === 'openai' || provider === 'gemini') return provider;
  return 'auto';
}

function getOpenAiEnhancementModel(): string {
  return (
    String(process.env.OPENAI_ARTICLE_ENHANCEMENT_MODEL || process.env.ARTICLE_ENHANCEMENT_MODEL || DEFAULT_OPENAI_MODEL).trim() ||
    DEFAULT_OPENAI_MODEL
  );
}

function getGeminiEnhancementModel(): string {
  return (
    String(
      process.env.GEMINI_ARTICLE_ENHANCEMENT_MODEL ||
        process.env.ARTICLE_ENHANCEMENT_MODEL ||
        DEFAULT_GEMINI_MODEL,
    ).trim() || DEFAULT_GEMINI_MODEL
  );
}

function getArticleEnhancementSystemPrompt(): string {
  return (
    'You are preparing article enhancement blocks for a newspaper-style website. ' +
    'Return JSON only. Never invent facts, quotes, names, numbers, or commentary. ' +
    'Allowed block types: subhead, pull_quote, fact_box, key_points, stat_grid. ' +
    'For pull_quote.quote, fact_box.items, key_points.points, and stat_grid.detail, copy exact wording from the article wherever possible. ' +
    'For stat_grid.value, use exact values from the article text. ' +
    'If the article does not clearly support a block, omit it. Keep the result lean: 0-4 insertions, max 5 blocks total.'
  );
}

function extractResponseText(responseJson: any): string {
  if (typeof responseJson?.output_text === 'string' && responseJson.output_text.trim()) {
    return responseJson.output_text.trim();
  }

  const text = Array.isArray(responseJson?.output)
    ? responseJson.output
        .flatMap((item: any) => (Array.isArray(item?.content) ? item.content : []))
        .map((part: any) => part?.text)
        .filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
        .join('\n')
    : '';

  return text.trim();
}

function extractGeminiResponseText(responseJson: any): string {
  const text = Array.isArray(responseJson?.candidates)
    ? responseJson.candidates
        .flatMap((candidate: any) => (Array.isArray(candidate?.content?.parts) ? candidate.content.parts : []))
        .map((part: any) => part?.text)
        .filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
        .join('\n')
    : '';

  return text.trim();
}

function parseJsonObject(raw: string): unknown {
  const direct = raw.trim();
  try {
    return JSON.parse(direct);
  } catch {}

  const start = direct.indexOf('{');
  const end = direct.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    return JSON.parse(direct.slice(start, end + 1));
  }

  throw new Error('No JSON object found in model response');
}

function extractSourceText(post: GhostPostLike): string {
  const plaintext = normalizeWhitespace(decodeHtmlEntities(String(post.plaintext || '')));
  if (plaintext) return plaintext;
  return normalizeWhitespace(stripTags(String(post.html || '')));
}

function extractParagraphs(html: string | null | undefined): string[] {
  const source = String(html || '');
  if (!source) return [];

  const paragraphs = Array.from(source.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
    .map((match) => normalizeWhitespace(decodeHtmlEntities(stripTags(match[1] || ''))))
    .filter(Boolean);

  return paragraphs;
}

function extractQuotedPassages(text: string): string[] {
  const matches: string[] = [];
  const pattern = /["“]([^"”]{40,240})["”]/g;

  for (const match of text.matchAll(pattern)) {
    const quote = normalizeWhitespace(match[1]);
    if (quote && !matches.includes(quote)) matches.push(quote);
  }

  return matches.slice(0, 3);
}

function splitSentences(text: string): string[] {
  return normalizeWhitespace(text)
    .split(/(?<=[.!?])\s+(?=[A-Z0-9“"])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function normalizeComparableText(value: string | null | undefined): string {
  return normalizeWhitespace(
    String(value || '')
      .toLowerCase()
      .replace(/[“”]/g, '"')
      .replace(/[’]/g, "'")
      .replace(/&/g, ' and '),
  );
}

function containsComparableFragment(sourceComparable: string, fragment: string | null | undefined): boolean {
  const comparable = normalizeComparableText(fragment);
  if (!comparable) return false;
  return sourceComparable.includes(comparable);
}

function normalizeWhitespace(value: string): string {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(value: string): string {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function decodeHtmlEntities(value: string): string {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&(apos|#39|#x27);/gi, "'")
    .replace(/&(quot|#34);/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function trimSentence(value: string | null | undefined, maxLength: number): string {
  const text = normalizeWhitespace(String(value || ''));
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1).trim()}…`;
}

function cleanShortLabel(value: string | null | undefined): string | undefined {
  const text = normalizeWhitespace(String(value || ''));
  return text ? trimSentence(text, 48) : undefined;
}

function trimForModel(value: string, maxLength: number): string {
  const text = normalizeWhitespace(value);
  return text.length <= maxLength ? text : text.slice(0, maxLength);
}

function countBlocks(insertions: Array<{ blocks: unknown[] }>): number {
  return insertions.reduce((sum, insertion) => sum + insertion.blocks.length, 0);
}
