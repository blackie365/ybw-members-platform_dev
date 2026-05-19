import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Find the user with this email
    const snapshot = await adminDb.collection("newMemberCollection").where("email", "==", email).get();

    if (snapshot.empty) {
      // If the user isn't found, we can still return success to prevent email enumeration,
      // but they aren't on the list anyway.
      return NextResponse.json({ success: true });
    }

    // Update the user's status or add a newsletter flag
    const batch = adminDb.batch();
    snapshot.docs.forEach((doc) => {
      // We can add a 'newsletterSubscribed: false' flag
      batch.update(doc.ref, { newsletterSubscribed: false });
    });

    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unsubscribe error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
