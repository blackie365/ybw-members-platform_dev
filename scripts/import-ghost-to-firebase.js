const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

/**
 * USAGE INSTRUCTIONS:
 * 1. Export your live Ghost database from Settings -> Labs -> Export your content.
 * 2. Rename the downloaded JSON file to `ghost-export.json` and place it in this `scripts/` folder.
 * 3. Go to Firebase Console -> Project Settings -> Service Accounts.
 * 4. Click "Generate new private key", rename it to `service-account.json`, and place it in this `scripts/` folder.
 * 5. Run this script: `node import-ghost-to-firebase.js`
 */

// Initialize Firebase Admin
try {
  const serviceAccount = require('./service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (err) {
  console.error("❌ ERROR: Could not load service-account.json. Please follow instructions at the top of the file.");
  process.exit(1);
}

const db = admin.firestore();

// Helper to batch writes (Firestore has a 500 document limit per batch)
async function commitBatches(batches) {
  for (let i = 0; i < batches.length; i++) {
    await batches[i].commit();
    console.log(`✅ Committed batch ${i + 1} of ${batches.length}`);
  }
}

async function migrate() {
  console.log("🚀 Starting Ghost -> Firebase Migration...");
  
  let rawData;
  try {
    rawData = fs.readFileSync(path.join(__dirname, 'ghost-export.json'));
  } catch (err) {
    console.error("❌ ERROR: Could not find ghost-export.json. Please place your Ghost export file here.");
    process.exit(1);
  }

  const exportData = JSON.parse(rawData);
  
  // Ghost exports an array of database exports, usually the first one holds the data
  const dbData = exportData.db[0].data;
  
  // 1. Map Users (Authors)
  console.log(`\n👨‍💻 Preparing ${dbData.users.length} Authors...`);
  const authorMap = new Map();
  dbData.users.forEach(user => {
    authorMap.set(user.id, {
      id: user.id,
      slug: user.slug,
      name: user.name,
      email: user.email,
      profile_image: user.profile_image || null,
      bio: user.bio || null,
      website: user.website || null
    });
  });

  // 2. Map Tags
  console.log(`🏷️ Preparing ${dbData.tags.length} Tags...`);
  const tagMap = new Map(); // Tag ID -> Tag Slug
  dbData.tags.forEach(tag => {
    tagMap.set(tag.id, tag.slug);
  });

  // 3. Map Post Tags (Join Table)
  const postTagsMap = new Map(); // Post ID -> Array of Tag Slugs
  dbData.posts_tags.forEach(pt => {
    if (!postTagsMap.has(pt.post_id)) {
      postTagsMap.set(pt.post_id, []);
    }
    const tagSlug = tagMap.get(pt.tag_id);
    if (tagSlug) {
      postTagsMap.get(pt.post_id).push(tagSlug);
    }
  });

  // 4. Map Posts
  const validPosts = dbData.posts.filter(p => p.status === 'published' && p.type === 'post');
  console.log(`📝 Preparing ${validPosts.length} Published Posts...`);
  const firebasePosts = validPosts.map(post => {
    const author = authorMap.get(post.author_id);
    const tags = postTagsMap.get(post.id) || [];
    
    return {
      id: post.id,
      slug: post.slug,
      title: post.title,
      html: post.html,
      excerpt: post.custom_excerpt || post.plaintext?.substring(0, 150) || '',
      feature_image: post.feature_image || null,
      featured: post.featured === 1,
      visibility: post.visibility,
      published_at: post.published_at ? new Date(post.published_at).toISOString() : null,
      created_at: post.created_at ? new Date(post.created_at).toISOString() : null,
      updated_at: post.updated_at ? new Date(post.updated_at).toISOString() : null,
      
      // Denormalized relationships
      author_id: post.author_id,
      author_name: author ? author.name : 'Yorkshire Businesswoman',
      author_image: author ? author.profile_image : null,
      tags: tags,
      primary_tag: tags.length > 0 ? tags[0] : null
    };
  });

  // 5. Upload Posts to Firestore
  console.log(`\n☁️ Uploading Posts to Firebase...`);
  let postBatches = [db.batch()];
  let postCount = 0;
  
  firebasePosts.forEach(post => {
    if (postCount > 0 && postCount % 400 === 0) {
      postBatches.push(db.batch());
    }
    const docRef = db.collection('posts').doc(post.id); // Using Ghost ID as Firestore ID to prevent duplicates
    postBatches[postBatches.length - 1].set(docRef, post);
    postCount++;
  });
  await commitBatches(postBatches);

  // 6. Map and Upload Ghost Members (Subscribers) to our Firebase Directory
  // Note: We only migrate Ghost Members, not Ghost Admin Users
  if (dbData.members && dbData.members.length > 0) {
    console.log(`\n👥 Preparing ${dbData.members.length} Members...`);
    
    let memberBatches = [db.batch()];
    let memberCount = 0;

    // Map member labels (Join Table)
    const labelMap = new Map();
    if (dbData.labels) {
      dbData.labels.forEach(l => labelMap.set(l.id, l.name));
    }
    const memberLabelsMap = new Map();
    if (dbData.members_labels) {
      dbData.members_labels.forEach(ml => {
        if (!memberLabelsMap.has(ml.member_id)) {
          memberLabelsMap.set(ml.member_id, []);
        }
        const labelName = labelMap.get(ml.label_id);
        if (labelName) memberLabelsMap.get(ml.member_id).push(labelName);
      });
    }

    dbData.members.forEach(member => {
      const labels = memberLabelsMap.get(member.id) || [];
      
      // Attempt to split name into first and last for the directory
      const nameParts = (member.name || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
      
      const firebaseMember = {
        id: member.id, // We use Ghost ID. When they log in via Firebase Auth, we'll link by email.
        email: member.email,
        name: member.name || '',
        firstName: firstName,
        lastName: lastName,
        status: member.status || 'free',
        labels: labels,
        created_at: member.created_at ? new Date(member.created_at).toISOString() : new Date().toISOString(),
        updated_at: member.updated_at ? new Date(member.updated_at).toISOString() : new Date().toISOString()
      };

      if (memberCount > 0 && memberCount % 400 === 0) {
        memberBatches.push(db.batch());
      }
      
      // We store them in the 'members' collection using their email as document ID
      // This is crucial because when they Sign in with Google/Email on our frontend, 
      // Firebase Auth will use their email. This allows us to merge the data seamlessly.
      const safeEmailId = member.email.toLowerCase(); 
      const docRef = db.collection('members').doc(safeEmailId);
      
      // We use merge: true so we don't overwrite profiles they've already updated on our frontend
      memberBatches[memberBatches.length - 1].set(docRef, firebaseMember, { merge: true });
      memberCount++;
    });

    console.log(`☁️ Uploading Members to Firebase...`);
    await commitBatches(memberBatches);
  }

  console.log("\n🎉 MIGRATION COMPLETE! Your Ghost database is now fully mirrored in Firebase NoSQL.");
}

migrate().catch(console.error);
