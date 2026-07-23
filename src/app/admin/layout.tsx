import { checkAdmin } from "@/lib/server/auth-utils";
import { redirect } from "next/navigation";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { currentUser } from "@clerk/nextjs/server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // 1. Strict Server-Side Protection
  // This ensures that non-admin users never even download the admin route code.
  try {
    await checkAdmin();
  } catch (error) {
    console.warn('[AdminLayout] Unauthorized access attempt redirected');
    redirect("/dashboard");
  }

  const user = await currentUser();
  const userName = user ? `${user.firstName} ${user.lastName}` : "Admin";

  return (
    <div className="min-h-screen bg-muted/30">
      <AdminHeader userName={userName} />

      <div className="flex">
        <AdminSidebar />
        <main className="flex-1 p-6 md:p-8 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
