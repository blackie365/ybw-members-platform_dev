import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export default clerkMiddleware(async (auth, req) => {
  const isPublicRoute = createRouteMatcher([
    '/',
    '/news(.*)',
    '/members(.*)',
    '/offers(.*)',
    '/contact(.*)',
    '/about(.*)',
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/new-edition(.*)',
    '/unsubscribe(.*)',
    '/privacy',
    '/cookies',
    '/api/newsletter',
    '/api/webhook(.*)',
    '/api/ghost(.*)',
  ]);

  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
