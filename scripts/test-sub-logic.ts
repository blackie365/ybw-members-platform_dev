
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { addBeehiivSubscriber } from '../src/lib/beehiiv';
import { addGhostMember } from '../src/lib/ghost-admin';

async function testSubscription() {
  const email = 'test-' + Date.now() + '@example.com';
  console.log('Testing subscription for:', email);

  try {
    console.log('1. Testing Beehiiv...');
    const beehiiv = await addBeehiivSubscriber({
      email,
      customFields: { first_name: 'Test', last_name: 'User' }
    });
    console.log('Beehiiv Result:', JSON.stringify(beehiiv, null, 2));

    console.log('\n2. Testing Ghost...');
    const ghost = await addGhostMember({
      email,
      name: 'Test User'
    });
    console.log('Ghost Result:', ghost ? 'Success' : 'Skipped/Failed');

    console.log('\n✅ Local logic test complete!');
  } catch (error) {
    console.error('\n❌ Local logic test failed:');
    console.error(error);
  }
}

testSubscription();
