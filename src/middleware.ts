import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";


const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

const clerk = clerkMiddleware(async (auth, req) => {
  if (isAdminRoute(req)) {
    // Just ensure the user is logged in. 
    // We handle strict role-based access in the /admin layout (Server Component)
    // to avoid JWT session claim synchronization issues.
    await auth?.protect();
  }
});

export default async function middleware(req: NextRequest, evt: NextFetchEvent) {
  if (req.nextUrl.pathname === "/admin" || req.nextUrl.pathname === "/admin/") {
    return NextResponse.redirect(new URL("/admin/ads", req.url));
  }

  const clerkConfigured = Boolean(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  if (!clerkConfigured) return NextResponse.next();

  try {
    return await clerk(req, evt);
  } catch (e) {
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
