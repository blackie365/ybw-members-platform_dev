
import { adminDb } from '../src/lib/firebase-admin';
import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const COLLECTION_NAME = 'newMemberCollection';

async function finalEnrichmentSweep() {
  console.log('🚀 Starting Final Enrichment Sweep...');
  
  const snapshot = await adminDb.collection(COLLECTION_NAME).get();
  console.log(`Processing ${snapshot.size} members...`);

  let updatedCount = 0;
  let deactivatedCount = 0;

  // 1. DUPLICATE MANAGEMENT
  const seenEmails = new Set();
  const duplicatesToDeactivate = [
    'rob@ghost-communications.com', // Keep rob@topicuk.co.uk
    'editor@yorkshirebusinessman.co.uk', // Keep editor@topicuk.co.uk (Gill Laidler)
  ];

  // 2. SPECIFIC ENRICHMENT DATA
  const enrichmentData: Record<string, { name?: string, bio?: string, companyName?: string, location?: string, avatarUrl?: string }> = {
    'rachel-coates@btconnect.com': {
      bio: "Dairy farmer from Shipley, West Yorkshire, and Show Director for the Great Yorkshire Show. She is a member of the Yorkshire Agricultural Society Council and has been part of the GYS cattle committee for many years."
    },
    'alks@bohoruns.co.uk': {
      bio: "Company Secretary and Head of HRM \u0026 Marketing at Bohoruns. She assists clients with company formation and provides secretarial services, and is the founder of 'Women with Vision' (WWV), a networking and motivation platform for business women."
    },
    'contact@thecapsule.co.uk': {
      bio: "Actress, singer, and television presenter, known for her roles in Emmerdale and The Royal. She is the founder of The Capsule, a fashion, beauty, and lifestyle platform."
    },
    'rob@topicuk.co.uk': {
      bio: "Award-winning journalist and author of the Soren Chase and Sanheim Chronicles series. He is the Editor-in-Chief of American Banker and has over 20 years of experience in financial journalism."
    },
    'f.broomfield@fantasticmedia.co.uk': {
      bio: "Fiona Broomfield is a key member of the team at Fantastic Media, a leading marketing agency in Yorkshire. She specializes in client strategy and brand development."
    },
    'anicholas@lawblacks.com': {
      name: "A Nicholas",
      companyName: "Blacks Solicitors LLP",
      location: "Leeds",
      bio: "A Nicholas is a legal professional at Blacks Solicitors LLP, providing expert legal services in Yorkshire."
    },
    'orla@coppergateclinic.co.uk': {
      name: "Orla Rhodes",
      bio: "Director of Coppergate Clinic in York. A qualified dental surgeon (BDS, FDS) with a passion for aesthetic medicine and clinic management."
    },
    'tracy.foster@burns-club.org.uk': {
      name: "Tracy Foster",
      bio: "Tracy is a former corporate global Managing Director and founder with extensive experience in charitable organizations, specializing in youth development and education."
    },
    'alison.beardsell@pfgl.co.uk': {
      name: "Alison Beardsell",
      bio: "Alison Beardsell is a professional based in Yorkshire, providing expertise in financial services and business development."
    }
  };

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const email = data.email?.toLowerCase();
    const name = data.name || data.displayName || '';
    
    let updates: any = {};
    let shouldUpdate = false;

    // A. Deactivate Duplicates
    if (duplicatesToDeactivate.includes(email)) {
      updates.userInactive = true;
      shouldUpdate = true;
      deactivatedCount++;
      console.log(`💤 Deactivating duplicate: ${name} (${email})`);
    }

    // B. Apply Specific Enrichment
    if (enrichmentData[email]) {
      const enrichment = enrichmentData[email];
      if (enrichment.name) {
        updates.name = enrichment.name;
        updates.displayName = enrichment.name;
        shouldUpdate = true;
      }
      if (enrichment.bio && (!data.bio || data.bio.length < 20)) {
        updates.bio = enrichment.bio;
        shouldUpdate = true;
      }
      if (enrichment.companyName) {
        updates.companyName = enrichment.companyName;
        shouldUpdate = true;
      }
      if (enrichment.location) {
        updates.location = enrichment.location;
        shouldUpdate = true;
      }
      if (enrichment.avatarUrl && !data.avatarUrl) {
        updates.avatarUrl = enrichment.avatarUrl;
        shouldUpdate = true;
      }
    }

    // E. Tier Cleanup (Ensure 'premium' tier members are actually mapped to 'paid_monthly' or 'paid_annual' if possible, or kept in valid list)
    if (data.membershipTier === 'premium' || data.membershipTier === 'Active Member') {
      updates.membershipTier = 'paid_monthly'; // Default to monthly if in doubt, as 'premium' isn't a standard Ghost tier
      shouldUpdate = true;
    }

    // C. Name Normalization (Title Case, Remove Mr/Mrs)
    const toTitleCase = (str: string) => {
      if (!str) return '';
      return str.toLowerCase().split(/([\s\-])/).map(part => {
        if (part === ' ' || part === '-') return part;
        return part.charAt(0).toUpperCase() + part.slice(1);
      }).join('');
    };

    const cleanName = (name: string) => {
      if (!name) return '';
      // Remove prefixes
      let cleaned = name.replace(/^(mr|mrs|ms|miss|dr|prof|sir|lady|rev)\.?\s+/gi, '');
      cleaned = cleaned.trim();
      // Remove company-like names if they were incorrectly mapped as personal names (heuristics)
      if (cleaned.toLowerCase().includes('solicitors llp')) return cleaned; 
      return toTitleCase(cleaned);
    };

    const currentName = updates.displayName || data.displayName || data.name || '';
    const cleanedName = cleanName(currentName);
    if (currentName !== cleanedName && cleanedName) {
      updates.displayName = cleanedName;
      updates.name = cleanedName;
      
      // Also update firstName and lastName if they are missing or initials
      const parts = cleanedName.split(' ');
      if (parts.length >= 2) {
        if (!data.firstName || data.firstName.length <= 1) updates.firstName = parts[0];
        if (!data.lastName || data.lastName.length <= 1) updates.lastName = parts.slice(1).join(' ');
      }
      
      shouldUpdate = true;
    }

    // D. Location Normalization
    if (data.location || updates.location) {
      let loc = (updates.location || data.location).toString();
      let originalLoc = loc;
      
      // Remove "UK", "U.K.", "United Kingdom", "England" (and variations)
      loc = loc.replace(/,?\s*(UK|U\.K\.|United Kingdom|England|Great Britain)$/i, '').trim();
      
      // Strip everything after the first comma (simplifies "Wakefield, West Yorkshire" -> "Wakefield")
      loc = loc.split(',')[0].trim();
      
      // Strip everything after a slash (simplifies "Harrogate / Wakefield" -> "Harrogate")
      loc = loc.split('/')[0].trim();

      // Normalize specific cities
      if (loc.toLowerCase().includes('wakefield')) loc = 'Wakefield';
      if (loc.toLowerCase().includes('leeds')) loc = 'Leeds';
      if (loc.toLowerCase().includes('huddersfield')) loc = 'Huddersfield';
      if (loc.toLowerCase().includes('harrogate')) loc = 'Harrogate';
      if (loc.toLowerCase().includes('york')) loc = 'York';
      if (loc.toLowerCase().includes('pontefract')) loc = 'Pontefract';
      if (loc.toLowerCase().includes('barnsley')) loc = 'Barnsley';
      if (loc.toLowerCase().includes('wetherby')) loc = 'Wetherby';
      if (loc.toLowerCase().includes('whitby')) loc = 'Whitby';
      if (loc.toLowerCase().includes('ackworth')) loc = 'Ackworth';
      if (loc.toLowerCase().includes('brighouse')) loc = 'Brighouse';
      if (loc.toLowerCase().includes('otley')) loc = 'Otley';
      if (loc.toLowerCase().includes('ripon')) loc = 'Ripon';
      if (loc.toLowerCase().includes('scarborough')) loc = 'Scarborough';
      if (loc.toLowerCase().includes('ilkley')) loc = 'Ilkley';
      if (loc.toLowerCase().includes('scholes')) loc = 'Scholes';
      
      // Fix specific bad entries
      if (loc.toLowerCase().includes('blacks solicitors')) loc = 'Leeds';
      if (loc.toLowerCase().includes('yorkshire showground')) loc = 'Harrogate';

      if (loc !== originalLoc) {
        updates.location = loc;
        shouldUpdate = true;
      }
    }

    if (shouldUpdate) {
      await doc.ref.update({
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      updatedCount++;
    }
  }

  console.log(`\n🏁 Sweep Finished!`);
  console.log(`- Total Updated: ${updatedCount}`);
  console.log(`- Total Deactivated: ${deactivatedCount}`);
}

finalEnrichmentSweep().catch(console.error);
