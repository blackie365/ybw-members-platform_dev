#!/usr/bin/env tsx
/**
 * Backfill magazine_issues documents so the builder-primary reader flow works
 * on every issue without relying on magazine_reader_editions.
 *
 * For every issue document in magazine_issues:
 *   1. Derive a slug (priority: slug field → readerEditionSlug → ghostSyncTag → slugify(title) → slugify(doc id)).
 *   2. Write slug back to the issue doc if missing/changed from derived.
 *   3. Load magazine_issues/{issueId}/pages subcollection. If subcollection has 0 docs:
 *        a. Find the matching ReaderEdition via either issue.readerEditionId,
 *           issue.readerEditionSlug exact match on slug, or issueId match.
 *        b. For every ReaderEdition page, create a matching builder page
 *           sub-doc (reverse of mapBuilderIssueToReaderEdition), normalising
 *           content via `normalizeMagazinePageContent` so round-trips are safe.
 *   4. Stamp issue with CURRENT_READER_SCHEMA_VERSION so Fix 3's fast-path kicks in.
 *
 * Usage:
 *   # Preview changes only (default)
 *   tsx scripts/migrate-issues-reader-slug-pages.ts --dry
 *
 *   # Actually apply writes
 *   tsx scripts/migrate-issues-reader-slug-pages.ts --apply
 *
 * Requires FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY env
 * vars (standard Firebase Admin setup, see .env.example and .dbg/*.env).
 */
import 'dotenv/config';
import { resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore';
import slugify from '@sindresorhus/slugify';
import {
  deriveIssueSlug,
  BUILDER_TYPE_TO_READER_TEMPLATE,
} from '../src/features/magazine/domain/builder-to-reader';
import {
  CURRENT_READER_SCHEMA_VERSION,
} from '../src/features/magazine/server/simple-reader';
import {
  normalizeMagazinePageContent,
  fixMagazineImageUrl,
} from '../src/lib/magazine-utils';

const DRY = !process.argv.includes('--apply') || process.argv.includes('--dry');
console.log(`\n🔍 Backfill running in ${DRY ? '✨ DRY-RUN ✨' : '✅ APPLY'} mode.\n`);

function maybeLoadEnvFile() {
  const candidates = [
    resolve(process.cwd(), '.env.local'),
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '.dbg/prod-500.env'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      // Explicitly re-read and apply (earlier import 'dotenv/config' may have
      // loaded an earlier candidate that lacked FIREBASE_PRIVATE_KEY, and the
      // loader does not override already-set process.env entries).
      try {
        const buf = readFileSync(p, 'utf8');
        for (const rawLine of buf.split('\n')) {
          const line = rawLine.trim();
          if (!line || line.startsWith('#') || !line.includes('=')) continue;
          const eqIdx = line.indexOf('=');
          let key = line.slice(0, eqIdx).trim();
          let val = line.slice(eqIdx + 1).trim();
          if (!key || /^(NEXT_PUBLIC_)?(STRIPE|CLERK|GHOST|MAILGUN|RESEND|UPSTASH|KV|KV_REST_API|OPENAI|OTEL|NODE)\b/.test(key)) continue;
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (key === 'FIREBASE_PRIVATE_KEY' || key === 'FIREBASE_CLIENT_EMAIL' || key === 'FIREBASE_PROJECT_ID' || key === 'NEXT_PUBLIC_FIREBASE_PROJECT_ID') {
            process.env[key] = val;
          }
        }
        const hasKey = /^FIREBASE_PRIVATE_KEY\s*=/m.test(buf);
        console.log(`   • env file found: ${p} (has FIREBASE_PRIVATE_KEY=${hasKey})`);
      } catch {}
      break;
    }
  }
}
maybeLoadEnvFile();

function ensureAdminFirestore(): Firestore {
  if (getApps().length === 0) {
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
    const privateKey = privateKeyRaw?.replace(/\\n/g, '\n');
    if (!projectId || !clientEmail || !privateKey) {
      console.error('   ❌ Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY in env');
      process.exit(1);
    }
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }
  return getFirestore();
}

