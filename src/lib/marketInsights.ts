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

export async function getLatestMarketInsight(): Promise<MarketInsight | null> {
  try {
    // Fetch live economic news from BBC Business/Economy RSS
    const feed = await parser.parseURL('https://feeds.bbci.co.uk/news/business/rss.xml');
    
    // Take the top 3-6 items for the insight points
    const points: MarketInsightPoint[] = feed.items.slice(0, 6).map(item => ({
      summary: item.title || 'Economic Update',
      fullText: item.contentSnippet || item.description || '',
      sourceUrl: item.link,
      sourceName: 'BBC Business News',
    }));

    return {
      id: 'live-bbc-economy',
      title: 'Latest Economic Insights',
      points,
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching live economic insights from BBC:', error);
    return null;
  }
}

export async function saveMarketInsight(insight: Omit<MarketInsight, 'id'>): Promise<MarketInsight> {
  try {
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
