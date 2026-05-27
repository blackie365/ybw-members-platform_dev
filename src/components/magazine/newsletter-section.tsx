"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ArrowRight, Check, Loader2 } from "lucide-react"

export function NewsletterSection() {
  const [email, setEmail] = useState("")
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [lastAttemptTime, setLastAttemptTime] = useState<number | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const now = Date.now()
    if (lastAttemptTime && now - lastAttemptTime < 120000) {
      const remainingSeconds = Math.ceil((120000 - (now - lastAttemptTime)) / 1000)
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
        
        if (!res.ok) {
          throw new Error("Failed to subscribe")
        }
        
        setIsSubmitted(true)
        setLastAttemptTime(now)
      } catch (err) {
        setError("Something went wrong. Please try again.")
      } finally {
        setIsLoading(false)
      }
    }
  }

  return (
    <section className="bg-foreground text-background">
      <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8 lg:py-20">
        <div className="flex flex-col items-center justify-between gap-8 lg:flex-row">
          {/* Text */}
          <div className="text-center lg:text-left">
            <h2 className="font-serif text-2xl font-medium lg:text-3xl">
              Stay in the loop
            </h2>
            <p className="mt-2 text-sm text-background/60 max-w-md">
              Weekly insights on leadership, finance, and career growth delivered to your inbox.
            </p>
          </div>

          {/* Form */}
          {isSubmitted ? (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent">
                <Check className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-medium">You&apos;re subscribed!</p>
                <p className="text-xs text-background/60">Check your inbox soon.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="w-full max-w-md">
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="h-11 flex-1 border border-background/20 bg-transparent px-4 text-sm text-background placeholder:text-background/40 focus:border-accent focus:outline-none transition-colors"
                  required
                  disabled={isLoading}
                />
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="h-11 gap-2 bg-accent px-5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Subscribe
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </Button>
              </div>
              {error && (
                <p className="mt-2 text-xs text-red-400">{error}</p>
              )}
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
