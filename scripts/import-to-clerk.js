const fs = require('fs');
const csv = require('csv-parser');
const axios = require('axios');

// Load env vars
require('dotenv')?.config({ path: '.env.local' });

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
if (!CLERK_SECRET_KEY) {
  console.error('CLERK_SECRET_KEY not found in .env.local');
  process.exit(1);
}

const membersWithLinksPath = 'members-with-links.csv';
const activeMembersRecentPath = 'active_members_recent.csv';

async function migrate() {
  const activeEmails = new Set();
  const membersToImport = [];

  // 1. Read active_members_recent.csv to get the 88 active emails
  await new Promise((resolve) => {
    fs.createReadStream(activeMembersRecentPath)
      .pipe(csv({
        mapHeaders: ({ header }) => header.trim()
      }))
      .on('data', (data) => {
        // The header in active_members_recent.csv is "Email"
        if (data.Email) activeEmails.add(data.Email.trim().toLowerCase());
      })
      .on('end', resolve);
  });

  console.log(`Found ${activeEmails?.size} active emails in active_members_recent.csv`);

  // 2. Read members-with-links.csv and filter for those 88 emails
  await new Promise((resolve) => {
    fs.createReadStream(membersWithLinksPath)
      .pipe(csv({
        separator: ';',
        mapHeaders: ({ header }) => header.trim()
      }))
      .on('data', (data) => {
        const email = data.Email ? data.Email.trim().toLowerCase() : null;
        if (email && activeEmails.has(email)) {
          membersToImport.push({
            email: data.Email.trim(),
            firstName: data.FirstName ? data.FirstName.trim() : '',
            lastName: data.LastName ? data.LastName.trim() : ''
          });
        }
      })
      .on('end', resolve);
  });

  console.log(`Matched ${membersToImport?.length} members from members-with-links.csv`);

  // 3. Clean up Clerk (EXCEPT ADMIN)
  console.log('\n--- Cleaning up existing Clerk users ---');
  try {
    let hasMore = true;
    while (hasMore) {
      const listResponse = await axios?.get('https://api.clerk.com/v1/users?limit=100', {
        headers: { 'Authorization': `Bearer ${CLERK_SECRET_KEY}` }
      });
      
      const users = listResponse?.data;
      if (users?.length === 0) {
        hasMore = false;
        break;
      }

      for (const user of users) {
        const email = user?.email_addresses?.[0]?.email_address;
        if (email === 'rob@topicuk.co.uk') continue;

        try {
          await axios?.delete(`https://api.clerk.com/v1/users/${user?.id}`, {
            headers: { 'Authorization': `Bearer ${CLERK_SECRET_KEY}` }
          });
          console.log(`Deleted: ${email}`);
        } catch (e) {
          console.error(`Failed to delete ${email}: ${e?.message}`);
        }
      }
      
      if (users?.length < 100) hasMore = false;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.log('Cleanup complete.');
  } catch (error) {
    console.error('Error during cleanup:', error?.message);
  }

  // 4. Import the matched members
  console.log(`\n--- Importing ${membersToImport?.length} active members ---`);
  let successCount = 0;
  for (const member of membersToImport) {
    console.log(`Importing: ${member?.email}...`);
    try {
      await axios?.post('https://api.clerk.com/v1/users', {
        email_address: [member?.email],
        first_name: member?.firstName,
        last_name: member?.lastName,
        skip_password_requirement: true,
        skip_password_checks: true,
      }, {
        headers: {
          'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      console.log(`✅ Success: ${member?.email}`);
      successCount++;
    } catch (error) {
      const errMsg = error?.response?.data?.errors?.[0]?.message || error?.message;
      console.error(`❌ Error for ${member?.email}:`, errMsg);
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`\nMigration complete. Successfully imported ${successCount} members.`);
}

migrate()?.catch(console.error);
