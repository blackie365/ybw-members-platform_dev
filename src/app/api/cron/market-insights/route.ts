import { NextResponse } from 'next/server';
import { saveMarketInsight } from '@/lib/marketInsights';
import fs from 'fs/promises';
import path from 'path';

// Optional: you can secure this cron job with an Authorization header check
export async function GET(request: Request) {
  try {
    let insightPoints = [];
    
    try {
      // Simulate Bright Data SERP API response by reading the local JSON file
      const filePath = path.join(process.cwd(), 'brightdata.json');
      const fileContent = await fs.readFile(filePath, 'utf8');
      
      // The file has the curl command at the top, we need to extract just the JSON part
      const jsonStartStr = fileContent.indexOf('{');
      if (jsonStartStr !== -1) {
        const jsonStr = fileContent.substring(jsonStartStr);
        const data = JSON.parse(jsonStr);
        
        if (data.results && data.results.length > 0) {
          // Take top 3 results from the SERP data
          insightPoints = data.results.slice(0, 3).map((item: any) => ({
            summary: item.title,
            fullText: item.description || item.content?.substring(0, 200) + '...',
            sourceUrl: item.link,
            sourceName: new URL(item.link).hostname.replace('www.', '')
          }));
        }
      }
    } catch (err) {
      console.log("Could not parse brightdata.json, falling back to static data", err);
    }

    if (insightPoints.length === 0) {
      // Fallback if parsing fails
      insightPoints = [
        {
          summary: 'Yorkshire sees massive rise in women starting their own businesses.',
          fullText: 'More women than ever are starting businesses in Yorkshire, with female-founded firms making a record share of newly incorporated companies.',
          sourceUrl: 'https://yorkshirepost.co.uk',
          sourceName: 'Yorkshire Post'
        },
        {
          summary: 'A New Era for Female Entrepreneurship in York & North Yorkshire',
          fullText: 'Our region has the potential to create up to 165,000 jobs and add £2.6 billion to GVA by investing in female entrepreneurs in our region.',
          sourceUrl: 'https://york.ac.uk',
          sourceName: 'University of York'
        },
        {
          summary: 'Female Advisory Board launches peer group to accelerate growth',
          fullText: 'FAB Enterprise is aimed at female-led/owned businesses in Yorkshire heading into the eight-figure revenue bracket and onwards.',
          sourceUrl: 'https://startupsmagazine.co.uk',
          sourceName: 'Startups Magazine'
        }
      ];
    }

    const insight = {
      title: 'Economic Insights: Female Entrepreneurship',
      points: insightPoints,
      createdAt: new Date().toISOString(),
    };

    const newInsight = await saveMarketInsight(insight);
    console.log('Successfully inserted market insight to local storage:', newInsight.id);

    return NextResponse.json({ message: 'Inserted market insights successfully', data: newInsight });

  } catch (error: any) {
    console.error('Cron job error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
