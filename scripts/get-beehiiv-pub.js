/**
 * Beehiiv Publication Fetcher
 * 
 * This script uses the API key to find the Publication ID.
 */

require('dotenv').config({ path: '.env.local' });
const fetch = require('node-fetch');

const API_KEY = process.env.BEEHIIV_API_KEY;
const API_URL = 'https://api.beehiiv.com/v2';

async function getPublication() {
    if (!API_KEY) {
        console.error('❌ BEEHIIV_API_KEY missing');
        return;
    }

    console.log('🔍 Fetching Beehiiv Publications...');

    try {
        const response = await fetch(`${API_URL}/publications`, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('❌ Beehiiv API Error:', data);
            return;
        }

        if (data.data && data.data.length > 0) {
            console.log('\n✅ Found Publications:');
            data.data.forEach(pub => {
                console.log(`- Name: ${pub.name}`);
                console.log(`  ID: ${pub.id}`);
                console.log(`  Organization: ${pub.organization_name}`);
                console.log('---');
            });
        } else {
            console.log('❌ No publications found for this API key.');
        }
    } catch (error) {
        console.error('❌ Network Error:', error.message);
    }
}

getPublication();
