"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ArrowRight, Check, Loader2, Mail, Sparkles } from "lucide-react"

export function NewsletterSection() {
  const [email, setEmail] = useState("")
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
      } catch (err) {
        setError("Something went wrong. Please try again.")
      } finally {
        setIsLoading(false)
      }
    }
  }

  return (
    <section className="relative overflow-hidden bg-primary text-primary-foreground">
      {/* Decorative elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.05),transparent_50%)]" />
      
      <div className="relative mx-auto max-w-7xl px-4 py-24 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-2xl text-center">
          {/* Icon */}
          <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-full border border-primary-foreground/20 bg-primary-foreground/5">
            <Mail className="h-7 w-7 text-accent" />
          </div>
          
          <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-accent">
            Stay Informed
          </span>
          <h2 className="mt-4 font-serif text-3xl font-medium lg:text-5xl">
            The Yorkshire Businesswoman Newsletter
          </h2>
          <p className="mx-auto mt-6 max-w-lg text-[15px] leading-relaxed text-primary-foreground/70">
            Join thousands of ambitious women who start their week with our curated 
            insights on leadership, finance, and career growth across the region.
          </p>

          {/* Benefits */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {["Weekly insights", "Exclusive events", "Member spotlights"].map((benefit) => (
              <div key={benefit} className="flex items-center gap-2 text-primary-foreground/60">
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                <span className="text-xs">{benefit}</span>
              </div>
            ))}
          </div>

          {isSubmitted ? (
            <div className="mt-12 flex flex-col items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent shadow-lg">
                <Check className="h-7 w-7 text-accent-foreground" />
              </div>
              <div>
                <p className="font-serif text-2xl font-medium">Welcome to the community!</p>
                <p className="mt-2 text-sm text-primary-foreground/70">Check your inbox shortly for your first newsletter.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-12">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className="h-14 w-full border border-primary-foreground/20 bg-primary-foreground/5 px-5 text-sm text-primary-foreground placeholder:text-primary-foreground/40 focus:border-accent focus:bg-primary-foreground/10 focus:outline-none focus:ring-1 focus:ring-accent transition-all sm:w-80"
                    required
                    disabled={isLoading}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="h-14 gap-2 bg-accent px-8 text-[11px] font-semibold uppercase tracking-[0.15em] text-accent-foreground shadow-lg transition-all hover:bg-accent/90 hover:shadow-xl disabled:opacity-50"
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
                <p className="mt-3 text-sm text-red-300">{error}</p>
              )}
              <p className="mt-6 text-[11px] text-primary-foreground/50">
                By subscribing, you agree to our Privacy Policy. Unsubscribe anytime.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
