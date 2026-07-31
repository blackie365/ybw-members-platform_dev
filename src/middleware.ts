import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// Burst protection for page navigations. Set generously high so real users
// behind shared IPs are never affected; it only trips on bot-like floods.
const PAGE_LIMIT = 120;
const PAGE_WINDOW_MS = 60_000;

export default clerkMiddleware((_auth, req) => {
  // API routes carry their own per-route limits and are skipped here.
  // Static assets never reach the middleware (see matcher below).
  if (req.method === "GET" && !req.nextUrl.pathname.startsWith("/api/")) {
    const ip = getClientIp(req);
    const result = checkRateLimit(`page:${ip}`, PAGE_LIMIT, PAGE_WINDOW_MS);
    if (!result.allowed) {
      return new NextResponse(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)),
          },
        }
      );
    }
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