interface ReaderPageLegacy {
  id?: string;
  position?: number;
  template?: string;
  content?: Record<string, unknown> & {
    pageNumber?: number;
    printPage?: number;
    title?: string;
    headline?: string;
    standfirst?: string;
    intro?: string;
    subtitle?: string;
    kicker?: string;
    body?: string;
    text?: string;
    author?: string;
    byline?: string;
    imageUrl?: string;
    imageUrls?: string[];
    image?: string;
    coverImage?: string;
    heroImage?: string;
    featureImage?: string;
    mainImage?: string;
    images?: string[];
    gallery?: string[];
    additionalImages?: string[];
    backgroundImage?: string;
    logoImage?: string;
    logoImages?: string[];
    partnerLogo?: string;
    pdfUrl?: string;
    items?: unknown[];
    name?: string;
    quote?: string;
    pullQuotes?: string[];
    ctaLabel?: string;
    ctaHref?: string;
    label?: string;
    mediaLayout?: string;
  };
}

const REVERSE_TEMPLATE: Record<string, string> = (() => {
  const rev: Record<string, string> = {};
  for (const [k, v] of Object.entries(BUILDER_TYPE_TO_READER_TEMPLATE)) {
    if (!(v in rev)) rev[v] = k;
  }
  // Specific overrides for fidelity
  rev['editor-note'] = 'editorial';
  rev['ad'] = 'full-page-ad';
  return rev;
})();

function mapReaderPageToBuilder(readerPage: ReaderPageLegacy, idx: number): {
  id: number;
  type: string;
  sourceRef: string;
  content: Record<string, unknown>;
} {
  const template = String(readerPage.template || '').trim().toLowerCase();
  const builderType = REVERSE_TEMPLATE[template] || (
    /ad/i.test(template) ? 'full-page-ad' :
    /cover/i.test(template) ? 'cover' :
    /back/i.test(template) ? 'back-cover' :
    /editor|note|column/i.test(template) ? 'editorial' :
    /contents|toc|index/i.test(template) ? 'contents' :
    /lifestyle/i.test(template) ? 'lifestyle' :
    /spotlight/i.test(template) ? 'spotlight' :
    /partner/i.test(template) ? 'partner' :
    /full.*feature|feature.*full/i.test(template) ? 'feature-full' :
    /left/i.test(template) ? 'feature-left' :
    /right/i.test(template) ? 'feature-right' : 'feature-full'
  );
  const id = typeof readerPage.position === 'number' ? readerPage.position : idx + 1;
  const sourceRef = String(readerPage.id || `page-${id}-${template}`);

  const raw: Record<string, unknown> = readerPage.content && typeof readerPage.content === 'object'
    ? { ...readerPage.content }
    : {};
  const normalized = normalizeMagazinePageContent(raw) as Record<string, unknown>;

  const body = String(
    normalized.body ?? normalized.text ?? normalized.article ?? normalized.storyText ?? '',
  ).trim();
  const standfirst = String(
    normalized.standfirst ??
      normalized.intro ??
      normalized.subtitle ??
      normalized.description ??
      normalized.kicker ??
      '',
  ).trim();
  const title = String(
    normalized.title ??
      normalized.headline ??
      normalized.name ??
      normalized.brand ??
      '',
  ).trim();

  const hero = fixMagazineImageUrl(
    String(
      normalized.imageUrl ??
        normalized.coverImage ??
        normalized.heroImage ??
        normalized.featureImage ??
        normalized.mainImage ??
        normalized.image ??
        normalized.photo ??
        normalized.headshot ??
        normalized.portrait ??
        (Array.isArray(normalized.imageUrls) ? normalized.imageUrls[0] : '') ??
        (Array.isArray(normalized.images) ? normalized.images[0] : '') ??
        '',
    ),
  );
  const gallery: string[] = Array.from(
    new Set(
      ([
        normalized.imageUrls,
        normalized.images,
        normalized.gallery,
        normalized.additionalImages,
      ] as unknown[])
        .flatMap((arr) => (Array.isArray(arr) ? arr : []))
        .map((s) => fixMagazineImageUrl(String(s || '')))
        .filter(Boolean)
        .concat(hero ? [hero] : []),
    ),
  );

  return {
    id,
    type: builderType,
    sourceRef,
    content: {
      title,
      headline: title,
      name: String(normalized.name || title || '').trim() || undefined,
      body,
      text: body,
      article: body,
      storyText: body,
      standfirst,
      intro: standfirst,
      subtitle: String(normalized.subtitle || standfirst || '').trim() || undefined,
      description: String(normalized.description || standfirst || '').trim() || undefined,
      kicker: String(normalized.kicker || '').trim() || undefined,
      author: String(normalized.author || normalized.byline || '').trim() || undefined,
      byline: String(normalized.byline || normalized.author || '').trim() || undefined,
      brand: String(normalized.brand || normalized.name || '').trim() || undefined,
      image: hero,
      imageUrl: hero,
      coverImage: hero,
      heroImage: hero,
      featureImage: hero,
      mainImage: hero,
      photo: hero,
      headshot: hero,
      portrait: hero,
      imageUrls: gallery,
      images: gallery,
      gallery,
      additionalImages: gallery,
      backgroundImage: fixMagazineImageUrl(String(normalized.backgroundImage || '')) || undefined,
      logoImage: fixMagazineImageUrl(
        String(normalized.logoImage || normalized.logo || normalized.partnerLogo || ''),
      ) || undefined,
      logoImages: Array.isArray(normalized.logoImages)
        ? normalized.logoImages.map((l: unknown) => fixMagazineImageUrl(String(l || ''))).filter(Boolean)
        : undefined,
      partnerLogo: fixMagazineImageUrl(String(normalized.partnerLogo || normalized.logoImage || '')) || undefined,
      pdfUrl: normalized.pdfUrl ? fixMagazineImageUrl(String(normalized.pdfUrl)) : undefined,
      pageNumber: typeof normalized.pageNumber === 'number'
        ? normalized.pageNumber
        : typeof normalized.printPage === 'number'
          ? normalized.printPage
          : undefined,
      items: Array.isArray(normalized.items) ? (normalized.items as any[]) : undefined,
      quote: String(normalized.quote || '').trim() || undefined,
      pullQuotes: Array.isArray(normalized.pullQuotes) ? normalized.pullQuotes as string[] : undefined,
      ctaLabel: String(normalized.ctaLabel || '').trim() || undefined,
      ctaHref: String(normalized.ctaHref || '').trim() || undefined,
      label: String(normalized.label || '').trim() || undefined,
      mediaLayout: String(normalized.mediaLayout || '').trim() || undefined,
    },
  };
}

