require('dotenv')?.config({ path: '.env.local' });
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin
try {
    const serviceAccountPath = path?.join(process.cwd(), 'serviceAccountKey.json');
    if (fs?.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs?.readFileSync(serviceAccountPath, 'utf8'));
        admin?.initializeApp({
            credential: admin?.credential?.cert(serviceAccount),
        });
    }
} catch (e) {}

const db = admin?.firestore();

async function extractActiveList() {
    console.log(`\n📋 Extracting Active Member List...\n`);

    const snapshot = await db?.collection('newMemberCollection')?.get();
    const members = snapshot?.docs?.map(doc => ({ id: doc?.id, ...doc?.data() }));

    // Define strict active criteria
    const activeMembers = members?.filter(m => {
        // 1. MUST be Premium or Founder
        const isPremiumTier = m?.membershipTier === 'premium' || m?.membershipTier === 'founder';
        
        // 2. MUST have an active/paid status
        const isActiveStatus = m?.status === 'active' || m?.status === 'paid' || m?.status === 'comped';
        
        // 3. MUST have a name (not an empty record)
        const hasName = (m?.displayName && m?.displayName?.trim()?.length > 0) || 
                        (m?.firstName && m?.firstName?.trim()?.length > 0);

        // 4. MUST NOT be marked as cancelled or expired (if those fields exist)
        const isNotCancelled = m?.status !== 'cancelled' && m?.status !== 'expired' && m?.status !== 'inactive';

        return isPremiumTier && isActiveStatus && hasName && isNotCancelled;
    });

    console.log(`Found ${activeMembers?.length} members matching STRICT active criteria (Premium/Founder + Active Status + Has Name).`);

    // Sort by name for the CSV
    activeMembers?.sort((a, b) => (a?.displayName || a?.firstName || '')?.localeCompare(b?.displayName || b?.firstName || ''));

    const csvRows = ['Name,Email,Tier,Status,Industry,ID'];
    activeMembers?.forEach(m => {
        const name = `"${(m?.displayName || `${m?.firstName || ''} ${m?.lastName || ''}`)?.trim()}"`;
        const email = `"${m?.email || ''}"`;
        const tier = `"${m?.membershipTier || ''}"`;
        const status = `"${m?.status || ''}"`;
        const industry = `"${m?.industrySector || ''}"`;
        const id = `"${m?.id}"`;
        csvRows?.push(`${name},${email},${tier},${status},${industry},${id}`);
    });

    const csvContent = csvRows?.join('\n');
    const filePath = path?.join(process.cwd(), 'active_members_export.csv');
    fs?.writeFileSync(filePath, csvContent);

    console.log(`\n✅ Export complete!`);
    console.log(`📄 File saved to: ${filePath}`);
    console.log(`Total count in file: ${activeMembers?.length}`);
    
    // Provide a preview of the first 10
    console.log('\n--- Preview (First 10) ---');
    console.log(csvRows?.slice(0, 11)?.join('\n'));
}

extractActiveList()?.catch(console.error);
