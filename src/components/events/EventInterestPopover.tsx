"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, Loader2, Sparkles, X, CreditCard, BellRing } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogPortal,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerOverlay,
  DrawerPortal,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";

export type EventInterestMode = "interest" | "payment";

export interface EventInterestPrice {
  amount: number;
  standardAmount: number;
  display: string;
  isFree: boolean;
  hasMemberDiscount: boolean;
  source: "firestore" | "tag" | "default" | "none";
}

export interface EventInterestPopoverProps {
  eventId: string;
  eventTitle: string;
  eventImage?: string;
  eventDateLabel?: string;
  eventLocation?: string;
  eventSlug?: string;
  eventGhostId?: string;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  initialMode?: EventInterestMode;
  price?: EventInterestPrice;
  autoDismissOnSuccess?: boolean;
  submitCta?: string;
  paymentCta?: string;
  sourceLabel?: string;
}

const STORAGE_KEYS = {
  dismissed: (id: string) => `ybw:event_popup_dismissed:${id}`,
  submitted: (id: string) => `ybw:event_popup_submitted:${id}`,
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getStoredFlag(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setStoredFlag(key: string, value: string, ttlMs?: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
    if (ttlMs) {
      window.localStorage.setItem(`${key}__exp`, String(Date.now() + ttlMs));
    }
  } catch {
    // ignore storage errors
  }
}

function formatCurrency(amountMinor: number): string {
  const amount = Number.isFinite(amountMinor) ? amountMinor / 100 : 0;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function EventInterestPopover({
  eventId,
  eventTitle,
  eventImage,
  eventDateLabel,
  eventLocation,
  eventSlug,
  eventGhostId,
  open,
  onOpenChange,
  initialMode = "interest",
  price,
  autoDismissOnSuccess = true,
  submitCta = "Notify me",
  paymentCta = "Reserve & Pay",
  sourceLabel = "Event updates",
}: EventInterestPopoverProps) {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();

  const [mode, setMode] = useState<EventInterestMode>(initialMode);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);

  const [quantity, setQuantity] = useState(1);
  const [guestInfo, setGuestInfo] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [success, setSuccess] = useState<null | {
    kind: "interest" | "payment";
    message?: string;
  }>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastAttemptAt, setLastAttemptAt] = useState<number | null>(null);

  const firstRenderRef = useRef(true);

  const hasPaidOption = Boolean(price && (price.isFree || price.amount > 0 || price.standardAmount > 0));
  const priceDisplay = useMemo(() => {
    if (!price) return null;
    if (price.isFree) return "Free";
    return price.display || formatCurrency(price.amount);
  }, [price]);

  const totalAmountMinor = useMemo(() => {
    if (!price) return 0;
    const qty = Math.max(1, quantity);
    if (price.hasMemberDiscount) {
      return price.amount + Math.max(0, qty - 1) * price.standardAmount;
    }
    return price.amount * qty;
  }, [price, quantity]);

  useEffect(() => {
    if (!open) return;
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    setMode(initialMode);
    setSuccess(null);
    setError(null);
    if (!email && user?.email) setEmail(user.email);
    if (!firstName && profile?.firstName) setFirstName(profile.firstName);
  }, [open, eventId, initialMode, email, firstName, user?.email, profile?.firstName]);

  function handleDismiss() {
    setStoredFlag(STORAGE_KEYS.dismissed(eventId), "1", 30 * 24 * 60 * 60 * 1000);
    onOpenChange(false);
  }

  async function handleInterestSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!EMAIL_REGEX.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    const now = Date.now();
    if (lastAttemptAt && now - lastAttemptAt < 8000) {
      setError("Please wait a moment before trying again.");
      return;
    }
    setLastAttemptAt(now);
    setSubmitting(true);

    try {
      const res = await fetch("/api/events/interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          firstName: firstName.trim(),
          source: "event-interest-popover",
          eventId,
          eventTitle,
          eventDateLabel,
          eventLocation,
          newsletterOptIn,
          consent: newsletterOptIn ? "event_updates_and_newsletter" : "event_updates",
        }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(data?.error || "Something went wrong. Please try again.");
      setStoredFlag(STORAGE_KEYS.submitted(eventId), "interest", 365 * 24 * 60 * 60 * 1000);
      setSuccess({ kind: "interest", message: data?.message });
      toast.success(data?.message || "You're on the list.");
      if (autoDismissOnSuccess) {
        window.setTimeout(() => onOpenChange(false), 1600);
      }
    } catch (err: any) {
      console.error("Event interest submit failed:", err);
      setError(err?.message || "Something went wrong. Please try again.");
      toast.error(err?.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCheckout() {
    setError(null);
    if (!EMAIL_REGEX.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!price) {
      setError("Pricing is not available for this event yet.");
      return;
    }

    const redirectAfterSignIn = (() => {
      if (typeof window === "undefined") return "/events";
      const here = `${window.location.pathname}${window.location.search}`;
      return `${here}#event-interest:${encodeURIComponent(eventId)}`;
    })();

    if (!user) {
      router.push(`/sign-up?returnUrl=${encodeURIComponent(redirectAfterSignIn)}`);
      return;
    }

    const now = Date.now();
    if (lastAttemptAt && now - lastAttemptAt < 8000) {
      setError("Please wait a moment before trying again.");
      return;
    }
    setLastAttemptAt(now);
    setPaying(true);

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: eventGhostId || eventId,
          postSlug: eventSlug || eventId,
          postTitle: eventTitle,
          priceAmount: price.amount,
          standardAmount: price.standardAmount,
          hasMemberDiscount: price.hasMemberDiscount,
          quantity: Math.max(1, quantity),
          guestInfo: guestInfo.slice(0, 500),
        }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(data?.error || "Could not start checkout.");

      if (data.free && data.success) {
        setStoredFlag(STORAGE_KEYS.submitted(eventId), "free", 365 * 24 * 60 * 60 * 1000);
        setSuccess({ kind: "payment", message: "You're registered. We'll be in touch with all the details." });
        toast.success("You're registered for this event.");
        if (autoDismissOnSuccess) {
          window.setTimeout(() => onOpenChange(false), 1800);
        }
        return;
      }

      if (data.url) {
        setStoredFlag(STORAGE_KEYS.submitted(eventId), "checkout", 30 * 24 * 60 * 60 * 1000);
        if (data.url.includes("mock_stripe")) {
          toast.warning("Stripe is running in mock mode on this environment.");
        }
        if (typeof window !== "undefined") {
          window.location.href = data.url;
          return;
        }
      }

      throw new Error(data?.error || "Could not start checkout.");
    } catch (err: any) {
      console.error("Event checkout failed:", err);
      setError(err?.message || "Could not start checkout. Please try again.");
      toast.error(err?.message || "Could not start checkout.");
    } finally {
      setPaying(false);
    }
  }

  const interestSubmitted = Boolean(getStoredFlag(STORAGE_KEYS.submitted(eventId)));

  const shellClasses =
    "backdrop-blur-2xl bg-white/75 text-foreground border border-white/60 shadow-[0_30px_80px_-30px_rgba(12,10,9,0.35)] rounded-3xl";

  const overlayClasses =
    "bg-stone-900/10 backdrop-blur-[1px]";

  const showSuccess = success?.kind === "interest" || (interestSubmitted && !success && mode === "interest");

  const content = (
    <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] overflow-hidden">
      {/* Visual panel */}
      <div className="relative hidden lg:block min-h-[320px]">
        {eventImage ? (
          <Image
            src={eventImage}
            alt={eventTitle}
            fill
            className="object-cover"
            sizes="(min-width: 1024px) 420px, 0px"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#A3413A]/80 via-[#A3413A]/60 to-stone-200" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        <div className="relative flex h-full flex-col justify-end p-6 text-white">
          <span className="inline-flex w-max items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[11px] font-medium tracking-wide backdrop-blur-md">
            <Sparkles className="h-3 w-3" />
            {sourceLabel}
          </span>
          <h3 className="mt-3 font-serif text-2xl font-medium leading-snug text-white">
            {eventTitle}
          </h3>
          {(eventDateLabel || eventLocation) && (
            <p className="mt-2 text-sm text-white/80 line-clamp-2">
              {[eventDateLabel, eventLocation].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-col p-6 lg:p-7">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="lg:hidden">
              <span className="inline-flex w-max items-center gap-1.5 rounded-full border border-stone-900/10 bg-stone-900/5 px-2.5 py-1 text-[11px] font-medium tracking-wide text-stone-700">
                <Sparkles className="h-3 w-3" />
                {sourceLabel}
              </span>
            </div>
            <h4 className="mt-2 font-serif text-xl font-medium leading-snug text-stone-900 lg:hidden">
              {eventTitle}
            </h4>
            {showSuccess ? (
              <p className="mt-2 text-sm text-stone-600">
                {success?.message || "You're on the list. We'll share dates, venue, and tickets first."}
              </p>
            ) : mode === "payment" ? (
              <p className="mt-2 text-sm text-stone-600">
                Secure your place directly — you'll also receive event updates by email.
              </p>
            ) : (
              <p className="mt-2 text-sm text-stone-600">
                Leave your email and we'll keep you posted on tickets, dates, and details.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-full p-1.5 text-stone-500 transition-colors hover:bg-stone-900/5 hover:text-stone-900"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {showSuccess ? (
          <div className="flex flex-1 flex-col">
            <div className="flex items-center gap-3 rounded-2xl border border-stone-900/10 bg-emerald-50/80 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700">
                <Check className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-stone-900">
                  {success?.message || "Thanks — you're on the list."}
                </p>
                <p className="mt-0.5 text-xs text-stone-600">
                  You can close this window anytime.
                </p>
              </div>
            </div>

            {hasPaidOption && price && !price.isFree && success?.kind !== "payment" && (
              <div className="mt-5 rounded-2xl border border-stone-900/10 bg-white/70 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-stone-900">Ready to book?</p>
                    <p className="mt-0.5 text-xs text-stone-600">
                      Tickets from {priceDisplay}
                    </p>
                  </div>
                  <Button
                    onClick={() => setMode("payment")}
                    className="h-10 rounded-full bg-stone-900 px-4 text-xs font-semibold text-white hover:bg-stone-900/90"
                  >
                    Reserve a spot
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : mode === "interest" ? (
          <form onSubmit={handleInterestSubmit} className="flex flex-1 flex-col gap-4">
            <div className="space-y-2">
              <label htmlFor={`event-interest-name-${eventId}`} className="text-xs font-medium text-stone-700">
                First name <span className="text-stone-400">· optional</span>
              </label>
              <Input
                id={`event-interest-name-${eventId}`}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Amélie"
                autoComplete="given-name"
                className="h-11 rounded-2xl border-stone-900/10 bg-white/80 px-4 text-sm placeholder:text-stone-400 focus-visible:ring-[#A3413A]/40 focus-visible:border-[#A3413A]/40"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor={`event-interest-email-${eventId}`} className="text-xs font-medium text-stone-700">
                Email address
              </label>
              <Input
                id={`event-interest-email-${eventId}`}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="amelie@studio.com"
                autoComplete="email"
                className="h-11 rounded-2xl border-stone-900/10 bg-white/80 px-4 text-sm placeholder:text-stone-400 focus-visible:ring-[#A3413A]/40 focus-visible:border-[#A3413A]/40"
              />
            </div>

            <label className="flex items-start gap-2.5 pt-1 text-xs text-stone-600">
              <Checkbox
                checked={newsletterOptIn}
                onCheckedChange={(next) => setNewsletterOptIn(Boolean(next))}
                className="mt-0.5 data-[state=checked]:bg-[#A3413A] data-[state=checked]:border-[#A3413A]"
              />
              <span className="leading-relaxed">
                Also send me the weekly Yorkshire BusinessWoman newsletter.
                <span className="block text-stone-500 mt-0.5">
                  By submitting you agree to receive event updates. Unsubscribe anytime.
                </span>
              </span>
            </label>

            <div className="mt-auto flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={handleDismiss}
                className="h-11 rounded-full text-sm text-stone-600 hover:bg-stone-900/5 hover:text-stone-900"
              >
                Not now
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="h-11 rounded-full bg-[#A3413A] px-5 text-sm font-semibold text-white shadow-sm shadow-[#A3413A]/30 hover:bg-[#A3413A]/90 disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    One moment
                  </>
                ) : (
                  <>
                    <BellRing className="h-4 w-4" />
                    {submitCta}
                  </>
                )}
              </Button>
            </div>

            {hasPaidOption && price && (
              <button
                type="button"
                onClick={() => setMode("payment")}
                className="mt-2 inline-flex items-center justify-center gap-2 text-xs font-medium text-stone-500 transition-colors hover:text-stone-900"
              >
                <CreditCard className="h-3.5 w-3.5" />
                {price.isFree
                  ? `Register for free instead (no payment needed)`
                  : `Skip the waitlist — book from ${priceDisplay}`}
              </button>
            )}
          </form>
        ) : (
          <div className="flex flex-1 flex-col gap-4">
            {price && (
              <div className="flex items-end justify-between gap-4 rounded-2xl border border-stone-900/10 bg-white/80 p-4">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-500">
                    {price.isFree ? "Free event" : "From"}
                  </p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <p className="font-serif text-3xl font-medium text-stone-900">
                      {priceDisplay}
                    </p>
                    {price.hasMemberDiscount && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-500/15">
                        Member rate
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-stone-900/10 text-stone-500 transition-colors hover:bg-stone-900/5 hover:text-stone-900"
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm font-medium text-stone-900 tabular-nums">
                    {Math.max(1, quantity)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-stone-900/10 text-stone-500 transition-colors hover:bg-stone-900/5 hover:text-stone-900"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {quantity > 1 && (
              <div className="space-y-2">
                <label htmlFor={`event-interest-guests-${eventId}`} className="text-xs font-medium text-stone-700">
                  Guests <span className="text-stone-400">· optional</span>
                </label>
                <textarea
                  id={`event-interest-guests-${eventId}`}
                  value={guestInfo}
                  onChange={(e) => setGuestInfo(e.target.value.slice(0, 500))}
                  rows={2}
                  placeholder="Names or emails for the extra tickets"
                  className="w-full resize-none rounded-2xl border border-stone-900/10 bg-white/80 px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 outline-none focus:border-[#A3413A]/40 focus:ring-2 focus:ring-[#A3413A]/20"
                />
                {price && price.hasMemberDiscount && price.standardAmount > 0 && (
                  <p className="text-[11px] text-stone-500">
                    Member discount applies to 1 ticket. Additional tickets: {formatCurrency(price.standardAmount)} each.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor={`event-interest-payment-email-${eventId}`} className="text-xs font-medium text-stone-700">
                Email for tickets
              </label>
              <Input
                id={`event-interest-payment-email-${eventId}`}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="amelie@studio.com"
                autoComplete="email"
                className="h-11 rounded-2xl border-stone-900/10 bg-white/80 px-4 text-sm placeholder:text-stone-400 focus-visible:ring-[#A3413A]/40 focus-visible:border-[#A3413A]/40"
              />
              {authLoading ? (
                <p className="text-[11px] text-stone-500">Checking your account…</p>
              ) : user ? (
                <p className="text-[11px] text-stone-500">
                  Signed in as {user.email || "your account"} — RSVP will be linked to your profile.
                </p>
              ) : (
                <p className="text-[11px] text-stone-500">
                  You'll be asked to sign in or create a free account so we can attach the RSVP.
                </p>
              )}
            </div>

            {price && price.amount > 0 && quantity > 1 && (
              <div className="flex items-center justify-between rounded-2xl border border-dashed border-stone-900/10 px-4 py-3 text-sm">
                <span className="text-stone-600">Total</span>
                <span className="font-semibold text-stone-900 tabular-nums">
                  {formatCurrency(totalAmountMinor)}
                </span>
              </div>
            )}

            {error && <p className="text-xs text-red-600">{error}</p>}

            <div className="mt-auto flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setMode("interest");
                  setError(null);
                }}
                className="h-11 rounded-full text-sm text-stone-600 hover:bg-stone-900/5 hover:text-stone-900"
              >
                Notify me instead
              </Button>
              <Button
                type="button"
                onClick={handleCheckout}
                disabled={paying || authLoading}
                className="h-11 rounded-full bg-stone-900 px-5 text-sm font-semibold text-white shadow-sm hover:bg-stone-900/90 disabled:opacity-60"
              >
                {paying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Preparing checkout
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4" />
                    {price?.isFree ? "Register for free" : paymentCta}
                  </>
                )}
              </Button>
            </div>
            <p className="text-center text-[11px] text-stone-500">
              Secure checkout handled by Stripe · Card details are never stored by us.
            </p>
          </div>
        )}

        {error && success?.kind !== "interest" && success?.kind !== "payment" && mode === "interest" && (
          <p className="pt-2 text-xs text-red-600">{error}</p>
        )}
      </div>
    </div>
  );

  // Mobile (drawer) / desktop (dialog) split
  return (
    <div className="contents">
      {/* Desktop dialog */}
      <Dialog open={open} onOpenChange={(next) => !next && handleDismiss()}>
        <DialogPortal>
          <DialogOverlay className={overlayClasses} />
          <DialogContent
            showCloseButton={false}
            className={cn(
              "hidden lg:grid !max-w-[860px] !translate-x-[-50%] !translate-y-[-50%] !p-0",
              shellClasses,
            )}
            onPointerDownOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={handleDismiss}
          >
            {content}
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* Mobile drawer */}
      <Drawer
        open={open}
        onOpenChange={(next) => !next && handleDismiss()}
        dismissible
        noBodyStyles
      >
        <DrawerPortal>
          <DrawerOverlay className={cn("lg:hidden", overlayClasses)} />
          <DrawerContent
            className={cn(
              "lg:hidden overflow-hidden !rounded-t-[28px] border-t border-white/70",
              "bg-white/85 backdrop-blur-2xl",
            )}
          >
            <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-stone-900/10" />
            <div className="px-4 pb-5 pt-2 sm:px-6">{content}</div>
          </DrawerContent>
        </DrawerPortal>
      </Drawer>
    </div>
  );
}

export function hasRecentlySubmittedInterest(eventId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(window.localStorage.getItem(STORAGE_KEYS.submitted(eventId)));
  } catch {
    return false;
  }
}

export function hasRecentlyDismissed(eventId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const dismissed = window.localStorage.getItem(STORAGE_KEYS.dismissed(eventId));
    const expRaw = window.localStorage.getItem(`${STORAGE_KEYS.dismissed(eventId)}__exp`);
    if (!dismissed) return false;
    if (expRaw) {
      const exp = Number(expRaw);
      if (Number.isFinite(exp) && Date.now() > exp) {
        window.localStorage.removeItem(STORAGE_KEYS.dismissed(eventId));
        window.localStorage.removeItem(`${STORAGE_KEYS.dismissed(eventId)}__exp`);
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}
