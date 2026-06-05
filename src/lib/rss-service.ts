import Parser from 'rss-parser';

const parser = new Parser({
  customFields: {
    item: ['media:content', 'enclosure', 'content:encoded'],
  }
});

export interface RSSFeedItem {
  title: string;
  link: string;
  pubDate: string;
  contentSnippet: string;
  source: string;
  imageUrl?: string;
}

const SOURCES = [
  { name: 'Yorkshire Post', url: 'https://www.yorkshirepost.co.uk/business/rss' },
  { name: 'The Business Desk', url: 'https://www.thebusinessdesk.com/yorkshire/feed/' },
  { name: 'BDaily Yorkshire', url: 'https://bdaily.co.uk/news/yorkshire/feed' },
  { name: 'Insider Media', url: 'https://www.insidermedia.com/rss/yorkshire' },
  { name: 'BBC Yorkshire', url: 'https://feeds.bbci.co.uk/news/england/yorkshire/rss.xml' }
];

export async function getYorkshireRegionalNews(limit = 10): Promise<RSSFeedItem[]> {
  try {
    const feedPromises = SOURCES.map(async (source) => {
      try {
        const feed = await parser.parseURL(source.url);
        return feed.items.map(item => {
          // Extract image from various possible RSS formats
          let imageUrl = '';
          if (item.enclosure?.url) imageUrl = item.enclosure.url;
          else if (item['media:content']?.$?.url) imageUrl = item['media:content'].$.url;
          
          return {
            title: item.title || '',
            link: item.link || '',
            pubDate: item.pubDate || new Date().toISOString(),
            contentSnippet: item.contentSnippet || '',
            source: source.name,
            imageUrl
          };
        });
      } catch (err) {
        console.error(`Error fetching RSS from ${source.name}:`, err);
        return [];
      }
    });

    const allFeeds = await Promise.all(feedPromises);
    const flattened = allFeeds.flat();

    // Sort by date (descending)
    return flattened
      .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
      .slice(0, limit);
  } catch (err) {
    console.error("Critical error in RSS aggregator:", err);
    return [];
  }
}
