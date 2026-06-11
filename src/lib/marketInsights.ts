import { adminDb } from './firebase-admin';
import Parser from 'rss-parser';

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

const SOURCES = [
  { name: 'BBC Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
  { name: 'Sky News Business', url: 'https://news.sky.com/feeds/rss/business.xml' },
  { name: 'Guardian Economy', url: 'https://www.theguardian.com/business/economics/rss' },
];

export async function getLatestMarketInsight(): Promise<MarketInsight | null> {
  try {
    // Fetch from multiple sources in parallel
    const feedPromises = SOURCES.map(async (source) => {
      try {
        const feed = await parser.parseURL(source.url);
        return feed.items.slice(0, 2).map(item => ({
          summary: item.title || 'Economic Update',
          fullText: item.contentSnippet || item.description || '',
          sourceUrl: item.link,
          sourceName: source.name,
        }));
      } catch (err) {
        console.error(`Error fetching from ${source.name}:`, err);
        return [];
      }
    });

    const results = await Promise.all(feedPromises);
    const allPoints: MarketInsightPoint[] = results.flat();

    // Shuffle the points to mix the sources
    const shuffledPoints = allPoints.sort(() => Math.random() - 0.5).slice(0, 4);

    return {
      id: 'live-multi-source-insights',
      title: 'Latest Economic Insights',
      points: shuffledPoints,
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching live economic insights:', error);
    return null;
  }
}

export async function saveMarketInsight(insight: Omit<MarketInsight, 'id'>): Promise<MarketInsight> {
  try {
    if (!adminDb) {
      throw new Error('Database not initialized');
    }
    const docRef = await adminDb.collection('marketInsights').add(insight);
    return {
      id: docRef.id,
      ...insight
    };
  } catch (error) {
    console.error('Error saving market insight:', error);
    throw error;
  }
}
