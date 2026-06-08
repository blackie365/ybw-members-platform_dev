/**
 * FIRESTORE MAGAZINE MIGRATION SCRIPT
 * 
 * This script migrates magazine data from site-content.ts to Firestore.
 * 
 * Usage: node scripts/migrate-magazine-to-firestore.js
 */

require('dotenv')?.config({ path: '.env.local' });
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// --- DATA TO MIGRATE ---
// We need to extract the data from site-content.ts. 
// Since it's a TS file, we'll manually define the core data here or read it.
// For the sake of this script, I'll use the latest data we've been working with.

const MAGAZINE_ISSUES = [
{
  id: "issue-apr-may-2026",
  title: "April / May 2026",
  coverImage: "https://img.rocket.new/generatedImages/rocket_gen_img_1d99c9f06-1767889999477.png",
  publishDate: "2026-04-01",
  description: "The Winner of YBW Awards 2026: Lesley Beach. Featuring the Big Interview with Dame Linda Pollard & Vicky Cheetham, and bespoke fashion with Rebecca Rhoades.",
  pdfUrl: "https://e.issuu.com/embed.html?d=ybw_april-may_2026&u=blackie365",
  downloadUrl: "/downloads/ybw_april-may_2026.pdf",
  isLatest: true,
  tags: ["Awards 2026", "Leadership", "Bespoke Fashion"]
},
{
  id: "ybw_feb_2026",
  title: "February / March 2026",
  coverImage: "https://img.rocket.new/generatedImages/rocket_gen_img_117f3bfc1-1767990020750.png",
  publishDate: "2026-02-01",
  description: "The Wellness Issue: Balancing ambition with self-care, and the future of work-life integration.",
  pdfUrl: "https://e.issuu.com/embed.html?d=ybw_feb_2026&u=blackie365",
  downloadUrl: "/downloads/ybw_feb_2026.pdf",
  isLatest: false,
  tags: ["Wellness", "Future of Work"]
},
{
  id: "ybw_dec_2025",
  title: "December 2025 / January 2026",
  coverImage: "https://img.rocket.new/generatedImages/rocket_gen_img_1aaff6a30-1769329332640.png",
  publishDate: "2025-12-01",
  description: "The Christmas Edition: Celebrating a year of excellence and looking forward to 2026.",
  pdfUrl: "https://e.issuu.com/embed.html?d=ybw_dec_2025&u=blackie365",
  downloadUrl: "/downloads/ybw_dec_2025.pdf",
  isLatest: false,
  tags: ["Christmas", "Review"]
},
{
  id: "ybw_oct_2025",
  title: "October / November 2025",
  coverImage: "https://img.rocket.new/generatedImages/rocket_gen_img_13ff8f5b0-1763299727955.png",
  publishDate: "2025-10-01",
  description: "The Innovation Issue: How Yorkshire businesswomen are leading the digital transformation.",
  pdfUrl: "https://e.issuu.com/embed.html?d=ybw_oct_2025&u=blackie365",
  downloadUrl: "/downloads/ybw_oct_2025.pdf",
  isLatest: false,
  tags: ["Innovation", "Technology"]
},
{
  id: "ybw_aug_2025",
  title: "August / September 2025",
  coverImage: "https://img.rocket.new/generatedImages/rocket_gen_img_169feaf2a-1780850816875.png",
  publishDate: "2025-08-01",
  description: "The Summer Edition: Highlights from the Great Yorkshire Show and seasonal business trends.",
  pdfUrl: "https://e.issuu.com/embed.html?d=ybw_aug_2025&u=blackie365",
  downloadUrl: "/downloads/ybw_aug_2025.pdf",
  isLatest: false,
  tags: ["Summer", "Great Yorkshire Show"]
},
{
  id: "ybw_jun_2025",
  title: "June / July 2025",
  coverImage: "https://img.rocket.new/generatedImages/rocket_gen_img_11b03cfe0-1768038379449.png",
  publishDate: "2025-06-01",
  description: "The Growth Issue: Strategies for scaling your business in the second half of the year.",
  pdfUrl: "https://e.issuu.com/embed.html?d=ybw_jun_2025&u=blackie365",
  downloadUrl: "/downloads/ybw_jun_2025.pdf",
  isLatest: false,
  tags: ["Growth", "Strategy"]
},
{
  id: "ybw_apr_2025",
  title: "April / May 2025",
  coverImage: "https://img.rocket.new/generatedImages/rocket_gen_img_1e8b8c01d-1780874733746.png",
  publishDate: "2025-04-01",
  description: "Spring Awakening: New beginnings and fresh perspectives for Yorkshire\'s entrepreneurs.",
  pdfUrl: "https://e.issuu.com/embed.html?d=ybw_apr_2025&u=blackie365",
  downloadUrl: "/downloads/ybw_apr_2025.pdf",
  isLatest: false,
  tags: ["Spring", "Entrepreneurship"]
},
{
  id: "ybw_feb_2025",
  title: "February / March 2025",
  coverImage: "https://img.rocket.new/generatedImages/rocket_gen_img_1dc07485a-1780916292519.png",
  publishDate: "2025-02-01",
  description: "The Resilience Issue: Overcoming challenges and building robust business models.",
  pdfUrl: "https://e.issuu.com/embed.html?d=ybw_feb_2025&u=blackie365",
  downloadUrl: "/downloads/ybw_feb_2025.pdf",
  isLatest: false,
  tags: ["Resilience", "Leadership"]
}];


