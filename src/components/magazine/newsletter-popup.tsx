"use client";

import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Loader2, X } from "lucide-react";

const DISMISS_KEY = "ybw:newsletter_popup_dismissed";
const DISMISS_DAYS = 30;
const DISMISS_MS = DISMISS_DAYS * 24 * 60 * 60 * 1000;
const SHOW_DELAY_MS = 8000;
const COOLDOWN_MS = 30_000;
const SOURCE = "Home Page Pop-up";

const INPUT_CLASS = "h-11 w-full border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors rounded-md disabled:opacity-50";

function isDismissedStored(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const dismissedAt = parseInt(raw, 10);
    if (Number.isNaN(dismissedAt)) return false;
    return Date.now() - dismissedAt < DISMISS_MS;
  } catch {
    return false;
  }
}

function storeDismissed(): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
  }
}

export function NewsletterPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastAttemptTime, setLastAttemptTime] = useState<number | null>(null);

  useEffect(() => {
    if (isDismissedStored()) return;
    const timer = setTimeout(() => setIsOpen(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const closeAndDismiss = useCallback(() => {
    storeDismissed();
    setIsOpen(false);
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      storeDismissed();
    }
    setIsOpen(open);
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    const now = Date.now();
    if (lastAttemptTime && now - lastAttemptTime < COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((COOLDOWN_MS - (now - lastAttemptTime)) / 1000);
      setError(`Please wait ${remainingSeconds} seconds before trying again.`);
      return;
    }

    if (!email) return;

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          source: SOURCE,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("[NewsletterPopup] error response:", data);
        const errorMsg = data?.error || data?.subscriptionError || data?.message
          || (typeof data === 'string' ? data : null)
          || "Failed to subscribe";
        throw new Error(errorMsg);
      }

      setSuccessMessage(data.message || "You're subscribed!");
      setIsSubmitted(true);
      setLastAttemptTime(now);
      storeDismissed();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      console.error("[NewsletterPopup] subscription error:", err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [email, firstName, lastName, lastAttemptTime]);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md p-0 overflow-hidden"
        showCloseButton={false}
      >
        <button
          type="button"
          onClick={closeAndDismiss}
          className="absolute top-4 right-4 rounded-xs p-1 text-muted-foreground opacity-70 hover:opacity-100 hover:bg-accent transition-opacity z-10"
          aria-label="Close newsletter signup"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="bg-accent px-6 pt-8 pb-6 text-accent-foreground">
          <DialogHeader className="text-center">
            <DialogTitle className="font-serif text-2xl font-medium leading-tight">
              Stay in the Loop
            </DialogTitle>
            <DialogDescription className="text-accent-foreground/80 text-sm mt-2">
              Get weekly insights on leadership, finance, and career growth — delivered straight to your inbox.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 pb-8 pt-6">
          {isSubmitted ? (
            <div className="flex flex-col items-center justify-center gap-4 py-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
                <Check className="h-8 w-8 text-accent" />
              </div>
              <div className="text-center">
                <p className="font-medium text-lg">{successMessage}</p>
                <p className="text-sm text-muted-foreground mt-1">Check your inbox soon.</p>
              </div>
              <Button
                type="button"
                onClick={closeAndDismiss}
                className="mt-2 bg-accent text-accent-foreground hover:bg-accent/90"
              >
                Close
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="popup-firstName" className="block text-sm font-medium text-foreground mb-1.5">
                    First name
                  </label>
                  <input
                    id="popup-firstName"
                    type="text"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jane"
                    className={INPUT_CLASS}
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <label htmlFor="popup-lastName" className="block text-sm font-medium text-foreground mb-1.5">
                    Last name
                  </label>
                  <input
                    id="popup-lastName"
                    type="text"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Smith"
                    className={INPUT_CLASS}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="popup-email" className="block text-sm font-medium text-foreground mb-1.5">
                  Email <span className="text-destructive">*</span>
                </label>
                <input
                  id="popup-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@company.co.uk"
                  className={INPUT_CLASS}
                  required
                  disabled={isLoading}
                />
              </div>

              {error && (
                <p className="text-sm text-destructive" role="alert">{error}</p>
              )}

              <Button
                type="submit"
                disabled={isLoading || !email}
                className="w-full h-12 gap-2 bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 font-medium"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Subscribe Now
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                No spam, ever. Unsubscribe anytime.
              </p>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
