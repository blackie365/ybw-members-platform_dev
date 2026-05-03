import Parser from 'rss-parser';
import * as cheerio from 'cheerio';

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

async function fetchFullArticleContent(url: string): Promise<string | null> {
  try {
    let html = '';
    const apiKey = process.env.BRIGHTDATA_API_KEY;
    const zone = process.env.BRIGHTDATA_ZONE; // e.g. web_unlocker

    // Use Bright Data Web Unlocker if API key AND zone are configured
    if (apiKey && zone) {
      const brdRes = await fetch('https://api.brightdata.com/request', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          zone: zone,
          url: url,
          format: 'raw'
        })
      });
      if (brdRes.ok) {
        html = await brdRes.text();
      } else {
        console.warn(`Bright Data request failed for ${url} (Status: ${brdRes.status}). Falling back to direct fetch.`);
      }
    }

    // Fallback to standard fetch if Bright Data isn't used or failed
    if (!html) {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      if (!res.ok) return null;
      html = await res.text();
    }

    // Use Cheerio to parse the article body
    const $ = cheerio.load(html);
    let text = '';
    
    // Most news sites including BBC wrap their article paragraphs in <article> or <main>
    // BBC also specifically uses [data-component="text-block"]
    $('article p, main p, [data-component="text-block"]').each((_, el) => {
      const paragraph = $(el).text().trim();
      // Filter out short navigation links or empty text
      if (paragraph && paragraph.length > 20) {
        text += paragraph + ' ';
      }
    });

    return text.trim();
  } catch (err) {
    console.error(`Error fetching full article for ${url}:`, err);
    return null;
  }
}

export async function getExternalNews(limit = 5): Promise<ExternalArticle[]> {
  try {
    // Using BBC News West Yorkshire feed as requested by the user
    const feedUrl = 'https://feeds.bbci.co.uk/news/england/west_yorkshire/rss.xml';
    
    const feed = await parser.parseURL(feedUrl);
    const slicedItems = feed.items.slice(0, limit);
    
    // Fetch full articles in parallel
    const articles: ExternalArticle[] = await Promise.all(slicedItems.map(async (item, index) => {
      // Extract image if available in media tags or enclosures
      let feature_image = '';
      if (item['media:thumbnail'] && item['media:thumbnail'].$) {
        feature_image = item['media:thumbnail'].$.url;
      } else if (item['media:content'] && item['media:content'].$) {
        feature_image = item['media:content'].$.url;
      }

      // Fetch the full article HTML and extract text
      const articleUrl = item.link || '';
      const fullText = articleUrl ? await fetchFullArticleContent(articleUrl) : null;
      
      // Default to RSS snippet if scraping fails
      const fallbackSnippet = item.contentSnippet || item.content || item.description || '';
      
      // Create an extended excerpt from the scraped full text (e.g. ~300 characters)
      let extendedExcerpt = fallbackSnippet;
      if (fullText && fullText.length > 20) {
        extendedExcerpt = fullText.substring(0, 300).trim();
        if (fullText.length > 300) {
          extendedExcerpt += '...';
        }
      }

      return {
        id: `ext-${index}-${item.guid || item.link}`,
        title: item.title || 'Untitled',
        link: articleUrl || '#',
        published_at: item.isoDate || new Date().toISOString(),
        excerpt: extendedExcerpt,
        feature_image: feature_image || undefined,
        source: feed.title || 'External News'
      };
    }));

    return articles;
  } catch (error) {
    console.error("Error fetching external news RSS:", error);
    return [];
  }
}
