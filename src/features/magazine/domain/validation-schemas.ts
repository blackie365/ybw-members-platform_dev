import { z } from 'zod';
import { PAGE_TYPES } from '@/components/admin/magazine-builder/types';

/**
 * Zod schemas for the magazine pipeline. Parse at every boundary so
 * regressions (body vs text alias, missing feature-full template,
 * image URL shape mistakes, structural ToC pages etc.) are caught BEFORE
 * Firestore is written to, not 3 days later when a reader reports it.
 */

const TEMPLATE_IDS = new Set(
  PAGE_TYPES.map((t) => t.id.toLowerCase().trim()),
);

const READER_TEMPLATE_TYPES = [
  'cover',
  'contents',
  'feature-left',
  'feature-right',
  'feature-full',
  'editor-note',
  'ad',
  'back-cover',
] as const;

const UrlString = z
  .string()
  .trim()
  .refine(
    (val) =>
      val.length === 0 ||
      val.startsWith('https://') ||
      val.startsWith('http://') ||
      val.startsWith('/') ||
      val.startsWith('data:') ||
      val.startsWith('./') ||
      val.startsWith('../'),
    'Image/file URLs must be absolute https(s) or site-relative paths.',
  )
  .transform((val) => (val.length === 0 ? undefined : val))
  .pipe(z.string().optional());

const ReaderPageContentSchema = z
  .object({
    title: z.string().trim().min(1, 'title is required').max(400),
    body: z.string().trim().optional(),
    text: z.string().trim().optional(),
    intro: z.string().trim().optional(),
    standfirst: z.string().trim().optional(),
    author: z.string().trim().optional(),
    name: z.string().trim().optional(),
    kicker: z.string().trim().optional(),
    imageUrl: UrlString,
    imageUrls: z.array(z.string().trim()).default([]),
    pdfUrl: UrlString,
    backgroundImage: UrlString,
    videoUrl: UrlString,
    quote: z.string().trim().optional(),
    pullQuotes: z.array(z.string().trim()).default([]),
    items: z
      .array(
        z.object({
          title: z.string().trim().min(1),
          page: z.string().trim().min(1),
        }),
      )
      .optional(),
    ctaLabel: z.string().trim().optional(),
    ctaHref: z.string().trim().optional(),
    label: z.string().trim().optional(),
    mediaLayout: z.string().trim().optional(),
    weight: z.number().finite().optional(),
    isContinuation: z.boolean().optional(),
    continuationLabel: z.string().trim().optional(),
    nextIssue: z.string().trim().optional(),
    snapshotLabel: z.string().trim().optional(),
    image: UrlString,
    featureImage: UrlString,
    heroImage: UrlString,
    mainImage: UrlString,
    coverImage: UrlString,
    photo: UrlString,
    headshot: UrlString,
    portrait: UrlString,
    images: z.array(z.string().trim()).default([]),
    gallery: z.array(z.string().trim()).default([]),
    additionalImages: z.array(z.string().trim()).default([]),
    logoImage: UrlString,
    logoImages: z.array(z.string().trim()).default([]),
    partnerLogo: UrlString,
  })
  .passthrough()
  .transform((content) => {
    const bodyOut = String(content.body || content.text || '').trim();
    const introOut = String(content.standfirst || content.intro || '').trim();
    return {
      ...content,
      body: bodyOut,
      text: bodyOut,
      standfirst: introOut,
      intro: introOut,
    };
  });

export const ReaderPageSchema = z
  .object({
    id: z.string().trim().min(1, 'ReaderPage.id is required'),
    position: z.coerce.number().int().finite(),
    template: z.enum(READER_TEMPLATE_TYPES, {
      errorMap(issue, _ctx) {
        if (issue.code === 'invalid_enum_value') {
          const received = String(issue.received);
          const hint = TEMPLATE_IDS.has(received.toLowerCase())
            ? ` (builder template "${received}" needs a template alias map in idml-template-mapper)`
            : '';
          return {
            message: `template "${issue.received}" is not a valid ReaderPage template${hint}. Valid: ${READER_TEMPLATE_TYPES.join(', ')}`,
          };
        }
        return { message: 'template is required' };
      },
    }),
    content: ReaderPageContentSchema,
  })
  .passthrough();

export const ReaderEditionSchema = z
  .object({
    id: z.string().trim().min(1, 'ReaderEdition.id is required'),
    slug: z
      .string()
      .trim()
      .min(1, 'slug is required')
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        'slug must be lowercase kebab-case (letters, digits, single hyphens)',
      ),
    title: z.string().trim().min(2, 'title is required').max(300),
    description: z.string().trim().default(''),
    coverImage: z.string().trim().default(''),
    publishDate: z
      .string()
      .trim()
      .refine((v) => Number.isNaN(Date.parse(v)) === false, 'publishDate must be ISO parseable'),
    pageCount: z.coerce.number().int().nonnegative().optional(),
    pages: z.array(ReaderPageSchema).min(1, 'At least 1 page is required'),
    createdAt: z
      .string()
      .trim()
      .default(() => new Date().toISOString()),
    issueId: z.string().trim().optional(),
    schemaVersion: z.coerce.number().int().finite().optional(),
  })
  .passthrough()
  .transform((edition) => {
    const pages = edition.pages
      .map((p, idx) => ({
        ...p,
        position: typeof p.position === 'number' && Number.isFinite(p.position) ? p.position : idx + 1,
      }))
      .sort((a, b) => a.position - b.position);
    return { ...edition, pages, pageCount: pages.length };
  });

