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

async function fetchRssXml(url: string): Promise<string> {
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) {
    throw new Error(`RSS responded with status: ${res.status}`);
  }
  return await res.text();
}

export async function getExternalNews(limit = 5): Promise<ExternalArticle[]> {
  try {
    // Google News RSS query for Yorkshire businesswomen (strict to avoid sports)
    const feedUrl = 'https://news.google.com/rss/search?q=%22Yorkshire%22%20AND%20(%22businesswoman%22%20OR%20%22female%20entrepreneur%22%20OR%20%22female%20founder%22%20OR%20%22women%20in%20business%22)&hl=en-GB&gl=GB&ceid=GB:en';
    
    const xml = await fetchRssXml(feedUrl);
    const feed = await parser.parseString(xml);
    const slicedItems = feed.items.slice(0, limit);
    
    const articles: ExternalArticle[] = await Promise.all(slicedItems.map(async (item, index) => {
      // Extract image if available in media tags or enclosures
      let feature_image = '';
      if (item['media:thumbnail'] && item['media:thumbnail'].$) {
        feature_image = item['media:thumbnail'].$.url;
      } else if (item['media:content'] && item['media:content'].$) {
        feature_image = item['media:content'].$.url;
      }

      const articleUrl = item.link || '';
      
      const fallbackSnippetRaw = item.contentSnippet || item.content || item.description || '';
      const fallbackSnippet = stripHtml(String(fallbackSnippetRaw || ''));
      
      let extendedExcerpt = fallbackSnippet;
      if (extendedExcerpt.length > 300) {
        extendedExcerpt = `${extendedExcerpt.slice(0, 300).trim()}...`;
      }

      const { title, source } = splitGoogleNewsTitle(item.title);

      return {
        id: `ext-${index}-${item.guid || item.link}`,
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
