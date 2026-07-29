"use client";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Loader2 } from "lucide-react";

const COOLDOWN_MS = 30_000;
const SOURCE = "Home Page Inline";

export function NewsletterSection() {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastAttemptTime, setLastAttemptTime] = useState<number | null>(null);

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
          email: email.trim().toLowerCase(),
          source: SOURCE,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("[NewsletterSection] error response:", data);
        const errorMsg = data?.error || data?.subscriptionError || data?.message
          || (typeof data === 'string' ? data : null)
          || "Failed to subscribe";
        throw new Error(errorMsg);
      }

      setSuccessMessage(data.message || "You're subscribed!");
      setIsSubmitted(true);
      setLastAttemptTime(now);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      console.error("[NewsletterSection] subscription error:", err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [email, lastAttemptTime]);

  return (
    <section className="bg-accent text-accent-foreground">
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8 lg:py-10">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-serif text-2xl font-medium leading-tight">
            Subscribe to Newsletter
          </h2>
          <p className="mt-3 text-sm text-accent-foreground/80">
            Weekly insights on leadership, finance, and career growth delivered to your inbox.
          </p>

          {isSubmitted ? (
            <div className="mt-10 flex items-center justify-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-foreground/20">
                <Check className="h-6 w-6" />
              </div>
              <div className="text-left">
                <p className="font-medium">{successMessage}</p>
                <p className="text-sm text-accent-foreground/70">Check your inbox soon.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-10" noValidate>
              <div className="flex flex-col gap-3 sm:flex-row sm:gap-2 justify-center">
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="h-12 w-full border border-accent-foreground/30 bg-transparent px-4 text-sm text-accent-foreground placeholder:text-accent-foreground/50 focus:border-accent-foreground focus:outline-none transition-colors sm:max-w-sm disabled:opacity-50"
                  required
                  disabled={isLoading}
                />
                <Button
                  type="submit"
                  disabled={isLoading || !email}
                  className="h-12 gap-2 bg-accent-foreground px-6 text-sm font-medium text-accent hover:bg-accent-foreground/90 disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Subscribe
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
              {error && (
                <p className="mt-3 text-sm text-accent-foreground/90" role="alert">{error}</p>
              )}
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
