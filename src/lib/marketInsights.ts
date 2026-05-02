import { adminDb } from './firebase-admin';

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

export async function getLatestMarketInsight(): Promise<MarketInsight | null> {
  try {
    const insightsRef = adminDb.collection('marketInsights');
    const snapshot = await insightsRef.orderBy('createdAt', 'desc').limit(1).get();
    
    if (snapshot.empty) {
      return null;
    }
    
    const doc = snapshot.docs[0];
    const data = doc.data();
    return {
      id: doc.id,
      ...data
    } as MarketInsight;
  } catch (error) {
    console.error('Error fetching latest market insight:', error);
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
