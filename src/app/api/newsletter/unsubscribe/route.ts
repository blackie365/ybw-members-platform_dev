import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { deleteBeehiivSubscriber } from "@/lib/beehiiv";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // 1. Update Firestore
    const snapshot = await adminDb.collection("newMemberCollection").where("email", "==", email).get();

    if (!snapshot.empty) {
      const batch = adminDb.batch();
      snapshot.docs.forEach((doc) => {
        batch.update(doc.ref, { 
          newsletterSubscribed: false,
          isNewsletterAuthorized: false,
          updatedAt: new Date().toISOString()
        });
      });
      await batch.commit();
    }

    // 2. Update Beehiiv (Optional sync)
    await deleteBeehiivSubscriber(email);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unsubscribe error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
