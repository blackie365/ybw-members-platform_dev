import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';
import { getDailyNewsletterTemplate } from '../src/lib/email-templates';

// Mock data for the newsletter template
const mockPosts = [
{
  id: '1',
  title: 'Welcome to the Yorkshire Businesswoman Daily News',
  slug: 'welcome-to-the-yorkshire-businesswoman-daily-news',
  custom_excerpt: 'This is the latest news and insights from Yorkshire Businesswoman. Our daily briefing keeps you informed on everything happening in the region.',
  feature_image: "https://images.unsplash.com/photo-1633327760690-d9bb0513f942",
  published_at: new Date().toISOString(),
  primary_tag: { name: 'Community', slug: 'community' }
},
{
  id: '2',
  title: 'Supporting Women in Business Across the Region',
  slug: 'supporting-women-in-business',
  custom_excerpt: 'Discover how we are working to empower female entrepreneurs and professionals in Yorkshire.',
  feature_image: "https://img.rocket.new/generatedImages/rocket_gen_img_1c8414f45-1767740608691.png",
  published_at: new Date().toISOString(),
  primary_tag: { name: 'Empowerment', slug: 'empowerment' }
},
{
  id: '3',
  title: 'Networking Events Coming Up This Month',
  slug: 'networking-events',
  custom_excerpt: 'Don\'t miss our latest networking sessions designed to connect you with like-minded businesswomen.',
  feature_image: "https://img.rocket.new/generatedImages/rocket_gen_img_1fb2ae0a8-1773754534608.png",
  published_at: new Date().toISOString(),
  primary_tag: { name: 'Events', slug: 'events' }
}];


async function generateBeehiivExport() {
  console.log(`🚀 Generating Beehiiv-ready HTML template...`);

  try {
    // We use mock posts for the structure, but Beehiiv will use its own variables for content
    const html = await getDailyNewsletterTemplate(mockPosts as any, '{{subscriber.first_name}}');

    // Process the HTML to replace our mock content with Beehiiv tags if needed
    // However, the request is for the template *format* to import.
    // Beehiiv handles dynamic content differently, but providing the base HTML 
    // allows the user to copy-paste the structure into Beehiiv's HTML editor.

    const outputPath = path.join(process.cwd(), 'beehiiv-newsletter-template.html');
    fs.writeFileSync(outputPath, html);

    console.log(`✅ Success! Beehiiv-ready HTML generated at: ${outputPath}`);
    console.log(`\nNote: This file contains the full HTML structure of your Yorkshire Businesswoman newsletter.`);
    console.log(`You can open this file in a browser, copy the source code, and paste it into Beehiiv's 'Custom HTML' block or Template editor.`);
  } catch (error) {
    console.error('❌ Error generating Beehiiv export:', error);
  }
}

generateBeehiivExport();