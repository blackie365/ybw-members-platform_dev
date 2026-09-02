import { clerkMiddleware } from "@clerk/nextjs/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// Generous page-view budget: only real page navigations hit this (the matcher
// excludes /_next/static and other static assets), so a human reading a
// broadsheet — long pages, image loading, hard refreshes, preview iframes —
// should never trip it. It still bounds pathological page-fetching. The tight
// anti-abuse limits (5/min) live on the contact/newsletter/events API routes.
const PAGE_LIMIT = 600;
const PAGE_WINDOW_MS = 60_000;

const PUBLIC_URL = (
  process.env.NEXT_PUBLIC_URL ||
  process.env.SITE_URL ||
  ""
).replace(/\/$/, "");

function isLoopbackIp(ip: string | undefined | null): boolean {
  if (!ip) return false;
  const normalized = ip.trim();
  return (
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "0:0:0:0:0:0:0:1" ||
    normalized.startsWith("127.")
  );
}

const base = clerkMiddleware((_auth, req) => {
  if (req.nextUrl.pathname.startsWith("/admin")) {
    const ip = getClientIp(req);
    console.info(
      `[middleware] /admin hit method=${req.method} path=${req.nextUrl.pathname} ip=${ip} ua=${req.headers.get("user-agent")?.slice(0, 80) || ""}`
    );
  }
  if (req.method === "GET" && !req.nextUrl.pathname.startsWith("/api/")) {
    const ip = getClientIp(req);
    if (isLoopbackIp(ip)) {
      return;
    }
    const result = checkRateLimit(`page:${ip}`, PAGE_LIMIT, PAGE_WINDOW_MS);
    if (!result.allowed) {
      return new NextResponse(
        JSON.stringify({
          error: "Too many requests. Please try again later.",
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(
              Math.ceil((result.resetAt - Date.now()) / 1000)
            ),
          },
        }
      );
    }
  }
});

function detectPublicOrigin(req: NextRequest): string {
  if (PUBLIC_URL) return PUBLIC_URL;
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "";
  if (!host) return "";
  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  return `${proto}://${host}`;
}

