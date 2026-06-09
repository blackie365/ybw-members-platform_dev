'use server';

import { adminDb } from '@/lib/firebase-admin';
import { validateUserOrAdmin } from '@/lib/server/auth-utils';
import { addGhostMember } from '@/lib/ghost-admin';
import { sendEmail } from '@/lib/email';

export async function getProfile(uid: string) {
  try {
    if (!process.env.FIREBASE_PRIVATE_KEY) {
      throw new Error('FIREBASE_PRIVATE_KEY is missing from the environment variables (e.g. Vercel).');
    }
    if (!uid) throw new Error('User ID is required');

    // Security Check: Only the user or an admin can fetch the detailed profile
    await validateUserOrAdmin(uid);
    
    if (!adminDb) throw new Error('Database not initialized');
    const docRef = adminDb.collection('newMemberCollection').doc(uid);
    const docSnap = await docRef.get();
    
    if (docSnap.exists) {
      const data = docSnap.data() || {};

      const nowIso = new Date().toISOString();
      const email = typeof (data as any).email === 'string' ? (data as any).email : '';
      const firstName = typeof (data as any).firstName === 'string' ? (data as any).firstName : '';
      const lastName = typeof (data as any).lastName === 'string' ? (data as any).lastName : '';
      const displayName = typeof (data as any).displayName === 'string' ? (data as any).displayName : `${firstName} ${lastName}`.trim();
      const membershipTier = typeof (data as any).membershipTier === 'string' ? (data as any).membershipTier : 'free';

      // Best-effort: if the Clerk webhook didn't run, ensure free members still get synced + emailed once.
      if (email) {
        if (membershipTier === 'free' && !(data as any).ghostSyncedAt && !(data as any).ghostSyncAttemptedAt) {
          await docRef.set({ ghostSyncAttemptedAt: nowIso }, { merge: true });
          const ghostRes = await addGhostMember({
            email,
            name: displayName || undefined,
            labels: ['platform-login', 'free-member'],
          });
          if (ghostRes) {
            await docRef.set({ ghostSyncedAt: nowIso }, { merge: true });
          }
        }

        if (membershipTier === 'free' && !(data as any).welcomeEmailSentAt && !(data as any).welcomeEmailAttemptedAt) {
          await docRef.set({ welcomeEmailAttemptedAt: nowIso }, { merge: true });
          const freeWelcomeHtml = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #111827; line-height: 1.6; max-width: 640px; margin: 0 auto;">
              <p style="margin: 0 0 16px 0;">Hi ${firstName || ''}</p>
              <p style="margin: 0 0 16px 0;">
                Thank you for signing as a free member for Yorkshire Businesswoman. We are delighted you would like to be involved.
              </p>
              <p style="margin: 0 0 16px 0;">
                Over the course of the year, we hold a number of events, many of which are complimentary for our paid members but as a non-paying member you will have priority over non-members on limited availability tickets.
              </p>
              <p style="margin: 0 0 16px 0;">
                Paid members have a fixed profile on our website and a feature profile within the printed Yorkshire Businesswoman magazine over the course of a year as well as having their news and press releases published both online or within the magazine. There is also a WhatsApp group where news and events are posted and where members can post their own news and updates.
              </p>
              <p style="margin: 0 0 16px 0;">
                If you are interested in becoming a full member which gives you access to the above, you can just click the paid member in the sign up box on the Yorkshire businesswoman website. The cost for this is just £25 per month.
              </p>
            </div>
          `;

          await sendEmail({
            to: email,
            subject: 'Welcome to Yorkshire Businesswoman!',
            html: freeWelcomeHtml,
          });

          await docRef.set({ welcomeEmailSentAt: nowIso }, { merge: true });
        }
      }
      
      // Sanitize the data to remove any Timestamps before sending to the client
      const sanitizedData = JSON.parse(JSON.stringify(data, (key, value) => {
        if (value && typeof value === 'object' && '_seconds' in value && '_nanoseconds' in value) {
          return new Date(value._seconds * 1000).toISOString();
        }
        return value;
      }));
      
      return { success: true, data: sanitizedData, id: docSnap.id };
    }
    
    return { success: true, data: null };
  } catch (error: any) {
    console.error('Error fetching profile from admin SDK:', error);
    return { success: false, error: error.message || 'Failed to fetch profile' };
  }
}

export async function updateProfile(uid: string, email: string, profileData: any) {
  try {
    if (!process.env.FIREBASE_PRIVATE_KEY) {
      throw new Error('FIREBASE_PRIVATE_KEY is missing from the environment variables (e.g. Vercel).');
    }
    if (!uid) throw new Error('User ID is required');

    // Security Check: Ensure only the owner or an admin can update this profile
    await validateUserOrAdmin(uid);
    
    if (!adminDb) throw new Error('Database not initialized');
    const docRef = adminDb.collection('newMemberCollection').doc(uid);
    
    await docRef.set({
      ...profileData,
      email: email,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    return { success: true };
  } catch (error: any) {
    console.error('Error updating profile from admin SDK:', error);
    return { success: false, error: error.message || 'Failed to update profile' };
  }
}
