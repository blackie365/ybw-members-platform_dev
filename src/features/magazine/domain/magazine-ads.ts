/**
 * Magazine ad catalog + spread slot resolution.
 *
 * Postgres-backed (Phase 5): a small `magazine_ads` catalog holds the sold /
 * reserved ad creative for the newspaper spreads. The reader utilities below
 * are pure (no DB access) so the fill logic is unit-testable:
 *
 *   - `normalizeMagazineAdRecord`   coerce a stored row into a creative.
 *   - `applyMagazineAdsToEdition`   attach creative to spread pages.
 *
 * Fill precedence for a spread page (feature-left / feature-right / editor-note):
 *   1. explicit `content.ads` array  — trusted verbatim.
 *   2. explicit `content.adSlots` number — filled from the catalog (0 = none,
 *      reserved boxes stay visible when the catalog is empty).
 *   3. default: a spread that already has a pull-quote rail gets ONE ad slot
 *      when the catalog has enabled creative. This is the "use the ads you've
 *      set up" behaviour — the Ads-tab / magazine_ads catalog is the on/off
 *      switch, and no per-page config is required to start.
 *
 * Slots cap at 6 to keep a misconfigured edition from overflowing a rail.
 */

export interface MagazineAdRecord {
  id: string;
  label?: string;
  image?: string;
  url?: string;
  alt?: string;
  enabled?: boolean;
  position?: number;
}

/** Creative shape consumed by the newspaper spread rail (mirrors AdSlotData). */
export interface MagazineAdCreative {
  image: string;
  url: string;
  alt: string;
  label: string;
}

const SPREAD_TEMPLATES = new Set([
  'feature-left',
  'feature-right',
  'feature-full',
  'editor-note',
]);

const MAX_SLOTS = 6;

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeMagazineAdRecord(raw: any): MagazineAdRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const image = str(raw.image || raw.imageUrl || raw.src);
  if (!image) return null;
  return {
    id: str(raw.id),
    label: str(raw.label || raw.name) || 'Advertisement',
    image,
    url: str(raw.url || raw.href || raw.linkUrl),
    alt: str(raw.alt || raw.altText) || 'Advertisement',
    enabled: raw.enabled !== false,
    position: typeof raw.position === 'number' ? raw.position : 0,
  };
}

export function toCreative(record: MagazineAdRecord): MagazineAdCreative {
  return {
    image: record.image || '',
    url: record.url || '',
    alt: record.alt || '',
    label: record.label || '',
  };
}

export function sortMagazineAds(ads: MagazineAdRecord[]): MagazineAdRecord[] {
  return [...ads]
    .filter((ad) => ad && normalizeMagazineAdRecord(ad) !== null)
    .sort((a, b) => {
      const aPos = typeof a.position === 'number' ? a.position : Number.MAX_SAFE_INTEGER;
      const bPos = typeof b.position === 'number' ? b.position : Number.MAX_SAFE_INTEGER;
      if (aPos !== bPos) return aPos - bPos;
      return String(a.id).localeCompare(String(b.id));
    });
}

function normalizeExplicitAds(raw: unknown[]): MagazineAdCreative[] {
  const out: MagazineAdCreative[] = [];
  for (const item of raw.slice(0, MAX_SLOTS)) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const image = str(r.image || r.imageUrl || r.src);
    if (!image) continue;
    out.push({
      image,
      url: str(r.url || r.href || r.linkUrl),
      alt: str(r.alt || r.altText || r.label) || 'Advertisement',
      label: str(r.label || r.name) || 'Advertisement',
    });
  }
  return out;
}

function isSpreadPage(template: unknown): boolean {
  return SPREAD_TEMPLATES.has(String(template || '').trim());
}

function pageHasQuoteRail(content: any): boolean {
  if (!content || typeof content !== 'object') return false;
  return (Array.isArray(content.pullQuotes) && content.pullQuotes.length > 0) || Boolean(str(content.quote));
}

/**
 * Attach ad creative to a reader edition's spread pages.
 *
 * Returns a new edition object with enriched page content; never mutates the
 * input. Pages without a rail and without explicit ad config are left alone.
 */
export function applyMagazineAdsToEdition(
  edition: { pages?: unknown[] } | null | undefined,
  catalog: MagazineAdRecord[],
): { pages?: unknown[] } | null | undefined {
  if (!edition || !Array.isArray(edition.pages) || edition.pages.length === 0) return edition;

  const pages = edition.pages.map((rawPage: any) => {
    if (!rawPage || typeof rawPage !== 'object') return rawPage;
    const page = rawPage as { template?: unknown; content?: Record<string, unknown> };
    if (!isSpreadPage(page.template)) return rawPage;

    const content: Record<string, unknown> =
      page.content && typeof page.content === 'object' ? { ...page.content } : {};
    const explicitAds = Array.isArray(content.ads) ? content.ads : null;
    const explicitCount =
      typeof content.adSlots === 'number' && Number.isFinite(content.adSlots)
        ? Math.max(0, Math.floor(Number(content.adSlots)))
        : null;

    // Explicit `ads: []` with no count means "no ads here" — never override it.
    if (explicitAds !== null && explicitAds.length === 0 && explicitCount === null) {
      return rawPage;
    }

    const hasCatalogCreative = sortMagazineAds(catalog).some((ad) => ad.enabled !== false);

    let base: MagazineAdCreative[] = [];
    if (explicitAds !== null) base = normalizeExplicitAds(explicitAds as unknown[]);

    let slotCount: number;
    if (explicitCount !== null) {
      slotCount = Math.max(base.length, explicitCount);
    } else if (explicitAds !== null) {
      slotCount = base.length;
    } else if (pageHasQuoteRail(content) && hasCatalogCreative) {
      slotCount = 1;
    } else {
      return rawPage;
    }

    slotCount = Math.min(slotCount, MAX_SLOTS);

    // Fill extra slots (beyond explicit creative) from the catalog; unused
    // capacity shows as reserved placeholders when the catalog is empty.
    const pool = sortMagazineAds(catalog)
      .filter((ad) => ad.enabled !== false)
      .map(toCreative);
    const ads: MagazineAdCreative[] = [];
    for (let i = 0; i < slotCount; i++) {
      if (i < base.length) {
        ads.push(base[i]);
      } else if (pool.length > 0) {
        ads.push(pool[i % pool.length]);
      } else {
        ads.push({ image: '', url: '', alt: 'Advertisement', label: 'Advertisement' });
      }
    }

    return {
      ...page,
      content: { ...content, ads, adSlots: slotCount },
    };
  });

  return { ...edition, pages };
}