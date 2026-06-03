import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth();
  
  // Protect /admin routes - only authorized users can access
  if (isAdminRoute(req)) {
    // 1. Ensure user is logged in
    await auth.protect();
    
    // 2. Proactive Role Check: Only allow 'admin' role through to /admin routes
    const role = (sessionClaims?.metadata as { role?: string })?.role;
    if (role !== 'admin') {
      const url = new URL('/dashboard', req.url);
      return NextResponse.redirect(url);
    }
  }
  
  // We're making other routes public on the frontend for now to prevent 
  // ERR_TOO_MANY_REDIRECTS loops on Vercel preview domains.
  return;
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
