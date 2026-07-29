"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, Loader2, Sparkles, X, CreditCard, BellRing, MapPin } from "lucide-react";
import { toast } from "sonner";

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

export const HOMEPAGE_EVENT_AUTO_TRIGGER_SESSION_KEY = "ybw:hp_event_popup_intent";

const STORAGE_KEYS = {
  dismissed: (id: string) => `ybw:event_popup_dismissed:${id}`,
  submitted: (id: string) => `ybw:event_popup_submitted:${id}`,
};

const STORAGE_TTL = {
  dismissedMs: 30 * 24 * 60 * 60 * 1000,
  submittedInterestMs: 60 * 24 * 60 * 60 * 1000,
  submittedPaidMs: 90 * 24 * 60 * 60 * 1000,
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
  const reactId = useId();

  const [mounted, setMounted] = useState(false);

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

  const titleId = `ybw-event-popover-title-${reactId}`;
  const descId = `ybw-event-popover-desc-${reactId}`;
  const mTitleId = `ybw-event-popover-m-title-${reactId}`;
  const mDescId = `ybw-event-popover-m-desc-${reactId}`;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

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
    setStoredFlag(STORAGE_KEYS.dismissed(eventId), "1", STORAGE_TTL.dismissedMs);
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
      setStoredFlag(STORAGE_KEYS.submitted(eventId), "interest", STORAGE_TTL.submittedInterestMs);
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
        setStoredFlag(STORAGE_KEYS.submitted(eventId), "free", STORAGE_TTL.submittedPaidMs);
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
    "backdrop-blur-xl bg-white text-foreground border border-stone-900/10 shadow-[0_30px_90px_-30px_rgba(12,10,9,0.50)] rounded-2xl";

  const overlayClasses = "bg-stone-900/12 backdrop-blur-[1px]";

  const showSuccess = success?.kind === "interest" || (interestSubmitted && !success && mode === "interest");

  const content = (
    <div className="flex flex-col overflow-hidden">
      <div className="relative overflow-hidden bg-gradient-to-br from-[#A3413A]/12 via-[#A3413A]/6 to-white">
        <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-[#A3413A]/10 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4 px-5 pt-5 pb-3">
          <div>
            <span className="inline-flex w-max items-center gap-1.5 rounded-full border border-stone-900/10 bg-white/70 px-2.5 py-1 text-[10px] font-medium tracking-[0.12em] uppercase text-stone-600 backdrop-blur">
              <Sparkles className="h-3 w-3" />
              {sourceLabel}
            </span>
            <h3 className="mt-3 font-serif text-[20px] font-medium leading-snug text-stone-900">
              {eventTitle}
            </h3>
            {(eventDateLabel || eventLocation) && (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-stone-500">
                {eventDateLabel && (
                  <span className="inline-flex items-center gap-1">
                    <BellRing className="h-3 w-3 text-[#A3413A]/70" />
                    {eventDateLabel}
                  </span>
                )}
                {eventLocation && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-[#A3413A]/70" />
                    {eventLocation}
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 rounded-full p-1.5 text-stone-500 transition-colors hover:bg-stone-900/5 hover:text-stone-900"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-col px-5 pb-5 pt-4">
        <div className="mb-4">
          {showSuccess ? (
            <p className="text-[13px] leading-relaxed text-stone-600">
              {success?.message || "You&apos;re on the list. We&apos;ll share dates, venue, and tickets first."}
            </p>
          ) : mode === "payment" ? (
            <p className="text-[13px] leading-relaxed text-stone-600">
              Secure your place directly — you&apos;ll also receive event updates by email.
            </p>
          ) : (
            <p className="text-[13px] leading-relaxed text-stone-600">
              Leave your email and we&apos;ll keep you posted on tickets, dates, and details.
            </p>
          )}
        </div>

        {showSuccess ? (
          <div className="flex flex-1 flex-col">
            <div className="flex items-center gap-3 rounded-xl border border-stone-900/10 bg-emerald-50/80 p-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700">
                <Check className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-stone-900">
                  {success?.message || "Thanks — you're on the list."}
                </p>
                <p className="mt-0.5 text-[11px] text-stone-600">
                  You can close this window anytime.
                </p>
              </div>
            </div>

            {hasPaidOption && price && !price.isFree && success?.kind !== "payment" && (
              <div className="mt-4 rounded-xl border border-stone-900/10 bg-white/70 p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-stone-900">Ready to book?</p>
                    <p className="mt-0.5 text-[11px] text-stone-600">
                      Tickets from {priceDisplay}
                    </p>
                  </div>
                  <Button
                    onClick={() => setMode("payment")}
                    className="h-9 shrink-0 rounded-full bg-stone-900 px-3.5 text-[11px] font-semibold text-white hover:bg-stone-900/90"
                  >
                    Reserve a spot
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : mode === "interest" ? (
          <form onSubmit={handleInterestSubmit} className="flex flex-1 flex-col gap-3.5">
            <div className="space-y-1.5">
              <label htmlFor={`event-interest-name-${eventId}`} className="text-[11px] font-medium text-stone-700">
                First name <span className="text-stone-400">· optional</span>
              </label>
              <Input
                id={`event-interest-name-${eventId}`}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Amélie"
                autoComplete="given-name"
                className="h-10 rounded-xl border-stone-900/10 bg-white/85 px-3.5 text-[13px] placeholder:text-stone-400 focus-visible:ring-[#A3413A]/40 focus-visible:border-[#A3413A]/40"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor={`event-interest-email-${eventId}`} className="text-[11px] font-medium text-stone-700">
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
                className="h-10 rounded-xl border-stone-900/10 bg-white/85 px-3.5 text-[13px] placeholder:text-stone-400 focus-visible:ring-[#A3413A]/40 focus-visible:border-[#A3413A]/40"
              />
            </div>

            <label className="flex items-start gap-2.5 pt-0.5 text-[11px] text-stone-600 leading-relaxed">
              <Checkbox
                checked={newsletterOptIn}
                onCheckedChange={(next) => setNewsletterOptIn(Boolean(next))}
                className="mt-0.5 data-[state=checked]:bg-[#A3413A] data-[state=checked]:border-[#A3413A]"
              />
              <span>
                Also send me the weekly Yorkshire BusinessWoman newsletter.
                <span className="block text-stone-500 mt-0.5">
                  By submitting you agree to receive event updates. Unsubscribe anytime.
                </span>
              </span>
            </label>

            <div className="mt-auto flex flex-col gap-2 pt-1">
              <Button
                type="submit"
                disabled={submitting}
                className="h-10 w-full rounded-full bg-[#A3413A] px-4 text-[13px] font-semibold text-white shadow-sm shadow-[#A3413A]/30 hover:bg-[#A3413A]/90 disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    One moment
                  </>
                ) : (
                  <>
                    <BellRing className="h-3.5 w-3.5" />
                    {submitCta}
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleDismiss}
                className="h-9 w-full rounded-full text-[12px] text-stone-600 hover:bg-stone-900/5 hover:text-stone-900"
              >
                Not now
              </Button>
            </div>

            {hasPaidOption && price && (
              <button
                type="button"
                onClick={() => setMode("payment")}
                className="mt-1 inline-flex items-center justify-center gap-2 text-[11px] font-medium text-stone-500 transition-colors hover:text-stone-900"
              >
                <CreditCard className="h-3 w-3" />
                {price.isFree
                  ? `Register for free instead (no payment needed)`
                  : `Skip the waitlist — book from ${priceDisplay}`}
              </button>
            )}
          </form>
        ) : (
          <div className="flex flex-1 flex-col gap-3.5">
            {price && (
              <div className="flex items-end justify-between gap-3 rounded-xl border border-stone-900/10 bg-white/85 p-3.5">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-stone-500">
                    {price.isFree ? "Free event" : "From"}
                  </p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <p className="font-serif text-[26px] font-medium text-stone-900 leading-none">
                      {priceDisplay}
                    </p>
                    {price.hasMemberDiscount && (
                      <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-500/15">
                        Member rate
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-900/10 text-stone-500 transition-colors hover:bg-stone-900/5 hover:text-stone-900"
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <span className="w-5 text-center text-[13px] font-medium text-stone-900 tabular-nums">
                    {Math.max(1, quantity)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-900/10 text-stone-500 transition-colors hover:bg-stone-900/5 hover:text-stone-900"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {quantity > 1 && (
              <div className="space-y-1.5">
                <label htmlFor={`event-interest-guests-${eventId}`} className="text-[11px] font-medium text-stone-700">
                  Guests <span className="text-stone-400">· optional</span>
                </label>
                <textarea
                  id={`event-interest-guests-${eventId}`}
                  value={guestInfo}
                  onChange={(e) => setGuestInfo(e.target.value.slice(0, 500))}
                  rows={2}
                  placeholder="Names or emails for the extra tickets"
                  className="w-full resize-none rounded-xl border border-stone-900/10 bg-white/85 px-3.5 py-2.5 text-[13px] text-stone-900 placeholder:text-stone-400 outline-none focus:border-[#A3413A]/40 focus:ring-2 focus:ring-[#A3413A]/20"
                />
                {price && price.hasMemberDiscount && price.standardAmount > 0 && (
                  <p className="text-[10px] text-stone-500">
                    Member discount applies to 1 ticket. Additional tickets: {formatCurrency(price.standardAmount)} each.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor={`event-interest-payment-email-${eventId}`} className="text-[11px] font-medium text-stone-700">
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
                className="h-10 rounded-xl border-stone-900/10 bg-white/85 px-3.5 text-[13px] placeholder:text-stone-400 focus-visible:ring-[#A3413A]/40 focus-visible:border-[#A3413A]/40"
              />
              {authLoading ? (
                <p className="text-[10px] text-stone-500">Checking your account…</p>
              ) : user ? (
                <p className="text-[10px] text-stone-500">
                  Signed in as {user.email || "your account"} — RSVP will be linked to your profile.
                </p>
              ) : (
                <p className="text-[10px] text-stone-500">
                  You&apos;ll be asked to sign in or create a free account so we can attach the RSVP.
                </p>
              )}
            </div>

            {price && price.amount > 0 && quantity > 1 && (
              <div className="flex items-center justify-between rounded-xl border border-dashed border-stone-900/10 px-3.5 py-2.5 text-[12px]">
                <span className="text-stone-600">Total</span>
                <span className="font-semibold text-stone-900 tabular-nums">
                  {formatCurrency(totalAmountMinor)}
                </span>
              </div>
            )}

            {error && <p className="text-[11px] text-red-600">{error}</p>}

            <div className="mt-auto flex flex-col gap-2 pt-1">
              <Button
                type="button"
                onClick={handleCheckout}
                disabled={paying || authLoading}
                className="h-10 w-full rounded-full bg-stone-900 px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-stone-900/90 disabled:opacity-60"
              >
                {paying ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Preparing checkout
                  </>
                ) : (
                  <>
                    <CreditCard className="h-3.5 w-3.5" />
                    {price?.isFree ? "Register for free" : paymentCta}
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setMode("interest");
                  setError(null);
                }}
                className="h-9 w-full rounded-full text-[12px] text-stone-600 hover:bg-stone-900/5 hover:text-stone-900"
              >
                Notify me instead
              </Button>
            </div>
            <p className="text-center text-[10px] text-stone-500">
              Secure checkout handled by Stripe · Card details are never stored by us.
            </p>
          </div>
        )}

        {error && success?.kind !== "interest" && success?.kind !== "payment" && mode === "interest" && (
          <p className="pt-2 text-[11px] text-red-600">{error}</p>
        )}
      </div>
    </div>
  );

  if (!mounted || !open) return null;

  const srDescriptionText =
    mode === "payment"
      ? "Secure your place for this event by purchasing tickets."
      : "Share your email to receive updates and ticket information for this event.";

  return createPortal(
    <div className="contents">
      <div
        aria-hidden="true"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className={cn(
          "fixed inset-0 z-[998] pointer-events-auto select-none",
          overlayClasses,
          open ? "animate-in fade-in-0 duration-200" : "animate-out fade-out-0 duration-200",
        )}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className={cn(
          "hidden lg:grid fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[999] w-full pointer-events-auto outline-none",
          shellClasses,
          "max-w-[360px]",
          open ? "animate-in fade-in-0 zoom-in-[0.98] duration-200" : "animate-out fade-out-0 zoom-out-[0.98] duration-200",
        )}
      >
        <div className="sr-only">
          <p id={titleId}>{eventTitle}</p>
          <p id={descId}>{srDescriptionText}</p>
        </div>
        {content}
      </div>

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={mTitleId}
        aria-describedby={mDescId}
        className={cn(
          "lg:hidden fixed inset-x-0 bottom-0 z-[999] mt-24 max-h-[80vh] w-full pointer-events-auto rounded-t-[24px] border-t border-stone-900/10 bg-white backdrop-blur-xl outline-none",
          open ? "animate-in fade-in-0 slide-in-from-bottom duration-200" : "animate-out fade-out-0 slide-out-to-bottom duration-200",
        )}
      >
        <div className="sr-only">
          <p id={mTitleId}>{eventTitle}</p>
          <p id={mDescId}>{srDescriptionText}</p>
        </div>
        <div className="bg-stone-900/10 mx-auto mt-2.5 h-1 w-10 rounded-full" />
        <div className="px-4 pb-4 pt-1.5 sm:px-5">{content}</div>
      </div>
    </div>,
    typeof document !== "undefined" ? document.body : (null as unknown as HTMLElement),
  );
}

function isStoredFlagExpired(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const expRaw = window.localStorage.getItem(`${key}__exp`);
    if (!expRaw) return false;
    const exp = Number(expRaw);
    if (Number.isFinite(exp) && Date.now() > exp) {
      window.localStorage.removeItem(key);
      window.localStorage.removeItem(`${key}__exp`);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function hasRecentlySubmittedInterest(eventId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const key = STORAGE_KEYS.submitted(eventId);
    const has = Boolean(window.localStorage.getItem(key));
    if (!has) return false;
    if (isStoredFlagExpired(key)) return false;
    return true;
  } catch {
    return false;
  }
}

export function hasRecentlyDismissed(eventId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const key = STORAGE_KEYS.dismissed(eventId);
    const dismissed = window.localStorage.getItem(key);
    if (!dismissed) return false;
    if (isStoredFlagExpired(key)) return false;
    return true;
  } catch {
    return false;
  }
}

export function clearEventPopupMemory(eventId?: string): void {
  if (typeof window === "undefined") return;
  try {
    const clearKey = (key: string) => {
      window.localStorage.removeItem(key);
      window.localStorage.removeItem(`${key}__exp`);
    };
    if (eventId) {
      clearKey(STORAGE_KEYS.dismissed(eventId));
      clearKey(STORAGE_KEYS.submitted(eventId));
      return;
    }
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith("ybw:event_popup_"))
      .forEach(clearKey);
  } catch {
    // ignore
  }
}

export function markHomepageEventAutoTrigger(timestampMs: number = Date.now()): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      HOMEPAGE_EVENT_AUTO_TRIGGER_SESSION_KEY,
      String(timestampMs)
    );
  } catch {
    // ignore storage errors
  }
}

export function hasHomepageEventAutoTriggeredThisSession(maxAgeMs: number = 5 * 60 * 1000): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.sessionStorage.getItem(HOMEPAGE_EVENT_AUTO_TRIGGER_SESSION_KEY);
    if (!raw) return false;
    const when = parseInt(raw, 10);
    if (Number.isNaN(when)) return false;
    return Date.now() - when < maxAgeMs;
  } catch {
    return false;
  }
}
