'use server';

import { revalidatePath } from "next/cache";
import { checkAdmin } from "@/lib/server/auth-utils";
import { sendEmail } from "@/lib/email";
import { getOfferRequestStore } from "@/features/offers/server/offer-request-store";

export async function getFirestoreOffersAction() {
  try {
    await checkAdmin();
    const store = getOfferRequestStore();
    const rows = await store.list({ orderCreatedDesc: true });

    const offers = rows.map(row => {
      const d = row.data ?? {};
      return {
        id: row.id,
        ...d,
        createdAt: row.createdAt ?? d.createdAt ?? new Date().toISOString(),
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
    await checkAdmin();
    await getOfferRequestStore().patch(offerId, { status, updatedAt: new Date().toISOString() });

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/offers');
    revalidatePath('/offers');

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
    await checkAdmin();
    await getOfferRequestStore().patch(offerId, { isMembersOnly, updatedAt: new Date().toISOString() });

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/offers');
    revalidatePath('/offers');

    return { success: true };
  } catch (error: any) {
    console.error("Error in toggleOfferVisibilityAction:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteOfferAction(offerId: string) {
  try {
    await checkAdmin();
    await getOfferRequestStore().delete(offerId);

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/offers');
    revalidatePath('/offers');

    return { success: true };
  } catch (error: any) {
    console.error("Error in deleteOfferAction:", error);
    return { success: false, error: error.message };
  }
}

export async function claimOfferAction(offerId: string, claimerEmail: string, claimerName: string = "A interested person") {
  try {
    const store = getOfferRequestStore();
    const offer = await store.get(offerId);
    if (!offer) throw new Error("Offer not found");

    const offerData = offer.data ?? {};
    const offererEmail =
      typeof offerData.userEmail === 'string'
        ? offerData.userEmail
        : undefined;
    const offerTitle =
      typeof offerData.title === 'string' ? offerData.title : 'Untitled Offer';

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