export type ValidReaderEdition = z.infer<typeof ReaderEditionSchema>;
export type ValidReaderPage = z.infer<typeof ReaderPageSchema>;
export type ValidReaderPageContent = z.infer<typeof ReaderPageContentSchema>;

const BuilderPageTypeEnum = z.enum(
  PAGE_TYPES.map((t) => t.id) as unknown as readonly [string, ...string[]],
  {
    errorMap(issue, _ctx) {
      if (issue.code === 'invalid_enum_value') {
        return {
          message: `Page type "${issue.received}" is not registered in builder PAGE_TYPES. Valid: ${PAGE_TYPES.map((t) => t.id).join(', ')}`,
        };
      }
      return { message: 'type is required' };
    },
  },
);

export const MagazinePageSchema = z
  .object({
    docId: z.string().trim().min(1),
    id: z.coerce.number().int().finite(),
    type: BuilderPageTypeEnum,
    storyId: z.string().trim().optional(),
    sourceRef: z.string().trim().optional(),
    generatedFromStoryLibrary: z.boolean().optional(),
    readOnly: z.boolean().optional(),
    sourceReaderEditionId: z.string().trim().optional(),
    content: z.record(z.any()).default({}),
    createdAt: z.string().trim().default(() => new Date().toISOString()),
    updatedAt: z.string().trim().optional(),
  })
  .passthrough();

export type ValidMagazinePage = z.infer<typeof MagazinePageSchema>;

export const StoryLibraryItemSchema = z
  .object({
    id: z.string().trim().min(1),
    title: z.string().trim().min(1).max(400),
    author: z.string().trim().optional(),
    standfirst: z.string().trim().optional(),
    text: z.string().trim().default(''),
    imageUrl: UrlString.default(''),
    pdfUrl: UrlString.default(''),
    includedInPremiumReader: z.boolean().optional(),
    premiumReaderPriority: z.number().finite().optional(),
    premiumReaderContentType: z.string().trim().optional(),
    premiumReaderPlacementPreference: z.string().trim().optional(),
    imageFileNames: z.array(z.string().trim()).default([]),
    sourceRef: z.string().trim().optional(),
    source: z
      .object({
        type: z.string().trim().optional(),
        fileName: z.string().trim().optional(),
        path: z.string().trim().optional(),
      })
      .passthrough()
      .optional(),
    createdAt: z.string().trim().default(() => new Date().toISOString()),
  })
  .passthrough()
  .transform((item) => {
    const textOut = String(item.text || '').trim();
    const introOut = String(item.standfirst || '').trim();
    return { ...item, text: textOut, standfirst: introOut };
  });

export type ValidStoryLibraryItem = z.infer<typeof StoryLibraryItemSchema>;

export const MagazineIssueSchema = z
  .object({
    id: z.string().trim().min(1),
    slug: z
      .string()
      .trim()
      .min(1, 'issue slug is required for reader routing')
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        'issue slug must be lowercase kebab-case',
      ),
    title: z.string().trim().min(2).max(300),
    coverImage: z.string().trim().default(''),
    publishDate: z
      .string()
      .trim()
      .refine((v) => Number.isNaN(Date.parse(v)) === false, 'publishDate must be ISO parseable'),
    description: z.string().trim().default(''),
    pdfUrl: z.string().trim().default(''),
    downloadUrl: z.string().trim().optional(),
    isLatest: z.boolean().default(false),
    tags: z.array(z.string().trim()).default([]),
    ghostSyncTag: z.string().trim().optional(),
    readerType: z.enum(['custom', 'issuu']).optional(),
    autoSyncCover: z.boolean().optional(),
    flipbookUrl: z.string().trim().optional(),
    featureInFlipbook: z.boolean().optional(),
    storyLibrary: z.array(StoryLibraryItemSchema).default([]),
    pages: z.array(MagazinePageSchema).default([]),
    schemaVersion: z.coerce.number().int().finite().optional(),
  })
  .passthrough();

export type ValidMagazineIssue = z.infer<typeof MagazineIssueSchema>;

/**
 * Wrapper that returns a structured {ok, value, error, issues} tuple instead
 * of throwing — perfect for server-action handlers where we want to surface
 * every validation issue to the admin in the toast modal, not just the first.
 */
export function safeParseMagazine<T = unknown>(
  schema: z.ZodType<T, any, any>,
  value: unknown,
  label: string,
):
  | { ok: true; value: T }
  | {
      ok: false;
      error: string;
      issues: Array<{ path: string; message: string }>;
    } {
  const result = schema.safeParse(value);
  if (result.success) return { ok: true, value: result.data as T };
  const issues = result.error.issues.map((iss) => ({
    path: iss.path.map((p) => String(p)).join('.') || '(root)',
    message: iss.message,
  }));
  const flat = issues.map((i) => `  - ${i.path}: ${i.message}`).join('\n');
  return {
    ok: false,
    error: `${label} failed Zod validation:\n${flat}`,
    issues,
  };
}
