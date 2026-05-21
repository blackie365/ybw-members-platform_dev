require('dotenv').config({ path: '.env.local' });
const fetch = require('node-fetch');

const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY;
const BEEHIIV_PUBLICATION_ID = process.env.BEEHIIV_PUBLICATION_ID;
const BEEHIIV_API_URL = 'https://api.beehiiv.com/v2';

async function setupTestSegment() {
    if (!BEEHIIV_API_KEY || !BEEHIIV_PUBLICATION_ID) {
        console.error('❌ Beehiiv credentials missing');
        return;
    }

    console.log(`\n🐝 Setting up 'Admin Test Segment' in Beehiiv...\n`);

    try {
        // Since the v2 API primarily supports 'manual' segments via CSV or specific logic,
        // we'll check if we can create a segment or if we should use a custom field filter.
        
        const response = await fetch(`${BEEHIIV_API_URL}/publications/${BEEHIIV_PUBLICATION_ID}/segments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${BEEHIIV_API_KEY}`
            },
            body: JSON.stringify({
                name: 'Admin Test Group',
                type: 'static'
            })
        });

        const data = await response.json();

        if (response.ok) {
            const segmentId = data.data.id;
            console.log(`✅ Created Segment: 'Admin Test Group' (ID: ${segmentId})`);
            
            // Now add Rob to this segment
            console.log(`\n➕ Adding rob@topicuk.co.uk to the segment...`);
            // Note: v2 API usually manages segment membership via subscription updates or bulk actions
            // We'll mark the subscriber with a custom field that can be used for a dynamic segment if static fails.
            
            const subResponse = await fetch(`${BEEHIIV_API_URL}/publications/${BEEHIIV_PUBLICATION_ID}/subscriptions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${BEEHIIV_API_KEY}`
                },
                body: JSON.stringify({
                    email: 'rob@topicuk.co.uk',
                    custom_fields: [
                        { name: 'segment', value: 'admin_test' }
                    ]
                })
            });

            if (subResponse.ok) {
                console.log(`✅ Rob successfully tagged for the test segment.`);
            }
        } else {
            console.error(`❌ Beehiiv error:`, data.errors?.[0]?.message || response.statusText);
            console.log(`\n💡 Note: If segment creation is restricted via API, I'll provide instructions for the dashboard.`);
        }
    } catch (error) {
        console.error(`❌ Error:`, error.message);
    }
}

setupTestSegment().catch(console.error);