const MAGAZINE_PAGES = [
{
  id: 1,
  type: 'cover',
  content: {
    title: "Yorkshire BusinessWoman",
    headline: "The Winner of YBW Awards 2026: Lesley Beach",
    subheadline: "Celebrating excellence, innovation, and leadership among businesswomen across Yorkshire.",
    date: "April / May 2026",
    issue: "No. 43",
    image: "https://img.rocket.new/generatedImages/rocket_gen_img_1e8b8c01d-1780874733746.png"
  }
},
{
  id: 2,
  type: 'editorial',
  content: {
    title: "A Season of Celebration",
    author: "Gill Laidler",
    role: "Editor, Yorkshire BusinessWoman",
    image: "https://img.rocket.new/generatedImages/rocket_gen_img_1dcf8b850-1774530679823.png",
    quote: "Success is not just about individual achievement; it\'s about the community we build together.",
    text: "Welcome to our April / May 2026 edition. This issue is particularly special as we celebrate the incredible winners of the Yorkshire BusinessWoman Awards 2026. Seeing so many talented women come together to support and inspire each other is what this magazine is all about."
  }
},
{
  id: 3,
  type: 'contents',
  content: {
    items: [
    { page: "04", title: "The Big Interview: Dame Linda Pollard", category: "Leadership" },
    { page: "06", title: "Bespoke Fashion with Rebecca Rhoades", category: "Style" },
    { page: "08", title: "Member Spotlight: Vicky Clapham", category: "Community" },
    { page: "07", title: "Harrogate\'s Ambers Restaurant", category: "Lifestyle" }],

    news: [
    "Yorkshire BusinessWoman Awards 2026 winners announced.",
    "New networking events scheduled for Leeds and Sheffield.",
    "Member-exclusive benefits updated for Q2 2026."]

  }
},
{
  id: 4,
  type: 'feature-left',
  content: {
    title: "The Big Interview",
    name: "Dame Linda Pollard & Vicky Cheetham",
    image: "https://img.rocket.new/generatedImages/rocket_gen_img_1de6d6798-1772797711881.png",
    intro: "Leeds Heritage Theatres (LHT) is delighted to announce two new appointments, Dame Dr Linda Pollard DBE DL Hon LLD as its next chair of the board of trustees, and Vicky Cheetham as chief executive."
  }
},
{
  id: 5,
  type: 'feature-right',
  content: {
    quote: "I am absolutely delighted to be joining Leeds Heritage Theatres at such an exciting time in its journey.",
    text: "Dame Linda brings exceptional experience in leadership, governance, and public service. Vicky Cheetham, who is married with three daughters, brings a wealth of experience from the Barbican, Southbank Centre, and Tate.",
    image: "https://img.rocket.new/generatedImages/rocket_gen_img_151fe3a29-1767765639452.png",
    stats: [
    { label: "Turnover", value: "£1.9B" },
    { label: "Staff", value: "22k" },
    { label: "Venues", value: "3" }]

  }
},
{
  id: 6,
  type: 'column',
  content: {
    title: "It's not you, it's the clothes...",
    author: "Rebecca Rhoades",
    category: "Bespoke Fashion",
    image: "https://img.rocket.new/generatedImages/rocket_gen_img_17fa2e07d-1772144135658.png",
    text: "There’s something about wearing something that’s been made just for you that just hits differently. Not in a loud, over-the-top way, but in a quiet confidence way. You stand differently, you feel more like yourself.",
    tips: [
    "Invest in one piece that fits properly.",
    "Bespoke isn\'t just for big occasions.",
    "Everything is designed around you."]

  }
},
{
  id: 7,
  type: 'lifestyle',
  content: {
    title: "Heritage Meets Modern Elegance",
    image: "https://img.rocket.new/generatedImages/rocket_gen_img_1d4e4a0a8-1780916292433.png",
    text: "Set within the stately surroundings of the historic Cedar Court Hotel in Harrogate, Ambers Restaurant is a polished addition to Harrogate’s dining scene...",
    highlights: ["Locally sourced Yorkshire produce", "Heritage meets modern elegance", "Lady Amber Fitzwilliam inspiration"]
  }
},
{
  id: 8,
  type: 'spotlight',
  content: {
    name: "Vicky Clapham",
    role: "Managing Director, Bevic Marketing",
    image: "https://img.rocket.new/generatedImages/rocket_gen_img_1b91bfc92-1775600957920.png",
    bio: "Vicky studied English Literature and Language at Newcastle University. Today, as the founder of Bevic Marketing and PR Services, she helps businesses find and share their stories.",
    message: "Never underestimate the power of your story. It can inspire and connect."
  }
},
{
  id: 9,
  type: 'partner',
  content: {
    brand: "Rebecca Rhoades",
    headline: "Bespoke Fashion for the Modern Woman",
    image: "https://img.rocket.new/generatedImages/rocket_gen_img_16d039b67-1768322447208.png",
    offer: "Exclusive Member Styling Session"
  }
},
{
  id: 10,
  type: 'back-cover',
  content: {
    title: "Yorkshire BusinessWoman",
    cta: "Join the Community",
    nextIssue: "June / July 2026",
    socials: ["Instagram", "LinkedIn", "X"],
    image: "https://storage.googleapis.com/newmembersdirectory130325.firebasestorage.app/magazine/apr-may-2026/rebecca-rhoades-15b.jpg"
  }
}];


