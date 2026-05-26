'use server';

import { adminDb } from "@/lib/firebase-admin";

export async function getFirestoreOffersAction() {
  try {
    if (!adminDb) throw new Error("Database not initialized");

    const snapshot = await adminDb.collection('offer_requests')
      .orderBy('createdAt', 'desc')
      .get();

    const offers = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt || new Date().toISOString()
      };
    });

    return { success: true, data: offers };
  } catch (error: any) {
    console.error("Error in getFirestoreOffersAction:", error);
    return { success: false, error: error.message };
  }
}

export async function updateOfferStatusAction(offerId: string, status: 'active' | 'pending' | 'expired') {
  try {
    if (!adminDb) throw new Error("Database not initialized");

    await adminDb.collection('offer_requests').doc(offerId).update({
      status,
      updatedAt: new Date().toISOString()
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error in updateOfferStatusAction:", error);
    return { success: false, error: error.message };
  }
}

export async function approveOfferAction(offerId: string) {
  return updateOfferStatusAction(offerId, 'active');
}

export async function deactivateOfferAction(offerId: string) {
  return updateOfferStatusAction(offerId, 'pending');
}

export async function toggleOfferVisibilityAction(offerId: string, isMembersOnly: boolean) {
  try {
    if (!adminDb) throw new Error("Database not initialized");

    await adminDb.collection('offer_requests').doc(offerId).update({
      isMembersOnly,
      updatedAt: new Date().toISOString()
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error in toggleOfferVisibilityAction:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteOfferAction(offerId: string) {
  try {
    if (!adminDb) throw new Error("Database not initialized");

    await adminDb.collection('offer_requests').doc(offerId).delete();

    return { success: true };
  } catch (error: any) {
    console.error("Error in deleteOfferAction:", error);
    return { success: false, error: error.message };
  }
}

import { sendEmail } from "@/lib/email";

export async function claimOfferAction(offerId: string, claimerEmail: string, claimerName: string = "A interested person") {
  try {
    if (!adminDb) throw new Error("Database not initialized");

    const offerDoc = await adminDb.collection('offer_requests').doc(offerId).get();
    if (!offerDoc.exists) throw new Error("Offer not found");

    const offerData = offerDoc.data();
    const offererEmail = offerData?.userEmail;
    const offerTitle = offerData?.title;

    if (!offererEmail) throw new Error("Offerer email not found");

    await sendEmail({
      to: offererEmail,
      subject: `New interest in your offer: ${offerTitle}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Great news!</h2>
          <p>Someone is interested in your offer <strong>"${offerTitle}"</strong> on the Yorkshire Businesswoman platform.</p>
          <p><strong>Contact Details:</strong></p>
          <ul>
            <li><strong>Name:</strong> ${claimerName}</li>
            <li><strong>Email:</strong> ${claimerEmail}</li>
          </ul>
          <p>You can now reach out to them directly to discuss the next steps.</p>
          <hr />
          <p style="font-size: 12px; color: #666;">This is an automated message from the Yorkshire Businesswoman Platform.</p>
        </div>
      `
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error in claimOfferAction:", error);
    return { success: false, error: error.message };
  }
}
