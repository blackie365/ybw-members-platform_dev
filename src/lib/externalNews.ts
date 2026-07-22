import Parser from 'rss-parser';

const parser = new Parser({
  customFields: {
    item: ['media:thumbnail', 'media:content', 'description']
  }
});

export interface ExternalArticle {
  id: string;
  title: string;
  link: string;
  published_at: string;
  excerpt: string;
  feature_image?: string;
  source: string;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function splitGoogleNewsTitle(input: string | undefined): { title: string; source: string } {
  const raw = String(input || '').trim();
  if (!raw) return { title: 'Untitled', source: 'External News' };
  const parts = raw.split(' - ').map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return { title: raw, source: 'External News' };
  return { title: parts.slice(0, -1).join(' - '), source: parts[parts.length - 1] };
}

function sanitizeUrl(input: string | undefined): string {
  return String(input || '')
    .trim()
    .replace(/^`+/, '')
    .replace(/`+$/, '')
    .trim();
}

function isWithinDays(isoDate: string | undefined, maxAgeDays: number): boolean {
  if (!isoDate) return false;
  const millis = Date.parse(isoDate);
  if (!Number.isFinite(millis)) return false;
  const ageMs = Date.now() - millis;
  if (ageMs < 0) return true;
  return ageMs <= maxAgeDays * 24 * 60 * 60 * 1000;
}

async function fetchRssXml(url: string): Promise<string> {
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) {
    throw new Error(`RSS responded with status: ${res.status}`);
  }
  return await res.text();
}

export async function getExternalNews(limit = 5): Promise<ExternalArticle[]> {
  try {
    const baseQuery = '%22Yorkshire%22%20AND%20(%22businesswoman%22%20OR%20%22female%20entrepreneur%22%20OR%20%22female%20founder%22%20OR%20%22women%20in%20business%22)';
    const feedUrlFresh = `https://news.google.com/rss/search?q=${baseQuery}%20when:30d&hl=en-GB&gl=GB&ceid=GB:en`;
    const feedUrlAll = `https://news.google.com/rss/search?q=${baseQuery}&hl=en-GB&gl=GB&ceid=GB:en`;
    
    const xmlFresh = await fetchRssXml(feedUrlFresh);
    const feedFresh = await parser.parseString(xmlFresh);
    const freshItems = feedFresh.items.filter((item) => isWithinDays(item.isoDate, 30));

    const needsFallback = freshItems.length < limit;
    const fallbackItems = needsFallback
      ? (() => {
          const already = new Set(freshItems.map((item) => sanitizeUrl(item.link)));
          return feedFresh.items
            .concat([])
            .filter((item) => {
              const key = sanitizeUrl(item.link);
              if (!key) return false;
              if (already.has(key)) return false;
              already.add(key);
              return true;
            });
        })()
      : [];

    const items = freshItems.concat(fallbackItems).slice(0, limit);

    if (items.length === 0) {
      const xmlAll = await fetchRssXml(feedUrlAll);
      const feedAll = await parser.parseString(xmlAll);
      items.push(...feedAll.items.slice(0, limit));
    }
    
    const articles: ExternalArticle[] = await Promise.all(items.map(async (item: any, index: number) => {
      // Extract image if available in media tags or enclosures
      let feature_image = '';
      if (item['media:thumbnail'] && item['media:thumbnail'].$) {
        feature_image = item['media:thumbnail'].$.url;
      } else if (item['media:content'] && item['media:content'].$) {
        feature_image = item['media:content'].$.url;
      }

      const articleUrl = sanitizeUrl(item.link);
      
      const fallbackSnippetRaw = item.contentSnippet || item.content || item.description || '';
      const fallbackSnippet = stripHtml(String(fallbackSnippetRaw || ''));
      
      let extendedExcerpt = fallbackSnippet;
      if (extendedExcerpt.length > 300) {
        extendedExcerpt = `${extendedExcerpt.slice(0, 300).trim()}...`;
      }

      const { title, source } = splitGoogleNewsTitle(item.title);

      return {
        id: `ext-${index}-${item.guid || articleUrl || index}`,
        title,
        link: articleUrl || '#',
        published_at: item.isoDate || new Date().toISOString(),
        excerpt: extendedExcerpt,
        feature_image: feature_image || undefined,
        source
      };
    }));

    return articles;
  } catch (error) {
    console.error("Error fetching external news RSS:", error);
    return [];
  }
}
