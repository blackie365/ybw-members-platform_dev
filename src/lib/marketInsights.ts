import { db } from './firebase';
import { collection, query, orderBy, limit, getDocs, addDoc } from 'firebase/firestore';

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
    const insightsRef = collection(db, 'marketInsights');
    const q = query(insightsRef, orderBy('createdAt', 'desc'), limit(1));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const doc = querySnapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data()
    } as MarketInsight;
  } catch (error) {
    console.error('Error fetching latest market insight:', error);
    return null;
  }
}

export async function saveMarketInsight(insight: Omit<MarketInsight, 'id'>): Promise<MarketInsight> {
  try {
    const docRef = await addDoc(collection(db, 'marketInsights'), insight);
    return {
      id: docRef.id,
      ...insight
    };
  } catch (error) {
    console.error('Error saving market insight:', error);
    throw error;
  }
}
