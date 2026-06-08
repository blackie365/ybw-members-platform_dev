"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Loader2 } from "lucide-react";

export function NewsletterSection() {
  const [email, setEmail] = useState("")
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [lastAttemptTime, setLastAttemptTime] = useState<number | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const now = Date.now()
    if (lastAttemptTime && now - lastAttemptTime < 30000) {
      const remainingSeconds = Math.ceil((30000 - (now - lastAttemptTime)) / 1000)
      setError(`Please wait ${remainingSeconds} seconds before trying again.`)
      return
    }

    if (email) {
      setIsLoading(true)
      setError("")
      try {
        const res = await fetch('/api/newsletter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        })
        
        const data = await res.json()
        
        if (!res.ok) {
          console.error("Newsletter error response:", data);
          const errorMsg = data.error || data.subscriptionError || data.message || (typeof data === 'string' ? data : JSON.stringify(data));
          throw new Error(errorMsg || "Failed to subscribe");
        }
        
        setSuccessMessage(data.message || "You're subscribed!");
        setIsSubmitted(true)
        setLastAttemptTime(now)
      } catch (err: any) {
        console.error("Newsletter subscription error:", err);
        setError(err.message || "Something went wrong. Please try again.")
      } finally {
        setIsLoading(false)
      }
    }
  }

  return (
    <section className="bg-accent text-accent-foreground">
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8 lg:py-10">
        <div className="mx-auto max-w-2xl text-center">
          {/* Header */}
          <h2 className="font-serif text-2xl font-medium leading-tight">
            Subscribe to Newsletter
          </h2>
          <p className="mt-3 text-sm text-accent-foreground/80">
            Weekly insights on leadership, finance, and career growth delivered to your inbox.
          </p>

          {/* Form */}
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
            <form onSubmit={handleSubmit} className="mt-10">
              <div className="flex flex-col gap-3 sm:flex-row sm:gap-2 justify-center">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="h-12 w-full border border-accent-foreground/30 bg-transparent px-4 text-sm text-accent-foreground placeholder:text-accent-foreground/50 focus:border-accent-foreground focus:outline-none transition-colors sm:max-w-sm"
                  required
                  disabled={isLoading}
                />
                <Button
                  type="submit"
                  disabled={isLoading}
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
                <p className="mt-3 text-sm text-accent-foreground/80">{error}</p>
              )}
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
