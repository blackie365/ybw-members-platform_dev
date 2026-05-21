/**
 * Ghost to Beehiiv Content Importer
 * 
 * This script:
 * 1. Fetches the latest published posts from Ghost
 * 2. Formats them for Beehiiv
 * 3. Creates them as Drafts in Beehiiv via API
 * 
 * Usage: node scripts/import-ghost-to-beehiiv.js --limit 5
 */

require('dotenv').config({ path: '.env.local' });
const fetch = require('node-fetch');

// Ghost Config
const GHOST_API_URL = (process.env.NEXT_PUBLIC_GHOST_API_URL || 'https://admin.yorkshirebusinesswoman.co.uk').replace(/\/$/, '');
const GHOST_CONTENT_API_KEY = process.env.NEXT_PUBLIC_GHOST_CONTENT_API_KEY || '61f6041a1f00410f9ac05a60a4';

// Beehiiv Config
const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY;
const BEEHIIV_PUBLICATION_ID = process.env.BEEHIIV_PUBLICATION_ID;
const BEEHIIV_API_URL = 'https://api.beehiiv.com/v2';

const limit = parseInt(process.argv.find(arg => arg.startsWith('--limit'))?.split('=')[1]) || 3;

async function importLatestPosts() {
    if (!BEEHIIV_API_KEY || !BEEHIIV_PUBLICATION_ID) {
        console.error('❌ Beehiiv credentials missing in .env.local');
        return;
    }

    console.log(`\n👻 Fetching latest ${limit} posts from Ghost...`);

    try {
        // 1. Get posts from Ghost
        const ghostUrl = new URL(`${GHOST_API_URL}/ghost/api/content/posts/`);
        ghostUrl.searchParams.append('key', GHOST_CONTENT_API_KEY);
        ghostUrl.searchParams.append('limit', limit);
        ghostUrl.searchParams.append('include', 'tags,authors');
        ghostUrl.searchParams.append('formats', 'html,plaintext');

        const ghostRes = await fetch(ghostUrl.toString(), {
            headers: { 'Accept-Version': 'v5.0' }
        });

        if (!ghostRes.ok) throw new Error(`Ghost Error: ${ghostRes.statusText}`);
        const { posts } = await ghostRes.json();

        console.log(`✅ Found ${posts.length} posts. Starting import to Beehiiv...`);

        for (const post of posts) {
            console.log(`\n📝 Importing: "${post.title}"...`);

            // 2. Push to Beehiiv as a Draft
            const beehiivRes = await fetch(`${BEEHIIV_API_URL}/publications/${BEEHIIV_PUBLICATION_ID}/posts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${BEEHIIV_API_KEY}`
                },
                body: JSON.stringify({
                    title: post.title,
                    subtitle: post.custom_excerpt || post.excerpt?.substring(0, 140) || '',
                    body: post.html, // Beehiiv accepts HTML content
                    status: 'draft', // Always import as draft for safety
                    platform: 'both', // web and email
                    audience: 'both', // free and premium
                    authors: post.authors?.map(a => a.name) || [],
                    content_tags: post.tags?.map(t => t.name) || []
                })
            });

            if (beehiivRes.ok) {
                const data = await beehiivRes.json();
                console.log(`✅ Successfully created draft in Beehiiv!`);
                console.log(`🔗 Edit it here: https://app.beehiiv.com/publications/${BEEHIIV_PUBLICATION_ID}/posts/${data.data.id}/edit`);
            } else {
                const err = await beehiivRes.json();
                console.error(`❌ Beehiiv Error:`, err.errors?.[0]?.message || beehiivRes.statusText);
            }

            // Tiny delay to avoid hitting rate limits
            await new Promise(r => setTimeout(r, 500));
        }

        console.log(`\n🎉 Import process complete!`);

    } catch (error) {
        console.error(`\n❌ Fatal Error:`, error.message);
    }
}

importLatestPosts().catch(console.error);
