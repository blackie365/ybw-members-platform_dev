import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  '/',
  '/news(.*)',
  '/members(.*)',
  '/offers(.*)',
  '/contact(.*)',
  '/about(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/login(.*)',
  '/register(.*)',
  '/new-edition(.*)',
  '/unsubscribe(.*)',
  '/privacy',
  '/cookies',
  '/api/newsletter',
  '/api/webhook(.*)',
  '/api/ghost(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;

  // Handle legacy redirects
  if (pathname === '/login') {
    return NextResponse.redirect(new URL('/sign-in', req.url));
  }
  if (pathname === '/register') {
    return NextResponse.redirect(new URL('/sign-up', req.url));
  }

  if (!isPublicRoute(req)) {
    const session = await auth();
    if (!session.userId) {
      return session.redirectToSignIn({ returnBackUrl: req.url });
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
