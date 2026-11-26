import Parser from 'rss-parser';
import { getMarketInsightStore } from '@/features/shared-ops/server/shared-ops-pg-store';

export interface MarketInsightPoint {
  summary: string;
  fullText: string;
  sourceUrl?: string;
  sourceName?: string;
}

export interface MarketInsight {
  id: string;
  title: string;
  points: MarketInsightPoint[];
  createdAt: string;
}

const parser = new Parser();
const INSIGHT_CACHE_TTL_MS = 15 * 60 * 1000;

const SOURCES = [
  { name: 'BBC Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
  { name: 'Google News UK Economy', url: 'https://news.google.com/rss/search?q=UK%20economy&hl=en-GB&gl=GB&ceid=GB:en' },
  { name: 'Google News Yorkshire Business', url: 'https://news.google.com/rss/search?q=Yorkshire%20business&hl=en-GB&gl=GB&ceid=GB:en' },
];

let cachedInsight: MarketInsight | null = null;
let cachedAt = 0;
let inflightInsightPromise: Promise<MarketInsight | null> | null = null;

async function fetchLatestMarketInsight(): Promise<MarketInsight | null> {
  // Fetch from multiple sources in parallel, but tolerate dead feeds quietly.
  const feedPromises = SOURCES.map(async (source) => {
    try {
      const feed = await parser.parseURL(source.url);
      return feed.items.slice(0, 2).map(item => ({
        summary: item.title || 'Economic Update',
        fullText: item.contentSnippet || item.description || '',
        sourceUrl: item.link,
        sourceName: source.name,
      }));
    } catch {
      return [];
    }
  });

  const results = await Promise.all(feedPromises);
  const allPoints: MarketInsightPoint[] = results.flat().filter((point) => point.summary || point.fullText);
  if (!allPoints.length) {
    return null;
  }

  const shuffledPoints = allPoints.sort(() => Math.random() - 0.5).slice(0, 4);
  return {
    id: 'live-multi-source-insights',
    title: 'Latest Economic Insights',
    points: shuffledPoints,
    createdAt: new Date().toISOString()
  };
}

export async function getLatestMarketInsight(): Promise<MarketInsight | null> {
  const now = Date.now();
  if (cachedInsight && now - cachedAt < INSIGHT_CACHE_TTL_MS) {
    return cachedInsight;
  }

  if (!inflightInsightPromise) {
    inflightInsightPromise = (async () => {
      try {
        const insight = await fetchLatestMarketInsight();
        if (insight) {
          cachedInsight = insight;
          cachedAt = Date.now();
        }
        return insight || cachedInsight;
      } catch (error) {
        console.warn('Error fetching live economic insights:', error);
        return cachedInsight;
      } finally {
        inflightInsightPromise = null;
      }
    })();
  }

  return inflightInsightPromise;
}

export async function saveMarketInsight(insight: Omit<MarketInsight, 'id'>): Promise<MarketInsight> {
  try {
    return await getMarketInsightStore().save(insight);
  } catch (error) {
    console.error('Error saving market insight:', error);
    throw error;
  }
}