function postProcess(
  req: NextRequest,
  out: NextResponse | Response | undefined | null
): NextResponse | Response {
  // If clerkMiddleware returned undefined (normal pass-through), explicitly
  // forward via NextResponse.next() so Next.js propagates the request context
  // to server components.  Returning raw `undefined` can cause downstream
  // `auth()` calls to report "Clerk can't detect usage of clerkMiddleware".
  if (!out) {
    return NextResponse.next({ request: { headers: req.headers } });
  }
  const headers = (out as NextResponse).headers;
  const rewrite = headers?.get?.("x-middleware-rewrite") || "";

  // No localhost rewrite -> this is a normal Clerk-issued response (auth markers,
  // set-cookie, etc.).  Return it VERBATIM so that downstream auth()/currentUser()
  // calls in server components can see the Clerk middleware signature.  Returning
  // NextResponse.next() here strips Clerk's response headers and causes:
  //   "Error: Clerk: auth() was called but Clerk can't detect usage of clerkMiddleware()"
  if (!rewrite || !/^https?:\/\/localhost[:/]/.test(rewrite)) {
    return out as NextResponse;
  }

  // LOOP BREAKER — Rewrite sentinel.
  // When x-middleware-rewrite resolves to same origin, Next.js re-enters the
  // middleware on a NEW internal request.  Clerk will emit the same localhost
  // same-path rewrite on the re-entry.  Without a sentinel, we re-apply the
  // same fix and cycle forever.  Sentinel = we tagged the internal request via
  // x-middleware-request-* headers below.  If present, skip rewrite post-process
  // entirely this second pass and let the request flow down to the RSC.
  if (req.headers.get("x-middleware-sentinel") === "postprocess-sameroute") {
    console.debug(
      "[middleware] sameRoute second pass — skipping rewrite post-process to break loop"
    );
    return NextResponse.next({ request: { headers: req.headers } });
  }

  // HEAD requests from bots/curl/health checks — skip Clerk's internal rewrite
  // entirely (public pages render correctly, private pages become 200 with empty
  // body or 307 from the route itself).  Avoids the EPROTO "wrong SSL version"
  // bug when Clerk internally rewrites -> https://localhost on a plain-HTTP bind.
  if (req.method === "HEAD") {
    return NextResponse.next();
  }

  let newPath = "/";
  let newSearch = "";
  let newHash = "";
  try {
    const u = new URL(rewrite);
    newPath = u.pathname;
    newSearch = u.search;
    newHash = u.hash;
  } catch {
    const rest = rewrite.replace(/^https?:\/\/localhost(:\d+)?/, "");
    const [pathAndMaybeSearch, hash = ""] = rest.split("#");
    const [pathname, search = ""] = pathAndMaybeSearch.split("?");
    newPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
    newSearch = search ? `?${search}` : "";
    newHash = hash ? `#${hash}` : "";
  }

  const sameRoute =
    newPath === req.nextUrl.pathname &&
    newSearch === (req.nextUrl.search || "");

  if (sameRoute) {
    // Clerk middleware doing a same-path rewrite (auth cookie/state injection,
    // not an actual sign-in redirect).  Keep the response coming FROM CLERK
    // (with auth markers intact on response headers) — do NOT emit a 307
    // external redirect to the same URL (that loops forever), and do NOT
    // return NextResponse.next() (which strips Clerk's markers and breaks
    // auth() in downstream RSC pages like /admin/layout.tsx).
    //
    // Problem: the rewrite header from Clerk always points at
    // `(https|http)://localhost:3003/<path>`.  Next.js's internal rewrite
    // engine parses this header with `new URL(header)`, requiring a full
    // absolute URL.  If we leave `localhost` + `https://`:
    //   -> EPROTO (our listener is plain HTTP, not TLS)
    // If we rewrite host to `127.0.0.1` + plain `http://`:
    //   -> Next.js issues a real sub-request to http://127.0.0.1:3003/<path>,
    //      middleware runs AGAIN, Clerk issues the same rewrite again -> LOOP.
    // If we strip the host to a path-only "/<path>" string:
    //   -> `new URL("/<path>")` throws ERR_INVALID_URL inside Next.js core.
    //
    // Fix: rewrite the URL to OUR OWN PUBLIC CANONICAL ORIGIN
    // (NEXT_PUBLIC_URL, same host the request is coming from).  Next.js
    // recognises that the origin matches the currently serving app, skips
    // the external fetch, and routes internally.  No EPROTO, no self-HTTP
    // loop, no ERR_INVALID_URL, and Clerk's auth markers are preserved on
    // the response so downstream auth() works.
    //
    // LOOP BREAKER: Tag the outgoing rewritten request with a custom
    // "x-middleware-request-x-middleware-sentinel" override header.  Next.js
    // copies every "x-middleware-request-<H>" into request header "<H>" on
    // the internal re-entry request, so our second-pass check (above) fires
    // and skips re-applying this fix.
    try {
      const fallbackOrigin =
        PUBLIC_URL || detectPublicOrigin(req) || req.nextUrl.origin;
      const parsedOriginal = new URL(rewrite);
      const rewritten = new URL(
        `${parsedOriginal.pathname}${parsedOriginal.search}${parsedOriginal.hash}`,
        fallbackOrigin
      );
      (out as NextResponse).headers.set("x-middleware-rewrite", rewritten.toString());

      const overrideHdrs =
        (out as NextResponse).headers.get("x-middleware-override-headers") || "";
      const newOverride = overrideHdrs
        ? `${overrideHdrs},x-middleware-sentinel`
        : `x-middleware-sentinel`;
      (out as NextResponse).headers.set("x-middleware-override-headers", newOverride);
      (out as NextResponse).headers.set(
        "x-middleware-request-x-middleware-sentinel",
        "postprocess-sameroute"
      );

      console.info(
        `[middleware] sameRoute canonical rewrite ${rewrite} -> ${rewritten.toString()}`
      );
      return out as NextResponse;
    } catch (err) {
      console.warn(
        `[middleware] sameRoute rewrite fix failed — falling back to Clerk raw response: ${(err as Error)?.message}`
      );
      return out as NextResponse;
    }
  }

  // Real browser on an AUTH-GATED page: Clerk redirected path (e.g. /members
  // -> /sign-in).  Convert the internal localhost rewrite into an EXTERNAL 307
  // redirect to the *public* HTTPS origin + new path/search/hash.  Browser
  // navigates directly to the real public URL — no localhost TLS needed.
  const origin = detectPublicOrigin(req);
  let dest: URL;
  try {
    dest = new URL(`${newPath}${newSearch}${newHash}`, origin || req.nextUrl);
  } catch {
    dest = new URL(
      `${newPath}${newSearch}${newHash}`,
      origin || req.nextUrl.toString()
    );
  }
  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  if (dest.protocol !== `${proto}:`) dest.protocol = `${proto}:`;
  return NextResponse.redirect(dest);
}

export default function middleware(
  req: NextRequest,
  evt: NextFetchEvent
):
  | NextResponse
  | Response
  | Promise<NextResponse | Response> {
  const res = base(req, evt) as
    | NextResponse
    | Response
    | Promise<NextResponse | Response | undefined>
    | undefined;
  if (res && typeof (res as Promise<unknown>).then === "function") {
    return (res as Promise<NextResponse | Response | undefined>).then((r) =>
      postProcess(req, r)
    );
  }
  return postProcess(req, res as NextResponse | Response | undefined);
}


export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