// --- INITIALIZE FIREBASE ADMIN ---
try {
  const serviceAccountPath = path?.join(process.cwd(), 'serviceAccountKey.json');
  if (!fs?.existsSync(serviceAccountPath)) {
    console.error('❌ ERROR: serviceAccountKey.json not found in root directory.');
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs?.readFileSync(serviceAccountPath, 'utf8'));

  if (!admin?.apps?.length) {
    admin?.initializeApp({
      credential: admin?.credential?.cert(serviceAccount)
    });
  }

  console.log('✅ Firebase Admin initialized.');
} catch (e) {
  console.error('❌ Failed to initialize Firebase Admin:', e?.message);
  process.exit(1);
}

const db = admin?.firestore();

async function migrate() {
  console.log('🚀 Starting migration to Firestore...');

  // 1. Migrate Issues
  console.log('📦 Migrating magazine issues...');
  for (const issue of MAGAZINE_ISSUES) {
    await db?.collection('magazine_issues')?.doc(issue?.id)?.set({
      ...issue,
      updatedAt: admin?.firestore?.FieldValue?.serverTimestamp()
    });
    console.log(`✅ Migrated issue: ${issue?.id}`);
  }

  // 2. Migrate Pages for the latest issue
  const latestIssueId = "issue-apr-may-2026";
  console.log(`📄 Migrating pages for latest issue: ${latestIssueId}...`);
  for (const page of MAGAZINE_PAGES) {
    await db?.collection('magazine_issues')?.doc(latestIssueId)?.collection('pages')?.doc(page?.id?.toString())?.set({
      ...page,
      updatedAt: admin?.firestore?.FieldValue?.serverTimestamp()
    });
    console.log(`✅ Migrated page ${page?.id}`);
  }

  console.log('\n✨ Migration complete! Magazine data is now in Firestore.');
}

migrate()?.catch(console.error);