async function findReaderEditionForIssue(
  db: Firestore,
  issue: { id: string; title: string; readerEditionId?: string; readerEditionSlug?: string; slug?: string },
): Promise<{ id: string; pages: ReaderPageLegacy[] } | null> {
  if (issue.readerEditionId) {
    try {
      const d = await db.collection('magazine_reader_editions').doc(issue.readerEditionId).get();
      if (d.exists) {
        const pages = (d.data()?.pages as ReaderPageLegacy[]) || [];
        return { id: d.id, pages };
      }
    } catch {}
  }
  const slugSearch = issue.slug || issue.readerEditionSlug;
  if (slugSearch) {
    try {
      const snap = await db
        .collection('magazine_reader_editions')
        .where('slug', '==', String(slugSearch))
        .limit(2)
        .get();
      if (!snap.empty) {
        const d = snap.docs[0];
        const pages = (d.data()?.pages as ReaderPageLegacy[]) || [];
        return { id: d.id, pages };
      }
    } catch {}
  }
  try {
    const snap2 = await db
      .collection('magazine_reader_editions')
      .where('issueId', '==', issue.id)
      .orderBy('publishDate', 'desc')
      .limit(2)
      .get();
    if (!snap2.empty) {
      const d = snap2.docs[0];
      const pages = (d.data()?.pages as ReaderPageLegacy[]) || [];
      return { id: d.id, pages };
    }
  } catch {}
  return null;
}

interface Stats {
  issues: number;
  issuesSlugUpdated: number;
  issuesSchemaVersionAdded: number;
  builderPagesEmptyIssues: number;
  builderPagesBackfilledFromReader: number;
  builderPagesAlreadyPopulated: number;
  readerEditionsUsed: number;
  skipped: { id: string; reason: string }[];
  errors: { id: string; error: string }[];
}

