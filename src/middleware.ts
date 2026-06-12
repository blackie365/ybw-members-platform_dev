import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";


const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

// When no Clerk publishable key is configured (e.g. preview environments where
// the key is only scoped to Production/Preview), clerkMiddleware throws on every
// request. Fall back to a pass-through middleware so the app stays browsable.
const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default hasClerk
  ? clerkMiddleware(async (auth, req) => {
      if (isAdminRoute(req)) {
        // Just ensure the user is logged in.
        // We handle strict role-based access in the /admin layout (Server Component)
        // to avoid JWT session claim synchronization issues.
        await auth?.protect();
      }
    })
  : () => NextResponse.next();

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