async function main() {
  const db = ensureAdminFirestore();
  const issuesSnap = await db
    .collection('magazine_issues')
    .orderBy('publishDate', 'desc')
    .get();
  const issues = issuesSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Record<string, unknown>),
  }));

  const stats: Stats = {
    issues: issues.length,
    issuesSlugUpdated: 0,
    issuesSchemaVersionAdded: 0,
    builderPagesEmptyIssues: 0,
    builderPagesBackfilledFromReader: 0,
    builderPagesAlreadyPopulated: 0,
    readerEditionsUsed: 0,
    skipped: [],
    errors: [],
  };

  for (const issue of issues as Array<Record<string, unknown> & {
    id: string;
    title?: string;
    slug?: string;
    readerEditionId?: string;
    readerEditionSlug?: string;
    ghostSyncTag?: string;
    schemaVersion?: number;
    publishDate?: string;
  }>) {
    const title = String(issue.title || '').trim() || `issue-${issue.id}`;
    console.log(`\n📖 ${title} (id=${issue.id})`);
    try {
      const pagesRef = db.collection('magazine_issues').doc(issue.id).collection('pages');
      const pagesSnap = await pagesRef.orderBy('id', 'asc').limit(1).get();
      const subcount = pagesSnap.size;
      let legacyReader: Awaited<ReturnType<typeof findReaderEditionForIssue>> = null;
      if (subcount === 0) {
        legacyReader = await findReaderEditionForIssue(db, {
          id: issue.id,
          title,
          readerEditionId: issue.readerEditionId,
          readerEditionSlug: issue.readerEditionSlug,
          slug: issue.slug,
        });
      } else {
        if (issue.readerEditionId) {
          try {
            const tmp = await db.collection('magazine_reader_editions').doc(issue.readerEditionId).get();
            if (tmp.exists) {
              legacyReader = { id: tmp.id, pages: [] };
            }
          } catch {}
        }
        if (!legacyReader?.id) {
          try {
            const tmp = await db
              .collection('magazine_reader_editions')
              .where('issueId', '==', issue.id)
              .orderBy('publishDate', 'desc')
              .limit(1)
              .get();
            if (!tmp.empty) {
              legacyReader = { id: tmp.docs[0].id, pages: [] };
            }
          } catch {}
        }
      }

      let derivedSlug = deriveIssueSlug({
        id: issue.id,
        title: issue.title,
        ghostSyncTag: issue.ghostSyncTag,
        readerEditionSlug: issue.readerEditionSlug,
        slug: issue.slug,
      }).toLowerCase();

      // If the issue has been linked to a legacy ReaderEdition whose slug was
      // itself poisoned by an IDML bug (where the cover-page story headline
      // became the edition slug/title), prefer a real edition slug derived
      // from the issue metadata.
      const looksLikeArticleTitle = (s: string) =>
        /(achieves|appoints|announces|awarded|launches|partners|reveals|celebrates|expands|secures|acquires|invests|welcomes|hosts|new\s+[a-z]+\s+(deal|fund|role|initiative)|strategy|results|quarter|profit|growth|record|survey|report)\b/i.test(s) ||
        /^(?:the|a|an|west|east|north|south|new|leading|top|major|global|local|leading|award-winning|multi-award)\b/i.test(s);
      const editionYearRegex = /(?:19|20)\d{2}/;
      const seasonMonthWords = ['january','february','march','april','may','june','july','august','september','october','november','december','winter','spring','summer','autumn','fall'];
      const editionNouns = ['edition','issue','magazine','businesswoman','ybw'];
      const looksLikeEditionSlug = (s: string) => {
        const norm = `-${s.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-`;
        const hasYear = editionYearRegex.test(s);
        const hasSeasonMonth = seasonMonthWords.some((k) => norm.includes(`-${k}-`));
        const hasEditionNoun = editionNouns.some((k) => norm.includes(`-${k}-`));
        return (hasYear && (hasSeasonMonth || hasEditionNoun)) || (hasSeasonMonth && hasEditionNoun);
      };
      const looksLikeBadArticleSlug = (s: string) =>
        looksLikeArticleTitle(s) && !looksLikeEditionSlug(s);

      let legacyRewriteSlug: string | null = null;
      let legacyRewriteTitle: string | null = null;

      if (legacyReader?.id) {
        try {
          const legacyDoc = await db.collection('magazine_reader_editions').doc(legacyReader.id).get();
          if (legacyDoc.exists) {
            const legacy = (legacyDoc.data() as Record<string, unknown>) || {};
            const legacyTitle = String(legacy.title || '').trim();
            const legacySlug = String(legacy.slug || '').trim().toLowerCase();
            const currentSlugField = String(issue.slug || '').trim().toLowerCase();
            const currentRESlug = String(issue.readerEditionSlug || '').trim().toLowerCase();
            const reWriteLegacySlug = looksLikeBadArticleSlug(legacySlug);
            const reWriteLegacyTitle = legacyTitle && looksLikeArticleTitle(legacyTitle);
            const reWriteIssueSlug = currentSlugField && looksLikeBadArticleSlug(currentSlugField);
            const reWriteIssueRESlug = currentRESlug && looksLikeBadArticleSlug(currentRESlug);

            if (looksLikeBadArticleSlug(derivedSlug)) {
              const issueTitle = String(issue.title || '').trim();
              const cleanFromTitle = slugify(issueTitle).toLowerCase();
              if (cleanFromTitle && !looksLikeBadArticleSlug(cleanFromTitle)) {
                console.log(`   • derivedSlug "${derivedSlug}" flagged as article-poisoned → using title slug "${cleanFromTitle}"`);
                derivedSlug = cleanFromTitle;
              }
            }

            if (reWriteLegacySlug || reWriteLegacyTitle || reWriteIssueSlug || reWriteIssueRESlug) {
              const issueTitleClean = String(issue.title || '').trim();
              const issueSlugClean = deriveIssueSlug({
                id: issue.id,
                title: issueTitleClean,
                ghostSyncTag: issue.ghostSyncTag,
                readerEditionSlug: '',
                slug: '',
              }).toLowerCase();
              if (!looksLikeBadArticleSlug(issueSlugClean)) {
                if (derivedSlug !== issueSlugClean) {
                  console.log(`   • overriding slug "${derivedSlug}" → edition-level "${issueSlugClean}" (legacy metadata was poisoned)`);
                  derivedSlug = issueSlugClean;
                }
                if (reWriteLegacySlug || reWriteLegacyTitle) {
                  legacyRewriteSlug = derivedSlug;
                  legacyRewriteTitle = issueTitleClean || legacyTitle;
                  console.log(`   • legacy ReaderEdition ${legacyReader.id} slug="${legacySlug}" title="${legacyTitle}" (article-poisoned) → will rewrite slug+title to edition-level "${legacyRewriteSlug}" / "${legacyRewriteTitle}"`);
                }
              }
            }
          }
        } catch {}
      }

      const currentSlug = String(issue.slug || '').trim().toLowerCase();
      const currentRESlugNow = String(issue.readerEditionSlug || '').trim().toLowerCase();
      const needsSlug = currentSlug !== derivedSlug || currentRESlugNow !== derivedSlug;
      if (currentSlug !== derivedSlug) {
        console.log(`   • slug: "${currentSlug || '(none)'}" → "${derivedSlug}"`);
        stats.issuesSlugUpdated++;
      }
      if (currentRESlugNow !== derivedSlug) {
        console.log(`   • readerEditionSlug: "${currentRESlugNow || '(none)'}" → "${derivedSlug}"`);
        if (currentSlug === derivedSlug) stats.issuesSlugUpdated++;
      }
      if (currentSlug === derivedSlug && currentRESlugNow === derivedSlug && currentSlug) {
        console.log(`   • slug OK: "${currentSlug}"`);
      }

      const currentVersion = typeof issue.schemaVersion === 'number' ? issue.schemaVersion : -1;
      const needsSchemaStamp = currentVersion < CURRENT_READER_SCHEMA_VERSION;
      if (needsSchemaStamp) {
        stats.issuesSchemaVersionAdded++;
      }

      let pagesHandled = false;

      if (subcount === 0 && legacyReader && legacyReader.pages.length > 0) {
        stats.builderPagesEmptyIssues++;
        stats.readerEditionsUsed++;
        stats.builderPagesBackfilledFromReader += legacyReader.pages.length;
        console.log(
          `   • builder pages empty — backfilling ${legacyReader.pages.length} pages from ReaderEdition id=${legacyReader.id}`,
        );
        if (!DRY) {
          const batch = db.batch();
          const issueDocRef = db.collection('magazine_issues').doc(issue.id);
          for (let i = 0; i < legacyReader.pages.length; i += 1) {
            const builderDoc = mapReaderPageToBuilder(legacyReader.pages[i], i);
            const builderId = slugify(
              `page-${String(builderDoc.id).padStart(3, '0')}-${builderDoc.type}-${legacyReader.id}-${i}`,
            );
            const builderData: any = { ...builderDoc };
            delete builderData.docId;
            batch.set(pagesRef.doc(builderId), builderData, { merge: true });
          }
          batch.set(
            issueDocRef,
            {
              slug: derivedSlug,
              readerEditionSlug: derivedSlug,
              schemaVersion: CURRENT_READER_SCHEMA_VERSION,
              updatedAt: new Date().toISOString(),
              ...(issue.readerEditionId
                ? {}
                : { readerEditionId: legacyReader.id }),
            },
            { merge: true },
          );
          await batch.commit();
        }
        pagesHandled = true;
      } else if (subcount === 0) {
        stats.builderPagesEmptyIssues++;
        console.log('   • no builder pages and no legacy ReaderEdition found — will create pages from data/import only.');
      } else {
        stats.builderPagesAlreadyPopulated += subcount;
        console.log(`   • builder pages already populated (≥${subcount} docs, skip backfill)`);
      }

      if (!pagesHandled && (needsSlug || needsSchemaStamp)) {
        if (!DRY) {
          await db.collection('magazine_issues').doc(issue.id).set(
            {
              ...(needsSlug ? { slug: derivedSlug, readerEditionSlug: derivedSlug } : {}),
              ...(needsSchemaStamp ? { schemaVersion: CURRENT_READER_SCHEMA_VERSION } : {}),
              updatedAt: new Date().toISOString(),
            },
            { merge: true },
          );
        }
      }

      if (!DRY && (legacyRewriteSlug || legacyRewriteTitle)) {
        const rewriteEditionId = issue.readerEditionId || legacyReader?.id;
        if (rewriteEditionId) {
          try {
            const editionPayload: Record<string, unknown> = {};
            if (legacyRewriteSlug) editionPayload.slug = legacyRewriteSlug;
            if (legacyRewriteTitle) editionPayload.title = legacyRewriteTitle;
            editionPayload.schemaVersion = CURRENT_READER_SCHEMA_VERSION;
            editionPayload.updatedAt = new Date().toISOString();
            await db
              .collection('magazine_reader_editions')
              .doc(rewriteEditionId)
              .set(editionPayload, { merge: true });
            console.log(
              `   • ✅ legacy ReaderEdition id=${rewriteEditionId} APPLIED slug+title rewrite: ${JSON.stringify(editionPayload)}`,
            );
          } catch (rewriteErr: any) {
            console.warn(
              `   • ⚠️  failed to rewrite legacy ReaderEdition id=${rewriteEditionId}: ${String(rewriteErr?.message || rewriteErr)}`,
            );
          }
        }
      }
    } catch (err: any) {
      console.error(`   ❌ ${String(err?.message || err)}`);
      stats.errors.push({ id: issue.id, error: String(err?.message || err) });
    }
  }

  console.log(`\n\n🎉 Backfill complete (${DRY ? 'dry-run' : 'applied'})`);
  console.log(`   • Issues processed:       ${stats.issues}`);
  console.log(`   • Slugs updated:          ${stats.issuesSlugUpdated}`);
  console.log(`   • schemaVersion added:    ${stats.issuesSchemaVersionAdded}`);
  console.log(`   • Issues w/ empty pages:  ${stats.builderPagesEmptyIssues}`);
  console.log(`   • Pages backfilled:       ${stats.builderPagesBackfilledFromReader} (from ${stats.readerEditionsUsed} legacy ReaderEdition docs)`);
  console.log(`   • Issues w/ pages OK:     ${stats.issues - stats.builderPagesEmptyIssues}`);
  if (stats.errors.length > 0) {
    console.log(`   • Errors:                 ${stats.errors.length}`);
    for (const e of stats.errors) console.log(`      - ${e.id}: ${e.error}`);
  }
  console.log('');
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
